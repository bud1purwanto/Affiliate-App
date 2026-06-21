// Content script: berjalan di threads.com / threads.net.
// Bertugas mengisi composer Threads dengan teks UTAS dan (best-effort) topic.

(function () {
  // Cari elemen composer contenteditable yang sedang aktif/terlihat.
  function findComposer() {
    const candidates = Array.from(
      document.querySelectorAll('[contenteditable="true"], textarea')
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    // Prioritaskan yang fokus, lalu yang punya placeholder terkait post
    const focused = candidates.find((el) => el === document.activeElement);
    if (focused) return focused;
    return candidates[candidates.length - 1] || null;
  }

  // Sisipkan teks ke elemen (contenteditable atau textarea) secara natural.
  function insertText(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      ).set;
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // contenteditable: pakai execCommand insertText agar React menangkap perubahan
      const sel = window.getSelection();
      sel.selectAllChildren(el);
      sel.deleteFromDocument();
      document.execCommand('insertText', false, text);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    }
  }

  // Best-effort: isi field topic/community jika ada.
  function fillTopic(topic) {
    if (!topic) return false;
    const topicEl = Array.from(
      document.querySelectorAll('[contenteditable="true"], input[type="text"]')
    ).find((el) => {
      const ph = (el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').toLowerCase();
      const txt = (el.textContent || '').toLowerCase();
      return ph.includes('topic') || ph.includes('community') || txt.includes('community or topic');
    });
    if (topicEl) {
      insertText(topicEl, topic);
      return true;
    }
    return false;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'THREADSMIL_FILL') {
      const composer = findComposer();
      if (!composer) {
        sendResponse({
          ok: false,
          error: 'Composer Threads tidak ditemukan. Buka kotak "New thread" dulu, lalu klik lagi.',
        });
        return true;
      }
      insertText(composer, msg.text || '');
      let topicFilled = false;
      if (msg.topic) topicFilled = fillTopic(msg.topic);
      sendResponse({ ok: true, topicFilled });
      return true;
    }
    if (msg.type === 'THREADSMIL_PING') {
      sendResponse({ ok: true });
      return true;
    }
  });
})();

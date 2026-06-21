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

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Ambil semua composer yang terlihat, urut atas→bawah (urutan dokumen).
  function getComposers() {
    return Array.from(document.querySelectorAll('[contenteditable="true"], textarea')).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  // Cari tombol "Add to thread" yang bisa diklik.
  function findAddToThread() {
    const els = Array.from(document.querySelectorAll('div[role="button"], span, button, [aria-label]'));
    const matches = els.filter((el) => {
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
      return label === 'add to thread' || label.includes('add to thread') || label.includes('tambahkan ke utas');
    });
    if (!matches.length) return null;
    // ambil yang paling bawah & paling spesifik (teks terpendek)
    matches.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    return matches[0].closest('[role="button"]') || matches[0];
  }

  // Isi rangkaian post sebagai satu utas (chaining via "Add to thread").
  async function fillAll(posts, topic) {
    if (!Array.isArray(posts) || !posts.length) return { ok: false, error: 'Tidak ada post untuk dikirim.' };
    let composers = getComposers();
    if (!composers.length) {
      return { ok: false, error: 'Composer Threads tidak ditemukan. Buka "New thread" dulu.' };
    }
    insertText(composers[0], posts[0]);
    if (topic) fillTopic(topic);
    await wait(400);

    for (let i = 1; i < posts.length; i++) {
      const addBtn = findAddToThread();
      if (!addBtn) {
        return { ok: false, error: `Tombol "Add to thread" tidak ditemukan (berhenti di post ${i}/${posts.length}). Sisanya bisa diisi manual.`, filled: i };
      }
      const before = getComposers().length;
      addBtn.click();
      // tunggu composer baru muncul
      for (let t = 0; t < 12; t++) {
        await wait(250);
        if (getComposers().length > before) break;
      }
      composers = getComposers();
      const target = composers[composers.length - 1];
      if (!target) return { ok: false, error: `Composer baru tidak muncul di post ${i + 1}.`, filled: i };
      insertText(target, posts[i]);
      await wait(350);
    }
    return { ok: true, count: posts.length };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'THREADSMIL_FILL_ALL') {
      fillAll(msg.posts, msg.topic).then(sendResponse);
      return true; // async
    }
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

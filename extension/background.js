// Buka side panel saat ikon ekstensi diklik.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('setPanelBehavior:', err));

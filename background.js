const BADGE = {
  formatted: { text: '•', color: '#10B981' },   // green dot
  invalid:   { text: '!',      color: '#F59E0B' },   // amber !
  disabled:  { text: '×', color: '#71717A' },   // grey ×
  inactive:  { text: '',       color: '#00000000' }
};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      theme: 'auto',
      defaultExpandDepth: 2,
      enableJSON: true,
      enableYAML: true,
      enableXML: true,
      showPathChip: true,
      disabledOrigins: [],
      excludePatterns: []
    });
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

// Badge state, per-tab disable persistence, and the options-page opener.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'treejson:badge') {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    const cfg = BADGE[msg.state] || BADGE.inactive;
    chrome.action.setBadgeText({ tabId, text: cfg.text });
    if (cfg.text) chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color });
    return;
  }

  if (msg.type === 'treejson:get-tab-disabled') {
    const tabId = msg.tabId ?? sender.tab?.id;
    if (!tabId) { sendResponse({ disabled: false }); return; }
    chrome.storage.session.get('disabledTabs').then(({ disabledTabs = {} }) => {
      sendResponse({ disabled: !!disabledTabs[tabId] });
    });
    return true; // async response
  }

  if (msg.type === 'treejson:set-tab-disabled') {
    const tabId = msg.tabId ?? sender.tab?.id;
    if (!tabId) { sendResponse?.({ ok: false }); return; }
    chrome.storage.session.get('disabledTabs').then(({ disabledTabs = {} }) => {
      if (msg.disabled) disabledTabs[tabId] = true;
      else delete disabledTabs[tabId];
      chrome.storage.session.set({ disabledTabs }).then(() => sendResponse?.({ ok: true }));
    });
    return true;
  }

  if (msg.type === 'treejson:open-options') {
    chrome.runtime.openOptionsPage();
    return;
  }

  // RatingWidget event bus — persists "done" and opens store/feedback URLs.
  if (msg.type === 'rw:event') {
    const keys = msg.storageKeys || { done: 'rwDone' };
    chrome.storage.local.set({ [keys.done]: true });
    if (msg.action === 'open-store' && msg.url) chrome.tabs.create({ url: msg.url });
    else if (msg.action === 'open-feedback' && msg.url) chrome.tabs.create({ url: msg.url });
    return;
  }
});

// Drop the per-tab disable record when the tab is closed.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.get('disabledTabs').then(({ disabledTabs = {} }) => {
    if (disabledTabs[tabId]) {
      delete disabledTabs[tabId];
      chrome.storage.session.set({ disabledTabs });
    }
  });
});

// Forward keyboard commands to active tab's content script.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'treejson:command', command });
  } catch (_e) {
    // No content script — silently ignore.
  }
});


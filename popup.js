const els = {
  statusDot:    document.querySelector('.status-dot'),
  statusLabel:  document.querySelector('.status-label'),
  statusMeta:   document.querySelector('.status-meta'),
  statusUrl:    document.querySelector('.status-url'),
  toggles:      document.getElementById('toggles'),
  tabToggle:    document.getElementById('tab-toggle'),
  tabToggleLbl: document.getElementById('tab-toggle-label'),
  origToggle:   document.getElementById('origin-toggle'),
  origToggleLbl:document.getElementById('origin-toggle-label'),
  actions:      document.getElementById('actions'),
  copyBtn:      document.getElementById('copy-action'),
  downloadBtn:  document.getElementById('download-action'),
  emptyHint:    document.getElementById('empty-hint'),
  optionsBtn:   document.getElementById('open-options')
};

let currentTab = null;
let currentOrigin = null;
let disabledOrigins = [];

(async function init() {
  els.optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  if (!tab) {
    renderState('nojson', { url: '', meta: '', reason: 'No active tab.' });
    return;
  }

  let host = '';
  try { host = new URL(tab.url).host; } catch (_e) { host = ''; }
  currentOrigin = host;
  els.statusUrl.textContent = tab.url || '';
  els.statusUrl.title = tab.url || '';

  // Load disabled origins
  const { disabledOrigins: stored = [] } = await new Promise((res) =>
    chrome.storage.sync.get({ disabledOrigins: [] }, res));
  disabledOrigins = stored;

  // Check if the page is even injectable (chrome://, etc.)
  if (!/^https?:|^file:/.test(tab.url || '')) {
    renderState('nojson', {
      url: tab.url,
      meta: '',
      reason: "TreeJSON can't run on Chrome internal pages."
    });
    return;
  }

  // Query content script for status
  let response = null;
  try {
    response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, { type: 'treejson:status' }),
      new Promise((res) => setTimeout(() => res(null), 200))
    ]);
  } catch (_e) {
    response = null;
  }

  if (!response) {
    renderState('nojson', {
      url: tab.url,
      meta: '',
      reason: 'No JSON detected on this tab.'
    });
    return;
  }

  renderState(response.state, {
    url: tab.url,
    type: response.type,
    bytes: response.bytes,
    nodes: response.nodes,
    errorLine: response.errorLine
  });
})();

function renderState(stateName, info) {
  els.statusDot.dataset.state = stateName;

  const labels = {
    formatted: 'Formatted',
    invalid:   'Invalid JSON',
    disabled:  'Disabled for this tab',
    nojson:    'No JSON here'
  };
  els.statusLabel.textContent = labels[stateName] || labels.nojson;

  if (stateName === 'formatted') {
    const sz = formatBytes(info.bytes);
    els.statusMeta.textContent = `${(info.type || 'JSON').toUpperCase()} · ${sz} · ${info.nodes?.toLocaleString?.() || info.nodes} nodes`;
    showElements({ toggles: true, actions: true, emptyHint: false });
  } else if (stateName === 'invalid') {
    els.statusMeta.textContent = info.errorLine ? `Parser error · line ${info.errorLine}` : 'Parser error';
    showElements({ toggles: true, actions: false, emptyHint: false });
  } else if (stateName === 'disabled') {
    els.statusMeta.textContent = info.reason || 'You toggled TreeJSON off here.';
    showElements({ toggles: true, actions: false, emptyHint: false });
    invertToggleCopy();
  } else {
    els.statusMeta.textContent = info.reason || '';
    showElements({ toggles: false, actions: false, emptyHint: true });
  }

  if (info.url) {
    els.statusUrl.textContent = info.url;
    els.statusUrl.title = info.url;
  }

  hookToggles(stateName);
  hookActions();
}

function showElements({ toggles, actions, emptyHint }) {
  els.toggles.hidden = !toggles;
  els.actions.hidden = !actions;
  els.emptyHint.hidden = !emptyHint;
}

function invertToggleCopy() {
  els.tabToggleLbl.textContent = 'Enable for this tab';
  els.origToggleLbl.textContent = currentOrigin ? `Enable for ${currentOrigin}` : 'Enable for this origin';
}

function hookToggles(stateName) {
  if (!currentTab) return;

  // Origin toggle reflects stored disabledOrigins
  els.origToggle.checked = disabledOrigins.includes(currentOrigin);
  if (els.origToggle.checked) {
    els.origToggleLbl.textContent = `Enable for ${currentOrigin}`;
  } else if (currentOrigin) {
    els.origToggleLbl.textContent = `Disable for ${currentOrigin}`;
  }

  // Tab toggle reflects current state
  els.tabToggle.checked = stateName === 'disabled';
  if (stateName === 'disabled') {
    els.tabToggleLbl.textContent = 'Enable for this tab';
  } else {
    els.tabToggleLbl.textContent = 'Disable for this tab';
  }

  els.tabToggle.onchange = async () => {
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: 'treejson:action',
        action: els.tabToggle.checked ? 'disable-tab' : 'enable-tab'
      });
    } catch (_e) { /* tab may not have content script */ }
    setTimeout(() => window.close(), 150);
  };

  els.origToggle.onchange = async () => {
    if (!currentOrigin) return;
    let updated = disabledOrigins.filter(o => o !== currentOrigin);
    if (els.origToggle.checked) updated.push(currentOrigin);
    await new Promise((res) => chrome.storage.sync.set({ disabledOrigins: updated }, res));
    disabledOrigins = updated;
    setTimeout(() => window.close(), 150);
  };
}

function hookActions() {
  if (!currentTab) return;
  els.copyBtn.onclick = async () => {
    try {
      await chrome.tabs.sendMessage(currentTab.id, { type: 'treejson:action', action: 'copy' });
    } catch (_e) {}
    window.close();
  };
  els.downloadBtn.onclick = async () => {
    try {
      await chrome.tabs.sendMessage(currentTab.id, { type: 'treejson:action', action: 'download' });
    } catch (_e) {}
    window.close();
  };
}

function formatBytes(n) {
  if (!n) return '0 B';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

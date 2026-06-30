const DEFAULTS = {
  theme: 'auto',
  defaultExpandDepth: 2,
  enableJSON: true,
  enableYAML: true,
  enableXML: true,
  showPathChip: true,
  disabledOrigins: [],
  excludePatterns: []
};

const els = {
  themes:           document.querySelectorAll('input[name="theme"]'),
  expand:           document.getElementById('expand'),
  enableJSON:       document.getElementById('enableJSON'),
  enableYAML:       document.getElementById('enableYAML'),
  enableXML:        document.getElementById('enableXML'),
  showPathChip:     document.getElementById('showPathChip'),
  excludePatterns:  document.getElementById('excludePatterns'),
  originsList:      document.getElementById('disabledOriginsList'),
  status:           document.getElementById('status'),
  navItems:         document.querySelectorAll('.nav-item'),
  openShortcuts:    document.getElementById('open-shortcuts'),
  resetBtn:         document.getElementById('reset-defaults'),
  versionEl:        document.getElementById('versionEl')
};

async function load() {
  const s = await new Promise((res) => chrome.storage.sync.get(DEFAULTS, res));
  els.themes.forEach(r => { r.checked = r.value === s.theme; });
  els.expand.value = s.defaultExpandDepth;
  els.enableJSON.checked = s.enableJSON;
  els.enableYAML.checked = s.enableYAML;
  els.enableXML.checked = s.enableXML;
  els.showPathChip.checked = s.showPathChip;
  els.excludePatterns.value = (s.excludePatterns || []).join('\n');
  renderOrigins(s.disabledOrigins || []);
  els.versionEl.textContent = chrome.runtime.getManifest().version;
}

function renderOrigins(origins) {
  els.originsList.innerHTML = '';
  if (!origins.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No origins disabled. Use the popup on a page to disable a specific origin.';
    els.originsList.appendChild(empty);
    return;
  }
  for (const origin of origins) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = origin;
    const btn = document.createElement('button');
    btn.className = 'remove';
    btn.type = 'button';
    btn.textContent = '×';
    btn.setAttribute('aria-label', `Re-enable TreeJSON for ${origin}`);
    btn.title = 'Re-enable for this origin';
    btn.addEventListener('click', async () => {
      const updated = origins.filter(o => o !== origin);
      await save({ disabledOrigins: updated });
      renderOrigins(updated);
    });
    li.appendChild(span);
    li.appendChild(btn);
    els.originsList.appendChild(li);
  }
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(commit, 200);
}

async function commit() {
  const theme = Array.from(els.themes).find(r => r.checked)?.value || 'auto';
  const expand = clamp(parseInt(els.expand.value, 10), 0, 20, 2);
  const patterns = els.excludePatterns.value.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  await save({
    theme,
    defaultExpandDepth: expand,
    enableJSON: els.enableJSON.checked,
    enableYAML: els.enableYAML.checked,
    enableXML:  els.enableXML.checked,
    showPathChip: els.showPathChip.checked,
    excludePatterns: patterns
  });
}

async function save(partial) {
  await new Promise((res) => chrome.storage.sync.set(partial, res));
  showSaved();
}

function showSaved() {
  els.status.textContent = 'Saved';
  els.status.classList.add('visible');
  clearTimeout(showSaved.t);
  showSaved.t = setTimeout(() => els.status.classList.remove('visible'), 1500);
}

function clamp(n, min, max, fallback) {
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function setupNav() {
  const sections = Array.from(document.querySelectorAll('.section'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        els.navItems.forEach(n => n.classList.toggle('active', n.getAttribute('href') === `#${id}`));
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
  sections.forEach(s => observer.observe(s));
}

function setupShortcuts() {
  els.openShortcuts.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
}

function setupReset() {
  els.resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset all TreeJSON settings to defaults?')) return;
    await new Promise((res) => chrome.storage.sync.clear(res));
    await new Promise((res) => chrome.storage.sync.set(DEFAULTS, res));
    await load();
    showSaved();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  setupNav();
  setupShortcuts();
  setupReset();
  els.themes.forEach(r => r.addEventListener('change', scheduleSave));
  ['change', 'input'].forEach(evt => {
    els.expand.addEventListener(evt, scheduleSave);
    els.excludePatterns.addEventListener(evt, scheduleSave);
  });
  els.enableJSON.addEventListener('change', scheduleSave);
  els.enableYAML.addEventListener('change', scheduleSave);
  els.enableXML.addEventListener('change', scheduleSave);
  els.showPathChip.addEventListener('change', scheduleSave);
});

// React to changes from other devices.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.disabledOrigins) {
    renderOrigins(changes.disabledOrigins.newValue || []);
  }
});

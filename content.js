(() => {
  if (window.__treejsonLoaded) return;
  window.__treejsonLoaded = true;

  // Rating widget config. Friendly-neutral copy, emoji scale, no feedback URL
  // (no external destinations until we wire one up).
  const RATING_OPTS = {
    appName: 'TreeJSON',
    threshold: 5,
    scale: 'emoji',
    feedbackUrl: '',
    autoDismissMs: 12000,
    i18n: {
      prompt: 'How is TreeJSON working for you?',
      five: 'Great — would you share that on the Web Store?',
      fivePrimary: 'Leave a 5★ review',
      four: 'Glad to hear. Anything we could improve?',
      fourPrimary: 'Send a quick note',
      low: 'Sorry to hear. Anything we could fix?',
      lowPrimary: 'Tell us what to fix',
      thanks: 'Thanks for the feedback.',
      notNow: 'Not now'
    }
  };

  let ratingShownThisSession = false;
  async function maybeShowRating() {
    if (ratingShownThisSession) return;
    if (!window.RatingWidget) return;
    if (!chrome?.storage) return;
    try {
      await window.RatingWidget.bump(RATING_OPTS);
      if (await window.RatingWidget.shouldShow(RATING_OPTS)) {
        const opts = { ...RATING_OPTS };
        if (chrome.runtime?.id) {
          opts.storeUrl = `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
        }
        ratingShownThisSession = true;
        window.RatingWidget.show(opts);
      }
    } catch (_e) { /* never break the page over a rating prompt */ }
  }

  // Cold-paint hide: inject visibility:hidden synchronously at document_start
  // so the user never sees the raw text Chrome would otherwise render briefly.
  let coldPaintStyle = null;
  function hideColdPaint() {
    if (!document.documentElement) return;
    coldPaintStyle = document.createElement('style');
    coldPaintStyle.textContent = 'html,body{visibility:hidden!important;background:#fafafa!important}@media (prefers-color-scheme:dark){html,body{background:#0b0c0f!important}}';
    document.documentElement.appendChild(coldPaintStyle);
  }
  function showAgain() {
    if (coldPaintStyle && coldPaintStyle.parentNode) coldPaintStyle.parentNode.removeChild(coldPaintStyle);
    coldPaintStyle = null;
  }

  const state = {
    rawText: '',
    parsed: null,
    type: 'json',
    error: null,
    settings: {
      theme: 'auto',
      defaultExpandDepth: 2,
      enableJSON: true,
      enableYAML: true,
      enableXML: true,
      showPathChip: true,
      disabledOrigins: [],
      excludePatterns: []
    },
    shadowRoot: null,
    rootEl: null,
    disabledThisTab: false,
    matchCount: 0
  };

  // ---- Bootstrap ----

  if (!shouldFormat()) {
    sendBadge('inactive');
    return;
  }

  hideColdPaint();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Service worker can ask us to toggle or focus search.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'treejson:command' && msg.type !== 'treejson:status' && msg.type !== 'treejson:action') {
      return;
    }
    if (msg.type === 'treejson:command') {
      if (msg.command === 'toggle-formatting') toggleFormatting();
      if (msg.command === 'search-json') focusSearch();
      return;
    }
    if (msg.type === 'treejson:status') {
      sendResponse({
        state: state.error ? 'invalid' : state.disabledThisTab ? 'disabled' : state.shadowRoot ? 'formatted' : 'nojson',
        type: state.type,
        bytes: state.rawText.length,
        nodes: countNodes(state.parsed),
        url: location.href,
        errorLine: state.error?.lineNumber || null
      });
      return true; // async-ish; we replied synchronously but keep channel safe
    }
    if (msg.type === 'treejson:action') {
      if (msg.action === 'copy') copyFormattedTopLevel();
      if (msg.action === 'download') downloadTopLevel();
      if (msg.action === 'disable-tab') {
        disableThisTab(true);
      }
      if (msg.action === 'enable-tab') {
        disableThisTab(false);
      }
      if (msg.action === 'open-options') {
        try { chrome.runtime.sendMessage({ type: 'treejson:open-options' }); } catch (_e) {}
      }
      return;
    }
  });

  function disableThisTab(disabled) {
    state.disabledThisTab = disabled;
    try { chrome.runtime.sendMessage({ type: 'treejson:set-tab-disabled', disabled }); } catch (_e) {}
    if (disabled) {
      teardown();
      document.body.innerHTML = '';
      const pre = document.createElement('pre');
      pre.style.cssText = 'margin:0;padding:16px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;';
      pre.textContent = state.rawText;
      document.body.appendChild(pre);
      sendBadge('disabled');
    } else {
      boot();
    }
  }

  // ---- Detection ----

  function shouldFormat() {
    const contentType = (document.contentType || '').toLowerCase();
    if (/svg\+xml/.test(contentType)) return false;
    const isJSON = /\b(application|text)\/(json|x-json|ld\+json|vnd\.[\w.+-]+\+json|hal\+json|problem\+json)\b/.test(contentType);
    const isYAML = /\b(application|text)\/(yaml|x-yaml)\b/.test(contentType);
    const isXML = /\b(application|text)\/(xml|x-xml|atom\+xml|rss\+xml)\b/.test(contentType);
    const url = location.href.toLowerCase();
    const isJSONURL = /\.(json|jsonl|ndjson)(\?|#|$)/.test(url);
    const isYAMLURL = /\.(yaml|yml)(\?|#|$)/.test(url);
    const isXMLURL = /\.xml(\?|#|$)/.test(url);
    return isJSON || isYAML || isXML || isJSONURL || isYAMLURL || isXMLURL;
  }

  function getFormatType() {
    const ct = (document.contentType || '').toLowerCase();
    const url = location.href.toLowerCase();
    if (/yaml/.test(ct) || /\.(yaml|yml)(\?|#|$)/.test(url)) return 'yaml';
    if (/xml/.test(ct) || /\.xml(\?|#|$)/.test(url)) return 'xml';
    return 'json';
  }

  // ---- Boot ----

  async function boot() {
    try {
      state.settings = await new Promise((res) =>
        chrome.storage.sync.get({
          theme: 'auto',
          defaultExpandDepth: 2,
          enableJSON: true,
          enableYAML: true,
          enableXML: true,
          showPathChip: true,
          disabledOrigins: [],
          excludePatterns: []
        }, res)
      );

      // Per-tab disable (persisted in chrome.storage.session via SW)
      const tabState = await new Promise((res) => {
        try {
          chrome.runtime.sendMessage({ type: 'treejson:get-tab-disabled' }, (resp) => {
            if (chrome.runtime.lastError) res({ disabled: false });
            else res(resp || { disabled: false });
          });
        } catch (_e) { res({ disabled: false }); }
      });
      if (tabState.disabled) {
        state.disabledThisTab = true;
        // Capture the raw text BEFORE we wipe the body, otherwise the
        // freshly-rendered <pre> ends up empty.
        const sourcePre = document.querySelector('body > pre');
        const rawText = (sourcePre?.textContent || document.body.textContent || '').trim();
        state.rawText = rawText;
        document.body.innerHTML = '';
        const pre = document.createElement('pre');
        pre.style.cssText = 'margin:0;padding:16px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;';
        pre.textContent = rawText;
        document.body.appendChild(pre);
        showAgain();
        sendBadge('disabled');
        return;
      }

      // Per-origin disable
      if (Array.isArray(state.settings.disabledOrigins) && state.settings.disabledOrigins.includes(location.host)) {
        showAgain();
        sendBadge('disabled');
        return;
      }

      // Exclude patterns (regex, one per line)
      for (const pattern of state.settings.excludePatterns || []) {
        try {
          if (pattern && new RegExp(pattern).test(location.href)) {
            showAgain();
            sendBadge('disabled');
            return;
          }
        } catch (_e) { /* invalid regex — ignore */ }
      }

      const type = getFormatType();
      if (type === 'json' && !state.settings.enableJSON) { showAgain(); return; }
      if (type === 'yaml' && !state.settings.enableYAML) { showAgain(); return; }
      if (type === 'xml' && !state.settings.enableXML) { showAgain(); return; }

      const pre = document.querySelector('body > pre') || document.body;
      const rawText = (pre.textContent || '').trim();
      if (!rawText) { showAgain(); return; }

      state.rawText = rawText;
      state.type = type;

      try {
        if (type === 'json') {
          state.parsed = JSON.parse(rawText);
        } else if (type === 'yaml') {
          if (window.YAML?.parse) state.parsed = window.YAML.parse(rawText);
          else throw new Error('YAML parser unavailable');
        } else {
          state.parsed = parseXML(rawText);
        }
        state.error = null;
      } catch (e) {
        state.error = { message: e.message || String(e), lineNumber: extractLineNumber(e.message, rawText) };
      }

      mountUI();
      sendBadge(state.error ? 'invalid' : 'formatted');
      showAgain();
      if (!state.error) maybeShowRating();
    } catch (e) {
      console.error('TreeJSON: boot failed', e);
      showAgain();
    }
  }

  function teardown() {
    if (state.rootEl && state.rootEl.parentNode) {
      state.rootEl.parentNode.removeChild(state.rootEl);
    }
    state.rootEl = null;
    state.shadowRoot = null;
  }

  // ---- UI mounting (Shadow DOM) ----

  function mountUI() {
    // Clear original body. Keep <html> so Chrome's chrome remains.
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;padding:0;background:var(--tj-bg,#fafafa)';

    // Host element + shadow root
    const host = document.createElement('div');
    host.id = 'treejson-root';
    host.setAttribute('data-theme', resolveTheme(state.settings.theme));
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    state.rootEl = host;
    state.shadowRoot = shadow;

    const styleEl = document.createElement('style');
    styleEl.textContent = window.TreeJSONShadowStyles || '';
    shadow.appendChild(styleEl);

    const root = document.createElement('div');
    root.className = 'root';
    shadow.appendChild(root);

    root.appendChild(buildToolbar());
    root.appendChild(buildContent());

    // Apply system-theme listener
    if (state.settings.theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => host.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
      apply();
      mq.addEventListener?.('change', apply);
    }

    // Tree keyboard navigation
    wireTreeKeyboard(shadow);

    // Autofocus search
    setTimeout(() => shadow.querySelector('.search-input')?.focus(), 0);
  }

  function wireTreeKeyboard(shadow) {
    const tree = shadow.querySelector('.tree');
    if (!tree) return;
    // Make rows focusable; first row gets tabindex 0.
    const rows = tree.querySelectorAll('.row');
    rows.forEach((r, i) => r.tabIndex = i === 0 ? 0 : -1);

    tree.addEventListener('keydown', (e) => {
      const active = shadow.activeElement;
      if (!active || !active.classList?.contains('row')) return;
      const current = active;
      const all = Array.from(tree.querySelectorAll('.row'));
      const idx = all.indexOf(current);
      let next = null;
      if (e.key === 'ArrowDown') { next = all[idx + 1]; }
      else if (e.key === 'ArrowUp') { next = all[idx - 1]; }
      else if (e.key === 'ArrowRight') {
        const det = current.querySelector('details');
        if (det && !det.open) { det.open = true; e.preventDefault(); return; }
      } else if (e.key === 'ArrowLeft') {
        const det = current.closest('details');
        if (det && det.open) { det.open = false; e.preventDefault(); return; }
      } else if (e.key === 'Home') { next = all[0]; }
      else if (e.key === 'End') { next = all[all.length - 1]; }
      if (next) {
        e.preventDefault();
        all.forEach(r => r.tabIndex = -1);
        next.tabIndex = 0;
        next.focus();
        next.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function resolveTheme(setting) {
    if (setting === 'light') return 'light';
    if (setting === 'dark') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ---- Toolbar ----

  function buildToolbar() {
    const t = document.createElement('div');
    t.className = 'toolbar';
    t.setAttribute('role', 'toolbar');
    t.setAttribute('aria-label', 'TreeJSON toolbar');

    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.innerHTML = `<span class="brand-glyph" aria-hidden="true">{ }</span><span class="brand-name">TreeJSON</span>`;
    t.appendChild(brand);

    const divider = document.createElement('span');
    divider.className = 'divider';
    divider.setAttribute('aria-hidden', 'true');
    t.appendChild(divider);

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = describeMeta();
    if (state.error) meta.classList.add('is-error');
    t.appendChild(meta);

    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'search-wrap';
    searchWrap.innerHTML = `
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input class="search-input" type="search" placeholder="Search keys & values…" aria-label="Search in tree">
      <span class="search-count" aria-live="polite"></span>
    `;
    t.appendChild(searchWrap);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'actions';
    const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    const pathChipOn = state.settings.showPathChip !== false;
    actions.innerHTML = `
      <button class="btn primary" data-act="copy" title="Copy formatted">Copy</button>
      <button class="btn" data-act="raw" title="Switch to raw text view (selects all for quick copy)" aria-pressed="false">Raw</button>
      <button class="btn icon-only" data-act="path-chip" title="Toggle path chip on row hover" aria-label="Toggle path chip" aria-pressed="${pathChipOn}">$</button>
      <button class="btn icon-only" data-act="download" title="Download" aria-label="Download">${ICON_DOWNLOAD}</button>
      <button class="btn icon-only" data-act="settings" title="Settings" aria-label="Open settings">⚙</button>
      <div class="overflow">
        <button class="btn icon-only" data-act="overflow" title="More" aria-label="More" aria-haspopup="menu" aria-expanded="false">⋯</button>
        <div class="overflow-list" role="menu" hidden>
          <button data-act="collapse" role="menuitem">Collapse all</button>
          <button data-act="expand" role="menuitem">Expand all</button>
          ${state.type === 'json' ? `
            <button data-act="export-csv" role="menuitem">Export → CSV</button>
            <button data-act="export-ts" role="menuitem">Export → TypeScript types</button>
            <button data-act="export-schema" role="menuitem">Export → JSON Schema</button>
          ` : ''}
        </div>
      </div>
    `;
    t.appendChild(actions);

    // Wire up
    t.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      switch (act) {
        case 'copy': return copyFormattedTopLevel();
        case 'download': return downloadTopLevel();
        case 'path-chip': return togglePathChip(btn);
        case 'settings': {
          try { chrome.runtime.sendMessage({ type: 'treejson:open-options' }); } catch (_e) {}
          return;
        }
        case 'overflow': {
          const list = t.querySelector('.overflow-list');
          const expanded = !list.hidden;
          list.hidden = expanded;
          btn.setAttribute('aria-expanded', String(!expanded));
          if (!expanded) {
            const closer = (ev) => {
              if (!list.contains(ev.target) && ev.target !== btn) {
                list.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
                state.shadowRoot.removeEventListener('click', closer);
              }
            };
            setTimeout(() => state.shadowRoot.addEventListener('click', closer), 0);
          }
          return;
        }
        case 'collapse':
          state.shadowRoot.querySelectorAll('.tree details[open]').forEach(d => d.open = false);
          return;
        case 'expand':
          state.shadowRoot.querySelectorAll('.tree details').forEach(d => d.open = true);
          return;
        case 'raw': return toggleRaw();
        case 'export-csv': return exportCSV(state.parsed);
        case 'export-ts': return exportTypeScript(state.parsed);
        case 'export-schema': return exportSchema(state.parsed);
      }
    });

    const search = t.querySelector('.search-input');
    let timer = null;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const result = window.searchTree(state.shadowRoot, search.value);
        const counter = t.querySelector('.search-count');
        counter.textContent = search.value && result.total ? `${result.total}` : '';
      }, 80);
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        search.value = '';
        window.searchTree(state.shadowRoot, '');
        t.querySelector('.search-count').textContent = '';
        search.blur();
      }
    });

    return t;
  }

  function describeMeta() {
    const bytes = state.rawText.length;
    const sz = bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
              : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB`
              : `${bytes} B`;
    if (state.error) {
      const lineHint = state.error.lineNumber ? ` · line ${state.error.lineNumber}` : '';
      return `Invalid ${state.type.toUpperCase()}${lineHint}`;
    }
    const nodes = countNodes(state.parsed);
    return `${state.type.toUpperCase()} · ${sz} · ${nodes.toLocaleString()} node${nodes === 1 ? '' : 's'}`;
  }

  function countNodes(v) {
    if (v === null || v === undefined) return 1;
    if (Array.isArray(v)) return 1 + v.reduce((acc, x) => acc + countNodes(x), 0);
    if (typeof v === 'object') return 1 + Object.values(v).reduce((acc, x) => acc + countNodes(x), 0);
    return 1;
  }

  // ---- Content ----

  function buildContent() {
    const main = document.createElement('main');
    main.className = 'content';
    main.setAttribute('role', 'main');

    if (state.error) {
      main.appendChild(buildErrorCard());
    } else {
      const tree = document.createElement('div');
      tree.className = 'tree' + (state.settings.showPathChip === false ? ' no-path-chip' : '');
      tree.setAttribute('role', 'tree');
      tree.appendChild(window.renderTree(state.parsed, {
        expandDepth: state.settings.defaultExpandDepth,
        type: state.type,
        onCopy: (msg) => { showToast(msg); if (/^Copied/.test(msg)) maybeShowRating(); },
        onContext: (e, path, value) => showContextMenu(e, path, value)
      }));
      main.appendChild(tree);
    }
    return main;
  }

  function togglePathChip(btn) {
    const next = !(state.settings.showPathChip !== false);
    state.settings.showPathChip = next;
    btn.setAttribute('aria-pressed', String(next));
    const tree = state.shadowRoot.querySelector('.tree');
    if (tree) tree.classList.toggle('no-path-chip', !next);
    try { chrome.storage.sync.set({ showPathChip: next }); } catch (_e) {}
  }

  function buildErrorCard() {
    const card = document.createElement('section');
    card.className = 'error-card';
    card.setAttribute('role', 'alert');
    const lineInfo = state.error.lineNumber ? ` · line ${state.error.lineNumber}` : '';
    card.innerHTML = `
      <h3>Invalid ${state.type.toUpperCase()}${escapeHtml(lineInfo)}</h3>
      <p class="msg"></p>
      <pre class="raw"></pre>
    `;
    card.querySelector('.msg').textContent = state.error.message;
    const pre = card.querySelector('.raw');
    if (state.error.lineNumber) {
      const lines = state.rawText.split('\n');
      const errLine = state.error.lineNumber - 1;
      lines.forEach((ln, i) => {
        const lineEl = document.createElement('span');
        if (i === errLine) lineEl.className = 'error-line';
        lineEl.textContent = `${String(i + 1).padStart(4)}  ${ln}\n`;
        pre.appendChild(lineEl);
      });
    } else {
      pre.textContent = state.rawText;
    }
    return card;
  }

  function toggleRaw() {
    const main = state.shadowRoot.querySelector('main.content');
    if (!main) return;
    const rawBtn = state.shadowRoot.querySelector('[data-act="raw"]');
    if (main.dataset.raw === '1') {
      main.dataset.raw = '';
      if (rawBtn) {
        rawBtn.textContent = 'Raw';
        rawBtn.setAttribute('aria-pressed', 'false');
        rawBtn.title = 'Switch to raw text view (selects all for quick copy)';
      }
      main.innerHTML = '';
      if (state.error) main.appendChild(buildErrorCard());
      else {
        const tree = document.createElement('div');
        tree.className = 'tree' + (state.settings.showPathChip === false ? ' no-path-chip' : '');
        tree.setAttribute('role', 'tree');
        tree.appendChild(window.renderTree(state.parsed, {
          expandDepth: state.settings.defaultExpandDepth,
          type: state.type,
          onCopy: (msg) => { showToast(msg); if (/^Copied/.test(msg)) maybeShowRating(); },
          onContext: (e, path, value) => showContextMenu(e, path, value)
        }));
        main.appendChild(tree);
      }
    } else {
      main.dataset.raw = '1';
      if (rawBtn) {
        rawBtn.textContent = 'Tree';
        rawBtn.setAttribute('aria-pressed', 'true');
        rawBtn.title = 'Switch back to tree view';
      }
      main.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'raw-pre';
      pre.textContent = state.rawText;
      pre.tabIndex = 0;
      main.appendChild(pre);
      // Auto-select so the user can immediately ⌘/Ctrl+C the whole document.
      requestAnimationFrame(() => {
        try {
          const sel = state.shadowRoot.getSelection?.() || window.getSelection();
          if (!sel) return;
          const range = document.createRange();
          range.selectNodeContents(pre);
          sel.removeAllRanges();
          sel.addRange(range);
          pre.focus({ preventScroll: true });
        } catch (_e) { /* selection inside closed shadow can fail in some browsers */ }
      });
    }
  }

  function toggleFormatting() {
    disableThisTab(!state.disabledThisTab);
  }

  function focusSearch() {
    state.shadowRoot?.querySelector('.search-input')?.focus();
  }

  // ---- Toast / context menu ----

  function showToast(msg) {
    if (!state.shadowRoot) return;
    state.shadowRoot.querySelector('.toast')?.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.textContent = msg;
    state.shadowRoot.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  let openMenu = null;
  function showContextMenu(e, path, value) {
    if (openMenu) openMenu.remove();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.setAttribute('role', 'menu');
    menu.style.left = Math.min(e.clientX, window.innerWidth - 240) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 140) + 'px';

    const pathDiv = document.createElement('div');
    pathDiv.className = 'context-path';
    pathDiv.textContent = path;
    menu.appendChild(pathDiv);

    const btns = [
      ['copy-path', 'Copy path'],
      ['copy-value', 'Copy value'],
      ['copy-json', 'Copy as JSON']
    ];
    for (const [act, label] of btns) {
      const b = document.createElement('button');
      b.dataset.act = act;
      b.textContent = label;
      b.setAttribute('role', 'menuitem');
      menu.appendChild(b);
    }
    state.shadowRoot.appendChild(menu);
    openMenu = menu;

    menu.addEventListener('click', async (ev) => {
      const act = ev.target.closest('button')?.dataset.act;
      if (!act) return;
      try {
        if (act === 'copy-path') {
          await navigator.clipboard.writeText(path);
          showToast(`Copied path ${path}`);
        } else if (act === 'copy-value') {
          const v = typeof value === 'string' ? value : JSON.stringify(value);
          await navigator.clipboard.writeText(v);
          showToast('Copied value');
        } else if (act === 'copy-json') {
          await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
          showToast('Copied JSON');
        }
        maybeShowRating();
      } catch (_e) { showToast('Copy failed'); }
      menu.remove();
      openMenu = null;
    });

    setTimeout(() => {
      const closer = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          openMenu = null;
          state.shadowRoot.removeEventListener('click', closer);
          document.removeEventListener('click', closer);
        }
      };
      state.shadowRoot.addEventListener('click', closer);
      document.addEventListener('click', closer);
    }, 0);
  }

  // ---- Helpers / parsers ----

  function parseXML(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const errEl = doc.querySelector('parsererror');
    if (errEl) throw new Error(errEl.textContent.split('\n')[0]);
    return xmlNodeToObject(doc.documentElement);
  }
  function xmlNodeToObject(node) {
    const obj = {};
    if (node.attributes && node.attributes.length) {
      const attrs = {};
      for (const a of node.attributes) attrs[a.name] = a.value;
      obj['@attributes'] = attrs;
    }
    const children = Array.from(node.childNodes).filter(n => n.nodeType === 1);
    if (!children.length) {
      const text = node.textContent.trim();
      if (Object.keys(obj).length === 0) return text;
      if (text) obj['#text'] = text;
      return obj;
    }
    for (const child of children) {
      const value = xmlNodeToObject(child);
      const tag = child.nodeName;
      if (obj[tag] === undefined) obj[tag] = value;
      else {
        if (!Array.isArray(obj[tag])) obj[tag] = [obj[tag]];
        obj[tag].push(value);
      }
    }
    return obj;
  }
  function extractLineNumber(msg, text) {
    if (!msg) return null;
    const lineMatch = /line (\d+)/i.exec(msg);
    if (lineMatch) return parseInt(lineMatch[1], 10);
    const posMatch = /position (\d+)/i.exec(msg);
    if (posMatch && text) {
      const pos = parseInt(posMatch[1], 10);
      return text.slice(0, pos).split('\n').length;
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- Top-level actions ----

  async function copyFormattedTopLevel() {
    try {
      const formatted = state.type === 'xml'
        ? state.rawText
        : JSON.stringify(state.parsed, null, 2);
      await navigator.clipboard.writeText(formatted);
      showToast(`Copied formatted ${state.type.toUpperCase()}`);
      maybeShowRating();
    } catch (_e) { showToast('Copy failed'); }
  }
  function downloadTopLevel() {
    const content = state.type === 'xml' ? state.rawText : JSON.stringify(state.parsed, null, 2);
    const mime = { json: 'application/json', yaml: 'application/yaml', xml: 'application/xml' }[state.type] || 'text/plain';
    download(content, `data.${state.type}`, mime);
  }

  function exportCSV(obj) {
    if (!Array.isArray(obj) || !obj.length || typeof obj[0] !== 'object' || obj[0] === null) {
      showToast('CSV export needs array of objects');
      return;
    }
    const keys = Array.from(new Set(obj.flatMap(o => Object.keys(o || {}))));
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [keys.join(',')].concat(obj.map(o => keys.map(k => esc(o?.[k])).join(',')));
    download(rows.join('\n'), 'data.csv', 'text/csv');
  }

  function exportTypeScript(obj) {
    function infer(v) {
      if (v === null) return 'null';
      if (Array.isArray(v)) {
        const items = v.length ? Array.from(new Set(v.map(infer))) : ['unknown'];
        return items.length === 1 ? `${items[0]}[]` : `(${items.join(' | ')})[]`;
      }
      const t = typeof v;
      if (t === 'object') {
        const fields = Object.entries(v).map(([k, val]) =>
          `  ${/^[A-Za-z_][\w]*$/.test(k) ? k : JSON.stringify(k)}: ${infer(val)};`
        );
        return fields.length ? `{\n${fields.join('\n')}\n}` : 'Record<string, never>';
      }
      return t;
    }
    download(`export type Root = ${infer(obj)};\n`, 'types.ts', 'text/typescript');
  }

  function exportSchema(obj) {
    function schema(v) {
      if (v === null) return { type: 'null' };
      if (Array.isArray(v)) return { type: 'array', items: v.length ? schema(v[0]) : {} };
      const t = typeof v;
      if (t === 'object') {
        const props = {}; const required = [];
        for (const [k, val] of Object.entries(v)) { props[k] = schema(val); required.push(k); }
        return { type: 'object', properties: props, required };
      }
      return { type: t };
    }
    const s = { '$schema': 'https://json-schema.org/draft-07/schema#', ...schema(obj) };
    download(JSON.stringify(s, null, 2), 'schema.json', 'application/json');
  }

  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // ---- Badge signaling to SW ----

  function sendBadge(stateName) {
    try {
      chrome.runtime.sendMessage({ type: 'treejson:badge', state: stateName });
    } catch (_e) { /* SW asleep, will wake; safe to ignore */ }
  }
})();

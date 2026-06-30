(() => {
  function buildRow(label, labelClass, child, path, value, opts) {
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('role', 'treeitem');
    row.dataset.path = path;

    const labelEl = document.createElement('span');
    labelEl.className = labelClass;
    labelEl.textContent = label;
    labelEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      opts.onContext?.(e, path, value);
    });
    row.appendChild(labelEl);
    row.appendChild(child);

    const chip = document.createElement('button');
    chip.className = 'path-chip';
    chip.type = 'button';
    chip.textContent = path;
    chip.title = 'Copy path';
    chip.setAttribute('aria-label', `Copy path ${path}`);
    chip.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(path);
        opts.onCopy?.('Copied path');
      } catch (_e) { opts.onCopy?.('Copy failed'); }
    });
    row.appendChild(chip);

    return row;
  }

  function buildPrimitive(value, opts) {
    const span = document.createElement('span');

    if (value === null) {
      span.className = 'null';
      span.textContent = 'null';
    } else if (value === undefined) {
      span.className = 'null';
      span.textContent = 'undefined';
    } else if (typeof value === 'string') {
      const isUrl = /^https?:\/\//i.test(value);
      if (isUrl) {
        const a = document.createElement('a');
        a.href = value;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'string link';
        a.textContent = `"${value}"`;
        return a;
      }
      span.className = 'string';
      span.textContent = `"${value}"`;
    } else if (typeof value === 'number') {
      span.className = 'number';
      span.textContent = String(value);
    } else if (typeof value === 'boolean') {
      span.className = 'boolean';
      span.textContent = String(value);
    } else {
      span.textContent = String(value);
    }

    // Click-to-copy on primitives (skip null/undefined to avoid copying literal "null")
    if (value !== null && value !== undefined) {
      span.addEventListener('click', async (e) => {
        if (e.target.closest('a')) return;
        e.stopPropagation();
        try {
          const v = typeof value === 'string' ? value : String(value);
          await navigator.clipboard.writeText(v);
          opts.onCopy?.(`Copied ${truncate(v, 40)}`);
        } catch (_e) { opts.onCopy?.('Copy failed'); }
      });
      span.title = 'Click to copy';
    }

    return span;
  }

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  // Compact icon used on object/array summaries — appears on row hover and
  // copies the whole subtree as pretty-printed JSON. Saves a right-click → menu
  // round-trip when users just want the payload from a node.
  const COPY_ICON_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  function buildNodeCopyButton(value, opts, count, kind) {
    const btn = document.createElement('button');
    btn.className = 'node-copy';
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.innerHTML = COPY_ICON_SVG;
    const noun = kind === 'array' ? 'item' : 'key';
    btn.title = `Copy ${count} ${noun}${count === 1 ? '' : 's'} as JSON`;
    btn.setAttribute('aria-label', btn.title);
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
        opts.onCopy?.(`Copied ${count} ${noun}${count === 1 ? '' : 's'}`);
      } catch (_e) { opts.onCopy?.('Copy failed'); }
    });
    // The <summary> toggles details on any pointer event that defaults to
    // toggling; swallow those so the button doesn't fold the node.
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
    });
    return btn;
  }

  window.renderTree = function renderTree(value, opts = {}, path = '$', depth = 0) {
    const { expandDepth = 2 } = opts;

    if (value === null || typeof value !== 'object') {
      // Top-level primitive
      return buildPrimitive(value, opts);
    }

    if (Array.isArray(value)) {
      const details = document.createElement('details');
      details.className = 'array';
      if (depth < expandDepth) details.open = true;

      const summary = document.createElement('summary');
      summary.innerHTML = `<span class="bracket">[</span><span class="count">${value.length} item${value.length === 1 ? '' : 's'}</span><span class="bracket">]</span>`;
      summary.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        opts.onContext?.(e, path, value);
      });
      summary.appendChild(buildNodeCopyButton(value, opts, value.length, 'array'));
      details.appendChild(summary);

      const body = document.createElement('div');
      body.className = 'array-body';
      value.forEach((item, i) => {
        const childPath = `${path}[${i}]`;
        const child = (item !== null && typeof item === 'object')
          ? renderTree(item, opts, childPath, depth + 1)
          : buildPrimitive(item, opts);
        body.appendChild(buildRow(`${i}:`, 'index', child, childPath, item, opts));
      });
      details.appendChild(body);
      return details;
    }

    // Object
    const details = document.createElement('details');
    details.className = 'object';
    if (depth < expandDepth) details.open = true;

    const keys = Object.keys(value);
    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="bracket">{</span><span class="count">${keys.length} key${keys.length === 1 ? '' : 's'}</span><span class="bracket">}</span>`;
    summary.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      opts.onContext?.(e, path, value);
    });
    summary.appendChild(buildNodeCopyButton(value, opts, keys.length, 'object'));
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'object-body';
    for (const k of keys) {
      const safeKey = /^[A-Za-z_$][\w$]*$/.test(k) ? `${path}.${k}` : `${path}[${JSON.stringify(k)}]`;
      const v = value[k];
      const child = (v !== null && typeof v === 'object')
        ? renderTree(v, opts, safeKey, depth + 1)
        : buildPrimitive(v, opts);
      body.appendChild(buildRow(`"${k}":`, 'key', child, safeKey, v, opts));
    }
    details.appendChild(body);
    return details;
  };
})();

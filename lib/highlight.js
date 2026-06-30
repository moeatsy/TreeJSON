// TreeJSON syntax highlighter helper.
// Tree-view rendering uses CSS classes via lib/renderer.js, so this file
// exposes a tiny helper for highlighting raw text fallback views.
(() => {
  function highlightJSON(text) {
    return String(text)
      .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
      .replace(
        /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
        (_m, key, str, kw, num) => {
          if (key) return `<span class="treejson-key">${key}</span>`;
          if (str) return `<span class="treejson-string">${str}</span>`;
          if (kw === 'null') return `<span class="treejson-null">${kw}</span>`;
          if (kw) return `<span class="treejson-boolean">${kw}</span>`;
          if (num) return `<span class="treejson-number">${num}</span>`;
          return _m;
        }
      );
  }

  window.TreeJSONHighlight = { highlightJSON };
})();

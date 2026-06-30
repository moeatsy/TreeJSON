(() => {
  // Walks rows, wraps the matched substring with <mark>, dims non-matches,
  // auto-expands ancestor <details>. Returns { total }.
  window.searchTree = function searchTree(root, query) {
    if (!root) return { total: 0 };
    const q = (query || '').trim().toLowerCase();
    const rows = root.querySelectorAll('.row');

    // Reset previous run
    rows.forEach(row => {
      row.classList.remove('match', 'dimmed');
      const marks = row.querySelectorAll('mark');
      marks.forEach(m => {
        const text = m.firstChild ? m.firstChild.nodeValue : m.textContent;
        const parent = m.parentNode;
        parent.replaceChild(document.createTextNode(text), m);
        parent.normalize();
      });
    });

    if (!q) return { total: 0 };

    let total = 0;
    rows.forEach(row => {
      const text = (row.textContent || '').toLowerCase();
      if (text.includes(q)) {
        row.classList.add('match');
        // Highlight only inside the leaf <span> children where the match exists.
        const candidates = row.querySelectorAll('.key, .index, .string, .number, .boolean, .null');
        candidates.forEach(node => {
          highlightSubstring(node, q);
        });
        // Expand all ancestor <details>
        let parent = row.parentNode;
        while (parent && parent !== root) {
          if (parent.tagName === 'DETAILS') parent.open = true;
          parent = parent.parentNode || parent.host;
        }
        total++;
      } else {
        row.classList.add('dimmed');
      }
    });

    return { total };
  };

  function highlightSubstring(node, q) {
    const text = node.firstChild && node.firstChild.nodeType === 3 ? node.firstChild.nodeValue : node.textContent;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return;
    // Single-occurrence highlight (good enough for v1)
    while (node.firstChild) node.removeChild(node.firstChild);
    node.appendChild(document.createTextNode(text.slice(0, idx)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(idx, idx + q.length);
    node.appendChild(mark);
    node.appendChild(document.createTextNode(text.slice(idx + q.length)));
  }
})();

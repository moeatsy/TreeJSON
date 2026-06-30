// CSS injected into the Shadow DOM that holds the TreeJSON content-script UI.
// Tokens are inlined here so we can mount synchronously at document_start
// without waiting on fetch. Keep in sync with tokens.css.
window.TreeJSONShadowStyles = `
:host {
  all: initial;
  display: block;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  color: #18181B;
  --tj-bg: #FAFAFA;
  --tj-bg-elevated: #FFFFFF;
  --tj-bg-subtle: #F4F4F5;
  --tj-bg-strong: #E4E4E7;
  --tj-fg: #18181B;
  --tj-fg-muted: #52525B;
  --tj-fg-subtle: #A1A1AA;
  --tj-border: #E4E4E7;
  --tj-border-strong: #D4D4D8;
  --tj-accent: #5B5BD6;
  --tj-accent-hover: #4F46E5;
  --tj-accent-subtle: #EEF2FF;
  --tj-accent-emphasis: #7C3AED;
  --tj-success: #059669;
  --tj-warning: #D97706;
  --tj-danger: #DC2626;
  --tj-danger-bg: #FEE2E2;
  --tj-syn-key: #B91C5C;
  --tj-syn-string: #047857;
  --tj-syn-number: #B45309;
  --tj-syn-boolean: #6D28D9;
  --tj-syn-null: #71717A;
  --tj-syn-bracket: #71717A;
  --tj-syn-link: #2563EB;
  --tj-match-bg: #FEF08A;
  --tj-match-fg: #18181B;
  --tj-overlay: rgba(24, 24, 27, 0.04);
  --tj-overlay-strong: rgba(24, 24, 27, 0.08);
  --tj-shadow-sm: 0 1px 2px rgb(0 0 0 / 0.06);
  --tj-shadow-md: 0 4px 12px rgb(0 0 0 / 0.10);
}
:host([data-theme="dark"]) {
  color: #F4F4F5;
  --tj-bg: #0B0C0F;
  --tj-bg-elevated: #131418;
  --tj-bg-subtle: #1A1B1F;
  --tj-bg-strong: #26272D;
  --tj-fg: #F4F4F5;
  --tj-fg-muted: #A1A1AA;
  --tj-fg-subtle: #71717A;
  --tj-border: #27272A;
  --tj-border-strong: #3F3F46;
  --tj-accent: #7C7CF5;
  --tj-accent-hover: #9090F8;
  --tj-accent-subtle: rgba(124,124,245,0.12);
  --tj-accent-emphasis: #A78BFA;
  --tj-success: #10B981;
  --tj-warning: #F59E0B;
  --tj-danger: #F87171;
  --tj-danger-bg: rgba(248,113,113,0.12);
  --tj-syn-key: #F472B6;
  --tj-syn-string: #34D399;
  --tj-syn-number: #FBBF24;
  --tj-syn-boolean: #C084FC;
  --tj-syn-null: #71717A;
  --tj-syn-bracket: #71717A;
  --tj-syn-link: #93C5FD;
  --tj-match-bg: rgba(251,191,36,0.30);
  --tj-match-fg: #FEF3C7;
  --tj-overlay: rgba(244, 244, 245, 0.04);
  --tj-overlay-strong: rgba(244, 244, 245, 0.08);
}

* { box-sizing: border-box; }

.root {
  background: var(--tj-bg);
  color: var(--tj-fg);
  min-height: 100vh;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
}

/* Toolbar */
.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 44px;
  background: var(--tj-bg-subtle);
  border-bottom: 1px solid var(--tj-border);
  flex-wrap: wrap;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.brand-glyph {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: var(--tj-accent);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.brand-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--tj-fg);
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--tj-border-strong);
  flex-shrink: 0;
}

.meta {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--tj-fg-muted);
  flex-shrink: 0;
  white-space: nowrap;
}
.meta.is-error {
  color: var(--tj-danger);
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 180px;
  max-width: 480px;
}
.search-input {
  width: 100%;
  height: 28px;
  padding: 0 64px 0 28px;
  background: var(--tj-bg-elevated);
  border: 1px solid var(--tj-border-strong);
  border-radius: 6px;
  color: var(--tj-fg);
  font: inherit;
  font-size: 12px;
}
.search-input:focus {
  outline: none;
  border-color: var(--tj-accent);
  box-shadow: 0 0 0 2px var(--tj-accent-subtle);
}
.search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--tj-fg-subtle);
  font-size: 14px;
  pointer-events: none;
}
.search-count {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: var(--tj-fg-subtle);
  pointer-events: none;
}

.actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 28px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--tj-fg);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background var(--tj-dur-fast, 80ms), border-color var(--tj-dur-fast, 80ms);
}
.btn:hover { background: var(--tj-overlay); }
.btn:focus-visible {
  outline: 2px solid var(--tj-accent);
  outline-offset: 2px;
}
.btn.primary {
  background: var(--tj-accent);
  border-color: var(--tj-accent);
  color: #fff;
}
.btn.primary:hover { background: var(--tj-accent-hover); }
.btn[aria-pressed="true"] {
  background: var(--tj-accent-subtle);
  border-color: var(--tj-border-strong);
  color: var(--tj-accent-emphasis);
}
.btn.icon-only {
  width: 28px;
  padding: 0;
  justify-content: center;
}
.btn.icon-only svg {
  display: block;
  flex-shrink: 0;
}

/* Overflow menu */
.overflow {
  position: relative;
}
.overflow-list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--tj-bg-elevated);
  border: 1px solid var(--tj-border);
  border-radius: 8px;
  box-shadow: var(--tj-shadow-md);
  min-width: 200px;
  padding: 4px 0;
  z-index: 20;
}
.overflow-list[hidden] { display: none; }
.overflow-list button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  background: transparent;
  border: 0;
  color: var(--tj-fg);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.overflow-list button:hover { background: var(--tj-bg-subtle); }

/* Tree */
.content {
  padding: 16px 24px;
}
.tree {
  white-space: pre-wrap;
  word-break: break-word;
}
.tree details {
  padding-left: 16px;
  border-left: 1px solid transparent;
  margin-left: -1px;
}
.tree details:hover { border-left-color: var(--tj-border); }
.tree summary {
  cursor: pointer;
  list-style: none;
  display: inline;
}
.tree summary::-webkit-details-marker { display: none; }
.tree summary::before {
  content: "▾";
  display: inline-block;
  width: 14px;
  margin-left: -16px;
  margin-right: 2px;
  color: var(--tj-syn-bracket);
  font-size: 10px;
  transform: rotate(-90deg);
  transition: transform var(--tj-dur-fast, 80ms);
  vertical-align: 1px;
}
.tree details[open] > summary::before { transform: rotate(0); }

.row {
  display: flex;
  gap: 8px;
  padding: 1px 0;
  align-items: baseline;
  position: relative;
  outline: none;
}
.row:focus-visible {
  background: var(--tj-accent-subtle);
  border-radius: 3px;
  outline: 2px solid var(--tj-accent);
  outline-offset: 1px;
}
.row:hover .path-chip { opacity: 1; }
.tree.no-path-chip .path-chip { display: none; }
.row.match mark {
  background: var(--tj-match-bg);
  color: var(--tj-match-fg);
  padding: 0 2px;
  border-radius: 2px;
}
.row.dimmed { opacity: 0.35; }

.key, .index {
  flex-shrink: 0;
  cursor: context-menu;
}
.key { color: var(--tj-syn-key); }
.index { color: var(--tj-syn-bracket); }

.bracket { color: var(--tj-syn-bracket); }
.count { font-size: 11px; color: var(--tj-fg-subtle); margin: 0 6px; }

.string, .number, .boolean {
  cursor: pointer;
  position: relative;
  border-radius: 2px;
  transition: background var(--tj-dur-fast, 80ms);
}
.null { color: var(--tj-syn-null); font-style: italic; }
.string { color: var(--tj-syn-string); }
.number { color: var(--tj-syn-number); }
.boolean { color: var(--tj-syn-boolean); }
.string:hover, .number:hover, .boolean:hover {
  background: var(--tj-accent-subtle);
}
.string:hover::after, .number:hover::after, .boolean:hover::after {
  content: "⧉";
  display: inline-block;
  margin-left: 6px;
  font-size: 11px;
  color: var(--tj-fg-subtle);
  vertical-align: 1px;
  pointer-events: none;
}
.link { color: var(--tj-syn-link); text-decoration: underline; cursor: pointer; }
.link:hover { background: transparent; }
.link:hover::after { content: none; }

.path-chip {
  margin-left: 8px;
  padding: 0 4px;
  font-size: 10px;
  color: var(--tj-fg-subtle);
  background: var(--tj-bg-subtle);
  border-radius: 2px;
  opacity: 0;
  transition: opacity var(--tj-dur-fast, 80ms);
  cursor: pointer;
  user-select: none;
}
.path-chip:hover { color: var(--tj-fg); background: var(--tj-bg-strong); }
.path-chip:focus-visible {
  outline: 2px solid var(--tj-accent);
  outline-offset: 1px;
  opacity: 1;
}

/* Per-node copy button on object/array summaries.
   Fades in on hover or focus, same way path-chip does. */
.node-copy {
  margin-left: 6px;
  padding: 0 4px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--tj-bg-subtle);
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--tj-fg-subtle);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--tj-dur-fast, 80ms), background var(--tj-dur-fast, 80ms), color var(--tj-dur-fast, 80ms);
  vertical-align: 1px;
  user-select: none;
}
.node-copy svg { display: block; }
.row:hover .node-copy,
.tree > details > summary:hover .node-copy,
.tree > details:focus-within > summary .node-copy,
.node-copy:focus-visible {
  opacity: 1;
}
.node-copy:hover {
  color: var(--tj-fg);
  background: var(--tj-bg-strong);
}
.node-copy:focus-visible {
  outline: 2px solid var(--tj-accent);
  outline-offset: 1px;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 8px 14px;
  background: var(--tj-bg-elevated);
  color: var(--tj-fg);
  border: 1px solid var(--tj-border);
  border-radius: 8px;
  box-shadow: var(--tj-shadow-md);
  font-size: 12px;
  z-index: 200;
  animation: jfFade 160ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes jfFade {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Error card */
.error-card {
  padding: 20px;
  background: var(--tj-bg-elevated);
  border-left: 4px solid var(--tj-danger);
  border-radius: 8px;
  margin-bottom: 16px;
  font-family: system-ui, -apple-system, sans-serif;
}
.error-card h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--tj-danger);
}
.error-card p {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--tj-fg-muted);
}
.error-card .raw {
  margin: 0;
  padding: 12px;
  background: var(--tj-bg-subtle);
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--tj-fg);
  max-height: 50vh;
  overflow: auto;
  white-space: pre;
}
.error-line {
  background: var(--tj-danger-bg);
  display: inline-block;
  width: 100%;
}

/* Context menu */
.context-menu {
  position: fixed;
  background: var(--tj-bg-elevated);
  border: 1px solid var(--tj-border);
  border-radius: 8px;
  padding: 4px 0;
  z-index: 100;
  min-width: 220px;
  box-shadow: var(--tj-shadow-md);
  font-family: system-ui, -apple-system, sans-serif;
}
.context-path {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--tj-fg-subtle);
  border-bottom: 1px solid var(--tj-border);
  font-family: ui-monospace, monospace;
  word-break: break-all;
  user-select: text;
}
.context-menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  background: transparent;
  border: 0;
  color: var(--tj-fg);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.context-menu button:hover { background: var(--tj-accent); color: #fff; }
.context-menu button:focus-visible {
  outline: 2px solid var(--tj-accent);
  outline-offset: -2px;
}

/* Raw view */
.raw-pre {
  margin: 0;
  padding: 16px;
  background: var(--tj-bg);
  color: var(--tj-fg);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  user-select: text;
  outline: none;
}
.raw-pre:focus-visible {
  box-shadow: inset 0 0 0 2px var(--tj-accent-subtle);
}

/* Progress bar for large parses */
.progress {
  position: fixed;
  top: 44px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--tj-bg-strong);
  z-index: 9;
}
.progress > div {
  height: 100%;
  background: var(--tj-accent);
  transition: width 80ms linear;
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;

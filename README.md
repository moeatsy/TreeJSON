# JSONFlow

Privacy-first JSON formatter for Chrome. Auto-detects JSON, YAML, and XML
responses and renders them as a clean, searchable, collapsible tree view.

- **MV3 native** — built for the modern Chrome extension platform
- **Minimal permissions** — `storage` + `activeTab` + `<all_urls>` (host-only, used solely for content-type detection)
- **Zero telemetry** — no analytics, no third-party scripts, no network requests
- **Open source**

## Features

- Auto-format `application/json` (and `+json` variants), `.json` / `.jsonl` / `.ndjson` URLs
- YAML support: `application/yaml`, `.yaml`, `.yml`
- XML support: `application/xml`, `.xml`
- Full-text search across keys and values with auto-expand
- Right-click any node to copy path, value, or JSON
- Export to CSV, TypeScript types, or JSON Schema (JSON only)
- Light / dark / auto themes
- Toggle raw view with one click
- Keyboard shortcut to disable formatting on the current page (`Alt+Shift+J`)
- Inline error display with line number for invalid documents

## Install (developer mode)

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this directory.

## Project layout

```
.
├── manifest.json
├── background.js        # Service worker — install hook, badge pipeline, command routing
├── content.js           # JSON/YAML/XML detection + Shadow-DOM tree render
├── tokens.css           # Design tokens (used by popup, options, welcome, docs)
├── popup.html/.css/.js  # Action popup (per-tab status + toggles + quick actions)
├── options.html/.css/.js# Settings: sidebar IA, autosave, exclude patterns
├── welcome.html/.css    # Post-install onboarding with permissions explainer
├── privacy.html         # In-extension privacy policy (no external page)
├── changelog.html       # In-extension release notes
├── lib/
│   ├── renderer.js      # Tree DOM renderer + JSONPath chip + click-to-copy
│   ├── search.js        # Substring highlighting + dim non-matches
│   ├── yaml.js          # Minimal YAML parser
│   ├── highlight.js     # Raw-view syntax highlighting helper
│   └── shadow-styles.js # CSS string injected into the content-script shadow root
├── _locales/en/messages.json
└── icons/icon{16,32,48,128}.png
```

## Privacy

JSONFlow has no servers, no analytics, no third-party scripts. The `<all_urls>`
host permission is required because JSON APIs can live on any domain — the
content script checks the document content-type or file extension and exits
immediately if it isn't JSON / YAML / XML. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

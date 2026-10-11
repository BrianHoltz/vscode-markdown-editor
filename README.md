# Markdown Editor — A full-featured WYSIWYG editor for markdown

[![badge_title](https://vsmarketplacebadges.dev/version-short/zaaack.markdown-editor.png)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor) [![](https://vsmarketplacebadges.dev/installs-short/zaaack.markdown-editor.png)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor) [![](https://vsmarketplacebadges.dev/rating-short/zaaack.markdown-editor.png)](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor)

## Demo

![demo](./demo.gif)

## Features

1. What You See Is What You Get (WYSIWYG)
2. Auto sync changes between the VSCode editor and webview
3. Copy markdown/html
4. Uploaded/pasted/drag-dropped images will be auto-saved to the `assets` folder
5. Multi-theme support
6. Shortcut keys
7. Multiple editti[](https://)ng modes: instant Rendering mode (**Recommand!**) / WYSIWYG mode / split screen mode
8. Markdown extensions
9. Multiple graph support including KaTeX / Mermaid / Graphviz / ECharts / abc.js(notatioan) / ...
10. For more usage please see [vditor](https://github.com/Vanessa219/vditor)

## Install

[https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor](https://marketplace.visualstudio.com/items?itemName=zaaack.markdown-editor)

## Local Markdown UX build

The [BrianHoltz fork](https://github.com/BrianHoltz/vscode-markdown-editor), branch `brian/markdown-ux`, builds version `0.1.22-local.3` under the existing extension ID, `zaaack.markdown-editor`.

- Vditor translations for supported editor locales are bundled with the extension; toolbar tooltips and submenu labels do not depend on CDN localization scripts.
- **Markdown Outline** appears in the Explorer sidebar for both command-mode and "Open With" editors. It uses Vditor's Markdown parser, follows the heading hierarchy, updates after edits, and remains usable when focus moves to the sidebar. Clicking a heading scrolls the originating editor, including duplicate headings and headings containing inline formatting.
- Plain clicks follow links; Option/Alt-click positions the caret for editing. Set `markdown-editor.followLinksOnClick` to `false` to require Cmd/Ctrl-click. Internal anchors scroll in place; relative Markdown links with fragments open the target in Markdown Editor and scroll after rendering.
- The toolbar and Cmd/Ctrl+F share one search bar. Search works in instant-rendering, WYSIWYG, and source modes, including matches across inline formatting. Browser highlights do not modify Markdown or the editable DOM.
- Command-mode editors retain separate panels for separate documents. Theme and link-color overrides are included in source.
- The toolbar stays a compact single row. Less-used tools move into a keyboard-accessible `»` overflow tray as the pane narrows; essential controls remain visible longest. Submenus open below the tray without horizontal clipping. The adapter in `media-src/src/responsive-toolbar.ts` moves Vditor's existing elements rather than duplicating command implementations, using ResizeObserver for pane changes.
- The small upper-right toolbar button hides or restores the toolbar without reserving a row when hidden. H1-H6 and other margin annotations and the line-number gutter hide with it; rich-editor side padding shrinks to 12px. Cmd/Ctrl+F still works. Showing the toolbar restores the normal gutter and annotations.
- The toolbar's **Hide raw HTML markup** button suppresses HTML tag syntax and empty HTML-only rows in rich editing modes. Rendered HTML blocks, their visible text, and fenced HTML examples remain visible; source mode always shows the complete source. Named HTML anchors remain navigable even when their raw markup is hidden. To edit hidden tags, show raw HTML again or switch to source mode. These view-only toggles do not modify Markdown; preferences persist across editor reopening and are included in VS Code Settings Sync.

VS Code's built-in Outline has no public provider API for custom webview editors. Markdown Outline is a separate supported TreeView in Explorer, not a replacement for the built-in view.

### Build and install

For another Mac, download the VSIX from [GitHub Releases](https://github.com/BrianHoltz/vscode-markdown-editor/releases), then use **Extensions: Install from VSIX** or `code --install-extension <downloaded-file.vsix> --force`. No build tools are required for VSIX installation.

To work on the source:

```sh
git clone https://github.com/BrianHoltz/vscode-markdown-editor.git ~/src/vscode-markdown-editor
cd ~/src/vscode-markdown-editor
git switch brian/markdown-ux
npx --yes pnpm@10.32.1 install --frozen-lockfile
npx --yes pnpm@10.32.1 build
npx --yes pnpm@10.32.1 --filter media-src exec tsc --noEmit
npx --yes pnpm@10.32.1 exec playwright install chromium
npx --yes pnpm@10.32.1 test
npx --yes --package @vscode/vsce vsce package --no-dependencies --out markdown-editor-0.1.22-local.3.vsix
STAMP=$(date "+%Y%m%d.%a.%H%M")
OUT="$HOME/Downloads/markdown-editor-0.1.22-local.3-$STAMP-hideui.vsix"
cp -p markdown-editor-0.1.22-local.3.vsix "$OUT"
cmp markdown-editor-0.1.22-local.3.vsix "$OUT"
code --install-extension "$OUT" --force
```

Keep the canonical VSIX in the repository root, the normal `vsce package` output location. Copy each local build to `~/Downloads/` using `<product>-<version>-yyyymmdd.Dow.hhmm-<fix>.<ext>`; capture the timestamp immediately after successful packaging, and use a lowercase, hyphen-free fix label shorter than 10 characters. `hideui` identifies the newest included fix in this build.

Reload VS Code with **Developer: Reload Window** after installation. Use the extension gear menu to disable auto-update for Markdown Editor if this local build should remain installed; a Marketplace update can replace it. Do not apply the legacy `patch-zaaack.py` script to this source build.

### Porting upstream updates

Keep `origin` pointed at the BrianHoltz fork and add upstream with `git remote add upstream https://github.com/zaaack/vscode-markdown-editor.git`. Fetch upstream and merge `upstream/main` into `brian/markdown-ux`, then rerun build, webview type checks, and tests before packaging a new local version. The browser test exercises toolbar layout at 240, 320, 450, 700, and 1200 pixels, including line-number toggling, keyboard traversal, submenu bounds, and theme rebuilds.

## Supported syntax

[demo article](https://ld246.com/guide/markdown)

## Usage

### 1. Command mode in markdown file

- open a markdown file
- type `cmd-shift-p` to enter command mode
- type `markdown-editor: Open with markdown editor`

### 2. Key bindings

- open a markdown file
- type `ctrl+shift+alt+m` for win or `cmd+shift+alt+m` for mac

### 3. Explorer Context menu

- right click on markdown file
- then click `Open with markdown editor`

### 4. Editor title context menu

- right click on a opened markdown file's tab title
- then click `Open with markdown editor`

### 5. Open With... and Set Default Editor

- right click on a markdown file in Explorer
- click `Open With...`
- select `Markdown Editor` to open temporary
- or click `Configure default editor...` and select `Markdown Editor` to set it as default

### Custom CSS (custom layout and vditor personalization)

Edit your settings.json and add

```
"markdown-editor.customCss": "my custom css rules"

// Eg: "markdown-editor.customCss": ".vditor-ir pre.vditor-reset {line-height: 32px;padding-right: calc(100% - 800px) !important; margin-left: 100px;    font-family: system-ui !important;}"
```

## Acknowledgement

- [vscode](https://github.com/microsoft/vscode)
- [vditor](https://github.com/Vanessa219/vditor)


## Todo

- [ ] Using [Custom Text Editor](https://code.visualstudio.com/api/extension-guides/custom-editors#custom-text-editor) ([demo](https://github.com/gera2ld/markmap-vscode))

## License

MIT

## Support

If you like this extension make sure to star the repo. I am always looking for new ideas and feedback. In addition, it is possible to [donate via paypal](https://www.paypal.me/zaaack).

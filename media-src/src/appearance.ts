export interface Appearance {
  toolbarHidden: boolean
  rawHtmlHidden: boolean
}

const appearance: Appearance = { toolbarHidden: false, rawHtmlHidden: false }
let observer: MutationObserver | undefined

export function applyAppearance(value: Partial<Appearance> = {}) {
  Object.assign(appearance, value)
  document.body.classList.toggle('vmd-toolbar-hidden', appearance.toolbarHidden)
  document.body.classList.toggle('vmd-raw-html-hidden', appearance.toolbarHidden || appearance.rawHtmlHidden)
  const toolbarButton = document.getElementById('vmd-toolbar-visibility')
  if (toolbarButton) {
    toolbarButton.title = appearance.toolbarHidden ? 'Show toolbar' : 'Hide toolbar'
    toolbarButton.setAttribute('aria-label', toolbarButton.title)
    toolbarButton.setAttribute('aria-expanded', String(!appearance.toolbarHidden))
  }
  document.querySelectorAll('[data-type="raw-html"]').forEach(button => {
    button.setAttribute('aria-pressed', String(appearance.rawHtmlHidden))
    button.classList.toggle('vditor-icon--current', appearance.rawHtmlHidden)
    button.setAttribute('aria-label', appearance.rawHtmlHidden ? 'Show raw HTML markup' : 'Hide raw HTML markup')
  })
}

export function toggleAppearance(key: keyof Appearance) {
  applyAppearance({ [key]: !appearance[key] })
  vscode.postMessage({ command: 'save-appearance', appearance: { ...appearance } })
}

export function initHtmlVisibility() {
  observer?.disconnect()
  function markAnchorRows() {
    document.querySelectorAll('.vditor-ir .vditor-reset > p, .vditor-wysiwyg .vditor-reset > p')
      .forEach(paragraph => {
        const htmlOnly = Array.from(paragraph.childNodes).every(node => {
          if (node.nodeType === Node.TEXT_NODE) return !node.textContent.replace(/[\s\u200b]/g, '')
          return node instanceof Element && node.matches('[data-type="html-inline"]')
        }) && !!paragraph.querySelector('[data-type="html-inline"]')
        paragraph.classList.toggle('vmd-html-only', htmlOnly)
      })
  }
  observer = new MutationObserver(markAnchorRows)
  observer.observe(document.getElementById('app'), { childList: true, subtree: true, characterData: true })
  markAnchorRows()
  applyAppearance()
}

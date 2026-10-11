import { assignHeadingSlugs } from '../../src/headings'

export function headingText(heading: Element): string {
  const copy = heading.cloneNode(true) as Element
  copy.querySelectorAll('[class*="vditor-ir__marker"]').forEach(marker => marker.remove())
  return copy.textContent || ''
}

export function editorHeadings(): HTMLElement[] {
  const mode = vditor.getCurrentMode()
  const root = document.querySelector(mode === 'sv'
    ? '.vditor-preview .vditor-reset' : `.vditor-${mode} .vditor-reset`)
  return root ? Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')) : []
}

export function publishOutline() {
  const content = document.createElement('div')
  content.innerHTML = vditor.vditor.lute.Md2HTML(vditor.getValue())
  const headings = assignHeadingSlugs(Array.from(content.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map(heading => ({ label: heading.textContent || '', level: Number(heading.tagName.slice(1)) })))
  vscode.postMessage({ command: 'outline', headings })
}

export function scrollToHeading(fragment?: string, index?: number): boolean {
  const target = fragment === undefined ? '' : decodeURIComponent(fragment)
  if (vditor.getCurrentMode() === 'sv') {
    vditor.setPreviewMode('both')
    vditor.renderPreview()
  }
  const headings = editorHeadings()
  const slugs = assignHeadingSlugs(headings.map(heading => ({
    label: headingText(heading), level: Number(heading.tagName.slice(1)),
  })))
  let heading = index === undefined
    ? headings.find((element, i) => element.id === target || slugs[i].slug === target.toLowerCase())
    : headings[index]
  if (!heading && fragment !== undefined) {
    const mode = vditor.getCurrentMode()
    const root = document.querySelector(mode === 'sv'
      ? '.vditor-preview .vditor-reset' : `.vditor-${mode} .vditor-reset`)
    const anchor = root && Array.from(root.querySelectorAll<HTMLElement>('a[id], a[name]'))
      .find(element => element.id === target || element.getAttribute('name') === target)
    heading = anchor || undefined
    if (!heading && root) {
      // IR/WYSIWYG store inline anchors as escaped markup, not real <a> nodes.
      for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-type="html-inline"]'))) {
        const template = document.createElement('template')
        template.innerHTML = element.textContent.replace(/\u200b/g, '')
        if (Array.from(template.content.querySelectorAll('a[id], a[name]'))
          .some(anchor => anchor.id === target || anchor.getAttribute('name') === target)) {
          heading = element.closest('p') || element
          break
        }
      }
    }
    if (heading && !heading.getClientRects().length) {
      heading = heading.nextElementSibling instanceof HTMLElement ? heading.nextElementSibling : heading.parentElement
    }
  }
  if (heading) {
    heading.scrollIntoView({ block: 'start', behavior: 'smooth' })
    return true
  }
  vscode.postMessage({ command: 'error', content: `Heading not found: ${fragment === undefined ? index : fragment}` })
  return false
}

// Reuse Vditor's controls and handlers rather than maintaining a second command menu.
export function initResponsiveToolbar(): () => void {
  const toolbar = document.querySelector<HTMLElement>('.vditor-toolbar')
  if (!toolbar) throw new Error('Vditor toolbar was not mounted')
  toolbar.classList.add('vmd-toolbar')
  const controls = Array.from(toolbar.children).filter((child): child is HTMLElement =>
    child instanceof HTMLElement && !child.classList.contains('vditor-toolbar__br'))
  const overflow = document.createElement('div')
  overflow.className = 'vmd-toolbar-overflow'
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'vmd-toolbar-toggle'
  toggle.textContent = '»'
  toggle.title = 'More formatting tools'
  toggle.setAttribute('aria-label', toggle.title)
  toggle.setAttribute('aria-expanded', 'false')
  const tray = document.createElement('div')
  tray.className = 'vmd-toolbar-tray'
  tray.setAttribute('role', 'group')
  tray.setAttribute('aria-label', 'More formatting tools')
  tray.hidden = true
  overflow.append(toggle, tray)
  toolbar.appendChild(overflow)
  document.getElementById('vmd-toolbar-visibility')?.remove()
  const visibility = document.createElement('button')
  visibility.id = 'vmd-toolbar-visibility'
  visibility.type = 'button'
  visibility.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v4H4zm0 7h4v7H4zm6 0h4v7h-4zm6 0h4v7h-4z" fill="currentColor"/></svg>'
  visibility.setAttribute('aria-controls', 'vmd-main-toolbar')
  toolbar.id = 'vmd-main-toolbar'
  document.body.appendChild(visibility)
  visibility.addEventListener('pointerdown', event => event.preventDefault())
  visibility.addEventListener('click', () => {
    const hiding = !document.body.classList.contains('vmd-toolbar-hidden')
    close()
    toggleAppearance('toolbarHidden')
    if (hiding) vditor.focus()
    else layout()
  })
  applyAppearance()

  function close(returnFocus = false) {
    tray.hidden = true
    toggle.setAttribute('aria-expanded', 'false')
    if (returnFocus) toggle.focus()
  }
  function name(control: HTMLElement) {
    return control.querySelector('[data-type]')?.getAttribute('data-type') || control.id
  }
  const priority = ['save', 'find', 'more', 'edit-mode', 'headings', 'bold', 'link', 'italic']
  function layout() {
    if (document.body.classList.contains('vmd-toolbar-hidden')) return
    const focused = document.activeElement
    controls.forEach(control => toolbar.insertBefore(control, overflow))
    overflow.hidden = true
    const style = getComputedStyle(toolbar)
    const available = toolbar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const items = controls.filter(control => !control.classList.contains('vditor-toolbar__divider'))
    const widths = new Map(items.map(control => [control, control.getBoundingClientRect().width]))
    let width = items.reduce((total, control) => total + widths.get(control), 0)
    const hidden = new Set<HTMLElement>()
    if (width > available) {
      overflow.hidden = false
      width += overflow.getBoundingClientRect().width
      const candidates = [...items].sort((a, b) => {
        const rank = (control: HTMLElement) => {
          const index = priority.indexOf(name(control))
          return index < 0 ? priority.length : index
        }
        return rank(b) - rank(a) || items.indexOf(b) - items.indexOf(a)
      })
      for (const control of candidates) {
        if (width <= available) break
        hidden.add(control)
        width -= widths.get(control)
      }
      items.filter(control => hidden.has(control)).forEach(control => tray.appendChild(control))
    } else {
      close()
    }
    if (focused instanceof HTMLElement && toolbar.contains(focused)) {
      if (tray.hidden && tray.contains(focused)) toggle.focus()
      else focused.focus({ preventScroll: true })
    }
  }
  toggle.addEventListener('pointerdown', event => event.preventDefault())
  toggle.addEventListener('click', () => {
    tray.hidden = !tray.hidden
    toggle.setAttribute('aria-expanded', String(!tray.hidden))
  })
  function outside(event: Event) {
    if (event.target instanceof Node && !overflow.contains(event.target)) close()
  }
  function escape(event: KeyboardEvent) {
    if (event.key === 'Escape' && !tray.hidden) {
      event.preventDefault()
      event.stopImmediatePropagation()
      close(true)
    }
  }
  tray.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return
    const item = event.target.closest('.vditor-toolbar__item')
    if (item && !item.querySelector('.vditor-panel')) close()
  })
  document.addEventListener('pointerdown', outside, true)
  toolbar.addEventListener('keydown', escape, true)
  const resize = new ResizeObserver(layout)
  resize.observe(toolbar)
  // The optional line-number toggle is appended asynchronously by extension.ts.
  const mutation = new MutationObserver(() => {
    const added = Array.from(toolbar.children).filter((child): child is HTMLElement =>
      child instanceof HTMLElement && child !== overflow && !controls.includes(child)
      && !child.classList.contains('vditor-toolbar__br'))
    if (added.length) {
      controls.push(...added)
      layout()
    }
  })
  mutation.observe(toolbar, { childList: true })
  layout()
  return () => {
    resize.disconnect()
    mutation.disconnect()
    document.removeEventListener('pointerdown', outside, true)
    toolbar.removeEventListener('keydown', escape, true)
    visibility.remove()
  }
}
import { applyAppearance, toggleAppearance } from './appearance'

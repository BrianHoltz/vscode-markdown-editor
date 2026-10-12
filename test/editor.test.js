const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

test('Real Vditor toolbar, menus, outline, links, and non-mutating find', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const vditorRoot = path.resolve(__dirname, '../media-src/node_modules/vditor')
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.hostname === 'markdown-editor.test') {
        return route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><div id="app"></div></body></html>' })
      }
      const at = url.pathname.indexOf('/dist/')
      if (at >= 0) {
        const asset = path.join(vditorRoot, url.pathname.slice(at + 1))
        if (fs.existsSync(asset)) {
          return route.fulfill({ path: asset })
        }
      }
      return route.abort()
    })
    await page.goto('http://markdown-editor.test')
    await page.evaluate(() => {
      window.messages = []
      window.acquireVsCodeApi = () => ({ postMessage: message => window.messages.push(message) })
    })
    await page.addStyleTag({ path: path.resolve(__dirname, '../media/dist/main.css') })
    await page.addScriptTag({ path: path.resolve(__dirname, '../media/dist/main.js') })
    const markdown = '# Foo & Bar\n\nFind **across** formatting.\n\n[Jump](#foo--bar-1)\n\n[Other](other.md#target)\n\n[Web](https://example.com)\n\n## Foo & Bar\n\n### Café 中文\n\n## Heading with [link](https://example.com)\n\nSetext heading\n--------------\n\n```md\n# Not a heading\n```\n'
    async function init(mode = 'ir', theme = 'light', appearance = { toolbarHidden: false, rawHtmlHidden: false }, content = markdown, codeTheme) {
      await page.evaluate(({ content, mode, theme, appearance, codeTheme }) => {
        document.body.removeAttribute('data-vmd-ready')
        window.postMessage({ command: 'update', type: 'init', content,
          options: { mode, ...(codeTheme ? { preview: { hljs: { style: codeTheme } } } : {}) },
          theme, followLinksOnClick: true, appearance }, '*')
      }, { content, mode, theme, appearance, codeTheme })
      await page.waitForSelector('body[data-vmd-ready="1"]')
    }
    await init()
    assert.equal(await page.evaluate(() => window.VditorI18n.bold), 'Bold')
    const headings = await page.evaluate(() => window.messages.filter(message => message.command === 'outline').at(-1).headings)
    assert.deepEqual(headings.map(heading => heading.slug), ['foo--bar', 'foo--bar-1', 'café-中文', 'heading-with-link', 'setext-heading'])
    const brokenLabels = await page.locator('.vditor-toolbar [aria-label]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('aria-label')).filter(label => /undefined/.test(label)))
    assert.deepEqual(brokenLabels, [])
    await page.locator('.vditor-toolbar [data-type="more"]').click()
    await page.waitForTimeout(250)
    assert.equal(await page.locator('.vditor-toolbar').evaluate(element => element.textContent.includes('undefined')), false)
    await page.locator('.vditor-toolbar [data-type="markdown-outline"]').click()
    assert.equal(await page.evaluate(() => window.messages.some(message => message.command === 'show-outline')), true)

    await page.evaluate(() => {
      window.scrolled = []
      HTMLElement.prototype.scrollIntoView = function () { window.scrolled.push(this.textContent) }
    })
    await page.locator('.vditor-ir__link').filter({ hasText: /^Jump$/ }).click()
    assert.equal(await page.evaluate(() => window.scrolled.at(-1).includes('Foo & Bar')), true)
    await page.locator('.vditor-ir__link').filter({ hasText: /^Other$/ }).click()
    await page.locator('.vditor-ir__link').filter({ hasText: /^Web$/ }).click()
    assert.deepEqual(await page.evaluate(() => window.messages.filter(message => message.command === 'open-link').map(message => message.href)),
      ['other.md#target', 'https://example.com'])
    const beforeAltClick = await page.evaluate(() => window.messages.filter(message => message.command === 'open-link').length)
    await page.locator('.vditor-ir__link').filter({ hasText: /^Other$/ }).click({ modifiers: ['Alt'] })
    assert.equal(await page.evaluate(() => window.messages.filter(message => message.command === 'open-link').length), beforeAltClick)
    await page.evaluate(() => { window.followLinksOnClick = false })
    await page.locator('.vditor-ir__link').filter({ hasText: /^Other$/ }).click()
    assert.equal(await page.evaluate(() => window.messages.filter(message => message.command === 'open-link').length), beforeAltClick)
    await page.locator('.vditor-ir__link').filter({ hasText: /^Other$/ }).click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] })
    assert.equal(await page.evaluate(() => window.messages.filter(message => message.command === 'open-link').length), beforeAltClick + 1)
    await page.evaluate(() => window.postMessage({ command: 'scroll-to-heading', index: 2 }, '*'))
    await page.waitForTimeout(50)
    assert.match(await page.evaluate(() => window.scrolled.at(-1)), /Café 中文/)
    await page.evaluate(() => window.postMessage({ command: 'scroll-to-heading', fragment: 'missing-heading' }, '*'))
    await page.waitForTimeout(50)
    assert.equal(await page.evaluate(() => window.messages.some(message => message.command === 'error' && message.content.includes('missing-heading'))), true)

    for (const mode of ['ir', 'wysiwyg', 'sv']) {
      await init(mode)
      const before = await page.evaluate(() => vditor.getValue())
      await page.locator('.vditor-toolbar [data-type="find"]').click()
      await page.locator('#vmd-search-input').fill('formatting')
      assert.equal(await page.locator('#vmd-search-count').textContent(), '1/1', mode)
      await page.locator('#vmd-search-input').fill('FOO')
      const total = mode === 'sv' ? 3 : 2
      assert.equal(await page.locator('#vmd-search-count').textContent(), `1/${total}`, mode)
      await page.locator('#vmd-search-next').click()
      assert.equal(await page.locator('#vmd-search-count').textContent(), `2/${total}`, mode)
      await page.locator('#vmd-search-case').check()
      assert.equal(await page.locator('#vmd-search-count').textContent(), '0/0', mode)
      await page.locator('#vmd-search-case').uncheck()
      await page.locator('#vmd-search-close').click()
      assert.equal(await page.evaluate(() => vditor.getValue()), before, mode)
      await page.locator('#app').press('Control+f')
      await page.waitForSelector('#vmd-search-bar.vmd-search-bar--open')
      await page.locator('#vmd-search-input').fill('Find across formatting')
      if (mode !== 'sv') assert.equal(await page.locator('#vmd-search-count').textContent(), '1/1', mode)
      await page.locator('#vmd-search-input').press('Escape')
      assert.equal(await page.locator('#vmd-search-bar').getAttribute('aria-hidden'), 'true')
    }
    await init('ir', 'dark')
    assert.equal(await page.evaluate(() => vditor.vditor.options.preview.hljs.style), 'github-dark')
    const darkCodeStyles = await page.locator('.vditor-ir .vditor-reset pre > code').first().evaluate(element => {
      const style = getComputedStyle(element)
      return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage }
    })
    assert.equal(darkCodeStyles.backgroundColor, 'rgb(30, 30, 30)')
    assert.equal(darkCodeStyles.backgroundImage, 'none')
    await init('ir', 'light')
    assert.equal(await page.evaluate(() => vditor.vditor.options.preview.hljs.style), 'github')
    await init('ir', 'dark', undefined, markdown, 'atom-one-light')
    assert.equal(await page.evaluate(() => vditor.vditor.options.preview.hljs.style), 'atom-one-light')
    await page.locator('.vditor-toolbar [data-type="find"]').click()
    await page.locator('#vmd-search-input').fill('Café')
    assert.equal(await page.locator('#vmd-search-count').textContent(), '1/1')
    await page.locator('#vmd-search-close').click()

    const extensionSource = fs.readFileSync(path.resolve(__dirname, '../src/extension.ts'), 'utf8')
    const lineNumbers = extensionSource.match(/static lineNumberScript = `([\s\S]*?)`/)[1]
    await page.addStyleTag({ content: lineNumbers.match(/<style>([\s\S]*?)<\/style>/)[1] })
    await page.addScriptTag({ content: lineNumbers.match(/<script>([\s\S]*?)<\/script>/)[1] })
    await page.waitForSelector('#ln-toggle')
    await page.locator('#ln-toggle').click()
    for (const width of [1200, 700, 450, 320, 240, 1200]) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(100)
      const geometry = await page.locator('.vmd-toolbar').evaluate(toolbar => {
        const bounds = toolbar.getBoundingClientRect()
        const buttons = Array.from(toolbar.children).filter(child =>
          !child.hidden && getComputedStyle(child).display !== 'none')
        return {
          height: bounds.height,
          width: bounds.width,
          padding: getComputedStyle(toolbar).paddingLeft,
          children: buttons.map(button => {
            const rect = button.getBoundingClientRect()
            return { top: rect.top - bounds.top, right: rect.right - bounds.left }
          }),
        }
      })
      assert.ok(geometry.height <= 36, `Toolbar must stay one row at ${width}px: ${geometry.height}px`)
      assert.equal(geometry.padding, '6px', 'Line-number gutter must not pad the toolbar')
      assert.ok(geometry.children.every(child => child.right <= geometry.width + 1), `No horizontal clipping at ${width}px`)
      assert.ok(geometry.children.every(child => child.top < 10), `No wrapped controls at ${width}px`)
      const toggle = page.locator('.vmd-toolbar-toggle')
      if (await toggle.isVisible()) {
        await toggle.click()
        const tray = page.locator('.vmd-toolbar-tray')
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
        const trayBounds = await tray.boundingBox()
        assert.ok(trayBounds.x >= 0 && trayBounds.x + trayBounds.width <= width + 1)
        assert.ok(await tray.locator('.vditor-toolbar__item').count() > 0)
        await toggle.press('Tab')
        assert.equal(await tray.evaluate(tray => tray.contains(document.activeElement)), true)
        await page.keyboard.press('Escape')
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
        assert.equal(await toggle.evaluate(toggle => document.activeElement === toggle), true)
        await toggle.click()
        await page.locator('#app').click({ position: { x: 10, y: 400 } })
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
      }
    }
    await page.setViewportSize({ width: 320, height: 800 })
    await page.waitForTimeout(100)
    await page.locator('.vmd-toolbar [data-type="save"]').hover()
    assert.equal(await page.locator('.vmd-toolbar-tooltip').isVisible(), true)
    assert.match(await page.locator('.vmd-toolbar-tooltip').textContent(), /Save/)
    await page.locator('.vmd-toolbar-toggle').click()
    const emoji = page.locator('.vmd-toolbar-tray [data-type="emoji"]')
    await emoji.click()
    await emoji.hover()
    assert.match(await page.locator('.vmd-toolbar-tooltip').textContent(), /Emoji/)
    const emojiPanel = page.locator('.vmd-toolbar-tray .vditor-panel').filter({ has: page.locator('.vditor-emojis') })
    const emojiBounds = await emojiPanel.boundingBox()
    assert.ok(emojiBounds && emojiBounds.width > 100, 'Overflow submenu must not collapse into the legacy 21px ellipsis')
    assert.ok(emojiBounds.x >= 0 && emojiBounds.x + emojiBounds.width <= 321, 'Overflow submenu must fit the pane')
    await page.keyboard.press('Escape')
    await page.locator('.vmd-toolbar [data-type="more"]').click()
    const moreMenu = page.locator('.vmd-toolbar [data-type="markdown-outline"]')
    const menuBounds = await moreMenu.boundingBox()
    assert.ok(menuBounds && menuBounds.width > 100)
    assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= 321)
    await moreMenu.hover()
    assert.equal(await page.locator('.vmd-toolbar-tooltip').textContent(), 'Show Markdown Outline')
    await moreMenu.click()
    await init('ir', 'light')
    assert.equal(await page.locator('.vmd-toolbar-overflow').count(), 1, 'Theme rebuild must not duplicate overflow controls')

    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(100)
    const reset = page.locator('.vditor-ir .vditor-reset')
    const beforeHidden = await page.evaluate(() => vditor.getValue())
    assert.equal(await page.locator('.vditor-ir h1').evaluate(element => getComputedStyle(element, '::before').content), '"H1"')
    await page.locator('#vmd-toolbar-visibility').click()
    assert.equal(await page.locator('.vmd-toolbar').isVisible(), false)
    assert.equal(await page.locator('.vmd-toolbar').evaluate(element => element.getBoundingClientRect().height), 0)
    assert.equal(await page.locator('.vditor-ir h1').evaluate(element => getComputedStyle(element, '::before').content), 'none')
    assert.equal(await reset.evaluate(element => getComputedStyle(element).paddingLeft), '12px')
    assert.equal(await page.locator('#ln-gutter').isVisible(), false)
    assert.equal(await page.locator('#vmd-toolbar-visibility').getAttribute('aria-label'), 'Show toolbar')
    assert.equal(await page.locator('#vmd-toolbar-visibility').evaluate(element => element.getBoundingClientRect().width), 26)
    await page.locator('#app').press('Control+f')
    await page.waitForSelector('#vmd-search-bar.vmd-search-bar--open')
    await page.locator('#vmd-search-input').fill('Café')
    assert.equal(await page.locator('#vmd-search-count').textContent(), '1/1')
    await page.locator('#vmd-search-input').press('Escape')
    await page.setViewportSize({ width: 320, height: 800 })
    await init('ir', 'dark', { toolbarHidden: true, rawHtmlHidden: false })
    assert.equal(await page.locator('.vmd-toolbar').isVisible(), false, 'Hidden preference survives editor recreation')
    assert.equal(await page.locator('#vmd-toolbar-visibility').count(), 1)
    await page.locator('#vmd-toolbar-visibility').press('Enter')
    await page.waitForTimeout(100)
    assert.equal(await page.locator('.vmd-toolbar').isVisible(), true)
    assert.ok(await page.locator('.vmd-toolbar').evaluate(element => element.getBoundingClientRect().height) <= 36)
    assert.notEqual(await reset.evaluate(element => getComputedStyle(element).paddingLeft), '12px')
    assert.equal(await page.evaluate(() => vditor.getValue()), beforeHidden)
    assert.equal(await page.evaluate(() => window.messages.some(message =>
      message.command === 'save-appearance' && message.appearance.toolbarHidden)), true)

    const htmlContent = '# Heading\n\n<a id="custom-anchor"></a>\n\nVisible <span class="example">inline HTML</span> text.\n\n<div class="example">Rendered block</div>\n\n```html\n<div>Code example</div>\n```\n'
    await page.setViewportSize({ width: 1200, height: 800 })
    for (const mode of ['ir', 'wysiwyg', 'sv']) {
      await init(mode, 'light', { toolbarHidden: false, rawHtmlHidden: false }, htmlContent)
      const before = await page.evaluate(() => vditor.getValue())
      const htmlButton = page.locator('.vmd-toolbar [data-type="raw-html"]')
      await htmlButton.click()
      assert.equal(await htmlButton.getAttribute('aria-pressed'), 'true')
      if (mode !== 'sv') {
        const rich = page.locator(`.vditor-${mode} .vditor-reset`)
        assert.equal(await rich.locator('[data-type="html-inline"]').first().isVisible(), false)
        assert.equal(await rich.locator('p.vmd-html-only').isVisible(), false)
        assert.equal(await rich.locator('[data-type="html-block"] .example').isVisible(), true)
        assert.equal(await rich.locator('[data-type="code-block"] > pre').last().isVisible(), true)
        await page.locator('.vmd-toolbar [data-type="find"]').click()
        await page.locator('#vmd-search-input').fill('custom-anchor')
        assert.equal(await page.locator('#vmd-search-count').textContent(), '0/0')
        await page.locator('#vmd-search-input').fill('inline HTML')
        assert.equal(await page.locator('#vmd-search-count').textContent(), '1/1')
        await page.locator('#vmd-search-input').press('Escape')
        await page.evaluate(() => {
          window.scrolled = []
          window.postMessage({ command: 'scroll-to-heading', fragment: 'custom-anchor' }, '*')
        })
        await page.waitForTimeout(50)
        assert.match(await page.evaluate(() => window.scrolled.at(-1)), /Visible.*inline HTML/)
        assert.equal(await page.evaluate(() => vditor.getValue()), before)
        const paragraph = rich.locator('p').filter({ hasText: /^Visible / })
        await paragraph.click()
        await page.keyboard.press('End')
        await page.keyboard.type(' Addition.')
        const edited = await page.evaluate(() => vditor.getValue())
        assert.match(edited, /<a id="custom-anchor"><\/a>/)
        assert.match(edited, /<span class="example">inline HTML<\/span>/)
        assert.match(edited, /Addition\./)
      } else {
        assert.match(await page.locator('.vditor-sv').innerText(), /<a id="custom-anchor">/)
        assert.equal(await page.evaluate(() => vditor.getValue()), before)
      }
      await htmlButton.click()
      assert.equal(await htmlButton.getAttribute('aria-pressed'), 'false')
      await init(mode, 'dark', { toolbarHidden: true, rawHtmlHidden: true }, htmlContent)
      assert.equal(await page.locator('.vmd-toolbar').isVisible(), false)
      if (mode !== 'sv') {
        assert.equal(await page.locator(`.vditor-${mode} [data-type="html-inline"]`).first().isVisible(), false)
        assert.equal(await page.locator(`.vditor-${mode} h1`).evaluate(element => getComputedStyle(element, '::before').content), 'none')
      }
    }
    await init('ir', 'light', { toolbarHidden: false, rawHtmlHidden: false }, htmlContent)
    const raw = page.locator('.vditor-ir [data-type="html-inline"]').first()
    await page.locator('#vmd-toolbar-visibility').click()
    assert.equal(await raw.isVisible(), false, 'Hiding toolbar also hides raw HTML without a separate toggle')
    await page.locator('#vmd-toolbar-visibility').click()
    await page.locator('.vditor-ir h1').click()
    await page.locator('.vmd-toolbar [data-type="raw-html"]').click()
    await page.locator('#vmd-toolbar-visibility').click()
    await page.locator('#vmd-toolbar-visibility').click()
    assert.equal(await raw.isVisible(), false, 'Independent HTML preference survives toolbar hide/show')
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})

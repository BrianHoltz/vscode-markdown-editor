const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const normalize = markdown => markdown.replace(/^(\s*)\d+\./gm, (_, indent) => `${indent}1.`)

// Run against the owned Canary tab created by safe-browse, never a personal profile.
test('two Backspaces after a nested list preserve tightness and caret position', {
  skip: !process.env.MARKDOWN_TEST_TARGET && 'Requires an owned safe-browse Canary tab',
}, async () => {
  assert.ok(process.env.MARKDOWN_TEST_TARGET, 'Provide the owned safe-browse target ID')
  const browser = await chromium.connectOverCDP('http://localhost:9222')
  try {
    const context = browser.contexts()[0]
    let page
    for (const candidate of context.pages()) {
      const session = await context.newCDPSession(candidate)
      const { targetInfo } = await session.send('Target.getTargetInfo')
      await session.detach()
      if (targetInfo.targetId === process.env.MARKDOWN_TEST_TARGET) page = candidate
    }
    assert.ok(page, 'Owned test tab must exist')
    page.on('pageerror', error => console.error(error.message))
    page.on('requestfailed', request => console.error('failed', request.url()))
    const root = path.resolve(__dirname, '..')
    let activeHost = 'vscode'
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' })
      const at = url.pathname.indexOf('/dist/')
      const asset = activeHost === 'idea'
        ? path.join(process.env.IDEA_MARKDOWN_ROOT, 'src/main/resources/vditor', url.pathname.slice(at))
        : path.join(root, 'media-src/node_modules/vditor', url.pathname.slice(at))
      return at >= 0 && fs.existsSync(asset) ? route.fulfill({ path: asset }) : route.abort()
    })
    await page.goto('http://markdown-editor.test')
    await page.evaluate(() => { window.acquireVsCodeApi = () => ({ postMessage() {} }) })
    await page.addScriptTag({ path: path.join(root, 'media/dist/main.js') })
    const hosts = ['vscode', ...(process.env.IDEA_MARKDOWN_ROOT ? ['idea'] : [])]
    for (const host of hosts) {
      activeHost = host
      if (host === 'idea') {
        await page.goto('http://markdown-editor.test')
        await page.addScriptTag({ path: path.join(process.env.IDEA_MARKDOWN_ROOT, 'src/main/resources/vditor/dist/js/lute/lute.min.js') })
        await page.addScriptTag({ path: path.join(process.env.IDEA_MARKDOWN_ROOT, 'src/main/resources/vditor/dist/index.min.js') })
        await page.addScriptTag({ path: path.join(process.env.IDEA_MARKDOWN_ROOT, 'src/main/resources/vditor/list-backspace.js') })
        await page.evaluate(() => document.addEventListener('keydown', fixListBackspace, true))
      }
      for (const marker of ['-', '1.']) {
        const indent = marker === '-' ? '  ' : '   '
        const expected = `${marker} Parent\n${indent}${marker} Child one\n${indent}${marker === '-' ? '-' : '2.'} Child two\n${marker === '-' ? '-' : '2.'} Next\n${marker === '-' ? '-' : '3.'} Last\n`
        const input = expected.replace(/(^.*Next)/m, `${marker} \n$1`)
        for (const mode of ['wysiwyg', 'ir']) {
          await page.evaluate(({ mode, input, host }) => {
            document.body.removeAttribute('data-vmd-ready')
            if (host === 'idea') {
              if (window.vditor) window.vditor.destroy()
              window.vditor = new Vditor('app', { mode, customWysiwygToolbar() {}, value: input,
                cdn: '/vendor', lang: 'en_US', cache: { enable: false },
                after() { document.body.setAttribute('data-vmd-ready', '1') } })
              return
            }
            window.postMessage({ command: 'update', type: 'init',
              content: input, options: { mode }, theme: 'light' }, '*')
          }, { mode, input, host })
          await page.waitForSelector('body[data-vmd-ready="1"]')
          await page.evaluate(() => {
            const root = vditor.vditor[vditor.vditor.currentMode].element
            const item = root.querySelectorAll(':scope > ul > li, :scope > ol > li')[1]
            root.focus()
            const range = document.createRange()
            range.selectNodeContents(item)
            range.collapse(true)
            getSelection().removeAllRanges()
            getSelection().addRange(range)
          })
          await page.keyboard.press('Backspace')
          await page.keyboard.press('Backspace')
          await page.waitForTimeout(1000)
          assert.equal(normalize(await page.evaluate(() => vditor.getValue())), normalize(expected), `${host}/${mode}`)
          assert.equal(await page.evaluate(() => getSelection().anchorNode.textContent), 'Child two', mode)
          await page.keyboard.type('!')
          await page.waitForTimeout(1000)
          assert.equal(normalize(await page.evaluate(() => vditor.getValue())), normalize(expected.replace('Child two', 'Child two!')), `${host}/${mode}`)
          await page.evaluate(() => vditor.vditor.undo.undo(vditor.vditor))
          await page.waitForTimeout(1000)
          assert.equal(normalize(await page.evaluate(() => vditor.getValue())), normalize(expected), `${host}/${mode}: undo typing`)
        }
      }
    }
  } finally {
    await browser.close()
  }
})

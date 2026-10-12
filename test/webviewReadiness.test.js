const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const source = fs.readFileSync(require.resolve('../src/extension.ts'), 'utf8')

test('both webview stylesheet handlers work before the body exists', () => {
  const handlers = [...source.matchAll(/on(?:load|error)="([^"]+)"/g)]
  assert.equal(handlers.length, 4)
  for (const [, handler] of handlers) {
    const attributes = new Map()
    const document = {
      body: null,
      documentElement: { setAttribute: (name, value) => attributes.set(name, value) },
    }
    vm.runInNewContext(handler, { document })
    assert.equal(attributes.get('data-vmd-css-loaded'), '1')
  }
  assert.ok(source.includes('html[data-vmd-css-loaded="1"] body[data-vmd-ready="1"] #app{opacity:1}'))
})

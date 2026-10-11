const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const vm = require('vm')

class Disposable {
  constructor(callback = () => {}) { this.callback = callback }
  dispose() { this.callback() }
}
class EventEmitter {
  listeners = new Set()
  event = listener => {
    this.listeners.add(listener)
    return new Disposable(() => this.listeners.delete(listener))
  }
  fire(value) { this.listeners.forEach(listener => listener(value)) }
  dispose() { this.listeners.clear() }
}

function setup() {
  const commands = new Map()
  const executed = []
  const editor = new EventEmitter()
  const vscode = {
    Disposable, EventEmitter,
    TreeItem: class { constructor(label, collapsibleState) { Object.assign(this, { label, collapsibleState }) } },
    TreeItemCollapsibleState: { Expanded: 2, None: 0 },
    window: { createTreeView: () => new Disposable(), onDidChangeActiveTextEditor: editor.event },
    commands: {
      registerCommand: (name, callback) => { commands.set(name, callback); return new Disposable() },
      executeCommand: async (...args) => { executed.push(args) },
    },
  }
  const exports = {}
  vm.runInNewContext(fs.readFileSync(require.resolve('../out/outline'), 'utf8'), {
    exports, require: name => name === 'vscode' ? vscode : require(name),
  })
  const outline = new exports.MarkdownOutline()
  function panel(path) {
    const state = new EventEmitter()
    const message = new EventEmitter()
    const posted = []
    const uri = { toString: () => path }
    const panel = {
      active: true, visible: true, onDidChangeViewState: state.event,
      webview: { onDidReceiveMessage: message.event, postMessage: value => posted.push(value) },
      reveal() { this.visible = true },
    }
    const registration = outline.register(panel, uri)
    return { panel, uri, state, message, posted, registration }
  }
  return { outline, panel, commands, executed, editor }
}

test('Outline survives sidebar focus, tracks each panel, and clears for a text editor', () => {
  const fixture = setup()
  const a = fixture.panel('a.md')
  const b = fixture.panel('b.md')
  const headings = [
    { label: 'A', level: 1, slug: 'a', index: 0 },
    { label: 'Nested', level: 3, slug: 'nested', index: 1 },
  ]
  a.message.fire({ command: 'outline', headings })
  b.message.fire({ command: 'outline', headings: [{ label: 'B', level: 1, slug: 'b', index: 0 }] })
  a.state.fire({ webviewPanel: a.panel })
  a.panel.active = false
  a.state.fire({ webviewPanel: a.panel })
  fixture.editor.fire(undefined)
  const root = fixture.outline.getChildren()[0]
  assert.equal(root.label, 'A')
  assert.equal(fixture.outline.getChildren(root)[0].label, 'Nested')
  fixture.commands.get('markdownEditorOutline.scrollTo')(root.children[0])
  assert.deepEqual({ ...a.posted[0] }, { command: 'scroll-to-heading', index: 1 })
  assert.equal(b.posted.length, 0)
  fixture.editor.fire({ document: {} })
  assert.equal(fixture.outline.getChildren().length, 0)
  a.panel.active = true
  a.state.fire({ webviewPanel: a.panel })
  a.registration.dispose()
  assert.notEqual(fixture.outline.getChildren()[0]?.label, 'A')
  fixture.outline.dispose()
})

test('Cross-document anchors wait for the new webview to finish rendering', async () => {
  const fixture = setup()
  const uri = { toString: () => 'other.md' }
  await fixture.outline.open(uri, 'café')
  assert.deepEqual(fixture.executed[0], ['vscode.openWith', uri, 'markdown-editor.customEditor'])
  const panel = fixture.panel('other.md')
  panel.message.fire({ command: 'outline', headings: [] })
  assert.deepEqual({ ...panel.posted[0] }, { command: 'scroll-to-heading', fragment: 'café' })
  await fixture.outline.open(uri, 'second')
  assert.equal(panel.posted[1].fragment, 'second')
  fixture.outline.dispose()
})

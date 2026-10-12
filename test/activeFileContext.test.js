const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const vm = require('vm')

class TabInputText {
  constructor(uri) { this.uri = uri }
}
class TabInputCustom {
  constructor(uri) { this.uri = uri }
}
class TabInputWebview {
  constructor(viewType) { this.viewType = viewType }
}

const vscode = { TabInputText, TabInputCustom, TabInputWebview }
const moduleExports = {}
vm.runInNewContext(fs.readFileSync(require.resolve('../out/activeFileContext'), 'utf8'), {
  exports: moduleExports,
  require: name => name === 'vscode' ? vscode : require(name),
})

test('resolves file URIs from text, custom, and Markdown webview tabs only', () => {
  const uri = { scheme: 'file', fsPath: '/workspace/readme.md' }
  const markdownWebviewUri = { scheme: 'file', fsPath: '/workspace/preview.md' }
  assert.equal(moduleExports.getActiveFileUriFromTab({ input: new TabInputText(uri) }), uri)
  assert.equal(moduleExports.getActiveFileUriFromTab({ input: new TabInputCustom(uri) }), uri)
  assert.equal(
    moduleExports.getActiveFileUriFromTab(
      { input: new TabInputWebview(moduleExports.markdownEditorViewType) },
      markdownWebviewUri
    ),
    markdownWebviewUri
  )
  assert.equal(
    moduleExports.getActiveFileUriFromTab(
      { input: new TabInputWebview('unrelated-webview') },
      markdownWebviewUri
    ),
    undefined
  )
  assert.equal(moduleExports.getActiveFileUriFromTab(undefined), undefined)
})

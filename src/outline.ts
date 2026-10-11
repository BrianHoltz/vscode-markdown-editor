import * as vscode from 'vscode'
import { Heading } from './headings'

interface OutlineNode extends Heading {
  children: OutlineNode[]
  panel: vscode.WebviewPanel
}

export class MarkdownOutline implements vscode.TreeDataProvider<OutlineNode>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>()
  readonly onDidChangeTreeData = this.changed.event
  private readonly panels = new Map<vscode.WebviewPanel, { uri: vscode.Uri; headings: Heading[] }>()
  private readonly pending = new Map<string, string>()
  private active?: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[]

  constructor() {
    this.disposables = [
      this.changed,
      vscode.window.createTreeView('markdownEditorOutline', { treeDataProvider: this, showCollapseAll: true }),
      vscode.commands.registerCommand('markdownEditorOutline.scrollTo', (node: OutlineNode) => {
        node.panel.reveal(undefined, true)
        node.panel.webview.postMessage({ command: 'scroll-to-heading', index: node.index })
      }),
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) this.select(undefined)
      }),
    ]
  }

  private select(panel?: vscode.WebviewPanel) {
    this.active = panel
    vscode.commands.executeCommand('setContext', 'markdownEditorActive', !!panel)
    this.changed.fire()
  }

  register(panel: vscode.WebviewPanel, uri: vscode.Uri): vscode.Disposable {
    this.panels.set(panel, { uri, headings: [] })
    if (panel.active) this.select(panel)
    const subscriptions = [
      panel.onDidChangeViewState(({ webviewPanel }) => {
        if (webviewPanel.active) this.select(panel)
        else if (!webviewPanel.visible && this.active === panel) {
          this.select([...this.panels.keys()].find(candidate => candidate.active))
        }
      }),
      panel.webview.onDidReceiveMessage(message => {
        if (message.command === 'outline') {
          const state = this.panels.get(panel)
          if (!state) return
          state.headings = message.headings
          if (this.active === panel) this.changed.fire()
          const fragment = this.pending.get(uri.toString())
          if (fragment !== undefined) {
            this.pending.delete(uri.toString())
            panel.webview.postMessage({ command: 'scroll-to-heading', fragment })
          }
        } else if (message.command === 'show-outline') {
          this.select(panel)
          vscode.commands.executeCommand('markdownEditorOutline.focus')
        }
      }),
    ]
    return new vscode.Disposable(() => {
      subscriptions.forEach(subscription => subscription.dispose())
      this.panels.delete(panel)
      if (this.active === panel) this.select([...this.panels.keys()].find(candidate => candidate.active))
    })
  }

  async open(uri: vscode.Uri, fragment: string) {
    const existing = [...this.panels.entries()].find(([, state]) => state.uri.toString() === uri.toString())
    if (existing) {
      existing[0].reveal()
      existing[0].webview.postMessage({ command: 'scroll-to-heading', fragment })
    } else {
      this.pending.set(uri.toString(), fragment)
      try {
        await vscode.commands.executeCommand('vscode.openWith', uri, 'markdown-editor.customEditor')
      } catch (error) {
        this.pending.delete(uri.toString())
        throw error
      }
    }
  }

  getChildren(node?: OutlineNode): OutlineNode[] {
    if (node) return node.children
    if (!this.active) return []
    const roots: OutlineNode[] = []
    const stack: OutlineNode[] = []
    for (const heading of this.panels.get(this.active)?.headings || []) {
      const next: OutlineNode = { ...heading, children: [], panel: this.active }
      while (stack.length && stack[stack.length - 1].level >= next.level) stack.pop()
      if (stack.length) stack[stack.length - 1].children.push(next)
      else roots.push(next)
      stack.push(next)
    }
    return roots
  }

  getTreeItem(node: OutlineNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, node.children.length
      ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None)
    item.tooltip = `${'#'.repeat(node.level)} ${node.label}`
    item.command = { command: 'markdownEditorOutline.scrollTo', title: 'Go to heading', arguments: [node] }
    return item
  }

  dispose() {
    this.disposables.forEach(disposable => disposable.dispose())
    this.panels.clear()
    this.pending.clear()
  }
}

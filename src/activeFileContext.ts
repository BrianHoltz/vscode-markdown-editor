import * as vscode from 'vscode'

export const markdownEditorViewType = 'markdown-editor'

export function getActiveFileUriFromTab(
  tab: vscode.Tab | undefined,
  markdownWebviewUri?: vscode.Uri
): vscode.Uri | undefined {
  const input = tab?.input
  if (
    (vscode.TabInputText && input instanceof vscode.TabInputText) ||
    (vscode.TabInputCustom && input instanceof vscode.TabInputCustom)
  ) {
    return input.uri
  }
  if (
    vscode.TabInputWebview &&
    input instanceof vscode.TabInputWebview &&
    input.viewType === markdownEditorViewType
  ) {
    return markdownWebviewUri
  }
  return undefined
}

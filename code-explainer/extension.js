const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log(
    'Congratulations, your extension "code-explainer" is now active!',
  );

  const disposable = vscode.commands.registerCommand(
    "code-explainer.helloWorld",
    function () {
      const panel = vscode.window.createWebviewPanel(
        "codeExplainer",
        "Code Explainer",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        },
      );

      const htmlPath = path.join(
        context.extensionPath,
        "webview",
        "index.html",
      );

      panel.webview.html = fs.readFileSync(htmlPath, "utf8");
    },
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

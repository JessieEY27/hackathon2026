const vscode = require("vscode");

/**
 * Runs when the extension activates
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("Code Explainer extension is now active!");

  const explainCodeCommand = vscode.commands.registerCommand(
    "code-explainer.explainCode",
    async function () {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage("No active editor found.");
        return;
      }

      const selectedCode = editor.document.getText(editor.selection);

      if (!selectedCode || selectedCode.trim() === "") {
        vscode.window.showWarningMessage("Please highlight some code first.");
        return;
      }

      await sendToServer(selectedCode, "selection");
    }
  );

  const explainFileCommand = vscode.commands.registerCommand(
    "code-explainer.explainFile",
    async function () {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage("No active editor found.");
        return;
      }

      const fileContent = editor.document.getText();

      if (!fileContent || fileContent.trim() === "") {
        vscode.window.showWarningMessage("This file is empty.");
        return;
      }

      await sendToServer(fileContent, "file");
    }
  );

  context.subscriptions.push(explainCodeCommand, explainFileCommand);
}

/**
 * Send code to backend server
 * @param {string} code
 * @param {string} mode
 */
async function sendToServer(code, mode) {
  try {
    const response = await fetch("http://localhost:3000/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        selectedCode: code,
        mode: mode
      })
    });

    if (!response.ok) {
      let errorMessage = `Server returned status ${response.status}`;

      try {
        const errorData = await response.json();
        if (
          errorData &&
          typeof errorData === "object" &&
          "error" in errorData &&
          typeof errorData.error === "string"
        ) {
          errorMessage = errorData.error;
        }
      } catch (_ignored) {
        // Ignore JSON parse errors for error responses
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();

    let explanation = "No explanation returned.";

    if (
      data &&
      typeof data === "object" &&
      "explanation" in data &&
      typeof data.explanation === "string"
    ) {
      explanation = data.explanation;
    }

    showExplanationPanel(explanation, mode);
  } catch (error) {
    const errorMessage =
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unknown error";

    vscode.window.showErrorMessage(
      `Failed to get explanation from server: ${errorMessage}`
    );
  }
}

/**
 * Show explanation in a webview panel
 * @param {string} text
 * @param {string} mode
 */
function showExplanationPanel(text, mode) {
  const title =
    mode === "file" ? "Code Explanation - File" : "Code Explanation";

  const panel = vscode.window.createWebviewPanel(
    "codeExplanation",
    title,
    vscode.ViewColumn.Beside,
    {
      enableScripts: false
    }
  );

  const escapedText = escapeHtml(text);

  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            line-height: 1.6;
          }

          h1 {
            font-size: 20px;
            margin-bottom: 16px;
          }

          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: Consolas, monospace;
            font-size: 14px;
            padding: 12px;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <pre>${escapedText}</pre>
      </body>
    </html>
  `;
}

/**
 * Escape HTML before inserting into webview
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};

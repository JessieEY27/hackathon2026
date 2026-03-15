const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

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

      openExplainerWebview(context, selectedCode);
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

      openExplainerWebview(context, fileContent);
    }
  );

  context.subscriptions.push(explainCodeCommand, explainFileCommand);
}

/**
 * Opens the custom webview UI
 * @param {vscode.ExtensionContext} context
 * @param {string} code
 */
function openExplainerWebview(context, code) {
  const webviewFolder = path.join(context.extensionPath, "webview");

  const panel = vscode.window.createWebviewPanel(
    "codeExplainerUI",
    "Code Explainer",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(webviewFolder)]
    }
  );

  panel.webview.html = getWebviewContent(panel.webview, webviewFolder);

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.command !== "explainCode") {
      return;
    }

    try {
      const fullCode =
        typeof message.code === "string" ? message.code : "";

      const start = Number(message.start);
      const end = Number(message.end);
      const mode = message.mode === "eli5" ? "eli5" : "normal";
      const length =
        typeof message.length === "string" ? message.length : "short";

      if (!fullCode.trim()) {
        panel.webview.postMessage({
          command: "showExplanation",
          text: "No code was provided."
        });
        return;
      }

      const selectedCode = getLineRange(fullCode, start, end);

      if (!selectedCode.trim()) {
        panel.webview.postMessage({
          command: "showExplanation",
          text: "The selected line range is empty or invalid."
        });
        return;
      }

      const explanation = await sendToServer(selectedCode, {
        mode,
        length
      });

      panel.webview.postMessage({
        command: "showExplanation",
        text: explanation
      });
    } catch (error) {
      const errorMessage =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Unknown error";

      panel.webview.postMessage({
        command: "showExplanation",
        text: `Failed to get explanation: ${errorMessage}`
      });
    }
  });

  panel.onDidChangeViewState(() => {
    if (panel.visible) {
      panel.webview.postMessage({
        command: "updateCode",
        code: code
      });
    }
  });

  panel.webview.postMessage({
    command: "updateCode",
    code: code
  });
}

/**
 * Returns only the requested line range
 * @param {string} code
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function getLineRange(code, start, end) {
  const lines = code.split("\n");

  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return "";
  }

  if (start < 1 || end < start) {
    return "";
  }

  const safeStart = Math.max(1, start);
  const safeEnd = Math.min(lines.length, end);

  return lines.slice(safeStart - 1, safeEnd).join("\n");
}

/**
 * Sends code to backend server
 * @param {string} code
 * @param {{mode: string, length: string}} options
 * @returns {Promise<string>}
 */
async function sendToServer(code, options) {
  const response = await fetch("http://localhost:3000/explain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      selectedCode: code,
      mode: options.mode,
      length: options.length
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
      // ignore parse error
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (
    data &&
    typeof data === "object" &&
    "explanation" in data &&
    typeof data.explanation === "string"
  ) {
    return data.explanation;
  }

  return "No explanation returned.";
}

/**
 * Builds the HTML for the webview
 * @param {vscode.Webview} webview
 * @param {string} webviewFolder
 * @returns {string}
 */
function getWebviewContent(webview, webviewFolder) {
  const htmlPath = path.join(webviewFolder, "index.html");
  const cssPath = webview.asWebviewUri(
    vscode.Uri.file(path.join(webviewFolder, "style.css"))
  );
  const scriptPath = webview.asWebviewUri(
    vscode.Uri.file(path.join(webviewFolder, "script.js"))
  );

  let html = fs.readFileSync(htmlPath, "utf8");

  html = html.replace(
    /<link rel="stylesheet" href="style\.css"\s*\/?>/,
    `<link rel="stylesheet" href="${cssPath}">`
  );

  html = html.replace(
    /<script src="script\.js"><\/script>/,
    `<script src="${scriptPath}"></script>`
  );

  return html;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
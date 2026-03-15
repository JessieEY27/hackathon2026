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

      const selection = editor.selection;
      const selectedCode = editor.document.getText(selection);

      if (!selectedCode || selectedCode.trim() === "") {
        vscode.window.showWarningMessage("Please highlight some code first.");
        return;
      }

      const fullFileCode = editor.document.getText();
      const selectionStart = selection.start.line + 1;
      let selectionEnd = selection.end.line + 1;

      if (
        selection.end.character === 0 &&
        selection.end.line > selection.start.line
      ) {
        selectionEnd -= 1;
      }

      openExplainerPanel(context, {
        code: fullFileCode,
        language: editor.document.languageId,
        title: "Code Explanation",
        startLine: selectionStart,
        endLine: selectionEnd
      });
    }
  );

  context.subscriptions.push(explainCodeCommand);
}

/**
 * Create and show the explainer webview
 * @param {vscode.ExtensionContext} context
 * @param {{code: string, language: string, title: string, startLine?: number, endLine?: number}} options
 */
function openExplainerPanel(context, options) {
  const panel = vscode.window.createWebviewPanel(
    "codeExplainer",
    options.title,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, "webview"))
      ]
    }
  );

  panel.webview.html = getWebviewHtml(context, panel.webview);

  panel.webview.postMessage({
    command: "updateCode",
    code: options.code,
    startLine: options.startLine,
    endLine: options.endLine
  });

  panel.webview.onDidReceiveMessage(async (message) => {
    if (!message || typeof message.command !== "string") {
      return;
    }

    try {
      if (message.command === "explainCode") {
        const rawCode = typeof message.code === "string" ? message.code : "";
        const start = Number.isInteger(message.start) ? message.start : 1;
        const end = Number.isInteger(message.end) ? message.end : start;
        const length =
          typeof message.length === "string" ? message.length : undefined;
        const mode = message.mode === "eli5" ? "eli5" : undefined;

        const slicedCode = sliceLines(rawCode, start, end);

        if (!slicedCode || slicedCode.trim() === "") {
          vscode.window.showWarningMessage("There is no code to explain.");
          return;
        }

        const explanation = await sendToServer({
          code: slicedCode,
          language: options.language,
          mode,
          length
        });

        panel.webview.postMessage({
          command: "showExplanation",
          text: explanation,
          explanationType: "code"
        });

        return;
      }

      if (message.command === "explainFile") {
        const rawCode = typeof message.code === "string" ? message.code : "";

        if (!rawCode || rawCode.trim() === "") {
          vscode.window.showWarningMessage("This file is empty.");
          return;
        }

        const explanation = await sendToServer({
          code: buildFileExplanationPrompt(rawCode, options.language),
          language: options.language
        });

        panel.webview.postMessage({
          command: "showExplanation",
          text: explanation,
          explanationType: "file"
        });
      }
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
  });
}

/**
 * Build webview HTML with proper resource URIs
 * @param {vscode.ExtensionContext} context
 * @param {vscode.Webview} webview
 * @returns {string}
 */
function getWebviewHtml(context, webview) {
  const webviewDir = path.join(context.extensionPath, "webview");
  const htmlPath = path.join(webviewDir, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  const cssUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(webviewDir, "style.css"))
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(webviewDir, "script.js"))
  );

  html = html.replace('href="style.css"', `href="${cssUri}"`);
  html = html.replace('src="script.js"', `src="${scriptUri}"`);

  return html;
}

/**
 * Extract a 1-based inclusive line range from a block of code.
 * @param {string} code
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function sliceLines(code, start, end) {
  const lines = code.split(/\r?\n/);
  const safeStart = Math.max(1, Math.min(start, lines.length));
  const safeEnd = Math.max(safeStart, Math.min(end, lines.length));
  return lines.slice(safeStart - 1, safeEnd).join("\n");
}

/**
 * Build a strict file-analysis prompt for whole-file explanations.
 * @param {string} code
 * @param {string} language
 * @returns {string}
 */
function buildFileExplanationPrompt(code, language) {
  return `
You are analyzing an ENTIRE file.

Return a clean, readable structured explanation.
Do NOT write one large paragraph.

Use EXACTLY this format:

1. What is this file?
Write 2-4 sentences.

2. Main parts of this file
- Use bullet points.
- Put each bullet on its own line.

3. Key functionalities
- Use bullet points.
- Put each bullet on its own line.

4. How the structure works
Write 1-2 short paragraphs.

5. Possible improvements
- Use bullet points.
- Put each bullet on its own line.

6. Summary
Write 2-3 sentences.

Formatting rules:
- Put a blank line between every section.
- Put each bullet on its own line.
- Do not explain line by line.
- Ignore line range.
- Ignore explanation length.
- Focus on the whole file.

Language: ${language || "unknown"}

FILE CONTENT:
${code}
`.trim();
}

/**
 * Send code to backend server
 * @param {{code: string, language?: string, mode?: string, length?: string}} payload
 * @returns {Promise<string>}
 */
async function sendToServer(payload) {
  const response = await fetch("http://localhost:3000/explain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      selectedCode: payload.code,
      language: payload.language,
      mode: payload.mode,
      length: payload.length
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

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
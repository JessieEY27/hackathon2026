const vscode = require("vscode");

/**
 * Runs when the extension activates
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("Code Explainer extension is now active!");

  const disposable = vscode.commands.registerCommand(
    "code-explainer.explainCode",
    async function () {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage("No active editor found.");
        return;
      }

      // Get highlighted code
      const selectedCode = editor.document.getText(editor.selection);

      // Check if user selected anything
      if (!selectedCode || selectedCode.trim() === "") {
        vscode.window.showWarningMessage("Please highlight some code first.");
        return;
      }

      try {
        vscode.window.showInformationMessage("Sending code to AI server...");

        console.log("About to send request...");
        console.log("Selected text:", selectedCode);

        const response = await fetch("http://localhost:3000/explain", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            selectedCode: selectedCode
          })
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }

        const data = await response.json();
        console.log("Server response:", data);

        let explanation = "No explanation returned from server.";

        if (
          data &&
          typeof data === "object" &&
          "explanation" in data &&
          typeof data.explanation === "string"
        ) {
          explanation = data.explanation;
        }

        vscode.window.showInformationMessage(explanation);
      } catch (error) {
        console.error("Error contacting server:", error);

        const errorMessage =
          error && typeof error === "object" && "message" in error
            ? error.message
            : "Unknown error";

        vscode.window.showErrorMessage(
          `Failed to get explanation from server: ${errorMessage}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

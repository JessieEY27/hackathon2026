const vscode = acquireVsCodeApi();

document.getElementById("explain").addEventListener("click", () => {
  vscode.postMessage({
    command: "explainCode",
  });
});

const vscode = acquireVsCodeApi();

document.getElementById("explainbutton").addEventListener("click", () => {
  vscode.postMessage({
    command: "explainCode",
  });
});

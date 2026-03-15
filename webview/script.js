const vscode = acquireVsCodeApi();

window.addEventListener("DOMContentLoaded", () => {
  const explainButton = document.getElementById("explainbutton");
  const eli5Button = document.getElementById("eli5button");
  const codeInput = document.getElementById("codeinput");

  function sendCodeMessage(mode = "normal") {
    const start = document.getElementById("range-start").value;
    const end = document.getElementById("range-end").value;
    const length = document.getElementById("length").value;

    vscode.postMessage({
      command: "explainCode",
      code: codeInput.value, // readonly, populated by VS Code
      start: parseInt(start, 10),
      end: parseInt(end, 10),
      length: length,
      mode: mode,
    });
  }

  explainButton.addEventListener("click", () => sendCodeMessage("normal"));
  eli5Button.addEventListener("click", () => sendCodeMessage("eli5"));

  window.addEventListener("message", (event) => {
    const message = event.data;

    if (message.command === "updateCode") {
      codeInput.value = message.code;
    }

    if (message.command === "showExplanation") {
      const outputBox = document.getElementById("output");
      if (outputBox) outputBox.value = message.text;
    }
  });

  const copyButton = document.getElementById("copybutton");
  if (copyButton) {
    copyButton.addEventListener("click", () => {
      const outputBox = document.getElementById("output");
      if (!outputBox) return;
      navigator.clipboard.writeText(outputBox.value);

      copyButton.textContent = "COPIED!";
      setTimeout(() => (copyButton.textContent = "COPY TO CLIPBOARD"), 1500);
    });
  }
});

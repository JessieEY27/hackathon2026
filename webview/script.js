const vscode = acquireVsCodeApi();

window.addEventListener("DOMContentLoaded", () => {
  const explainButton = document.getElementById("explainbutton");
  const eli5Button = document.getElementById("eli5button");
  const copyButton = document.getElementById("copybutton");
  const outputBox = document.getElementById("output");
  const codeInput = document.getElementById("codeinput");

  // Function to send message to VS Code
  function sendCodeMessage(mode = "normal") {
    const code = codeInput.value;
    const start = document.getElementById("range-start").value;
    const end = document.getElementById("range-end").value;
    const length = document.getElementById("length").value;

    vscode.postMessage({
      command: "explainCode",
      code: code,
      start: start,
      end: end,
      length: length,
      mode: mode,
    });
  }

  explainButton.addEventListener("click", () => {
    sendCodeMessage("normal");
  });

  eli5Button.addEventListener("click", () => {
    sendCodeMessage("eli5");
  });

  window.addEventListener("message", (event) => {
    const message = event.data;

    if (message.command === "showExplanation") {
      outputBox.value = message.text;
    }
  });

  copyButton.addEventListener("click", () => {
    navigator.clipboard.writeText(outputBox.value);

    copyButton.textContent = "COPIED!";
    setTimeout(() => {
      copyButton.textContent = "COPY TO CLIPBOARD";
    }, 1500);
  });
});

const vscode = acquireVsCodeApi();

window.addEventListener("DOMContentLoaded", () => {
  const explainButton = document.getElementById("explainbutton");
  const eli5Button = document.getElementById("eli5button");
  const codeInput = document.getElementById("codeinput");
  const outputBox = document.getElementById("output");
  const startInput = document.getElementById("range-start");
  const endInput = document.getElementById("range-end");
  const lengthInput = document.getElementById("length");
  const copyButton = document.getElementById("copybutton");

  function sendCodeMessage(mode = "normal") {
    const start = parseInt(startInput.value, 10);
    const end = parseInt(endInput.value, 10);
    const length = lengthInput.value;

    vscode.postMessage({
      command: "explainCode",
      code: codeInput.value,
      start,
      end,
      length,
      mode
    });
  }

  explainButton.addEventListener("click", () => sendCodeMessage("normal"));
  eli5Button.addEventListener("click", () => sendCodeMessage("eli5"));

  window.addEventListener("message", (event) => {
    const message = event.data;

    if (message.command === "updateCode") {
      codeInput.value = message.code;

      const lineCount = message.code.split("\n").length;
      startInput.value = 1;
      endInput.value = lineCount;
      startInput.max = lineCount;
      endInput.max = lineCount;
    }

    if (message.command === "showExplanation") {
      outputBox.value = message.text;
    }
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(outputBox.value);
      copyButton.textContent = "COPIED!";
      setTimeout(() => {
        copyButton.textContent = "COPY TO CLIPBOARD";
      }, 1500);
    } catch (_error) {
      outputBox.value = "Failed to copy to clipboard.";
    }
  });
});
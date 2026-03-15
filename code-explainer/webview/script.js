// @ts-nocheck
const vscode = acquireVsCodeApi();

window.addEventListener("DOMContentLoaded", () => {
  const explainButton = document.getElementById("explainbutton");
  const eli5Button = document.getElementById("eli5button");
  const codeInput = document.getElementById("codeinput");
  let fullCode = "";

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
      fullCode = message.code || "";
      const lineCount = fullCode ? fullCode.split(/\r?\n/).length : 1;
      const startInput = document.getElementById("range-start");
      const endInput = document.getElementById("range-end");
      if (startInput && endInput) {
        startInput.max = String(lineCount);
        endInput.max = String(lineCount);
        const defaultStart = Number.isInteger(message.startLine) ? message.startLine : 1;
        const defaultEnd = Number.isInteger(message.endLine) ? message.endLine : lineCount;
        startInput.value = String(Math.max(1, Math.min(defaultStart, lineCount)));
        endInput.value = String(Math.max(1, Math.min(defaultEnd, lineCount)));
      }
      updateCodePreview();
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

  function updateCodePreview() {
    if (!codeInput) return;
    const startInput = document.getElementById("range-start");
    const endInput = document.getElementById("range-end");
    if (!startInput || !endInput) return;

    const start = parseInt(startInput.value, 10);
    const end = parseInt(endInput.value, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    codeInput.value = sliceLines(fullCode, start, end);
  }

  function sliceLines(code, start, end) {
    const lines = code.split(/\r?\n/);
    const safeStart = Math.max(1, Math.min(start, lines.length));
    const safeEnd = Math.max(safeStart, Math.min(end, lines.length));
    return lines.slice(safeStart - 1, safeEnd).join("\n");
  }

  const startInput = document.getElementById("range-start");
  const endInput = document.getElementById("range-end");
  if (startInput) startInput.addEventListener("input", updateCodePreview);
  if (endInput) endInput.addEventListener("input", updateCodePreview);
});

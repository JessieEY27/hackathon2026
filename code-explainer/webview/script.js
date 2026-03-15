// @ts-nocheck
const vscode = acquireVsCodeApi();

window.addEventListener("DOMContentLoaded", () => {
  const explainButton = document.getElementById("explainbutton");
  const explainFileButton = document.getElementById("explainfilebutton");
  const eli5Button = document.getElementById("eli5button");
  const codeInput = document.getElementById("codeinput");
  const outputBox = document.getElementById("output");

  let fullCode = "";

  function sendCodeMessage(mode = "normal") {
    const startInput = document.getElementById("range-start");
    const endInput = document.getElementById("range-end");
    const lengthSelect = document.getElementById("length");

    const start = startInput ? parseInt(startInput.value, 10) : 1;
    const end = endInput ? parseInt(endInput.value, 10) : 1;
    const length = lengthSelect ? lengthSelect.value : "short";

    vscode.postMessage({
      command: "explainCode",
      code: fullCode,
      start: Number.isFinite(start) ? start : 1,
      end: Number.isFinite(end) ? end : 1,
      length,
      mode
    });
  }

  function sendFileMessage() {
    vscode.postMessage({
      command: "explainFile",
      code: fullCode
    });
  }

  if (explainButton) {
    explainButton.addEventListener("click", () => sendCodeMessage("normal"));
  }

  if (explainFileButton) {
    explainFileButton.addEventListener("click", sendFileMessage);
  }

  if (eli5Button) {
    eli5Button.addEventListener("click", () => sendCodeMessage("eli5"));
  }

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

        const defaultStart = Number.isInteger(message.startLine)
          ? message.startLine
          : 1;

        const defaultEnd = Number.isInteger(message.endLine)
          ? message.endLine
          : lineCount;

        startInput.value = String(
          Math.max(1, Math.min(defaultStart, lineCount))
        );
        endInput.value = String(
          Math.max(1, Math.min(defaultEnd, lineCount))
        );
      }

      updateCodePreview();
    }

    if (message.command === "showExplanation") {
      if (!outputBox) return;

      const rawText = typeof message.text === "string" ? message.text : "";
      const explanationType =
        typeof message.explanationType === "string"
          ? message.explanationType
          : "code";

      outputBox.value =
        explanationType === "file"
          ? formatFileExplanation(rawText)
          : formatCodeExplanation(rawText);
    }
  });

  function formatCodeExplanation(text) {
    if (!text) return "";

    let formatted = text.replace(/\r\n/g, "\n").trim();
    formatted = formatted.replace(/^Explanation:\s*/i, "Explanation:\n");
    formatted = formatted.replace(/\s*Key lines:\s*/i, "\n\nKey lines:\n");
    formatted = formatted.replace(/[ \t]+\n/g, "\n");
    formatted = formatted.replace(/\n{3,}/g, "\n\n");
    formatted = dedupeKeyLines(formatted);
    return formatted.trim();
  }

  function dedupeKeyLines(text) {
    const parts = text.split(/\nKey lines:\n/i);
    if (parts.length < 2) return text;

    const header = parts[0];
    const lines = parts.slice(1).join("\n").split("\n");
    const seen = new Set();
    const kept = [];

    for (const line of lines) {
      const match = line.match(/^-\s*Line\s+(\d+)\s*:/i);
      if (!match) {
        if (line.trim()) kept.push(line);
        continue;
      }

      const num = match[1];
      if (seen.has(num)) continue;
      seen.add(num);
      kept.push(line);
    }

    const keyLinesBlock = kept.filter((l) => l.trim()).join("\n");
    return `${header}\n\nKey lines:\n${keyLinesBlock}`.trim();
  }

  function formatFileExplanation(text) {
    if (!text) return "";

    let formatted = text.replace(/\r\n/g, "\n").trim();

    formatted = formatted.replace(
      /\s*(\d+\.\s+(What is this file\?|Main parts of this file|Key functionalities|How the structure works|Possible improvements|Summary))/gi,
      "\n\n$1"
    );

    formatted = formatted.replace(
      /\s*(What is this file\?|Main parts of this file|Key functionalities|How the structure works|Possible improvements|Summary)\s*:*/gi,
      "\n\n$1"
    );

    formatted = formatted.replace(/\s•\s/g, "\n• ");
    formatted = formatted.replace(/\s\*\s/g, "\n• ");
    formatted = formatted.replace(/\s-\s/g, "\n- ");

    formatted = formatted.replace(/([.!?])\s+(?=\d+\.\s)/g, "$1\n\n");

    formatted = formatted.replace(
      /(Main parts of this file|Key functionalities|Possible improvements)\s+/g,
      "$1\n"
    );

    formatted = formatted.replace(/[ \t]+\n/g, "\n");
    formatted = formatted.replace(/\n{3,}/g, "\n\n");

    return formatted.trim();
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

  if (startInput) {
    startInput.addEventListener("input", updateCodePreview);
  }

  if (endInput) {
    endInput.addEventListener("input", updateCodePreview);
  }

  const copyButton = document.getElementById("copybutton");
  if (copyButton) {
    copyButton.addEventListener("click", () => {
      if (!outputBox) return;

      navigator.clipboard.writeText(outputBox.value);
      copyButton.textContent = "COPIED!";

      setTimeout(() => {
        copyButton.textContent = "COPY TO CLIPBOARD";
      }, 1500);
    });
  }

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    const savedTheme = localStorage.getItem("codeExplainerTheme");

    if (savedTheme === "dark") {
      document.body.classList.add("dark");
      themeToggle.checked = true;
    }

    themeToggle.addEventListener("change", () => {
      const isDark = themeToggle.checked;
      document.body.classList.toggle("dark", isDark);
      localStorage.setItem("codeExplainerTheme", isDark ? "dark" : "light");
    });
  }
});

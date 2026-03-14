const https = require("https");

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const CHAT_COMPLETIONS_PATH = "/chat/completions";
const REQUEST_TIMEOUT_MS = 15000;

// Build the prompt Groq will follow
function buildUserPrompt(code, language, mode) {
  const lang = language || "code";

  if (mode === "file") {
    return [
      `Analyze the following entire ${lang} file.`,
      "Return plain text only.",
      "Use exactly these headings in this exact order:",
      "",
      "File Purpose:",
      "Main Sections:",
      "Key Components:",
      "How It Works:",
      "Potential Issues or Improvements:",
      "",
      "Under each heading, write clear and structured explanations.",
      "Keep it easy for a developer to scan and understand.",
      "If the file is CSS or markup, explain selectors/sections/structure instead of functions.",
      "",
      code
    ].join("\n");
  }

  if (mode === "eli5") {
    return [
      `Explain the following ${lang} code in very simple terms.`,
      "Write like you are explaining to a beginner using easy words.",
      "Return plain text only.",
      "Use exactly this format:",
      "Explanation: <3-5 short sentences>",
      "Bugs: <None> or a short sentence describing possible issues>",
      "",
      code
    ].join("\n");
  }

  return [
    `Explain the following ${lang} code in plain English.`,
    "Write for a junior developer in plain English with minimal jargon.",
    "Return plain text only.",
    "Use exactly this format:",
    "Explanation: <3-5 short sentences>",
    "Bugs: <None> or a short sentence describing potential issues or edge cases>",
    "",
    code
  ].join("\n");
}

// Main entry for the server to call Groq
async function explainWithGroq({
  apiKey,
  model,
  temperature,
  maxTokens,
  selectedCode,
  language,
  mode
}) {
  if (!apiKey) {
    throw new Error("Missing Groq API key.");
  }

  const systemMessage =
    mode === "file"
      ? "You explain source files clearly and structurally for developers. Output plain text only. Follow the requested headings exactly."
      : "You explain code clearly and succinctly for developers. Output plain text only.";

  const body = {
    model,
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: buildUserPrompt(selectedCode, language, mode)
      }
    ],
    temperature,
    max_tokens: maxTokens
  };

  const url = `${GROQ_BASE_URL}${CHAT_COMPLETIONS_PATH}`;
  const data = await postJson(url, body, {
    Authorization: `Bearer ${apiKey}`
  });

  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  if (!content) {
    throw new Error("Groq response did not include any content.");
  }

  return content.trim();
}

// Low-level POST helper with timeout + JSON validation
function postJson(url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...headers
        }
      },
      (res) => {
        let raw = "";

        res.on("data", (chunk) => {
          raw += chunk;
        });

        res.on("end", () => {
          let parsed;

          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (err) {
            reject(new Error("Groq response was not valid JSON."));
            return;
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            const apiMessage =
              parsed &&
              parsed.error &&
              parsed.error.message
                ? parsed.error.message
                : null;

            reject(new Error(apiMessage || `Groq API error (HTTP ${res.statusCode}).`));
            return;
          }

          resolve(parsed);
        });
      }
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error("Groq request timed out."));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

module.exports = {
  explainWithGroq
};
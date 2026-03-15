const https = require('https');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const CHAT_COMPLETIONS_PATH = '/chat/completions';
const REQUEST_TIMEOUT_MS = process.env.GROQ_TIMEOUT_MS
  ? Number(process.env.GROQ_TIMEOUT_MS)
  : 15000;

// Build the prompt Groq will follow
function buildUserPrompt(code, language, mode, length, lineStart, lineCount) {
  const lang = language || 'code';
  const styleLine = mode === 'eli5'
    ? 'Write like you are explaining to a 5-year-old using simple words.'
    : 'Write for a junior developer in plain English with minimal jargon.';

  const lengthLine = length === 'short'
    ? 'Keep it very short: 2-3 sentences.'
    : length === 'long'
      ? 'Be detailed but clear: 7-10 sentences.'
      : 'Keep it concise: 4-6 sentences.';

  const numberedCode = addLineNumbers(code, lineStart);
  const totalLines = Number.isInteger(lineCount) && lineCount > 0
    ? lineCount
    : numberedCode.split(/\r?\n/).length;
  const keyLineCount = Math.max(1, Math.ceil(totalLines / 5));

  return [
    `Explain the following ${lang} code in plain English.`,
    styleLine,
    lengthLine,
    'Return plain text only.',
    'Start with "Explanation:" and then the sentences.',
    `After the explanation, add a short section titled "Key lines:" with exactly ${keyLineCount} bullets.`,
    'Do not repeat the same line number.',
    'Each bullet should be in the form "Line <number>: <why it matters>".',
    '',
    numberedCode
  ].join('\n');
}

// Main entry for the server to call Groq
async function explainWithGroq({ apiKey, model, temperature, maxTokens, selectedCode, language, mode, length, lineStart, lineCount, isFile }) {
  if (!apiKey) {
    throw new Error('Missing Groq API key.');
  }

  const userContent = isFile
    ? selectedCode
    : buildUserPrompt(selectedCode, language, mode, length, lineStart, lineCount);

  const body = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You explain code clearly and succinctly for developers. Output plain text only.'
      },
      {
        role: 'user',
        content: userContent
      }
    ],
    temperature,
    max_tokens: maxTokens
  };

  const url = `${GROQ_BASE_URL}${CHAT_COMPLETIONS_PATH}`;
  const data = await postJson(url, body, {
    Authorization: `Bearer ${apiKey}`
  });

  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) {
    throw new Error('Groq response did not include any content.');
  }

  return content.trim();
}

function addLineNumbers(code, lineStart) {
  const start = Number.isInteger(lineStart) && lineStart > 0 ? lineStart : 1;
  const lines = code.split(/\r?\n/);
  return lines
    .map((line, idx) => `${start + idx}: ${line}`)
    .join('\n');
}

// Low-level POST helper with timeout + JSON validation
function postJson(url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (err) {
            reject(new Error('Groq response was not valid JSON.'));
            return;
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            const apiMessage = parsed && parsed.error && parsed.error.message ? parsed.error.message : null;
            reject(new Error(apiMessage || `Groq API error (HTTP ${res.statusCode}).`));
            return;
          }

          resolve(parsed);
        });
      }
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Groq request timed out.'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

module.exports = {
  explainWithGroq
};

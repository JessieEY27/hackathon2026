require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { explainWithGroq } = require('./groqClient');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS and JSON parsing for webview requests
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Basic guardrails for input validation
const DISALLOWED_LANGUAGES = new Set(['plaintext', 'text', 'markdown']);
const MAX_CODE_CHARS = 20000;
const ALLOWED_LENGTHS = new Set(['short', 'medium', 'long']);

// Quick heuristic to block empty/gibberish input
function looksLikeCode(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const hasLetters = /[A-Za-z]/.test(trimmed);
  if (!hasLetters) return false;

  const hasCodePunct = /[{}()[\];=<>]/.test(trimmed);
  if (trimmed.length < 6 && !hasCodePunct) return false;

  return true;
}

// Consistent error format for the client
function errorResponse(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

// Basic request logging for debugging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });
  next();
});

// Lightweight health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/explain', async (req, res) => {
  try {
    const { selectedCode, language, mode, length } = req.body || {};

    if (!selectedCode || typeof selectedCode !== 'string' || !selectedCode.trim()) {
      errorResponse(res, 400, 'MISSING_CODE', 'selectedCode is required.');
      return;
    }

    if (selectedCode.length > MAX_CODE_CHARS) {
      errorResponse(res, 413, 'CODE_TOO_LARGE', `selectedCode exceeds ${MAX_CODE_CHARS} characters.`);
      return;
    }

    if (!language || typeof language !== 'string' || !language.trim()) {
      errorResponse(res, 400, 'MISSING_LANGUAGE', 'language is required.');
      return;
    }

    const normalizedLanguage = language.trim().toLowerCase();
    if (DISALLOWED_LANGUAGES.has(normalizedLanguage)) {
      errorResponse(res, 400, 'INVALID_LANGUAGE', 'language must be a programming language.');
      return;
    }

    if (!looksLikeCode(selectedCode)) {
      errorResponse(res, 400, 'INVALID_CODE', 'selectedCode does not look like valid code.');
      return;
    }

    if (mode && mode !== 'eli5') {
      errorResponse(res, 400, 'INVALID_MODE', 'mode must be "eli5" if provided.');
      return;
    }

    if (length && !ALLOWED_LENGTHS.has(length)) {
      errorResponse(res, 400, 'INVALID_LENGTH', 'length must be short, medium, or long if provided.');
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      errorResponse(res, 500, 'MISSING_API_KEY', 'Server missing GROQ_API_KEY.');
      return;
    }

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const temperature = process.env.GROQ_TEMPERATURE ? Number(process.env.GROQ_TEMPERATURE) : 0.2;
    const maxTokens = process.env.GROQ_MAX_TOKENS ? Number(process.env.GROQ_MAX_TOKENS) : 512;

    // goes to groqClient.js for Groq prompt and validates Groq response
    const explanation = await explainWithGroq({
      apiKey,
      model,
      temperature,
      maxTokens,
      selectedCode,
      language,
      mode,
      length
    });

    res.json({ explanation });
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error.';
    errorResponse(res, 500, 'INTERNAL_ERROR', message);
  }
});

// Handle invalid JSON bodies
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    errorResponse(res, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
    return;
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Code Explainer API listening on port ${PORT}`);
});
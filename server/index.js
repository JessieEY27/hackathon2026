require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { explainWithGroq } = require('./groqClient');

const app = express();
const PORT = process.env.PORT || 3000;
const REQUIRED_ENV = ['GROQ_API_KEY'];

// Fail fast if required env vars are missing
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required env vars: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// CORS and JSON parsing for webview requests
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Input size limit for selected code
const MAX_CODE_CHARS = 20000;
const MIN_CODE_CHARS = 5;
const INVALID_LANGS = new Set(['plaintext', 'text', 'markdown']);
const GROQ_TIMEOUT_MS = process.env.GROQ_TIMEOUT_MS ? Number(process.env.GROQ_TIMEOUT_MS) : 20000;

// Rate limiting (simple in-memory)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateWindow = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = rateWindow.get(key) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  rateWindow.set(key, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } });
    return;
  }

  next();
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

// Lightweight server status check
app.get('/serverstatus', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running and ready to accept requests.',
    uptimeSec: Math.floor(process.uptime()),
    time: new Date().toISOString()
  });
});

app.post('/explain', rateLimit, async (req, res) => {
  try {
    const { selectedCode, language, mode, length } = req.body || {};

    if (!selectedCode || typeof selectedCode !== 'string' || !selectedCode.trim()) {
      errorResponse(res, 400, 'MISSING_CODE', 'selectedCode is required.');
      return;
    }

    if (!language || typeof language !== 'string' || INVALID_LANGS.has(language.toLowerCase())) {
      errorResponse(res, 400, 'INVALID_LANGUAGE', 'language must be a supported code language (not plaintext/text/markdown).');
      return;
    }

    if (selectedCode.length > MAX_CODE_CHARS) {
      errorResponse(res, 413, 'CODE_TOO_LARGE', `selectedCode exceeds ${MAX_CODE_CHARS} characters.`);
      return;
    }

    const trimmed = selectedCode.trim();
    if (trimmed.length < MIN_CODE_CHARS || !/[A-Za-z]/.test(trimmed)) {
      errorResponse(res, 400, 'NOT_CODE', 'selectedCode does not appear to be code.');
      return;
    }

    if (mode && mode !== 'eli5') {
      errorResponse(res, 400, 'INVALID_MODE', 'mode must be "eli5" if provided.');
      return;
    }

    if (length && !['short', 'medium', 'long'].includes(length)) {
      errorResponse(res, 400, 'INVALID_LENGTH', 'length must be short, medium, or long if provided.');
      return;
    }

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const temperature = process.env.GROQ_TEMPERATURE ? Number(process.env.GROQ_TEMPERATURE) : 0.2;
    const maxTokens = process.env.GROQ_MAX_TOKENS ? Number(process.env.GROQ_MAX_TOKENS) : 512;

    const groqPromise = explainWithGroq({
      apiKey: process.env.GROQ_API_KEY,
      model,
      temperature,
      maxTokens,
      selectedCode,
      language,
      mode,
      length
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Groq request timed out.'));
      }, GROQ_TIMEOUT_MS);
    });

    const explanation = await Promise.race([groqPromise, timeoutPromise]);

    res.json({ explanation });
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error.';
    if (message.toLowerCase().includes('timed out')) {
      errorResponse(res, 504, 'GROQ_TIMEOUT', message);
      return;
    }
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

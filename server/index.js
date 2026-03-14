require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { explainWithGroq } = require('./groqClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/explain', async (req, res) => {
  try {
    const { selectedCode, language, mode } = req.body || {};

    if (!selectedCode || typeof selectedCode !== 'string' || !selectedCode.trim()) {
      res.status(400).json({ error: 'selectedCode is required.' });
      return;
    }

    if (mode && mode !== 'eli5') {
      res.status(400).json({ error: 'mode must be "eli5" if provided.' });
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server missing GROQ_API_KEY.' });
      return;
    }

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const temperature = process.env.GROQ_TEMPERATURE ? Number(process.env.GROQ_TEMPERATURE) : 0.2;
    const maxTokens = process.env.GROQ_MAX_TOKENS ? Number(process.env.GROQ_MAX_TOKENS) : 512;

    const explanation = await explainWithGroq({
      apiKey,
      model,
      temperature,
      maxTokens,
      selectedCode,
      language,
      mode
    });

    res.json({ explanation });
  } catch (err) {
    const message = err && err.message ? err.message : 'Unknown error.';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Code Explainer API listening on port ${PORT}`);
});
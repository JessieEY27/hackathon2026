require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { explainWithGroq } = require("./groqClient");

const app = express();
const PORT = process.env.PORT || 3000;

console.log("UPDATED SERVER LOADED");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  console.log("---- INCOMING REQUEST ----");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("Body:", req.body);
  next();
});

app.post("/explain", async (req, res) => {
  try {
    console.log("BODY RECEIVED:", req.body);

    const { selectedCode, language, mode } = req.body || {};

    console.log("selectedCode:", selectedCode);
    console.log("language:", language);
    console.log("mode:", mode);

    if (
      !selectedCode ||
      typeof selectedCode !== "string" ||
      !selectedCode.trim()
    ) {
      return res.status(400).json({ error: "selectedCode is required." });
    }

    if (mode && mode !== "eli5") {
      return res
        .status(400)
        .json({ error: 'mode must be "eli5" if provided.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    console.log("GROQ key loaded?", !!apiKey);

    if (!apiKey) {
      return res.status(500).json({ error: "Server missing GROQ_API_KEY." });
    }

    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const temperature = process.env.GROQ_TEMPERATURE
      ? Number(process.env.GROQ_TEMPERATURE)
      : 0.2;
    const maxTokens = process.env.GROQ_MAX_TOKENS
      ? Number(process.env.GROQ_MAX_TOKENS)
      : 512;

    console.log("Calling Groq with:");
    console.log("model:", model);
    console.log("temperature:", temperature);
    console.log("maxTokens:", maxTokens);

    const explanation = await explainWithGroq({
      apiKey,
      model,
      temperature,
      maxTokens,
      selectedCode,
      language,
      mode,
    });

    return res.json({ explanation });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    const message = err && err.message ? err.message : "Unknown error.";
    return res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Code Explainer API listening on port ${PORT}`);
});

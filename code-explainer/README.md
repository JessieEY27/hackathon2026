codesplAIner

Explain highlighted code or line ranges directly inside VS Code using an AI backend.

Features

Explain selected code or entire files
Choose explanation length (quick / standard / detailed)
“Explain like I’m 5” mode
Line range inputs with live preview
Copy explanation to clipboard
Manual dark‑mode toggle in the webview
Demo
Add screenshots or a short GIF here

Requirements

Node.js
A Groq API key (GROQ_API_KEY)
Local server running (see setup below)
Setup

Start the server
Open a terminal in: C:\Users\Kenny\OneDrive\CST\hackathon2026\server
Run npm install
Set GROQ_API_KEY=your_key_here
Run npm run dev
The server runs at http://localhost:3000

Run the extension
Open C:\Users\Kenny\OneDrive\CST\hackathon2026\code-explainer in VS Code and press F5.
Usage

Highlight code in your editor.
Run:
Code Explainer: Explain Code for selection, or
Code Explainer: Explain File for entire file.
Adjust line range (optional).
Click EXPLAIN MY CODE or EXPLAIN LIKE I’M 5.
Commands

Code Explainer: Explain Code
Code Explainer: Explain File
Validation Rules
The server returns 400 if:

selectedCode is missing or whitespace
language is missing or is plaintext, text, or markdown
selection looks like gibberish (too short or no letters)
Rate limiting is enabled (30 requests/minute per IP).

Environment Variables

GROQ_API_KEY (required)
GROQ_MODEL (optional, default: llama-3.3-70b-versatile)
GROQ_TEMPERATURE (optional, default: 0.2)
GROQ_MAX_TOKENS (optional, default: 512)
GROQ_TIMEOUT_MS (optional, default: 20000 server-side)
Packaging (.vsix)

Open terminal in C:\Users\Kenny\OneDrive\CST\hackathon2026\code-explainer
Run vsce package
Troubleshooting

Extension manifest not found: run vsce package inside the code-explainer folder.
No response: ensure the server is running and GROQ_API_KEY is set.
Red underline in webview JS: add // @ts-nocheck at the top of script.js if needed.

# Code Explainer API

## Setup

1. Install dependencies:

   npm install

2. Set your Groq API key:

   set GROQ_API_KEY=your_key_here

3. Start the server:

   npm run dev

## Endpoint

POST /explain

Body:

{
  "selectedCode": "...",
  "language": "javascript"
}

Response:

{
  "explanation": "..."
}
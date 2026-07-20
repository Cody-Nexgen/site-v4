# FocuzNow marketing site

## Local development

```sh
npm install
npm run dev
```

## AI Coach on Vercel

The streaming coach calls its model only from `api/coach.mjs`; the browser never receives the API key.

Add these environment variables to the Vercel project:

- `AI_COACH_API_KEY` — required
- `AI_COACH_MODEL` — optional, defaults to `llama-3.3-70b-versatile`

Use `vercel dev` when testing the serverless function locally. The regular Vite server previews the UI but does not execute `/api/coach`.

# LOOM v2 — OpenRouter Free Edition

Ye version local Ollama ke bajay **OpenRouter** use karta hai.
Render par deploy karne ke liye Ollama install/run karne ki zaroorat nahi hai.

## 1. OpenRouter Free API Key

1. https://openrouter.ai/ par account/login karo.
2. API key page kholo: https://openrouter.ai/keys
3. **Create API Key** karo.
4. Key copy karke safe rakho.

Example:
`sk-or-v1-xxxxxxxxxxxxxxxx`

API key ko GitHub/code mein mat daalo.

## 2. Local Run

Node.js 18+ install karo:
https://nodejs.org/

Project folder mein:

```bash
npm install
```

`.env` banao:

Windows:
```bash
copy .env.example .env
```

Mac/Linux:
```bash
cp .env.example .env
```

`.env` mein:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx
OPENROUTER_MODEL=openrouter/free
ADMIN_KEY=apna-secret-password
```

Run:

```bash
npm start
```

Browser:
`http://localhost:3000`

## 3. GitHub

Empty GitHub repository banao, phir:

```bash
git init
git add .
git commit -m "LOOM OpenRouter"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/loom-v2.git
git push -u origin main
```

`.env` GitHub par push mat karo.

## 4. Render Free Deploy

1. https://render.com/ par login karo.
2. **New + → Web Service**.
3. GitHub repository select karo.
4. Settings:

- Name: `loom-v2`
- Region: Singapore
- Branch: `main`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Plan: Free

### Environment Variables

Render → Environment mein:

```text
OPENROUTER_API_KEY = apni actual OpenRouter key
OPENROUTER_MODEL = openrouter/free
ADMIN_KEY = apna secret password
```

Optional fact-check search:

```text
TAVILY_API_KEY = apni Tavily key
```

5. **Create Web Service** click karo.
6. Deploy complete hone ke baad Render URL open karo.

## 5. Admin

```text
https://YOUR-RENDER-URL/admin.html?key=YOUR_ADMIN_KEY
```

## 6. GitHub Update

```bash
git add .
git commit -m "update"
git push
```

Render automatically redeploy karega.

## 7. Troubleshooting

### AI reply nahi aa raha
Render → Environment mein `OPENROUTER_API_KEY` check karo.
Render → Logs mein exact error dekho.

### Free model unavailable/rate limit
`openrouter/free` free models ko route karta hai. Free model availability/rate limits provider ke hisaab se badal sakti hain.

### Fact-check UNVERIFIED
Agar `TAVILY_API_KEY` configured nahi hai, live web sources available nahi honge aur app claim ko UNVERIFIED rakh sakta hai.

## Important

Is version mein Ollama ki zaroorat nahi hai. `OLLAMA_URL`, `OLLAMA_MODEL`, `ollama serve`, aur `ollama pull` steps use mat karo.

Project: Node.js + Express + SQLite + OpenRouter API

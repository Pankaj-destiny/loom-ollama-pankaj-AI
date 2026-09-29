const express = require('express');
const router = express.Router();
const { spendCredits, logFactcheck } = require('../db');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const FACTCHECK_COST = 3;

async function searchSources(query) {
  if (!TAVILY_KEY) return null;
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': process.env.APP_NAME || 'Loom V2'
      },
    body: JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: 'advanced', max_results: 6, include_answer: false })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.results || []).map(r => ({ title: r.title, url: r.url, content: r.content }));
}

router.post('/factcheck', async (req, res) => {
  const { claim, lang } = req.body;
  if (!claim || !claim.trim()) return res.status(400).json({ error: 'claim text is required' });

  const userId = req.userId;
  if (!spendCredits(userId, FACTCHECK_COST, 'factcheck')) {
    return res.status(402).json({ error: 'Not enough credits.' });
  }

  try {
    const sources = await searchSources(claim);

    let systemPrompt = `You are a strict news fact-checking agent. Determine whether a claim is supported, contradicted,
or unverifiable based STRICTLY on the source material provided.
RULES:
1. Never state something as true unless directly supported by the sources given.
2. If sources conflict, say so explicitly.
3. If no reliable sources are provided, say the claim could not be verified — do NOT guess.
4. Cite which source supports each point.
5. Give a clear verdict: TRUE, FALSE, PARTIALLY TRUE, or UNVERIFIED.
6. Language: ${lang === 'hindi' ? 'Hindi (Devanagari)' : lang === 'marathi' ? 'Marathi (Devanagari)' : lang === 'hinglish' ? 'Hinglish' : lang === 'english' ? 'English' : "match the user's language"}.`;

    let userContent;
    if (sources && sources.length > 0) {
      const sourceText = sources.map((s, i) => `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\nContent: ${s.content}`).join('\n\n');
      userContent = `Claim to verify: "${claim}"\n\nSources found:\n${sourceText}\n\nGive your verdict and cite sources.`;
    } else {
      systemPrompt += `\n\nNOTE: No live web search is configured (TAVILY_API_KEY missing). You MUST say this claim is UNVERIFIED because no sources are available — do not verify from memory, since a local model's training data can be outdated or wrong.`;
      userContent = `Claim to verify: "${claim}"\n\n(No live sources were available.)`;
    }

    if (!API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY is missing.' });

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('OpenRouter error:', errText);
      return res.status(502).json({ error: 'OpenRouter API error. Check OPENROUTER_API_KEY and Render Logs.' });
    }

    const data = await response.json();
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '(no response)';

    const verdictMatch = reply.match(/\b(TRUE|FALSE|PARTIALLY TRUE|UNVERIFIED)\b/i);
    const verdict = verdictMatch ? verdictMatch[0].toUpperCase() : 'UNVERIFIED';

    logFactcheck(userId, claim, verdict, sources || []);
    res.json({ reply, verdict, sources: sources || [], liveSearchUsed: !!sources });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reach OpenRouter. Check your internet connection and OPENROUTER_API_KEY.' });
  }
});

module.exports = router;

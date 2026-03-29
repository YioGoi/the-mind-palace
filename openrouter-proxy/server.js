require('dotenv').config();
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;

app.post('/api/ai', async (req, res) => {
  console.log('[Proxy] Incoming request:', JSON.stringify(req.body));
  try {
    if (!OPENAI_KEY) {
      res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
      return;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    console.log('[Proxy] OpenAI response status:', response.status);
    console.log('[Proxy] OpenAI response body:', text);
    res.status(response.status).send(text);
  } catch (err) {
    console.error('[Proxy] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`[Proxy] Listening on port ${port}`));

import express from 'express';
import { db, embed, llm, MODEL, LLM_MODEL } from './infra.js';
import { retrieve, buildContext, generate, validateCitations } from './rag.js';

const app = express();
app.use(express.json());

app.get('/ask', async (req, res) => {
  const q = req.query.q;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Question query parameter (q) cannot be blank.' });
  }

  try {
    const rows = await retrieve(q.trim(), { embed, db, model: MODEL });
    const context = buildContext(rows);
    const answer = await generate(q.trim(), context, { llm, model: LLM_MODEL });
    const sources = validateCitations(answer, context);

    return res.status(200).json({ answer, sources });
  } catch (err) {
    if (
      err.message === 'Empty generation response' ||
      err.message === 'Invalid or missing generated citation'
    ) {
      return res.status(502).json({ error: err.message });
    }
    console.error('Ask handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Grounded Ask service running on http://localhost:${PORT}`);
  });
}

export default app;

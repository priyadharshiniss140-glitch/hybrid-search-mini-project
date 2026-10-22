import express from 'express';
import { db } from '../infra.js';
import { embed } from '../embed.js';

export const searchRouter = express.Router();

export function resolveSearchColumn(version = process.env.EMBEDDING_VERSION) {
  // Fixed allowlist: never accept a column name from a request.
  return version === 'v2' ? 'embedding_v2' : 'embedding';
}

searchRouter.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Query q is required' });
  }

  const start = Date.now();
  try {
    const column = resolveSearchColumn();
    const model = process.env.EMBEDDING_MODEL || (process.env.EMBEDDING_VERSION === 'v2' ? 'text-embedding-3-small' : 'text-embedding-ada-002');

    const vector = await embed(q.trim(), { model });
    const sql = `
      SELECT id, text, 1 - (${column} <=> $1::vector) AS score
      FROM posts_embeddings
      WHERE ${column} IS NOT NULL
      ORDER BY ${column} <=> $1::vector
      LIMIT 5
    `;

    const result = await db.query(sql, [JSON.stringify(vector)]);
    const latencyMs = Date.now() - start;

    return res.json({ results: result.rows, latencyMs });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: err.message });
  }
});

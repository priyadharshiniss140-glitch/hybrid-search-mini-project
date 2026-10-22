import { createHash } from 'crypto';
import { db, redis, llm } from './infra.js';

/**
 * Embeds text using a model-specific Redis cache and logs an estimated workload cost.
 * @param {string} text
 * @param {{ model?: string, dbClient?: any, redisClient?: any, llmClient?: any }} [opts]
 * @returns {Promise<number[]>}
 */
export async function embed(text, opts = {}) {
  const model = opts.model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const dbClient = opts.dbClient || db;
  const redisClient = opts.redisClient || redis;
  const llmClient = opts.llmClient || llm;

  const key = `emb:${model}:` + createHash('sha256').update(text).digest('hex');

  let vector = null;

  try {
    const cached = await redisClient.get(key);
    if (cached) {
      vector = JSON.parse(cached);
    }
  } catch (err) {
    // A cache failure must not block embedding.
  }

  if (!vector) {
    const res = await llmClient.embeddings.create({
      model,
      input: text,
    });
    vector = res.data[0].embedding;

    try {
      await redisClient.set(key, JSON.stringify(vector));
    } catch (err) {
      // A cache write failure must not block embedding.
    }
  }

  // Log every helper call (including cache hits); logging is deliberately non-fatal.
  await logEmbeddingCost(dbClient, model, text);
  return vector;
}

export async function logEmbeddingCost(dbClient, model, text) {
  const tokens = Math.ceil(text.length / 4);
  const estimatedCost = (tokens / 1_000_000) * 0.02;

  try {
    await dbClient.query(
      `INSERT INTO embedding_costs (model, text_length, estimated_tokens, estimated_cost)
       VALUES ($1, $2, $3, $4)`,
      [model, text.length, tokens, estimatedCost]
    );
  } catch (err) {
    // Cost logging is best-effort: never stop backfill or search because logging failed.
  }
}

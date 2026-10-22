import 'dotenv/config';
import pg from 'pg';
import OpenAI from 'openai';
import Redis from 'ioredis';
import { createHash } from 'crypto';

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/querynest',
});

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { lazyConnect: true })
  : new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379, lazyConnect: true });

export const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
});

export const MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
export const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

export async function embed(text) {
  const key = 'emb:' + createHash('sha256').update(text).digest('hex');

  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    // Non-fatal cache lookup failure
  }

  const res = await llm.embeddings.create({
    model: MODEL,
    input: text,
  });
  const vector = res.data[0].embedding;

  try {
    await redis.set(key, JSON.stringify(vector));
  } catch (err) {
    // Non-fatal cache write failure
  }

  return vector;
}

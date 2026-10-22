import 'dotenv/config';
import pg from 'pg';
import OpenAI from 'openai';
import Redis from 'ioredis';

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/querynest',
});

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { lazyConnect: true })
  : new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379, lazyConnect: true });

export const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
});

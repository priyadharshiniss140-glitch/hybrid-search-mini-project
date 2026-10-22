-- src/migrate.sql
-- Run this with your PostgreSQL client before starting the backfill.

-- 1. Add embedding_v2 column to posts_embeddings (1536 dimensions for text-embedding-3-small)
ALTER TABLE posts_embeddings
  ADD COLUMN IF NOT EXISTS embedding_v2 vector(1536);

-- 2. Create job_progress table to track resumable checkpoints
CREATE TABLE IF NOT EXISTS job_progress (
  job_name text PRIMARY KEY,
  last_id integer NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 3. Create embedding_costs table to log estimated workloads
CREATE TABLE IF NOT EXISTS embedding_costs (
  id serial PRIMARY KEY,
  model text NOT NULL,
  text_length integer NOT NULL,
  estimated_tokens integer NOT NULL,
  estimated_cost numeric(10, 6) NOT NULL,
  created_at timestamptz DEFAULT now()
);

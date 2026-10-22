# Re-embedding Pipeline Mini Project

This project migrates post embeddings from the old `text-embedding-ada-002` model in `embedding` to `text-embedding-3-small` in `embedding_v2`, without removing the old vectors during the backfill.

## Setup

```bash
npm install
npm test
# Run src/migrate.sql using your PostgreSQL client before migration.
node verify.js
EMBEDDING_MODEL=text-embedding-3-small npm run backfill
```

For old search, restart the server with `EMBEDDING_VERSION=v1 EMBEDDING_MODEL=text-embedding-ada-002`. For new search, restart it with `EMBEDDING_VERSION=v2 EMBEDDING_MODEL=text-embedding-3-small`. In Windows PowerShell, set the variables with `$env:EMBEDDING_VERSION="v2"` and `$env:EMBEDDING_MODEL="text-embedding-3-small"` before starting the server.

## Offline test output

The tests use mock database clients to check checkpoint reads/writes and batch query shape, verify the search-column allowlist, and validate cost math and non-fatal logging. They do **not** prove that PostgreSQL/pgvector, Redis, the live OpenAI embedding calls, the populated LU3 corpus, or an interrupted live backfill work end to end.

```text
> reembedding-pipeline-mini-project@1.0.0 test
> node --test --test-reporter=spec test/pipeline.test.js

✔ read checkpoint returns 0 when no row exists, or last_id when present
✔ fetch batch queries id > lastId, embedding_v2 IS NULL, ordered by id with limit 50
✔ search route selects embedding_v2 for v2 and embedding for v1
✔ cost logger calculates tokens and cost, and ignores db error

ℹ tests 4
ℹ pass 4
ℹ fail 0
```

This is the expected offline output for the four supplied test cases; run `npm test` in your clone and replace this block with the exact output if your Node version formats it differently.

## Backfill checkpoint evidence

Live evidence is pending because this environment does not have the populated LU3 PostgreSQL/pgvector table, Redis, or an OpenAI API key. Do not fill in fabricated counts. After running `node verify.js`, record the real `job_progress` checkpoint and the count of rows with `embedding_v2` populated at each stage.

| Stage | job_progress.last_id | embedding_v2 filled rows |
|---|---:|---:|
| Before stopping the first run | Pending live run | Pending live run |
| After restarting the backfill | Pending live run | Pending live run |
| After completion | Pending live run | Pending live run |

The restart should read the stored checkpoint rather than start from zero. If the process stops after one or more vector writes but before saving the batch checkpoint, those writes may be attempted again only for rows that are still missing vectors; a provider call that happened before a crash but was not committed can also be repeated.

## Five live search questions

The five questions are defined in `src/questions.js`. Run `npm run questions` once with each configuration and copy the actual returned IDs, scores, snippets, status, and latency into the tables below. Results are corpus-specific and aren't represented as completed here.

### Old search

Configuration: `EMBEDDING_VERSION=v1`, `EMBEDDING_MODEL=text-embedding-ada-002`.

| Question | Actual live output |
|---|---|
| how does vector similarity search work in postgres | Pending live run |
| how to cache embeddings in redis with sha256 | Pending live run |
| recommended batch size for openai embeddings | Pending live run |
| how to handle idempotent upserts on conflict | Pending live run |
| what is the difference between cosine distance and dot product | Pending live run |

### New search

Configuration: `EMBEDDING_VERSION=v2`, `EMBEDDING_MODEL=text-embedding-3-small`.

| Question | Actual live output |
|---|---|
| how does vector similarity search work in postgres | Pending live run |
| how to cache embeddings in redis with sha256 | Pending live run |
| recommended batch size for openai embeddings | Pending live run |
| how to handle idempotent upserts on conflict | Pending live run |
| what is the difference between cosine distance and dot product | Pending live run |

## Estimated workload value

**Estimated workload value: pending live `embedding_costs` query.** Once the backfill and both search passes are complete, run:

```sql
SELECT
  model,
  count(*) AS logged_calls,
  coalesce(sum(estimated_tokens), 0) AS estimated_tokens,
  coalesce(sum(estimated_cost), 0) AS estimated_workload_value
FROM embedding_costs
GROUP BY model
ORDER BY model;
```

The estimate uses `ceil(text.length / 4)` tokens and the fixed `$0.02 / 1,000,000 tokens` rate specified in the assignment. It is an estimated workload value, not the OpenAI invoice: character-based token estimates differ from provider tokenization, a cache hit still creates an estimate in this implementation, and the database's `numeric(10, 6)` cost column may round very small per-call values to zero.

## Interpretation

The restart resumes after the saved `job_progress.last_id` because the backfill records a checkpoint after it successfully writes the vectors in a batch, rather than assuming it should always begin at the first row. The search model and column need to switch together because a question vector created by one embedding model is not compatible with vectors from a different model's representation. Keeping both columns until the new one is fully populated allows a controlled comparison and rollback without deleting the old embeddings. The cost table estimates workload from character length and a fixed rate, so its total is useful for rough comparisons but is not an exact provider bill. Live checkpoint counts and search output must be captured from the configured LU3 database to demonstrate the migration end to end.

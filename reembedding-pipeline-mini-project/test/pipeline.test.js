import test from 'node:test';
import assert from 'node:assert/strict';
import { getCheckpoint, fetchBatch, saveCheckpoint } from '../src/backfill.js';
import { resolveSearchColumn } from '../src/routes/search.js';
import { logEmbeddingCost } from '../src/embed.js';

test('read checkpoint returns 0 when no row exists, or last_id when present', async () => {
  const emptyDb = {
    query: async (sql, params) => {
      assert.ok(sql.includes('FROM job_progress'));
      assert.strictEqual(params[0], 'reembedding_backfill');
      return { rows: [] };
    },
  };

  const initialCheckpoint = await getCheckpoint(emptyDb, 'reembedding_backfill');
  assert.strictEqual(initialCheckpoint, 0);

  const populatedDb = {
    query: async () => ({ rows: [{ last_id: 150 }] }),
  };

  const savedCheckpoint = await getCheckpoint(populatedDb, 'reembedding_backfill');
  assert.strictEqual(savedCheckpoint, 150);
});

test('fetch batch queries id > lastId, embedding_v2 IS NULL, ordered by id with limit 50', async () => {
  let executedSql = '';
  let passedParams = [];

  const mockDb = {
    query: async (sql, params) => {
      executedSql = sql;
      passedParams = params;
      return { rows: [{ id: 101, text: 'Sample post text 101' }, { id: 102, text: 'Sample post text 102' }] };
    },
  };

  const rows = await fetchBatch(mockDb, 100, 50);
  assert.ok(executedSql.includes('id > $1'));
  assert.ok(executedSql.includes('embedding_v2 IS NULL'));
  assert.ok(executedSql.includes('ORDER BY id'));
  assert.ok(executedSql.includes('LIMIT $2') || executedSql.includes('LIMIT 50'));
  assert.strictEqual(passedParams[0], 100);
  assert.strictEqual(rows.length, 2);
});

test('search route selects embedding_v2 for v2 and embedding for v1', () => {
  assert.strictEqual(resolveSearchColumn('v2'), 'embedding_v2');
  assert.strictEqual(resolveSearchColumn('v1'), 'embedding');
  assert.strictEqual(resolveSearchColumn(undefined), 'embedding');
});

test('cost logger calculates tokens and cost, and ignores db error', async () => {
  let loggedValues = null;
  const mockDb = {
    query: async (sql, params) => {
      assert.ok(sql.includes('INSERT INTO embedding_costs'));
      loggedValues = params;
      return { rowCount: 1 };
    },
  };

  const text = 'This is a test sentence for embedding cost calculation.';
  const expectedTokens = Math.ceil(text.length / 4);
  const expectedCost = (expectedTokens / 1_000_000) * 0.02;

  await logEmbeddingCost(mockDb, 'text-embedding-3-small', text);
  assert.ok(loggedValues !== null);
  assert.strictEqual(loggedValues[0], 'text-embedding-3-small');
  assert.strictEqual(loggedValues[1], text.length);
  assert.strictEqual(loggedValues[2], expectedTokens);
  assert.strictEqual(loggedValues[3], expectedCost);

  const failingDb = { query: async () => { throw new Error('Database connection failed'); } };
  await assert.doesNotReject(async () => {
    await logEmbeddingCost(failingDb, 'text-embedding-3-small', text);
  });
});

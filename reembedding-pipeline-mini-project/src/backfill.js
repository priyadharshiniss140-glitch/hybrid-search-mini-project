import { db } from './infra.js';
import { embed } from './embed.js';

export async function getCheckpoint(dbClient, jobName = 'reembedding_backfill') {
  const result = await dbClient.query(
    'SELECT last_id FROM job_progress WHERE job_name = $1',
    [jobName]
  );
  return result.rows.length ? Number(result.rows[0].last_id) : 0;
}

export async function fetchBatch(dbClient, lastId, batchSize = 50) {
  const result = await dbClient.query(
    `SELECT id, text
     FROM posts_embeddings
     WHERE id > $1 AND embedding_v2 IS NULL
     ORDER BY id
     LIMIT $2`,
    [lastId, batchSize]
  );
  return result.rows;
}

export async function saveCheckpoint(dbClient, jobName, lastId) {
  await dbClient.query(
    `INSERT INTO job_progress (job_name, last_id, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (job_name)
     DO UPDATE SET last_id = EXCLUDED.last_id, updated_at = now()`,
    [jobName, lastId]
  );
}

export function pause(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBackfill(dbClient = db) {
  const jobName = 'reembedding_backfill';
  let lastId = await getCheckpoint(dbClient, jobName);
  console.log(`Starting from id: ${lastId}`);

  while (true) {
    const rows = await fetchBatch(dbClient, lastId, 50);
    if (!rows || rows.length === 0) {
      console.log('Backfill complete.');
      break;
    }

    // Write every vector first. Save the checkpoint only after the whole batch succeeds.
    for (const row of rows) {
      const vector = await embed(row.text, {
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        dbClient,
      });
      await dbClient.query(
        'UPDATE posts_embeddings SET embedding_v2 = $1::vector WHERE id = $2',
        [JSON.stringify(vector), row.id]
      );
    }

    const batchLastId = rows[rows.length - 1].id;
    lastId = batchLastId;

    await saveCheckpoint(dbClient, jobName, lastId);
    console.log(`Batch done. Last id: ${lastId}`);

    await pause(200);
  }
}

if (process.argv[1] && process.argv[1].endsWith('backfill.js')) {
  runBackfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Backfill failed:', err);
      process.exit(1);
    });
}

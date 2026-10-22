// verify.js
// Checks job_progress and count of saved embedding_v2 rows in PostgreSQL.

import { db } from './src/infra.js';

async function verify() {
  console.log('--- Database Verification Check ---');
  try {
    const progressRes = await db.query(
      "SELECT job_name, last_id, updated_at FROM job_progress WHERE job_name = 'reembedding_backfill'"
    );

    if (progressRes.rows.length === 0) {
      console.log('job_progress: No checkpoint recorded yet.');
    } else {
      const row = progressRes.rows[0];
      console.log(`job_progress row: job_name="${row.job_name}", last_id=${row.last_id}, updated_at=${row.updated_at}`);
    }

    const countRes = await db.query(
      'SELECT count(*) AS total, count(embedding_v2) AS v2_filled FROM posts_embeddings'
    );
    const { total, v2_filled } = countRes.rows[0];
    console.log(`posts_embeddings: total_rows=${total}, embedding_v2_filled=${v2_filled}`);

    const costRes = await db.query(
      'SELECT count(*) AS calls, sum(estimated_tokens) AS total_tokens, sum(estimated_cost) AS total_cost FROM embedding_costs'
    );
    const costRow = costRes.rows[0];
    console.log(`embedding_costs: total_calls=${costRow.calls}, total_tokens=${costRow.total_tokens || 0}, total_cost=$${Number(costRow.total_cost || 0).toFixed(6)}`);
  } catch (err) {
    console.error('Verification query failed:', err.message);
  } finally {
    await db.end();
  }
}

verify();

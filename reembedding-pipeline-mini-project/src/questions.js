// Runs 5 live search queries against GET /search?q=... and reports results with latency.

export const queries = [
  'how does vector similarity search work in postgres',
  'how to cache embeddings in redis with sha256',
  'recommended batch size for openai embeddings',
  'how to handle idempotent upserts on conflict',
  'what is the difference between cosine distance and dot product',
];

export async function runQuestions() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const version = process.env.EMBEDDING_VERSION || 'v1';
  const model = process.env.EMBEDDING_MODEL || (version === 'v2' ? 'text-embedding-3-small' : 'text-embedding-ada-002');

  console.log(`\n========================================`);
  console.log(`Running Search Evaluation`);
  console.log(`EMBEDDING_VERSION: ${version}`);
  console.log(`EMBEDDING_MODEL:   ${model}`);
  console.log(`Base URL:          ${baseUrl}`);
  console.log(`========================================\n`);

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`Query ${i + 1}: "${q}"`);
    try {
      const res = await fetch(`${baseUrl}/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      console.log(`Status: ${res.status} | Latency: ${data.latencyMs}ms`);
      if (data.results && data.results.length > 0) {
        data.results.slice(0, 3).forEach((r, idx) => {
          console.log(`  [${idx + 1}] ID: ${r.id} | Score: ${Number(r.score).toFixed(4)} | Text: "${r.text.slice(0, 70)}..."`);
        });
      } else {
        console.log(`  No results returned.`);
      }
      console.log('');
    } catch (err) {
      console.error(`  Query failed:`, err.message);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('questions.js')) {
  runQuestions();
}

// questions.js
// Sends 5 sample questions to the GET /ask endpoint.

export const questions = [
  {
    id: 1,
    type: 'answerable',
    question: 'How is cosine distance calculated for vector similarity in pgvector?',
  },
  {
    id: 2,
    type: 'answerable',
    question: 'Why should text embeddings be cached in Redis with a SHA-256 hash?',
  },
  {
    id: 3,
    type: 'answerable',
    question: 'What batch size is recommended when embedding posts for pgvector storage?',
  },
  {
    id: 4,
    type: 'answerable',
    question: 'How do you perform an idempotent upsert when saving post embeddings in PostgreSQL?',
  },
  {
    id: 5,
    type: 'unanswerable',
    question: 'What is the recipe for baking chocolate chip cookies in an air fryer?',
  },
];

export async function runQuestions() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  console.log(`Sending 5 evaluation questions to ${baseUrl}/ask...\n`);

  for (const item of questions) {
    console.log(`----------------------------------------`);
    console.log(`Q${item.id} [${item.type.toUpperCase()}]: ${item.question}`);
    try {
      const res = await fetch(`${baseUrl}/ask?q=${encodeURIComponent(item.question)}`);
      const body = await res.json();
      console.log(`Status: ${res.status}`);
      console.log(`Answer: ${body.answer}`);
      console.log(`Sources: ${JSON.stringify(body.sources || [])}\n`);
    } catch (err) {
      console.error(`Error querying Q${item.id}:`, err.message);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('questions.js')) {
  runQuestions();
}

# Grounded Ask Mini Project

A grounded Q&A endpoint demonstrating evidence retrieval with PostgreSQL pgvector, bounded context assembly, evidence-only generation, and citation verification.

## Setup and commands

```bash
npm install
npm test
npm start
# In another terminal, once the server and services are ready:
npm run questions
```

The four unit tests use stand-ins for the database, embedder, and language model. They do not require PostgreSQL, Redis, or an API key. To run the live endpoint, configure the LU3 `posts_embeddings` table, PostgreSQL with pgvector, Redis, and `OPENAI_API_KEY` in a local `.env` file. Never commit `.env` or real credentials.

## Implemented helpers

- `retrieve` embeds the query and runs a parameterized cosine-distance query against `posts_embeddings`, filtering by `model_version` and returning no more than five `{ id, text }` rows.
- `buildContext` validates positive integer IDs and string passage text, preserves each ID as `post_id`, and caps the context at five passages, 1,200 characters per passage, and 6,000 characters total.
- `generate` sends the question and labelled passages as JSON, instructs the model to use only the evidence and treat passage content as untrusted, sets `max_completion_tokens` to 500, and rejects an empty response.
- `validateCitations` allows the exact abstention without sources, deduplicates valid cited IDs, and rejects missing or unknown citations.

## Offline test output

Command: `npm test`

```text
> grounded-ask-mini-project@1.0.0 test
> node --test test/rag.test.js

TAP version 13
# Subtest: retrieval passes vector and model as SQL parameters
ok 1 - retrieval passes vector and model as SQL parameters
# Subtest: context is bounded and preserves IDs
ok 2 - context is bounded and preserves IDs
# Subtest: generation sends evidence contract and labelled text
ok 3 - generation sends evidence contract and labelled text
# Subtest: citations are deduplicated, cited only, and constrained to context
ok 4 - citations are deduplicated, cited only, and constrained to context
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

## Five live evaluation questions and responses

**Live results have not been recorded in this build.** Live requests require the learner's populated LU3 database, working PostgreSQL/pgvector and Redis services, and a valid OpenAI key. The items below are the five questions in `questions.js`; run `npm run questions` against that environment and replace each pending response with its actual status, answer, and `sources` array. No live output is invented here.

1. **Answerable —** How is cosine distance calculated for vector similarity in pgvector?  
   **Response:** Pending live run.
2. **Answerable —** Why should text embeddings be cached in Redis with a SHA-256 hash?  
   **Response:** Pending live run.
3. **Answerable —** What batch size is recommended when embedding posts for pgvector storage?  
   **Response:** Pending live run.
4. **Answerable —** How do you perform an idempotent upsert when saving post embeddings in PostgreSQL?  
   **Response:** Pending live run.
5. **Unanswerable —** What is the recipe for baking chocolate chip cookies in an air fryer?  
   **Expected behavior (not a recorded live response):** `{ "answer": "I cannot answer this from the supplied passages.", "sources": [] }` when the retrieved passages do not answer it.

## Interpretation

The offline tests confirm that the retrieval query passes the embedding vector and model version as SQL parameters, while the context builder keeps source IDs attached to bounded passage text. In a live run, I will identify the supported answer by checking the precise source sentence in its returned passage, rather than treating the citation itself as proof. If the corpus does not contain evidence for the cookie question, the correct behavior is to abstain instead of guessing, because an unsupported answer can mislead the user. A 6,000-character limit is not a token budget because tokenization varies with language, punctuation, and content, so the same number of characters can consume different numbers of model tokens. A citation ID only shows that the model named a passage supplied in the prompt; it does not show that the passage entails or verifies the claim.

## Environment and limitations

The answer is only as good as the retrieved evidence and the excerpt included in the prompt. A 1,200-character excerpt can omit relevant information from a longer source post, which can cause abstention even when the full post contains an answer. Citation validation verifies ID membership, not semantic entailment or factual truth. The helper tests are offline checks; they do not measure retrieval quality or establish how the live corpus will answer the five questions.

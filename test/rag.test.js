import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieve, buildContext, generate, validateCitations, ABSTAIN } from '../src/rag.js';

test('retrieval passes vector and model as SQL parameters', async () => {
  let executedSql = '';
  let passedParams = [];

  const mockDb = {
    query: async (sql, params) => {
      executedSql = sql;
      passedParams = params;
      return {
        rows: [
          { id: 101, text: 'Postgres vector search uses cosine distance' },
          { id: 102, text: 'HNSW indexing speeds up vector similarity search' },
        ],
      };
    },
  };

  const mockEmbed = async (text) => {
    assert.strictEqual(text, 'How does vector search work?');
    return [0.12, 0.34, 0.56];
  };

  const model = 'text-embedding-3-small';
  const result = await retrieve('How does vector search work?', {
    embed: mockEmbed,
    db: mockDb,
    model,
  });

  assert.ok(executedSql.includes('posts_embeddings'), 'SQL should query posts_embeddings');
  assert.ok(executedSql.includes('WHERE model_version = $2'), 'SQL should filter by model_version = $2');
  assert.ok(executedSql.includes('ORDER BY embedding <=> $1::vector'), 'SQL should order by cosine distance');
  assert.ok(executedSql.includes('LIMIT 5'), 'SQL should limit to 5');
  assert.strictEqual(passedParams.length, 2, 'Should pass 2 parameters');
  assert.strictEqual(passedParams[0], JSON.stringify([0.12, 0.34, 0.56]), 'First param should be vector');
  assert.strictEqual(passedParams[1], 'text-embedding-3-small', 'Second param should be model');
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].id, 101);
});

test('context is bounded and preserves IDs', () => {
  assert.deepStrictEqual(buildContext([]), []);
  assert.deepStrictEqual(buildContext(null), []);

  assert.throws(() => buildContext([{ id: 'not-an-id', text: 'valid' }]), /Bad ID/);
  assert.throws(() => buildContext([{ id: null, text: 'valid' }]), /Bad ID/);

  assert.throws(() => buildContext([{ id: 1, text: 123 }]), /Invalid text/);
  assert.throws(() => buildContext([{ id: 1, text: null }]), /Invalid text/);

  const rows = [
    { id: 1, text: 'A'.repeat(2000) },
    { id: 2, text: 'B'.repeat(1500) },
    { id: 3, text: 'C'.repeat(800) },
    { id: 4, text: 'D'.repeat(1200) },
    { id: 5, text: 'E'.repeat(1200) },
    { id: 6, text: 'F'.repeat(1200) },
  ];

  const context = buildContext(rows);
  assert.strictEqual(context.length, 5, 'Must keep at most 5 passages');
  assert.strictEqual(context[0].post_id, 1);
  assert.strictEqual(context[0].text.length, 1200, 'Must cap each passage at 1200 chars');
  assert.strictEqual(context[1].text.length, 1200);
  assert.strictEqual(context[2].text.length, 800);
  assert.strictEqual(context[3].text.length, 1200);
  assert.strictEqual(context[4].text.length, 1200);

  const totalChars = context.reduce((acc, c) => acc + c.text.length, 0);
  assert.ok(totalChars <= 6000, 'Total chars must not exceed 6000');
});

test('generation sends evidence contract and labelled text', async () => {
  let callArgs = null;

  const mockLlm = {
    chat: {
      completions: {
        create: async (args) => {
          callArgs = args;
          return {
            choices: [
              {
                message: {
                  content: 'Postgres pgvector supports cosine distance queries [101].',
                },
              },
            ],
          };
        },
      },
    },
  };

  const context = [{ post_id: 101, text: 'Postgres pgvector enables vector similarity search.' }];
  const answer = await generate('What is pgvector?', context, {
    llm: mockLlm,
    model: 'gpt-4o-mini',
  });

  assert.strictEqual(answer, 'Postgres pgvector supports cosine distance queries [101].');
  assert.strictEqual(callArgs.model, 'gpt-4o-mini');
  assert.strictEqual(callArgs.max_completion_tokens, 500);

  const sysMsg = callArgs.messages.find((m) => m.role === 'system');
  assert.ok(sysMsg, 'Must include system message');
  assert.ok(sysMsg.content.includes(ABSTAIN), 'System message must specify exact abstention');
  assert.ok(sysMsg.content.includes('untrusted data') || sysMsg.content.includes('only'), 'Evidence contract rules');

  const userMsg = callArgs.messages.find((m) => m.role === 'user');
  assert.ok(userMsg, 'Must include user message');
  const parsedUser = JSON.parse(userMsg.content);
  assert.strictEqual(parsedUser.question, 'What is pgvector?');
  assert.deepStrictEqual(parsedUser.passages, context);

  const emptyLlm = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: '   ' }],
        }),
      },
    },
  };

  await assert.rejects(
    async () => generate('Empty test', context, { llm: emptyLlm, model: 'gpt-4o-mini' }),
    { message: 'Empty generation response' }
  );
});

test('citations are deduplicated, cited only, and constrained to context', () => {
  const context = [
    { post_id: 10, text: 'First passage' },
    { post_id: 20, text: 'Second passage' },
    { post_id: 30, text: 'Third passage' },
  ];

  assert.deepStrictEqual(validateCitations(ABSTAIN, context), []);

  const validAnswer = 'According to [10] and also noted in [20] as well as [10].';
  assert.deepStrictEqual(validateCitations(validAnswer, context), [10, 20]);

  const invalidIdAnswer = 'This cites an unknown source [999].';
  assert.throws(
    () => validateCitations(invalidIdAnswer, context),
    { message: 'Invalid or missing generated citation' }
  );

  const noCitationAnswer = 'This has no citation at all.';
  assert.throws(
    () => validateCitations(noCitationAnswer, context),
    { message: 'Invalid or missing generated citation' }
  );
});

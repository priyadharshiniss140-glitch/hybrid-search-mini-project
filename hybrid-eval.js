// Hybrid Search (RRF) mini project
// Fuse keyword + semantic rankings and compare MRR and Recall@10.

const fs = require('fs');

function loadTestSet(path) {
  const lines = fs.readFileSync(path, 'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map((line) => {
    const comma = line.indexOf(',');
    const query = line.slice(0, comma);
    const ids = line.slice(comma + 1);
    return { query, correctIds: ids.split(';').map(Number) };
  });
}

const testSet = loadTestSet('test-set.csv');
const results = JSON.parse(fs.readFileSync('search-results.json', 'utf8'));

// TODO 1: Reciprocal Rank Fusion.
// A document gets 1 / (k + rank) from each list where it appears; ranks are 1-based.
function rrfFuse(keywordIds, semanticIds, k = 60) {
  const scores = new Map();
  const firstSeen = new Map();
  let order = 0;

  for (const ids of [keywordIds, semanticIds]) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!scores.has(id)) {
        scores.set(id, 0);
        firstSeen.set(id, order++);
      }
      scores.set(id, scores.get(id) + 1 / (k + i + 1));
    }
  }

  // Stable tie-break: keep the first encounter order for equal RRF scores.
  return [...scores.keys()].sort((a, b) =>
    (scores.get(b) - scores.get(a)) || (firstSeen.get(a) - firstSeen.get(b)),
  );
}

// TODO 2: 1-based rank of the first correct id, or null if absent.
// The cutoff limits the search depth; Infinity checks the complete fused ranking.
function rankOf(ids, correctIds, cutoff = Infinity) {
  const correct = new Set(correctIds.map(Number));
  const end = Math.min(ids.length, cutoff);
  for (let i = 0; i < end; i++) {
    if (correct.has(Number(ids[i]))) return i + 1;
  }
  return null;
}

const reciprocalRank = (ids, correctIds) => {
  const rank = rankOf(ids, correctIds);
  return rank === null ? 0 : 1 / rank;
};
const mean = (values) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const systems = ['keyword', 'semantic', 'hybrid'];
const reciprocalRanks = { keyword: [], semantic: [], hybrid: [] };
const hits = { keyword: 0, semantic: 0, hybrid: 0 };
const rows = [];

for (const { query, correctIds } of testSet) {
  const queryResults = results[query];
  if (
    !queryResults ||
    !Array.isArray(queryResults.keyword) ||
    !Array.isArray(queryResults.semantic)
  ) {
    throw new Error(`Missing ranked search results for query: ${query}`);
  }

  const lists = {
    keyword: queryResults.keyword,
    semantic: queryResults.semantic,
    hybrid: rrfFuse(queryResults.keyword, queryResults.semantic, 60),
  };

  // TODO 3: collect reciprocal ranks and Recall@10 hits for all three systems.
  for (const system of systems) {
    reciprocalRanks[system].push(reciprocalRank(lists[system], correctIds));
    if (rankOf(lists[system], correctIds, 10) !== null) hits[system]++;
  }

  rows.push({
    query,
    keyword: rankOf(lists.keyword, correctIds, 20),
    semantic: rankOf(lists.semantic, correctIds, 20),
    hybrid: rankOf(lists.hybrid, correctIds, 20),
  });
}

const queryCount = testSet.length;
const summary = {};
for (const system of systems) {
  summary[system] = {
    mrr: mean(reciprocalRanks[system]),
    recallAt10: hits[system] / queryCount,
  };
}

// TODO 4: print the per-query ranking table and the metric summary row.
const displayRank = (rank) => rank === null ? 'miss' : String(rank);
console.log('| Query | Keyword rank | Semantic rank | Hybrid rank |');
console.log('|---|---|---|---|');
for (const row of rows) {
  console.log(
    `| ${row.query} | ${displayRank(row.keyword)} | ${displayRank(row.semantic)} | ${displayRank(row.hybrid)} |`,
  );
}
console.log(
  `| **Summary** | **MRR ${summary.keyword.mrr.toFixed(2)} · Recall@10 ${summary.keyword.recallAt10.toFixed(2)}** | **MRR ${summary.semantic.mrr.toFixed(2)} · Recall@10 ${summary.semantic.recallAt10.toFixed(2)}** | **MRR ${summary.hybrid.mrr.toFixed(2)} · Recall@10 ${summary.hybrid.recallAt10.toFixed(2)}** |`,
);

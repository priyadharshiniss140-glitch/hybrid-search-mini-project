# Hybrid Search Mini Project (BM25 + Vector with RRF)

This mini project fuses provided keyword and semantic rankings with Reciprocal Rank Fusion (RRF), then compares keyword, semantic, and hybrid search using MRR and Recall@10. It runs with plain Node.js and needs no database, API keys, or extra packages.

## Run

```bash
node hybrid-eval.js
```

## Results

Output produced by `node hybrid-eval.js`:

```text
| Query | Keyword rank | Semantic rank | Hybrid rank |
|---|---|---|---|
| my redis cache keeps showing old data | 8 | 1 | 1 |
| how do I add semantic search to a table I already have | 12 | 2 | 1 |
| redis or memcached for caching | 1 | 2 | 1 |
| why did my query get slower after I added an index | 14 | 1 | 2 |
| what does ACID actually guarantee | 2 | 1 | 1 |
| how do I keep my postgres online while changing the schema | 6 | 3 | 1 |
| my background jobs stop after every deploy | 13 | 2 | 2 |
| how do I let my database accept more writes per second | 4 | 1 | 1 |
| sql or nosql for a new product | 1 | 3 | 1 |
| why does my redis memory keep climbing | 15 | 2 | 1 |
| **Summary** | **MRR 0.33 · Recall@10 0.60** | **MRR 0.67 · Recall@10 1.00** | **MRR 0.90 · Recall@10 1.00** |
```

## Interpretation

Hybrid search is best overall, with MRR 0.90—0.23 higher than semantic search's 0.67 and 0.57 higher than keyword search's 0.33—while matching semantic search's perfect Recall@10 of 1.00. For “how do I add semantic search to a table I already have,” keyword ranks the relevant post at 12 and semantic at 2, but RRF promotes it to rank 1 because both lists contribute evidence for the same document. That same query shows why the source rankings include 20 results: the correct post at keyword rank 12 is still available to contribute to the fused score, whereas truncating keyword results at 10 would remove that contribution. Hybrid does not put every answer at rank 1 because the systems sometimes rank competing posts highly, so the correct post's summed score does not always exceed every other document's score.

## How the metrics work

- **RRF:** sums (1/(k+mathrm{rank})) for each document across the input rankings, with 1-based ranks and (k=60).
- **Reciprocal Rank:** (1/mathrm{rank}) of the first relevant result, or 0 if none is found.
- **MRR:** mean reciprocal rank over all queries.
- **Recall@10:** fraction of queries with a correct result in the top 10.

## Input files

- `test-set.csv` contains the test queries and correct post IDs; multiple correct IDs are semicolon-separated.
- `search-results.json` contains top-20 keyword and semantic result lists for each query.
- `posts-dataset.csv` provides the underlying post records for sanity-checking.

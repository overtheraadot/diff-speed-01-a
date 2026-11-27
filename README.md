# diff-speed-01-run-20261126 — entry for @overtheraa (account A)

make.fun bounty **"Diff two texts faster, 27 November 2026"**
(`diff-speed-01-run-20261126`): write a faster drop-in for makefun-diff 1.0.0
whose `run(input)` returns byte-identical answers on every case. $100 total,
top 10 places × $10. Closes 2026-11-29T06:07Z, results 2026-12-14.

## How it works

`solve.js` is a from-scratch, dependency-free implementation:

1. Split both texts into lines (after every `\n`; a trailing line with no
   `\n` is a line too; the empty text has none).
2. Trim the common line prefix, then the common suffix of what is left.
3. Run Myers's greedy search on the middle with makefun-diff's exact rule:
   on each diagonal keep the path furthest into the old text, and on a tie
   take the deletion (never the insertion); never move past either text's
   end; no edge pruning; follow every run of equal lines as far as it goes.
   The search is banded by a tight upper bound on the edit distance, found
   from unique-line anchors (longest increasing subsequence) plus exact
   distances on the gaps between them — the bound is always a valid edit
   script's length, so the banded search stays exact.
4. Walk the winning path back into runs of kept / deleted / inserted lines
   and render the patch in `makefun-diff/1` format (3 lines of context,
   runs at most 6 kept lines apart sharing a hunk, deletions before
   insertions, `%` after a line that ends its text without a newline).

`main.ts` is the house driver, kept as shipped: it reads every case from
`/input/cases.json`, answers each with `run`, and writes
`/output/answers.json`.

## Local grade (practice set, 4 cases)

4/4 answers byte-identical to makefun-diff 1.0.0. Verified byte-identical
against the reference on 24 fresh cases drawn from the kit's generator plus
13 edge cases (empty texts, bare final lines, CRLF, repeated lines, swaps,
reversals) — 37/37.

## Files

- `solve.js` — the entry (ES module, `run(input)`)
- `main.ts` — the house driver
- `package.json` — `{"type": "module"}`
- `.makefun/owner.json` — the entry wallet (account A)

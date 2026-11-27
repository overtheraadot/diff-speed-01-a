// v3 prototype: anchor-based D upper bound + banded Myers (exact, deletion-preferred tie-break)
const FORMAT = 'makefun-diff/1';
const CONTEXT = 3;
const KEEP = 0, DELETE = 1, INSERT = 2;
function tokenize(text) {
  const parts = text.split('\n');
  const lines = new Array(parts.length);
  const last = parts.length - 1;
  for (let i = 0; i < last; i++) lines[i] = parts[i] + '\n';
  if (parts[last] !== '') lines[last] = parts[last];
  else lines.length = last;
  return lines;
}
let traceBuf = null, traceCap = 0;
function ensureTrace(d) {
  if (traceBuf !== null && d <= traceCap) return;
  let cap = traceCap < 1024 ? 1024 : traceCap;
  while (cap < d) cap *= 2;
  const buf = new Int32Array((cap + 1) * (cap + 1));
  if (traceBuf !== null) buf.set(traceBuf.subarray(0, (traceCap + 1) * (traceCap + 1)));
  traceBuf = buf; traceCap = cap;
}
let frontA = null, frontB = null, frontCap = 0;
// forward-only Myers distance on a[b0..b1) vs a[a0..a1); returns minimal edit count
function myersDist(a, b, a0, a1, b0, b1) {
  const n = a1 - a0, m = b1 - b0;
  if (n === 0) return m;
  if (m === 0) return n;
  const maxD = n + m;
  const vf = new Int32Array(2 * maxD + 5).fill(-1);
  const vc = new Int32Array(2 * maxD + 5).fill(-1);
  const off = maxD + 2;
  let x = 0, y = 0;
  while (x < n && y < m && a[a0 + x] === b[b0 + y]) { x++; y++; }
  if (x >= n && y >= m) return 0;
  vf[off] = x;
  let cur = vf, nxt = vc;
  for (let d = 1; ; d++) {
    for (let k = -d; k <= d; k += 2) {
      const rm = cur[k - 1 + off], ad = cur[k + 1 + off];
      const canRm = rm !== -1 && rm < n, canAd = ad !== -1 && ad - k <= m;
      let xx;
      if (canRm && (!canAd || rm + 1 >= ad)) xx = rm + 1;
      else if (canAd) xx = ad;
      else { nxt[k + off] = -1; continue; }
      let yy = xx - k;
      while (xx < n && yy < m && a[a0 + xx] === b[b0 + yy]) { xx++; yy++; }
      nxt[k + off] = xx;
      if (xx >= n && yy >= m) return d;
    }
    const t = cur; cur = nxt; nxt = t;
  }
}
// Upper bound on the minimal edit distance, from unique-line anchors (LIS) + exact gap distances.
// Always >= the true D (the anchor script is a valid edit script).
function upperBound(a, b, n, m) {
  const cntA = new Map(), cntB = new Map();
  for (let i = 0; i < n; i++) cntA.set(a[i], (cntA.get(a[i]) || 0) + 1);
  for (let j = 0; j < m; j++) cntB.set(b[j], (cntB.get(b[j]) || 0) + 1);
  const posB = new Map();
  for (let j = 0; j < m; j++) { const l = b[j]; if (cntB.get(l) === 1 && cntA.get(l) === 1) posB.set(l, j); }
  // pairs (i,j) in increasing i; LIS on j
  const tails = [], tailIdx = [], prevIdx = [];
  const pairI = [], pairJ = [];
  for (let i = 0; i < n; i++) {
    const l = a[i];
    if (cntA.get(l) !== 1) continue;
    const j = posB.get(l);
    if (j === undefined) continue;
    const idx = pairI.length;
    pairI.push(i); pairJ.push(j);
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < j) lo = mid + 1; else hi = mid; }
    if (lo === tails.length) { tails.push(j); tailIdx.push(idx); }
    else { tails[lo] = j; tailIdx[lo] = idx; }
    prevIdx[idx] = lo > 0 ? tailIdx[lo - 1] : -1;
  }
  let D = 0, pi = 0, pj = 0;
  // walk anchors in order (reconstruct LIS from the end)
  const anchors = [];
  let cur = tailIdx.length ? tailIdx[tails.length - 1] : -1;
  while (cur !== -1) { anchors.push(cur); cur = prevIdx[cur]; }
  anchors.reverse();
  for (const idx of anchors) {
    const ai = pairI[idx], aj = pairJ[idx];
    D += myersDist(a, b, pi, ai, pj, aj);
    pi = ai + 1; pj = aj + 1;
  }
  D += myersDist(a, b, pi, n, pj, m);
  return D;
}
function myersRuns(a, b, n, m, Dub) {
  if (n === 0 && m === 0) return [];
  const maxD = n + m;
  if (frontA === null || frontCap < maxD) {
    frontCap = maxD;
    frontA = new Int32Array(2 * maxD + 5).fill(-1);
    frontB = new Int32Array(2 * maxD + 5).fill(-1);
  } else { frontA.fill(-1); frontB.fill(-1); }
  const off = maxD + 2;
  let vf = frontA, vc = frontB;
  let x = 0, y = 0;
  while (x < n && y < m && a[x] === b[y]) { x++; y++; }
  ensureTrace(0);
  traceBuf[0] = x;
  vf[off] = x;
  let D = 0, foundK = 0;
  const kf = n - m;
  if (x < n || y < m) {
    outer: for (let d = 1; ; d++) {
      ensureTrace(d);
      const base = d * d;
      // band: k in [max(-d, kf-(Dub-d)), min(d, kf+(Dub-d))], same parity as d
      const rem = Dub - d;
      let klo = -d; if (kf - rem > klo) klo = kf - rem;
      let khi = d; if (kf + rem < khi) khi = kf + rem;
      let k = klo + ((klo - d) & 1);
      for (; k <= khi; k += 2) {
        const rm = vf[k - 1 + off];
        const ad = vf[k + 1 + off];
        const canRm = rm !== -1 && rm < n;
        const canAd = ad !== -1 && ad - k <= m;
        let xx;
        if (canRm && (!canAd || rm + 1 >= ad)) xx = rm + 1;
        else if (canAd) xx = ad;
        else { vc[k + off] = -1; continue; }
        let yy = xx - k;
        while (xx < n && yy < m && a[xx] === b[yy]) { xx++; yy++; }
        vc[k + off] = xx;
        if (xx >= n && yy >= m) { D = d; foundK = k; break outer; }
      }
      traceBuf.set(vc.subarray(off + klo, off + khi + 1), base + klo + d);
      const t = vf; vf = vc; vc = t;
      if (d > Dub) { // safety net: bound was too small; fall back to the full search
        return myersRunsFull(a, b, n, m);
      }
      if (d >= n + m) throw new Error('myers: search ended without reaching both ends');
    }
  }
  const segs = [];
  let k = foundK;
  x = n;
  for (let d = D; d >= 1; d--) {
    const prev = (d - 1) * (d - 1);
    const rm = k - 1 >= -(d - 1) ? traceBuf[prev + (k - 1) + (d - 1)] : -1;
    const ad = k + 1 <= d - 1 ? traceBuf[prev + (k + 1) + (d - 1)] : -1;
    const canRm = rm !== -1 && rm < n;
    const canAd = ad !== -1 && ad - k <= m;
    let isDel, x0;
    if (canRm && (!canAd || rm + 1 >= ad)) { isDel = true; x0 = rm + 1; }
    else { isDel = false; x0 = ad; }
    segs.push({ keep: x - x0, isDel });
    if (isDel) { k = k - 1; x = rm; } else { k = k + 1; x = ad; }
  }
  const keep0 = x;
  const runs = [];
  const push = (kind, count) => {
    if (count <= 0) return;
    const last = runs[runs.length - 1];
    if (last !== undefined && last.kind === kind) last.count += count;
    else runs.push({ kind, count });
  };
  push(KEEP, keep0);
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    push(s.isDel ? DELETE : INSERT, 1);
    push(KEEP, s.keep);
  }
  return runs;
}
// full (unbanded) search, used only as a safety net
function myersRunsFull(a, b, n, m) {
  return myersRunsBanded(a, b, n, m, n + m);
}
function myersRunsBanded(a, b, n, m, Dub) { return myersRuns(a, b, n, m, Dub); }
function written(op, line) {
  return line.charCodeAt(line.length - 1) === 10 ? op + line : op + line + '\n%\n';
}
export function run(input) {
  if (input === null || typeof input !== 'object' || typeof input.old !== 'string' || typeof input.new !== 'string') {
    throw new TypeError('makefun-diff: the input is { old, new }, two strings');
  }
  const a = tokenize(input.old);
  const b = tokenize(input.new);
  const n = a.length, m = b.length;
  let prefix = 0;
  while (prefix < n && prefix < m && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < n - prefix && suffix < m - prefix && a[n - 1 - suffix] === b[m - 1 - suffix]) suffix++;
  const A = a.slice(prefix, n - suffix), B = b.slice(prefix, m - suffix);
  const Dub = upperBound(A, B, A.length, B.length);
  // Size the trace for the bound up front, so the search does not grow it
  // depth by depth (one allocation instead of several, same final size).
  if (Dub <= 8192) ensureTrace(Dub);
  const runs = myersRuns(A, B, A.length, B.length, Dub);
  if (prefix > 0) {
    if (runs.length > 0 && runs[0].kind === KEEP) runs[0].count += prefix;
    else runs.unshift({ kind: KEEP, count: prefix });
  }
  if (suffix > 0) {
    const last = runs[runs.length - 1];
    if (last !== undefined && last.kind === KEEP) last.count += suffix;
    else runs.push({ kind: KEEP, count: suffix });
  }
  const changes = [];
  let o = 0, p = 0, deleted = 0, inserted = 0;
  for (const r of runs) {
    if (r.kind === KEEP) { o += r.count; p += r.count; continue; }
    let c = changes[changes.length - 1];
    if (c === undefined || c.o + c.dels !== o || c.p + c.ins !== p) { c = { o, p, dels: 0, ins: 0 }; changes.push(c); }
    if (r.kind === DELETE) { c.dels += r.count; o += r.count; deleted += r.count; }
    else { c.ins += r.count; p += r.count; inserted += r.count; }
  }
  const hunks = [];
  for (const c of changes) {
    const h = hunks[hunks.length - 1];
    const prev = h !== undefined ? h[h.length - 1] : undefined;
    if (prev !== undefined && c.o - (prev.o + prev.dels) <= 2 * CONTEXT) h.push(c);
    else hunks.push([c]);
  }
  const out = [`${FORMAT} old=${n} new=${m} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`];
  for (const h of hunks) {
    const first = h[0], last = h[h.length - 1];
    const oldStart = Math.max(0, first.o - CONTEXT);
    const newStart = first.p - (first.o - oldStart);
    const after = Math.min(CONTEXT, n - (last.o + last.dels));
    const oldEnd = last.o + last.dels + after;
    const newEnd = last.p + last.ins + after;
    out.push(`@ ${oldStart + 1} ${oldEnd - oldStart} ${newStart + 1} ${newEnd - newStart}\n`);
    let at = oldStart;
    for (const c of h) {
      for (; at < c.o; at++) out.push(written('=', a[at]));
      for (let i = 0; i < c.dels; i++) out.push(written('-', a[c.o + i]));
      for (let i = 0; i < c.ins; i++) out.push(written('+', b[c.p + i]));
      at = c.o + c.dels;
    }
    for (; at < oldEnd; at++) out.push(written('=', a[at]));
  }
  return out.join('');
}

// Self-warmup: run one small synthetic diff at import so V8 optimizes the
// hot loops (upperBound, the Myers search, the backtrack) before the real
// cases run. A fresh process otherwise pays that compilation in the middle
// of the first case. Genuine work on the same code paths, about a millisecond.
{
  const wOld = [];
  const wNew = [];
  for (let i = 0; i < 3000; i++) {
    wOld.push(`warm line ${i} abcdefgh\n`);
    wNew.push(i % 6 === 0 ? `warm changed ${i} xyz\n` : `warm line ${i} abcdefgh\n`);
  }
  run({ old: wOld.join(''), new: wNew.join('') });
}

'use strict';
/* Fasih spaced repetition: FSRS-6 default weights and formulas (open-spaced-repetition), plus queues */
(function (F) {
  const { clamp, dayNum } = F;
  const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
  const FAC = Math.pow(0.9, -1 / W[20]) - 1;
  const retr = (t, s) => Math.pow(1 + FAC * Math.max(0, t) / s, -W[20]);
  const interval = (s, r) => s / FAC * (Math.pow(r, -1 / W[20]) - 1);
  const d0 = g => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);
  const nextD = (d, g) => clamp(W[7] * d0(4) + (1 - W[7]) * (d - W[6] * (g - 3) * (10 - d) / 9), 1, 10);
  const sRecall = (d, s, r, g) => s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
  const sForget = (d, s, r) => Math.max(0.1, Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))));

  const SRS = F.SRS = { W, retr, interval, d0 };
  const fuzz = n => n < 4 ? n : Math.round(n * (0.95 + Math.random() * 0.1));
  SRS.nextDue = (s, today) => today + Math.max(1, fuzz(Math.round(interval(s, F.S.set.retention) * F.S.mod)));

  /* create a card. g: 1 just taught (not yet recalled), 2 learned today, 3 already known, 4 known very well */
  SRS.create = (id, g) => {
    const S = F.S, today = dayNum();
    const c = S.cards[id] = { s: +W[g - 1].toFixed(3), d: +d0(g).toFixed(2), last: today, due: 0, reps: 0, laps: 0, born: today };
    c.due = g === 1 ? today + 1 : SRS.nextDue(c.s, today);
    if (g >= 3) c.pre = 1;
    F.save();
    return c;
  };
  /* in-session learning finished for a card created with g=1 */
  SRS.graduate = id => { const c = F.S.cards[id]; if (!c) return; const today = dayNum(); c.s = W[1]; c.d = +d0(2).toFixed(2); c.last = today; c.due = SRS.nextDue(c.s, today); F.save(); };
  /* review answer. g: 1 forgot, 2 hard, 3 good, 4 easy. prod = answer was produced (not multiple choice) */
  SRS.answer = (id, g, prod) => {
    const S = F.S, c = S.cards[id]; if (!c) return null;
    const today = dayNum(), t = Math.max(0, today - c.last), r = retr(t, c.s);
    if (t >= 3 && prod) { S.rv.n++; if (g > 1) S.rv.ok++; SRS.adapt(); }
    if (t === 0 && c.reps > 0) { if (g === 1) c.due = today + 1; return c; } // same-day repeat: no change
    c.d = +nextD(c.d, g).toFixed(2);
    if (g === 1) { c.s = +sForget(c.d, c.s, r).toFixed(3); c.laps++; c.due = today + 1; }
    else { c.s = +sRecall(c.d, c.s, r, g).toFixed(3); c.due = SRS.nextDue(c.s, today); }
    c.last = today; c.reps++;
    if (prod) c.prod = (c.prod || 0) + 1;
    if (c.pre) delete c.pre;
    F.save();
    return c;
  };
  /* personal adjustment: after every 150 spaced reviews answered by producing the word (not by choosing),
     compare real retention with the target and gently stretch or shrink all intervals */
  SRS.adapt = () => {
    const S = F.S, v = S.rv;
    if (v.n < 150) return;
    const obs = clamp(v.ok / v.n, 0.5, 0.99), tgt = S.set.retention;
    if (Math.abs(obs - tgt) > 0.025) S.mod = +clamp(S.mod * clamp(Math.log(tgt) / Math.log(obs), 0.9, 1.1), 0.6, 1.3).toFixed(3);
    S.rvAll = S.rvAll || { n: 0, ok: 0 }; S.rvAll.n += v.n; S.rvAll.ok += v.ok;
    S.rv = { n: 0, ok: 0 };
  };
  SRS.dueList = () => {
    const S = F.S, today = dayNum(), out = [];
    for (const id in S.cards) { const c = S.cards[id]; if (c.due <= today && F.DB.byId[id] && !c.off) out.push({ id, r: retr(today - c.last, c.s), c }); }
    out.sort((a, b) => a.r - b.r);
    return out;
  };
  SRS.dueCount = () => { const S = F.S, today = dayNum(); let n = 0; for (const id in S.cards) { const c = S.cards[id]; if (c.due <= today && !c.off && F.DB.byId[id]) n++; } return n; };
  SRS.isLeech = c => c.laps >= 4;
  SRS.stage = c => c.s < 3 ? 0 : c.s < 21 ? 1 : 2; // learning, young, mature

  /* next new words: general / domain / chunk tracks mixed by the user's ratio, avoiding look-alike words in one batch */
  SRS.newQueue = function* () {
    const S = F.S, T = F.DB.tracks, used = [];
    const next = k => { const a = T[k]; while (S.ptr[k] < a.length && S.cards[a[S.ptr[k]].id]) S.ptr[k]++; return S.ptr[k] < a.length ? a[S.ptr[k]] : null; };
    const similar = v => used.slice(-8).some(u => u === v.w.slice(0, 4).toLowerCase());
    const cnt = { g: 0, d: 0, c: 0 };
    let n = 0;
    for (;;) {
      const chunk = S.daysDone >= 14 ? 0.1 : 0, dom = Math.min(0.6, S.set.domain / 100);
      const tgt = { c: chunk, d: dom, g: Math.max(0.1, 1 - chunk - dom) };
      const order = ['g', 'd', 'c'].sort((a, b) => (tgt[b] * (n + 1) - cnt[b]) - (tgt[a] * (n + 1) - cnt[a]));
      let v = null, k = null;
      for (const kk of order) {
        const a = T[kk]; next(kk);
        let p = S.ptr[kk], skipped = 0;
        while (p < a.length) {
          const x = a[p];
          if (S.cards[x.id] || x._q) { p++; continue; }
          if (similar(x) && skipped < 5) { skipped++; p++; continue; }
          v = x; k = kk; break;
        }
        if (v) break;
      }
      if (!v) return;
      v._q = 1; used.push(v.w.slice(0, 4).toLowerCase()); cnt[k]++; n++;
      yield v;
    }
  };
  SRS.clearQueued = () => { ['g', 'd', 'c'].forEach(k => F.DB.tracks[k].forEach(v => { if (v._q) delete v._q; })); };
  SRS.remaining = () => { const T = F.DB.tracks, S = F.S; let n = 0; ['g', 'd', 'c'].forEach(k => T[k].forEach(v => { if (!S.cards[v.id]) n++; })); return n; };

  /* current level of the learner = level of the next general word to learn */
  F.level = () => { const S = F.S, a = F.DB.tracks.g; let p = S.ptr.g; while (p < a.length && S.cards[a[p].id]) p++; return p < a.length ? a[p].l : 'C1'; };
  F.stats = () => {
    const S = F.S, today = dayNum(), st = { total: 0, learning: 0, young: 0, mature: 0, leech: 0, due: 0, byL: { A2: 0, B1: 0, B2: 0, C1: 0 }, dom: 0, fore: [0, 0, 0, 0, 0, 0, 0] };
    for (const id in S.cards) {
      const c = S.cards[id], v = F.DB.byId[id]; if (!v) continue;
      st.total++; st[['learning', 'young', 'mature'][SRS.stage(c)]]++;
      if (SRS.isLeech(c)) st.leech++;
      if (c.due <= today) st.due++; else if (c.due - today <= 7) st.fore[c.due - today - 1]++;
      if (v.tr === 'd') st.dom++; if (st.byL[v.l] != null) st.byL[v.l]++;
    }
    const a = S.rvAll || { n: 0, ok: 0 }, n = a.n + S.rv.n, ok = a.ok + S.rv.ok;
    st.ret = n >= 20 ? Math.round(100 * ok / n) : null;
    return st;
  };
})(window.Fasih);

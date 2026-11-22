'use strict';
/* Fasih tutor: bridge to the learner's AI app, Fasih packs (see TUTOR_SPEC.md) */
(function (F) {
  const { $, $$, esc, dayNum } = F;
  const Tu = F.tutor = {};
  const LVS = ['A2', 'B1', 'B2', 'C1'];
  const SKILLS = { reading: 'القراءة', listening: 'الاستماع', speaking: 'المحادثة', writing: 'الكتابة', grammar: 'القواعد' };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const T0 = () => {
    const S = F.S, d = { ai: 'claude', mode: 'bridge', n: 0, sent: 0, last: null, packs: [], lessons: [], readings: [], quizzes: [], mistakes: [], prio: [], focus: null };
    if (!S.tutor || typeof S.tutor !== 'object') S.tutor = d;
    const t = S.tutor;
    Object.keys(d).forEach(k => { if (t[k] === undefined || (Array.isArray(d[k]) && !Array.isArray(t[k]))) t[k] = d[k]; });
    return t;
  };
  const aiName = k => { k = k || T0().ai; if (k === 'other') return 'تطبيق آخر'; const a = F.AIS.find(x => x.k === k); return a ? a.n : 'Claude'; };
  Tu.aiName = aiName;
  const chatOk = ai => { try { return !!(F.chat && F.chat.ready && F.chat.ready(ai)); } catch (e) { return false; } };
  const doneMap = k => (F.S.done[k] = F.S.done[k] || {});

  /* ---------- text hygiene ---------- */
  const ZW = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, CTRL = /[\u0000-\u001F\u007F-\u009F]/g;
  const clean = (v, max) => {
    if (typeof v === 'number' && isFinite(v)) v = String(v);
    if (typeof v !== 'string') return '';
    let s = v.replace(ZW, '').replace(/ /g, ' ').replace(CTRL, ' ').replace(/\s+/g, ' ').trim();
    if (max && s.length > max) { s = s.slice(0, max); if (/[\uD800-\uDBFF]$/.test(s)) s = s.slice(0, -1); s = s.trim(); }
    return s;
  };

  /* ---------- parsing what the learner pasted ---------- */
  const balanced = (s, i) => { // end index (exclusive) of the object starting at s[i], or -1; string-aware
    let depth = 0, str = false, bs = false;
    for (let j = i; j < s.length; j++) {
      const c = s.charCodeAt(j);
      if (str) { if (bs) bs = false; else if (c === 92) bs = true; else if (c === 34) str = false; }
      else if (c === 34) str = true;
      else if (c === 123) depth++;
      else if (c === 125 && --depth === 0) return j + 1;
    }
    return -1;
  };
  const asPack = o => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    if (has(o, 'fasih')) return o;
    for (const k of Object.keys(o).slice(0, 12)) { const v = o[k]; if (v && typeof v === 'object' && !Array.isArray(v) && has(v, 'fasih')) return v; }
    return null;
  };
  const scan = s => {
    let budget = 6e6, fails = 0, found = null, ver = false;
    const check = o => { const p = asPack(o); if (!p) return false; const v = +p.fasih; if (!isFinite(v) || v < 1) return false; if (v > 1) { ver = true; return true; } found = p; return true; };
    const at = i => {
      const e = balanced(s, i);
      if (e < 0) { budget -= s.length - i; fails++; return -1; }
      budget -= e - i;
      let o; try { o = JSON.parse(s.slice(i, e)); } catch (x) { return -3; } // broken: look inside it too
      return check(o) ? -2 : e;
    };
    const re = /\{\s*"fasih"\s*:/g; let m, tries = 0;
    while (!found && !ver && tries++ < 6 && (m = re.exec(s)) && budget > 0) at(m.index);
    for (let i = s.indexOf('{'); i >= 0 && !found && !ver && budget > 0 && fails < 40; ) {
      const e = at(i);
      i = s.indexOf('{', e > 0 ? e : i + 1);
    }
    return { pack: found, ver };
  };
  Tu.parse = text => {
    let s = String(text == null ? '' : text).slice(0, 300000).replace(ZW, '').replace(/ /g, ' ');
    let r = scan(s);
    if (!r.pack && !r.ver) {
      const t = s.replace(/[“”„‟]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1');
      if (t !== s) r = scan(t);
    }
    if (r.ver) return { ok: false, err: 'ver' };
    if (r.pack) return { ok: true, pack: r.pack };
    return { ok: false, err: /["“”']fasih["“”']\s*:/i.test(s) ? 'json' : 'none' };
  };
  Tu.offer = text => {
    try { const r = Tu.parse(text); if (r.ok) return { ok: true, pack: Object.assign({}, r.pack, { title: clean(r.pack.title, 80) || 'حزمة من المعلّم' }) }; return { ok: false, err: r.err }; } catch (e) { return { ok: false, err: 'none' }; }
  };

  /* ---------- validation: a pack is untrusted input, everything is rebuilt from whitelisted keys ---------- */
  const strs = (v, n, max) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : []).slice(0, n).map(x => clean(x, max)).filter(Boolean);
  const listOf = (p, one, many, cap) => { const r = []; [p[one], p[many]].forEach(v => { if (Array.isArray(v)) { for (let i = 0; i < v.length && r.length < cap; i++) r.push(v[i]); } else if (v && typeof v === 'object' && r.length < cap) r.push(v); }); return r; };
  const optIndex = (a, o) => {
    if (typeof a === 'number' && isFinite(a)) return Number.isInteger(a) && a >= 0 && a < o.length ? a : -1;
    if (typeof a === 'string') { const t = clean(a, 140).toLowerCase(), i = o.findIndex(x => x.toLowerCase() === t); if (i >= 0) return i; if (/^\d$/.test(t) && +t < o.length) return +t; }
    return -1;
  };
  const optList = o => { if (!Array.isArray(o)) return null; const r = o.slice(0, 5).map(x => clean(x, 140)); if (r.length < 2 || r.some(x => !x)) return null; if (new Set(r.map(x => x.toLowerCase())).size !== r.length) return null; return r; };
  const fixLike = e => {
    const q = clean(e.q, 240), bad = clean(e.bad, 120), good = strs(e.good, 5, 80).filter(g => g.toLowerCase() !== bad.toLowerCase());
    if (!q || !bad || !good.length || q.indexOf(bad) < 0) return null;
    return { q, bad, good, why: clean(e.why, 300) };
  };
  /* one exercise. kinds: allowed "k" values. np: number of paragraphs (for head) */
  const normEx = (e, kinds, np) => {
    if (!e || typeof e !== 'object' || kinds.indexOf(e.k) < 0) return null;
    const k = e.k, why = clean(e.why, 300);
    if (k === 'mc') { const q = clean(e.q, 300), o = optList(e.o); if (!q || !o) return null; const a = optIndex(e.a, o); return a < 0 ? null : { k, q, o, a, why }; }
    if (k === 'gap') { let q = clean(e.q, 300); const m = q.match(/_{2,}/g); if (!m || m.length !== 1) return null; q = q.replace(/_{2,}/, '___'); const a = strs(e.a, 6, 80); return a.length ? { k, q, a, why } : null; }
    if (k === 'fix') { const f = fixLike(e); return f ? { k, q: f.q, bad: f.bad, good: f.good, why: f.why } : null; }
    if (k === 'order') { const a = clean(e.a, 220), n = a ? a.split(' ').length : 0; return n >= 4 && n <= 14 ? { k, a, ar: clean(e.ar, 220), why } : null; }
    if (k === 'trans') { const q = clean(e.q, 300), start = clean(e.start, 80), a = strs(e.a, 5, 220).filter(x => start && x.toLowerCase().indexOf(start.toLowerCase()) === 0); return q && start && a.length ? { k, q, start, a, why } : null; }
    if (k === 'tfng') { const q = clean(e.q, 300), t = clean(e.a, 12).toUpperCase().replace(/[^A-Z]/g, ''), a = t === 'T' || t === 'TRUE' ? 'T' : t === 'F' || t === 'FALSE' ? 'F' : t === 'NG' || t === 'NOTGIVEN' ? 'NG' : ''; return q && a ? { k, q, a, why } : null; }
    if (k === 'head') { const o = optList(e.o), para = typeof e.para === 'number' ? e.para : +e.para; if (!o || !Number.isInteger(para) || para < 0 || para >= np) return null; const a = optIndex(e.a, o); return a < 0 ? null : { k, para, o, a, why }; }
    return null;
  };
  const exList = (arr, kinds, min, max, np) => { const out = []; (Array.isArray(arr) ? arr : []).slice(0, 200).forEach(e => { const x = out.length < max ? normEx(e, kinds, np) : null; if (x) out.push(x); }); return out.length >= min ? out : []; };
  const EXK = ['mc', 'gap', 'fix', 'order', 'trans'], QK = ['mc', 'gap', 'tfng', 'head'];
  const normLesson = l => {
    if (!l || typeof l !== 'object') return null;
    const title = clean(l.title, 120); if (!title) return null;
    const rules = (Array.isArray(l.rules) ? l.rules : []).slice(0, 6).map(r => {
      if (!r || typeof r !== 'object') return null;
      const ar = clean(r.ar, 600); if (!ar) return null;
      return { ar, form: clean(r.form, 200), ex: (Array.isArray(r.ex) ? r.ex : []).slice(0, 4).map(x => x && typeof x === 'object' && clean(x.en, 220) ? { en: clean(x.en, 220), ar: clean(x.ar, 220) } : null).filter(Boolean) };
    }).filter(Boolean);
    if (!rules.length) return null;
    const exs = exList(l.exs, EXK, 3, 20, 0); if (!exs.length) return null;
    return {
      l: LVS.indexOf(l.l) >= 0 ? l.l : F.level(), title, titleAr: clean(l.titleAr, 120) || title, why: clean(l.why, 500), rules,
      mistakes: (Array.isArray(l.mistakes) ? l.mistakes : []).slice(0, 5).map(m => m && typeof m === 'object' && clean(m.x, 220) && clean(m.ok, 220) ? { x: clean(m.x, 220), ok: clean(m.ok, 220), ar: clean(m.ar, 300) } : null).filter(Boolean),
      tip: clean(l.tip, 300), exs,
    };
  };
  const normReading = r => {
    if (!r || typeof r !== 'object') return null;
    const paras = (Array.isArray(r.paras) ? r.paras : []).slice(0, 10).map(p => clean(p, 1500)).filter(Boolean);
    if (paras.length < 2) return null;
    const qs = exList(r.qs, QK, 3, 12, paras.length); if (!qs.length) return null;
    return {
      l: LVS.indexOf(r.l) >= 0 ? r.l : F.level(), title: clean(r.title, 120) || 'Reading', paras,
      gloss: (Array.isArray(r.gloss) ? r.gloss : []).slice(0, 15).map(g => g && typeof g === 'object' && clean(g.w, 60) && clean(g.ar, 120) ? { w: clean(g.w, 60), ar: clean(g.ar, 120) } : null).filter(Boolean),
      qs, sumAr: clean(r.sumAr, 700),
    };
  };
  const normQuiz = q => { if (!q || typeof q !== 'object') return null; const exs = exList(q.exs, EXK, 3, 25, 0); return exs.length ? { title: clean(q.title, 120) || 'تمارين من المعلّم', exs } : null; };
  const dailyNew = { 30: 5, 45: 7, 60: 8, 75: 10, 90: 12, 120: 14 };
  const snap = (v, a) => { v = +v; if (!isFinite(v)) return null; return a.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, a[0]); };
  Tu.normalise = pack => {
    const S = F.S, T = T0(), out = { _n: 1, title: 'حزمة من المعلّم', note: '', words: [], prio: [], known: 0, mistakes: [], lessons: [], readings: [], quizzes: [], plan: null, drop: 0, empty: false };
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) { out.empty = true; return out; }
    out.title = clean(pack.title, 80) || out.title; out.note = clean(pack.note, 800);
    /* words */
    const byW = {}; F.DB.vocab.forEach(v => { const k = String(v.w).toLowerCase(); if (!byW[k]) byW[k] = v; });
    const seen = {}, wraw = Array.isArray(pack.words) ? pack.words : []; let accepted = 0, bad = 0;
    for (let i = 0; i < wraw.length && i < 400; i++) {
      const w = wraw[i]; if (!w || typeof w !== 'object') { bad++; continue; }
      const word = clean(w.w, 60), ar = clean(w.ar, 120);
      if (!word || !/[A-Za-z]/.test(word) || !ar) { bad++; continue; }
      const key = word.toLowerCase();
      if (seen[key] || accepted >= 40) { bad++; continue; }
      seen[key] = 1;
      const old = F.DB.byId['x:' + key] || F.DB.lemma[key] || byW[key];
      if (old) { accepted++; if (S.cards[old.id]) out.known++; else if (out.prio.indexOf(old.id) < 0) out.prio.push(old.id); continue; }
      let ex = clean(w.ex, 220), x = clean(w.x, 60), exar = clean(w.exar, 220);
      if (!ex || !x || ex.indexOf(x) < 0) { const j = ex ? ex.toLowerCase().indexOf(key) : -1; x = j >= 0 ? ex.slice(j, j + word.length) : ''; }
      if (!ex || !x) { ex = word; x = word; exar = ''; }
      const v = { w: word, p: has(F.POS, w.p) ? w.p : / /.test(word) ? 'phr' : 'n', l: LVS.indexOf(w.l) >= 0 ? w.l : F.level(), t: 'misc', ar, ex, x };
      const d = clean(w.d, 160); if (d) v.d = d;
      if (exar) v.exar = exar;
      const c = strs(w.c, 3, 60); if (c.length) v.c = c;
      const f = strs(w.f, 4, 40); if (f.length) v.f = f;
      out.words.push(v); accepted++;
    }
    out.drop += bad + Math.max(0, wraw.length - 400);
    /* mistakes */
    const mraw = Array.isArray(pack.mistakes) ? pack.mistakes : [], have = {}; T.mistakes.forEach(m => { have[m.q] = 1; });
    mraw.slice(0, 200).forEach(m => { const f = m && typeof m === 'object' ? fixLike(m) : null; if (f && !have[f.q] && out.mistakes.length < 20) { have[f.q] = 1; out.mistakes.push(f); } });
    out.drop += mraw.length - out.mistakes.length;
    /* lessons, readings, quizzes */
    const part = (one, many, cap, fn, key) => { const raw = listOf(pack, one, many, cap + 30); raw.forEach(x => { const r = out[key].length < cap ? fn(x) : null; if (r) out[key].push(r); }); out.drop += raw.length - out[key].length; };
    part('lesson', 'lessons', 3, normLesson, 'lessons'); part('reading', 'readings', 2, normReading, 'readings'); part('quiz', 'quizzes', 2, normQuiz, 'quizzes');
    /* plan */
    const p = pack.plan;
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      const pl = {}, set = S.set;
      const dm = snap(p.dailyMin, [30, 45, 60, 75, 90, 120]); if (p.dailyMin != null && dm != null && dm !== set.dailyMin) pl.dailyMin = dm;
      const np = snap(p.newPerDay, [3, 5, 7, 8, 10, 12, 14, 16, 20]); if (p.newPerDay != null && np != null && np !== (pl.dailyMin ? dailyNew[pl.dailyMin] || 10 : set.newPerDay)) pl.newPerDay = np;
      const dom = snap(p.domain, [10, 20, 30, 40]); if (p.domain != null && dom != null && dom !== set.domain) pl.domain = dom;
      const re = snap(p.retention, [0.85, 0.9, 0.93]); if (p.retention != null && re != null && re !== set.retention) pl.retention = re;
      if (typeof p.focus === 'string' && has(SKILLS, p.focus)) {
        const fd = Math.round(clamp(+p.focusDays || 7, 3, 21)), cur = T.focus;
        if (!(cur && cur.skill === p.focus && dayNum() <= cur.until)) { pl.focus = p.focus; pl.focusDays = fd; }
      }
      if (Object.keys(pl).length) { pl.why = clean(p.why, 500); out.plan = pl; }
    }
    out.empty = !(out.words.length || out.prio.length || out.mistakes.length || out.lessons.length || out.readings.length || out.quizzes.length || out.plan || out.note);
    return out;
  };
  const clamp = F.clamp;

  /* ---------- apply / remove ---------- */
  const PLAN_KEYS = ['dailyMin', 'newPerDay', 'domain', 'retention'];
  Tu.apply = n => {
    const S = F.S, T = T0(); T.n++;
    const id = 'p' + T.n, it = { words: [], prio: [], mistakes: [], lessons: [], readings: [], quizzes: [] };
    const rec = { id, at: F.now(), ai: T.ai, title: n.title, note: n.note || '', items: it, plan: null };
    (n.words || []).forEach(w => {
      const v = Object.assign({}, w, { id: 'x:' + w.w.toLowerCase(), tr: 't', pk: id });
      if (F.DB.byId[v.id]) return;
      S.custom.push(v); F.DB.byId[v.id] = v; F.DB.vocab.push(v); F.DB.tracks.t.push(v); (F.DB.pos[v.p] = F.DB.pos[v.p] || []).push(v); if (!/ /.test(v.w)) F.DB.lemma[v.w.toLowerCase()] = v;
      it.words.push(v.id);
    });
    (n.prio || []).forEach(pid => { if (F.DB.byId[pid] && !S.cards[pid] && T.prio.indexOf(pid) < 0) { T.prio.push(pid); it.prio.push(pid); } });
    const reg = (list, store, key, prefix, ex) => (list || []).forEach((o, i) => { const x = Object.assign({ id: 't:' + prefix + ':' + id + ':' + i, pk: id }, o, ex || {}); store.push(x); F.DB.byId[x.id] = x; it[key].push(x.id); });
    reg(n.lessons, T.lessons, 'lessons', 'l'); reg(n.readings, T.readings, 'readings', 'r'); reg(n.quizzes, T.quizzes, 'quizzes', 'q');
    (n.mistakes || []).forEach((m, i) => { T.mistakes.push({ id: 't:m:' + id + ':' + i, pk: id, q: m.q, bad: m.bad, good: m.good.slice(), why: m.why || '', box: 0, due: dayNum(), n: 0, ok: 0 }); it.mistakes.push('t:m:' + id + ':' + i); });
    if (n.plan) {
      const before = {}, after = {}, was = {}; PLAN_KEYS.forEach(k => { was[k] = S.set[k]; });
      PLAN_KEYS.forEach(k => { if (n.plan[k] != null) F.applySetting(k, n.plan[k], true); }); // dailyMin first: it resets newPerDay
      PLAN_KEYS.forEach(k => { if (S.set[k] !== was[k]) { before[k] = was[k]; after[k] = S.set[k]; } });
      if (n.plan.focus) { T.focus = { skill: n.plan.focus, until: dayNum() + (n.plan.focusDays || 7), pk: id }; after.focus = n.plan.focus; before.focus = null; }
      rec.plan = { before, after, why: n.plan.why || '', focusDays: n.plan.focus ? n.plan.focusDays || 7 : 0 };
    }
    T.packs.unshift(rec);
    F.save();
    return rec;
  };
  Tu.remove = packId => {
    const S = F.S, T = T0(), rec = T.packs.find(p => p.id === packId); if (!rec) return false;
    const it = rec.items || {}, gone = {};
    (it.words || []).forEach(id => { gone[id] = 1; delete S.cards[id]; delete S.notes[id]; });
    S.custom = S.custom.filter(v => !gone[v.id]);
    T.prio = T.prio.filter(id => !gone[id] && (it.prio || []).indexOf(id) < 0);
    const drop = (arr, ids) => arr.filter(o => (ids || []).indexOf(o.id) < 0);
    T.lessons = drop(T.lessons, it.lessons); (it.lessons || []).forEach(id => { delete S.gram[id]; });
    T.readings = drop(T.readings, it.readings); (it.readings || []).forEach(id => { delete doneMap('reading')[id]; });
    T.quizzes = drop(T.quizzes, it.quizzes); (it.quizzes || []).forEach(id => { delete doneMap('tquiz')[id]; });
    T.mistakes = drop(T.mistakes, it.mistakes);
    if (rec.plan) {
      const b = rec.plan.before || {}, a = rec.plan.after || {};
      PLAN_KEYS.forEach(k => { if (has(b, k) && S.set[k] === a[k]) F.applySetting(k, b[k], true); });
      if (T.focus && T.focus.pk === packId) T.focus = null;
    }
    T.packs = T.packs.filter(p => p.id !== packId);
    F.buildDB(); F.buildSeq(); F.save();
    return true;
  };

  /* ---------- prompts ---------- */
  const HOW = ['HOW TO ANSWER:', '- Explain in clear Modern Standard Arabic; examples and practice in English at my level or one step above it.', '- Be honest and specific. Correct every real mistake. No flattery.', '- British spelling. Write original material only (never copy real exam questions).'].join('\n');
  const P = {
    words: (n, focus) => '- "words": up to ' + n + ' items like {"w":"headword in lowercase base form","p":"n|v|adj|adv|phr","l":"A2|B1|B2|C1","ar":"Arabic meaning, 1-2 senses","d":"simple English definition, max 14 words","ex":"one natural example sentence of 6-16 words containing the word","x":"the word exactly as written inside ex","exar":"Arabic translation of ex","c":["up to 3 common collocations"]}' + (focus ? ' Focus: ' + focus + '.' : ''),
    mistakes: n => '- "mistakes": my real mistakes, most important first, up to ' + n + ', like {"q":"my sentence (max 20 words) keeping exactly ONE error","bad":"the wrong word(s) exactly as written in q","good":["correct replacement for bad","another accepted replacement"],"why":"short reason in Arabic"}',
    lesson: '- "lesson": {"l":"A2|B1|B2|C1","title":"English title","titleAr":"Arabic title","why":"when I need this, in Arabic","rules":[{"ar":"rule explained in Arabic","form":"pattern, e.g. S + have/has + past participle","ex":[{"en":"example","ar":"its translation"}]}],"mistakes":[{"x":"typical wrong sentence of an Arabic speaker","ok":"correct sentence","ar":"why, in Arabic"}],"tip":"memory trick in Arabic","exs":[10-12 exercise objects, easy to hard]}  (2-4 rules, 2-3 examples each)',
    reading: '- "reading": {"l":"A2|B1|B2|C1","title":"…","paras":["paragraph 1","paragraph 2"],"gloss":[{"w":"hard word","ar":"meaning"}],"qs":[6-8 question objects],"sumAr":"two-sentence summary in Arabic"}',
    quiz: '- "quiz": {"title":"…","exs":[10-15 exercise objects]}',
    plan: '- "plan": only the settings you want to change, each with one of the allowed values: {"dailyMin":30|45|60|75|90|120,"newPerDay":3|5|7|8|10|12|14|16|20,"domain":10|20|30|40,"retention":0.85|0.9|0.93,"focus":"reading|listening|speaking|writing|grammar","focusDays":3-21,"why":"reason in Arabic"}  (domain = % of new words taken from my field; retention = review intensity, 0.93 means more reviews; focus = one extra daily task of that skill for focusDays days)',
  };
  const EXO = ['Exercise objects (key "k" = type; "why" = short explanation in Arabic):',
    '- mc: {"k":"mc","q":"She ___ to work by bus every day.","o":["go","goes","is going"],"a":1,"why":"short reason in Arabic"}  (3-4 options, exactly one correct, a = index from 0; vary the position of the correct answer)',
    '- gap: {"k":"gap","q":"I ___ (not/see) him since Monday.","a":["haven\'t seen","have not seen"],"why":"…"}  (q contains ___ ; a = ALL acceptable answers; answer max 4 words)',
    '- fix: {"k":"fix","q":"He don\'t like coffee.","bad":"don\'t","good":["doesn\'t","does not"],"why":"…"}  (sentence with exactly ONE error; bad = the exact wrong word(s) as written in q; good = accepted replacements)',
    '- order: {"k":"order","a":"I have never been to London.","ar":"لم أذهب إلى لندن قط."}  (the app shuffles the words; 5-12 words; only one natural order)',
    '- trans: {"k":"trans","q":"People say that he is very rich.","start":"He is said","a":["He is said to be very rich."],"why":"…"}  (rewrite beginning with start; every answer begins with start)'];
  const QSO = ['Question objects:',
    '- mc: {"k":"mc","q":"What is the main idea of paragraph 2?","o":["…","…","…"],"a":1,"why":"short reason in Arabic"}  (3-4 options, exactly one correct, a = index from 0)',
    '- gap: {"k":"gap","q":"The report was published in ___ .","a":["2019"],"why":"…"}  (q contains ___ ; a = words copied from the text, max 2 words)',
    '- tfng: {"k":"tfng","q":"statement","a":"T","why":"…"}  (a = "T", "F" or "NG")',
    '- head: {"k":"head","para":2,"o":["heading A","heading B","heading C","heading D"],"a":0}  (best heading for paragraph index para, counted from 0)'];
  const packSection = (parts, ex, qs) => ['FASIH PACK (required at the END of your reply):', 'Finish with exactly ONE fenced code block (```json) containing one JSON object and nothing else. My app imports it, so it must be valid JSON: double quotes only, no comments, no trailing commas, no line breaks inside strings. Shape:', '{"fasih":1,"title":"short Arabic title","note":"1-2 sentences of personal advice in Arabic", <parts>}', 'Parts to include:'].concat(parts, ex ? EXO : [], qs ? QSO : []).join('\n');
  const ALLP = () => [P.words(10), P.mistakes(10), P.lesson, P.reading, P.quiz, P.plan];
  const about = plan => {
    const S = F.S, T = T0(), st = F.stats(), pc = F.pace(), n = S.day ? S.day.n : S.daysDone + 1, ph = F.phase(n), ln = [];
    ln.push('- Arabic speaker (Algeria). Goal: CEFR C1 and IELTS Academic band 7+ within 18 months. My field: law, anti-corruption and transparency, and AI.');
    ln.push('- Plan: study day ' + n + ' of ' + F.PLAN_DAYS + ' (phase ' + ph.lv + '), ' + S.set.dailyMin + ' minutes a day, ' + S.set.newPerDay + ' new words a day, streak ' + F.streakAlive() + ' days, ' + (pc.diff > 0 ? pc.diff + ' day' + (pc.diff === 1 ? '' : 's') + ' ahead of schedule' : pc.diff < 0 ? -pc.diff + ' day' + (pc.diff === -1 ? '' : 's') + ' behind schedule' : 'on schedule') + '.');
    ln.push('- Current vocabulary level: ' + F.level() + '. Words learned in the app: ' + st.total + ' (' + st.mature + ' long-term, ' + st.leech + ' difficult).' + (st.ret != null ? ' Recall accuracy: ' + st.ret + '%.' : ''));
    const gk = Object.keys(S.gram).filter(id => F.DB.byId[id] && id.slice(0, 2) !== 't:'), sc = id => S.gram[id].score == null ? 1 : S.gram[id].score;
    const weak = gk.slice().sort((a, b) => sc(a) - sc(b)).slice(0, 5);
    ln.push('- Grammar units finished: ' + gk.length + ' of ' + F.DB.grammar.length + '.' + (weak.length ? ' Weakest: ' + weak.map(id => clean(F.DB.byId[id].title, 60) + ' (' + Math.round(sc(id) * 100) + '%)').join('; ') + '.' : ''));
    const lap = Object.keys(S.cards).filter(id => F.DB.byId[id] && S.cards[id].laps >= 2).sort((a, b) => S.cards[b].laps - S.cards[a].laps).slice(0, 15);
    if (lap.length) ln.push('- Words I keep forgetting: ' + lap.map(id => F.DB.byId[id].w).join(', ') + '.');
    const ms = T.mistakes.slice(-6).reverse();
    if (ms.length) ln.push('- My recent mistakes: ' + ms.map(m => '"' + m.q + '" → "' + m.q.replace(m.bad, () => m.good[0]) + '"').join('; ') + '.');
    if (plan) {
      const days = []; for (let i = 13; i >= 0; i--) { const h = S.hist[F.dateStr(F.now() - i * F.DAY)]; days.push(h ? Math.round(h.min) + '/' + (h.new || 0) + '/' + (h.rev || 0) : '0/0/0'); }
      ln.push('- Last 14 days, oldest first (minutes/new words/reviews): ' + days.join(', ') + '.');
      ln.push('- Finished items: grammar ' + gk.length + Object.keys(S.done).map(k => ', ' + k + ' ' + Object.keys(S.done[k] || {}).length).join('') + '. Cards due now: ' + F.SRS.dueCount() + '.');
      if (S.tests.length) ln.push('- Weekly quiz scores (latest last): ' + S.tests.slice(-6).map(t => Math.round(t.score * 100) + '%').join(', ') + '.');
      if (S.mocks.length) ln.push('- Mock tests (latest last): ' + S.mocks.slice(-3).map(m => m.o + ' (L ' + m.L + ', R ' + m.R + ', W ' + m.W + ', S ' + m.S + ')').join('; ') + '.');
      ln.push('- Current settings: dailyMin ' + S.set.dailyMin + ', newPerDay ' + S.set.newPerDay + ', domain ' + S.set.domain + ', retention ' + S.set.retention + '.' + (T.focus && dayNum() <= T.focus.until ? ' Active focus: ' + T.focus.skill + ' until day ' + T.focus.until + '.' : ''));
    }
    return 'ABOUT ME (data from the app, ' + F.dateStr() + '):\n' + ln.join('\n');
  };
  const REQ = {
    fix: { ic: '✍️', n: 'صحّح كتابتي', d: 'تقييم وتصحيح، وأخطاؤك تدخل دفترك', t: 'تصحيح الكتابة' },
    talk: { ic: '🗣️', n: 'حاورني', d: 'محادثة صوتية أو كتابية ثم ملاحظات', t: 'محادثة' },
    words: { ic: '🧩', n: 'كلمات لموضوع', d: 'مصطلحات مجالك عند الطلب', t: 'كلمات لموضوع' },
    lesson: { ic: '📘', n: 'درس مخصص', d: 'قاعدة تُشرح لك مع تمارين', t: 'درس مخصص' },
    read: { ic: '📖', n: 'نص للقراءة', d: 'نص بمستواك عن موضوع تختاره', t: 'نص للقراءة' },
    photo: { ic: '📷', n: 'اشرح صورة', d: 'صوّر نصاً أو سؤالاً واسأل عنه', t: 'شرح صورة' },
    plan: { ic: '📊', n: 'راجع خطتي', d: 'يحلل نتائجك ويقترح تعديل الخطة', t: 'مراجعة الخطة' },
    ask: { ic: '❓', n: 'سؤال حر', d: 'أي سؤال، ومعه مستواك وسياقك', t: 'سؤال حر' },
    word: { t: 'عن كلمة' }, explain: { t: 'شرح نص' },
  };
  const TALK = { free: ['محادثة حرة', 'free conversation'], p1: ['IELTS Part 1', 'IELTS Speaking Part 1'], p2: ['IELTS Part 2', 'IELTS Speaking Part 2'], p3: ['IELTS Part 3', 'IELTS Speaking Part 3'], project: ['مقابلة عن مشروعي وبحثي', 'an interview about my project and research'] };
  const cap = (s, n) => String(s == null ? '' : s).replace(/\r/g, '').slice(0, n);
  Tu.build = (id, input) => {
    input = input || {};
    let user = '', parts = [], plan = false, ex = false, qs = false;
    const lvl = F.level();
    if (id === 'fix') {
      const task = cap(input.task, 600).trim(), ielts = input.kind === 'w1' || input.kind === 'w2';
      user = 'Correct my writing.' + (task ? '\nTASK: ' + task : '') + '\nMY TEXT:\n' + cap(input.text, 12000).trim() + '\n\nPlease: 1) ' + (ielts ? 'estimate an IELTS band for each of the four criteria and overall' : 'estimate my CEFR level for this text') + '. 2) Show the corrected text. 3) List my mistakes with a short explanation in Arabic. 4) Rewrite my two weakest sentences at a higher level. 5) Tell me the three things to practise next.';
      parts = [P.mistakes(10), P.words(8, 'words that would have improved this text')];
    } else if (id === 'talk') {
      const m = TALK[input.mode] || TALK.free, topic = cap(input.topic, 300).trim();
      user = 'Speaking practice (' + m[1] + '). Topic: ' + (topic || 'choose one that fits my level and my field') + '. Rules: speak only English with me; ask ONE question at a time and wait for my answer; keep your turns short (1-3 sentences); do not correct me during the conversation, just note my mistakes silently. After about 10 exchanges, or when I say "finish", stop and give me feedback in Arabic: what I did well, my main mistakes with corrections, and better ways to say two of my sentences.' + (/^p[123]$/.test(input.mode) ? ' Follow the real format of that part and give an estimated band for fluency, vocabulary and grammar.' : '') + ' Only then add the pack. I may use voice mode. Start now with your first question.';
      parts = [P.mistakes(10), P.words(8, 'words I needed but did not know')];
    } else if (id === 'words') {
      const n = [10, 15, 20, 30].indexOf(+input.n) >= 0 ? +input.n : 10;
      user = 'Teach me ' + n + ' useful English words or fixed phrases about: ' + cap(input.topic, 300).trim() + '. Choose items an educated speaker really uses for this topic, at my level and one step above, that I am unlikely to know yet. Point out false friends or confusions typical of Arabic speakers.';
      parts = [P.words(n)];
    } else if (id === 'lesson') {
      user = 'Give me a mini-lesson on: ' + (cap(input.topic, 300).trim() || 'the grammar point that would help me most now, judging from my mistakes and level') + '. Explain it simply in Arabic with English examples, then show the typical mistakes of Arabic speakers.';
      parts = [P.lesson]; ex = true;
    } else if (id === 'read') {
      const len = { A2: '150-200', B1: '250-300', B2: '350-420', C1: '450-550' }[lvl] || '250-300';
      user = 'Write an original reading text for me about: ' + (cap(input.topic, 300).trim() || 'a topic from my field') + '. Length: ' + len + ' words in 3-6 paragraphs, IELTS Academic style adapted to level ' + lvl + '. In your visible reply write only one introductory line: the text itself goes inside the pack.';
      parts = [P.reading, P.words(8, 'key words from the text')]; qs = true;
    } else if (id === 'photo') {
      user = 'I am attaching a photo (an English text, a question, or something I saw). Explain it to me in Arabic at my level: the meaning, the difficult words and any grammar worth noticing. If it is an exercise, guide me to the answer step by step instead of only giving it.';
      parts = [P.words(10, 'words from the photo')];
    } else if (id === 'plan') {
      user = 'Review my study plan and results like a personal coach. Tell me in Arabic what is going well, what worries you, and at most THREE concrete changes. Be realistic about my time.';
      parts = [P.plan]; plan = true;
    } else if (id === 'word') {
      const v = F.DB.byId[input.id] || {};
      user = 'Help me really master the word "' + clean(v.w || input.w, 60) + '" (' + clean(v.ar || input.ar, 120) + '). Give me its main meanings with 4 short examples at my level, the most common collocations, how it differs from similar words, a memory trick in Arabic, and then ask me 3 quick questions to check that I can use it (wait for my answers).';
      parts = [P.words(5, 'related words or collocations; do not repeat the word itself')];
    } else if (id === 'explain') {
      user = 'Explain this English text to me in Arabic at my level: overall meaning, difficult words and useful expressions.\nTEXT:\n' + cap(input.text, 3000).trim();
      parts = [P.words(10, 'words from the text')];
    } else { // ask
      user = cap(input.text, 2000).trim();
      parts = ['(only the parts that are useful)', P.words(8), P.mistakes(5)];
    }
    const ab = about(plan), pk = packSection(parts, ex, qs);
    const sys = ['You are my personal English tutor. I am learning English with a spaced-repetition app called Fasih.', ab, HOW, pk].join('\n\n');
    const mk = u => '[Fasih tutor request]\nI am learning English with a spaced-repetition app called Fasih. Please act as my personal English tutor.\n\nMY REQUEST: ' + u + '\n\n' + ab + '\n\n' + HOW + '\n\n' + pk;
    let text = mk(user);
    if (text.length > 24000) { user = user.slice(0, Math.max(0, user.length - (text.length - 24000) - 3)) + '...'; text = mk(user); }
    return { title: (REQ[id] || REQ.ask).t, system: sys, user, text };
  };
  Tu.prompt = (id, input) => Tu.build(id, input).text;
  Tu.standing = () => ['You are my personal English tutor. I am an Arabic speaker (Algeria) learning English with a spaced-repetition app called Fasih. Goal: CEFR C1 and IELTS Academic band 7+ within 18 months. My field: law, anti-corruption and transparency, and AI.', HOW, 'Whenever I ask for a Fasih pack, or when you have material I should study, end your reply with:\n' + packSection(ALLP(), true, true)].join('\n\n');
  Tu.system = () => ['You are my personal English tutor. I am learning English with a spaced-repetition app called Fasih.', about(false), HOW, 'Include a Fasih pack only when it is useful (for example after a correction, a new lesson or a list of words), not after every message.\n' + packSection(ALLP(), true, true)].join('\n\n');

  /* ---------- clipboard and sending ---------- */
  const copy = (text, cb) => {
    cb = cb || (() => {});
    if (F.isApp) { const r = F.nat('copyText', String(text)); if (r !== undefined) return cb(!!r); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(String(text)).then(() => cb(true), () => cb(false)); return; } } catch (e) { /* ignore */ }
    cb(false);
  };
  const readClip = cb => {
    if (F.isApp) { const t = F.nat('pasteText'); if (t !== undefined) return cb(String(t || '')); }
    try { if (navigator.clipboard && navigator.clipboard.readText) { navigator.clipboard.readText().then(t => cb(String(t || '')), () => cb(null)); return; } } catch (e) { /* ignore */ }
    cb(null);
  };
  const copySheet = text => {
    const s = F.sheet(`<h3>انسخ طلبك يدوياً</h3><div class="hint">تعذّر النسخ التلقائي. حدّد كل النص في المربع وانسخه، ثم الصقه في تطبيق الذكاء.</div><textarea class="inp en tu-ta" dir="ltr" rows="9" readonly>${esc(text)}</textarea><div class="row"><button class="btn ghost sel">تحديد الكل</button></div>`);
    const ta = s.querySelector('textarea'); s.querySelector('.sel').onclick = () => { ta.focus(); ta.select(); };
  };
  Tu.send = (id, input, imgId) => {
    const T = T0(), ai = T.ai, nm = aiName(ai); imgId = imgId ? String(imgId) : '';
    const b = Tu.build(id, input);
    F.closeSheet();
    const rec = () => { T.sent++; T.last = { req: id, ai, at: F.now() }; F.save(); };
    if (T.mode === 'api') {
      if (ai !== 'other' && chatOk(ai) && F.chat.start) { rec(); F.chat.start({ title: b.title, system: b.system, user: b.user, img: imgId }); return 'api'; }
      if (F.chat && F.chat.keys && ai !== 'other') { F.toast('احفظ مفتاح ' + nm + ' أولاً ثم أعد الإرسال'); F.chat.keys(); return 'keys'; }
      F.toast('المحادثة داخل التطبيق غير متاحة الآن: نكمل عبر تطبيق الذكاء.');
    }
    rec();
    const res = F.nat('aiSend', String(ai), String(b.text), imgId);
    if (res === undefined) { // browser or an older app: copy, then open the website (never put the text in a URL)
      const a = F.AIS.find(x => x.k === ai);
      copy(b.text, ok => { if (!ok) copySheet(b.text); else F.toast(a ? 'نُسخ طلبك وفُتح موقع ' + nm + '. الصقه هناك.' : 'نُسخ طلبك. الصقه في تطبيق الذكاء الذي تريده.'); });
      if (a) F.openUrl(a.url);
      return 'web';
    }
    if (res === 'send') F.toast('فُتح ' + nm + ' ومعه طلبك. إن لم يظهر النص فالصقه، فهو منسوخ.');
    else if (res === 'sendimg') F.toast('فُتح ' + nm + ' ومعه الصورة. الصق الطلب في خانة الرسالة، فهو منسوخ.');
    else if (res === 'copy') F.toast('نُسخ طلبك. الصقه في خانة الرسالة في ' + nm + '.' + (imgId ? ' وأرفق الصورة من هناك.' : ''));
    else if (res === 'web') F.toast(nm + ' غير مثبّت: فتحتُ موقعه، والطلب منسوخ فالصقه هناك.');
    else if (res !== 'chooser') copySheet(b.text);
    return String(res);
  };

  /* ---------- pending things ---------- */
  let sharedText = null;
  const dueMistakes = () => T0().mistakes.filter(m => m.box < 5 && m.due <= dayNum());
  Tu.pending = () => {
    const S = F.S, T = T0();
    const lessons = T.lessons.filter(l => !S.gram[l.id]), readings = T.readings.filter(r => !doneMap('reading')[r.id]), quizzes = T.quizzes.filter(q => !doneMap('tquiz')[q.id]);
    const errs = dueMistakes().length, words = F.tutorQueue().length, shared = !!sharedText;
    return { lessons, readings, quizzes, errs, words, shared, total: lessons.length + readings.length + quizzes.length + errs + words + (shared ? 1 : 0) };
  };
  Tu.homeCard = () => {
    const p = Tu.pending(); if (!p.total) return '';
    const a = [];
    if (p.words) a.push('كلمات جديدة: ' + p.words); if (p.lessons.length) a.push('دروس: ' + p.lessons.length); if (p.readings.length) a.push('نصوص قراءة: ' + p.readings.length); if (p.quizzes.length) a.push('تمارين: ' + p.quizzes.length); if (p.errs) a.push('أخطاء للمراجعة: ' + p.errs); if (p.shared) a.push('نص وصل من تطبيق آخر');
    return `<section class="card tu-home"><div class="crow"><b>🎓 من المعلّم</b></div><div class="tu-sum">${esc(a.join(' · '))}</div><button class="btn ghost" data-go="tutor">افتح المعلّم ›</button></section>`;
  };

  /* ---------- the preview sheet ---------- */
  const errText = e => e === 'ver' ? 'هذه الحزمة بصيغة أحدث من تطبيقك. حدّث تطبيق فصيح ثم أعد المحاولة.' : e === 'json' ? 'وجدتُ حزمة لكن شكلها غير صالح (JSON مكسور). اطلب من المعلّم: «أعد حزمة فصيح كاملة في كتلة json واحدة صالحة».' : 'لم أجد «حزمة فصيح» في هذا النص. انسخ كتلة الكود الأخيرة من رد المعلّم (تبدأ بـ {"fasih":1) ثم الصقها هنا.';
  const rcode = v => ({ 0.85: 'مخففة', 0.9: 'متوازنة', 0.93: 'مكثفة' }[v] || v);
  const PL = { dailyMin: ['وقت الدراسة اليومي', v => v + ' د'], newPerDay: ['كلمات جديدة في اليوم', v => v], domain: ['نسبة مصطلحات تخصصك', v => v + '%'], retention: ['وتيرة المراجعة', rcode] };
  const planRows = (plan, boxes) => {
    const S = F.S, T = T0(), rows = [];
    PLAN_KEYS.forEach(k => { if (plan[k] != null) rows.push(`<label class="tu-row">${boxes ? `<input type="checkbox" data-g="p" data-k="${k}" checked>` : ''}<span><b>${PL[k][0]}</b>: ${esc(PL[k][1](S.set[k]))} ← <b>${esc(PL[k][1](plan[k]))}</b></span></label>`); });
    if (plan.focus) rows.push(`<label class="tu-row">${boxes ? '<input type="checkbox" data-g="p" data-k="focus" checked>' : ''}<span><b>تركيز إضافي</b>: ${T.focus && dayNum() <= T.focus.until ? esc(SKILLS[T.focus.skill]) : 'لا يوجد'} ← <b>${esc(SKILLS[plan.focus])} لمدة ${plan.focusDays} يوماً</b></span></label>`);
    return rows.join('');
  };
  Tu.preview = (pack, onDone) => {
    let n; try { n = pack && pack._n ? pack : Tu.normalise(pack); } catch (e) { console.error(e); n = { empty: true }; }
    if (n.empty) {
      const s = F.sheet(`<div class="sum"><div class="sumic">📭</div><h2>الحزمة فارغة أو غير صالحة</h2>${n.known ? `<div class="suml">كل كلماتها عندك أصلاً (${n.known})</div>` : ''}<button class="btn big cls">حسناً</button></div>`, 'small');
      s.querySelector('.cls').onclick = F.closeSheet; if (onDone) onDone(false); return;
    }
    let h = `<h3>📦 ${esc(n.title)}</h3>${n.note ? `<div class="tipbox">${esc(n.note)}</div>` : ''}`;
    if (n.words.length) h += `<h4 class="tu-h">كلمات جديدة (${n.words.length})</h4>` + n.words.map((w, i) => `<label class="tu-row"><input type="checkbox" data-g="w" data-i="${i}" checked><span><b class="en" dir="ltr">${esc(w.w)}</b> <em class="tag l${w.l}">${w.l}</em> — ${esc(w.ar)}</span></label>`).join('');
    if (n.mistakes.length) h += `<h4 class="tu-h">أخطاء تدخل دفترك (${n.mistakes.length})</h4>` + n.mistakes.map((m, i) => `<label class="tu-row"><input type="checkbox" data-g="m" data-i="${i}" checked><span class="en" dir="ltr"><span class="bad">✗ ${esc(m.q)}</span><br><span class="good">✓ ${esc(m.q.replace(m.bad, () => m.good[0]))}</span></span></label>`).join('');
    if (n.lessons.length) h += `<h4 class="tu-h">دروس</h4>` + n.lessons.map(l => `<div class="tu-row"><span>📘 <b class="en" dir="ltr">${esc(l.title)}</b> · ${l.exs.length} تمرين</span></div>`).join('');
    if (n.readings.length) h += `<h4 class="tu-h">نصوص قراءة</h4>` + n.readings.map(r => `<div class="tu-row"><span>📖 <b class="en" dir="ltr">${esc(r.title)}</b> · ${r.qs.length} أسئلة</span></div>`).join('');
    if (n.quizzes.length) h += `<h4 class="tu-h">تمارين</h4>` + n.quizzes.map(q => `<div class="tu-row"><span>🧪 <b>${esc(q.title)}</b> · ${q.exs.length} تمرين</span></div>`).join('');
    if (n.plan) h += `<h4 class="tu-h">تعديلات مقترحة على خطتك</h4>${planRows(n.plan, true)}${n.plan.why ? `<div class="hint">${esc(n.plan.why)}</div>` : ''}`;
    const bits = [];
    if (n.prio.length) bits.push('كلمات موجودة في مفرداتك ستُقدَّم أولاً: ' + n.prio.length);
    if (n.known) bits.push('كلمات تعرفها أصلاً: ' + n.known);
    if (n.drop) bits.push('استُبعد ' + n.drop + ' عنصراً غير صالح أو زائد عن الحد');
    if (bits.length) h += `<div class="hint tu-cnt">${esc(bits.join(' · '))}</div>`;
    h += '<div class="row"><button class="btn ghost no">إلغاء</button><button class="btn go">أضف إلى خطتي</button></div>';
    const s = F.sheet(h, 'tu-prev');
    s.querySelector('.no').onclick = () => { F.closeSheet(); if (onDone) onDone(false); };
    s.querySelector('.go').onclick = () => {
      const on = g => Array.from(s.querySelectorAll(`input[data-g="${g}"]`)).filter(x => x.checked);
      const sel = Object.assign({}, n, { words: on('w').map(x => n.words[+x.dataset.i]), mistakes: on('m').map(x => n.mistakes[+x.dataset.i]) });
      if (n.plan) { const keep = on('p').map(x => x.dataset.k), pl = { why: n.plan.why }; keep.forEach(k => { pl[k] = n.plan[k]; if (k === 'focus') pl.focusDays = n.plan.focusDays; }); sel.plan = keep.length ? pl : null; }
      if (!(sel.words.length || sel.prio.length || sel.mistakes.length || sel.lessons.length || sel.readings.length || sel.quizzes.length || sel.plan || sel.note)) return F.toast('لم تختر شيئاً');
      Tu.apply(sel); F.closeSheet(); F.toast('أُضيفت الحزمة ✓'); if (onDone) onDone(true); F.go('tutor');
    };
  };

  /* ---------- importing ---------- */
  const handleText = (txt, again) => {
    const r = Tu.parse(txt);
    if (r.ok) return Tu.preview(r.pack);
    pasteSheet(errText(r.err), again ? txt : '');
  };
  const pasteSheet = (msg, val) => {
    const s = F.sheet(`<h3>📥 الصق حزمة فصيح</h3>${msg ? `<div class="hint tu-err">${esc(msg)}</div>` : '<div class="hint">انسخ كتلة الكود الأخيرة من رد المعلّم، ثم الصقها في المربع.</div>'}<textarea class="inp en tu-ta" dir="ltr" rows="8" placeholder='{"fasih":1,...}'>${esc(val || '')}</textarea><div class="row"><button class="btn go">معاينة</button></div>`);
    const ta = s.querySelector('textarea'); s.querySelector('.go').onclick = () => { const v = ta.value; if (!v.trim()) return F.toast('الصق الحزمة أولاً'); handleText(v, true); };
  };
  const importFlow = () => readClip(t => { if (t === null) return pasteSheet(''); if (!t.trim()) return pasteSheet('الحافظة فارغة. انسخ «حزمة فصيح» من رد المعلّم أولاً.'); handleText(t, false); });
  Tu.importClipboard = importFlow;

  /* text shared into Fasih from another app */
  const onShared = text => {
    const S = F.S; if (!S || !S.onboard || !text) return;
    if (F.runner) { sharedText = String(text); F.toast('وصلت حزمة: تجدها في تبويب المعلّم بعد الجلسة'); return; }
    handleShared(String(text));
  };
  const handleShared = text => {
    sharedText = null;
    const r = Tu.parse(text);
    if (r.ok) return Tu.preview(r.pack);
    if (r.err !== 'none') return pasteSheet(errText(r.err), text);
    const t = text.trim();
    if (t.length <= 40 && t.split(/\s+/).length <= 4 && /[A-Za-z]/.test(t)) return F.addWordSheet(t);
    const s = F.sheet(`<h3>نص من تطبيق آخر</h3><div class="tu-quote" dir="auto">${esc(t.slice(0, 300))}${t.length > 300 ? '…' : ''}</div><div class="row"><button class="btn ghost no">إغلاق</button><button class="btn ex">🎓 اطلب شرحه من المعلّم</button></div>`);
    s.querySelector('.no').onclick = F.closeSheet; s.querySelector('.ex').onclick = () => reqSheet('explain', { text: t });
  };
  /* a photo shared into Fasih from another app: the photo request opens with it attached */
  let sharedImg = null;
  const onSharedImg = id => {
    const S = F.S; if (!S || !S.onboard || !id) return;
    if (F.runner) { sharedImg = String(id); F.toast('وصلت صورة: تجدها في تبويب المعلّم بعد الجلسة'); return; }
    sharedImg = null; F.closeSheet(); if (F.go) F.go('tutor'); reqSheet('photo', { img: String(id) });
  };
  const takeShared = () => { const t = F.nat('takeShared'); if (typeof t === 'string' && t) onShared(t); const im = F.nat('takeSharedImage'); if (typeof im === 'string' && im) onSharedImg(im); };
  F.on('shared', takeShared);
  { const boot = () => setTimeout(takeShared, 0); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }

  /* ---------- request sheets ---------- */
  const reqSheet = (id, preset) => {
    const R = REQ[id]; if (!R) return;
    const T = T0(), S = F.S; preset = preset || {};
    const st = { text: preset.text || '', task: preset.task || '', kind: preset.kind || '', topic: '', mode: 'free', n: 10, img: preset.img ? String(preset.img) : '' };
    const api = T.mode === 'api' && !!F.chat;
    let body = '';
    if (id === 'fix') {
      const picks = Object.keys(S.texts).filter(k => S.texts[k] && S.texts[k].t && S.texts[k].wc >= 3).sort((a, b) => (S.texts[b].day || 0) - (S.texts[a].day || 0)).slice(0, 5);
      body = `<div class="hint">الصق نصك أو اكتبه (حتى 12000 حرف).</div><textarea class="inp en tu-ta tu-text" dir="ltr" rows="7" placeholder="Paste or type your text…">${esc(st.text)}</textarea>` +
        (picks.length ? `<div class="hint">أو اختر من نصوصك المحفوظة:</div><div class="tu-picks">${picks.map((k, i) => `<button class="chip tu-pk" data-i="${i}"><span class="en" dir="ltr">${esc(S.texts[k].t.slice(0, 36))}…</span></button>`).join('')}</div>` : '');
      st.picks = picks;
    } else if (id === 'talk') {
      body = `<label class="tu-l">نوع المحادثة<select class="inp tu-mode">${Object.keys(TALK).map(k => `<option value="${k}">${TALK[k][0]}</option>`).join('')}</select></label><label class="tu-l">الموضوع (اختياري)<input class="inp en tu-topic" dir="ltr" maxlength="300" placeholder="e.g. technology in courts"></label><div class="hint">للمحادثة الصوتية افتح الوضع الصوتي في ${esc(aiName())} بعد إرسال الرسالة. قل finish حين تريد الملاحظات.</div>`;
    } else if (id === 'words') {
      body = `<label class="tu-l">الموضوع<input class="inp en tu-topic" dir="ltr" maxlength="300" placeholder="e.g. public procurement"></label><label class="tu-l">عدد الكلمات<select class="inp tu-n">${[10, 15, 20, 30].map(x => `<option>${x}</option>`).join('')}</select></label>`;
    } else if (id === 'lesson' || id === 'read') {
      body = `<label class="tu-l">${id === 'lesson' ? 'موضوع الدرس (اختياري)' : 'موضوع النص (اختياري)'}<input class="inp en tu-topic" dir="ltr" maxlength="300" placeholder="${id === 'lesson' ? 'e.g. present perfect' : 'e.g. corruption and technology'}"></label>`;
    } else if (id === 'ask') {
      body = '<textarea class="inp tu-ta tu-text" dir="auto" rows="5" maxlength="2000" placeholder="اكتب سؤالك بالعربية أو الإنجليزية"></textarea>';
    } else if (id === 'photo') {
      body = `<div class="hint">${F.img.ok() ? 'ابدأ بالتقاط الصورة أو اختيارها، ثم أرفقها في ' + esc(aiName()) + ' إن لم تصل معها.' : 'أرفق الصورة في ' + esc(aiName()) + ' قبل أن ترسل الرسالة.'}</div>`;
    } else if (id === 'word') {
      const v = F.DB.byId[preset.id] || {};
      body = `<div class="vword"><span class="en" dir="ltr">${esc(v.w || '')}</span></div><div class="vmean">${esc(v.ar || '')}</div>`;
    } else if (id === 'explain') {
      body = `<div class="tu-quote" dir="auto">${esc(String(preset.text || '').slice(0, 300))}</div>`;
    } else if (id === 'plan') body = '<div class="hint">سيُرسل ملخص أيامك الأخيرة ونتائجك وإعداداتك الحالية.</div>';
    const photo = F.img.ok() ? '<div class="tu-photo"><div class="row"><button class="btn ghost pcam">📷 التقط صورة</button><button class="btn ghost pgal">🖼️ من المعرض</button></div><div class="tu-th"></div></div>' : '';
    const s = F.sheet(`<h3>${R.ic || '🎓'} ${esc(R.n || R.t)}</h3>${R.d ? `<div class="hint">${esc(R.d)}</div>` : ''}${body}${photo}<details class="gl tu-det"><summary>ما الذي سيُرسل؟</summary><pre class="tu-pre" dir="ltr"></pre></details><button class="btn big tu-send">${api ? 'ابدأ المحادثة ›' : 'أرسل إلى ' + esc(aiName()) + ' ›'}</button>`, 'tu-req');
    const q = sel => s.querySelector(sel), pre = q('.tu-pre');
    const input = () => id === 'fix' ? { text: st.text, task: st.task, kind: st.kind } : id === 'talk' ? { mode: st.mode, topic: st.topic } : id === 'words' ? { topic: st.topic, n: st.n } : id === 'lesson' || id === 'read' ? { topic: st.topic } : id === 'ask' ? { text: st.text } : id === 'word' ? { id: preset.id } : id === 'explain' ? { text: preset.text } : {};
    const upd = () => { try { pre.textContent = Tu.prompt(id, input()); } catch (e) { pre.textContent = String(e); } };
    const ta = q('.tu-text'); if (ta) ta.oninput = () => { st.text = ta.value; upd(); };
    const tp = q('.tu-topic'); if (tp) tp.oninput = () => { st.topic = tp.value; upd(); };
    const md = q('.tu-mode'); if (md) md.onchange = () => { st.mode = md.value; upd(); };
    const nn = q('.tu-n'); if (nn) nn.onchange = () => { st.n = +nn.value; upd(); };
    (st.picks || []).forEach((k, i) => { const b = q('.tu-pk[data-i="' + i + '"]'); if (b) b.onclick = () => { const x = S.texts[k], o = F.DB.byId[k]; st.text = x.t; st.task = o ? String(o.prompt || o.task || '') : ''; st.kind = /^w2/.test(k) ? 'w2' : /^w1/.test(k) ? 'w1' : ''; ta.value = x.t; upd(); }; });
    const draw = () => { const th = q('.tu-th'); if (!th) return; th.innerHTML = st.img ? `<span class="tu-ph"><img alt="" src="${esc(F.img.url(st.img))}"><button class="tu-x" aria-label="إزالة">✕</button></span>` : ''; const x = th.querySelector('.tu-x'); if (x) x.onclick = () => { st.img = ''; draw(); }; };
    const pick = src => F.img.pick(src, r => { if (r && document.body.contains(s)) { st.img = r.id; draw(); } });
    if (q('.pcam')) { q('.pcam').onclick = () => pick('camera'); q('.pgal').onclick = () => pick('gallery'); }
    q('.tu-send').onclick = () => {
      if (id === 'fix' && st.text.trim().length < 3) return F.toast('الصق نصك أولاً');
      if (id === 'words' && !st.topic.trim()) return F.toast('اكتب الموضوع أولاً');
      if (id === 'ask' && !st.text.trim()) return F.toast('اكتب سؤالك أولاً');
      Tu.send(id, input(), st.img);
    };
    upd(); draw();
  };
  Tu.requestSheet = reqSheet;

  /* ---------- the mistakes notebook ---------- */
  const fixedOf = m => m.q.replace(m.bad, () => m.good[0]);
  const dots = m => `<span class="tu-dots" title="${m.box}/5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= m.box ? 'on' : ''}"></i>`).join('')}</span>`;
  const errsPage = () => {
    const T = T0(), due = dueMistakes().length, all = T.mistakes.slice().reverse(), mast = T.mistakes.filter(m => m.box >= 5).length;
    return `<header class="top"><div><button class="back" data-go="tutor">‹ المعلّم</button><h1>دفتر أخطائي</h1><small>${all.length} خطأ · ${mast} متقَن</small></div></header>
      ${due ? `<button class="btn big" data-a="tu" data-k="errrun">راجع الآن (${due})</button>` : ''}
      ${all.length ? `<div class="tu-errs">${all.map(m => `<section class="card tu-err1"><div class="en bad" dir="ltr">✗ ${esc(m.q)}</div><div class="en good" dir="ltr">✓ ${esc(fixedOf(m))}</div>${m.why ? `<div class="mar">${esc(m.why)}</div>` : ''}<div class="crow">${dots(m)}<span>${m.box >= 5 ? 'متقَن ✓' : m.due <= dayNum() ? 'مستحق الآن' : 'بعد ' + (m.due - dayNum()) + ' ي'}</span></div></section>`).join('')}</div>` : '<div class="card note">دفترك فارغ. عندما تصحّح كتابتك أو تحاور المعلّم تدخل أخطاؤك هنا، وتعود إليك في مراجعات متباعدة حتى تتقنها.</div>'}`;
  };

  /* ---------- flows ---------- */
  const startFlow = (kind, ref) => { F.flows[kind]({ t: kind, ref, free: true }, () => { F.checkBadges(); F.save(); F.render(); }); };
  F.flows.tquiz = (task, end) => {
    const q = F.DB.byId[task.ref]; if (!q || !q.exs) return end(false, {});
    let ok = 0, n = 0, score = 0;
    const R = new F.Runner({ title: 'تمارين من المعلّم', onClose: fin => end(fin, { score }) });
    q.exs.forEach(e => R.add((el, done) => F.Ex.run(el, e, r => { n++; if (r.ok) { ok++; F.addXP(1); } done(r); })));
    R.tail = (el, done) => {
      score = n ? +(ok / n).toFixed(2) : 0; F.markDone('tquiz', q.id, { score }); F.addXP(15 + ok);
      F.summary({ ic: '🎓', title: q.title, lines: [`النتيجة: <b>${ok} / ${n}</b> (${n ? Math.round(100 * ok / n) : 0}%)`, score >= 0.8 ? 'مستوى ممتاز.' : 'أعد هذه التمارين بعد يومين لتثبت.'] })(el, done);
    };
    R.open();
  };
  F.flows.terr = (task, end) => {
    const T = T0(), list = dueMistakes().sort((a, b) => a.due - b.due).slice(0, 10);
    if (!list.length) { F.toast('لا أخطاء مستحقة للمراجعة 👌'); return end(false, {}); }
    let right = 0;
    const R = new F.Runner({ title: 'دفتر أخطائي', onClose: fin => end(fin, {}) });
    list.forEach(m => R.add((el, done) => F.Ex.fix(el, { q: m.q, bad: m.bad, good: m.good, why: m.why }, r => {
      m.n++; m.ok += r.ok ? 1 : 0;
      if (r.ok) { m.box = Math.min(5, m.box + 1); m.due = dayNum() + [1, 3, 7, 16, 35][m.box - 1]; right++; F.addXP(1); } else { m.box = 0; m.due = dayNum() + 1; }
      F.save(); done(r);
    })));
    R.tail = (el, done) => F.summary({ ic: '📒', title: 'دفتر أخطائي', lines: [`أصبت في <b>${right} / ${list.length}</b>`, `متقَن: <b>${T.mistakes.filter(m => m.box >= 5).length}</b> من ${T.mistakes.length}`, 'ما أخطأت فيه يعود غداً، وما أصبت فيه يتباعد: هذه طريقة إتقانه.'] })(el, done);
    R.open();
  };

  /* ---------- the tutor page ---------- */
  const apps = () => { try { const j = F.isApp ? F.nat('aiApps') : ''; return j ? JSON.parse(j) : {}; } catch (e) { return {}; } };
  const dfmt = t => F.fmtDate(new Date(t));
  const packCounts = r => { const i = r.items || {}, a = []; if ((i.words || []).length) a.push(i.words.length + ' كلمة'); if ((i.prio || []).length) a.push(i.prio.length + ' أولوية'); if ((i.mistakes || []).length) a.push(i.mistakes.length + ' خطأ'); if ((i.lessons || []).length) a.push(i.lessons.length + ' درس'); if ((i.readings || []).length) a.push(i.readings.length + ' نص'); if ((i.quizzes || []).length) a.push(i.quizzes.length + ' تمارين'); if (r.plan) a.push('تعديل خطة'); return a.join(' · '); };
  const mainPage = () => {
    const S = F.S, T = T0(), ap = apps(), hasChat = !!F.chat, api = T.mode === 'api' && hasChat, nm = aiName();
    if (api && T.ai === 'other') T.ai = 'claude';
    const chips = F.AIS.concat(api ? [] : [{ k: 'other', n: 'تطبيق آخر' }]).map(a => `<button class="chip ${T.ai === a.k ? 'on' : ''}" data-a="tu" data-k="ai" data-v="${a.k}">${esc(a.n)}${F.isApp && !api && ap[a.k] && ap[a.k].inst === false ? '<i class="tu-web">عبر الموقع</i>' : ''}</button>`).join('');
    const seg = hasChat ? `<div class="tu-seg"><button class="${api ? '' : 'on'}" data-a="tu" data-k="mode" data-v="bridge">اشتراكي العادي</button><button class="${api ? 'on' : ''}" data-a="tu" data-k="mode" data-v="api">مفتاح API</button></div>` : '';
    const expl = hasChat ? `<div class="hint">${api ? 'المحادثة والصور والحزم كلها داخل فصيح، بمفتاحك أنت وعلى حسابك لدى الشركة.' : 'تُفتح رسالتك في ' + esc(nm) + ' وتكمل المحادثة هناك، ثم تلصق الحزمة هنا.'}</div>` : '';
    const apiRow = api ? `<div class="tu-api"><button class="btn ghost" data-a="tu" data-k="keys">🔑 مفاتيحي</button><small>${chatOk(T.ai) ? 'المفتاح محفوظ ✓' : 'لا مفتاح لـ ' + esc(nm) + ' بعد'}</small><button class="btn" data-a="tu" data-k="chat">💬 افتح المحادثة</button></div>` : '';
    const waiting = !api && T.last && F.now() - T.last.at < 864e5 && !T.packs.some(p => p.at >= T.last.at) ? `<section class="card note"><div>بعد أن يجيبك ${esc(aiName(T.last.ai))}: انسخ «حزمة فصيح» من آخر ردّه ثم اضغط هنا</div><button class="btn" data-a="tu" data-k="import">📥 الصق حزمة فصيح</button></section>` : '';
    const p = Tu.pending();
    const row = (ic, t, sub, attrs) => `<button class="li" ${attrs}><span class="tic">${ic}</span><span class="tb"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="tr">›</span></button>`;
    const pend = p.total ? `<h3 class="sec">بانتظارك</h3><div class="list">${p.shared ? row('📥', 'نص وصل من تطبيق آخر', '', 'data-a="tu" data-k="shared"') : ''}${p.lessons.map(l => row('📘', esc(l.titleAr || l.title), 'درس من المعلّم', `data-a="tu" data-k="lesson" data-id="${esc(l.id)}"`)).join('')}${p.readings.map(r => row('📖', esc(r.title), 'نص قراءة من المعلّم', `data-a="tu" data-k="reading" data-id="${esc(r.id)}"`)).join('')}${p.quizzes.map(q => row('🧪', esc(q.title), `${q.exs.length} تمرين`, `data-a="tu" data-k="quiz" data-id="${esc(q.id)}"`)).join('')}${p.errs ? row('📒', 'دفتر أخطائي: ' + p.errs + ' للمراجعة', '', 'data-a="tu" data-k="errrun"') : ''}${p.words ? row('🌱', 'كلمات جديدة من المعلّم: ' + p.words, 'تأتي أولاً في «كلمات جديدة» اليوم', 'data-go="home"') : ''}</div>` : '';
    const tiles = ['fix', 'talk', 'words', 'lesson', 'read', 'photo', 'plan', 'ask'].map(k => `<button class="tile" data-a="tu" data-k="req" data-v="${k}"><span class="tic">${REQ[k].ic}</span><b>${REQ[k].n}</b><small>${REQ[k].d}</small></button>`).join('');
    const nerr = T.mistakes.length, last = T.packs[0];
    return `<header class="top"><div><h1>المعلّم الذكي</h1><small>${api ? 'تحادثه داخل فصيح بمفتاحك أنت، وما يقترحه يدخل خطتك بعد موافقتك.' : 'يعمل باشتراكك العادي في تطبيق الذكاء. بلا مفاتيح ولا رسوم إضافية.'}</small></div></header>
      <section class="card"><div class="chipsrow">${chips}</div>${seg}${expl}${apiRow}</section>
      ${waiting}${pend}
      <h3 class="sec">اطلب من معلّمك</h3><div class="tiles">${tiles}</div>
      <div class="row"><button class="btn ghost" data-a="tu" data-k="import">📥 استيراد حزمة</button><button class="btn ghost" data-a="tu" data-k="errs">📒 دفتر أخطائي (${nerr})</button></div>
      ${last && last.note ? `<h3 class="sec">آخر نصيحة</h3><section class="card tip">${esc(last.note)}</section>` : ''}
      <h3 class="sec">الحزم المستوردة</h3>${T.packs.length ? `<div class="list">${T.packs.map(r => `<button class="li" data-a="tu" data-k="pack" data-id="${esc(r.id)}"><span class="tic">📦</span><span class="tb"><b>${esc(r.title)}</b><small>${esc(dfmt(r.at))} · ${esc(packCounts(r))}</small></span><span class="tr">›</span></button>`).join('')}</div>` : '<div class="card note">لا حزم بعد. اختر طلباً من الأعلى، وحين يردّ المعلّم أضف حزمته هنا.</div>'}
      <details class="acc"><summary>كيف يعمل المعلّم؟</summary><p>١. اختر طلباً: يجهّز فصيح رسالة فيها مستواك ونقاط ضعفك وطلبك.<br>٢. يُفتح تطبيق الذكاء الذي اخترته: أرسل الرسالة وتابع المحادثة هناك بالنص أو الصوت أو الصور.<br>٣. انسخ «حزمة فصيح» من آخر الرد والصقها هنا: تراجعها ثم تدخل كلماتها ودروسها وأخطاؤك في خطتك.</p><p>في وضع «اشتراكي العادي» لا يتصل فصيح بالإنترنت: ما يخرج من هاتفك هو الرسالة التي ترسلها أنت عبر تطبيق الذكاء، وتستطيع قراءتها قبل الإرسال.</p><p>في وضع «مفتاح API» يتصل فصيح بخوادم الشركة صاحبة المفتاح وحدها، ليرسل إليها محادثتك ويستقبل ردّها.</p><button class="btn ghost" data-a="tu" data-k="stand">انسخ التعليمات الدائمة</button><div class="hint">الصقها مرة واحدة في تعليمات مشروع Claude أو تعليمات ChatGPT المخصصة أو Gem، فيفهم أي محادثة لاحقة حزمة فصيح.</div></details>`;
  };
  const packSheet = id => {
    const T = T0(), r = T.packs.find(p => p.id === id); if (!r) return;
    const i = r.items || {};
    const lines = [(i.words || []).length ? '🧩 كلمات جديدة: ' + i.words.length : '', (i.prio || []).length ? '⭐ كلمات ستُقدَّم أولاً: ' + i.prio.length : '', (i.mistakes || []).length ? '📒 أخطاء في دفترك: ' + i.mistakes.length : '', (i.lessons || []).length ? '📘 دروس: ' + i.lessons.length : '', (i.readings || []).length ? '📖 نصوص: ' + i.readings.length : '', (i.quizzes || []).length ? '🧪 تمارين: ' + i.quizzes.length : ''].filter(Boolean);
    const pl = r.plan ? Object.keys(r.plan.after || {}).map(k => k === 'focus' ? 'تركيز إضافي: ' + (SKILLS[r.plan.after[k]] || '') : (PL[k] ? PL[k][0] + ': ' + PL[k][1](r.plan.before[k]) + ' ← ' + PL[k][1](r.plan.after[k]) : '')).filter(Boolean) : [];
    const s = F.sheet(`<h3>📦 ${esc(r.title)}</h3><div class="hint">${esc(dfmt(r.at))} · ${esc(aiName(r.ai))}</div>${r.note ? `<div class="tipbox">${esc(r.note)}</div>` : ''}${lines.map(l => `<div class="tu-row"><span>${esc(l)}</span></div>`).join('')}${pl.length ? '<h4 class="tu-h">تعديلات الخطة</h4>' + pl.map(l => `<div class="tu-row"><span>${esc(l)}</span></div>`).join('') + (r.plan.why ? `<div class="hint">${esc(r.plan.why)}</div>` : '') : ''}<div class="row"><button class="btn ghost danger del">🗑️ حذف الحزمة</button></div><div class="hint">الحذف يزيل كلماتها وبطاقاتها ودروسها وأخطاءها، ويُرجع إعدادات الخطة التي غيّرتها إن لم تغيّرها بعدها.</div>`);
    s.querySelector('.del').onclick = () => F.confirm('حذف هذه الحزمة وكل ما أضافته؟', () => { Tu.remove(id); F.toast('حُذفت الحزمة'); F.render(); }, 'احذف');
  };
  const act = {
    ai: el => { const T = T0(); T.ai = el.dataset.v; F.save(); F.render(); },
    mode: el => { const T = T0(); T.mode = el.dataset.v === 'api' ? 'api' : 'bridge'; if (T.mode === 'api' && T.ai === 'other') T.ai = 'claude'; F.save(); F.render(); },
    keys: () => { if (F.chat && F.chat.keys) F.chat.keys(); },
    chat: () => { if (F.chat && F.chat.open) F.chat.open(); },
    req: el => reqSheet(el.dataset.v),
    import: () => importFlow(),
    errs: () => F.go('tutor/errs'),
    errrun: () => startFlow('terr'),
    lesson: el => startFlow('grammar', el.dataset.id),
    reading: el => startFlow('reading', el.dataset.id),
    quiz: el => startFlow('tquiz', el.dataset.id),
    pack: el => packSheet(el.dataset.id),
    shared: () => { const t = sharedText; if (t) handleShared(t); F.render(); },
    stand: () => copy(Tu.standing(), ok => { if (ok) F.toast('نُسخت التعليمات الدائمة ✓'); else copySheet(Tu.standing()); }),
  };
  F.act.tu = el => { try { const f = act[el.dataset.k]; if (f) f(el); } catch (e) { console.error(e); } };
  if (F.routes) F.routes.tutor = p => { T0(); return p && p[0] === 'errs' ? errsPage() : mainPage(); };
  if (F.after) F.after.tutor = () => { if (sharedText && !F.runner) { const t = sharedText; setTimeout(() => { if (sharedText === t) handleShared(t); }, 150); } else if (sharedImg && !F.runner) { const im = sharedImg; setTimeout(() => { if (sharedImg === im) { sharedImg = null; reqSheet('photo', { img: im }); } }, 150); } };
})(window.Fasih);

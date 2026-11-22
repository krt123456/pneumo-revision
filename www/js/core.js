'use strict';
/* Fasih core: helpers, time, native bridge, state, database */
window.Fasih = window.Fasih || {};
(function (F) {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const sample = (a, n) => shuffle(a).slice(0, n);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const DAY = 864e5, SHIFT = 3 * 36e5; // the study day changes at 03:00
  const now = () => Date.now() + (F.timeOffset || 0);
  const dayNum = t => { const d = new Date((t == null ? now() : t) - SHIFT); return Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / DAY); };
  const pad = n => String(n).padStart(2, '0');
  const dateStr = t => { const d = new Date((t == null ? now() : t) - SHIFT); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const dayToDate = n => { const d = new Date(n * DAY); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12); };
  const norm = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim();
  const arNum = n => String(n);
  const fmtDate = d => d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' });
  Object.assign(F, { $, $$, esc, rnd, shuffle, sample, clamp, DAY, now, dayNum, dateStr, dayToDate, norm, arNum, fmtDate, pad });

  /* ---------- native bridge (Android app) with browser fallbacks ---------- */
  const NB = window.FasihNative || null;
  F.isApp = !!NB;
  const nat = (m, ...a) => { try { if (NB && typeof NB[m] === 'function') return NB[m](...a); } catch (e) { console.error('native ' + m, e); } return undefined; };
  F.nat = nat;
  const handlers = {};
  F.on = (type, fn) => { handlers[type] = fn; };
  F.onNative = (type, d) => { try { if (handlers[type]) handlers[type](d || {}); } catch (e) { console.error(e); } };

  F.tts = {
    n: 0, cb: {}, cur: null, itemCb: null,
    ok() { return F.isApp || !!window.speechSynthesis; },
    speak(items, onDone, onItem) {
      if (typeof items === 'string') items = [{ t: items }];
      const S = F.S, acc = (S && S.set.accent) || 'en-GB', base = (S && S.set.rate) || 1;
      items = items.filter(x => x && x.t && String(x.t).trim()).map(x => ({ t: String(x.t), lang: x.lang || acc, rate: +((x.rate || 1) * base).toFixed(2), pitch: x.pitch || 1, pause: x.pause || 0 }));
      this.stop();
      const id = 't' + (++this.n);
      if (!items.length) { if (onDone) setTimeout(onDone, 0); return id; }
      this.cur = id; this.cb[id] = onDone; this.itemCb = onItem || null;
      if (F.isApp) nat('speak', JSON.stringify({ id, items }));
      else if (window.speechSynthesis) {
        let i = 0;
        const step = () => {
          if (this.cur !== id) return;
          if (i >= items.length) return this._done(id);
          const it = items[i], u = new SpeechSynthesisUtterance(it.t);
          u.lang = it.lang; u.rate = it.rate; u.pitch = it.pitch;
          if (this.itemCb) this.itemCb(i);
          u.onend = u.onerror = () => { i++; setTimeout(step, it.pause || 0); };
          speechSynthesis.speak(u);
        };
        step();
      } else setTimeout(() => this._done(id), 200);
      return id;
    },
    stop() { if (F.isApp) nat('stopSpeak'); else if (window.speechSynthesis) speechSynthesis.cancel(); if (this.cur) delete this.cb[this.cur]; this.cur = null; this.itemCb = null; },
    _done(id) { const f = this.cb[id]; delete this.cb[id]; if (this.cur === id) { this.cur = null; this.itemCb = null; } if (f) f(); },
  };
  F.on('tts', d => {
    if (d.ev === 'start') { if (F.tts.cur === d.id && F.tts.itemCb) F.tts.itemCb(d.i); }
    else if (d.ev === 'nolang') { F.ttsMissing = true; F.tts._done(d.id); }
    else F.tts._done(d.id);
  });
  F.say = (t, o) => F.tts.speak([Object.assign({ t }, o || {})]);

  /* speech recognition: handlers {partial(text), result(text, alts), error(code), end()} */
  F.stt = {
    h: null, rec: null,
    ok() { if (F.isApp) return !!nat('sttAvailable'); return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
    start(h) {
      this.h = h || {};
      F.tts.stop();
      if (F.isApp) return nat('sttStart', 'en-US');
      const C = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!C) return this.h.error && this.h.error('none');
      const r = this.rec = new C(); r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 5;
      r.onresult = e => { const res = e.results[e.results.length - 1]; const alts = Array.from(res).map(a => a.transcript); if (res.isFinal) this.h.result && this.h.result(alts[0], alts); else this.h.partial && this.h.partial(alts[0]); };
      r.onerror = e => this.h.error && this.h.error(e.error);
      r.onend = () => this.h.end && this.h.end();
      try { r.start(); } catch (e) { this.h.error && this.h.error('start'); }
    },
    stop() { if (F.isApp) nat('sttStop'); else if (this.rec) try { this.rec.stop(); } catch (e) { /* ignore */ } },
    cancel() { this.h = null; if (F.isApp) nat('sttCancel'); else if (this.rec) try { this.rec.abort(); } catch (e) { /* ignore */ } },
  };
  F.on('stt', d => {
    const h = F.stt.h; if (!h) return;
    if (d.ev === 'partial') h.partial && h.partial(d.text || '');
    else if (d.ev === 'result') h.result && h.result(d.text || '', d.alts || []);
    else if (d.ev === 'error' || d.ev === 'denied') h.error && h.error(d.ev === 'denied' ? 'denied' : d.code);
    else if (d.ev === 'end') h.end && h.end();
    else if (d.ev === 'ready') h.ready && h.ready();
  });
  /* voice recorder (app only) */
  F.rec = {
    h: null, ok() { return F.isApp; },
    start(h) { this.h = h || {}; F.tts.stop(); nat('recStart'); },
    stop() { nat('recStop'); }, play(h) { if (h) this.h = Object.assign(this.h || {}, h); nat('recPlay'); }, stopPlay() { nat('recStopPlay'); },
  };
  F.on('rec', d => { const h = F.rec.h; if (h && h[d.ev]) h[d.ev](d); });
  F.on('perm', d => { if (F.onPerm) F.onPerm(d); });
  F.vibrate = ms => { if (F.isApp) nat('vibrate', ms); else if (navigator.vibrate) navigator.vibrate(ms); };

  /* ---------- small sounds ---------- */
  let actx = null;
  F.beep = kind => {
    if (!F.S || !F.S.set.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = { ok: [[660, 0], [880, 0.09]], bad: [[220, 0]], win: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]], tap: [[500, 0]] }[kind] || [[440, 0]];
      seq.forEach(([f, at]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = kind === 'bad' ? 'triangle' : 'sine'; o.frequency.value = f;
        const t = actx.currentTime + at;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'bad' ? 0.25 : 0.16));
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.3);
      });
    } catch (e) { /* no audio */ }
  };

  /* ---------- state ---------- */
  const KEY = 'fasih-state';
  const DEF = () => ({
    v: 1, created: now(), name: '', onboard: false,
    set: { dailyMin: 60, newPerDay: 10, domain: 20, accent: 'en-GB', rate: 1, retention: 0.9, theme: 'auto', sound: true, auto: true, rem: { on: true, times: ['08:00', '13:00', '19:00'], nagFrom: '20:30', nagEvery: 30, nagUntil: '23:30' } },
    cards: {}, notes: {}, custom: [], ptr: { g: 0, d: 0, c: 0 }, gram: {}, gptr: 0,
    done: {}, texts: {}, day: null, daysDone: 0, hist: {}, streak: { cur: 0, best: 0, last: 0, shields: 0, gotShield: 0 },
    xp: 0, badges: {}, tests: [], mocks: [], rv: { n: 0, ok: 0 }, mod: 1, target: 0, start: 0, lastOpen: 0, place: null, tipNo: 0,
  });
  const merge = (d, s) => { for (const k in s) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) merge(d[k], s[k]); else d[k] = s[k]; } return d; };
  F.load = () => {
    let a = null, b = null;
    try { a = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { a = null; }
    try { const r = nat('restore'); if (r) b = JSON.parse(r); } catch (e) { b = null; }
    let s = a && b ? ((b.savedAt || 0) > (a.savedAt || 0) ? b : a) : (a || b);
    F.S = merge(DEF(), s || {});
    return F.S;
  };
  let saveT = null;
  F.flush = () => {
    if (saveT) { clearTimeout(saveT); saveT = null; }
    if (!F.S) return;
    F.S.savedAt = Date.now();
    const j = JSON.stringify(F.S);
    try { localStorage.setItem(KEY, j); } catch (e) { /* quota */ }
    nat('store', j);
  };
  F.save = () => { if (!saveT) saveT = setTimeout(F.flush, 500); };
  F.exportState = () => JSON.stringify(Object.assign({ _app: 'fasih' }, F.S));
  F.importState = txt => { const o = JSON.parse(txt); if (!o || o._app !== 'fasih' || !o.cards) throw new Error('bad file'); delete o._app; F.S = merge(DEF(), o); F.flush(); };
  window.addEventListener('pagehide', () => F.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) F.flush(); });

  /* ---------- database ---------- */
  const RAW = {};
  F.add = (kind, arr) => { (RAW[kind] = RAW[kind] || []).push(...arr); };
  const LV = { A2: 0, B1: 1, B2: 2, C1: 3 };
  F.LV = LV; F.LVN = ['A2', 'B1', 'B2', 'C1'];
  F.buildDB = () => {
    const D = F.DB = { byId: {}, tracks: { g: [], d: [], c: [] }, vocab: [] };
    const addV = v => { v.id = v.id || (v.w + '|' + v.p); if (D.byId[v.id]) return; D.byId[v.id] = v; D.vocab.push(v); if (D.tracks[v.tr || 'g']) D.tracks[v.tr || 'g'].push(v); };
    (RAW.vocab || []).forEach(addV);
    (F.S.custom || []).forEach(v => { v.tr = 'x'; addV(v); });
    ['g', 'd', 'c'].forEach(k => D.tracks[k].sort((a, b) => (a.o || 0) - (b.o || 0)));
    ['grammar', 'reading', 'listening', 'shadow', 'pron', 'sp1', 'sp2', 'sp3', 'wsent', 'wlesson', 'w2', 'w1', 'guide', 'phrases', 'motiv', 'mission'].forEach(k => {
      D[k] = RAW[k] || [];
      D[k].forEach(o => { if (o.id) D.byId[o.id] = o; });
    });
    D.grammar.sort((a, b) => (LV[a.l] - LV[b.l]) || (a.id < b.id ? -1 : 1));
    D.pos = {}; D.vocab.forEach(v => (D.pos[v.p] = D.pos[v.p] || []).push(v));
    D.lemma = {}; D.vocab.forEach(v => { if (!/ /.test(v.w)) D.lemma[v.w.toLowerCase()] = v; });
  };
  /* find a vocabulary entry for a word tapped in a text */
  F.lookup = w => {
    const L = F.DB.lemma; w = norm(w).replace(/^'+|'+$/g, '');
    if (!w) return null;
    const tries = [w, w.replace(/'s$/, ''), w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ies$/, 'y'), w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/ied$/, 'y'), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/(.)\1ing$/, '$1'), w.replace(/(.)\1ed$/, '$1'), w.replace(/ly$/, ''), w.replace(/er$/, ''), w.replace(/est$/, '')];
    for (const t of tries) if (t && L[t]) return L[t];
    return null;
  };
  F.POS = { n: 'اسم', v: 'فعل', adj: 'صفة', adv: 'ظرف', prep: 'حرف جر', conj: 'أداة ربط', pron: 'ضمير', det: 'محدِّد', phr: 'عبارة', num: 'عدد', excl: 'تعجب' };
})(window.Fasih);

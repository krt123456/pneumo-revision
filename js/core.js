/* Pneumo Révision — cœur : dates, sauvegarde, planning, révisions espacées, XP */
(function () {
  'use strict';
  const P = window.PNEUMO;

  /* ---------- dates (chaînes AAAA-MM-JJ, heure locale) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const D = P.D = {
    iso: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    parse: s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); },
    add: (s, n) => { const d = D.parse(s); d.setDate(d.getDate() + n); return D.iso(d); },
    diff: (a, b) => Math.round((D.parse(a) - D.parse(b)) / 864e5),
    fmt: (s, o) => D.parse(s).toLocaleDateString('fr-FR', o || { weekday: 'long', day: 'numeric', month: 'long' }),
    short: s => s.slice(8, 10) + '/' + s.slice(5, 7),
    wd: s => D.parse(s).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
  };
  let forced = null;
  try { const q = new URLSearchParams(location.search).get('today'); if (/^\d{4}-\d\d-\d\d$/.test(q || '')) forced = q; } catch (e) { /* ignore */ }
  const today = P.today = () => forced || D.iso(new Date());
  P.EXAM = '2026-12-17';
  P.START = '2026-11-17';

  /* ---------- sauvegarde locale ---------- */
  const KEY = 'pneumo-revision-v1';
  const fresh = () => ({
    v: 1, created: D.iso(new Date()), onboard: false,
    L: {}, T: {}, M: {}, X: [], days: {}, err: [], cards: {}, cardNew: {}, qs: {}, qa: {}, wrong: {}, cal: {},
    ann: {}, notes: {}, xp: 0, xpd: {}, bdg: {}, cli: { n: 0, ok: 0, hot: 0, tries: 0 }, ecos: {}, game: { n: 0, pts: 0 },
    set: { theme: 'auto', sound: true, confetti: true, conf: true, newCards: 20, cap: 6 },
  });
  let storageOk = true;
  function load() {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { storageOk = false; return null; }
  }
  const S = Object.assign(fresh(), load() || {});
  S.set = Object.assign(fresh().set, S.set || {});
  try { localStorage.setItem(KEY + '-t', '1'); localStorage.removeItem(KEY + '-t'); } catch (e) { storageOk = false; }
  P.storageOk = () => storageOk;
  let saveT = 0;
  const save = P.save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { storageOk = false; } }, 100);
  };
  window.addEventListener('pagehide', () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } });
  P.S = S;
  P.exportData = () => JSON.stringify(Object.assign({ app: 'pneumo-revision', exported: new Date().toISOString() }, S));
  P.importData = txt => {
    const o = JSON.parse(txt);
    if (!o || typeof o !== 'object' || !o.L) throw new Error('Fichier non reconnu');
    Object.keys(S).forEach(k => delete S[k]);
    Object.assign(S, fresh(), o);
    S.set = Object.assign(fresh().set, o.set || {});
    delete S.app; delete S.exported;
    save();
  };
  P.resetAll = () => { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, fresh()); save(); };

  /* ---------- cours ---------- */
  P.byId = {};
  P.lessons.forEach(l => { P.byId[l.id] = l; });
  P.lesson = id => P.byId[id];
  const LS = id => S.L[id] || (S.L[id] = {});
  P.ls = id => S.L[id] || {};
  P.isStudied = id => !!(S.L[id] && S.L[id].st === 'done');
  const GAPS = P.GAPS = [1, 2, 4, 7, 10]; // J+1, J+3, J+7, J+14 puis tous les 10 jours
  P.study = (id, on) => {
    const l = LS(id);
    if (l.st === 'done') return false;
    l.st = 'done'; l.on = on || today(); l.step = 0; l.due = D.add(l.on, GAPS[0]); l.hist = l.hist || [];
    if (!on) P.addXP(50, 'cours étudié');
    P.checkBadges(); save();
    return true;
  };
  P.unstudy = id => { if (S.L[id]) { S.L[id].st = ''; S.L[id].due = ''; } save(); };
  P.reviewsDue = (d = today()) => P.lessons.filter(x => { const l = S.L[x.id]; return l && l.st === 'done' && l.due && l.due <= d; })
    .sort((a, b) => (S.L[a.id].due < S.L[b.id].due ? -1 : 1));
  // rating : 0 = difficile (demain), 1 = bien (étape suivante), 2 = facile (saute une étape)
  P.review = (id, rating) => {
    const l = LS(id), t = today();
    l.hist = l.hist || []; l.hist.push([t, rating]);
    if (rating === 0) l.due = D.add(t, 1);
    else { l.step = Math.min(GAPS.length - 1, (l.step || 0) + rating); l.due = D.add(t, GAPS[l.step]); }
    l.lastRev = t;
    P.addXP(20 + 5 * rating, 'révision'); P.checkBadges(); save();
  };
  P.revLabel = id => { const n = (P.ls(id).hist || []).length; return n === 0 ? '1re révision (J+1)' : n === 1 ? '2e révision (J+3)' : n === 2 ? '3e révision (J+7)' : n === 3 ? '4e révision (J+14)' : (n + 1) + 'e révision (entretien)'; };

  /* ---------- planning et tâches ---------- */
  P.days = P.plan.map(r => ({ d: r[0], ph: r[1], les: r[2], ann: r[3], cli: r[4], ecos: r[5], h: r[6], lab: r[7] }));
  P.dayOf = d => P.days.find(x => x.d === d);
  function tasksOf(day) {
    const out = [];
    day.les.forEach(lid => out.push({ id: day.d + '|L|' + lid, d: day.d, k: 'lesson', lid }));
    if (day.ann) out.push({ id: day.d + '|A', d: day.d, k: 'annales', txt: day.ann });
    if (day.cli) out.push({ id: day.d + '|C', d: day.d, k: 'cliches', txt: day.cli });
    if (day.ecos) out.push({ id: day.d + '|E', d: day.d, k: 'ecos', txt: day.ecos });
    return out;
  }
  const PLAN_TASKS = P.days.flatMap(tasksOf);
  P.allTasks = () => PLAN_TASKS.concat(S.X.map(x => ({ id: x.id, d: x.d, k: 'extra', lid: x.lid, txt: x.txt })));
  P.eff = t => S.M[t.id] || t.d;
  P.isDone = t => !!(S.T[t.id] && S.T[t.id].d) || (t.k === 'lesson' && P.isStudied(t.lid));
  P.isSkip = t => !!(S.T[t.id] && S.T[t.id].skip);
  P.dayTasks = d => P.allTasks().filter(t => P.eff(t) === d);
  P.overdue = (d = today()) => P.allTasks().filter(t => P.eff(t) < d && !P.isDone(t) && !P.isSkip(t))
    .sort((a, b) => (P.eff(a) < P.eff(b) ? -1 : 1));
  P.findTask = id => P.allTasks().find(t => t.id === id);
  P.setDone = (t, on) => {
    if (on) {
      S.T[t.id] = { d: today() };
      if (t.k === 'lesson' || (t.k === 'extra' && t.lid)) {
        if (!P.study(t.lid)) P.addXP(15, 'tâche faite');
      } else P.addXP(t.k === 'annales' ? 25 : 15, 'tâche faite');
    } else {
      delete S.T[t.id];
      if (t.k === 'lesson' && P.isStudied(t.lid)) P.unstudy(t.lid);
    }
    P.checkBadges(); save();
  };
  P.move = (t, d) => { if (d === t.d) delete S.M[t.id]; else S.M[t.id] = d; delete S.T[t.id]; save(); };
  P.skip = t => { S.T[t.id] = { skip: today() }; save(); };
  P.addExtra = (lid, d, txt) => {
    const id = 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    S.X.push({ id, d: d || today(), lid: lid || null, txt: txt || '' }); save(); return id;
  };
  P.removeExtra = id => { S.X = S.X.filter(x => x.id !== id); delete S.T[id]; delete S.M[id]; save(); };
  P.taskWeight = t => {
    if (t.lid) { const l = P.lesson(t.lid); return 10 + (l && l.ann ? P.annCount(l.ann) : 0); }
    return t.k === 'annales' ? 40 : t.k === 'ecos' ? 12 : 8;
  };
  // Plan de rattrapage : répartit les tâches en retard sur aujourd'hui et les 2 jours suivants, les plus rentables d'abord
  P.spread = (n = 3) => {
    const t0 = today(), load = {};
    for (let i = 0; i < n; i++) { const d = D.add(t0, i); if (d < P.EXAM) load[d] = P.dayTasks(d).filter(t => !P.isDone(t)).length; }
    const days = Object.keys(load);
    if (!days.length) return 0;
    const od = P.overdue().sort((a, b) => P.taskWeight(b) - P.taskWeight(a));
    od.forEach(t => { const best = days.slice().sort((a, b) => load[a] - load[b] || (a < b ? -1 : 1))[0]; S.M[t.id] = best; load[best]++; });
    save(); return od.length;
  };
  P.phaseOf = d => { const x = P.dayOf(d); return x ? x.ph : d < P.START ? 0 : d >= P.EXAM ? 4 : 3; };
  P.PH = { 0: ['Avant le planning', 'gray'], 1: ['1 · Apprendre', 'blue'], 2: ["2 · S'entraîner", 'orange'], 3: ['3 · Consolider', 'green'], 4: ['Examen', 'red'] };

  /* ---------- annales ---------- */
  P.annCount = th => { const a = P.annales[th]; return a ? a[0].length + a[1].length : 0; };
  P.annDone = th => { const a = P.annales[th]; if (!a) return 0; return a[0].filter(n => S.ann['A' + n]).length + a[1].filter(n => S.ann['B' + n]).length; };
  P.toggleAnn = (f, n) => { const k = f + n; if (S.ann[k]) delete S.ann[k]; else { S.ann[k] = today(); P.addXP(2, 'question d\'annales'); } save(); };

  /* ---------- journal du jour ---------- */
  P.day = d => S.days[d] || (S.days[d] = { qcm: null, min: 0, note: '' });

  /* ---------- XP, niveaux, série ---------- */
  P.LEVELS = ['Externe curieux', 'Externe motivé', 'Externe assidu', 'Stagiaire brillant', 'Interne en herbe', 'Interne',
    'Interne de garde', 'Chef de clinique', 'Pneumologue', 'Professeur de pneumo', 'Légende de Blida'];
  P.level = (x = S.xp) => {
    let L = 1, need = 100, acc = 0;
    while (x >= acc + need && L < P.LEVELS.length) { acc += need; L++; need = 100 * L; }
    return { L, title: P.LEVELS[L - 1], from: acc, to: acc + need, pct: Math.min(100, Math.round(100 * (x - acc) / need)) };
  };
  P.addXP = (n, why) => {
    const before = P.level().L;
    S.xp += n; const t = today(); S.xpd[t] = (S.xpd[t] || 0) + n; save();
    if (P.UI) {
      P.UI.toast('+' + n + ' XP · ' + why, 'xp');
      const L = P.level();
      if (L.L > before) { P.UI.toast('Niveau ' + L.L + ' : ' + L.title + ' !', 'xp'); P.UI.confetti(); }
      P.UI.refreshTop();
    }
  };
  P.streak = () => { let d = today(); if (!S.xpd[d]) d = D.add(d, -1); let n = 0; while (S.xpd[d]) { n++; d = D.add(d, -1); } return n; };

  /* ---------- badges ---------- */
  const studiedCount = () => P.lessons.filter(l => P.isStudied(l.id)).length;
  const qTotal = () => Object.values(S.qs).reduce((a, b) => a + (b.n || 0), 0);
  P.BADGES = [
    ['premier', '🌱', 'Premier pas', 'Faire une première tâche', () => Object.keys(S.T).length > 0],
    ['cours1', '📘', 'Premier cours', 'Étudier un cours dans le site', () => P.lessons.some(l => S.L[l.id] && S.L[l.id].st === 'done' && S.L[l.id].on >= S.created)],
    ['serie3', '🔥', 'Série de 3', '3 jours de suite', () => P.streak() >= 3],
    ['serie7', '🚀', 'Semaine parfaite', '7 jours de suite', () => P.streak() >= 7],
    ['serie14', '🏔️', 'Inarrêtable', '14 jours de suite', () => P.streak() >= 14],
    ['journee', '⭐', 'Journée parfaite', 'Toutes les tâches du jour faites', () => { const t = P.dayTasks(today()); return t.length > 0 && t.every(P.isDone) && P.overdue().length === 0; }],
    ['q50', '🎯', '50 questions', 'Répondre à 50 questions', () => qTotal() >= 50],
    ['q300', '🏹', '300 questions', 'Répondre à 300 questions', () => qTotal() >= 300],
    ['sansfaute', '💯', 'Sans faute', '100 % à un quiz de 8 questions ou plus', () => !!S.bdgFlags && !!S.bdgFlags.perfect],
    ['tb', '🦠', 'Maître de la TB', 'Les 4 cours de tuberculose étudiés', () => ['tb-commune', 'tb-extra', 'tb-traitement', 'tb-prevention'].every(P.isStudied)],
    ['moitie', '⛰️', 'Mi-parcours', 'La moitié des cours étudiés', () => studiedCount() >= Math.ceil(P.lessons.length / 2)],
    ['tout', '🏆', 'Programme bouclé', 'Tous les cours étudiés', () => studiedCount() === P.lessons.length],
    ['cliches', '🩻', 'Œil de radiologue', '10 clichés lus au chrono', () => S.cli.n >= 10],
    ['ecos', '🎤', 'Prêt pour l\'ECOS', 'Les 6 TD entraînés', () => P.lessons.filter(l => l.cat === 'td').every(l => S.ecos[l.id])],
    ['erreurs', '🧠', 'Apprendre de ses erreurs', '10 erreurs notées au journal', () => S.err.length >= 10],
    ['cartes', '🃏', 'Collectionneur', '100 cartes révisées', () => Object.values(S.cards).reduce((a, c) => a + (c.r || 0), 0) >= 100],
    ['rattrap', '🛟', 'Rattrapage réussi', 'Revenir à zéro retard après en avoir eu', () => !!S.hadLate && P.overdue().length === 0],
    ['detective', '🕵️', 'Détective', '10 parties de « Qui suis-je ? »', () => S.game.n >= 10],
  ];
  P.checkBadges = () => {
    if (P.overdue().length > 0) S.hadLate = 1;
    P.BADGES.forEach(([id, e, name, , test]) => {
      let ok = false; try { ok = test(); } catch (err) { ok = false; }
      if (ok && !S.bdg[id]) {
        S.bdg[id] = today(); save();
        if (P.UI) { P.UI.toast(e + ' Badge débloqué : ' + name, 'xp'); P.UI.confetti(); }
      }
    });
  };

  /* ---------- statistiques de quiz, erreurs à refaire ---------- */
  P.recordAnswer = (qid, lid, ok, conf) => {
    const s = S.qs[lid] || (S.qs[lid] = { n: 0, ok: 0 });
    s.n++; if (ok) s.ok++;
    S.qa[qid] = [ok ? 1 : 0, conf || '', today()];
    if (conf) { const c = S.cal[conf] || (S.cal[conf] = [0, 0]); c[0]++; if (ok) c[1]++; }
    if (!ok) S.wrong[qid] = { lid, due: D.add(today(), 1), n: ((S.wrong[qid] && S.wrong[qid].n) || 0) + 1 };
    else if (S.wrong[qid]) { const w = S.wrong[qid]; w.ok = (w.ok || 0) + 1; if (w.ok >= 2) delete S.wrong[qid]; else w.due = D.add(today(), 3); }
    save();
  };
  P.mastery = lid => { const s = S.qs[lid]; return s && s.n ? Math.round(100 * s.ok / s.n) : null; };
  P.wrongDue = () => Object.entries(S.wrong).filter(([, w]) => w.due <= today()).map(([q]) => q);

  /* ---------- cartes (Leitner) ---------- */
  const BOX = [0, 1, 2, 4, 7, 14];
  P.cardsOf = lid => {
    const f = P.F[lid]; if (!f) return [];
    const out = [];
    (f.p || []).forEach((p, i) => out.push({ id: lid + '|p' + i, lid, k: 'Piège à corriger', f: '« ' + p[1] + ' »', b: p[2] + (p[3] ? '\n\nPourquoi : ' + p[3] : '') }));
    (f.v || []).forEach((v, i) => out.push({ id: lid + '|v' + i, lid, k: 'Vrai ou faux ?', f: v[0], b: (v[1] ? 'VRAI. ' : 'FAUX. ') + (v[2] || '') }));
    return out;
  };
  P.glossCards = () => (P.gloss || []).map(g => ({ id: 'g|' + g.k, lid: null, k: 'Vocabulaire', f: g.t, b: g.d, ar: g.ar }));
  P.cardsDue = () => {
    const t = today(), due = [], fresh = [];
    const pool = P.lessons.filter(l => P.isStudied(l.id)).flatMap(l => P.cardsOf(l.id));
    pool.forEach(c => { const s = S.cards[c.id]; if (s) { if (s.due <= t) due.push(c); } else fresh.push(c); });
    const used = S.cardNew[t] || 0;
    return due.concat(fresh.slice(0, Math.max(0, S.set.newCards - used)));
  };
  P.rateCard = (c, ok) => {
    const s = S.cards[c.id] || (S.cards[c.id] = { b: 0, r: 0 });
    if (!s.r && !s.b) S.cardNew[today()] = (S.cardNew[today()] || 0) + 1;
    s.r = (s.r || 0) + 1;
    s.b = ok ? Math.min(5, (s.b || 0) + 1) : 1;
    s.due = D.add(today(), BOX[s.b]);
    P.addXP(2, 'carte'); P.checkBadges(); save();
  };
})();

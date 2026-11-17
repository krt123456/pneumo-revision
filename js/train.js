/* Pneumo Révision — entraînement : quiz, cartes, clichés, ECOS, jeu, minuteurs */
(function () {
  'use strict';
  const P = window.PNEUMO, S = P.S, D = P.D, U = P.UI, md = U.md, esc = U.esc;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const L = 'ABCDE';

  /* ---------- minuteur générique (anneau) ---------- */
  P.timer = (el, secs, opt = {}) => {
    let left = secs, end = 0, id = 0, run = false;
    const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    el.innerHTML = '<div class="timer"><svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="74" fill="none" stroke="var(--soft)" stroke-width="12"/><circle class="tr" cx="85" cy="85" r="74" fill="none" stroke="' + (opt.color || '#2f6fde') + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="465" stroke-dashoffset="0" transform="rotate(-90 85 85)"/>' +
      '<text class="tv" x="85" y="95" text-anchor="middle" fill="currentColor" font-size="34" font-weight="900">' + fmt(secs) + '</text></svg></div><div class="row" style="justify-content:center;gap:8px"><button class="btn sm" data-t="go">▶ Démarrer</button><button class="btn sm ghost" data-t="rs">↺</button></div>';
    const tv = el.querySelector('.tv'), tr = el.querySelector('.tr'), go = el.querySelector('[data-t=go]');
    const paint = () => { tv.textContent = fmt(Math.max(0, left)); tr.setAttribute('stroke-dashoffset', (465 * (1 - left / secs)).toFixed(1)); if (left <= 10 && left > 0) tr.setAttribute('stroke', '#de3b3b'); };
    const tick = () => { left = Math.max(0, (end - Date.now()) / 1000); paint(); if (left <= 0) { stop(); U.beep(); if (opt.onEnd) opt.onEnd(); } };
    const start = () => { if (run || left <= 0) return; run = true; end = Date.now() + left * 1000; id = setInterval(tick, 250); P.addTimer(id); go.textContent = '⏸ Pause'; };
    const stop = () => { run = false; clearInterval(id); go.textContent = left > 0 ? '▶ Reprendre' : '✓ Terminé'; };
    go.onclick = () => (run ? stop() : start());
    el.querySelector('[data-t=rs]').onclick = () => { stop(); left = secs; tr.setAttribute('stroke', opt.color || '#2f6fde'); paint(); go.textContent = '▶ Démarrer'; };
    if (opt.auto) start();
    return { start, stop, left: () => left, used: () => secs - left };
  };

  /* ---------- POMODORO : continue pendant la navigation ---------- */
  P.POMO = { focus: 1500, pause: 300 };
  P.pomoLeft = () => { const p = S.pomo; if (!p) return P.POMO.focus; return p.run ? Math.max(0, Math.round((p.end - Date.now()) / 1000)) : (p.left != null ? p.left : P.POMO[p.mode]); };
  P.pomoTick = () => {
    const p = S.pomo, pill = document.getElementById('pomoPill');
    if (p && p.run && Date.now() >= p.end) {
      p.run = false; p.end = 0;
      if (p.mode === 'focus') { const d = P.day(P.today()); d.min = (d.min || 0) + 25; p.mode = 'pause'; P.addXP(15, 'pomodoro'); U.toast('🍅 Séance terminée : 5 minutes de pause'); }
      else { p.mode = 'focus'; U.toast('☕ Pause finie : on reprend'); }
      p.left = P.POMO[p.mode]; P.save(); if (S.set.sound) U.beep();
      if (location.hash.indexOf('#/pomodoro') === 0 && P.pomoRedraw) P.pomoRedraw();
    }
    if (pill) {
      const on = !!(p && p.run);
      pill.hidden = !on || location.hash.indexOf('#/pomodoro') === 0;
      if (on) { const l = P.pomoLeft(); pill.textContent = (p.mode === 'focus' ? '🍅 ' : '☕ ') + Math.floor(l / 60) + ':' + String(l % 60).padStart(2, '0'); }
    }
  };
  setInterval(P.pomoTick, 1000);

  /* ---------- QUIZ ---------- */
  const Q = P.Q = {};
  Q.all = lid => {
    const f = P.F[lid]; if (!f) return [];
    const out = [];
    (f.v || []).forEach((v, i) => out.push({ qid: lid + '|v' + i, lid, type: 'vf', s: v[0], a: !!v[1], e: v[2] || '' }));
    (f.q || []).forEach((q, i) => out.push({ qid: lid + '|q' + i, lid, type: 'qcm', s: q[0], o: q[1], r: q[2], e: q[3] || '' }));
    (f.c || []).forEach((c, j) => c[1].forEach((q, i) => out.push({ qid: lid + '|c' + j + '.' + i, lid, type: 'qcm', cas: c[0], grp: lid + j, s: q[0], o: q[1], r: q[2], e: q[3] || '' })));
    return out;
  };
  Q.byIds = ids => { const want = new Set(ids); return [...new Set(ids.map(i => i.split('|')[0]))].flatMap(Q.all).filter(x => want.has(x.qid)); };
  Q.build = (lids, opt = {}) => {
    let items = lids.flatMap(Q.all);
    if (opt.types) items = items.filter(x => opt.types.includes(x.cas ? 'cas' : x.type));
    const groups = {};
    items.forEach(x => { const g = x.grp || x.qid; (groups[g] = groups[g] || []).push(x); });
    let units = shuffle(Object.values(groups));
    // priorité aux questions jamais vues ou ratées
    units.sort((a, b) => score(a[0]) - score(b[0]));
    if (opt.n) { const out = []; for (const u of units) { if (out.length >= opt.n) break; out.push(...u); } units = [out]; }
    return shuffle(units.length > 1 ? units : [units[0] || []]).flat();
    function score(x) { const a = S.qa[x.qid]; return !a ? Math.random() : a[0] ? 2 + Math.random() : 1 + Math.random() * .5; }
  };
  Q.setup = (el, lids) => {
    const withQ = P.lessons.filter(l => Q.all(l.id).length);
    if (lids && !Q.all(lids[0]).length) { el.innerHTML = '<div class="card empty">Pas encore de questions pour ce cours.</div>'; return; }
    const st = { types: ['vf', 'qcm', 'cas'], n: lids ? 0 : 15, mode: 'train', lids: lids || withQ.filter(l => P.isStudied(l.id)).map(l => l.id) };
    if (!st.lids.length) st.lids = withQ.slice(0, 3).map(l => l.id);
    const draw = () => {
      const avail = Q.build(st.lids, { types: st.types }).length;
      el.innerHTML = '<div class="card">' + (lids ? '' : '<label class="lb">Cours inclus (' + st.lids.length + ')</label><div class="seg" style="flex-wrap:wrap">' + withQ.map(l => '<button data-l="' + l.id + '" class="' + (st.lids.includes(l.id) ? 'on' : '') + '">' + esc(l.s || l.t) + '</button>').join('') + '</div>' +
        '<div class="row wrap" style="gap:6px"><button class="btn xs ghost" data-all="studied">Mes cours étudiés</button><button class="btn xs ghost" data-all="all">Tout</button></div>') +
        '<label class="lb">Types de questions</label><div class="seg">' + [['vf', 'Vrai / faux'], ['qcm', 'QCM'], ['cas', 'Cas cliniques']].map(t => '<button data-ty="' + t[0] + '" class="' + (st.types.includes(t[0]) ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' +
        '<label class="lb">Nombre de questions</label><div class="seg">' + [[10, '10'], [15, '15'], [30, '30'], [0, 'Toutes (' + avail + ')']].map(t => '<button data-n="' + t[0] + '" class="' + (st.n === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' +
        '<label class="lb">Mode</label><div class="seg"><button data-m="train" class="' + (st.mode === 'train' ? 'on' : '') + '">Entraînement (correction immédiate)</button><button data-m="exam" class="' + (st.mode === 'exam' ? 'on' : '') + '">Examen (chrono, correction à la fin)</button></div>' +
        '<button class="btn block" style="margin-top:12px" data-go="1"' + (avail ? '' : ' disabled') + '>Commencer (' + (st.n && st.n < avail ? st.n : avail) + ' questions)</button></div>';
    };
    el.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.l) { const i = st.lids.indexOf(b.dataset.l); if (i >= 0) st.lids.splice(i, 1); else st.lids.push(b.dataset.l); }
      else if (b.dataset.all) st.lids = (b.dataset.all === 'all' ? withQ : withQ.filter(l => P.isStudied(l.id))).map(l => l.id);
      else if (b.dataset.ty) { const i = st.types.indexOf(b.dataset.ty); if (i >= 0 && st.types.length > 1) st.types.splice(i, 1); else if (i < 0) st.types.push(b.dataset.ty); }
      else if (b.dataset.n != null) st.n = +b.dataset.n;
      else if (b.dataset.m) st.mode = b.dataset.m;
      else if (b.dataset.go) { el.onclick = null; Q.run(el, Q.build(st.lids, { types: st.types, n: st.n || 0 }), { exam: st.mode === 'exam' }); return; }
      else return;
      draw();
    };
    draw();
  };
  Q.run = (el, items, opt = {}) => {
    if (!items.length) { el.innerHTML = '<div class="card empty">Aucune question disponible.</div>'; return; }
    let i = 0, sel = new Set(), conf = '', answered = false, ok = 0;
    const res = [];
    let tmr = null, tleft = items.length * 60;
    if (opt.exam) {
      P.leaveGuard = () => confirm('Quitter l\'examen blanc en cours ? Il ne sera pas noté.');
      const end = Date.now() + tleft * 1000;
      tmr = setInterval(() => { tleft = Math.max(0, Math.round((end - Date.now()) / 1000)); const b = el.querySelector('.qtime'); if (b) b.textContent = '⏱ ' + Math.floor(tleft / 60) + ':' + String(tleft % 60).padStart(2, '0'); if (!tleft) { clearInterval(tmr); U.beep(); finish(); } }, 500);
      P.addTimer(tmr);
    }
    const isOk = (it, s) => it.type === 'vf' ? s.has(it.a ? 'V' : 'F') && s.size === 1 : [...it.r].sort().join('') === [...s].sort().join('');
    function draw() {
      const it = items[i], l = P.lesson(it.lid);
      U.resetTerms();
      let h = '<div class="qz"><div class="qn"><span>Question ' + (i + 1) + '/' + items.length + (l ? ' · ' + esc(l.s || l.t) : '') + '</span><span class="qtime">' + (opt.exam ? '' : '✓ ' + ok) + '</span></div><div class="bar" style="margin-bottom:10px"><i style="width:' + (100 * i / items.length) + '%"></i></div>';
      if (it.cas) h += '<div class="case">🩺 ' + md(it.cas) + '</div>';
      h += '<div class="stem">' + (it.type === 'vf' ? '<span class="chip purple" style="margin-right:6px">Vrai ou faux ?</span>' : '') + md(it.s) + '</div>';
      const confH = S.set.conf && !opt.compact ? '<div class="conf"><span class="muted">Ma confiance' + (it.type === 'vf' ? ' (avant de répondre)' : '') + ' :</span>' + [['sur', 'Sûr'], ['hesite', 'J\'hésite'], ['hasard', 'Au hasard']].map(([k, t]) => '<button data-c="' + k + '" class="' + (conf === k ? 'on' : '') + '">' + t + '</button>').join('') + '</div>' : '';
      if (it.type === 'vf') h += confH + '<div class="vf">' + [['V', 'Vrai'], ['F', 'Faux']].map(([k, t]) => '<button class="opt" data-o="' + k + '">' + t + '</button>').join('') + '</div>';
      else h += it.o.map((o, j) => '<button class="opt" data-o="' + L[j] + '"><span class="L">' + L[j] + '</span><span class="grow">' + md(o, true) + '</span></button>').join('') + '<p class="small muted" style="margin:4px 2px 0">Une ou plusieurs réponses justes : coche tout ce qui est vrai.</p>' + confH;
      h += '<div class="fbx"></div><div class="row" style="margin-top:12px;justify-content:flex-end;gap:8px"><button class="btn" data-v="1"' + (it.type === 'vf' ? ' style="display:none"' : '') + ' disabled>Valider</button></div></div>';
      el.innerHTML = h;
      paintSel();
    }
    function paintSel() { el.querySelectorAll('.opt').forEach(b => b.classList.toggle('sel', sel.has(b.dataset.o))); const v = el.querySelector('[data-v]'); if (v) v.disabled = !sel.size; }
    function validate() {
      const it = items[i]; answered = true;
      const good = isOk(it, sel);
      if (good) ok++;
      res.push({ it, good, sel: [...sel] });
      P.recordAnswer(it.qid, it.lid, good, conf);
      if (opt.exam) { next(); return; }
      const right = it.type === 'vf' ? new Set([it.a ? 'V' : 'F']) : new Set(it.r);
      el.querySelectorAll('.opt').forEach(b => { const o = b.dataset.o; b.classList.remove('sel'); if (right.has(o) && sel.has(o)) b.classList.add('ok'); else if (sel.has(o)) b.classList.add('ko'); else if (right.has(o)) b.classList.add('miss'); b.disabled = true; });
      el.querySelector('.fbx').innerHTML = '<div class="fb ' + (good ? 'ok' : 'ko') + '"><b class="v">' + (good ? '✓ Bonne réponse' : '✗ ' + (it.type === 'vf' ? 'C\'était ' + (it.a ? 'VRAI' : 'FAUX') : 'Réponse : ' + it.r.split('').join(', '))) + '</b>' + (it.e ? '<div style="margin-top:4px">' + md(it.e) + '</div>' : '') +
        (!good ? '<div style="margin-top:8px"><button class="btn xs ghost" data-j="1">+ Journal d\'erreurs</button></div>' : '') + '</div>';
      const v = el.querySelector('[data-v]'); v.style.display = ''; v.disabled = false; v.textContent = i + 1 < items.length ? 'Suivant →' : 'Voir mon score';
    }
    function next() { i++; sel = new Set(); conf = ''; answered = false; if (i < items.length) draw(); else finish(); }
    // bilan par cours : où concentrer ses révisions
    function byLesson() {
      const by = {};
      res.forEach(r => { const k = r.it.lid; if (!k) return; const x = by[k] || (by[k] = [0, 0]); x[1]++; if (r.good) x[0]++; });
      const ks = Object.keys(by); if (ks.length < 2) return '';
      ks.sort((a, b) => by[a][0] / by[a][1] - by[b][0] / by[b][1] || by[b][1] - by[a][1]);
      return '<div class="h-sec"><h2>📊 Par cours</h2><span class="small muted">les plus faibles d\'abord</span></div><div class="card">' + ks.map(k => { const [g, t] = by[k], pc = Math.round(100 * g / t), l = P.lesson(k) || { t: k };
        return '<a href="#/c/' + k + '" style="display:block;color:var(--ink);margin:7px 0"><div class="row small"><span class="grow">' + esc(l.s || l.t) + '</span><b>' + g + '/' + t + '</b></div><div class="bar' + (pc >= 70 ? ' green' : '') + '"><i style="width:' + pc + '%"></i></div></a>'; }).join('') +
        '<p class="small muted" style="margin:8px 0 0">Touche un cours pour relire sa fiche : commence par ceux du haut.</p></div>';
    }
    function finish() {
      if (tmr) clearInterval(tmr);
      P.leaveGuard = null;
      const n = res.length || 1, pct = Math.round(100 * ok / n);
      if (pct === 100 && res.length >= 8) { S.bdgFlags = S.bdgFlags || {}; S.bdgFlags.perfect = 1; }
      P.addXP(5 * ok + 2 * (res.length - ok), 'quiz'); P.checkBadges(); P.save();
      const wrong = res.filter(r => !r.good);
      el.innerHTML = '<div class="qz res"><div class="big">' + pct + ' %</div><div class="muted">' + ok + ' bonne' + (ok > 1 ? 's' : '') + ' réponse' + (ok > 1 ? 's' : '') + ' sur ' + res.length + '</div><p>' + (pct >= 85 ? '🏆 Excellent : tu déjoues les pièges.' : pct >= 60 ? '👍 Bien. Relis les explications des questions ratées.' : '💪 Relis la fiche et les pièges, puis refais ce quiz dans 2 jours.') + '</p>' +
        '<div class="row wrap" style="justify-content:center;gap:8px">' + (wrong.length ? '<button class="btn" data-again="w">Refaire mes ' + wrong.length + ' erreur' + (wrong.length > 1 ? 's' : '') + '</button>' : '') + '<button class="btn ghost" data-again="a">Recommencer</button></div></div>' + byLesson() +
        (wrong.length ? '<div class="h-sec"><h2>À retenir</h2></div>' + wrong.map(r => '<div class="card"><div class="small muted">' + esc((P.lesson(r.it.lid) || {}).t || '') + '</div><b>' + md(r.it.s, true) + '</b><div class="fb ok" style="margin-top:8px">' + (r.it.type === 'vf' ? (r.it.a ? 'VRAI' : 'FAUX') : 'Réponse ' + r.it.r.split('').join(', ') + ' : ' + r.it.r.split('').map(c => md(r.it.o[L.indexOf(c)], true)).join(' · ')) + (r.it.e ? '<br>' + md(r.it.e, true) : '') + '</div><button class="btn xs ghost" style="margin-top:8px" data-jq="' + r.it.qid + '">+ Journal d\'erreurs</button></div>').join('') : '');
      if (opt.onEnd) opt.onEnd(pct);
    }
    const addJournal = it => {
      const l = P.lesson(it.lid);
      const rule = it.type === 'vf' ? (it.a ? 'VRAI' : 'FAUX') + ' : ' + U.plain(it.e) : 'Réponse ' + it.r + ' : ' + U.plain(it.e);
      S.err.push({ id: 'e' + Date.now().toString(36), d: P.today(), th: l ? l.t : '', src: 'Quiz du site', err: U.plain(it.s), rule, j3: false, j7: false });
      P.save(); P.addXP(5, 'erreur notée'); P.checkBadges();
    };
    el.onclick = e => {
      const b = e.target.closest('button'); if (!b || b.classList.contains('term')) return;
      const it = items[Math.min(i, items.length - 1)];
      if (b.dataset.o && !answered) {
        if (it.type === 'vf') { sel = new Set([b.dataset.o]); paintSel(); validate(); }
        else { if (sel.has(b.dataset.o)) sel.delete(b.dataset.o); else sel.add(b.dataset.o); paintSel(); }
      } else if (b.dataset.c && !answered) { conf = b.dataset.c; el.querySelectorAll('.conf button').forEach(x => x.classList.toggle('on', x.dataset.c === conf)); }
      else if (b.dataset.v) { if (!answered) validate(); else next(); }
      else if (b.dataset.j) { addJournal(it); b.textContent = '✓ Ajouté'; b.disabled = true; }
      else if (b.dataset.jq) { addJournal(items.find(x => x.qid === b.dataset.jq)); b.textContent = '✓ Ajouté'; b.disabled = true; }
      else if (b.dataset.again) { const again = b.dataset.again === 'w' ? res.filter(r => !r.good).map(r => r.it) : shuffle(items); Q.run(el, again, opt); }
    };
    draw();
  };

  /* ---------- CARTES (Leitner) ---------- */
  P.C = {
    run(el, cards, opt = {}) {
      if (!cards.length) { el.innerHTML = '<div class="card empty">' + (opt.free ? 'Pas encore de cartes pour ce cours.' : 'Aucune carte à réviser aujourd\'hui 🎉<br><span class="small">Les cartes arrivent quand tu étudies un cours, puis reviennent à J+1, J+2, J+4, J+7, J+14 selon tes réponses.</span>') + '</div>'; return; }
      let q = cards.slice(), i = 0, good = 0, total = 0;
      const draw = () => {
        if (i >= q.length) { el.innerHTML = '<div class="qz res"><div class="big">' + total + '</div><div class="muted">cartes révisées · ' + good + ' sues du premier coup</div><p>Les cartes ratées reviennent demain, les autres plus tard.</p><a class="btn" href="#/">Retour à aujourd\'hui</a></div>'; return; }
        const c = q[i], l = c.lid && P.lesson(c.lid);
        el.innerHTML = '<div class="qn small muted" style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:6px"><span>Carte ' + (i + 1) + '/' + q.length + '</span><span>' + (l ? esc(l.s || l.t) : '') + '</span></div>' +
          '<div class="fc" data-flip="1"><div class="in"><div class="fa"><div class="k">' + esc(c.k) + '</div><div class="t">' + md(c.f, true) + '</div><div class="small muted" style="margin-top:14px">Réponds de tête, puis touche la carte</div></div>' +
          '<div class="fb2"><div class="k">Réponse</div><div class="t" style="font-weight:600;font-size:.98rem">' + md(c.b, true) + '</div>' + (c.ar ? '<div class="ar" lang="ar">' + esc(c.ar) + '</div>' : '') + '</div></div></div>' +
          '<div class="row" style="gap:10px"><button class="btn red grow" data-r="0" disabled>✗ À revoir</button><button class="btn green grow" data-r="1" disabled>✓ Je savais</button></div>';
      };
      el.onclick = e => {
        const f = e.target.closest('[data-flip]');
        if (f) { f.classList.toggle('flip'); el.querySelectorAll('[data-r]').forEach(b => { b.disabled = false; }); return; }
        const b = e.target.closest('[data-r]'); if (!b || b.disabled) return;
        const c = q[i], okk = b.dataset.r === '1';
        const first = !c._again;
        P.rateCard(c, okk); total++; if (okk && first) good++;
        if (!okk && !c._again) q.push(Object.assign({}, c, { _again: 1 }));
        i++; draw();
      };
      draw();
    },
  };

  /* ---------- CLICHÉS AU CHRONO ---------- */
  P.X = {
    run(el) {
      const keys = shuffle(Object.keys(P.figs)).slice(0, 5);
      let k = 0, tm = null, guess = null, revealed = false, hits = 0, okn = 0;
      const intro = () => {
        el.innerHTML = '<div class="card"><h3>La méthode en 3 minutes, à voix haute</h3><ol class="steps"><li><b>Vérifier (30 s)</b> : face ou profil, inspiration, pénétration, rotation. Repère « D » : le côté droit du patient est à gauche de l\'image.</li>' +
          '<li><b>Repérer (30 s)</b> : où est l\'anomalie ? Compare les deux côtés, de haut en bas, sans oublier les culs-de-sac, le médiastin et les hiles.</li>' +
          '<li><b>Décrire (1 min 30)</b> : siège, taille, limites, densité, homogénéité, signes associés (bronchogramme, silhouette, rétraction, niveau).</li><li><b>Conclure (30 s)</b> : le syndrome radiologique, le diagnostic le plus probable et l\'examen suivant.</li></ol>' +
          '<p class="small muted">5 clichés schématiques au hasard. Touche l\'anomalie principale sur l\'image : le site vérifie si tu l\'as trouvée.</p><button class="btn block" data-go="1">Commencer</button></div>';
      };
      const draw = () => {
        if (k >= keys.length) { S.cli.n += keys.length; S.cli.ok += okn; S.cli.hot += hits; P.addXP(10 * keys.length, 'clichés'); P.checkBadges(); P.save(); el.innerHTML = '<div class="qz res"><div class="big">' + okn + '/' + keys.length + '</div><div class="muted">diagnostics justes · ' + hits + ' anomalie' + (hits > 1 ? 's' : '') + ' localisée' + (hits > 1 ? 's' : '') + ' du premier coup</div><button class="btn" data-go="1" style="margin-top:12px">Nouvelle série</button></div>'; return; }
        const f = P.figs[keys[k]]; revealed = false; guess = null;
        U.resetTerms();
        el.innerHTML = '<div class="row small muted" style="justify-content:space-between;font-weight:700"><span>Cliché ' + (k + 1) + '/' + keys.length + '</span><span>' + (f.hot ? 'Touche l\'anomalie principale' : 'Décris ce que tu vois') + '</span></div>' +
          '<div id="xt"></div><div id="xf">' + U.fig(keys[k], '', { hide: true, noCap: true, noTools: true }) + '</div><div id="xr"></div><button class="btn block" data-rev="1">Révéler la réponse</button>';
        tm = P.timer(el.querySelector('#xt'), 180, { auto: true, color: '#7a4fe0', onEnd: () => { if (!revealed) reveal(); } });
        el.querySelector('.fig .stage').addEventListener('click', ev => {
          if (revealed) return;
          const r = ev.currentTarget.getBoundingClientRect();
          guess = [100 * (ev.clientX - r.left) / r.width, 100 * (ev.clientY - r.top) / r.height];
          let g = ev.currentTarget.querySelector('.guess'); if (!g) { g = document.createElement('div'); g.className = 'guess'; ev.currentTarget.appendChild(g); }
          g.style.left = guess[0] + '%'; g.style.top = guess[1] + '%';
        });
      };
      const reveal = () => {
        revealed = true; if (tm) tm.stop();
        const f = P.figs[keys[k]], fig = el.querySelector('.fig'), st = fig.querySelector('.stage');
        fig.classList.remove('hidelab');
        let hit = null;
        if (f.hot) {
          const h = document.createElement('div'); h.className = 'hot'; h.style.left = f.hot[0] + '%'; h.style.top = f.hot[1] + '%'; h.style.width = h.style.height = (2 * f.hot[2]) + '%';
          h.style.height = (2 * f.hot[2] * f.w / f.h) + '%'; st.appendChild(h);
          if (guess) { const dx = (guess[0] - f.hot[0]) * f.w / 100, dy = (guess[1] - f.hot[1]) * f.h / 100; hit = Math.hypot(dx, dy) <= f.hot[2] * f.w / 100 * 1.25; if (hit) hits++; }
        }
        el.querySelector('#xr').innerHTML = '<div class="fb ' + (hit === false ? 'ko' : 'ok') + '" style="margin-bottom:10px">' + (f.hot ? (guess ? (hit ? '🎯 Anomalie bien localisée !' : '📍 Pas tout à fait : la zone verte montre l\'anomalie.') : '📍 La zone verte montre l\'anomalie.') + '<br>' : '') +
          '<b>Réponse : ' + md(f.dx, true) + '</b><ol style="margin:6px 0 0;padding-left:20px">' + f.lab.map(x => '<li>' + md(x[2], true) + '</li>').join('') + '</ol></div>' +
          '<div class="row" style="gap:8px"><button class="btn red grow" data-ok="0">✗ Je n\'avais pas trouvé</button><button class="btn green grow" data-ok="1">✓ J\'avais le bon diagnostic</button></div>';
        const rb = el.querySelector('[data-rev]'); if (rb) rb.remove();
      };
      el.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.go) { k = 0; hits = 0; okn = 0; draw(); }
        else if (b.dataset.rev) reveal();
        else if (b.dataset.ok != null) { if (b.dataset.ok === '1') okn++; k++; draw(); }
      };
      intro();
    },
  };

  /* ---------- ECOS ---------- */
  P.E = {
    run(el, id) {
      const l = P.lesson(id), f = P.F[id];
      if (!f || !f.k) { el.innerHTML = '<div class="card empty">Pas de grille ECOS pour ce cours.</div>'; return; }
      const k = f.k, secs = k.t || 120;
      el.innerHTML = '<div class="card"><div class="small muted" style="font-weight:800">ECOS · ' + esc(l.t) + '</div><h3 style="margin:6px 0 10px">🎤 « ' + md(k.q, true) + ' »</h3><p class="small muted">Parle à voix haute, comme devant l\'examinateur, sans regarder la fiche. Puis coche ce que tu as vraiment dit.</p><div id="et"></div></div>' +
        '<div class="card" id="eg" style="opacity:.5"><h3>Grille d\'auto-évaluation</h3><p class="small muted">Disponible quand tu as fini de parler.</p>' + k.pts.map((p, i) => '<label class="cr" style="display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line)"><input type="checkbox" data-p="' + i + '" disabled style="width:20px;height:20px;accent-color:var(--green);flex:0 0 auto"><span>' + md(p, true) + '</span></label>').join('') +
        '<button class="btn block" data-score="1" disabled style="margin-top:10px">Calculer mon score</button><div id="es"></div></div>';
      const open = () => { const g = el.querySelector('#eg'); g.style.opacity = 1; g.querySelectorAll('input,button').forEach(x => { x.disabled = false; }); };
      const t = P.timer(el.querySelector('#et'), secs, { color: '#0d9488', onEnd: open });
      el.querySelector('#et').insertAdjacentHTML('beforeend', '<div style="text-align:center;margin-top:8px"><button class="btn sm ghost" data-done="1">J\'ai fini de parler</button></div>');
      el.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.done) { t.stop(); open(); }
        if (b.dataset.score) {
          const boxes = [...el.querySelectorAll('#eg input')], n = boxes.filter(x => x.checked).length, pct = Math.round(100 * n / boxes.length);
          const r = S.ecos[id] || (S.ecos[id] = { n: 0, best: 0 }); r.n++; r.best = Math.max(r.best, pct); r.last = pct; P.save();
          P.addXP(10 + Math.round(pct / 10), 'ECOS'); P.checkBadges();
          const miss = boxes.filter(x => !x.checked).map(x => k.pts[+x.dataset.p]);
          el.querySelector('#es').innerHTML = '<div class="fb ' + (pct >= 70 ? 'ok' : 'ko') + '"><b class="v">' + pct + ' %</b> des points de la grille' + (miss.length ? '<div style="margin-top:6px">À ajouter la prochaine fois :<ul style="margin:4px 0 0;padding-left:20px">' + miss.map(m => '<li>' + md(m, true) + '</li>').join('') + '</ul></div>' : ' : parfait !') + '</div>';
        }
      };
    },
  };

  /* ---------- QUI SUIS-JE ? ---------- */
  P.G = {
    run(el) {
      const data = P.qsj || [];
      if (data.length < 4) { el.innerHTML = '<div class="card empty">Le jeu arrive bientôt.</div>'; return; }
      const round = shuffle(data).slice(0, 5);
      let r = 0, shown = 1, pts = 0, opts = [], done = false;
      const setup = () => { const it = round[r]; shown = 1; done = false; opts = shuffle([it[0]].concat(shuffle(data.filter(x => x[0] !== it[0]).map(x => x[0])).slice(0, 3))); draw(); };
      const draw = () => {
        if (r >= round.length) { S.game.n++; S.game.pts += pts; P.addXP(pts * 3, 'Qui suis-je ?'); P.checkBadges(); P.save(); el.innerHTML = '<div class="qz res"><div class="big">' + pts + ' pts</div><div class="muted">sur ' + round.length * 5 + ' possibles</div><button class="btn" data-again="1" style="margin-top:12px">Rejouer</button></div>'; return; }
        const it = round[r];
        el.innerHTML = '<div class="qsj"><div class="row small muted" style="justify-content:space-between;font-weight:700"><span>Énigme ' + (r + 1) + '/' + round.length + '</span><span>' + pts + ' pts</span></div><p class="small muted">Moins tu utilises d\'indices, plus tu gagnes de points (5 au premier indice).</p>' +
          it[2].slice(0, shown).map((c, i) => '<div class="clue"><b>Indice ' + (i + 1) + '</b> · ' + md(c, true) + '</div>').join('') +
          '<div style="margin-top:12px">' + opts.map(o => '<button class="opt" data-a="' + esc(o) + '"><span class="grow">' + esc(o) + '</span></button>').join('') + '</div>' +
          (shown < it[2].length && !done ? '<button class="btn ghost block" data-more="1" style="margin-top:6px">Un indice de plus (−1 point)</button>' : '') + '<div class="fbx"></div></div>';
      };
      el.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        const it = round[r];
        if (b.dataset.again) { P.G.run(el); return; }
        if (b.dataset.more) { shown++; draw(); return; }
        if (b.dataset.next) { r++; if (r < round.length) setup(); else draw(); return; }
        if (b.dataset.a != null && !done) {
          if (b.dataset.a === it[0]) {
            done = true; const g = Math.max(1, 6 - shown); pts += g;
            b.classList.add('ok');
            el.querySelector('.fbx').innerHTML = '<div class="fb ok"><b>✓ Bravo : +' + g + ' pts</b><div style="margin-top:6px">' + it[2].slice(shown).map(c => '• ' + md(c, true)).join('<br>') + '</div><div class="row" style="gap:8px;margin-top:8px">' + (it[1] ? '<a class="btn xs ghost" href="#/c/' + it[1] + '">Voir la fiche</a>' : '') + '<button class="btn xs" data-next="1">Suivant →</button></div></div>';
            el.querySelectorAll('[data-more]').forEach(x => x.remove());
          } else {
            b.classList.add('ko'); b.disabled = true;
            if (shown < it[2].length) { shown++; const keep = [...el.querySelectorAll('.opt.ko')].map(x => x.dataset.a); draw(); keep.forEach(a => { const x = el.querySelector('.opt[data-a="' + CSS.escape(a) + '"]'); if (x) { x.classList.add('ko'); x.disabled = true; } }); }
            else { done = true; el.querySelector('.fbx').innerHTML = '<div class="fb ko"><b>C\'était : ' + esc(it[0]) + '</b><div class="row" style="gap:8px;margin-top:8px">' + (it[1] ? '<a class="btn xs ghost" href="#/c/' + it[1] + '">Voir la fiche</a>' : '') + '<button class="btn xs" data-next="1">Suivant →</button></div></div>'; }
          }
        }
      };
      setup();
    },
  };

  /* ---------- EXAMEN BLANC, POMODORO ---------- */
  P.T = {
    exam(el) {
      const withQ = P.lessons.filter(l => P.Q.all(l.id).length), st = { n: 40, scope: 'all' };
      const drawEx = () => {
        const lids = (st.scope === 'studied' ? withQ.filter(l => P.isStudied(l.id)) : withQ).map(l => l.id);
        const avail = P.Q.build(lids, { types: ['qcm', 'cas'] }).length;
        return '<div class="card" id="exs"><h3>🎓 Examen blanc sur le site</h3><p class="small muted">Comme le jour J : QCM et cas cliniques mélangés, <b>1 minute par question</b>, une réponse est juste seulement si <b>toutes</b> les bonnes propositions sont cochées, correction à la fin avec ton bilan par cours.</p>' +
          '<label class="lb">Nombre de questions</label><div class="seg">' + [20, 40, 60].map(n => '<button data-exn="' + n + '" class="' + (st.n === n ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
          '<label class="lb">Programme</label><div class="seg"><button data-exs="all" class="' + (st.scope === 'all' ? 'on' : '') + '">Tout le programme</button><button data-exs="studied" class="' + (st.scope === 'studied' ? 'on' : '') + '">Mes cours étudiés</button></div>' +
          '<button class="btn block red" style="margin-top:12px" data-exgo="1"' + (avail ? '' : ' disabled') + '>⏱️ Commencer (' + Math.min(st.n, avail) + ' questions, ' + Math.min(st.n, avail) + ' min)</button></div>';
      };
      const paper = '<div class="card"><h3>📝 Annales sur papier, au chrono</h3><p class="small muted">Fais une série d\'annales au chrono, en conditions réelles (sans fiche, sans téléphone). Compte environ 1 minute par question.</p><label class="lb">Durée</label><div class="seg">' + [30, 45, 60, 90, 120].map(m => '<button data-m="' + m + '">' + m + ' min</button>').join('') + '</div><div id="xt"></div><div id="xs"></div></div>';
      el.innerHTML = drawEx() + paper;
      el.onclick = e => {
        const x = e.target.closest('[data-exn],[data-exs],[data-exgo]');
        if (x) {
          if (x.dataset.exn) st.n = +x.dataset.exn;
          else if (x.dataset.exs) st.scope = x.dataset.exs;
          else if (x.dataset.exgo) {
            const lids = (st.scope === 'studied' ? withQ.filter(l => P.isStudied(l.id)) : withQ).map(l => l.id);
            el.onclick = null; window.scrollTo(0, 0);
            Q.run(el, Q.build(lids, { types: ['qcm', 'cas'], n: st.n }), { exam: true, onEnd: pct => { const d = P.day(P.today()); d.qcm = pct; P.save(); } });
            return;
          }
          el.querySelector('#exs').outerHTML = drawEx();
          return;
        }
        const b = e.target.closest('[data-m]'); if (!b) return;
        el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b));
        P.timer(el.querySelector('#xt'), +b.dataset.m * 60, { color: '#de3b3b', onEnd: () => U.toast('⏰ Temps écoulé : pose ton stylo') });
        el.querySelector('#xs').innerHTML = '<label class="lb">Ton score à la fin (%)</label><div class="row"><input class="input" type="number" min="0" max="100" id="xsv" placeholder="ex. 68"><button class="btn" id="xsb">Enregistrer</button></div>';
        el.querySelector('#xsb').onclick = () => { const v = +el.querySelector('#xsv').value; if (!(v >= 0 && v <= 100)) return; const d = P.day(P.today()); d.qcm = v; d.min = (d.min || 0) + +b.dataset.m; P.save(); P.addXP(40, 'examen blanc'); U.toast('Score enregistré dans ton bilan du jour'); };
      };
    },
    pomo(el) {
      const PM = P.POMO, st = () => S.pomo || (S.pomo = { mode: 'focus', run: false, end: 0, left: PM.focus });
      const fmt = x => Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0');
      const paint = () => { const p = st(), tot = PM[p.mode], left = P.pomoLeft(), tv = el.querySelector('.tv'), tr = el.querySelector('.tr'); if (!tv) return; tv.textContent = fmt(left); tr.setAttribute('stroke-dashoffset', (465 * (1 - left / tot)).toFixed(1)); };
      const draw = () => {
        const p = st(), tot = PM[p.mode], left = P.pomoLeft();
        el.innerHTML = '<div class="card" style="text-align:center"><div class="seg" style="justify-content:center"><button data-p="focus" class="' + (p.mode === 'focus' ? 'on' : '') + '">🍅 Concentration 25 min</button><button data-p="pause" class="' + (p.mode === 'pause' ? 'on' : '') + '">☕ Pause 5 min</button></div>' +
          '<div class="timer"><svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="74" fill="none" stroke="var(--soft)" stroke-width="12"/><circle class="tr" cx="85" cy="85" r="74" fill="none" stroke="' + (p.mode === 'focus' ? '#de3b3b' : '#1f9d60') + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="465" transform="rotate(-90 85 85)"/><text class="tv" x="85" y="95" text-anchor="middle" fill="currentColor" font-size="34" font-weight="900"></text></svg></div>' +
          '<div class="row" style="justify-content:center;gap:8px"><button class="btn" data-pg="1">' + (p.run ? '⏸ Pause' : left < tot ? '▶ Reprendre' : '▶ Démarrer') + '</button><button class="btn ghost" data-pr="1">↺ Recommencer</button></div>' +
          '<p class="small muted" style="margin-top:12px">Le minuteur continue quand tu ouvres une fiche ou un quiz : il reste visible en haut de l\'écran (🍅), et tu es prévenu à la fin.</p></div>';
        paint();
      };
      el.onclick = e => {
        const p = st(), b = e.target.closest('button'); if (!b) return;
        if (b.dataset.p) { p.mode = b.dataset.p; p.run = false; p.end = 0; p.left = PM[p.mode]; }
        else if (b.dataset.pg) { if (p.run) { p.left = P.pomoLeft(); p.run = false; p.end = 0; } else { const l = P.pomoLeft() > 0 ? P.pomoLeft() : PM[p.mode]; p.left = l; p.end = Date.now() + l * 1000; p.run = true; } }
        else if (b.dataset.pr) { p.run = false; p.end = 0; p.left = PM[p.mode]; }
        else return;
        P.save(); draw(); P.pomoTick();
      };
      P.pomoRedraw = draw;
      draw();
      P.addTimer(setInterval(paint, 500));
    },
  };
})();

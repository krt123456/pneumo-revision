/* Pneumo Révision — pages */
(function () {
  'use strict';
  const P = window.PNEUMO, S = P.S, D = P.D, U = P.UI, md = U.md, esc = U.esc;
  const today = P.today;
  const V = P.V = {};
  const ACT = P.ACT = {};
  let main;
  P.GC = { inf: ['#2f6fde', '#1e3a62'], tb: ['#d23a7a', '#7a1f4a'], obs: ['#0d9488', '#0b4f4a'], pid: ['#7a4fe0', '#3b2580'], onc: ['#e2761b', '#8a3d07'],
    vasc: ['#de3b3b', '#7d1717'], sym: ['#c58b00', '#6b4b00'], env: ['#6b7280', '#374151'], radio: ['#4f46e5', '#25207a'], td: ['#1f9d60', '#0f5534'], som: ['#334e9e', '#1b2a57'] };
  const gc = l => (P.GC[l.g] || P.GC.inf);
  const CAT = { cours: 'Cours', td: 'TD · ECOS', radio: 'Radiologie' };
  const SC = { navy: '#1e3a62', blue: '#2f6fde', teal: '#0d9488', green: '#1f9d60', orange: '#e2761b', red: '#de3b3b', purple: '#7a4fe0', pink: '#d23a7a', amber: '#c58b00' };
  P.planned = {};
  P.days.forEach(d => d.les.forEach(id => { if (!P.planned[id]) P.planned[id] = d.d; }));
  const lname = l => (l.n ? l.n + ' · ' : '') + l.t;
  const daysLeft = () => D.diff(P.EXAM, today());
  const timers = [];
  P.addTimer = id => timers.push(id);
  const clearTimers = () => { while (timers.length) clearInterval(timers.pop()); };

  /* ---------- rendu des fiches ---------- */
  const CO = { ret: ['★', 'À retenir'], pie: ['✗', 'Piège classique'], pq: ['➜', 'Pourquoi ?'], ast: ['✎', 'Astuce mémo'], crs: ['!', 'Remarque sur le cours'], ex: ['✦', 'Exemple'], fun: ['💡', 'Le savais-tu ?'] };
  P.blocks = bs => (bs || []).map(b => {
    if (typeof b === 'string') return '<p>' + md(b) + '</p>';
    const [k, ...a] = b;
    if (k === 'ul' || k === 'ol') return '<' + k + '>' + a.map(x => '<li>' + md(x) + '</li>').join('') + '</' + k + '>';
    if (k === 'steps') return '<ol class="steps">' + a.map(x => '<li>' + md(x) + '</li>').join('') + '</ol>';
    if (k === 'tab') return '<div class="tbw"><table class="tb"><thead><tr>' + a[0].map(h => '<th>' + md(h) + '</th>').join('') + '</tr></thead><tbody>' +
      a.slice(1).map(r => '<tr>' + r.map(c => '<td>' + md(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    if (CO[k]) return '<div class="co ' + k + '"><div class="cl">' + CO[k][0] + ' ' + CO[k][1] + '</div>' + md(a[0]) + '</div>';
    if (k === 'chk') return '<div class="chk" data-ans="' + esc(a[2]) + '"><div class="cl">⚡ Vérifie-toi</div><div class="cq">' + md(a[0]) + '</div><div class="copts">' + a[1].map((o, j) => '<button type="button" class="copt" data-act="chkopt" data-l="' + 'ABCDE'[j] + '"><b>' + 'ABCDE'[j] + '</b> ' + md(o) + '</button>').join('') + '</div><div class="cex" hidden>' + md(a[3] || '') + '</div></div>';
    if (k === 'fig') return U.fig(a[0], a[1]);
    if (k === 'svg') return U.svgfig(a[0], a[1]);
    if (k === 'calc') return U.calcHTML(a[0]);
    if (k === 'img') return '<figure class="svgfig"><img src="' + esc(a[0]) + '" alt="" loading="lazy" style="width:100%;height:auto;display:block;border-radius:8px">' + (a[1] ? '<figcaption>' + md(a[1]) + '</figcaption>' : '') + '</figure>';
    if (k === 'cards') return '<div class="cards">' + a.map(c => '<div style="--cc:' + (SC[c[2]] || SC.blue) + '"><h4>' + md(c[0]) + '</h4><p>' + md(c[1]) + '</p></div>').join('') + '</div>';
    return '';
  }).join('');
  P.renderFiche = f => {
    let h = '';
    if (f.e) h += '<div class="ess"><h3>⚡ L\'essentiel en 30 secondes</h3><ul>' + f.e.map(x => '<li>' + md(x) + '</li>').join('') + '</ul></div>';
    let vi = 0;
    (f.s || []).forEach((s, i) => {
      h += '<section class="sec" data-si="' + i + '" style="--sc:' + (SC[s[1]] || SC.navy) + '"><div class="sec-h"><span class="num">' + (i + 1) + '</span><h2>' + md(s[0], true) + '</h2></div><div class="sec-b">' + P.blocks(s[2]) + '</div></section>';
      const hasChk = (s[2] || []).some(b => Array.isArray(b) && b[0] === 'chk');
      if (i % 2 === 1 && !hasChk && f.v && f.v[vi] && i < f.s.length - 1) {
        const v = f.v[vi++];
        h += '<div class="chk chkvf" data-ans="' + (v[1] ? 'V' : 'F') + '"><div class="cl">⚡ Vrai ou faux ?</div><div class="cq">' + md(v[0]) + '</div><div class="copts two"><button type="button" class="copt" data-act="chkopt" data-l="V">Vrai</button><button type="button" class="copt" data-act="chkopt" data-l="F">Faux</button></div><div class="cex" hidden>' + md(v[2] || '') + '</div></div>';
      }
    });
    return h;
  };
  const pieges = (f, hide) => (f.p || []).map((p, i) => '<div class="pg"><div class="pgh"><small>Piège ' + (i + 1) + '</small>' + md(p[0], true) + '</div>' +
    '<div class="ln l1"><span class="ic">✗ Le piège</span><div class="tx">« ' + md(p[1]) + ' »</div></div>' +
    '<div class="ln l2"><span class="ic">✓ La règle</span><div class="tx' + (hide ? ' hid" data-act="unhide' : '') + '">' + md(p[2]) + '</div></div>' +
    (p[3] ? '<div class="ln l3"><span class="ic">➜ Pourquoi</span><div class="tx' + (hide ? ' hid" data-act="unhide' : '') + '">' + md(p[3]) + '</div></div>' : '') +
    (p[4] ? '<div class="ln l4"><span class="ic">✎ Exemple</span><div class="tx' + (hide ? ' hid" data-act="unhide' : '') + '">' + md(p[4]) + '</div></div>' : '') + '</div>').join('');

  /* ---------- tâches ---------- */
  const TK = { lesson: ['📘', 'Étudier'], annales: ['📝', 'Annales et QCM'], cliches: ['🩻', 'Clichés (3 min chacun)'], ecos: ['🎤', 'ECOS (oral)'], extra: ['📌', 'Ajouté par toi'] };
  function taskRow(t, late) {
    const done = P.isDone(t), l = t.lid && P.lesson(t.lid), k = TK[t.k];
    let title, desc = '', acts = '';
    if (t.k === 'lesson' || (t.k === 'extra' && l)) {
      title = k[0] + ' ' + (t.k === 'lesson' ? 'Étudier : ' : (P.isStudied(l.id) ? 'Revoir : ' : 'Étudier : ')) + esc(lname(l));
      desc = CAT[l.cat] + (l.ann ? ' · ' + P.annCount(l.ann) + ' questions d\'annales sur ce thème' : '');
      acts = '<a class="btn xs" href="#/c/' + l.id + '">Ouvrir la fiche</a>' + (P.F[l.id] ? '<a class="btn xs ghost" href="#/c/' + l.id + '/quiz">Quiz</a>' : '');
    } else {
      title = k[0] + ' ' + (t.k === 'extra' ? esc(t.txt || 'Tâche') : k[1]);
      desc = t.k === 'extra' ? '' : md(t.txt);
      if (t.k === 'annales') acts = '<a class="btn xs ghost" href="#/annales">Numéros par thème</a><a class="btn xs ghost" href="#/quiz">Quiz mélangé</a>';
      if (t.k === 'cliches') acts = '<a class="btn xs" href="#/cliches">Lancer le chrono 3 min</a>';
      if (t.k === 'ecos') acts = '<a class="btn xs teal" href="#/ecos">S\'entraîner à l\'oral</a>';
    }
    const lateTxt = late ? '<div class="late">⤷ Reporté du ' + D.fmt(t.d, { weekday: 'short', day: 'numeric', month: 'short' }) + '</div>' : '';
    return '<div class="task k-' + t.k + (done ? ' done' : '') + '">' +
      '<button class="ck' + (done ? ' on' : '') + '" data-act="tick" data-id="' + t.id + '" aria-label="' + (done ? 'Décocher' : 'Cocher') + '">' + U.ic.check + '</button>' +
      '<div class="grow">' + lateTxt + '<div class="tt">' + title + '</div>' + (desc ? '<div class="td">' + desc + '</div>' : '') + (acts && !done ? '<div class="ta">' + acts + '</div>' : '') + '</div>' +
      '<button class="more" data-act="tmenu" data-id="' + t.id + '" aria-label="Options">' + U.ic.dots + '</button></div>';
  }
  ACT.tick = el => {
    const t = P.findTask(el.dataset.id); if (!t) return;
    const was = P.isDone(t);
    if (was && t.k === 'lesson' && !confirm('Décocher ce cours ? Ses révisions programmées seront annulées.')) return;
    P.setDone(t, !was);
    rerender();
    if (!was) {
      const td = P.dayTasks(today());
      if (td.length && td.every(P.isDone) && P.overdue().length === 0) { U.toast('⭐ Toutes les tâches du jour sont faites !', 'xp'); U.confetti(); }
      else if (t.k === 'lesson' && P.F[t.lid]) U.toast('Bravo ! Teste-toi maintenant : le quiz fixe la mémoire');
    }
  };
  ACT.tmenu = el => {
    const t = P.findTask(el.dataset.id); if (!t) return;
    const tm = D.add(today(), 1);
    const moved = !!S.M[t.id], sk = P.isSkip(t);
    U.sheet('Options de la tâche', '<div class="menu">' +
      '<button data-act="tmove" data-id="' + t.id + '" data-d="' + tm + '">⏭️ Reporter à demain (' + D.short(tm) + ')</button>' +
      '<button data-act="tdate" data-id="' + t.id + '">📅 Choisir une autre date</button>' +
      (sk ? '<button data-act="tunskip" data-id="' + t.id + '">↩️ Ne plus ignorer</button>' : '<button data-act="tskip" data-id="' + t.id + '">🚫 Ignorer cette tâche</button>') +
      (moved ? '<button data-act="tmove" data-id="' + t.id + '" data-d="' + t.d + '">↩️ Remettre à sa date prévue (' + D.short(t.d) + ')</button>' : '') +
      (t.k === 'extra' ? '<button data-act="tdel" data-id="' + t.id + '">🗑️ Supprimer</button>' : '') + '</div>' +
      '<div id="tdateBox" class="hide"><label class="lb">Nouvelle date</label><input class="input" type="date" id="tdateIn" min="' + today() + '" max="' + P.EXAM + '" value="' + tm + '"><button class="btn block" style="margin-top:10px" data-act="tdateok" data-id="' + t.id + '">Déplacer</button></div>');
  };
  ACT.tmove = el => { P.move(P.findTask(el.dataset.id), el.dataset.d); U.closeSheet(); U.toast('Tâche déplacée au ' + D.short(el.dataset.d)); rerender(); };
  ACT.tdate = () => document.getElementById('tdateBox').classList.remove('hide');
  ACT.tdateok = el => { const v = document.getElementById('tdateIn').value; if (!v) return; ACT.tmove({ dataset: { id: el.dataset.id, d: v } }); };
  ACT.tskip = el => { P.skip(P.findTask(el.dataset.id)); U.closeSheet(); rerender(); };
  ACT.tunskip = el => { delete S.T[el.dataset.id]; P.save(); U.closeSheet(); rerender(); };
  ACT.tdel = el => { P.removeExtra(el.dataset.id); U.closeSheet(); rerender(); };
  ACT.spread = () => { const n = P.spread(3); U.toast(n + ' tâches réparties sur 3 jours, les plus rentables d\'abord'); rerender(); };
  ACT.term = el => U.showTerm(el);
  ACT.unhide = el => el.classList.remove('hid');
  ACT.chkopt = el => {
    const box = el.closest('.chk'); if (!box || box.classList.contains('done')) return;
    const ok = el.dataset.l === box.dataset.ans; box.classList.add('done');
    el.classList.add(ok ? 'ok' : 'ko');
    if (!ok) box.querySelectorAll('.copt').forEach(b => { if (b.dataset.l === box.dataset.ans) b.classList.add('ok'); });
    const ex = box.querySelector('.cex'); ex.hidden = false;
    ex.innerHTML = '<b>' + (ok ? '✓ Bien vu !' : '✗ Pas tout à fait.') + '</b> ' + ex.innerHTML;
    if (ok) { P.addXP(2, 'Vérifie-toi'); if (S.set.sound) U.beep(2); }
  };
  ACT.mk = el => {
    const fig = el.closest('.fig'), i = el.dataset.i;
    fig.querySelectorAll('.mk,.leg li').forEach(x => x.classList.toggle('on', x.dataset.i === i));
  };
  ACT.figtoggle = el => { const f = el.closest('.fig'); f.classList.toggle('hidelab'); el.textContent = f.classList.contains('hidelab') ? 'Afficher les repères' : 'Cacher les repères'; };

  /* ---------- sélecteur de cours ---------- */
  ACT.pick = el => {
    const d = el.dataset.d || today();
    const list = P.lessons.map(l => '<button class="pick" data-act="pickok" data-id="' + l.id + '" data-d="' + d + '"><span class="n" style="background:' + gc(l)[0] + '">' + esc(l.n || '•') + '</span><span class="grow"><b>' + esc(l.t) + '</b><br><span class="small muted">' + CAT[l.cat] + (P.isStudied(l.id) ? ' · étudié' : P.planned[l.id] ? ' · prévu le ' + D.short(P.planned[l.id]) : '') + '</span></span></button>').join('');
    U.sheet('Ajouter un cours au ' + D.fmt(d, { day: 'numeric', month: 'long' }), '<div class="srch" style="margin-bottom:10px">' + U.ic.search + '<input class="input" id="pickq" placeholder="Chercher un cours…"></div><div id="pickl">' + list + '</div>', root => {
      root.querySelector('#pickq').addEventListener('input', e => { const q = e.target.value.toLowerCase(); root.querySelectorAll('.pick').forEach(b => { b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none'; }); });
    });
  };
  ACT.pickok = el => { P.addExtra(el.dataset.id, el.dataset.d); U.closeSheet(); U.toast('Ajouté à ta journée'); rerender(); };

  /* ---------- AUJOURD'HUI ---------- */
  const TIPS = [
    'Teste-toi avant de relire : chercher la réponse en mémoire fixe mieux que relire (effet de test).',
    'Espace tes révisions : J+1, J+3, J+7, J+14. Le site les programme pour toi.',
    'Mélange les thèmes dans tes QCM : c\'est plus dur sur le moment, mais tu retiens mieux.',
    'Après une erreur, écris la règle juste dans le journal : c\'est la façon la plus rentable de progresser.',
    'Pour les clichés : toujours la même méthode en 3 minutes, à voix haute.',
    'Lis chaque mot d\'un item de QCM : « seul », « toujours », « jamais » font tomber.',
    'Le sommeil consolide ce que tu as appris dans la journée : ne sacrifie pas tes nuits.',
    'Explique un cours à voix haute comme à un camarade : les trous apparaissent tout de suite.',
  ];
  V.today = () => {
    const t = today(), dl = daysLeft(), day = P.dayOf(t), ph = P.PH[P.phaseOf(t)];
    const tasks = P.dayTasks(t), od = P.overdue(), revs = P.reviewsDue(), cardsN = P.cardsDue().length, wrongN = P.wrongDue().length;
    const doneN = tasks.filter(P.isDone).length, pct = tasks.length ? 100 * doneN / tasks.length : 100;
    let h = '<div class="hero"><div style="padding-right:92px"><h1>' + esc(D.fmt(t)) + '</h1>' +
      '<div class="sub">' + (day ? 'Thème du jour : ' + esc(day.lab) : t < P.START ? 'Le planning commence le mardi 17 novembre' : t >= P.EXAM ? (t === P.EXAM ? 'C\'est le jour de l\'examen. Respire : tu es prêt.' : 'Examen passé') : '') + '</div>' +
      '<div class="cd"><b>' + (dl > 0 ? dl : dl === 0 ? 'Jour J' : '—') + '</b>' + (dl > 0 ? 'jours avant l\'examen' : '') + '</div>' +
      '<div class="chips"><span class="chip">' + ph[0] + '</span><span class="chip">🔥 ' + P.streak() + ' j de suite</span><span class="chip">⭐ ' + S.xp + ' XP</span></div></div>' +
      U.ring(pct, 78, 8, '#fff', doneN + '/' + tasks.length) + '</div>';
    if (!P.storageOk()) h += '<div class="banner warn"><span class="bi">💾</span><div>La sauvegarde n\'est pas disponible dans ce navigateur (mode privé ?). Ta progression sera perdue en fermant la page. Utilise <b>Réglages → Exporter</b>.</div></div>';
    if (od.length) {
      h += '<div class="banner warn"><span class="bi">⏭️</span><div class="grow"><b>' + od.length + ' tâche' + (od.length > 1 ? 's' : '') + ' non cochée' + (od.length > 1 ? 's' : '') + ' des jours précédents</b> : elles sont reportées automatiquement ici.' +
        (od.length >= 3 ? '<div style="margin-top:8px"><button class="btn sm" data-act="spread">🛟 Plan de rattrapage : répartir sur 3 jours</button></div><div class="small muted" style="margin-top:6px">Les cours qui rapportent le plus de questions passent en premier.</div>' : '') + '</div></div>';
    }
    h += '<div class="h-sec"><h2>📋 Au programme aujourd\'hui</h2><button class="btn xs ghost" data-act="pick">+ Ajouter un cours</button></div>';
    h += tasks.length ? tasks.map(x => taskRow(x, false)).join('') : '<div class="card empty">' + (t < P.START ? 'Aucune tâche avant le début du planning. Ajoute un cours si tu veux prendre de l\'avance.' : 'Rien de prévu aujourd\'hui. Profites-en pour les révisions et les cartes ci-dessous.') + '</div>';
    if (od.length) h += '<div class="h-sec"><h2>⏭️ Reportés</h2></div>' + od.map(x => taskRow(x, true)).join('');
    h += '<div class="h-sec"><h2>🔁 Révisions espacées</h2><span class="small muted">J+1 · J+3 · J+7 · J+14</span></div>';
    h += revs.length ? revs.map(l => {
      const ls = P.ls(l.id), late = D.diff(t, ls.due);
      return '<div class="task k-rev"><div class="grow"><div class="tt">🔁 ' + esc(lname(l)) + '</div><div class="td">' + P.revLabel(l.id) + (late > 0 ? ' · <span class="late">en retard de ' + late + ' j</span>' : '') + '</div>' +
        '<div class="ta"><button class="btn xs green" data-act="rev" data-id="' + l.id + '">Réviser maintenant (5 min)</button><a class="btn xs ghost" href="#/c/' + l.id + '">Fiche</a></div></div></div>';
    }).join('') : '<div class="card empty">Aucune révision due aujourd\'hui ✅</div>';
    h += '<div class="h-sec"><h2>🎯 Entraînement du jour</h2></div><div class="grid2">' +
      tile('#/cartes', '🃏', 'Cartes du jour', cardsN ? cardsN + ' carte' + (cardsN > 1 ? 's' : '') + ' à réviser' : 'Rien à réviser pour l\'instant') +
      tile('#/refaire', '🔁', 'Refaire mes erreurs', wrongN ? wrongN + ' question' + (wrongN > 1 ? 's' : '') + ' ratée' + (wrongN > 1 ? 's' : '') + ' à retenter' : 'Aucune erreur en attente') +
      tile('#/quiz', '🧠', 'Quiz mélangé', 'Questions de tous tes cours étudiés') +
      tile('#/cliches', '🩻', 'Clichés au chrono', '3 minutes par radio, comme à l\'examen') + '</div>';
    const weak = P.lessons.filter(l => P.isStudied(l.id) && S.qs[l.id] && S.qs[l.id].n >= 4 && P.mastery(l.id) < 70).sort((a, b) => P.mastery(a.id) - P.mastery(b.id))[0];
    if (weak) h += '<div class="banner info" style="margin-top:12px"><span class="bi">🎯</span><div class="grow"><b>Ton point faible : ' + esc(weak.t) + '</b> (' + P.mastery(weak.id) + ' % de bonnes réponses). Relis les pièges puis refais le quiz.<div class="ta" style="margin-top:7px;display:flex;gap:6px"><a class="btn xs" href="#/c/' + weak.id + '/pieges">Pièges</a><a class="btn xs ghost" href="#/c/' + weak.id + '/quiz">Quiz</a></div></div></div>';
    const dl2 = P.day(t);
    h += '<div class="h-sec"><h2>📝 Bilan du jour</h2></div><div class="card"><div class="row wrap">' +
      '<div class="grow" style="min-width:140px"><label class="lb">Score QCM du jour (%)</label><input class="input" type="number" min="0" max="100" inputmode="numeric" data-day="qcm" value="' + (dl2.qcm ?? '') + '" placeholder="ex. 72"></div>' +
      '<div class="grow" style="min-width:140px"><label class="lb">Temps d\'étude (minutes)</label><div class="row"><input class="input" type="number" min="0" inputmode="numeric" data-day="min" value="' + (dl2.min || '') + '" placeholder="0"><button class="btn sm ghost" data-act="addmin" data-n="30">+30</button></div></div></div>' +
      '<label class="lb">Note du jour (ce qui a bloqué, ce qu\'il faut revoir)</label><textarea class="input" data-day="note" placeholder="Ex. je confonds encore exsudat et transsudat…">' + esc(dl2.note || '') + '</textarea></div>';
    h += '<div class="banner ok"><span class="bi">💡</span><div><b>Astuce du jour.</b> ' + esc(TIPS[D.diff(t, '2026-01-01') % TIPS.length]) + '</div></div>';
    main.innerHTML = h;
    main.querySelectorAll('[data-day]').forEach(inp => inp.addEventListener('change', () => {
      const d = P.day(today()), k = inp.dataset.day;
      d[k] = k === 'note' ? inp.value : (inp.value === '' ? null : Math.max(0, +inp.value));
      if (k === 'qcm' && inp.value !== '') P.addXP(5, 'score noté');
      P.save();
    }));
  };
  const tile = (href, ic, t, p) => '<a class="tile" href="' + href + '"><span class="ti">' + ic + '</span><span class="grow"><h3>' + t + '</h3><p>' + p + '</p></span></a>';
  ACT.addmin = el => { const d = P.day(today()); d.min = (d.min || 0) + +el.dataset.n; P.save(); P.addXP(5, 'temps d\'étude noté'); rerender(); };

  /* ---------- révision express (rappel actif + mini-quiz + auto-évaluation) ---------- */
  ACT.rev = el => {
    const id = el.dataset.id, l = P.lesson(id), f = P.F[id];
    const root = U.sheet('Révision : ' + l.t, '<div id="rv"></div>');
    const box = root.querySelector('#rv');
    const step1 = () => {
      box.innerHTML = '<div class="banner info"><span class="bi">🧠</span><div><b>Étape 1 · Rappel actif (1 minute).</b> Sans regarder la fiche, écris ce que tu retiens de ce cours : définition, signes, examens, traitement, pièges.</div></div>' +
        '<textarea class="input" id="rvt" placeholder="Tout ce qui te vient en tête…" style="min-height:140px">' + esc(S.notes['rv-' + id] || '') + '</textarea><button class="btn block" style="margin-top:12px" id="rv1">J\'ai fini, comparer</button>';
      box.querySelector('#rv1').onclick = () => { S.notes['rv-' + id] = box.querySelector('#rvt').value; P.save(); step2(); };
    };
    const step2 = () => {
      U.resetTerms();
      box.innerHTML = '<div class="banner ok"><span class="bi">✅</span><div><b>Étape 2 · Compare.</b> Ce que tu as oublié est ce qu\'il faut revoir.</div></div>' +
        (f && f.e ? '<div class="ess"><h3>⚡ L\'essentiel</h3><ul>' + f.e.map(x => '<li>' + md(x) + '</li>').join('') + '</ul></div>' : '<p class="muted">Fiche en préparation : compare avec ton cours.</p>') +
        (f && (f.v || f.q) ? '<button class="btn block" id="rv2">Étape 3 · 5 questions rapides</button>' : '<button class="btn block" id="rv3">Étape 3 · M\'évaluer</button>');
      const b2 = box.querySelector('#rv2'), b3 = box.querySelector('#rv3');
      if (b2) b2.onclick = () => { box.innerHTML = '<div id="rvq"></div>'; P.Q.run(box.querySelector('#rvq'), P.Q.build([id], { n: 5 }), { onEnd: step3, compact: true }); };
      if (b3) b3.onclick = () => step3();
    };
    const step3 = score => {
      box.insertAdjacentHTML('beforeend', '<div class="card" style="margin-top:12px"><b>Comment c\'était ?</b><p class="small muted">Le site choisit la date de la prochaine révision selon ta réponse.</p><div class="row wrap">' +
        '<button class="btn red" data-act="revok" data-id="' + id + '" data-r="0">😓 Difficile<br><small>revoir demain</small></button>' +
        '<button class="btn" data-act="revok" data-id="' + id + '" data-r="1">🙂 Bien<br><small>étape suivante</small></button>' +
        '<button class="btn green" data-act="revok" data-id="' + id + '" data-r="2">😎 Facile<br><small>plus tard</small></button></div></div>');
      if (score != null && score < 60) U.toast('Moins de 60 % : choisis plutôt « Difficile »');
    };
    if (P.ls(id).hist && P.ls(id).hist.length >= 3 && f && (f.v || f.q)) step2(); else step1();
  };
  ACT.revok = el => { P.review(el.dataset.id, +el.dataset.r); U.closeSheet(); U.toast('Prochaine révision le ' + D.short(P.ls(el.dataset.id).due)); rerender(); };

  /* ---------- COURS ---------- */
  const lf = { cat: 'all', st: 'all', q: '' };
  V.cours = () => {
    const tabs = [['all', 'Tous'], ['cours', 'Cours'], ['td', 'TD · ECOS'], ['radio', 'Radiologie']];
    const sts = [['all', 'Tous statuts'], ['todo', 'À faire'], ['done', 'Étudiés'], ['late', 'En retard']];
    const studied = P.lessons.filter(l => P.isStudied(l.id)).length;
    let h = '<div class="row" style="justify-content:space-between;margin-bottom:12px"><h1 style="font-size:1.35rem">📚 Cours</h1><span class="chip green">' + studied + '/' + P.lessons.length + ' étudiés</span></div>' +
      '<div class="bar green" style="margin-bottom:14px"><i style="width:' + (100 * studied / P.lessons.length) + '%"></i></div>' +
      '<div class="srch" style="margin-bottom:10px">' + U.ic.search + '<input class="input" id="lq" placeholder="Chercher un cours (ex. asthme, TB…)" value="' + esc(lf.q) + '"></div>' +
      '<div class="seg">' + tabs.map(t => '<button data-act="lf" data-k="cat" data-v="' + t[0] + '" class="' + (lf.cat === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div class="seg">' + sts.map(t => '<button data-act="lf" data-k="st" data-v="' + t[0] + '" class="' + (lf.st === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div class="grid2" id="lgrid">';
    const t = today();
    P.lessons.forEach(l => {
      const st = P.isStudied(l.id), pl = P.planned[l.id], late = !st && pl && pl < t;
      if (lf.cat !== 'all' && l.cat !== lf.cat) return;
      if (lf.st === 'done' && !st) return;
      if (lf.st === 'todo' && st) return;
      if (lf.st === 'late' && !late) return;
      const m = P.mastery(l.id), ls = P.ls(l.id);
      h += '<a class="lc" href="#/c/' + l.id + '" style="--c:' + gc(l)[0] + '" data-q="' + esc((l.t + ' ' + (l.s || '') + ' ' + (l.kw || '')).toLowerCase()) + '"><h3><span class="n">' + esc(l.n || '•') + '</span><span class="grow">' + esc(l.t) + '</span></h3><div class="meta">' +
        (st ? '<span class="chip green">✓ Étudié le ' + D.short(ls.on) + '</span>' : late ? '<span class="chip red">En retard (' + D.short(pl) + ')</span>' : pl ? '<span class="chip blue">Prévu le ' + D.short(pl) + '</span>' : '<span class="chip gray">Hors planning</span>') +
        '<span class="chip gray">' + CAT[l.cat] + '</span>' + (l.ann && P.annCount(l.ann) ? '<span class="chip orange">' + P.annCount(l.ann) + ' Q d\'annales</span>' : '') +
        (st && ls.due ? '<span class="chip purple">Révision ' + (ls.due <= t ? 'aujourd\'hui' : 'le ' + D.short(ls.due)) + '</span>' : '') + (P.F[l.id] ? '' : '<span class="chip gray">Fiche à venir</span>') + '</div>' +
        (m != null ? '<div class="bar"><i style="width:' + m + '%"></i></div><div class="small muted" style="margin-top:3px">Maîtrise ' + m + ' %</div>' : '') + '</a>';
    });
    h += '</div>';
    main.innerHTML = h;
    const q = main.querySelector('#lq');
    const filt = () => { lf.q = q.value; const s = q.value.toLowerCase().trim(); main.querySelectorAll('#lgrid .lc').forEach(c => { c.style.display = !s || c.dataset.q.includes(s) ? '' : 'none'; }); };
    q.addEventListener('input', filt); filt();
  };
  ACT.lf = el => { lf[el.dataset.k] = el.dataset.v; V.cours(); };

  /* ---------- PAGE D'UN COURS ---------- */
  function readTrack(id, box) {
    const secs = [...box.querySelectorAll('.sec')]; if (!secs.length) return;
    const rd = new Set(S.rd[id] || []);
    const bar = document.createElement('div'); bar.className = 'readbar'; bar.innerHTML = '<b class="trk"><i></i></b><span></span>'; box.prepend(bar);
    const upd = () => { const r = secs.filter((x, i) => rd.has(i)).length; bar.querySelector('i').style.width = Math.round(r / secs.length * 100) + '%'; bar.querySelector('span').textContent = r === secs.length ? '📗 Fiche lue en entier' : '📖 ' + r + ' / ' + secs.length + ' sections lues'; secs.forEach((x, i) => x.classList.toggle('read', rd.has(i))); };
    upd();
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const i = +e.target.dataset.si; io.unobserve(e.target);
      if (rd.has(i)) return;
      rd.add(i); S.rd[id] = [...rd]; P.save(); upd();
      if (rd.size === secs.length) { U.toast('📗 Fiche lue en entier : +5 XP'); P.addXP(5, 'Fiche lue'); }
    }), { threshold: 1 });
    secs.forEach((x, i) => { const m = document.createElement('div'); m.className = 'secend'; m.dataset.si = i; x.appendChild(m); io.observe(m); });
  }
  V.c = (id, tab) => {
    const l = P.lesson(id); if (!l) { location.hash = '#/cours'; return; }
    const f = P.F[id], st = P.isStudied(id), ls = P.ls(id), c = gc(l);
    tab = tab || 'fiche';
    const tabs = [['fiche', '📄 Fiche']];
    if (f && f.p) tabs.push(['pieges', '⚠️ Pièges']);
    if (f && (f.v || f.q || f.c)) tabs.push(['quiz', '🧠 Quiz']);
    if (f && (f.p || f.v)) tabs.push(['cartes', '🃏 Cartes']);
    if (f && f.k) tabs.push(['ecos', '🎤 ECOS']);
    if (l.pdf) tabs.push(['pdf', '📑 PDF']);
    if (l.ann) tabs.push(['annales', '📝 Annales']);
    tabs.push(['notes', '✍️ Mes mots']);
    if (!tabs.some(t => t[0] === tab)) tab = 'fiche';
    let h = '<div class="lh" style="--c1:' + c[0] + ';--c2:' + c[1] + '"><div class="kick">' + CAT[l.cat] + (l.n && l.cat === 'cours' && l.n !== 'PNO' ? ' n° ' + esc(l.n) : '') + ' · Pneumologie</div><h1>' + esc(l.t) + '</h1>' +
      '<div class="row">' + (st ? '<button class="btn sm done" data-act="unstudy" data-id="' + id + '">✓ Étudié le ' + D.short(ls.on) + '</button>' : '<button class="btn sm" data-act="study" data-id="' + id + '">✓ J\'ai étudié ce cours</button>') +
      '<button class="btn sm" data-act="pick1" data-id="' + id + '">+ Aujourd\'hui</button>' + (f ? '<button class="btn sm" data-act="speak" data-id="' + id + '" aria-label="Écouter">🔊 Écouter</button>' : '') + '</div>' +
      '<div class="row small" style="margin-top:10px;opacity:.92;gap:12px;flex-wrap:wrap">' + (P.planned[id] ? '<span>📅 Prévu le ' + D.short(P.planned[id]) + '</span>' : '') + (st && ls.due ? '<span>🔁 Prochaine révision : ' + D.short(ls.due) + '</span>' : '') +
      (P.mastery(id) != null ? '<span>🎯 Maîtrise ' + P.mastery(id) + ' %</span>' : '') + (l.f ? '<span>📁 ' + esc(l.f) + '</span>' : '') + '</div></div>';
    h += '<div class="tabs">' + tabs.map(t => '<button data-act="ltab" data-id="' + id + '" data-t="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div id="ltab"></div>';
    main.innerHTML = h;
    const box = main.querySelector('#ltab');
    U.resetTerms();
    if (tab === 'fiche') {
      box.innerHTML = f ? P.renderFiche(f) + '<div class="row wrap" style="margin:6px 0 20px">' + (f.p ? '<a class="btn" href="#/c/' + id + '/pieges">⚠️ Voir les pièges</a>' : '') + ((f.v || f.q) ? '<a class="btn purple" href="#/c/' + id + '/quiz">🧠 Me tester</a>' : '') + '</div>' :
        '<div class="card empty">📝 La fiche de ce cours est en préparation.' + (l.pdf ? '<br><br><a class="btn" href="#/c/' + id + '/pdf">Voir la fiche PDF</a>' : '') + '</div>';
      U.bindCalcs(box);
      if (f) readTrack(id, box);
    } else if (tab === 'pieges') {
      const hide = !!S.set.hideRules;
      box.innerHTML = '<div class="banner info"><span class="bi">🙈</span><div class="grow"><b>Méthode active.</b> Cache les règles, lis le piège et corrige-le de tête, puis touche la règle floue pour vérifier.<div style="margin-top:8px"><button class="btn sm' + (hide ? ' green' : '') + '" data-act="hiderules" data-id="' + id + '">' + (hide ? 'Règles cachées ✓ (montrer)' : 'Cacher les règles') + '</button></div></div></div>' + pieges(f, hide);
    } else if (tab === 'quiz') {
      box.innerHTML = '<div id="qz"></div>';
      P.Q.setup(box.querySelector('#qz'), [id]);
    } else if (tab === 'cartes') {
      box.innerHTML = '<div id="cz"></div>';
      P.C.run(box.querySelector('#cz'), P.cardsOf(id), { free: true });
    } else if (tab === 'ecos') {
      box.innerHTML = '<div id="ez"></div>';
      P.E.run(box.querySelector('#ez'), id);
    } else if (tab === 'pdf') {
      box.innerHTML = l.pdf.map(p => '<div class="card"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3>' + esc(p.t) + '</h3><a class="btn sm" href="' + esc(p.file) + '" download>⬇️ Télécharger le PDF</a></div><p class="small muted">' + p.n + ' pages · touche une page pour l\'agrandir</p><div class="pdfp">' +
        Array.from({ length: p.n }, (_, i) => '<a href="' + p.img + String(i + 1).padStart(2, '0') + '.webp" target="_blank" rel="noopener"><img loading="lazy" src="' + p.img + String(i + 1).padStart(2, '0') + '.webp" alt="Page ' + (i + 1) + '"></a>').join('') + '</div></div>').join('');
    } else if (tab === 'annales') {
      box.innerHTML = annBlock(l.ann, true);
    } else if (tab === 'notes') {
      box.innerHTML = '<div class="banner info"><span class="bi">✍️</span><div><b>Méthode Feynman.</b> Explique ce cours avec tes mots, comme à un camarade qui ne l\'a jamais vu. Là où tu bloques, c\'est ce qu\'il faut revoir.</div></div>' +
        '<label class="lb">Mon explication</label><textarea class="input" data-note="' + id + '" style="min-height:160px" placeholder="Ce cours parle de…">' + esc(S.notes[id] || '') + '</textarea>' +
        '<label class="lb">Ce que je confonds encore</label><textarea class="input" data-note="' + id + '-conf" placeholder="Ex. caverne / abcès / kyste rompu…">' + esc(S.notes[id + '-conf'] || '') + '</textarea>' +
        '<p class="small muted">Enregistré automatiquement sur cet appareil.</p>';
      box.querySelectorAll('[data-note]').forEach(t => t.addEventListener('input', () => { S.notes[t.dataset.note] = t.value; P.save(); }));
    }
  };
  ACT.ltab = el => { history.replaceState(null, '', '#/c/' + el.dataset.id + '/' + el.dataset.t); route(true); };
  ACT.study = el => { if (P.study(el.dataset.id)) { U.toast('Cours étudié : révisions programmées à J+1, J+3, J+7, J+14'); } rerender(); };
  ACT.unstudy = el => { if (confirm('Marquer ce cours comme non étudié ? Ses révisions seront annulées.')) { P.unstudy(el.dataset.id); rerender(); } };
  ACT.pick1 = el => { P.addExtra(el.dataset.id, today()); U.toast('Ajouté à ta journée'); };
  ACT.hiderules = el => { S.set.hideRules = !S.set.hideRules; P.save(); V.c(el.dataset.id, 'pieges'); };
  ACT.speak = el => {
    const f = P.F[el.dataset.id]; if (!f) return;
    if (speechSynthesis && speechSynthesis.speaking) { U.stopSpeak(); U.toast('Lecture arrêtée'); return; }
    const txt = (f.e || []).join('. ') + '. ' + (f.s || []).map(s => s[0] + '. ' + s[2].map(b => typeof b === 'string' ? b : (['ret', 'pie', 'pq', 'ast', 'crs', 'ex'].includes(b[0]) ? b[1] : (b[0] === 'ul' || b[0] === 'ol' || b[0] === 'steps') ? b.slice(1).join('. ') : '')).join('. ')).join('. ');
    U.speak(txt); U.toast('🔊 Lecture de la fiche (touche encore pour arrêter)');
  };

  /* ---------- annales ---------- */
  const FL = { A: 'Externat 2026, 2025, 2024', B: 'Externat 2021, 2022, 2023' };
  function annBlock(th, single) {
    const a = P.annales[th]; if (!a) return '<div class="card empty">Pas de questions d\'annales classées pour ce thème.</div>';
    const done = P.annDone(th), tot = a[0].length + a[1].length;
    return '<div class="card"><div class="row" style="justify-content:space-between"><h3>' + esc(th) + '</h3><span class="chip green">' + done + '/' + tot + '</span></div><div class="bar green" style="margin:8px 0"><i style="width:' + (tot ? 100 * done / tot : 0) + '%"></i></div>' +
      (single ? '<p class="small muted">Fais ces questions dans tes PDF d\'annales, puis touche chaque numéro pour le cocher. Classement automatique par mots-clés : des ordres de grandeur.</p>' : '') +
      ['A', 'B'].map((k, i) => a[i].length ? '<div class="small" style="font-weight:800;margin-top:6px">' + FL[k] + '.pdf</div><div class="nums">' + a[i].map(n => '<button class="' + (S.ann[k + n] ? 'on' : '') + '" data-act="ann" data-k="' + k + '" data-n="' + n + '">' + n + '</button>').join('') + '</div>' : '').join('') + '</div>';
  }
  ACT.ann = el => { P.toggleAnn(el.dataset.k, el.dataset.n); el.classList.toggle('on', !!S.ann[el.dataset.k + el.dataset.n]); };
  V.annales = () => {
    const ths = Object.keys(P.annales).sort((a, b) => P.annCount(b) - P.annCount(a));
    const all = ths.reduce((s, t) => s + P.annCount(t), 0), dn = ths.reduce((s, t) => s + P.annDone(t), 0);
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">📝 Annales par thème</h1><p class="muted small">' + all + ' questions des deux fichiers Externat, classées par thème. Les 5 premiers thèmes font environ deux tiers des questions : commence par eux.</p>' +
      '<div class="kpi" style="margin:10px 0 14px"><div><b>' + dn + '</b><span>questions faites</span></div><div><b>' + Math.round(100 * dn / all) + ' %</b><span>du total</span></div></div>' + ths.map(t => annBlock(t)).join('');
  };

  /* ---------- PLANNING ---------- */
  V.planning = () => {
    const t = today(), start = D.add(P.START, -((D.parse(P.START).getDay())));
    let cells = '';
    for (let d = start; d <= D.add(P.EXAM, 6 - D.parse(P.EXAM).getDay()); d = D.add(d, 1)) {
      const day = P.dayOf(d);
      if (!day) { cells += '<div class="d off"><b>' + +d.slice(8) + '</b></div>'; continue; }
      const tasks = P.dayTasks(d), dn = tasks.filter(P.isDone).length;
      const col = { 1: 'var(--p1)', 2: 'var(--p2)', 3: 'var(--p3)', 4: 'var(--px)' }[day.ph];
      let stt = '';
      if (day.ph === 4) stt = '🎓'; else if (tasks.length && dn === tasks.length) stt = '✅'; else if (d < t) stt = tasks.length - dn ? '⚠️' : ''; else if (dn) stt = '◐';
      cells += '<a class="d' + (d === t ? ' today' : '') + (day.ph === 4 ? ' exam' : '') + '" href="#/jour/' + d + '" style="--pc:' + col + '"><b>' + +d.slice(8) + '</b> <span class="muted">' + (d.slice(8) === '01' || d === P.START ? (d.slice(5, 7) === '11' ? 'nov.' : 'déc.') : '') + '</span><span class="st">' + stt + '</span><span class="l">' + esc(day.lab) + '</span></a>';
    }
    main.innerHTML = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><h1 style="font-size:1.35rem">📅 Planning</h1><a class="btn sm" href="#/jour/' + t + '">Aujourd\'hui</a></div>' +
      '<div class="row wrap" style="gap:6px;margin-bottom:12px"><span class="chip blue">1 · Apprendre 17/11 → 06/12</span><span class="chip orange">2 · S\'entraîner 07/12 → 13/12</span><span class="chip green">3 · Consolider 14/12 → 16/12</span><span class="chip red">Examen 17/12</span></div>' +
      '<div class="cal">' + ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'].map(w => '<div class="wd">' + w + '</div>').join('') + cells + '</div>' +
      '<p class="small muted" style="margin-top:12px">✅ journée terminée · ◐ commencée · ⚠️ des tâches ont été reportées. Touche un jour pour le détail. Ce qui n\'est pas coché passe automatiquement au jour suivant.</p>';
  };
  V.jour = d => {
    if (!/^\d{4}-\d\d-\d\d$/.test(d || '')) d = today();
    const day = P.dayOf(d), tasks = P.dayTasks(d), t = today();
    let h = '<a href="#/planning" class="small">← Planning</a><h1 style="font-size:1.3rem;margin:8px 0 4px;text-transform:capitalize">' + esc(D.fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })) + '</h1>' +
      '<div class="row wrap" style="gap:6px;margin-bottom:12px">' + (day ? '<span class="chip ' + P.PH[day.ph][1] + '">' + P.PH[day.ph][0] + '</span><span class="chip gray">' + esc(day.lab) + '</span>' + (day.h ? '<span class="chip gray">⏱ ' + day.h + ' h prévues</span>' : '') : '') +
      (d > t ? '<span class="chip gray">dans ' + D.diff(d, t) + ' j</span>' : '') + '</div>';
    h += tasks.length ? tasks.map(x => taskRow(x, false)).join('') : '<div class="card empty">Aucune tâche ce jour.</div>';
    h += '<button class="btn ghost block" data-act="pick" data-d="' + d + '">+ Ajouter un cours à ce jour</button>';
    const nav = '<div class="row" style="justify-content:space-between;margin-top:14px">' + (d > P.START ? '<a class="btn sm ghost" href="#/jour/' + D.add(d, -1) + '">← Veille</a>' : '<span></span>') + (d < P.EXAM ? '<a class="btn sm ghost" href="#/jour/' + D.add(d, 1) + '">Lendemain →</a>' : '') + '</div>';
    main.innerHTML = h + nav;
  };

  /* ---------- S'ENTRAÎNER ---------- */
  V.train = () => {
    const cardsN = P.cardsDue().length, wrongN = P.wrongDue().length;
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:12px">🎯 S\'entraîner</h1><div class="grid2">' +
      tile('#/quiz', '🧠', 'Quiz mélangé', 'V/F, QCM et cas cliniques de tes cours, mélangés') +
      tile('#/refaire', '🔁', 'Refaire mes erreurs', wrongN + ' question' + (wrongN > 1 ? 's' : '') + ' à retenter') +
      tile('#/cartes', '🃏', 'Cartes (répétition espacée)', cardsN + ' carte' + (cardsN > 1 ? 's' : '') + ' aujourd\'hui') +
      tile('#/cliches', '🩻', 'Clichés au chrono', 'Trouve l\'anomalie en 3 minutes') +
      tile('#/ecos', '🎤', 'ECOS', 'Oral de 2 minutes sur chaque TD, avec grille') +
      tile('#/jeu', '🕵️', 'Qui suis-je ?', 'Devine la maladie avec le moins d\'indices') +
      tile('#/outils', '🧮', 'Calculateurs', 'Gazométrie, EFR, Light, Wells, CRB-65…') +
      tile('#/exam', '⏱️', 'Examen blanc', 'Minuteur et score, comme le jour J') +
      tile('#/pomodoro', '🍅', 'Pomodoro', '25 min de concentration, 5 min de pause') +
      tile('#/glossaire', '📖', 'Glossaire', 'Les mots difficiles, en français et en arabe') +
      tile('#/veille', '🌙', 'À relire la veille', 'L\'essentiel de chaque cours étudié') +
      tile('#/annales', '📝', 'Annales par thème', 'Coche les questions faites') + '</div>';
  };
  V.quiz = () => { main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:12px">🧠 Quiz mélangé</h1><div id="qz"></div>'; P.Q.setup(main.querySelector('#qz'), null); };
  V.refaire = () => {
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:12px">🔁 Refaire mes erreurs</h1><div id="qz"></div>';
    const ids = P.wrongDue(), items = P.Q.byIds(ids);
    if (!items.length) { main.querySelector('#qz').innerHTML = '<div class="card empty">Aucune erreur à refaire aujourd\'hui. Les questions ratées reviennent le lendemain, puis 3 jours plus tard.</div>'; return; }
    P.Q.run(main.querySelector('#qz'), items, {});
  };
  V.cartes = sc => {
    const vocab = sc === 'vocab';
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">🃏 ' + (vocab ? 'Cartes de vocabulaire' : 'Cartes du jour') + '</h1><p class="small muted">' + (vocab ? 'Les mots difficiles du glossaire.' : 'Les pièges et les vrai/faux des cours que tu as étudiés, à intervalles croissants (boîtes de Leitner).') + ' <a href="#/cartes' + (vocab ? '' : '/vocab') + '">' + (vocab ? 'Cartes du jour' : 'Cartes de vocabulaire') + ' →</a></p><div id="cz"></div>';
    P.C.run(main.querySelector('#cz'), vocab ? P.glossCards().sort(() => Math.random() - .5) : P.cardsDue(), { free: vocab });
  };
  V.cliches = () => { main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">🩻 Clichés au chrono</h1><div id="xz"></div>'; P.X.run(main.querySelector('#xz')); };
  V.ecos = id => {
    const tds = P.lessons.filter(l => P.F[l.id] && P.F[l.id].k);
    if (id) { main.innerHTML = '<a href="#/ecos" class="small">← ECOS</a><div id="ez" style="margin-top:8px"></div>'; P.E.run(main.querySelector('#ez'), id); return; }
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">🎤 ECOS</h1><p class="small muted">Choisis un TD : 2 minutes pour l\'expliquer à voix haute, puis coche ce que tu as dit.</p>' +
      tds.map(l => { const e = S.ecos[l.id]; return '<a class="tile" style="margin-bottom:9px" href="#/ecos/' + l.id + '"><span class="ti">🎤</span><span class="grow"><h3>' + esc(l.t) + '</h3><p>' + (e ? 'Meilleur score ' + e.best + ' % · ' + e.n + ' essai' + (e.n > 1 ? 's' : '') : 'Pas encore entraîné') + '</p></span></a>'; }).join('') +
      (tds.length ? '' : '<div class="card empty">Les grilles ECOS arrivent avec les fiches des TD.</div>');
  };
  V.outils = () => {
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">🧮 Calculateurs</h1><p class="small muted">Entre les valeurs d\'un cas clinique : le calculateur explique le raisonnement étape par étape.</p>' + Object.keys(P.calcs).map(k => U.calcHTML(k)).join('');
    U.bindCalcs(main);
  };
  V.jeu = () => { main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">🕵️ Qui suis-je ?</h1><div id="gz"></div>'; P.G.run(main.querySelector('#gz')); };
  V.exam = () => { main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">⏱️ Examen blanc</h1><div id="tz"></div>'; P.T.exam(main.querySelector('#tz')); };
  V.pomodoro = () => { main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">🍅 Pomodoro</h1><div id="tz"></div>'; P.T.pomo(main.querySelector('#tz')); };

  /* ---------- glossaire, veille, recherche ---------- */
  V.glossaire = () => {
    const g = (P.gloss || []).slice().sort((a, b) => a.t.localeCompare(b.t, 'fr'));
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">📖 Glossaire</h1><p class="small muted">' + g.length + ' mots difficiles. Dans les fiches, ils sont soulignés en pointillés : touche-les pour voir l\'explication. <a href="#/cartes/vocab">Les réviser en cartes →</a></p>' +
      '<div class="srch" style="margin:10px 0">' + U.ic.search + '<input class="input" id="gq" placeholder="Chercher un mot…"></div><div id="gl">' +
      g.map(x => '<div class="card flat" data-q="' + esc((x.t + ' ' + x.d + ' ' + (x.ar || '')).toLowerCase()) + '" style="margin-bottom:8px;padding:12px 14px"><b style="color:var(--purple)">' + esc(x.t) + '</b><div style="margin-top:3px">' + md(x.d, true) + '</div>' + (x.ar ? '<div lang="ar" style="direction:rtl;text-align:right;margin-top:5px;color:var(--ink2)">' + esc(x.ar) + '</div>' : '') + '</div>').join('') + '</div>';
    main.querySelector('#gq').addEventListener('input', e => { const s = e.target.value.toLowerCase(); main.querySelectorAll('#gl>div').forEach(c => { c.style.display = c.dataset.q.includes(s) ? '' : 'none'; }); });
  };
  V.veille = () => {
    const ls = P.lessons.filter(l => P.F[l.id]);
    main.innerHTML = '<div class="row" style="justify-content:space-between"><h1 style="font-size:1.35rem">🌙 À relire la veille</h1><button class="btn sm ghost" onclick="print()">🖨️ Imprimer</button></div><p class="small muted">Pour chaque cours : l\'essentiel et les règles qui font gagner des points. Ne rien apprendre de nouveau la veille.</p>' +
      ls.map(l => { const f = P.F[l.id]; return '<div class="card"><h3 style="color:' + gc(l)[0] + '">' + esc(lname(l)) + '</h3>' + (f.e ? '<ul>' + f.e.map(x => '<li>' + md(x, true) + '</li>').join('') + '</ul>' : '') +
        (f.p ? '<div class="small" style="font-weight:800;margin-top:6px">Pièges → règles</div><ul class="small">' + f.p.slice(0, 5).map(p => '<li>' + md(p[2], true) + '</li>').join('') + '</ul>' : '') + '</div>'; }).join('');
  };
  V.recherche = q => {
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:10px">🔎 Recherche</h1><div class="srch">' + U.ic.search + '<input class="input" id="sq" placeholder="Ex. Damoiseau, BAAR, Light, VEMS…" value="' + esc(q || '') + '"></div><div id="sr" style="margin-top:12px"></div>';
    const inp = main.querySelector('#sq'), out = main.querySelector('#sr');
    const idx = [];
    P.lessons.forEach(l => {
      const f = P.F[l.id];
      idx.push([l.t, '#/c/' + l.id, l.t + ' ' + (l.kw || ''), CAT[l.cat]]);
      if (!f) return;
      (f.e || []).forEach(x => idx.push([l.t, '#/c/' + l.id, x, 'Essentiel']));
      (f.s || []).forEach(s => s[2].forEach(b => { const tx = typeof b === 'string' ? b : b.slice(1).flat(2).filter(z => typeof z === 'string').join(' · '); idx.push([l.t + ' › ' + s[0], '#/c/' + l.id, tx, 'Fiche']); }));
      (f.p || []).forEach(p => idx.push([l.t + ' › ' + p[0], '#/c/' + l.id + '/pieges', p[1] + ' → ' + p[2], 'Piège']));
    });
    (P.gloss || []).forEach(g => idx.push([g.t, '#/glossaire', g.d, 'Glossaire']));
    const norm = s => U.plain(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const run = () => {
      const s = norm(inp.value.trim());
      if (s.length < 2) { out.innerHTML = '<p class="muted small">Tape au moins 2 lettres.</p>'; return; }
      const res = idx.filter(r => norm(r[2] + ' ' + r[0]).includes(s)).slice(0, 60);
      out.innerHTML = res.length ? res.map(r => { const tx = U.plain(r[2]); const i = norm(tx).indexOf(s); const snip = i < 0 ? tx.slice(0, 140) : (i > 50 ? '…' : '') + tx.slice(Math.max(0, i - 50), i) + '<span class="hl">' + esc(tx.slice(i, i + s.length)) + '</span>' + tx.slice(i + s.length, i + s.length + 90) + '…';
        return '<a class="res-it" href="' + r[1] + '"><small>' + esc(r[3]) + ' · ' + esc(r[0]) + '</small><div>' + (i < 0 ? esc(snip) : esc(snip.split('<span class="hl">')[0]) + '<span class="hl">' + esc(tx.slice(i, i + s.length)) + '</span>' + esc(tx.slice(i + s.length, i + s.length + 90)) + '…') + '</div></a>'; }).join('') : '<div class="card empty">Rien trouvé.</div>';
    };
    inp.addEventListener('input', run); if (q) run(); inp.focus();
  };

  /* ---------- MOI : progression, badges, erreurs, réglages ---------- */
  V.moi = () => {
    const L = P.level(), studied = P.lessons.filter(l => P.isStudied(l.id)).length;
    const qn = Object.values(S.qs).reduce((a, b) => a + b.n, 0), qok = Object.values(S.qs).reduce((a, b) => a + b.ok, 0);
    const revN = Object.values(S.L).reduce((a, l) => a + ((l.hist || []).length), 0);
    let h = '<div class="card"><div class="lvl"><div class="av">🩺</div><div class="grow"><div class="small muted" style="font-weight:800">NIVEAU ' + L.L + '</div><h2>' + esc(L.title) + '</h2><div class="bar" style="margin-top:8px"><i style="width:' + L.pct + '%"></i></div><div class="small muted" style="margin-top:4px">' + S.xp + ' / ' + L.to + ' XP pour le niveau suivant</div></div></div></div>';
    h += '<div class="kpi"><div><b>🔥 ' + P.streak() + '</b><span>jours de suite</span></div><div><b>' + studied + '/' + P.lessons.length + '</b><span>cours étudiés</span></div><div><b>' + revN + '</b><span>révisions faites</span></div><div><b>' + qn + '</b><span>questions</span></div><div><b>' + (qn ? Math.round(100 * qok / qn) + ' %' : '—') + '</b><span>bonnes réponses</span></div><div><b>' + (S.cli.n || 0) + '</b><span>clichés lus</span></div></div>';
    h += '<div class="h-sec"><h2>📈 XP des 14 derniers jours</h2></div><div class="card">' + barChart(Array.from({ length: 14 }, (_, i) => { const d = D.add(today(), i - 13); return [D.short(d), S.xpd[d] || 0]; })) + '</div>';
    const sc = Object.keys(S.days).sort().filter(d => S.days[d].qcm != null).slice(-20);
    if (sc.length >= 2) h += '<div class="h-sec"><h2>🎯 Score QCM par jour</h2></div><div class="card">' + lineChart(sc.map(d => [D.short(d), S.days[d].qcm])) + '</div>';
    const ml = P.lessons.filter(l => S.qs[l.id] && S.qs[l.id].n >= 3).sort((a, b) => P.mastery(a.id) - P.mastery(b.id));
    if (ml.length) h += '<div class="h-sec"><h2>🧩 Maîtrise par cours</h2></div><div class="card">' + ml.map(l => '<a href="#/c/' + l.id + '/quiz" style="display:block;color:var(--ink);margin:7px 0"><div class="row small"><span class="grow">' + esc(l.t) + '</span><b>' + P.mastery(l.id) + ' %</b></div><div class="bar' + (P.mastery(l.id) >= 70 ? ' green' : '') + '"><i style="width:' + P.mastery(l.id) + '%"></i></div></a>').join('') + '</div>';
    const cal = S.cal || {};
    if (Object.keys(cal).length) h += '<div class="h-sec"><h2>🧭 Ta confiance est-elle juste ?</h2></div><div class="card small">' + [['sur', 'Sûr de moi'], ['hesite', 'J\'hésitais'], ['hasard', 'Au hasard']].map(([k, n]) => cal[k] ? '<div class="row" style="margin:5px 0"><span class="grow">' + n + '</span><b>' + Math.round(100 * cal[k][1] / cal[k][0]) + ' % justes</b><span class="muted">(' + cal[k][0] + ')</span></div>' : '').join('') + '<p class="muted" style="margin:6px 0 0">Si « Sûr de moi » est sous 85 %, tu te fais piéger par des certitudes : relis les pièges.</p></div>';
    h += '<div class="h-sec"><h2>🏅 Badges</h2><span class="small muted">' + Object.keys(S.bdg).length + '/' + P.BADGES.length + '</span></div><div class="bdg">' + P.BADGES.map(b => '<div class="' + (S.bdg[b[0]] ? '' : 'off') + '" title="' + esc(b[3]) + '"><span class="e">' + b[1] + '</span>' + esc(b[2]) + '<div class="muted" style="font-weight:500;margin-top:2px">' + esc(b[3]) + '</div></div>').join('') + '</div>';
    h += '<div class="grid2" style="margin-top:16px">' + tile('#/erreurs', '🧠', 'Journal d\'erreurs', S.err.length + ' erreur' + (S.err.length > 1 ? 's' : '') + ' notée' + (S.err.length > 1 ? 's' : '')) + tile('#/reglages', '⚙️', 'Réglages et sauvegarde', 'Thème, sons, exporter ma progression') + '</div>';
    main.innerHTML = h;
  };
  function barChart(data) {
    const W = 640, H = 170, mx = Math.max(10, ...data.map(d => d[1])), bw = W / data.length;
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '">' + data.map((d, i) => { const h = (H - 34) * d[1] / mx; return '<rect x="' + (i * bw + 5) + '" y="' + (H - 22 - h) + '" width="' + (bw - 10) + '" height="' + Math.max(h, 1) + '" rx="5" fill="url(#gb)"/>' + (d[1] ? '<text x="' + (i * bw + bw / 2) + '" y="' + (H - 27 - h) + '" font-size="11" text-anchor="middle" fill="currentColor">' + d[1] + '</text>' : '') + '<text x="' + (i * bw + bw / 2) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="var(--muted)">' + d[0] + '</text>'; }).join('') +
      '<defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4fe0"/><stop offset="1" stop-color="#2f6fde"/></linearGradient></defs></svg>';
  }
  function lineChart(data) {
    const W = 640, H = 180, pad = 30, x = i => pad + i * (W - 2 * pad) / Math.max(1, data.length - 1), y = v => H - 24 - (H - 44) * v / 100;
    const pts = data.map((d, i) => x(i) + ',' + y(d[1])).join(' ');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '">' + [0, 50, 100].map(v => '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)"/><text x="4" y="' + (y(v) + 4) + '" font-size="10" fill="var(--muted)">' + v + '%</text>').join('') +
      '<polyline points="' + pts + '" fill="none" stroke="#2f6fde" stroke-width="3" stroke-linejoin="round"/>' + data.map((d, i) => '<circle cx="' + x(i) + '" cy="' + y(d[1]) + '" r="4.5" fill="#7a4fe0"/><text x="' + x(i) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="var(--muted)">' + d[0] + '</text>').join('') + '</svg>';
  }
  V.erreurs = () => {
    const t = today();
    const due = e => (!e.j3 && D.diff(t, e.d) >= 3) || (!e.j7 && D.diff(t, e.d) >= 7);
    const list = S.err.slice().sort((a, b) => (due(b) - due(a)) || (a.d < b.d ? 1 : -1));
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:6px">🧠 Journal d\'erreurs</h1><p class="small muted">Une ligne par erreur : ce que tu as pensé, puis la règle juste. Relis-la à J+3 et à J+7.</p>' +
      '<div class="card"><div class="row wrap"><div class="grow" style="min-width:160px"><label class="lb">Thème</label><select class="input" id="et"><option value="">—</option>' + P.lessons.map(l => '<option>' + esc(l.t) + '</option>').join('') + '</select></div><div class="grow" style="min-width:160px"><label class="lb">Source (fichier, n°)</label><input class="input" id="es" placeholder="Externat 24-26, Q56"></div></div>' +
      '<label class="lb">Mon erreur</label><textarea class="input" id="ee" style="min-height:60px" placeholder="J\'ai pensé que…"></textarea><label class="lb">La règle juste</label><textarea class="input" id="er" style="min-height:60px" placeholder="En fait…"></textarea><button class="btn block" style="margin-top:10px" data-act="erradd">Ajouter</button></div>' +
      (list.length ? list.map(e => '<div class="card' + (due(e) ? '" style="box-shadow:0 0 0 2px var(--orange)' : '') + '"><div class="row small muted"><span class="grow">' + D.short(e.d) + (e.th ? ' · ' + esc(e.th) : '') + (e.src ? ' · ' + esc(e.src) : '') + (due(e) ? ' · <b style="color:var(--orange)">à relire aujourd\'hui</b>' : '') + '</span><button class="more" data-act="errdel" data-id="' + e.id + '" aria-label="Supprimer">🗑️</button></div>' +
        '<div class="co pie" style="margin:8px 0 6px"><div class="cl">✗ Mon erreur</div>' + md(e.err, true) + '</div><div class="co ast" style="margin:0"><div class="cl">✓ La règle juste</div>' + md(e.rule, true) + '</div>' +
        '<div class="row" style="margin-top:8px;gap:14px"><label class="small"><input type="checkbox" data-act="errck" data-id="' + e.id + '" data-k="j3"' + (e.j3 ? ' checked' : '') + '> Relu à J+3</label><label class="small"><input type="checkbox" data-act="errck" data-id="' + e.id + '" data-k="j7"' + (e.j7 ? ' checked' : '') + '> Relu à J+7</label></div></div>').join('') : '<div class="card empty">Aucune erreur notée. Après chaque quiz, tu peux ajouter tes erreurs en un geste.</div>');
  };
  ACT.erradd = () => {
    const g = id => document.getElementById(id).value.trim();
    if (!g('ee') && !g('er')) { U.toast('Écris au moins ton erreur ou la règle'); return; }
    S.err.push({ id: 'e' + Date.now().toString(36), d: today(), th: g('et'), src: g('es'), err: g('ee'), rule: g('er'), j3: false, j7: false });
    P.save(); P.addXP(5, 'erreur notée'); P.checkBadges(); V.erreurs();
  };
  ACT.errdel = el => { if (confirm('Supprimer cette erreur ?')) { S.err = S.err.filter(e => e.id !== el.dataset.id); P.save(); V.erreurs(); } };
  ACT.errck = el => { const e = S.err.find(x => x.id === el.dataset.id); if (e) { e[el.dataset.k] = el.checked; P.save(); if (el.checked) P.addXP(3, 'erreur relue'); } };
  V.reglages = () => {
    const s = S.set;
    const sw = (k, lab) => '<label class="cr" style="display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)"><span class="grow">' + lab + '</span><input type="checkbox" data-set="' + k + '"' + (s[k] ? ' checked' : '') + ' style="width:22px;height:22px;accent-color:var(--blue)"></label>';
    main.innerHTML = '<h1 style="font-size:1.35rem;margin-bottom:12px">⚙️ Réglages</h1><div class="card"><label class="lb">Thème</label><div class="seg">' + [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(t => '<button data-act="theme" data-v="' + t[0] + '" class="' + (s.theme === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' +
      sw('sound', 'Sons et vibration à la fin des chronos') + sw('confetti', 'Confettis quand tu termines quelque chose') + sw('conf', 'Me demander ma confiance dans les quiz') +
      '<label class="cr" style="display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)"><span class="grow">Nouvelles cartes par jour</span><input class="input" type="number" min="0" max="200" data-set="newCards" value="' + s.newCards + '" style="max-width:90px"></label></div>' +
      '<div class="card"><h3>💾 Sauvegarde</h3><p class="small muted">Ta progression est enregistrée dans ce navigateur, sur cet appareil. Pour la retrouver sur un autre appareil, exporte-la puis importe-la là-bas.</p><div class="row wrap"><button class="btn" data-act="export">⬇️ Exporter ma progression</button><label class="btn ghost">⬆️ Importer<input type="file" accept=".json,application/json" id="imp" class="sr"></label></div>' +
      (P.storageOk() ? '' : '<p class="small" style="color:var(--red)">La sauvegarde automatique ne marche pas dans ce navigateur : exporte régulièrement.</p>') + '</div>' +
      '<div class="card"><h3>🧭 Divers</h3><div class="row wrap" style="margin-top:8px"><button class="btn ghost" data-act="onboard">Revoir l\'accueil</button><button class="btn red" data-act="reset">Tout effacer</button></div>' +
      '<p class="small muted" style="margin-top:12px">Les radiographies du site sont des schémas pédagogiques dessinés par ordinateur, pas de vraies images de patients. Les fiches résument les cours de 4e année : en cas de doute, ton cours et ton enseignant font foi.</p></div>';
    main.querySelectorAll('[data-set]').forEach(i => i.addEventListener('change', () => { s[i.dataset.set] = i.type === 'checkbox' ? i.checked : +i.value; P.save(); }));
    main.querySelector('#imp').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(txt => { try { P.importData(txt); U.toast('Progression importée ✅'); applyTheme(); route(); } catch (err) { U.toast('Fichier invalide'); } });
    });
  };
  ACT.theme = el => { S.set.theme = el.dataset.v; P.save(); applyTheme(); V.reglages(); };
  ACT.export = () => {
    const blob = new Blob([P.exportData()], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pneumo-revision-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
    U.toast('Fichier téléchargé');
  };
  ACT.reset = () => { if (confirm('Effacer TOUTE ta progression sur cet appareil ? (Pense à exporter avant.)') && confirm('Vraiment tout effacer ?')) { P.resetAll(); applyTheme(); location.hash = '#/'; onboard(); } };
  ACT.onboard = () => onboard(true);

  /* ---------- accueil (premier lancement) ---------- */
  function onboard(force) {
    if (S.onboard && !force) return;
    const pre = P.lessons.filter(l => l.pre).map(l => l.id);
    const past = P.allTasks().filter(t => t.d < today()).length;
    U.sheet('Bienvenue 👋', '<p>Ce site t\'accompagne jusqu\'à l\'<b>examen de pneumologie du 17 décembre 2026</b> :</p><ul><li>chaque jour, ton programme ; ce que tu ne coches pas passe au lendemain ;</li><li>des révisions espacées programmées pour toi (J+1, J+3, J+7, J+14) ;</li><li>pour chaque cours : fiche en couleurs, pièges, quiz, cartes ;</li><li>les mots difficiles sont <button class="term" type="button">soulignés</button> : touche-les pour l\'explication.</li></ul>' +
      '<label class="lb">Coche les cours que tu as déjà étudiés</label><div style="max-height:240px;overflow:auto">' + P.lessons.map(l => '<label class="pick" style="cursor:pointer"><input type="checkbox" class="obl" value="' + l.id + '"' + (P.isStudied(l.id) || (!S.onboard && pre.includes(l.id)) ? ' checked' : '') + ' style="width:20px;height:20px;accent-color:var(--blue)"><span class="grow">' + esc(lname(l)) + '</span></label>').join('') + '</div>' +
      (past && !S.onboard ? '<label class="lb">Les tâches des jours déjà passés</label><select class="input" id="obpast"><option value="carry">Les reporter à aujourd\'hui</option><option value="skip">Les ignorer (je commence aujourd\'hui)</option></select>' : '') +
      '<button class="btn block" style="margin-top:14px" id="obgo">C\'est parti 🚀</button>', root => {
      root.querySelector('#obgo').onclick = () => {
        const y = D.add(today() < P.START ? P.START : today(), -1);
        root.querySelectorAll('.obl').forEach(c => { if (c.checked && !P.isStudied(c.value)) P.study(c.value, y); if (!c.checked && P.isStudied(c.value)) P.unstudy(c.value); });
        const ps = root.querySelector('#obpast');
        if (ps && ps.value === 'skip') P.allTasks().filter(t => t.d < today() && !P.isDone(t)).forEach(t => { S.T[t.id] = { skip: today() }; });
        S.onboard = true; P.save(); U.closeSheet(); route();
      };
    });
  }

  /* ---------- routeur ---------- */
  const NAV = [['', 'home', 'Aujourd\'hui'], ['cours', 'book', 'Cours'], ['train', 'target', 'S\'entraîner'], ['planning', 'cal', 'Planning'], ['moi', 'user', 'Moi']];
  const NAVMAP = { c: 'cours', jour: 'planning', quiz: 'train', refaire: 'train', cartes: 'train', cliches: 'train', ecos: 'train', outils: 'train', jeu: 'train', exam: 'train', pomodoro: 'train', glossaire: 'train', veille: 'train', annales: 'train', erreurs: 'moi', reglages: 'moi', recherche: '' };
  let last = '';
  function route(keepScroll) {
    const h = location.hash.replace(/^#\/?/, ''), parts = h.split('/').map(decodeURIComponent), r = parts[0] || '';
    clearTimers(); U.closePop(); U.stopSpeak(); U.resetTerms();
    const view = r === '' ? V.today : V[r];
    if (!view) { location.hash = '#/'; return; }
    view(...parts.slice(1));
    const navKey = NAVMAP[r] !== undefined ? NAVMAP[r] : r;
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.r === navKey));
    if (!keepScroll && h !== last) window.scrollTo(0, 0);
    last = h;
    U.refreshTop();
  }
  P.route = route;
  function rerender() { const y = scrollY; route(true); window.scrollTo(0, y); }
  P.rerender = rerender;
  function applyTheme() {
    const t = S.set.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.set.theme;
    document.documentElement.dataset.theme = t;
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#0e1420' : '#1e3a62';
  }
  P.start = () => {
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    document.getElementById('app').innerHTML = '<header class="top"><a class="logo" href="#/"><span class="lg">🫁</span><span>Pneumo<span class="lt2"> Révision</span></span></a><span class="sp"></span>' +
      '<a class="pill" id="stPill" href="#/moi"></a><a class="pill" id="xpPill" href="#/moi"></a><a class="ib" href="#/recherche" aria-label="Rechercher">' + U.ic.search + '</a></header><main id="main"></main>' +
      '<nav class="nav">' + NAV.map(n => '<a href="#/' + n[0] + '" data-r="' + n[0] + '">' + U.ic[n[1]] + '<span>' + n[2] + '</span></a>').join('') + '</nav>';
    main = document.getElementById('main');
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const f = ACT[el.dataset.act];
      if (f) { if (el.tagName !== 'INPUT') e.preventDefault(); f(el, e); }
    });
    window.addEventListener('hashchange', () => route());
    route();
    P.checkBadges();
    onboard();
  };
})();

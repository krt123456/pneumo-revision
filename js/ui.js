/* Pneumo Révision — interface : texte enrichi, glossaire, figures, schémas, calculateurs, notifications */
(function () {
  'use strict';
  const P = window.PNEUMO, S = P.S, D = P.D;
  const U = P.UI = {};

  /* ---------- icônes ---------- */
  const I = (d, f) => '<svg viewBox="0 0 24 24" fill="' + (f ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  U.ic = {
    home: I('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    book: I('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'),
    target: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>'),
    cal: I('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    check: I('<path d="M5 12.5 10 17l9-10"/>'),
    dots: I('<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>', 1),
    search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    sound: I('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
    moon: I('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  };

  /* ---------- texte enrichi + glossaire automatique ---------- */
  const esc = U.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  P.glossByKey = {};
  let gRe = null; const gMap = {};
  (function build() {
    const forms = [];
    (P.gloss || []).forEach(g => {
      P.glossByKey[g.k] = g;
      (g.m || [g.t]).forEach(f => { gMap[f.toLowerCase()] = g.k; forms.push(f); });
    });
    if (!forms.length) return;
    forms.sort((a, b) => b.length - a.length);
    const alt = forms.map(f => esc(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    try { gRe = new RegExp('(^|[^\\p{L}\\p{N}])(' + alt + ')(?![\\p{L}\\p{N}])', 'giu'); } catch (e) { gRe = null; }
  })();
  let seen = null;
  U.resetTerms = () => { seen = new Set(); };
  U.md = (s, noTerms) => {
    let h = esc(s);
    if (gRe && seen && !noTerms) {
      h = h.replace(gRe, (m, pre, w) => {
        const k = gMap[w.toLowerCase()];
        if (!k || seen.has(k)) return m;
        seen.add(k);
        return pre + '<button type="button" class="term" data-act="term" data-k="' + k + '">' + w + '</button>';
      });
    }
    return h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(«'’\/])\*(?!\s)([^*<>]+?)\*(?=$|[\s).,;:»!?'’\/])/g, '$1<i>$2</i>').replace(/==(.+?)==/g, '<mark>$1</mark>')
      .replace(/!!(.+?)!!/g, '<em class="red">$1</em>').replace(/\n/g, '<br>');
  };
  U.plain = s => String(s || '').replace(/\*\*|==|!!/g, '');

  /* ---------- popover du glossaire ---------- */
  let pop = null;
  U.closePop = () => { if (pop) { pop.remove(); pop = null; } };
  U.showTerm = el => {
    const g = P.glossByKey[el.dataset.k]; if (!g) return;
    U.closePop();
    pop = document.createElement('div'); pop.id = 'pop'; pop.setAttribute('role', 'dialog');
    pop.innerHTML = '<button class="x" aria-label="Fermer">×</button><h4>' + esc(g.t) + '</h4><div>' + U.md(g.d, true) + '</div>' +
      (g.ar ? '<div class="ar" lang="ar">' + esc(g.ar) + '</div>' : '');
    document.body.appendChild(pop);
    const r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), innerWidth - pw - 8);
    let top = r.bottom + 8;
    if (top + ph > innerHeight - 76) top = Math.max(8, r.top - ph - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.querySelector('.x').onclick = U.closePop;
  };
  document.addEventListener('click', e => { if (pop && !pop.contains(e.target) && !e.target.closest('.term')) U.closePop(); }, true);
  window.addEventListener('scroll', U.closePop, { passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { U.closePop(); U.closeSheet(); } });

  /* ---------- notifications, fenêtres, confettis, son ---------- */
  U.toast = (msg, cls) => {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    while (box.children.length > 2) box.firstChild.remove();
    const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2400);
  };
  let sheetEl = null;
  U.sheet = (title, html, mount) => {
    U.closeSheet();
    sheetEl = document.createElement('div'); sheetEl.className = 'ov';
    sheetEl.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="sh"><h2>' + esc(title) + '</h2><button class="xbtn" aria-label="Fermer">×</button></div><div class="sb">' + html + '</div></div>';
    document.body.appendChild(sheetEl);
    sheetEl.addEventListener('click', e => { if (e.target === sheetEl) U.closeSheet(); });
    sheetEl.querySelector('.xbtn').onclick = U.closeSheet;
    U.resetTerms();
    if (mount) mount(sheetEl.querySelector('.sb'));
    return sheetEl.querySelector('.sb');
  };
  U.closeSheet = () => { if (sheetEl) { sheetEl.remove(); sheetEl = null; } };
  U.confetti = () => {
    if (!S.set.confetti || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'); c.id = 'confetti'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
    const x = c.getContext('2d'), cols = ['#2f6fde', '#7a4fe0', '#1f9d60', '#f2b400', '#de3b3b', '#e2761b'];
    const ps = Array.from({ length: 130 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .35, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4, s: 4 + Math.random() * 5, c: cols[Math.random() * 6 | 0], r: Math.random() * 6 }));
    let f = 0;
    (function tick() {
      x.clearRect(0, 0, c.width, c.height);
      ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .42; p.vx *= .99; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore(); });
      if (++f < 95) requestAnimationFrame(tick); else c.remove();
    })();
  };
  let actx = null;
  U.beep = (n = 3) => {
    if (!S.set.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < n; i++) {
        const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = 880;
        o.connect(g); g.connect(actx.destination); const t = actx.currentTime + i * .28;
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
        o.start(t); o.stop(t + .24);
      }
    } catch (e) { /* ignore */ }
    if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
  };
  U.speak = text => {
    if (!('speechSynthesis' in window)) { U.toast('Lecture vocale non disponible sur cet appareil'); return; }
    speechSynthesis.cancel();
    const chunks = U.plain(text).match(/[^.!?;\n]+[.!?;\n]*/g) || [];
    const voice = speechSynthesis.getVoices().find(v => /^fr/i.test(v.lang));
    chunks.forEach(ch => { const u = new SpeechSynthesisUtterance(ch.trim()); u.lang = 'fr-FR'; if (voice) u.voice = voice; u.rate = 1.02; speechSynthesis.speak(u); });
  };
  U.stopSpeak = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); };

  /* ---------- anneau de progression ---------- */
  U.ring = (pct, size = 76, sw = 8, col = '#fff', lab) => {
    const r = (size - sw) / 2, c = 2 * Math.PI * r, o = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="' + sw + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + o.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '<text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" fill="' + col + '" font-size="' + (size / 4.6).toFixed(0) + '">' + (lab != null ? lab : Math.round(pct) + '%') + '</text></svg>';
  };

  /* ---------- figures (radios schématiques annotées) ---------- */
  U.fig = (key, cap, opt = {}) => {
    const f = P.figs[key]; if (!f) return '';
    const lab = f.lab || [];
    const mk = lab.map((l, i) => '<button class="mk" data-act="mk" data-i="' + i + '" style="left:' + l[0] + '%;top:' + l[1] + '%" aria-label="Repère ' + (i + 1) + '">' + (i + 1) + '</button>').join('');
    return '<figure class="fig' + (opt.hide ? ' hidelab' : '') + '" data-fig="' + key + '"><div class="stage"><img src="' + f.img + '" width="' + f.w + '" height="' + f.h + '" loading="lazy" alt="' + esc(f.t) + ' (schéma)">' +
      '<div class="dmark">D</div>' + (opt.noMarks ? '' : mk) + (opt.noTools ? '' : '<div class="tools"><button type="button" data-act="figtoggle">' + (opt.hide ? 'Afficher les repères' : 'Cacher les repères') + '</button></div>') + '</div>' +
      (opt.noCap ? '' : '<figcaption><div class="ft">' + esc(f.t) + '</div><ol class="leg">' + lab.map((l, i) => '<li data-act="mk" data-i="' + i + '">' + U.md(l[2]) + '</li>').join('') + '</ol>' +
        (cap ? '<div>' + U.md(cap) + '</div>' : '') + '<div class="cap">' + esc(P.figCaption) + '</div></figcaption>') + '</figure>';
  };

  /* ---------- schémas SVG ---------- */
  const T = (x, y, s, o = {}) => '<text x="' + x + '" y="' + y + '" font-size="' + (o.fs || 13) + '" fill="' + (o.c || 'currentColor') + '" text-anchor="' + (o.a || 'middle') + '" font-weight="' + (o.w || 600) + '">' + esc(s) + '</text>';
  const SV = (w, h, inner) => '<svg viewBox="0 0 ' + w + ' ' + h + '"' + (w > 480 ? ' class="wide"' : '') + ' xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" style="color:var(--ink)">' + inner + '</svg>';
  P.svg = {
    efr: () => {
      const ax = (ox) => '<path d="M' + ox + ' 20v170h170" stroke="currentColor" fill="none" stroke-width="1.5"/>';
      const curve = (ox, d, col) => '<path d="' + d.replace(/X(\d+)/g, (m, n) => ox + +n) + '" fill="none" stroke="' + col + '" stroke-width="3.5" stroke-linecap="round"/>';
      const nrm = 'MX0 190 LX20 40 Q X40 30 X70 70 L X150 190';
      return SV(620, 250, ax(20) + ax(225) + ax(430) +
        curve(20, nrm, '#1f9d60') + T(105, 225, 'Normal', { c: '#1f9d60', w: 800 }) +
        curve(225, nrm, '#c3ccd6') + curve(225, 'MX0 190 LX16 70 Q X30 100 X60 150 Q X90 175 X125 190', '#de3b3b') + T(310, 225, 'Obstructif (TVO)', { c: '#de3b3b', w: 800 }) + T(310, 244, 'concavité « en baïonnette »', { fs: 11, w: 500 }) +
        curve(430, nrm, '#c3ccd6') + curve(430, 'MX0 190 LX14 70 Q X28 64 X48 100 L X95 190', '#2f6fde') + T(515, 225, 'Restrictif (TVR)', { c: '#2f6fde', w: 800 }) + T(515, 244, 'courbe normale mais « en miniature »', { fs: 11, w: 500 }) +
        T(35, 16, 'Débit', { fs: 11, a: 'start' }) + T(190, 205, 'Volume', { fs: 11, a: 'end' }));
    },
    volumes: () => {
      const bar = (x, y, h, col, lab, sub) => '<rect x="' + x + '" y="' + y + '" width="120" height="' + h + '" rx="6" fill="' + col + '" opacity=".9"/>' + T(x + 60, y + h / 2 + 4, lab, { c: '#fff', w: 800 }) + (sub ? T(x + 60, y + h / 2 + 19, sub, { c: '#fff', fs: 10, w: 500 }) : '');
      return SV(560, 300, bar(40, 20, 110, '#2f6fde', 'VRI', 'réserve inspiratoire') + bar(40, 132, 50, '#7a4fe0', 'VT', 'volume courant') + bar(40, 184, 50, '#e2761b', 'VRE', 'réserve expiratoire') + bar(40, 236, 50, '#6a7789', 'VR', 'volume résiduel') +
        '<path d="M175 20v214M168 20h14M168 234h14" stroke="#1f9d60" stroke-width="2.5"/>' + T(190, 130, 'CV = VRI + VT + VRE', { a: 'start', c: '#1f9d60', w: 800 }) +
        '<path d="M330 20v266M323 20h14M323 286h14" stroke="#de3b3b" stroke-width="2.5"/>' + T(345, 160, 'CPT = CV + VR', { a: 'start', c: '#de3b3b', w: 800 }) +
        '<path d="M175 184v102M168 286h14" stroke="#e2761b" stroke-width="2.5"/>' + T(190, 250, 'CRF = VRE + VR', { a: 'start', c: '#e2761b', w: 800 }) +
        T(345, 190, 'VR et CPT : pléthysmographie', { a: 'start', fs: 11, w: 500 }) + T(345, 206, 'ou dilution à l\'hélium', { a: 'start', fs: 11, w: 500 }));
    },
    gds: () => {
      const box = (x, y, w, h, col, t1, t2) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10" fill="' + col + '"/>' + T(x + w / 2, y + (t2 ? h / 2 - 3 : h / 2 + 5), t1, { c: '#fff', w: 800 }) + (t2 ? T(x + w / 2, y + h / 2 + 14, t2, { c: '#fff', fs: 11, w: 500 }) : '');
      const ln = (x1, y1, x2, y2) => '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="var(--muted)" stroke-width="2"/>';
      return SV(640, 300, box(250, 10, 140, 44, '#1e3a62', '1. Le pH', '7,35 – 7,45') +
        ln(320, 54, 160, 90) + ln(320, 54, 480, 90) +
        box(70, 90, 180, 44, '#de3b3b', 'pH < 7,35 : acidose') + box(390, 90, 180, 44, '#2f6fde', 'pH > 7,45 : alcalose') +
        ln(160, 134, 85, 170) + ln(160, 134, 235, 170) + ln(480, 134, 405, 170) + ln(480, 134, 555, 170) +
        box(10, 170, 150, 50, '#e2761b', 'PaCO2 > 45', 'acidose respiratoire') + box(165, 170, 150, 50, '#7a4fe0', 'HCO3⁻ < 22', 'acidose métabolique') +
        box(330, 170, 150, 50, '#e2761b', 'PaCO2 < 35', 'alcalose respiratoire') + box(485, 170, 150, 50, '#7a4fe0', 'HCO3⁻ > 26', 'alcalose métabolique') +
        T(320, 250, '2. L\'anomalie qui va dans le sens du pH est le trouble PRIMITIF', { fs: 12 }) +
        T(320, 270, '3. L\'autre paramètre bouge dans le même sens : c\'est la COMPENSATION', { fs: 12 }) +
        T(320, 290, '4. Puis la PaO2 : < 80 = hypoxémie ; < 60 = insuffisance respiratoire', { fs: 12 }));
    },
    ponction: () => SV(600, 260,
      '<rect x="0" y="0" width="600" height="260" fill="none"/>' +
      '<ellipse cx="170" cy="70" rx="120" ry="34" fill="#e9d7b5" stroke="#b08d57" stroke-width="2"/>' + T(170, 75, 'Côte supérieure', { fs: 12 }) +
      '<ellipse cx="170" cy="200" rx="120" ry="34" fill="#e9d7b5" stroke="#b08d57" stroke-width="2"/>' + T(170, 205, 'Côte inférieure', { fs: 12 }) +
      '<circle cx="120" cy="112" r="9" fill="#de3b3b"/><circle cx="150" cy="114" r="9" fill="#2f6fde"/><circle cx="180" cy="112" r="7" fill="#f2b400"/>' +
      T(300, 108, '← paquet vasculo-nerveux (V-A-N) sous le bord INFÉRIEUR de la côte du dessus', { a: 'start', fs: 11, c: '#de3b3b' }) +
      '<path d="M560 160 L215 160" stroke="#1f9d60" stroke-width="5" stroke-linecap="round"/><path d="M215 160 l18 -8 v16z" fill="#1f9d60"/>' +
      T(390, 150, 'Aiguille : au RAS du bord SUPÉRIEUR de la côte inférieure', { fs: 12, c: '#1f9d60', w: 800 }) +
      T(390, 234, 'Patient assis, penché en avant · en pleine matité, ponction déclive', { fs: 11, w: 500 }) + T(390, 252, '7e–8e espace intercostal = 1 à 2 espaces sous la pointe de l\'omoplate', { fs: 11, w: 700 })),
    drainage: () => SV(600, 330,
      '<path d="M200 30 Q300 10 400 30 L440 300 Q300 320 160 300 Z" fill="var(--soft)" stroke="var(--muted)" stroke-width="2"/>' +
      [70, 105, 140, 175, 210, 245].map(y => '<path d="M190 ' + y + ' Q300 ' + (y - 14) + ' 410 ' + y + '" stroke="var(--line)" stroke-width="5" fill="none"/>').join('') +
      '<path d="M300 22 V300" stroke="var(--muted)" stroke-dasharray="4 4"/>' +
      '<circle cx="245" cy="92" r="11" fill="#2f6fde"/>' + T(150, 80, 'PNO : 2e–3e espace', { a: 'end', fs: 12, c: '#2f6fde', w: 800 }) + T(150, 96, 'intercostal, ligne', { a: 'end', fs: 12, c: '#2f6fde', w: 500 }) + T(150, 112, 'médio-claviculaire', { a: 'end', fs: 12, c: '#2f6fde', w: 500 }) +
      '<path d="M157 95 L232 92" stroke="#2f6fde" stroke-width="2"/>' +
      '<circle cx="420" cy="200" r="11" fill="#1f9d60"/>' + T(455, 180, 'Liquide :', { a: 'start', fs: 12, c: '#1f9d60', w: 800 }) + T(455, 196, '4e–5e espace,', { a: 'start', fs: 12, c: '#1f9d60', w: 500 }) + T(455, 212, 'ligne axillaire', { a: 'start', fs: 12, c: '#1f9d60', w: 500 }) + T(455, 228, 'moyenne', { a: 'start', fs: 12, c: '#1f9d60', w: 500 }) +
      T(300, 325, 'Complément : triangle de sécurité (grand pectoral, grand dorsal, ligne du mamelon)', { fs: 11, w: 500 })),
    tnm: () => {
      const cats = [['T1a', 1, '≤ 1 cm'], ['T1b', 2, '> 1 à 2'], ['T1c', 3, '> 2 à 3'], ['T2a', 4, '> 3 à 4'], ['T2b', 5, '> 4 à 5'], ['T3', 7, '> 5 à 7'], ['T4', 8.5, '> 7 cm']];
      const cols = ['#9cc3ff', '#6fa6ff', '#2f6fde', '#f2b400', '#e2761b', '#de3b3b', '#9b1c1c'];
      return SV(620, 300, cats.map((c, i) => {
        const y = 14 + i * 38, w = 54 * c[1];
        return T(48, y + 20, c[0], { a: 'end', w: 800 }) + '<rect x="58" y="' + (y + 4) + '" width="' + w + '" height="24" rx="6" fill="' + cols[i] + '"/>' + T(66 + w, y + 21, c[2], { a: 'start', fs: 12, w: 600 });
      }).join('') + T(310, 292, 'Taille de la tumeur (plus grand axe) — TNM 9e édition', { fs: 12, w: 600 }));
    },
    tbtl: () => SV(620, 170,
      '<rect x="20" y="40" width="190" height="46" rx="10" fill="#de3b3b"/>' + T(115, 60, '2 mois : RHZE', { c: '#fff', w: 800 }) + T(115, 77, 'phase intensive (4 antibiotiques)', { c: '#fff', fs: 11, w: 500 }) +
      '<rect x="214" y="40" width="386" height="46" rx="10" fill="#2f6fde"/>' + T(407, 60, '4 mois : RH', { c: '#fff', w: 800 }) + T(407, 77, 'phase de continuation (2 antibiotiques)', { c: '#fff', fs: 11, w: 500 }) +
      [[20, 'J0'], [210, 'M2'], [340, 'M5'], [600, 'M6']].map(([x, l]) => '<path d="M' + x + ' 90v14" stroke="currentColor"/>' + T(x, 120, l, { fs: 12 })).join('') +
      T(210, 145, 'Contrôles bacilloscopiques', { fs: 11, w: 500 }) + T(310, 162, 'Total : 6 mois (2 RHZE / 4 RH) : tuberculose pulmonaire commune', { fs: 11, w: 500 })),
    saos: () => SV(620, 220,
      '<path d="M40 40 C120 10 200 10 240 60 L240 200 L40 200 Z" fill="var(--soft)" stroke="var(--muted)" stroke-width="2"/>' +
      '<path d="M150 70 C175 70 185 95 185 120 L185 200" stroke="#2f6fde" stroke-width="16" fill="none" opacity=".35"/>' + T(140, 215, 'Éveil : voies aériennes ouvertes', { fs: 12, c: '#2f6fde' }) +
      '<path d="M380 40 C460 10 540 10 580 60 L580 200 L380 200 Z" fill="var(--soft)" stroke="var(--muted)" stroke-width="2"/>' +
      '<path d="M490 70 C515 70 525 95 525 112 M525 130 L525 200" stroke="#de3b3b" stroke-width="16" fill="none" opacity=".35"/>' +
      '<path d="M505 121 h40" stroke="#de3b3b" stroke-width="5"/>' + T(480, 215, 'Sommeil : collapsus pharyngé → apnée', { fs: 12, c: '#de3b3b' }) +
      T(310, 120, '→', { fs: 40, c: 'var(--muted)' })),
    inhal: () => {
      const seg = [['#e2761b', '> 5 µm', 'bouche et gorge', 'enrouement, dysphonie, candidose', 6], ['#1f9d60', '1 à 5 µm', 'bronches', 'la zone utile du traitement', 4], ['#6b7280', '< 1 µm', 'ressortent', 'à l\'expiration', 2]];
      return SV(400, 228, seg.map((s, i) => { const y = 8 + i * 62;
        return '<rect x="8" y="' + y + '" width="384" height="54" rx="12" fill="' + s[0] + '"/>' +
          [0, 1, 2, 3].map(k => '<circle cx="' + (26 + (k % 2) * 16 + (k > 1 ? 8 : 0)) + '" cy="' + (y + 17 + (k > 1 ? 18 : 0)) + '" r="' + s[4] + '" fill="#fff" opacity=".9"/>').join('') +
          T(76, y + 23, s[1] + ' → ' + s[2], { c: '#fff', w: 800, fs: 15, a: 'start' }) + T(76, y + 43, s[3], { c: '#fff', fs: 12.5, w: 500, a: 'start' }); }).join('') +
        T(200, 214, 'Mauvaise technique = médicament perdu dans la gorge', { fs: 12.5, w: 600 }));
    },
    gina: () => {
      const st = ['CSI-formotérol à la demande', 'CSI-formotérol à la demande', 'CSI-formotérol faible dose, fond + secours', 'CSI-formotérol dose moyenne, fond + secours', '+ LAMA, phénotypage, biothérapie, avis spécialisé'];
      const col = ['#5b8def', '#2f6fde', '#7a4fe0', '#d23a7a', '#de3b3b'];
      return SV(400, 314, st.map((l, i) => { const y = 230 - i * 46, w = 230 + i * 40;
        return '<rect x="8" y="' + y + '" width="' + w + '" height="40" rx="10" fill="' + col[i] + '"/>' + T(20, y + 17, 'Palier ' + (i + 1), { c: '#fff', w: 800, fs: 13, a: 'start' }) + T(20, y + 33, l, { c: '#fff', fs: 11.5, w: 500, a: 'start' }); }).join('') +
        T(200, 290, '↑ Non contrôlé : monter (après avoir vérifié technique et observance)', { fs: 10.5, w: 600 }) +
        T(200, 307, '↓ Contrôlé depuis 3 mois : descendre · secours = CSI-formotérol', { fs: 10.5, w: 500 }));
    },
    epdiag: () => {
      const B = (x, y, w, h, c, l1, l2, fs) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10" fill="' + c + '"/>' + T(x + w / 2, y + (l2 ? h / 2 - 3 : h / 2 + 5), l1, { c: '#fff', w: 800, fs: fs || 12.5 }) + (l2 ? T(x + w / 2, y + h / 2 + 13, l2, { c: '#fff', w: 500, fs: 11 }) : '');
      const L = (x1, y1, x2, y2) => '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="var(--muted)" stroke-width="2"/>';
      return SV(400, 274, L(101, 48, 101, 66) + L(299, 48, 299, 66) + L(101, 110, 101, 128) + L(299, 110, 299, 128) + L(53, 172, 53, 190) + L(149, 172, 149, 190) +
        B(8, 8, 384, 40, '#1e3a62', 'Suspicion d\'EP : probabilité clinique', 'scores de Wells ou de Genève') +
        B(8, 66, 186, 44, '#2f6fde', 'Faible ou intermédiaire') + B(206, 66, 186, 44, '#de3b3b', 'Forte') +
        B(8, 128, 186, 44, '#0d9488', 'D-dimères') + B(206, 128, 186, 44, '#e2761b', 'Angioscanner d\'emblée') +
        B(8, 190, 90, 56, '#1f9d60', 'Négatifs', 'EP écartée', 12) + B(104, 190, 90, 56, '#e2761b', 'Positifs', 'angioscanner', 12) +
        B(206, 190, 186, 56, '#6b7280', 'Insuffisance rénale,', 'grossesse : scintigraphie V/Q', 12) +
        T(200, 266, 'D-dimères négatifs : < 500 µg/L (après 50 ans : < âge × 10)', { fs: 11, w: 600 }));
    },
    eprisk: () => {
      const r = [['#de3b3b', 'Haut risque : état de choc', 'Réanimation · HNF IV · thrombolyse d\'emblée'], ['#e2761b', 'Intermédiaire élevé : VD dilaté + biomarqueurs', 'Soins intensifs · HBPM ou HNF 48–72 h · thrombolyse si choc'], ['#c58b00', 'Intermédiaire faible : sPESI ≥ 1', 'Médecine 5–10 jours · AOD, ou HBPM + AVK'], ['#1f9d60', 'Faible : sPESI = 0', 'Hospitalisation courte · AOD, ou HBPM + AVK · lever à 1 h']];
      return SV(400, 268, r.map((x, i) => { const y = 8 + i * 60; return '<rect x="8" y="' + y + '" width="384" height="52" rx="10" fill="' + x[0] + '"/>' + T(20, y + 22, x[1], { c: '#fff', w: 800, fs: 13, a: 'start' }) + T(20, y + 41, x[2], { c: '#fff', w: 500, fs: 11.5, a: 'start' }); }).join('') +
        T(200, 262, 'Durée de l\'anticoagulation : 3 à 6 mois', { fs: 12, w: 700 }));
    },
    hemo: () => {
      const seg = [['#f2b400', 'Faible', '< 50 mL/24 h'], ['#e2761b', 'Moyenne', '50 à 300 mL/24 h'], ['#de3b3b', 'Grande', '> 200 mL d\'un coup', 'ou > 300 mL/24 h']];
      return SV(400, 196, seg.map((x, i) => '<rect x="' + (8 + i * 130) + '" y="10" width="124" height="74" rx="10" fill="' + x[0] + '"/>' + T(70 + i * 130, 36, x[1], { c: '#fff', w: 800, fs: 14 }) + T(70 + i * 130, 56, x[2], { c: '#fff', fs: 11.5, w: 600 }) + (x[3] ? T(70 + i * 130, 72, x[3], { c: '#fff', fs: 11.5, w: 600 }) : '')).join('') +
        '<rect x="8" y="96" width="384" height="52" rx="10" fill="#1e3a62"/>' + T(200, 118, 'Le danger : l\'asphyxie, pas le choc', { c: '#fff', w: 800, fs: 13.5 }) + T(200, 137, '150 mL suffisent à remplir l\'espace mort', { c: '#fff', fs: 12, w: 500 }) +
        T(200, 170, 'Détresse respiratoire ou gaz du sang altérés = grave,', { fs: 11.5, w: 600 }) + T(200, 187, 'quelle que soit l\'abondance', { fs: 11.5, w: 600 }));
    },
  };
  U.svgfig = (key, cap) => P.svg[key] ? '<figure class="svgfig">' + P.svg[key]() + (cap ? '<figcaption>' + U.md(cap) + '</figcaption>' : '') + '</figure>' : '';

  /* ---------- calculateurs interactifs ---------- */
  const chk = (n, lab, pts) => '<label class="cr"><input type="checkbox" name="' + n + '" data-p="' + (pts || 1) + '"><span class="grow">' + lab + '</span>' + (pts && pts !== 1 ? '<span class="chip">' + String(pts).replace('.', ',') + '</span>' : '') + '</label>';
  const num = (n, lab, ph) => '<label class="cr"><span class="grow">' + lab + '</span><input class="input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" name="' + n + '" placeholder="' + (ph || '') + '"></label>';
  const sumChecks = el => [...el.querySelectorAll('input[type=checkbox]:checked')].reduce((a, i) => a + +i.dataset.p, 0);
  const val = (el, n) => { const v = String(el.querySelector('[name=' + n + ']').value).trim().replace(/\s/g, '').replace(',', '.'); if (v === '' || isNaN(+v)) return null; return +v; };
  const fr = x => String(Math.round(x * 100) / 100).replace('.', ',');
  const FQ = [['Première cigarette après le réveil', [['après 60 min', 0], ['31 à 60 min', 1], ['6 à 30 min', 2], ['dans les 5 min', 3]]], ['Difficile de ne pas fumer là où c\'est interdit ?', [['non', 0], ['oui', 1]]], ['Cigarette la plus dure à abandonner', [['une autre', 0], ['la première du matin', 1]]], ['Cigarettes par jour', [['10 ou moins', 0], ['11 à 20', 1], ['21 à 30', 2], ['31 ou plus', 3]]], ['Fume davantage le matin ?', [['non', 0], ['oui', 1]]], ['Fume même malade, alité ?', [['non', 0], ['oui', 1]]]];
  P.calcs = {
    crb65: { t: 'Score CRB-65 / CURB-65 (PAC)', h: () => chk('c', '**C**onfusion (désorientation)') + chk('u', '**U**rée > 7 mmol/L (≈ 0,42 g/L) — CURB-65 seulement') + chk('r', '**R**espiration : FR ≥ 30/min') + chk('b', '**B**lood pressure : PAS < 90 ou PAD ≤ 60 mmHg') + chk('a', '**65** : âge ≥ 65 ans'),
      f: el => {
        const u = el.querySelector('[name=u]').checked, s = sumChecks(el), crb = s - (u ? 1 : 0);
        const o1 = crb === 0 ? '**0** → traitement ambulatoire possible' : '**' + crb + '** → évaluation à l\'hôpital';
        const o2 = s <= 1 ? 'ambulatoire' : s === 2 ? 'hospitalisation (courte ou surveillance)' : 'hospitalisation, PAC sévère (≥ 4 : réanimation à discuter)';
        return 'CRB-65 = ' + o1 + '<br>CURB-65 = **' + s + '** → ' + o2;
      } },
    light: { t: 'Critères de Light (exsudat ou transsudat ?)', h: () => num('pp', 'Protides pleuraux (g/L)') + num('ps', 'Protides sériques (g/L)') + num('lp', 'LDH pleuraux (UI/L)') + num('ls', 'LDH sériques (UI/L)') + num('lsn', 'Limite sup. normale des LDH sériques (UI/L)', 'ex. 250'),
      f: el => {
        const pp = val(el, 'pp'), ps = val(el, 'ps'), lp = val(el, 'lp'), ls = val(el, 'ls'), lsn = val(el, 'lsn');
        const c = []; let ex = 0, n = 0;
        if (pp != null && ps) { n++; const r = pp / ps; if (r > .5) ex++; c.push('Protides pl/sér = ' + fr(r) + (r > .5 ? ' > 0,5 ✓' : ' ≤ 0,5')); }
        if (lp != null && ls) { n++; const r = lp / ls; if (r > .6) ex++; c.push('LDH pl/sér = ' + fr(r) + (r > .6 ? ' > 0,6 ✓' : ' ≤ 0,6')); }
        if (lp != null && lsn) { n++; const r = lp > 2 / 3 * lsn; if (r) ex++; c.push('LDH pl ' + (r ? '> 2/3 de la normale ✓' : '≤ 2/3 de la normale')); }
        const simple = pp != null ? '<br>Règle du TD : protides ' + fr(pp) + ' g/L → ' + (pp > 35 ? '**exsudat** (> 35 g/L)' : pp < 25 ? '**transsudat** (< 25 g/L)' : 'zone grise (25–35 g/L) : ce sont les critères de Light qui tranchent') : '';
        if (!n) return 'Entre au moins les protides pleuraux et sériques.' + simple;
        return c.join('<br>') + '<br>→ **' + (ex ? 'EXSUDAT' : 'TRANSSUDAT') + '** (' + (ex ? 'au moins 1 critère' : 'aucun critère') + ')' + simple;
      } },
    wells: { t: 'Score de Wells (embolie pulmonaire)', h: () => chk('a', 'Signes cliniques de TVP', 3) + chk('b', 'Autre diagnostic moins probable que l\'EP', 3) + chk('c', 'FC > 100/min', 1.5) + chk('d', 'Immobilisation ≥ 3 j ou chirurgie < 4 semaines', 1.5) + chk('e', 'Antécédent de TVP ou d\'EP', 1.5) + chk('f', 'Hémoptysie', 1) + chk('g', 'Cancer actif', 1),
      f: el => { const s = sumChecks(el); return 'Score = **' + fr(s) + '** → probabilité **' + (s >= 7 ? 'forte (≥ 7)' : s >= 2 ? 'moyenne (2–6)' : 'faible (0–1)') + '**<br>' + (s >= 7 ? 'Forte : **angioscanner thoracique** d\'emblée (scintigraphie si insuffisance rénale ou grossesse)' : 'Faible ou moyenne : **D-dimères** d\'abord ; < 500 µg/L (après 50 ans : < âge × 10) = EP écartée ; sinon angioscanner'); } },
    geneve: { t: 'Score de Genève simplifié (embolie pulmonaire)', h: () => chk('a', 'Âge > 65 ans') + chk('b', 'Antécédent de TVP ou d\'EP') + chk('c', 'Chirurgie ou immobilisation récente') + chk('d', 'Cancer actif') + chk('e', 'Douleur spontanée d\'un mollet') + chk('f', 'Hémoptysie') + chk('g', 'Signes de TVP (œdème, douleur provoquée)') + '<label class="cr"><span class="grow">Fréquence cardiaque</span><select class="input" name="fc" style="max-width:150px"><option value="0">< 75/min</option><option value="1">75 à 94/min (+1)</option><option value="2">≥ 95/min (+2)</option></select></label>',
      f: el => { const s = sumChecks(el) + +el.querySelector('[name=fc]').value; return 'Score = **' + s + '** → probabilité **' + (s >= 5 ? 'forte (≥ 5)' : s >= 2 ? 'intermédiaire (2–4)' : 'faible (0–1)') + '**' + (s >= 5 ? ' : angioscanner d\'emblée' : ' : D-dimères d\'abord'); } },
    spesi: { t: 'PESI simplifié (gravité de l\'EP)', h: () => chk('a', 'Âge > 80 ans') + chk('b', 'Cancer') + chk('c', 'Insuffisance cardiaque ou respiratoire chronique') + chk('d', 'Fréquence cardiaque ≥ 110/min') + chk('e', 'PA systolique < 100 mmHg') + chk('f', 'SaO2 < 90 %') + chk('choc', 'État de choc (PAS < 90 mmHg ou chute > 40 mmHg pendant > 15 min)', 0),
      f: el => { if (el.querySelector('[name=choc]').checked) return '**EP à haut risque** (mortalité > 25 %) : réanimation, HNF IV, **thrombolyse** d\'emblée'; const s = sumChecks(el); return 'sPESI = **' + s + '** → ' + (s === 0 ? '**risque faible** (mortalité à 30 j ≈ 1 %) : hospitalisation courte, AOD ou HBPM' : '**risque intermédiaire** (mortalité ≈ 10,9 %) : chercher une **dysfonction du VD** (VD/VG > 1 au scanner, > 0,9 en échographie) et des **biomarqueurs** (troponine, BNP) : les deux = intermédiaire **élevé** (soins intensifs) ; un seul ou aucun = intermédiaire **faible**'); } },
    gds: { t: 'Interpréter une gazométrie', h: () => num('ph', 'pH', '7,40') + num('co2', 'PaCO2 (mmHg)', '40') + num('hco3', 'HCO3⁻ (mmol/L)', '24') + num('o2', 'PaO2 (mmHg)', '90') + '<label class="cr"><span class="grow">Installation</span><select class="input" name="tps" style="max-width:150px"><option value="a">aiguë</option><option value="c">chronique</option></select></label>',
      f: el => {
        const ph = val(el, 'ph'), co2 = val(el, 'co2'), h = val(el, 'hco3'), o2 = val(el, 'o2'), chr = el.querySelector('[name=tps]').value === 'c';
        if (ph == null || co2 == null || h == null) return 'Entre le pH, la PaCO2 et les HCO3⁻.';
        const out = [];
        let prim = '';
        if (ph < 7.35) { out.push('pH ' + fr(ph) + ' < 7,35 → **acidose**'); prim = co2 > 45 && h < 22 ? 'mixte' : co2 > 45 ? 'resp' : h < 22 ? 'meta' : '?'; }
        else if (ph > 7.45) { out.push('pH ' + fr(ph) + ' > 7,45 → **alcalose**'); prim = co2 < 35 && h > 26 ? 'mixte' : co2 < 35 ? 'resp' : h > 26 ? 'meta' : '?'; }
        else out.push('pH normal → gaz normaux, trouble compensé ou trouble mixte : regarde PaCO2 et HCO3⁻');
        const acid = ph < 7.35;
        if (prim === 'mixte') out.push('PaCO2 et HCO3⁻ vont tous deux dans le sens du pH → **trouble mixte** (' + (acid ? 'acidose respiratoire + métabolique' : 'alcalose respiratoire + métabolique') + ')');
        if (prim === 'meta' && acid) { const e = 1.5 * h + 8; out.push('Acidose **métabolique**. PaCO2 attendue (Winter) = 1,5 × HCO3⁻ + 8 = ' + fr(e) + ' ± 2'); out.push(co2 > e + 2 ? '→ PaCO2 trop haute : **acidose respiratoire associée**' : co2 < e - 2 ? '→ PaCO2 trop basse : **alcalose respiratoire associée**' : '→ compensation respiratoire adaptée'); }
        if (prim === 'meta' && !acid) { const e = 0.7 * h + 21; out.push('Alcalose **métabolique**. PaCO2 attendue ≈ 0,7 × HCO3⁻ + 21 = ' + fr(e) + ' ± 2'); out.push(co2 > e + 2 ? '→ acidose respiratoire associée' : co2 < e - 2 ? '→ alcalose respiratoire associée' : '→ compensation adaptée'); }
        if (prim === 'resp') { const d = co2 - 40, e = 24 + (acid ? (chr ? .35 : .1) : (chr ? .5 : .2)) * d; out.push((acid ? 'Acidose' : 'Alcalose') + ' **respiratoire** ' + (chr ? 'chronique' : 'aiguë') + '. HCO3⁻ attendus ≈ ' + fr(e)); out.push(Math.abs(h - e) <= 2.5 ? '→ compensation rénale adaptée' : h > e ? '→ HCO3⁻ trop hauts : alcalose métabolique associée' : '→ HCO3⁻ trop bas : acidose métabolique associée'); }
        if (prim === '?') out.push('PaCO2 et HCO3⁻ ne vont pas dans le sens du pH : vérifie les valeurs');
        if (o2 != null) out.push(o2 < 60 ? 'PaO2 ' + fr(o2) + ' < 60 → **insuffisance respiratoire**' + (co2 > 45 ? ' hypercapnique (type 2)' : ' hypoxémique (type 1)') : o2 < 80 ? 'PaO2 ' + fr(o2) + ' < 80 → **hypoxémie**' : 'PaO2 normale');
        return out.join('<br>');
      } },
    efr: { t: 'Interpréter une EFR', h: () => num('r', 'VEMS/CV (rapport de Tiffeneau, en % ou 0,xx)', '65') + num('v', 'VEMS (% de la théorique)', '60') + num('cpt', 'CPT (% de la théorique), si connue', '') + num('g', 'Gain de VEMS après β2 (%)', '') + num('gml', 'Gain de VEMS après β2 (mL)', ''),
      f: el => {
        let r = val(el, 'r'); const v = val(el, 'v'), cpt = val(el, 'cpt'), g = val(el, 'g'), gml = val(el, 'gml');
        const out = [];
        if (r != null) { if (r > 1.5) r = r / 100; out.push(r < .7 ? 'Tiffeneau ' + fr(r) + ' < 0,70 → **trouble ventilatoire obstructif**' : 'Tiffeneau ' + fr(r) + ' ≥ 0,70 → pas d\'obstruction'); }
        if (r != null && r < .7 && v != null) out.push('Sévérité (GOLD) : ' + (v >= 80 ? 'légère (GOLD 1, VEMS ≥ 80 %)' : v >= 50 ? 'modérée (GOLD 2, 50–79 %)' : v >= 30 ? 'sévère (GOLD 3, 30–49 %)' : 'très sévère (GOLD 4, < 30 %)'));
        if (cpt != null) out.push(cpt < 80 ? 'CPT ' + cpt + ' % < 80 % → **trouble ventilatoire restrictif**' : cpt > 120 ? 'CPT ' + cpt + ' % > 120 % → **distension**' : 'CPT normale');
        if (g != null || gml != null) { const sig = (g != null ? g >= 12 : true) && (gml != null ? gml >= 200 : true) && (g != null || gml != null); out.push('Réversibilité ' + (sig ? '**significative** (≥ 12 % ET ≥ 200 mL) : en faveur d\'un asthme' : 'non significative : en faveur d\'une BPCO si le TVO persiste')); }
        return out.length ? out.join('<br>') : 'Entre au moins le rapport VEMS/CV.';
      } },
    dep: { t: 'Débit expiratoire de pointe (DEP)', h: () => num('mx', 'DEP le plus haut sur 15 jours (L/min)', '450') + num('mn', 'DEP le plus bas sur 15 jours (L/min)', '360') + num('m', 'DEP mesuré pendant la crise (L/min), si besoin', '') + num('b', 'Meilleure valeur personnelle ou théorique (L/min)', ''),
      f: el => {
        const mx = val(el, 'mx'), mn = val(el, 'mn'), m = val(el, 'm'), b = val(el, 'b'); const out = [];
        if (mx != null && mn != null && mx + mn > 0) { const v = (mx - mn) / ((mx + mn) / 2) * 100; out.push('Variabilité = (max − min) ÷ moyenne = **' + fr(Math.round(v * 10) / 10) + ' %** → ' + (v > 10 ? '**> 10 %** : en faveur d\'un asthme (seuil du cours)' : '≤ 10 % : pas de variabilité significative') + '<br>Ancienne classification GINA : ' + (v < 20 ? '< 20 % (intermittent)' : v <= 30 ? '20–30 % (persistant léger)' : '> 30 % (persistant modéré ou sévère)')); }
        if (m != null && b) { const pc = m / b * 100; out.push('DEP = **' + Math.round(pc) + ' %** de la meilleure valeur → ' + (pc > 80 ? 'crise **légère** (> 80 %)' : pc >= 60 ? 'crise **modérée** (60–80 %)' : '**crise sévère** (< 60 %) : asthme aigu grave possible')); }
        return out.length ? out.join('<br>') : 'Entre le DEP le plus haut et le plus bas.';
      } },
    fager: { t: 'Test de Fagerström (dépendance à la nicotine)', h: () => FQ.map((q, i) => '<label class="cr"><span class="grow">' + q[0] + '</span><select class="input" name="f' + i + '" style="max-width:160px">' + q[1].map(o => '<option value="' + o[1] + '">' + o[0] + '</option>').join('') + '</select></label>').join(''),
      f: el => { let s = 0; for (let i = 0; i < FQ.length; i++) s += +el.querySelector('[name=f' + i + ']').value; return 'Score = **' + s + '/10** → ' + (s <= 2 ? 'pas de dépendance' : s <= 4 ? 'dépendance **faible**' : s <= 6 ? 'dépendance **moyenne**' : 'dépendance **forte**') + (s >= 5 ? ' : une aide au sevrage (substituts nicotiniques…) est utile' : ''); } },
    pa: { t: 'Paquets-années (tabac)', h: () => num('c', 'Cigarettes par jour', '20') + num('y', 'Nombre d\'années', '15'),
      f: el => { const c = val(el, 'c'), y = val(el, 'y'); if (c == null || y == null) return 'Paquets-années = (cigarettes par jour ÷ 20) × années'; const pa = c / 20 * y; return '**' + fr(pa) + ' paquets-années**' + (pa >= 10 ? ' · seuil de risque de BPCO et de cancer bien franchi' : ''); } },
    iah: { t: 'SAOS : sévérité (IAH)', h: () => num('i', 'Index d\'apnées-hypopnées (événements/heure)', '22'),
      f: el => { const i = val(el, 'i'); if (i == null) return 'IAH = nombre d\'apnées + hypopnées par heure de sommeil'; return 'IAH ' + fr(i) + ' → **' + (i < 5 ? 'normal' : i < 15 ? 'SAOS léger (5–14)' : i < 30 ? 'SAOS modéré (15–29)' : 'SAOS sévère (≥ 30)') + '**' + (i >= 5 ? (i >= 30 ? '<br>Polygraphie suffisante (IAH ≥ 30) ; **PPC** en 1re intention' : '<br>IAH < 30 : polysomnographie si le diagnostic repose sur une polygraphie' + (i >= 15 ? '<br>Traitement : **orthèse d\'avancée mandibulaire** en 1re intention, ou **PPC** si maladie cardiovasculaire grave (HTA résistante, FA, AVC…)' : '')) : ''); } },
    epworth: { t: 'Échelle de somnolence d\'Epworth', h: () => ['Assis en lisant', 'Devant la télévision', 'Assis, inactif, dans un lieu public', 'Passager d\'une voiture 1 h sans arrêt', 'Allongé l\'après-midi', 'Assis en parlant à quelqu\'un', 'Assis au calme après un repas sans alcool', 'Au volant, arrêté quelques minutes'].map((s, i) => '<label class="cr"><span class="grow">' + s + '</span><select class="input" name="e' + i + '" style="max-width:110px"><option value="0">0 jamais</option><option value="1">1 faible</option><option value="2">2 moyenne</option><option value="3">3 forte</option></select></label>').join(''),
      f: el => { let s = 0; for (let i = 0; i < 8; i++) s += +el.querySelector('[name=e' + i + ']').value; return 'Score = **' + s + '/24** → ' + (s >= 11 ? '**somnolence diurne excessive** ' + (s <= 15 ? '(modérée : 11–15)' : '(sévère : > 15)') : 'pas de somnolence excessive (pathologique si ≥ 11)'); } },
    tnmstage: { t: 'TNM 9e édition : quel stade ?', h: () => [['t', 'T', ['Tis', 'T1a', 'T1b', 'T1c', 'T2a', 'T2b', 'T3', 'T4']], ['n', 'N', ['N0', 'N1', 'N2a', 'N2b', 'N3']], ['m', 'M', ['M0', 'M1a', 'M1b', 'M1c1', 'M1c2']]].map(x => '<label class="cr"><span class="grow">' + x[1] + '</span><select class="input" name="' + x[0] + '" style="max-width:120px">' + x[2].map(o => '<option>' + o + '</option>').join('') + '</select></label>').join(''),
      f: el => {
        const T = el.querySelector('[name=t]').value, N = el.querySelector('[name=n]').value, M = el.querySelector('[name=m]').value;
        let st;
        if (M === 'M1a' || M === 'M1b') st = 'IVA';
        else if (M !== 'M0') st = 'IVB';
        else if (T === 'Tis') st = N === 'N0' ? '0 (carcinome in situ)' : null;
        else {
          const t = T[1] === '1' ? 1 : T[1] === '2' ? 2 : T === 'T3' ? 3 : 4;
          st = N === 'N0' ? { T1a: 'IA1', T1b: 'IA2', T1c: 'IA3', T2a: 'IB', T2b: 'IIA', T3: 'IIB', T4: 'IIIA' }[T]
            : N === 'N1' ? (t === 1 ? 'IIA' : t === 2 ? 'IIB' : 'IIIA')
            : N === 'N2a' ? (t === 1 ? 'IIB' : t <= 3 ? 'IIIA' : 'IIIB')
            : N === 'N2b' ? (t === 1 ? 'IIIA' : 'IIIB')
            : (t <= 2 ? 'IIIB' : 'IIIC');
        }
        if (!st) return 'Combinaison inhabituelle : un Tis n\'a pas d\'atteinte ganglionnaire.';
        const g = st.indexOf('IV') === 0 ? 'stade métastatique : traitement systémique (thérapie ciblée si mutation)' : (st.indexOf('III') === 0 || N[1] === '2' || N === 'N3') ? 'atteinte médiastinale ou stade III : décision en RCP (chirurgie, radio-chimiothérapie, traitement systémique)' : st[0] === 'I' ? 'stades I–II : chirurgie de référence si le patient est opérable (décision en RCP)' : '';
        return T + ' ' + N + ' ' + M + ' → **stade ' + st + '**' + (g ? '<br>' + g : '');
      } },
    tm6: { t: 'Test de marche de 6 minutes : distance théorique', h: () => num('ta', 'Taille (cm)', '175') + num('ag', 'Âge (ans)', '75') + num('po', 'Poids (kg)', '85') + '<label class="cr"><span class="grow">Sexe</span><select class="input" name="sx" style="max-width:170px"><option value="1">homme</option><option value="0">femme</option></select></label>' + num('di', 'Distance parcourue (m), facultatif', '480') + num('sp', 'SpO2 la plus basse pendant le test (%), facultatif', '91'),
      f: el => {
        const ta = val(el, 'ta'), ag = val(el, 'ag'), po = val(el, 'po'), sx = +el.querySelector('[name=sx]').value, di = val(el, 'di'), sp = val(el, 'sp');
        if (ta == null || ag == null || po == null) return 'Entre la taille, l\'âge et le poids.';
        const th = 218 + 5.14 * ta - 5.32 * ag - 1.8 * po + 51.31 * sx;
        let o = 'Distance théorique = 218 + 5,14 × ' + fr(ta) + ' − 5,32 × ' + fr(ag) + ' − 1,8 × ' + fr(po) + ' + 51,31 × ' + sx + ' = **' + Math.round(th) + ' m**';
        if (di != null && th > 0) o += '<br>Distance parcourue : ' + fr(di) + ' m, soit **' + Math.round(100 * di / th) + ' %** de la distance théorique';
        if (sp != null) o += '<br>' + (sp < 80 ? 'SpO2 ' + fr(sp) + ' % : **désaturation < 80 %** → arrêter le test si elle est mal tolérée' : 'SpO2 la plus basse : ' + fr(sp) + ' %');
        return o;
      } },
    tbcp: { t: 'Antituberculeux : comprimés selon le poids', h: () => num('kg', 'Poids (kg)', '60') + '<label class="cr"><span class="grow">Situation</span><select class="input" name="md" style="max-width:170px"><option value="t">tuberculose maladie</option><option value="i">infection latente (RH 3 mois)</option></select></label>',
      f: el => {
        const kg = val(el, 'kg'), itl = el.querySelector('[name=md]').value === 'i';
        if (kg == null) return 'Entre le poids.';
        if (itl) {
          if (kg < 4) return 'Poids trop faible pour le tableau : avis spécialisé.';
          if (kg < 25) { const n = kg < 8 ? 1 : kg < 12 ? 2 : kg < 16 ? 3 : 4; return fr(kg) + ' kg → **' + n + ' comprimé' + (n > 1 ? 's' : '') + ' de RH enfant (75/50) par jour**, pendant 3 mois.<br>Tableau enfant : 4–7 kg → 1 · 8–11 → 2 · 12–15 → 3 · 16–24 → 4 · ≥ 25 kg → forme adulte.'; }
          const n = kg < 38 ? 2 : kg < 55 ? 3 : kg < 71 ? 4 : 5;
          return fr(kg) + ' kg → **' + n + ' comprimés de RH adulte (150/75) par jour**, pendant 3 mois.<br>Tableau adulte : 25–37 kg → 2 · 38–54 → 3 · 55–70 → 4 · ≥ 71 kg → 5.';
        }
        if (kg < 30) return 'Moins de 30 kg : formes pédiatriques, dose calculée en mg/kg par le médecin.';
        const n = kg < 38 ? 2 : kg < 55 ? 3 : kg < 71 ? 4 : 5;
        return fr(kg) + ' kg → **' + n + ' comprimés par jour** de RHZE (150/75/400/275) pendant la phase intensive, puis **' + n + ' comprimés de RH (150/75)** pendant la phase d\'entretien, le matin à jeun.<br>Bandes de poids : 30–37 kg → 2 · 38–54 → 3 · 55–70 → 4 · ≥ 71 kg → 5.';
      } },
    gold: { t: 'BPCO : stade GOLD et groupe A, B ou E', h: () => num('ti', 'VEMS/CVF après bronchodilatateur', '0,62') + num('v', 'VEMS (% de la valeur théorique)', '45') + num('m', 'Dyspnée mMRC (0 à 4)', '2') + num('cat', 'Score CAT (0 à 40), facultatif', '') + num('ex', 'Exacerbations modérées en 1 an', '1') + chk('h', 'Au moins 1 exacerbation hospitalisée', 0),
      f: el => {
        const ti = val(el, 'ti'), v = val(el, 'v'), m = val(el, 'm'), cat = val(el, 'cat'), ex = val(el, 'ex'), h = el.querySelector('[name=h]').checked;
        if (ti != null && ti >= 0.7) return 'VEMS/CVF = ' + fr(ti) + ' ≥ 0,70 : **pas de trouble ventilatoire obstructif**, donc pas de BPCO (il faut VEMS/CVF < 0,70 après bronchodilatateur).';
        const out = [];
        if (ti != null) out.push('VEMS/CVF = ' + fr(ti) + ' < 0,70 : **obstruction** confirmée');
        if (v != null) out.push('VEMS ' + fr(v) + ' % → **GOLD ' + (v >= 80 ? '1 (léger, ≥ 80 %)' : v >= 50 ? '2 (modéré, 50–79 %)' : v >= 30 ? '3 (sévère, 30–49 %)' : '4 (très sévère, < 30 %)') + '**');
        if (m != null || cat != null || ex != null || h) {
          const E = (ex != null && ex >= 2) || h, sy = (m != null && m >= 2) || (cat != null && cat >= 10);
          out.push('Groupe **' + (E ? 'E' : sy ? 'B' : 'A') + '** : ' + (E ? '≥ 2 exacerbations modérées ou ≥ 1 hospitalisée' : sy ? 'peu d\'exacerbations, symptômes importants (mMRC ≥ 2 ou CAT ≥ 10)' : 'peu d\'exacerbations et peu de symptômes'));
          out.push('Traitement de départ : ' + (E ? '**LAMA + LABA** (ajouter un CSI si éosinophiles ≥ 300/µL)' : sy ? '**LAMA + LABA**' : '**un bronchodilatateur**'));
        }
        return out.join('<br>') || 'Entre le rapport VEMS/CVF, le VEMS et les symptômes.';
      } },
    old: { t: 'Oxygénothérapie de longue durée (OLD) : indiquée ?', h: () => num('o2', 'PaO2 à l\'état stable, en air ambiant (mmHg)', '57') + '<label class="cr"><span class="grow">Maladie</span><select class="input" name="ty" style="max-width:170px"><option value="b">BPCO</option><option value="r">insuffisance respiratoire restrictive</option></select></label>' + chk('p', '**P**olyglobulie (hématocrite > 55 %)', 0) + chk('hh', '**H**ypertension pulmonaire', 0) + chk('i', '**I**nsuffisance cardiaque droite', 0),
      f: el => {
        const o2 = val(el, 'o2'), r = el.querySelector('[name=ty]').value === 'r', phi = ['p', 'hh', 'i'].some(k => el.querySelector('[name=' + k + ']').checked);
        if (o2 == null) return 'Entre la PaO2 mesurée à l\'état stable (à distance d\'une exacerbation).';
        let yes, why;
        if (r) { yes = o2 < 60; why = 'maladie restrictive : seuil PaO2 < 60 mmHg'; }
        else if (o2 < 55) { yes = true; why = 'PaO2 < 55 mmHg'; }
        else if (o2 <= 60) { yes = phi; why = 'PaO2 entre 55 et 60 mmHg : il faut au moins un critère « PHI »' + (phi ? ' (présent)' : ' (absent)'); }
        else { yes = false; why = 'PaO2 > 60 mmHg'; }
        return (yes ? '**OLD indiquée**' : '**OLD non indiquée**') + ' : ' + why + '.' + (yes ? '<br>Au moins **15 h par jour**, débit réglé pour une PaO2 > 60 mmHg (SpO2 > 90 %), et arrêt du tabac.' : '') + (o2 < 70 ? '<br>PaO2 < 70 mmHg à l\'état stable : insuffisance respiratoire chronique.' : '');
      } },
    asthctl: { t: 'Asthme : contrôlé ? (4 dernières semaines)', h: () => chk('a', 'Symptômes dans la journée plus de 2 fois par semaine', 1) + chk('b', 'Au moins un réveil nocturne dû à l\'asthme', 1) + chk('c', 'Bronchodilatateur de secours plus de 2 fois par semaine', 1) + chk('d', 'Limitation des activités due à l\'asthme', 1),
      f: el => { const s = sumChecks(el); return s === 0 ? '**Asthme contrôlé** (code 2-0-2-0 respecté) → garder le traitement, puis envisager de le diminuer' : s <= 2 ? '**Partiellement contrôlé** (' + s + ' critère' + (s > 1 ? 's' : '') + ') → vérifier observance, technique d\'inhalation et exposition, puis augmenter si besoin' : '**Non contrôlé** (' + s + ' critères) → vérifier observance, technique et exposition, puis augmenter le traitement'; } },
    tsize: { t: 'TNM : quel T selon la taille ?', h: () => num('s', 'Plus grand axe de la tumeur (cm)', '3,5'),
      f: el => { const s = val(el, 's'); if (s == null) return 'Le T dépend aussi de l\'extension (plèvre, médiastin, nodules…).'; const t = s <= 1 ? 'T1a' : s <= 2 ? 'T1b' : s <= 3 ? 'T1c' : s <= 4 ? 'T2a' : s <= 5 ? 'T2b' : s <= 7 ? 'T3' : 'T4'; return 'Taille ' + fr(s) + ' cm → **' + t + '** (sur la taille seule ; l\'extension peut faire monter le T)'; } },
  };
  U.calcHTML = key => { const c = P.calcs[key]; if (!c) return ''; return '<div class="calc" data-calc="' + key + '"><h4>🧮 ' + esc(c.t) + '</h4>' + c.h().replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '<div class="out"></div></div>'; };
  U.bindCalcs = root => root.querySelectorAll('.calc[data-calc]').forEach(el => {
    const c = P.calcs[el.dataset.calc]; const out = el.querySelector('.out');
    const run = () => { try { out.innerHTML = U.md(String(c.f(el)).replace(/<br>/g, '\n'), true); } catch (e) { out.textContent = ''; } };
    el.addEventListener('input', run); el.addEventListener('change', run); run();
  });

  /* ---------- barre du haut ---------- */
  U.refreshTop = () => {
    const x = document.getElementById('xpPill'), s = document.getElementById('stPill');
    if (x) x.innerHTML = '⭐ ' + S.xp;
    if (s) s.innerHTML = '🔥 ' + P.streak();
  };
})();

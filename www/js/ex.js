'use strict';
/* Fasih exercises: every renderer is (el, data, done) and calls done({ok, ...}) once */
(function (F) {
  const { esc, rnd, shuffle, norm, now } = F;
  const Ex = F.Ex = {};
  const isAr = s => /[؀-ۿ]/.test(s || '');
  const dir = s => isAr(s) ? 'dir="rtl" class="ar"' : 'dir="ltr" class="en"';
  const blank = s => esc(s).replace(/_{3,}/g, '<span class="blank"></span>');
  const pick = a => a[rnd(a.length)];
  const spk = (t, cls) => `<button class="spk ${cls || ''}" data-say="${esc(t)}" aria-label="استمع">🔊</button>`;
  Object.assign(F, { isAr, dirAttr: dir, spk });
  const lev = (a, b) => { // edit distance, small strings
    const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 3;
    let p = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[n];
  };
  F.lev = lev;

  /* feedback bar. opt: {quick, ans, note} */
  F.feedback = (el, ok, why, cb, opt) => {
    opt = opt || {};
    F.beep(ok ? 'ok' : 'bad'); if (!ok) F.vibrate(50);
    const bar = document.createElement('div');
    bar.className = 'fb ' + (ok ? 'ok' : 'no');
    bar.innerHTML = `<div class="fbm"><b>${ok ? pick(['صحيح ✓', 'أحسنت ✓', 'ممتاز ✓', 'تمام ✓']) : '✗ ليست هذه'}</b>` +
      (opt.note ? `<div class="fbw">${esc(opt.note)}</div>` : '') +
      (!ok && opt.ans ? `<div class="fba">الجواب: <span ${dir(opt.ans)}>${esc(opt.ans)}</span></div>` : '') +
      (why ? `<div class="fbw">${esc(why)}</div>` : '') + `</div><button class="btn fbn">متابعة</button>`;
    el.appendChild(bar);
    bar.scrollIntoView({ block: 'nearest' });
    let fin = false; const go = () => { if (fin) return; fin = true; cb(); };
    bar.querySelector('.fbn').onclick = go;
    if (ok && opt.quick && F.S.set.auto) setTimeout(go, 700);
  };

  /* ---------- generic exercises (grammar, reading, lessons) ---------- */
  Ex.mc = (el, d, done) => {
    const order = d.keep ? d.o.map((_, i) => i) : shuffle(d.o.map((_, i) => i));
    el.innerHTML = `<div class="q">${d.pre || ''}<div class="qt"><span ${dir(d.q)}>${blank(d.q)}</span>${d.say ? spk(d.say) : ''}</div>${d.sub || ''}</div>
      <div class="opts">${order.map(i => `<button class="opt" data-i="${i}"><span ${dir(d.o[i])}>${esc(d.o[i])}</span></button>`).join('')}</div>${d.post || ''}`;
    const t0 = now(); let fin = false;
    if (F.debug) el.dataset.ans = 'mc:' + d.a;
    el.querySelector('.opts').onclick = e => {
      const b = e.target.closest('.opt'); if (!b || fin) return; fin = true;
      const ok = +b.dataset.i === d.a;
      b.classList.add(ok ? 'right' : 'wrong');
      if (!ok) el.querySelector(`.opt[data-i="${d.a}"]`).classList.add('right');
      F.feedback(el, ok, d.why, () => done({ ok, ms: now() - t0 }), { quick: d.quick, note: d.note });
    };
    const x = el.querySelector('.dk');
    if (x) x.onclick = () => { if (fin) return; fin = true; el.querySelector(`.opt[data-i="${d.a}"]`).classList.add('right'); F.feedback(el, false, d.why, () => done({ ok: false, dk: true, ms: now() - t0 }), {}); };
  };
  const textInput = (ph) => `<input class="inp en" dir="ltr" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${ph || ''}">`;
  const bindInput = (el, check) => {
    const inp = el.querySelector('.inp'), btn = el.querySelector('.chk');
    const go = () => { if (!inp.value.trim()) { inp.focus(); return; } inp.disabled = true; btn.disabled = true; check(inp.value, inp); };
    btn.onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);
  };
  Ex.gap = (el, d, done) => {
    el.innerHTML = `<div class="q">${d.pre || '<div class="hint">اكتب الكلمة أو الكلمات الناقصة</div>'}<div class="qt"><span dir="ltr" class="en">${blank(d.q)}</span></div></div>${textInput('…')}<button class="btn chk">تحقق</button>`;
    if (F.debug) el.dataset.ans = 'in:' + d.a[0];
    bindInput(el, (val, inp) => {
      const ok = d.a.some(a => norm(a) === norm(val));
      inp.classList.add(ok ? 'right' : 'wrong');
      F.feedback(el, ok, d.why, () => done({ ok }), { ans: d.a[0] });
    });
  };
  Ex.fix = (el, d, done) => {
    const toks = d.q.split(/\s+/), bad = d.bad.split(/\s+/);
    let s = -1;
    for (let i = 0; i + bad.length <= toks.length; i++) if (bad.every((b, j) => norm(toks[i + j]) === norm(b))) { s = i; break; }
    if (s < 0) for (let i = 0; i < toks.length; i++) if (toks[i].includes(bad[0])) { s = i; break; }
    el.innerHTML = `<div class="q"><div class="hint">في الجملة خطأ واحد: اضغط على الكلمة الخاطئة</div><div class="toks en" dir="ltr">${toks.map((t, i) => `<button class="tok" data-i="${i}">${esc(t)}</button>`).join(' ')}</div></div><div class="fixbox"></div>`;
    let stage = 0, ok1 = true;
    if (F.debug) el.dataset.ans = 'tok:' + s;
    el.querySelector('.toks').onclick = e => {
      const b = e.target.closest('.tok'); if (!b || stage) return; stage = 1;
      if (F.debug) el.dataset.ans = 'in:' + d.good[0];
      const i = +b.dataset.i; ok1 = s >= 0 && i >= s && i < s + bad.length;
      F.$$('.tok', el).forEach((t, j) => { if (j >= s && j < s + bad.length) t.classList.add('bad'); });
      if (!ok1) b.classList.add('miss');
      const box = el.querySelector('.fixbox');
      box.innerHTML = `<div class="hint">${ok1 ? 'صحيح، هذا هو الخطأ.' : 'الخطأ هو الكلمة الملوّنة.'} اكتب التصحيح بدل <b dir="ltr">${esc(d.bad)}</b>:</div>${textInput('…')}<button class="btn chk">تحقق</button>`;
      bindInput(box, (val, inp) => {
        const ok2 = d.good.some(a => norm(a) === norm(val));
        inp.classList.add(ok2 ? 'right' : 'wrong');
        F.feedback(el, ok1 && ok2, d.why, () => done({ ok: ok1 && ok2 }), { ans: d.q.replace(d.bad, d.good[0]) });
      });
    };
  };
  Ex.order = (el, d, done) => {
    const words = d.a.trim().split(/\s+/);
    let pool = shuffle(words.map((w, i) => ({ w, i })));
    if (pool.map(p => p.w).join(' ') === d.a.trim() && words.length > 2) pool = pool.reverse();
    const ans = [];
    el.innerHTML = `<div class="q"><div class="hint">رتّب الكلمات لتكوّن جملة صحيحة</div>${d.ar ? `<div class="qar">${esc(d.ar)}</div>` : ''}</div><div class="line en" dir="ltr"></div><div class="pool en" dir="ltr"></div><button class="btn chk" disabled>تحقق</button>`;
    const line = el.querySelector('.line'), pl = el.querySelector('.pool'), btn = el.querySelector('.chk');
    let fin = false;
    if (F.debug) el.dataset.ans = 'ord:' + JSON.stringify(words);
    const draw = () => {
      line.innerHTML = ans.map((p, k) => `<button class="chip on" data-k="${k}">${esc(p.w)}</button>`).join('') || '<span class="ph">…</span>';
      pl.innerHTML = pool.map((p, k) => `<button class="chip" data-k="${k}">${esc(p.w)}</button>`).join('');
      btn.disabled = pool.length > 0;
    };
    pl.onclick = e => { const b = e.target.closest('.chip'); if (!b || fin) return; ans.push(pool.splice(+b.dataset.k, 1)[0]); F.beep('tap'); draw(); };
    line.onclick = e => { const b = e.target.closest('.chip'); if (!b || fin) return; pool.push(ans.splice(+b.dataset.k, 1)[0]); draw(); };
    btn.onclick = () => { if (fin) return; fin = true; const ok = norm(ans.map(p => p.w).join(' ')) === norm(d.a); line.classList.add(ok ? 'right' : 'wrong'); F.feedback(el, ok, d.why, () => done({ ok }), { ans: d.a }); };
    draw();
  };
  Ex.trans = (el, d, done) => {
    el.innerHTML = `<div class="q"><div class="hint">أعد كتابة الجملة بالمعنى نفسه مبتدئاً بالكلمات المعطاة</div><div class="qt"><span dir="ltr" class="en">${esc(d.q)}</span></div><div class="start en" dir="ltr">${esc(d.start)} …</div></div>${textInput('أكمل الجملة')}<button class="btn chk">تحقق</button>`;
    if (F.debug) el.dataset.ans = 'in:' + d.a[0];
    bindInput(el, (val, inp) => {
      const full = norm(val).startsWith(norm(d.start)) ? norm(val) : norm(d.start + ' ' + val);
      const ok = d.a.some(a => norm(a) === full);
      inp.classList.add(ok ? 'right' : 'wrong');
      F.feedback(el, ok, d.why, () => done({ ok }), { ans: d.a[0] });
    });
  };
  Ex.tfng = (el, d, done) => { const two = d.two; Ex.mc(el, { q: d.q, o: two ? ['True', 'False'] : ['True', 'False', 'Not Given'], a: ['T', 'F', 'NG'].indexOf(d.a), why: d.why, keep: true, pre: '<div class="hint">هل الجملة صحيحة حسب النص؟</div>' }, done); };
  Ex.head = (el, d, done) => Ex.mc(el, { q: 'Paragraph ' + (d.para + 1), o: d.o, a: d.a, why: d.why, pre: '<div class="hint">اختر أفضل عنوان لهذه الفقرة</div>' }, done);
  Ex.run = (el, e, done) => (Ex[e.k] || Ex.mc)(el, e, done);

  /* ---------- a whole question set on one page (reading and listening) ---------- */
  F.quizForm = (box, qs, two) => {
    box.innerHTML = qs.map((q, i) => {
      const n = `<span class="qn">${i + 1}</span>`;
      if (q.k === 'gap') return `<div class="fq" data-i="${i}">${n}<div class="fqt en" dir="ltr">${esc(q.q).replace(/_{3,}/, textInput(''))}</div><div class="fqw"></div></div>`;
      const o = q.k === 'tfng' ? (two ? ['True', 'False'] : ['True', 'False', 'Not Given']) : q.o;
      const t = q.k === 'head' ? `أفضل عنوان للفقرة ${q.para + 1}` : q.q;
      return `<div class="fq" data-i="${i}">${n}<div class="fqt"><span ${dir(t)}>${blank(t)}</span></div><div class="fqo">${o.map((x, j) => `<button class="opt sm" data-j="${j}"><span ${dir(x)}>${esc(x)}</span></button>`).join('')}</div><div class="fqw"></div></div>`;
    }).join('');
    if (F.debug) qs.forEach((q, i) => { box.querySelector(`.fq[data-i="${i}"]`).dataset.ans = q.k === 'gap' ? 'in:' + q.a[0] : 'mc:' + (q.k === 'tfng' ? ['T', 'F', 'NG'].indexOf(q.a) : q.a); });
    box.onclick = e => { const b = e.target.closest('.opt'); if (!b || box.dataset.done) return; F.$$('.opt', b.parentNode).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); };
    return () => {
      box.dataset.done = 1; let ok = 0;
      qs.forEach((q, i) => {
        const el = box.querySelector(`.fq[data-i="${i}"]`); let good = false, ans = '';
        if (q.k === 'gap') { const inp = el.querySelector('.inp'); good = q.a.some(a => norm(a) === norm(inp.value)); inp.disabled = true; inp.classList.add(good ? 'right' : 'wrong'); ans = q.a[0]; }
        else {
          const a = q.k === 'tfng' ? ['T', 'F', 'NG'].indexOf(q.a) : q.a, sel = el.querySelector('.opt.sel');
          good = !!sel && +sel.dataset.j === a;
          if (sel && !good) sel.classList.add('wrong');
          const r = el.querySelector(`.opt[data-j="${a}"]`); if (r) r.classList.add('right');
        }
        if (good) ok++;
        el.classList.add(good ? 'ok' : 'no');
        el.querySelector('.fqw').innerHTML = (good ? '' : (ans ? `<div class="fba">الجواب: <span dir="ltr" class="en">${esc(ans)}</span></div>` : '')) + (q.why ? `<div class="fbw">${esc(q.why)}</div>` : '');
      });
      return { ok, n: qs.length };
    };
  };

  /* ---------- vocabulary ---------- */
  const POS = F.POS;
  const hl = (ex, x) => { const i = ex.toLowerCase().indexOf(String(x || '').toLowerCase()); return i < 0 ? esc(ex) : esc(ex.slice(0, i)) + '<b>' + esc(ex.slice(i, i + x.length)) + '</b>' + esc(ex.slice(i + x.length)); };
  const clozeText = v => { const x = v.x || v.w, i = v.ex.toLowerCase().indexOf(x.toLowerCase()); return i < 0 ? null : v.ex.slice(0, i) + '_____' + v.ex.slice(i + x.length); };
  F.distract = (v, n, key) => {
    const pool = (F.DB.pos[v.p] || []).length > 12 ? F.DB.pos[v.p] : F.DB.vocab, out = [], seen = new Set([norm(v[key]) || v[key]]), li = F.LV[v.l] || 0;
    let guard = 0;
    while (out.length < n && guard++ < 300) {
      const c = pool[rnd(pool.length)];
      if (!c || c.id === v.id || !c[key]) continue;
      if (guard < 150 && Math.abs((F.LV[c.l] || 0) - li) > 1) continue;
      if (key === 'w' && / /.test(c.w) !== / /.test(v.w) && guard < 200) continue;
      const k = norm(c[key]) || c[key]; if (seen.has(k)) continue;
      if (key === 'w' && c.ar === v.ar) continue;
      seen.add(k); out.push(c);
    }
    return out;
  };
  F.vcard = (v, o) => {
    o = o || {};
    const note = F.S.notes[v.id] || '';
    return `<div class="vcard">
      <div class="vmeta"><span class="tag l${v.l}">${v.l}</span><span class="tag">${POS[v.p] || ''}</span>${v.tr === 'd' ? '<span class="tag dom">تخصصك</span>' : ''}${o.leech ? '<span class="tag leech">كلمة عنيدة</span>' : ''}</div>
      <div class="vword"><span dir="ltr" class="en">${esc(v.w)}</span>${spk(v.w)}</div>
      <div class="vmean">${esc(v.ar)}</div>
      ${v.d ? `<div class="vdef en" dir="ltr">${esc(v.d)}</div>` : ''}
      <div class="vex"><div class="en" dir="ltr">${hl(v.ex, v.x || v.w)} ${spk(v.ex, 'mini')}</div>${v.exar ? `<div class="vexar">${esc(v.exar)}</div>` : ''}</div>
      ${v.c && v.c.length ? `<div class="vchips en" dir="ltr">${v.c.map(c => `<span class="chipx">${esc(c)}</span>`).join('')}</div>` : ''}
      ${v.f && v.f.length ? `<div class="vfam">عائلة الكلمة: <span dir="ltr" class="en">${esc(v.f.join(' · '))}</span></div>` : ''}
      ${o.note === false ? (note ? `<div class="vnote">💡 ${esc(note)}</div>` : '') : `<textarea class="note" rows="2" placeholder="${o.leech ? 'هذه الكلمة تحتاج رابطاً ذهنياً: صورة تتخيلها، كلمة عربية تشبهها في النطق، أو جملة عن حياتك' : 'رابط ذهني (اختياري): صورة أو جملة من حياتك تذكّرك بها'}">${esc(note)}</textarea>`}
    </div>`;
  };
  const saveNote = (el, v) => { const t = el.querySelector('.note'); if (t) { const s = t.value.trim(); if (s) F.S.notes[v.id] = s; else delete F.S.notes[v.id]; F.save(); } };
  /* teach card. o: {again} -> result {known:true} when the learner says he already knows it well */
  Ex.teach = (el, v, done, o) => {
    o = o || {};
    const c = F.S.cards[v.id];
    el.innerHTML = `${o.again ? '<div class="hint">لنثبّتها مرة أخرى 👇 اقرأها بصوت مسموع</div>' : '<div class="hint">كلمة جديدة: استمع، انطقها بصوت مسموع، ثم تخيّل الجملة</div>'}${F.vcard(v, { leech: c && F.SRS.isLeech(c) })}
      <div class="row">${o.again ? '' : '<button class="btn ghost" data-k="known">أعرفها جيداً</button>'}<button class="btn" data-k="next">${o.again ? 'تذكّرتها' : 'فهمتها، التالي'}</button></div>`;
    if (F.S.set.auto) F.tts.speak([{ t: v.w, pause: 350 }, { t: v.ex, rate: 0.92 }]);
    F.$$('.row .btn', el).forEach(b => b.onclick = () => { saveNote(el, v); F.tts.stop(); done({ known: b.dataset.k === 'known' }); });
  };
  Ex.pretest = (el, v, done) => {
    const ds = F.distract(v, 3, 'ar'), o = shuffle([v, ...ds]);
    Ex.mc(el, { q: v.w, say: v.w, o: o.map(x => x.ar), a: o.indexOf(v), keep: true, quick: true, pre: '<div class="hint">هل تعرف معنى هذه الكلمة؟ (اختبار قبلي: لا بأس بالخطأ)</div>', post: '<button class="btn ghost dk">لا أعرفها بعد</button>' }, r => done({ known: r.ok && !r.dk }));
    if (F.S.set.auto) F.say(v.w);
  };
  /* one review question in the given format -> done({g, prod, ok}) */
  Ex.vocab = (el, v, fmt, done) => {
    const multi = / /.test(v.w) || /-/.test(v.w), cz = clozeText(v);
    if ((fmt === 'listen' || fmt === 'dict') && (!F.tts.ok() || F.ttsMissing)) fmt = fmt === 'dict' ? 'type' : 'ea';
    if (fmt === 'cloze' && !cz) fmt = 'ae';
    if (fmt === 'build' && (multi || v.w.length > 13 || v.w.length < 3)) fmt = multi ? 'tiles' : 'type';
    if (fmt === 'dict' && multi) fmt = 'type';
    const hintLine = v.d && !v.exar ? `<div class="sub en" dir="ltr">${esc(v.d)}</div>` : '';
    const after = (ok, g, prod) => done({ ok, g, prod: !!prod });
    if (fmt === 'ea' || fmt === 'listen') {
      const o = shuffle([v, ...F.distract(v, 3, 'ar')]);
      const say = () => F.say(v.w);
      Ex.mc(el, fmt === 'listen'
        ? { q: '🎧', o: o.map(x => x.ar), a: o.indexOf(v), keep: true, quick: true, pre: '<div class="hint">استمع ثم اختر المعنى</div>', sub: `<button class="btn ghost replay">🔊 أعد الاستماع</button>`, note: v.w }
        : { q: v.w, say: v.w, o: o.map(x => x.ar), a: o.indexOf(v), keep: true, quick: true, pre: '<div class="hint">ما معنى الكلمة؟</div>' }, r => after(r.ok, r.ok ? 3 : 1));
      const rp = el.querySelector('.replay'); if (rp) rp.onclick = say;
      if (fmt === 'listen' || F.S.set.auto) say();
    } else if (fmt === 'ae') {
      const o = shuffle([v, ...F.distract(v, 3, 'w')]);
      Ex.mc(el, { q: v.ar, o: o.map(x => x.w), a: o.indexOf(v), keep: true, quick: true, pre: '<div class="hint">اختر الكلمة الإنجليزية المناسبة</div>', sub: hintLine }, r => { if (r.ok) F.say(v.w); after(r.ok, r.ok ? 3 : 1); });
    } else if (fmt === 'cloze') {
      const o = shuffle([v, ...F.distract(v, 3, 'w')]);
      Ex.mc(el, { q: cz, o: o.map(x => x === v ? (v.x || v.w) : x.w), a: o.indexOf(v), keep: true, quick: true, pre: '<div class="hint">أكمل الجملة</div>', sub: v.exar ? `<div class="sub">${esc(v.exar)}</div>` : hintLine }, r => { if (r.ok) F.say(v.ex); after(r.ok, r.ok ? 3 : 1); });
    } else if (fmt === 'build' || fmt === 'tiles') {
      const target = v.w, parts = fmt === 'tiles' ? target.split(/\s+/) : target.split('');
      let extra = [];
      if (fmt === 'tiles') { const pool = F.DB.pos.phr || []; let g = 0; while (extra.length < 2 && g++ < 40) { const w = pick(pick(pool).w.split(/\s+/)); if (!parts.includes(w) && !extra.includes(w)) extra.push(w); } }
      let pool = shuffle([...parts, ...extra].map((w, i) => ({ w, i })));
      if (!extra.length && pool.map(p => p.w).join('') === target) pool = pool.reverse();
      const ans = []; let tries = 0, fin = false;
      el.innerHTML = `<div class="q"><div class="hint">${fmt === 'tiles' ? 'كوّن العبارة الإنجليزية' : 'كوّن الكلمة الإنجليزية من الحروف'}</div><div class="qt"><span class="ar">${esc(v.ar)}</span></div>${hintLine}</div><div class="line en ${fmt}" dir="ltr"></div><div class="pool en ${fmt}" dir="ltr"></div><div class="row"><button class="btn ghost rev">أظهر الجواب</button></div>`;
      const line = el.querySelector('.line'), pl = el.querySelector('.pool');
      if (F.debug) el.dataset.ans = 'ord:' + JSON.stringify(parts);
      const draw = () => {
        line.innerHTML = ans.map((p, k) => `<button class="chip on" data-k="${k}">${esc(p.w)}</button>`).join('') || '<span class="ph">…</span>';
        pl.innerHTML = pool.map((p, k) => `<button class="chip" data-k="${k}">${esc(p.w)}</button>`).join('');
      };
      const finish = ok => { fin = true; F.say(v.w); F.feedback(el, ok, '', () => after(ok, ok ? (tries ? 2 : 3) : 1, true), { ans: ok ? '' : target, quick: true }); };
      const check = () => {
        if (ans.length < parts.length) return;
        const got = ans.map(p => p.w).join(fmt === 'tiles' ? ' ' : '');
        if (norm(got) === norm(target)) return finish(true);
        tries++; line.classList.add('shake'); F.beep('bad');
        if (tries >= 2) return finish(false);
        fin = true; setTimeout(() => { line.classList.remove('shake'); pool = shuffle(pool.concat(ans.splice(0))); fin = false; draw(); }, 550);
      };
      pl.onclick = e => { const b = e.target.closest('.chip'); if (!b || fin || ans.length >= parts.length) return; ans.push(pool.splice(+b.dataset.k, 1)[0]); F.beep('tap'); draw(); check(); };
      line.onclick = e => { const b = e.target.closest('.chip'); if (!b || fin) return; pool.push(ans.splice(+b.dataset.k, 1)[0]); draw(); };
      el.querySelector('.rev').onclick = () => { if (!fin) finish(false); };
      draw();
    } else { // type, dict
      const t0 = now(); let hinted = false;
      const accept = [v.w, v.x || v.w].map(norm);
      el.innerHTML = fmt === 'dict'
        ? `<div class="q"><div class="hint">اكتب الكلمة التي تسمعها</div><div class="qt">🎧 <button class="btn ghost replay">🔊 أعد الاستماع</button></div></div>${textInput('…')}<button class="btn chk">تحقق</button>`
        : `<div class="q"><div class="hint">اكتب الكلمة الإنجليزية</div><div class="qt"><span class="ar">${esc(v.ar)}</span></div>${cz ? `<div class="sub en" dir="ltr">${blank(cz)}</div>` : hintLine}</div>${textInput('…')}<div class="row"><button class="btn ghost hintb">تلميح</button><button class="btn chk">تحقق</button></div>`;
      if (F.debug) el.dataset.ans = 'in:' + v.w;
      const rp = el.querySelector('.replay'); if (rp) { rp.onclick = () => F.say(v.w); F.say(v.w); }
      const hb = el.querySelector('.hintb'); if (hb) hb.onclick = () => { hinted = true; const inp = el.querySelector('.inp'); inp.placeholder = v.w.slice(0, Math.max(1, Math.ceil(v.w.length / 3))) + '…'; hb.disabled = true; inp.focus(); };
      bindInput(el, (val, inp) => {
        const n = norm(val), exact = accept.includes(n), near = !exact && v.w.length >= 6 && accept.some(a => lev(a, n) <= 1);
        const ok = exact || near;
        inp.classList.add(ok ? 'right' : 'wrong');
        if (ok) F.say(fmt === 'dict' ? v.w : (v.ex || v.w));
        const fast = now() - t0 < 7000;
        F.feedback(el, ok, fmt === 'dict' ? v.ar : '', () => after(ok, !ok ? 1 : (near || hinted) ? 2 : (fast && fmt === 'type' ? 4 : 3), true), { ans: v.w, quick: exact, note: near ? 'قريب جداً، انتبه للإملاء: ' + v.w : '' });
      });
    }
  };
  F.pickFormat = (v, c) => {
    const s = c.s, multi = / /.test(v.w);
    if (c.pre) return multi ? 'cloze' : 'build';
    if (s < 2.5) return rnd(2) ? 'ea' : 'ae';
    if (s < 9) return pick(['ae', 'cloze', 'build', 'build']);
    if (s < 30) return pick(['build', 'type', 'listen', 'cloze', 'type']);
    return pick(['type', 'dict', 'type', 'listen']);
  };

  /* compare what was said with the target sentence: returns {score, html} */
  F.matchSpeech = (target, heardList) => {
    const tw = norm(target).split(' ').filter(Boolean); let best = { score: -1, hit: [] };
    (heardList || []).forEach(h => { const hw = norm(h).split(' '); const hit = tw.map(w => hw.includes(w) || hw.some(x => x.length > 3 && lev(x, w) <= 1)); const sc = hit.filter(Boolean).length / Math.max(1, tw.length); if (sc > best.score) best = { score: sc, hit }; });
    const raw = target.split(/\s+/); let k = 0;
    const html = raw.map(r => { const n = norm(r); if (!n) return esc(r); const good = best.hit[k++]; return `<span class="${good ? 'sok' : 'sno'}">${esc(r)}</span>`; }).join(' ');
    return { score: Math.max(0, best.score), html };
  };
})(window.Fasih);

'use strict';
/* Fasih flows: the session runner and one flow per kind of task */
(function (F) {
  const { $, $$, esc, now, dayNum, rnd, shuffle, sample, norm, spk } = F;
  const Ex = F.Ex, SRS = F.SRS;
  const flows = F.flows = {};

  /* ---------- runner ---------- */
  class Runner {
    constructor(o) { this.o = o || {}; this.q = []; this.i = -1; this.active = 0; this.tStep = now(); this.ok = 0; this.n = 0; this.closed = false; this.tail = null; }
    add(s) { this.q.push(s); return this; }
    insert(off, s) { this.q.splice(Math.min(this.q.length, this.i + 1 + off), 0, s); }
    open() {
      const d = this.el = document.createElement('div'); d.className = 'run';
      d.innerHTML = `<header class="rh"><button class="rx" aria-label="إغلاق">✕</button><div class="pb"><i></i></div><span class="rt">${esc(this.o.title || '')}</span></header><main class="stage"></main>`;
      document.body.appendChild(d); document.body.classList.add('running');
      d.querySelector('.rx').onclick = () => this.askClose();
      F.runner = this; F.nat('keepAwake', true);
      this.next();
    }
    next() {
      if (this.closed) return;
      this.active += Math.min(now() - this.tStep, 120000); this.tStep = now();
      this.i++;
      let st = this.q[this.i];
      if (!st) { if (this.tail && !this.tailDone) { this.tailDone = true; st = this.tail; } else return this.close(true); }
      this.el.querySelector('.pb i').style.width = Math.round(100 * Math.min(this.i, this.q.length) / Math.max(1, this.q.length)) + '%';
      const stage = this.el.querySelector('.stage'); stage.innerHTML = ''; stage.scrollTop = 0;
      const box = document.createElement('div'); box.className = 'step'; stage.appendChild(box);
      let fin = false;
      try { st(box, r => { if (fin || this.closed) return; fin = true; if (r && r.ok != null) { this.n++; if (r.ok) this.ok++; } this.next(); }, this); }
      catch (e) { console.error(e); box.innerHTML = '<div class="hint">تعذّر عرض هذا التمرين، ننتقل للتالي.</div>'; setTimeout(() => { if (!fin) { fin = true; this.next(); } }, 900); }
    }
    askClose() { F.confirm('الخروج من الجلسة؟ ما أنجزته محفوظ.', () => this.close(false), 'خروج', 'أكمل'); }
    close(fin) {
      if (this.closed) return; this.closed = true;
      this.active += Math.min(now() - this.tStep, 120000);
      F.tts.stop(); F.stt.cancel(); F.nat('recStopPlay'); F.nat('keepAwake', false);
      F.addMinutes(this.active / 60000);
      this.el.remove(); document.body.classList.remove('running'); F.runner = null;
      if (this.o.onClose) this.o.onClose(fin, this);
    }
  }
  F.Runner = Runner;
  F.summary = o => (el, done) => {
    F.beep('win');
    el.innerHTML = `<div class="sum"><div class="sumic">${o.ic || '🎉'}</div><h2>${esc(o.title)}</h2>${(o.lines || []).filter(Boolean).map(l => `<div class="suml">${l}</div>`).join('')}${o.extra || ''}<button class="btn big">متابعة</button></div>`;
    el.querySelector('.btn.big').onclick = () => done();
  };
  const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  F.md = md;
  F.words = t => String(t).split(/([A-Za-z][A-Za-z'’-]*)/).map((p, i) => i % 2 ? `<span class="w">${esc(p)}</span>` : esc(p)).join('');
  const timer = (el, secs, onEnd) => { // countdown; returns stop()
    let left = secs; const draw = () => { el.textContent = F.pad(Math.floor(left / 60)) + ':' + F.pad(left % 60); };
    draw(); const h = setInterval(() => { if (!document.body.contains(el)) return clearInterval(h); left--; draw(); if (left <= 0) { clearInterval(h); if (onEnd) onEnd(); } }, 1000);
    return () => clearInterval(h);
  };
  const stopwatch = el => { const t0 = now(); const h = setInterval(() => { if (!document.body.contains(el)) return clearInterval(h); const s = Math.floor((now() - t0) / 1000); el.textContent = F.pad(Math.floor(s / 60)) + ':' + F.pad(s % 60); }, 1000); return () => Math.floor((now() - t0) / 1000); };

  /* ---------- vocabulary: reviews ---------- */
  flows.review = (task, end) => {
    const S = F.S, cap = S.day && S.day.light ? 30 : F.revCap(), list = SRS.dueList().slice(0, task.all ? 400 : cap);
    if (!list.length) { F.toast('لا مراجعات مستحقة الآن 👌'); return end(true, {}); }
    let right = 0, total = 0, fails = 0;
    const R = new Runner({ title: 'المراجعة', onClose: fin => end(fin || SRS.dueCount() === 0, { n: total }) });
    const mk = (it, re) => (el, done) => {
      const v = F.DB.byId[it.id], c = S.cards[it.id];
      if (!v || !c) return done();
      Ex.vocab(el, v, re ? (rnd(2) ? 'ea' : 'ae') : F.pickFormat(v, c), r => {
        if (!re) { total++; if (r.g > 1) right++; else fails++; SRS.answer(it.id, r.g, r.prod); F.addXP(r.g > 1 ? 2 : 1); const h = F.hist(); h.rev++; if (r.g > 1) h.ok++; }
        if (r.g === 1 && (re || 0) < 2) { R.insert(3, (e2, d2) => Ex.teach(e2, v, () => d2(), { again: true })); R.insert(7, mk(it, (re || 0) + 1)); }
        done({ ok: r.g > 1 });
      });
    };
    list.forEach(it => R.add(mk(it)));
    R.tail = (el, done) => F.summary({ ic: '🔁', title: 'انتهت المراجعة', lines: [`راجعت <b>${total}</b> بطاقة`, `تذكّرت <b>${pct(right, total)}%</b> منها`, fails ? `الكلمات التي نسيتها (${fails}) ستعود غداً، وهذا طبيعي ومفيد للحفظ` : 'لم تنسَ أي كلمة 👏', SRS.dueCount() ? `بقي ${SRS.dueCount()} بطاقة لمن أراد المزيد` : ''] })(el, done);
    R.open();
  };
  /* ---------- vocabulary: new words (pretest -> teach -> three spaced recalls) ---------- */
  flows.learn = (task, end) => {
    const S = F.S, need = Math.max(0, task.n - (task.got || 0));
    if (need <= 0) return end(true, {});
    const gen = SRS.newQueue(), cap = need * 3 + 6, skip = new Set(), passed = {}, missed = {};
    let taught = 0, known = 0, checked = 0, out = false;
    const R = new Runner({ title: 'كلمات جديدة', onClose: fin => { SRS.clearQueued(); end(taught >= need || (fin && (out || checked >= cap)), { taught }); } });
    const addPre = off => { if (taught >= need || checked >= cap) return; const nx = gen.next(); if (nx.done) { out = true; return; } R.insert(off, pre(nx.value)); };
    const recall = (v, fmt) => (el, done) => {
      if (skip.has(v.id) || !S.cards[v.id]) return done();
      Ex.vocab(el, v, fmt, r => {
        if (r.ok) { passed[v.id] = (passed[v.id] || 0) + 1; if (passed[v.id] === 3) { SRS.graduate(v.id); F.addXP(5); } }
        else if ((missed[v.id + fmt] = (missed[v.id + fmt] || 0) + 1) <= 3) { R.insert(1, (e2, d2) => Ex.teach(e2, v, () => d2(), { again: true })); R.insert(4, recall(v, fmt)); }
        done({ ok: r.ok });
      });
    };
    const teach = (v, off) => {
      taught++; F.hist().new++; SRS.create(v.id, 1);
      R.insert(off, (el, done) => Ex.teach(el, v, r => { if (r.known) { skip.add(v.id); SRS.create(v.id, 4); taught--; F.hist().new--; known++; addPre(0); } done(); }));
      R.insert(off + 3, recall(v, 'ea')); R.insert(off + 7, recall(v, 'ae')); R.insert(off + 12, recall(v, 'build'));
    };
    const pre = v => (el, done) => Ex.pretest(el, v, r => {
      checked++;
      if (r.known) {
        known++; SRS.create(v.id, 3); F.addXP(1);
        R.insert(5, (e2, d2) => { if (!S.cards[v.id]) return d2(); Ex.vocab(e2, v, 'ae', rr => { if (!rr.ok) { delete S.cards[v.id]; known--; teach(v, 0); } d2({ ok: rr.ok }); }); });
        addPre(0);
      } else { teach(v, 0); addPre(1); }
      done();
    });
    addPre(0);
    if (out && !R.q.length) { F.toast('أنهيت كل الكلمات المتاحة 🎓'); return end(true, {}); }
    R.tail = (el, done) => F.summary({ ic: '🌱', title: 'كلمات اليوم', lines: [`تعلّمت <b>${taught}</b> كلمة جديدة`, known ? `وتبيّن أنك تعرف <b>${known}</b> كلمة مسبقاً` : '', 'ستراها غداً في المراجعة. الأفضل أن تمرّ عليها مرة قبل النوم 🌙'] })(el, done);
    R.open();
  };
  flows.recap = (task, end) => {
    const S = F.S, today = dayNum(), ids = Object.keys(S.cards).filter(id => S.cards[id].born === today && S.cards[id].s < 3 && F.DB.byId[id]);
    if (!ids.length) { F.toast('لا كلمات جديدة اليوم لتثبيتها'); return end(false, {}); }
    let ok = 0;
    const R = new Runner({ title: 'قبل النوم', onClose: fin => end(fin, {}) });
    shuffle(ids).forEach(id => R.add((el, done) => Ex.vocab(el, F.DB.byId[id], rnd(2) ? 'ae' : 'ea', r => { if (r.ok) { ok++; F.addXP(1); } else R.insert(3, (e2, d2) => Ex.teach(e2, F.DB.byId[id], () => d2(), { again: true })); done({ ok: r.ok }); })));
    R.tail = (el, done) => F.summary({ ic: '🌙', title: 'تثبيت ما قبل النوم', lines: [`تذكّرت <b>${ok}</b> من ${ids.length}`, 'النوم بعد المراجعة يساعد الذاكرة على تثبيت ما تعلّمته. إلى الغد!'] })(el, done);
    R.open();
  };

  /* ---------- grammar ---------- */
  F.grammarLesson = u => `<div class="lesson"><div class="vmeta"><span class="tag l${u.l}">${u.l}</span></div><h2 class="en" dir="ltr">${esc(u.title)}</h2><div class="lar">${esc(u.titleAr)}</div><p class="why">${esc(u.why)}</p>
    ${u.rules.map(r => `<div class="rule"><div class="rar">${esc(r.ar)}</div>${r.form ? `<div class="form en" dir="ltr">${esc(r.form)}</div>` : ''}${(r.ex || []).map(e => `<div class="rex"><div class="en" dir="ltr">${esc(e.en)} ${spk(e.en, 'mini')}</div><div class="rexar">${esc(e.ar)}</div></div>`).join('')}</div>`).join('')}
    <h3>أخطاء شائعة عند العرب</h3>${u.mistakes.map(m => `<div class="mis"><div class="bad en" dir="ltr">✗ ${esc(m.x)}</div><div class="good en" dir="ltr">✓ ${esc(m.ok)}</div><div class="mar">${esc(m.ar)}</div></div>`).join('')}
    ${u.tip ? `<div class="tipbox">💡 ${esc(u.tip)}</div>` : ''}</div>`;
  flows.grammar = (task, end) => {
    const S = F.S, u = F.DB.byId[task.ref]; let ok = 0, n = 0, score = 0; const wrong = [];
    const R = new Runner({ title: 'قواعد · ' + u.l, onClose: fin => end(fin, { score }) });
    R.add((el, done) => { el.innerHTML = F.grammarLesson(u) + '<button class="btn big">ابدأ التمارين</button>'; el.querySelector('.btn.big').onclick = () => done(); });
    const mk = (e, re) => (el, done) => Ex.run(el, e, r => { if (!re) { n++; if (r.ok) { ok++; F.addXP(1); } else wrong.push(e); } done(r); });
    u.exs.forEach(e => R.add(mk(e)));
    R.add((el, done) => { wrong.splice(0).forEach((e, k) => R.insert(k, mk(e, true))); done(); });
    R.tail = (el, done) => {
      score = n ? ok / n : 0;
      const prev = S.gram[u.id];
      S.gram[u.id] = { day: dayNum(), score: +score.toFixed(2), stage: prev ? prev.stage : 0, due: dayNum() + (score >= 0.7 ? 3 : 1) };
      F.addXP(20); F.save();
      F.summary({ ic: '🧩', title: u.titleAr, lines: [`النتيجة: <b>${ok} / ${n}</b>`, score >= 0.7 ? 'أحسنت! ستعود هذه القاعدة في مراجعات متباعدة لتثبت.' : 'لا بأس، ستعود هذه القاعدة غداً في مراجعة قصيرة. التكرار المتباعد هو ما يثبّتها.'] })(el, done);
    };
    R.open();
  };
  flows.grev = (task, end) => {
    const S = F.S, ids = F.gramDue().sort((a, b) => S.gram[a].due - S.gram[b].due).slice(0, 3);
    if (!ids.length) { F.toast('لا قواعد مستحقة للمراجعة'); return end(true, {}); }
    const res = {}; let items = [];
    ids.forEach(id => { res[id] = { ok: 0, n: 0 }; sample(F.DB.byId[id].exs, 4).forEach(e => items.push({ id, e })); });
    items = shuffle(items);
    const R = new Runner({ title: 'مراجعة القواعد', onClose: fin => end(fin, {}) });
    items.forEach(it => R.add((el, done) => { const u = F.DB.byId[it.id]; Ex.run(el, Object.assign({}, it.e, { pre: `<div class="hint">${esc(u.titleAr)}</div>` }), r => { res[it.id].n++; if (r.ok) { res[it.id].ok++; F.addXP(1); } done(r); }); }));
    R.tail = (el, done) => {
      const gaps = [3, 7, 16, 35, 75, 150];
      ids.forEach(id => { const g = S.gram[id], r = res[id]; if (r.ok / Math.max(1, r.n) >= 0.75) { g.stage = Math.min(5, (g.stage || 0) + 1); g.due = dayNum() + gaps[g.stage]; } else g.due = dayNum() + 2; });
      F.save();
      F.summary({ ic: '♻️', title: 'مراجعة القواعد', lines: ids.map(id => `${esc(F.DB.byId[id].titleAr)}: <b>${res[id].ok}/${res[id].n}</b>`) })(el, done);
    };
    R.open();
  };

  /* ---------- reading ---------- */
  flows.reading = (task, end) => {
    const o = F.DB.byId[task.ref]; let res = null; const t0 = now(), wc = o.paras.join(' ').split(/\s+/).length;
    const R = new Runner({ title: 'قراءة · ' + o.l, onClose: fin => end(fin, res || {}) });
    R.add((el, done) => {
      el.innerHTML = `<div class="read"><h2 class="en" dir="ltr">${esc(o.title)}</h2><div class="hint">اقرأ النص أولاً دون ترجمة، ثم اضغط على أي كلمة لمعرفة معناها. الأسئلة أسفل النص.</div>
        <div class="passage lk en" dir="ltr">${o.paras.map((p, i) => `<p><span class="pn">${i + 1}</span>${F.words(p)}</p>`).join('')}</div>
        <details class="gl"><summary>كلمات مساعدة</summary>${o.gloss.map(g => `<div><b dir="ltr" class="en">${esc(g.w)}</b> : ${esc(g.ar)}</div>`).join('')}</details>
        <h3>الأسئلة</h3><div class="qform"></div><button class="btn big chk">تحقق من إجاباتي</button><div class="after"></div></div>`;
      const check = F.quizForm(el.querySelector('.qform'), o.qs);
      el.querySelector('.chk').onclick = function () {
        const r = check(), sec = Math.round((now() - t0) / 1000); this.remove();
        res = { score: +(r.ok / r.n).toFixed(2), ok: r.ok, n: r.n, sec };
        F.markDone('reading', o.id, res); F.addXP(10 + r.ok * 2); F.beep(r.ok >= r.n * 0.6 ? 'win' : 'ok');
        el.querySelector('.after').innerHTML = `<div class="scorebox">${r.ok} / ${r.n}</div><div class="hint">الوقت: ${Math.round(sec / 60)} دقيقة · طول النص ${wc} كلمة</div><div class="sumar"><b>ملخص النص:</b> ${esc(o.sumAr)}</div><button class="btn big nx">متابعة</button>`;
        el.querySelector('.nx').onclick = () => done({ ok: r.ok >= r.n * 0.6 });
        el.querySelector('.qform').scrollIntoView({ behavior: 'smooth' });
      };
    });
    R.open();
  };
  /* ---------- listening ---------- */
  const ACC = { GB: 'en-GB', US: 'en-US', AU: 'en-AU' };
  flows.listening = (task, end) => {
    const o = F.DB.byId[task.ref]; let res = null, plays = 0, speed = { A2: 0.85, B1: 0.92, B2: 1, C1: 1 }[o.l] || 1;
    const R = new Runner({ title: 'استماع · ' + o.l, onClose: fin => end(fin, res || {}) });
    R.add((el, done) => {
      const items = () => o.lines.map((ln, i) => ({ t: ln.t, lang: ACC[o.accent] || 'en-GB', rate: speed, pitch: { A: 1, B: 0.8, C: 1.25 }[ln.s] || 1, pause: (o.lines[i + 1] && o.lines[i + 1].s !== ln.s) ? 450 : 220 }));
      el.innerHTML = `<div class="listen"><h2 class="en" dir="ltr">${esc(o.title)}</h2><div class="hint">اقرأ الأسئلة أولاً، ثم شغّل التسجيل وأجب أثناء الاستماع كما في IELTS. ${o.l === 'A2' ? 'يمكنك إعادة الاستماع.' : 'حاول أن تكتفي بمرة أو مرتين.'}</div>
        <div class="player"><button class="btn play">▶ تشغيل</button><button class="btn ghost slow">🐢 أبطأ</button><span class="pstat"></span></div>
        <div class="qform"></div><button class="btn big chk">تحقق من إجاباتي</button><div class="after"></div></div>`;
      const pb = el.querySelector('.play'), ps = el.querySelector('.pstat');
      let playing = false;
      const stop = () => { F.tts.stop(); playing = false; pb.textContent = '▶ ' + (plays ? 'أعد التشغيل' : 'تشغيل'); };
      pb.onclick = () => {
        if (playing) return stop();
        if (!F.tts.ok()) return F.toast('محرك النطق غير متاح على هذا الجهاز');
        playing = true; plays++; pb.textContent = '⏹ إيقاف';
        F.tts.speak(items(), () => { playing = false; pb.textContent = '▶ أعد التشغيل'; ps.textContent = 'انتهى التسجيل'; }, i => { ps.textContent = `${i + 1} / ${o.lines.length}`; });
      };
      el.querySelector('.slow').onclick = function () { speed = speed > 0.8 ? 0.75 : ({ A2: 0.85, B1: 0.92, B2: 1, C1: 1 }[o.l] || 1); this.textContent = speed <= 0.75 ? '🐇 السرعة العادية' : '🐢 أبطأ'; if (playing) stop(); };
      const check = F.quizForm(el.querySelector('.qform'), o.qs, true);
      el.querySelector('.chk').onclick = function () {
        stop(); const r = check(); this.remove();
        res = { score: +(r.ok / r.n).toFixed(2), ok: r.ok, n: r.n, plays };
        F.markDone('listening', o.id, res); F.addXP(10 + r.ok * 2); F.beep(r.ok >= r.n * 0.6 ? 'win' : 'ok');
        el.querySelector('.after').innerHTML = `<div class="scorebox">${r.ok} / ${r.n}</div><h3>النص المكتوب</h3><div class="hint">استمع مرة أخرى وأنت تقرأ، واضغط على أي كلمة لمعرفة معناها.</div>
          <div class="script lk en" dir="ltr">${o.lines.map(ln => `<p><b>${ln.s}</b> ${F.words(ln.t)} ${spk(ln.t, 'mini')}</p>`).join('')}</div>
          ${o.gloss && o.gloss.length ? `<div class="gl open">${o.gloss.map(g => `<div><b dir="ltr" class="en">${esc(g.w)}</b> : ${esc(g.ar)}</div>`).join('')}</div>` : ''}<button class="btn big nx">متابعة</button>`;
        el.querySelector('.nx').onclick = () => done({ ok: r.ok >= r.n * 0.6 });
      };
    });
    R.open();
  };

  /* ---------- speaking ---------- */
  /* a "say it" box: speech recognition when the phone has it, otherwise record and play back, otherwise self-check */
  const sayBox = (box, target, onScore) => {
    const stt = F.stt.ok(), rec = F.rec.ok();
    box.innerHTML = (stt ? `<button class="btn mic">🎙 انطقها الآن</button>` : rec ? `<button class="btn mic">🎙 سجّل صوتك</button>` : '<div class="hint">ردِّد الجملة بصوت مسموع ثلاث مرات، ثم قيّم نفسك.</div>') + '<div class="sres"></div>';
    const b = box.querySelector('.mic'), out = box.querySelector('.sres'); if (!b) return;
    let on = false;
    if (stt) b.onclick = () => {
      if (on) { F.stt.stop(); return; }
      on = true; b.textContent = '⏺ أستمع إليك…'; b.classList.add('rec'); out.textContent = '';
      const fin = () => { on = false; b.textContent = '🎙 حاول مرة أخرى'; b.classList.remove('rec'); };
      F.stt.start({
        partial: t => { out.innerHTML = `<span class="en" dir="ltr">${esc(t)}</span>`; },
        result: (t, alts) => { fin(); const m = F.matchSpeech(target, alts && alts.length ? alts : [t]); out.innerHTML = `<div class="en" dir="ltr">${m.html}</div><div class="hint">${m.score >= 0.85 ? 'نطق واضح 👏' : m.score >= 0.6 ? 'جيد، أعد الكلمات الحمراء' : 'استمع مرة أخرى ثم أعد المحاولة'} (${Math.round(m.score * 100)}%)</div>`; F.beep(m.score >= 0.6 ? 'ok' : 'bad'); if (onScore) onScore(m.score); },
        error: c => { fin(); out.innerHTML = `<div class="hint">${c === 'denied' ? 'اسمح للتطبيق باستعمال الميكروفون من إعدادات الهاتف.' : 'لم أسمع شيئاً واضحاً. حاول مجدداً، أو ردِّد الجملة وقيّم نفسك.'}</div>`; },
        end: () => { if (on) fin(); },
      });
    };
    else b.onclick = () => {
      if (on) { F.rec.stop(); return; }
      on = true; b.textContent = '⏹ أوقف التسجيل'; b.classList.add('rec');
      F.rec.start({
        stopped: () => { on = false; b.textContent = '🎙 سجّل مرة أخرى'; b.classList.remove('rec'); out.innerHTML = '<button class="btn ghost pl">▶ استمع إلى تسجيلك وقارنه بالأصل</button>'; out.querySelector('.pl').onclick = () => F.rec.play(); },
        denied: () => { on = false; b.classList.remove('rec'); b.textContent = '🎙 سجّل صوتك'; out.innerHTML = '<div class="hint">اسمح للتطبيق باستعمال الميكروفون من إعدادات الهاتف.</div>'; },
        error: () => { on = false; b.classList.remove('rec'); b.textContent = '🎙 سجّل صوتك'; },
      });
    };
  };
  const lineStep = (ln, hint) => (el, done) => {
    el.innerHTML = `<div class="shadow"><div class="hint">${hint}</div><div class="sline en" dir="ltr">${esc(ln.en)}</div>${ln.ar ? `<div class="sar">${esc(ln.ar)}</div>` : ''}
      <div class="row"><button class="btn ghost l1">🔊 استمع</button><button class="btn ghost l2">🐢 ببطء</button></div><div class="say"></div><button class="btn big nx">التالي</button></div>`;
    el.querySelector('.l1').onclick = () => F.say(ln.en); el.querySelector('.l2').onclick = () => F.say(ln.en, { rate: 0.7 });
    sayBox(el.querySelector('.say'), ln.en);
    el.querySelector('.nx').onclick = () => { F.addXP(2); done({ ok: true }); };
    if (F.S.set.auto) F.say(ln.en);
  };
  flows.shadow = (task, end) => {
    const o = F.DB.byId[task.ref];
    const R = new Runner({ title: 'ردِّد · ' + o.l, onClose: fin => { if (fin) F.markDone('shadow', o.id); end(fin, {}); } });
    R.add((el, done) => { el.innerHTML = `<div class="lesson"><h2 class="en" dir="ltr">${esc(o.title)}</h2><div class="lar">${esc(o.titleAr || '')}</div><p class="why">طريقة «الظل»: استمع إلى الجملة، ثم ردِّدها فوراً بصوت مسموع وبالإيقاع نفسه. الهدف هو الطلاقة والنطق، لا الحفظ.</p><button class="btn big">ابدأ</button></div>`; el.querySelector('.btn.big').onclick = () => done(); });
    o.lines.forEach(ln => R.add(lineStep(ln, 'استمع ثم ردِّد الجملة بصوتك')));
    R.tail = F.summary({ ic: '🗣️', title: 'أحسنت', lines: [`ردّدت <b>${o.lines.length}</b> جملة`, 'أعد هذا التمرين غداً لدقيقتين: التكرار القصير يصنع الطلاقة.'] });
    R.open();
  };
  flows.pron = (task, end) => {
    const o = F.DB.byId[task.ref], pairs = o.pairs.filter(p => p[1]);
    const R = new Runner({ title: 'نطق', onClose: fin => { if (fin) F.markDone('pron', o.id); end(fin, {}); } });
    R.add((el, done) => {
      el.innerHTML = `<div class="lesson"><h2 class="en" dir="ltr">${esc(o.title)}</h2><div class="lar">${esc(o.titleAr || '')}</div><p class="why">${md(o.ar)}</p><div class="pairs en" dir="ltr">${o.pairs.map(p => `<div class="pair">${p.filter(Boolean).map(w => `<button class="chip" data-say="${esc(w)}">🔊 ${esc(w)}</button>`).join('')}</div>`).join('')}</div><button class="btn big">تمرين الأذن</button></div>`;
      el.querySelector('.btn.big').onclick = () => done();
    });
    if (pairs.length >= 3 && F.tts.ok()) sample(pairs, Math.min(6, pairs.length)).forEach(p => R.add((el, done) => {
      const k = rnd(2), o2 = [p[0], p[1]];
      Ex.mc(el, { q: '🎧', o: o2, a: k, keep: true, quick: true, pre: '<div class="hint">أي الكلمتين سمعت؟</div>', sub: '<button class="btn ghost replay">🔊 أعد الاستماع</button>' }, r => { if (r.ok) F.addXP(1); done(r); });
      el.querySelector('.replay').onclick = () => F.say(o2[k]); F.say(o2[k]);
    }));
    o.sent.forEach(s => R.add(lineStep({ en: s }, 'اقرأ الجملة بصوت مسموع مع التركيز على الصوت الجديد')));
    R.tail = F.summary({ ic: '👄', title: 'تمرين النطق', lines: ['الأذن أولاً ثم اللسان: كلما ميّزت الصوت بوضوح سهل عليك نطقه.'] });
    R.open();
  };
  const recBtn = (box, secs) => {
    box.innerHTML = F.rec.ok() ? `<button class="btn mic">🎙 سجّل إجابتي</button><span class="tm"></span><div class="sres"></div>` : `<div class="hint">أجب بصوت مسموع${secs ? ' لمدة ' + secs + ' ثانية تقريباً' : ''}. (التسجيل متاح داخل تطبيق الهاتف)</div><span class="tm"></span>`;
    const b = box.querySelector('.mic'), out = box.querySelector('.sres'), tm = box.querySelector('.tm'); let on = false, st = null;
    if (!b) return;
    b.onclick = () => {
      if (on) { F.rec.stop(); return; }
      on = true; b.textContent = '⏹ أوقف'; b.classList.add('rec'); if (secs) st = timer(tm, secs, () => { if (on) F.rec.stop(); });
      F.rec.start({
        stopped: () => { on = false; if (st) st(); b.textContent = '🎙 سجّل من جديد'; b.classList.remove('rec'); out.innerHTML = '<button class="btn ghost pl">▶ استمع إلى إجابتك</button>'; out.querySelector('.pl').onclick = () => F.rec.play(); },
        denied: () => { on = false; if (st) st(); b.classList.remove('rec'); out.innerHTML = '<div class="hint">اسمح للتطبيق باستعمال الميكروفون من إعدادات الهاتف.</div>'; },
        error: () => { on = false; if (st) st(); b.classList.remove('rec'); },
      });
    };
  };
  const qaFlow = (kind, title, secs) => (task, end) => {
    const o = F.DB.byId[task.ref];
    const R = new Runner({ title, onClose: fin => { if (fin) F.markDone(kind, o.id); end(fin, {}); } });
    o.qs.forEach((q, i) => R.add((el, done) => {
      el.innerHTML = `<div class="speak"><div class="hint">الموضوع: <span class="en" dir="ltr">${esc(o.topic)}</span> · السؤال ${i + 1} من ${o.qs.length}. استمع للسؤال ثم أجب بصوتك قبل أن ترى النموذج.</div>
        <div class="spq en" dir="ltr">${esc(q.q)} ${spk(q.q)}</div><div class="recb"></div>
        <button class="btn ghost show">أظهر نموذج الإجابة</button><div class="model"></div><button class="btn big nx">التالي</button></div>`;
      recBtn(el.querySelector('.recb'), secs);
      el.querySelector('.show').onclick = function () { this.remove(); el.querySelector('.model').innerHTML = `<div class="mbox lk en" dir="ltr">${F.words(q.a)} ${spk(q.a, 'mini')}</div>${q.tip ? `<div class="tipbox">💡 ${esc(q.tip)}</div>` : ''}<div class="hint">الآن أعد إجابتك مستعيراً تعبيراً واحداً من النموذج.</div>`; };
      el.querySelector('.nx').onclick = () => { F.addXP(4); done({ ok: true }); };
      if (F.S.set.auto) F.say(q.q);
    }));
    R.tail = F.summary({ ic: '🎙️', title: 'تدريب المحادثة', lines: ['المهم أن تتكلم كل يوم ولو قليلاً. الطلاقة تأتي من الكمّ قبل الكمال.'] });
    R.open();
  };
  flows.sp1 = qaFlow('sp1', 'محادثة · الجزء 1', 30);
  flows.sp3 = qaFlow('sp3', 'محادثة · الجزء 3', 50);
  flows.sp2 = (task, end) => {
    const o = F.DB.byId[task.ref];
    const R = new Runner({ title: 'محادثة · الجزء 2', onClose: fin => { if (fin) F.markDone('sp2', o.id); end(fin, {}); } });
    const card = `<div class="cue en" dir="ltr"><b>${esc(o.card)}</b><div>You should say:</div><ul>${o.pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
    R.add((el, done) => {
      el.innerHTML = `<div class="speak"><div class="hint">كما في الاختبار: دقيقة واحدة للتحضير. اكتب كلمات مفتاحية فقط، لا جملاً كاملة.</div>${card}<div class="bigtm"></div><textarea class="note en" dir="ltr" rows="4" placeholder="notes…"></textarea><button class="btn big">أنا جاهز، أبدأ الكلام</button></div>`;
      timer(el.querySelector('.bigtm'), 60, () => F.beep('ok'));
      el.querySelector('.btn.big').onclick = () => done();
    });
    R.add((el, done) => {
      el.innerHTML = `<div class="speak"><div class="hint">تحدّث لمدة دقيقة إلى دقيقتين دون توقف. إن نسيت كلمة فاشرحها بكلمات أخرى وواصل.</div>${card}<div class="recb"></div><button class="btn ghost show">أظهر نموذج الإجابة</button><div class="model"></div><button class="btn big nx">انتهيت</button></div>`;
      recBtn(el.querySelector('.recb'), 120);
      el.querySelector('.show').onclick = function () { this.remove(); el.querySelector('.model').innerHTML = `<div class="mbox lk en" dir="ltr">${F.words(o.model)} ${spk(o.model, 'mini')}</div><div class="vchips en" dir="ltr">${o.phr.map(p => `<span class="chipx">${esc(p)}</span>`).join('')}</div>${o.tipAr ? `<div class="tipbox">💡 ${esc(o.tipAr)}</div>` : ''}`; };
      el.querySelector('.nx').onclick = () => { F.addXP(15); done({ ok: true }); };
    });
    R.tail = F.summary({ ic: '🎙️', title: 'الجزء 2', lines: ['سجّل الموضوع نفسه بعد يومين: المرة الثانية دائماً أسلس.'] });
    R.open();
  };

  /* ---------- writing ---------- */
  const PAL = ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#A855F7'];
  F.chart = o => {
    const W = 340, H = 210, L = 38, B = 28, T = 16, Rr = 18, S = o.series, X = o.x;
    if (o.chart === 'table') return `<div class="tblw"><table class="tbl en" dir="ltr"><tr><th></th>${S.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>${X.map((x, i) => `<tr><td>${esc(x)}</td>${S.map(s => `<td>${s.data[i]}</td>`).join('')}</tr>`).join('')}</table></div>`;
    const legend = names => `<div class="lgd en" dir="ltr">${names.map((n, i) => `<span><i style="background:${PAL[i % 6]}"></i>${esc(n)}</span>`).join('')}</div>`;
    if (o.chart === 'pie') {
      const pies = S.map(s => {
        const tot = s.data.reduce((a, b) => a + b, 0) || 1; let a0 = -Math.PI / 2;
        const arcs = s.data.map((v, i) => { const a1 = a0 + v / tot * 2 * Math.PI, big = a1 - a0 > Math.PI ? 1 : 0, p = a => [80 + 70 * Math.cos(a), 80 + 70 * Math.sin(a)], m = (a0 + a1) / 2; const [x0, y0] = p(a0), [x1, y1] = p(a1); const d = `M80 80L${x0.toFixed(1)} ${y0.toFixed(1)}A70 70 0 ${big} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z`; const tx = 80 + 46 * Math.cos(m), ty = 80 + 46 * Math.sin(m); a0 = a1; return `<path d="${d}" fill="${PAL[i % 6]}" stroke="#fff" stroke-width="1"/>${v / tot > 0.05 ? `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">${Math.round(v / tot * 100)}%</text>` : ''}`; }).join('');
        return `<figure><svg viewBox="0 0 160 160" width="150" height="150">${arcs}</svg><figcaption class="en" dir="ltr">${esc(s.name)}</figcaption></figure>`;
      }).join('');
      return `<div class="pies">${pies}</div>${legend(X)}`;
    }
    const max = Math.max(...S.map(s => Math.max(...s.data))) || 1, raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), nr = raw / mag;
    const stp = (nr <= 1 ? 1 : nr <= 2 ? 2 : nr <= 2.5 ? 2.5 : nr <= 5 ? 5 : 10) * mag, nt = Math.ceil(max / stp), top = nt * stp;
    const y = v => T + (H - T - B) * (1 - v / top), pw = W - L - Rr;
    let g = '';
    for (let i = 0; i <= nt; i++) { const v = stp * i, yy = y(v); g += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" stroke="currentColor" opacity=".15"/><text x="${L - 5}" y="${yy + 3}" text-anchor="end" font-size="9" fill="currentColor">${+v.toFixed(2)}</text>`; }
    if (o.chart === 'line') {
      const x = i => L + (X.length === 1 ? pw / 2 : pw * i / (X.length - 1));
      X.forEach((n, i) => { g += `<text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="9" fill="currentColor">${esc(n)}</text>`; });
      S.forEach((s, k) => { g += `<polyline fill="none" stroke="${PAL[k % 6]}" stroke-width="2.2" points="${s.data.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ')}"/>` + s.data.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" fill="${PAL[k % 6]}"/>`).join(''); });
    } else {
      const gw = pw / X.length, bw = Math.min(22, gw * 0.8 / S.length);
      X.forEach((n, i) => { const cx = L + gw * (i + 0.5); g += `<text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="8.5" fill="currentColor">${esc(String(n).slice(0, 12))}</text>`; S.forEach((s, k) => { const x0 = cx - bw * S.length / 2 + k * bw, yy = y(s.data[i]); g += `<rect x="${x0.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw - 1.5).toFixed(1)}" height="${(H - B - yy).toFixed(1)}" fill="${PAL[k % 6]}" rx="1.5"/>`; }); });
    }
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" direction="ltr">${g}<text x="4" y="9" font-size="9" fill="currentColor">${esc(o.unit || '')}</text></svg>${legend(S.map(s => s.name))}`;
  };
  const wcount = t => (t.trim().match(/[A-Za-z0-9'’-]+/g) || []).length;
  const claudePrompt = (kind, task, text) => (kind === 'w2' ? 'Please assess this IELTS Writing Task 2 essay' : kind === 'w1' ? 'Please assess this IELTS Academic Writing Task 1 report' : 'Please correct this short English writing exercise') +
    '. I am an Arabic speaker working towards IELTS band 7.\n1) ' + (kind === 'wsent' ? 'Tell me my approximate CEFR level for this text.' : 'Estimate a band for each of the four criteria and overall.') +
    '\n2) List my mistakes with the correction and a short explanation in Arabic.\n3) Rewrite my two weakest sentences at a higher level.\n4) Give me three things to practise next.\n\nTASK:\n' + task + '\n\nMY TEXT:\n' + text;
  const writeFlow = kind => (task, end) => {
    const S = F.S, o = F.DB.byId[task.ref], prompt = o.prompt || o.task, min = kind === 'w2' ? 250 : kind === 'w1' ? 150 : 0;
    const saved = S.texts[o.id];
    const R = new Runner({ title: { wsent: 'كتابة موجّهة', w2: 'IELTS Writing Task 2', w1: 'IELTS Writing Task 1' }[kind], onClose: fin => end(fin, {}) });
    R.add((el, done) => {
      const help = kind === 'wsent' ? `<div class="en" dir="ltr">${(o.frame || []).map(f => `<div>• ${esc(f)}</div>`).join('')}</div>` :
        kind === 'w2' ? `<p>${md(o.planAr)}</p><div class="en" dir="ltr">${o.ideas.map(f => `<div>• ${esc(f)}</div>`).join('')}</div><div class="vchips en" dir="ltr">${o.vocab.map(p => `<span class="chipx">${esc(p)}</span>`).join('')}</div>` :
          `<p>${md(o.keyAr)}</p><div class="vchips en" dir="ltr">${(o.phr || []).map(p => `<span class="chipx">${esc(p)}</span>`).join('')}</div>`;
      el.innerHTML = `<div class="write"><div class="vmeta"><span class="tag l${o.l}">${o.l}</span>${min ? `<span class="tag">${min}+ كلمة · ${kind === 'w2' ? 40 : 20} دقيقة</span>` : ''}</div>
        ${kind === 'w1' ? `<div class="chartbox"><div class="ct en" dir="ltr">${esc(o.title)}</div>${F.chart(o)}</div>` : ''}
        <div class="prompt en" dir="ltr">${esc(prompt)}</div>${o.taskAr ? `<div class="par">${esc(o.taskAr)}</div>` : ''}
        <details class="gl"><summary>${kind === 'wsent' ? 'بدايات جمل تساعدك' : 'مساعدة: خطة وأفكار ومفردات (جرّب وحدك أولاً)'}</summary>${help}</details>
        <div class="wbar"><span class="wc">0 كلمة</span><span class="tm">00:00</span></div>
        <textarea class="essay en" dir="ltr" rows="9" placeholder="Write here…" spellcheck="false">${esc(saved ? saved.t : '')}</textarea>
        <button class="btn big fin">انتهيت، أرني النموذج</button><div class="after"></div></div>`;
      const ta = el.querySelector('.essay'), wc = el.querySelector('.wc'); const secs = stopwatch(el.querySelector('.tm'));
      const upd = () => { const n = wcount(ta.value); wc.textContent = n + ' كلمة' + (min && n < min ? ` (الهدف ${min})` : ''); wc.classList.toggle('good', !min || n >= min); };
      ta.oninput = () => { upd(); S.texts[o.id] = { t: ta.value, day: dayNum(), wc: wcount(ta.value) }; F.save(); }; upd();
      el.querySelector('.fin').onclick = function () {
        const n = wcount(ta.value);
        if (n < 3) return F.toast('اكتب إجابتك أولاً، ولو قصيرة');
        this.remove(); ta.readOnly = true;
        S.texts[o.id] = { t: ta.value, day: dayNum(), wc: n, sec: secs() }; F.markDone(kind, o.id, { wc: n }); F.addXP(kind === 'w2' ? 40 : kind === 'w1' ? 25 : 12);
        const checks = kind === 'wsent' ? (o.check || []) : ['أجبتُ عن كل أجزاء السؤال', 'لكل فقرة فكرة رئيسية واضحة', 'استعملت أدوات ربط متنوعة دون مبالغة', 'راجعت الأزمنة وأدوات التعريف (a / the)'].concat(kind === 'w1' ? ['كتبت نظرة عامة (overview) دون رأي شخصي'] : ['موقفي واضح من المقدمة إلى الخاتمة']);
        el.querySelector('.after').innerHTML = (o.model ? `<h3>نموذج إجابة</h3><div class="mbox lk en" dir="ltr">${F.words(o.model).replace(/\n/g, '<br>')}</div>` : '<div class="hint">هذا السؤال بلا نموذج جاهز: استعمل زر التصحيح أدناه.</div>') + (o.notesAr ? `<div class="tipbox">${md(o.notesAr)}</div>` : '') +
          `<h3>راجع نصك بنفسك</h3>${checks.map(c => `<label class="ck"><input type="checkbox"> ${esc(c)}</label>`).join('')}
          <button class="btn ghost share">📤 أرسل نصي إلى Claude للتصحيح</button><div class="hint">سيُنسخ نصك مع طلب تصحيح جاهز. الصقه في محادثة جديدة مع Claude حين تريد تقييماً مفصلاً.</div><button class="btn big nx">حفظ ومتابعة</button>`;
        el.querySelector('.share').onclick = () => F.share('Fasih writing', claudePrompt(kind, prompt, ta.value));
        el.querySelector('.nx').onclick = () => done({ ok: true });
      };
    });
    R.open();
  };
  flows.wsent = writeFlow('wsent'); flows.w2 = writeFlow('w2'); flows.w1 = writeFlow('w1');
  flows.wlesson = (task, end) => {
    const o = F.DB.byId[task.ref]; let ok = 0, n = 0;
    const R = new Runner({ title: 'درس كتابة', onClose: fin => { if (fin) F.markDone('wlesson', o.id, { score: n ? ok / n : 0 }); end(fin, {}); } });
    R.add((el, done) => { el.innerHTML = `<div class="lesson"><h2 class="en" dir="ltr">${esc(o.title)}</h2><div class="lar">${esc(o.titleAr)}</div><p class="why">${md(o.bodyAr)}</p>${(o.examples || []).map(m => `<div class="mis"><div class="bad en" dir="ltr">✗ ${esc(m.bad)}</div><div class="good en" dir="ltr">✓ ${esc(m.good)}</div><div class="mar">${esc(m.ar || '')}</div></div>`).join('')}<button class="btn big">ابدأ التمارين</button></div>`; el.querySelector('.btn.big').onclick = () => done(); });
    o.exs.forEach(e => R.add((el, done) => Ex.run(el, e, r => { n++; if (r.ok) { ok++; F.addXP(1); } done(r); })));
    R.tail = (el, done) => { F.addXP(10); F.summary({ ic: '✍️', title: o.titleAr, lines: [`النتيجة: <b>${ok} / ${n}</b>`] })(el, done); };
    R.open();
  };

  /* ---------- weekly quiz, guides, missions ---------- */
  flows.quiz = (task, end) => {
    const S = F.S, big = S.day && S.day.n % 30 === 0, today = dayNum();
    const units = Object.keys(S.gram).filter(id => F.DB.byId[id]).sort((a, b) => S.gram[b].day - S.gram[a].day).slice(0, big ? 12 : 4);
    let gx = []; units.forEach(id => sample(F.DB.byId[id].exs, big ? 2 : 3).forEach(e => gx.push({ e, u: F.DB.byId[id] })));
    gx = shuffle(gx).slice(0, big ? 14 : 9);
    const ids = Object.keys(S.cards).filter(id => F.DB.byId[id] && S.cards[id].reps > 0);
    const hard = ids.filter(id => S.cards[id].laps > 0), pickV = shuffle(hard).slice(0, big ? 6 : 4).concat(shuffle(ids.filter(id => !hard.includes(id))).slice(0, big ? 8 : 4));
    if (!gx.length && !pickV.length) { F.toast('سيظهر الاختبار بعد أول أسبوع من الدراسة'); return end(true, { score: 0 }); }
    let ok = 0, n = 0, score = 0;
    const R = new Runner({ title: big ? 'اختبار المرحلة' : 'اختبار الأسبوع', onClose: fin => end(fin, { score }) });
    gx.forEach(it => R.add((el, done) => Ex.run(el, Object.assign({}, it.e, { pre: `<div class="hint">${esc(it.u.titleAr)}</div>` }), r => { n++; if (r.ok) ok++; done(r); })));
    pickV.forEach(id => R.add((el, done) => { const v = F.DB.byId[id]; Ex.vocab(el, v, / /.test(v.w) ? 'cloze' : 'type', r => { n++; if (r.ok) ok++; else { S.cards[id].due = today; } done({ ok: r.ok }); }); }));
    R.q = shuffle(R.q);
    R.tail = (el, done) => { score = n ? +(ok / n).toFixed(2) : 0; F.addXP(15 + ok); F.summary({ ic: '🏁', title: big ? 'اختبار المرحلة' : 'اختبار الأسبوع', lines: [`النتيجة: <b>${ok} / ${n}</b> (${pct(ok, n)}%)`, score >= 0.8 ? 'مستوى ممتاز، واصل بالوتيرة نفسها.' : score >= 0.6 ? 'جيد. ما أخطأت فيه سيعود في مراجعات هذا الأسبوع.' : 'هذا الاختبار يكشف ما يحتاج تثبيتاً، وما أخطأت فيه عاد إلى قائمة مراجعتك.'] })(el, done); };
    R.open();
  };
  flows.guide = (task, end) => {
    const o = F.DB.byId[task.ref];
    const R = new Runner({ title: o.cat === 'ielts' ? 'دليل IELTS' : 'طريقة الدراسة', onClose: fin => { if (fin) F.markDone('guide', o.id); end(fin, {}); } });
    R.add((el, done) => { el.innerHTML = `<div class="lesson"><h2>${esc(o.titleAr)}</h2>${o.title ? `<div class="lar en" dir="ltr">${esc(o.title)}</div>` : ''}<p class="why">${md(o.bodyAr)}</p><div class="tipbox"><b>الخلاصة</b>${o.keyPoints.map(k => `<div>• ${esc(k)}</div>`).join('')}</div><button class="btn big">اختبر فهمك</button></div>`; el.querySelector('.btn.big').onclick = () => done(); });
    (o.quiz || []).forEach(e => R.add((el, done) => Ex.mc(el, e, r => { if (r.ok) F.addXP(2); done(r); })));
    R.tail = F.summary({ ic: '🧭', title: o.titleAr, lines: ['يمكنك الرجوع إلى هذا الدليل في أي وقت من المكتبة.'] });
    R.open();
  };
  flows.mission = (task, end) => {
    const o = F.DB.byId[task.ref];
    const R = new Runner({ title: 'مهمة انغماس', onClose: fin => { if (fin) F.markDone('mission', o.id + ':' + dayNum()); end(fin, {}); } });
    R.add((el, done) => {
      el.innerHTML = `<div class="lesson"><h2>${esc(o.titleAr)}</h2><p class="why">${md(o.bodyAr)}</p>${(o.steps || []).map(s => `<label class="ck"><input type="checkbox"> ${esc(s)}</label>`).join('')}
        ${o.url ? `<button class="btn ghost open">🌐 افتح ${esc(o.site || 'الموقع')}</button>` : ''}<button class="btn ghost addw">➕ أضف كلمة جديدة إلى كلماتي</button><button class="btn big nx">أنجزت المهمة</button></div>`;
      const ob = el.querySelector('.open'); if (ob) ob.onclick = () => F.openUrl(o.url);
      el.querySelector('.addw').onclick = () => F.addWordSheet();
      el.querySelector('.nx').onclick = () => { F.addXP(20); done({ ok: true }); };
    });
    R.open();
  };
  /* ---------- placement (first day) ---------- */
  flows.placement = end => {
    const G = F.DB.tracks.g, res = { v: [0, 0, 0, 0], vn: [0, 0, 0, 0], g: 0, gn: 0 };
    const R = new Runner({ title: 'تحديد المستوى', onClose: fin => end(fin, res) });
    R.add((el, done) => { el.innerHTML = `<div class="lesson"><h2>اختبار قصير لتحديد نقطة البداية</h2><p class="why">نحو 28 سؤالاً في 4 دقائق: كلمات من مستويات مختلفة ثم قواعد. أجب بما تعرفه فقط، واضغط «لا أعرفها بعد» بلا تردد: لا درجات هنا، والهدف أن يبدأ برنامجك من مكانك الحقيقي.</p><button class="btn big">ابدأ</button></div>`; el.querySelector('.btn.big').onclick = () => done(); });
    F.LVN.forEach((l, li) => sample(G.filter(v => v.l === l), 5).forEach(v => R.add((el, done) => Ex.pretest(el, v, r => { res.vn[li]++; if (r.known) res.v[li]++; done(); }))));
    const gm = F.DB.grammar.filter(u => u.l === 'A2' || u.l === 'B1');
    sample(gm, Math.min(8, gm.length)).forEach(u => { const e = sample(u.exs.filter(x => x.k === 'mc'), 1)[0]; if (e) R.add((el, done) => Ex.mc(el, Object.assign({}, e, { why: '' }), r => { res.gn++; if (r.ok) res.g++; done(); })); });
    R.open();
  };
  F.Flows = flows;
})(window.Fasih);

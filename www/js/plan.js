'use strict';
/* Fasih plan: the flexible daily programme, streak, XP, badges, reminders */
(function (F) {
  const { dayNum, dateStr, clamp, shuffle } = F;
  const SRS = F.SRS, LV = F.LV;
  F.PLAN_DAYS = 540;
  F.PHASES = [
    { id: 1, from: 1, to: 150, name: 'الأساس', lv: 'A2 → B1', desc: 'تثبيت أساسيات A2 والوصول إلى B1: أكثر الكلمات شيوعاً، أزمنة الفعل، قراءة واستماع قصيران، جمل وفقرات.' },
    { id: 2, from: 151, to: 330, name: 'الانطلاق', lv: 'B1 → B2', desc: 'مفردات B2 والأكاديمية، قواعد متقدمة، نصوص بأسلوب IELTS، أول مقالات Task 2 ووصف الرسوم Task 1.' },
    { id: 3, from: 331, to: 480, name: 'الإتقان', lv: 'B2 → C1', desc: 'مفردات C1 واللغة الرسمية والقانونية، نصوص ومحاضرات صعبة، مقالات بمستوى 7، محادثة الجزأين 2 و3.' },
    { id: 4, from: 481, to: 540, name: 'IELTS المكثف', lv: 'IELTS 7.0+', desc: 'اختبارات تجريبية رسمية كاملة كل أسبوع، إدارة الوقت، سد الثغرات، ثم حجز الاختبار.' },
  ];
  F.phase = n => F.PHASES.find(p => n <= p.to) || F.PHASES[3];

  F.hist = d => { const S = F.S, k = d || dateStr(); return S.hist[k] || (S.hist[k] = { min: 0, xp: 0, rev: 0, ok: 0, new: 0, tasks: 0 }); };
  F.addMinutes = m => { const h = F.hist(); h.min = +(h.min + m).toFixed(1); F.save(); };
  F.addXP = n => { F.S.xp += n; F.hist().xp += n; F.save(); };
  F.lvlOf = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
  F.lvlXp = l => 50 * (l - 1) * (l - 1);
  F.rank = l => l < 5 ? 'مبتدئ طموح' : l < 10 ? 'متعلّم مثابر' : l < 18 ? 'قارئ نشيط' : l < 28 ? 'متحدث واثق' : l < 40 ? 'باحث متمكن' : l < 52 ? 'محاور بارع' : 'فصيح';
  F.revCap = () => ({ 30: 50, 45: 70, 60: 90, 75: 110, 90: 130, 120: 160 }[F.S.set.dailyMin] || 100);

  /* ---------- ordered sequences of skill content ---------- */
  F.buildSeq = () => {
    const D = F.DB, by = (k, l) => D[k].filter(x => x.l === l);
    const weave = (a, b, every) => { const out = []; let j = 0; a.forEach((x, i) => { if (i % every === 0 && j < b.length) out.push(b[j++]); out.push(x); }); while (j < b.length) out.push(b[j++]); return out; };
    const tag = (arr, kind, l) => arr.map(x => ({ id: x.id, kind, l: l || x.l }));
    const srt = k => D[k].slice().sort((a, b) => (LV[a.l] - LV[b.l]) || (a.id < b.id ? -1 : 1));
    const seq = F.seq = {};
    seq.reading = tag(srt('reading'), 'reading');
    seq.listening = tag(srt('listening'), 'listening');
    const wl = l => tag(by('wlesson', l), 'wlesson'), ws = l => tag(by('wsent', l), 'wsent');
    const w2 = l => tag(by('w2', l), 'w2'), w1 = l => tag(by('w1', l), 'w1');
    seq.writing = [...weave(ws('A2'), wl('A2'), 3), ...weave(ws('B1'), wl('B1'), 3), ...weave(w2('B1'), w1('B1'), 3), ...weave(w2('B2'), w1('B2'), 3), ...weave(w2('C1'), w1('C1'), 3)];
    const pr = D.pron.map((x, i) => ({ id: x.id, kind: 'pron', l: i < 8 ? 'A2' : 'B1' }));
    const sh = l => tag(by('shadow', l), 'shadow'), s1 = tag(D.sp1, 'sp1'), s2 = l => tag(by('sp2', l), 'sp2'), s3 = l => tag(by('sp3', l), 'sp3');
    seq.speaking = [...weave(sh('A2'), pr.filter(x => x.l === 'A2'), 2), ...weave(weave(sh('B1'), s1.slice(0, 12), 1), pr.filter(x => x.l === 'B1'), 3), ...weave(s2('B1'), s1.slice(12), 1), ...weave(s2('B2'), s3('B2'), 1), ...weave(s2('C1'), s3('C1'), 1)];
    const gm = D.guide.filter(g => g.cat === 'method'), gi = D.guide.filter(g => g.cat === 'ielts');
    seq.guide = weave(gi, gm, 2).map(g => ({ id: g.id, kind: 'guide' }));
  };
  const isDone = (kind, id) => !!((F.S.done[kind] || {})[id]);
  F.isDone = isDone;
  F.markDone = (kind, id, rec) => { const S = F.S; (S.done[kind] = S.done[kind] || {})[id] = Object.assign({ day: dayNum() }, rec || {}); F.save(); };
  /* may the learner move on to content of this level? yes once 60% of the previous level's words are introduced */
  F.canLevel = l => {
    const cur = LV[F.level()], want = LV[l] || 0;
    if (want <= cur) return true;
    if (want > cur + 1) return false;
    const a = F.DB.tracks.g.filter(v => v.l === F.level()); if (!a.length) return true;
    return a.filter(v => F.S.cards[v.id]).length / a.length >= 0.6;
  };
  const pickSeq = (name, taken) => {
    const a = F.seq[name] || [];
    for (const x of a) { if (isDone(x.kind, x.id) || taken.includes(x.id)) continue; return F.canLevel(x.l) ? { t: x.kind, ref: x.id } : null; }
    return null;
  };
  const missionFor = (kind, n) => {
    const lv = LV[F.level()], a = F.DB.mission.filter(m => (!kind || m.kind === kind) && lv >= LV[m.min] && lv <= LV[m.max]);
    if (!a.length) return null;
    const m = a[(n + (F.S.missionNo || 0)) % a.length];
    return { t: 'mission', ref: m.id };
  };
  F.planSkills = n => {
    const S = F.S, k = (n - 1) % 6, m = S.set.dailyMin, out = [], taken = [];
    const add = t => { if (t) { out.push(Object.assign({ core: true }, t)); if (t.ref) taken.push(t.ref); } };
    const skill = name => pickSeq(name, taken) || missionFor({ reading: 'read', listening: 'listen', writing: 'write', speaking: 'speak' }[name], n);
    const gram = () => { const u = F.DB.grammar.find((g, i) => i >= S.gptr && !S.gram[g.id]) || F.DB.grammar.find(g => !S.gram[g.id]); return u ? { t: 'grammar', ref: u.id } : (F.gramDue().length ? { t: 'grev' } : null); };
    if (k === 0) { add(gram()); add(skill('reading')); }
    if (k === 1) { add(skill('listening')); add(skill('speaking')); }
    if (k === 2) { add(gram()); add(skill('writing')); }
    if (k === 3) { add(skill('reading')); add(skill('speaking')); }
    if (k === 4) { add(skill('listening')); if (F.gramDue().length) add({ t: 'grev' }); if (m >= 75) add(skill('writing')); }
    if (k === 5) { add({ t: 'quiz' }); add(pickSeq('guide', taken)); if (n > 480 || (n > 330 && Math.floor(n / 6) % 2 === 0)) add(missionFor('mock', n)); }
    let res = out;
    if (m <= 30) res = out.slice(0, 1); else if (m <= 45) res = out.slice(0, 2);
    if (m >= 90) { const x = missionFor(k % 2 ? 'read' : 'listen', n + 1); if (x && !res.some(r => r.ref === x.ref)) res.push(Object.assign({ core: true }, x)); }
    if (m >= 120) { const x = skill(k % 2 ? 'reading' : 'listening'); if (x) res.push(Object.assign({ core: true }, x)); }
    return res;
  };
  F.gramDue = () => { const S = F.S, t = dayNum(); return Object.keys(S.gram).filter(id => S.gram[id].due <= t && F.DB.byId[id]); };

  /* ---------- the day ---------- */
  F.ensureDay = () => {
    const S = F.S, today = dateStr(), old = S.day;
    if (old && old.date === today) return old;
    const due = SRS.dueCount(), cap = F.revCap();
    const carry = old && !old.done ? old : null;
    const n = carry ? carry.n : S.daysDone + 1;
    let nw = S.set.newPerDay;
    if (due > cap * 1.5) nw = 0; else if (due > cap) nw = Math.ceil(nw / 2);
    if (SRS.remaining() === 0) nw = 0;
    const day = { date: today, n, tasks: [], done: false, light: false, backlog: due, catchup: due > cap };
    day.tasks.push({ t: 'review', core: true, done: due === 0 });
    if (nw > 0) day.tasks.push({ t: 'learn', n: nw, got: 0, core: true });
    const skills = carry ? carry.tasks.filter(x => !['review', 'learn', 'recap'].includes(x.t)).map(x => { const y = Object.assign({}, x); if (y.was != null) { y.core = y.was; delete y.was; } return y; }) : F.planSkills(n);
    skills.forEach(x => day.tasks.push(x));
    day.tasks.push({ t: 'recap', core: false });
    if (old && old.date !== today) { const gap = dayNum() - (S.streak.last || dayNum()); if (gap > 1) day.back = gap - 1; }
    S.day = day; F.save();
    return day;
  };
  F.reviewLeft = () => Math.min(SRS.dueCount(), F.S.day && F.S.day.light ? 30 : F.revCap());
  const SK = {
    review: { ic: '🔁', n: 'المراجعة' }, learn: { ic: '🌱', n: 'كلمات جديدة' }, recap: { ic: '🌙', n: 'مراجعة ما قبل النوم' },
    grammar: { ic: '🧩', n: 'قاعدة جديدة' }, grev: { ic: '♻️', n: 'مراجعة القواعد' }, reading: { ic: '📖', n: 'قراءة' }, listening: { ic: '🎧', n: 'استماع' },
    shadow: { ic: '🗣️', n: 'محادثة: ردِّد' }, pron: { ic: '👄', n: 'نطق' }, sp1: { ic: '🎙️', n: 'محادثة IELTS 1' }, sp2: { ic: '🎙️', n: 'محادثة IELTS 2' }, sp3: { ic: '🎙️', n: 'محادثة IELTS 3' },
    wlesson: { ic: '✍️', n: 'درس كتابة' }, wsent: { ic: '✍️', n: 'كتابة موجّهة' }, w2: { ic: '📝', n: 'مقال IELTS' }, w1: { ic: '📊', n: 'وصف رسم IELTS' },
    quiz: { ic: '🏁', n: 'اختبار الأسبوع' }, guide: { ic: '🧭', n: 'دليل' }, mission: { ic: '🌍', n: 'مهمة انغماس' },
  };
  F.SK = SK;
  F.taskInfo = t => {
    const k = SK[t.t] || { ic: '•', n: t.t }, o = t.ref ? F.DB.byId[t.ref] : null, S = F.S;
    let sub = '', min = 8;
    if (t.t === 'review') { const n = t.done ? 0 : F.reviewLeft(); sub = t.done ? 'أنجزت مراجعات اليوم' : n + ' بطاقة مستحقة'; min = Math.ceil(n * 9 / 60); }
    else if (t.t === 'learn') { sub = `${t.got || 0} من ${t.n} كلمة`; min = Math.ceil((t.n - (t.got || 0)) * 1.1); }
    else if (t.t === 'recap') { sub = 'تثبيت سريع لكلمات اليوم'; min = 3; }
    else if (t.t === 'grev') { sub = 'تمارين متداخلة من قواعد سابقة'; min = 6; }
    else if (t.t === 'quiz') { sub = S.day && S.day.n % 30 === 0 ? 'اختبار المرحلة الشهري' : 'قواعد وكلمات هذا الأسبوع'; min = 8; }
    else if (o) {
      sub = o.titleAr || o.title || o.topic || o.card || o.task || (o.prompt ? o.prompt.slice(0, 60) + '…' : '') || '';
      min = { grammar: 12, reading: { A2: 10, B1: 13, B2: 18, C1: 22 }[o.l] || 12, listening: { A2: 8, B1: 10, B2: 13, C1: 15 }[o.l] || 10, shadow: 7, pron: 6, sp1: 8, sp2: 10, sp3: 10, wlesson: 10, wsent: 12, w2: 40, w1: 20, guide: 5, mission: 20 }[t.t] || 10;
    }
    return { ic: k.ic, name: k.n, sub, min, lvl: o && o.l ? o.l : '' };
  };
  F.dayLeftMin = () => { const d = F.S.day; if (!d) return 0; return d.tasks.filter(t => t.core && !t.done).reduce((a, t) => a + F.taskInfo(t).min, 0); };
  F.dayProgress = () => { const d = F.S.day, c = d.tasks.filter(t => t.core); return { done: c.filter(t => t.done).length, n: c.length }; };

  F.taskDone = (task, finished, res) => {
    const S = F.S, day = S.day; res = res || {};
    if (task.t === 'learn' && res.taught) task.got = Math.min(task.n, (task.got || 0) + res.taught);
    if (!finished) { F.afterTask(false); return; }
    const first = !task.done;
    task.done = true; if (res.score != null) task.score = res.score;
    if (first) {
      F.hist().tasks++;
      if (task.t === 'grammar') { S.gptr = Math.max(S.gptr, F.DB.grammar.findIndex(g => g.id === task.ref) + 1); }
      if (task.t === 'mission') S.missionNo = (S.missionNo || 0) + 1;
      if (task.t === 'quiz') S.tests.push({ day: dayNum(), n: day.n, score: res.score || 0, big: day.n % 30 === 0 });
    }
    F.checkDay();
    F.save();
    F.afterTask(true, task);
  };
  F.vocabCoreDone = () => { const d = F.S.day; return d.tasks.filter(t => t.t === 'review' || t.t === 'learn').every(t => t.done); };
  F.checkDay = () => {
    const S = F.S, d = S.day; if (!d) return;
    const rv = d.tasks.find(t => t.t === 'review'); if (rv && !rv.done && SRS.dueCount() === 0) rv.done = true;
    if (F.vocabCoreDone()) F.markActive();
    if (!d.done && d.tasks.filter(t => t.core).every(t => t.done)) {
      if (d.light) { d.lightDone = true; }
      else { d.done = true; S.daysDone = Math.max(S.daysDone, d.n); F.addXP(30); d.justDone = true; }
    }
    F.checkBadges();
    F.syncRem();
  };
  F.setLight = on => {
    const d = F.S.day; d.light = on;
    d.tasks.forEach(t => {
      if (['review', 'learn', 'recap'].includes(t.t)) { if (t.t === 'learn') { if (on) { t.full = t.full || t.n; t.n = Math.max(t.got || 0, Math.min(t.n, 3)); if ((t.got || 0) >= t.n) t.done = true; } else if (t.full) { t.n = t.full; if ((t.got || 0) < t.n) t.done = false; } } return; }
      if (on) { if (t.was == null) t.was = t.core; t.core = false; } else if (t.was != null) { t.core = t.was; delete t.was; }
    });
    if (!on) d.lightDone = false;
    F.checkDay(); F.save();
  };
  F.extraDay = () => { const S = F.S, d = S.day; if (!d.done) return; const nd = { date: d.date, n: S.daysDone + 1, tasks: [], done: false, light: false, extra: true }; const due = SRS.dueCount(); nd.tasks.push({ t: 'review', core: true, done: due === 0 }); if (SRS.remaining() > 0) nd.tasks.push({ t: 'learn', n: Math.max(3, Math.ceil(S.set.newPerDay / 2)), got: 0, core: true }); F.planSkills(nd.n).forEach(x => nd.tasks.push(x)); nd.tasks.push({ t: 'recap', core: false }); S.day = nd; F.save(); };

  /* ---------- streak ---------- */
  F.markActive = () => {
    const S = F.S, st = S.streak, today = dayNum();
    if (st.last === today) return;
    const gap = st.last ? today - st.last : 1;
    if (gap === 1 || !st.last) st.cur++;
    else if (gap - 1 <= st.shields) { st.shields -= gap - 1; st.cur++; st.saved = today; }
    else st.cur = 1;
    st.last = today; st.best = Math.max(st.best, st.cur);
    if (st.cur > 0 && st.cur % 7 === 0 && st.shields < 2 && st.gotShield !== st.cur) { st.shields++; st.gotShield = st.cur; }
    S.day.streakNew = true;
  };
  F.streakAlive = () => { const st = F.S.streak, today = dayNum(); if (!st.last) return 0; const gap = today - st.last; return gap <= 1 || gap - 1 <= st.shields ? st.cur : 0; };

  /* ---------- pace against the 18-month target ---------- */
  F.pace = () => {
    const S = F.S, today = dayNum(), start = S.start || today, target = S.target || (start + 548);
    const span = Math.max(1, target - start), el = clamp(today - start + 1, 1, span);
    const expected = Math.min(F.PLAN_DAYS, el / span * F.PLAN_DAYS), diff = Math.round(S.daysDone - expected);
    const rate = S.daysDone / Math.max(1, today - start + 1);
    const proj = S.daysDone >= 5 && rate > 0 ? today + Math.ceil((F.PLAN_DAYS - S.daysDone) / rate) : null;
    return { expected: Math.round(expected), diff, proj, target, start, left: target - today, pct: Math.round(100 * S.daysDone / F.PLAN_DAYS) };
  };

  /* ---------- badges ---------- */
  F.BADGES = [
    ['d1', '🚀', 'الخطوة الأولى', 'أكملت أول يوم دراسي', S => S.daysDone >= 1],
    ['s7', '🔥', 'أسبوع كامل', 'سلسلة 7 أيام', S => S.streak.best >= 7],
    ['s30', '🌟', 'شهر بلا انقطاع', 'سلسلة 30 يوماً', S => S.streak.best >= 30],
    ['s100', '💎', 'مئة يوم', 'سلسلة 100 يوم', S => S.streak.best >= 100],
    ['w100', '📚', '100 كلمة', 'تعلّمت 100 كلمة', (S, st) => st.total >= 100],
    ['w500', '📚', '500 كلمة', 'تعلّمت 500 كلمة', (S, st) => st.total >= 500],
    ['w1500', '🏛️', '1500 كلمة', 'تعلّمت 1500 كلمة', (S, st) => st.total >= 1500],
    ['w3000', '🎓', '3000 كلمة', 'تعلّمت 3000 كلمة', (S, st) => st.total >= 3000],
    ['m300', '🧠', 'ذاكرة طويلة', '300 كلمة ناضجة (فاصل 3 أسابيع فأكثر)', (S, st) => st.mature >= 300],
    ['dom100', '⚖️', 'لغة التخصص', '100 مصطلح في القانون ومكافحة الفساد والذكاء الاصطناعي', (S, st) => st.dom >= 100],
    ['g10', '🧩', 'عشر قواعد', 'أتممت 10 وحدات قواعد', S => Object.keys(S.gram).length >= 10],
    ['g40', '🧩', 'نصف القواعد', 'أتممت 40 وحدة قواعد', S => Object.keys(S.gram).length >= 40],
    ['r10', '📖', 'قارئ', 'أتممت 10 نصوص قراءة', S => Object.keys(S.done.reading || {}).length >= 10],
    ['l10', '🎧', 'مستمع', 'أتممت 10 تمارين استماع', S => Object.keys(S.done.listening || {}).length >= 10],
    ['e1', '📝', 'أول مقال', 'كتبت أول مقال IELTS', S => Object.keys(S.done.w2 || {}).length >= 1],
    ['b1', '🥉', 'بلغت B1', 'انتقلت إلى كلمات B1', () => F.LV[F.level()] >= 1],
    ['b2', '🥈', 'بلغت B2', 'انتقلت إلى كلمات B2', () => F.LV[F.level()] >= 2],
    ['c1', '🥇', 'بلغت C1', 'انتقلت إلى كلمات C1', () => F.LV[F.level()] >= 3],
    ['d100', '🏔️', '100 يوم دراسي', 'أكملت 100 يوم من الخطة', S => S.daysDone >= 100],
    ['d270', '🧗', 'منتصف الطريق', 'أكملت نصف الخطة', S => S.daysDone >= 270],
  ];
  F.checkBadges = () => { const S = F.S, st = F.stats(), got = []; F.BADGES.forEach(b => { if (!S.badges[b[0]]) { let ok = false; try { ok = b[4](S, st); } catch (e) { ok = false; } if (ok) { S.badges[b[0]] = dayNum(); got.push(b); } } }); if (got.length) { F.newBadges = (F.newBadges || []).concat(got); F.save(); } return got; };

  /* ---------- reminders (Android app) ---------- */
  F.msg = kind => { const a = F.DB.motiv.filter(m => m.k === kind); if (!a.length) return ''; const m = a[F.rnd(a.length)].ar; return m; };
  F.fill = s => { const S = F.S; return String(s).replace(/\{streak\}/g, F.streakAlive() || 1).replace(/\{left\}/g, F.dayLeftMin() || 5); };
  F.syncRem = () => {
    const S = F.S; if (!F.isApp || !S.onboard) return;
    const d = S.day, done = !!(d && (d.done || d.lightDone));
    try {
      const msgs = shuffle(F.DB.motiv.filter(m => m.k === 'notif')).slice(0, 16).map(m => m.ar);
      const r = Object.assign({}, S.set.rem); r.times = (r.times || []).filter(Boolean); if (!r.nagUntil || r.nagUntil < r.nagFrom) r.nagUntil = '23:59';
      F.nat('setReminders', JSON.stringify(Object.assign(r, { msgs, title: S.name ? 'فصيح · ' + S.name : 'فصيح' })));
      F.nat('setDayStatus', dateStr(), done, F.dayLeftMin(), F.streakAlive());
    } catch (e) { console.error(e); }
  };
  F.remState = () => { try { return JSON.parse(F.nat('reminderState') || '{}'); } catch (e) { return {}; } };
})(window.Fasih);

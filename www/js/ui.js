'use strict';
/* Fasih UI: navigation, screens, sheets, onboarding, start-up */
(function (F) {
  const { $, $$, esc, dayNum, dateStr, spk, now } = F;
  const SRS = F.SRS, LVN = F.LVN;
  const app = () => $('#app');

  /* ---------- small UI kit ---------- */
  F.toast = msg => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.classList.add('on'), 10); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, 2600); };
  F.sheet = (html, cls) => {
    F.closeSheet();
    const s = document.createElement('div'); s.className = 'sheetw';
    s.innerHTML = `<div class="sheet ${cls || ''}"><button class="sx" aria-label="إغلاق">✕</button>${html}</div>`;
    s.onclick = e => { if (e.target === s || e.target.closest('.sx')) F.closeSheet(); };
    document.body.appendChild(s); F._sheet = s; setTimeout(() => s.classList.add('on'), 10);
    return s.querySelector('.sheet');
  };
  F.closeSheet = () => { if (F._sheet) { F._sheet.remove(); F._sheet = null; return true; } return false; };
  F.confirm = (msg, yes, yesT, noT) => { const s = F.sheet(`<p class="cmsg">${esc(msg)}</p><div class="row"><button class="btn ghost no">${noT || 'إلغاء'}</button><button class="btn yes">${yesT || 'نعم'}</button></div>`, 'small'); s.querySelector('.no').onclick = F.closeSheet; s.querySelector('.yes').onclick = () => { F.closeSheet(); yes(); }; };
  F.share = (title, text) => { if (F.isApp) return F.nat('shareText', title, text); if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => F.toast('نُسخ النص ✓'), () => F.toast('تعذّر النسخ')); };
  F.openUrl = u => { if (F.isApp) F.nat('openExternal', u); else window.open(u, '_blank'); };
  F.celebrate = (title, msg) => {
    F.beep('win'); F.vibrate(120);
    const c = document.createElement('div'); c.className = 'confetti'; c.innerHTML = Array.from({ length: 26 }, (_, i) => `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.5}s;background:${['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#06B6D4'][i % 5]}"></i>`).join('');
    document.body.appendChild(c); setTimeout(() => c.remove(), 2600);
    const s = F.sheet(`<div class="sum"><div class="sumic">🎉</div><h2>${esc(title)}</h2><div class="suml">${msg}</div><button class="btn big">رائع</button></div>`, 'small'); s.querySelector('.btn.big').onclick = F.closeSheet;
  };
  const applyTheme = F.applyTheme = () => {
    const t = F.S.set.theme, night = t === 'dark' || (t === 'auto' && (F.isApp ? !!F.nat('isNight') : window.matchMedia('(prefers-color-scheme: dark)').matches));
    document.documentElement.dataset.theme = night ? 'dark' : 'light';
    F.nat('setBars', night ? '#0F1220' : '#4338CA', night ? '#0F1220' : '#FFFFFF', false, !night);
  };
  const ring = (done, n, size) => { const r = size / 2 - 6, c = 2 * Math.PI * r, p = n ? done / n : 0; return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ok)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="54%" text-anchor="middle" font-size="${size / 4.2}" font-weight="800" fill="currentColor">${done}/${n}</text></svg>`; };
  const bar = (p, cls) => `<div class="bar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`;
  const dfmt = n => F.dayToDate(n).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' });

  /* ---------- router ---------- */
  const routes = {};
  F.go = r => { if (location.hash === '#/' + r) F.render(); else location.hash = '#/' + r; };
  F.render = () => {
    if (!F.S.onboard) return onboard();
    const h = (location.hash || '#/home').slice(2).split('/'), name = routes[h[0]] ? h[0] : 'home';
    F.ensureDay();
    app().innerHTML = `<div class="page">${routes[name](h.slice(1))}</div>` + nav(name);
    window.scrollTo(0, 0);
    if (after[name]) after[name](h.slice(1));
  };
  const after = {};
  F.routes = routes; F.after = after;
  const nav = cur => `<nav class="tabs">${[['home', '🏠', 'اليوم'], ['lib', '📚', 'المكتبة'], ['tutor', '🎓', 'المعلّم'], ['journey', '🧭', 'الرحلة'], ['me', '⚙️', 'أنا']].map(t => `<button class="${cur === t[0] || (t[0] === 'lib' && ['list', 'words', 'ielts', 'phrases'].includes(cur)) ? 'on' : ''}" data-go="${t[0]}"><span>${t[1]}</span>${t[2]}</button>`).join('')}</nav>`;
  window.addEventListener('hashchange', () => { if (!F.runner) F.render(); });

  /* ---------- home ---------- */
  const tutorCard = () => { try { return F.tutor && F.tutor.homeCard ? F.tutor.homeCard() : ''; } catch (e) { console.error(e); return ''; } };
  routes.home = () => {
    const S = F.S, d = S.day, pr = F.dayProgress(), pc = F.pace(), ph = F.phase(d.n), left = F.dayLeftMin(), st = F.streakAlive();
    const nextI = d.tasks.findIndex(t => t.core && !t.done), allDone = nextI < 0;
    const rows = d.tasks.map((t, i) => { const k = F.taskInfo(t); if (t.t === 'recap' && !Object.keys(S.cards).some(id => S.cards[id].born === dayNum())) return ''; return `<button class="task ${t.done ? 'done' : ''} ${t.core ? '' : 'optl'}" data-a="task" data-i="${i}"><span class="tic">${k.ic}</span><span class="tb"><b>${esc(k.name)}${k.lvl ? ` <em class="tag l${k.lvl}">${k.lvl}</em>` : ''}${t.core ? '' : ' <em class="tag">اختياري</em>'}${t.fx ? ' <em class="tag dom">من المعلّم</em>' : ''}</b><small>${esc(k.sub)}</small></span><span class="tr">${t.done ? '✓' : k.min + ' د'}</span></button>`; }).join('');
    const tip = F.DB.motiv.filter(m => m.k === 'tip'); const tp = tip.length ? tip[(dayNum() + S.tipNo) % tip.length].ar : '';
    const lvl = F.lvlOf(S.xp), x0 = F.lvlXp(lvl), x1 = F.lvlXp(lvl + 1);
    return `<header class="top"><div><h1>مرحباً${S.name ? ' ' + esc(S.name) : ''} 👋</h1><small>اليوم الدراسي ${d.n} من ${F.PLAN_DAYS} · مرحلة «${ph.name}»</small></div><button class="streak ${st ? 'on' : ''}" data-a="streak">🔥 <b>${st}</b>${S.streak.shields ? `<i>🛡️${S.streak.shields}</i>` : ''}</button></header>
      ${d.back ? `<div class="card note"><b>${esc(F.msg('comeback') || 'أهلاً بعودتك!')}</b><div>الخطة تكمل من حيث توقفت: لم يفُتك شيء، والمراجعات المتراكمة موزعة على الأيام القادمة.</div></div>` : ''}
      ${d.catchup && !d.done ? `<div class="card note">وضع اللحاق مفعّل: نقدّم المراجعات المتراكمة ونخفّف الكلمات الجديدة حتى يعود الجدول إلى طبيعته.</div>` : ''}
      <section class="card today"><div class="trow">${ring(pr.done, pr.n, 92)}<div class="tinfo"><b>${allDone ? (d.light ? 'أنجزت الخطة المخففة ✓' : 'أنجزت مهمة اليوم 🎉') : 'مهمة اليوم'}</b><small>${allDone ? (F.msg('done') || '') : 'بقي نحو ' + left + ' دقيقة'}</small>
        ${allDone ? (d.done ? '<button class="btn ghost" data-a="extra">➕ يوم إضافي (لتتقدم على الخطة)</button>' : '') : `<button class="btn big" data-a="task" data-i="${nextI}">${pr.done ? 'تابع' : 'ابدأ'} ›</button>`}</div></div>
        <div class="tasks">${rows}</div>
        ${d.done ? '' : `<button class="link" data-a="light">${d.light ? '↩︎ العودة إلى الخطة الكاملة' : '⏱ يوم مزدحم؟ خطة مخففة من 10 دقائق تحفظ سلسلتك'}</button>`}</section>
      ${tutorCard()}
      <section class="card"><div class="crow"><b>مسارك نحو <span dir="ltr">C1</span></b><span>${pc.pct}%</span></div>${bar(pc.pct)}<small>${pc.diff >= 1 ? `متقدم على الخطة بـ ${pc.diff} يوم 👏` : pc.diff <= -2 ? `متأخر ${-pc.diff} يوماً عن وتيرة 18 شهراً. يوم إضافي واحد في الأسبوع يعيدك إلى المسار.` : 'على المسار تماماً'} · بقي ${Math.max(0, pc.left)} يوماً على الموعد المستهدف${pc.proj ? ` · بوتيرتك الحالية تنتهي في ${dfmt(pc.proj)}` : ''}</small></section>
      ${tp ? `<section class="card tip">💡 ${esc(tp)}</section>` : ''}
      ${S.set.calm ? '' : `<section class="card"><div class="crow"><b>المستوى ${lvl} · ${F.rank(lvl)}</b><span>${S.xp} XP</span></div>${bar(100 * (S.xp - x0) / (x1 - x0), 'xp')}</section>`}`;
  };
  after.home = () => {
    const S = F.S, d = S.day;
    if (d.justDone) { delete d.justDone; F.save(); setTimeout(() => F.celebrate('أكملت اليوم الدراسي ' + d.n, esc(F.fill(F.msg('done') || 'عمل ممتاز!')) + (F.streakAlive() > 1 ? `<br>🔥 سلسلتك: ${F.streakAlive()} يوماً` : '')), 250); }
    else if (F.newBadges && F.newBadges.length) { const b = F.newBadges.shift(); setTimeout(() => F.celebrate('شارة جديدة ' + b[1], `<b>${esc(b[2])}</b><br>${esc(b[3])}`), 250); }
  };
  F.startTask = i => {
    const S = F.S, t = S.day.tasks[i]; if (!t) return;
    if (t.t === 'review' && t.done && SRS.dueCount() > 0) return F.flows.review({ all: true }, () => { F.checkDay(); F.render(); });
    if (t.done && ['review', 'learn'].includes(t.t)) return F.toast('أنجزت هذه المهمة اليوم ✓');
    const fl = F.flows[t.t]; if (!fl) return;
    fl(t, (fin, res) => F.taskDone(t, fin, res));
  };
  F.afterTask = () => { F.render(); };
  F.startFree = (kind, id) => {
    const S = F.S, t = S.day.tasks.find(x => x.ref === id && !x.done);
    if (t) return F.flows[kind](t, (fin, res) => F.taskDone(t, fin, res));
    F.flows[kind]({ t: kind, ref: id, free: true }, (fin, res) => {
      if (fin && kind === 'grammar') { S.gptr = Math.max(S.gptr, 0); }
      F.checkBadges(); F.save(); F.render();
    });
  };
  const act = F.act = {
    task: el => F.startTask(+el.dataset.i),
    light: () => { const d = F.S.day; F.setLight(!d.light); F.render(); if (d.light) F.toast('خطة اليوم: المراجعة و3 كلمات فقط. الباقي ينتظرك غداً.'); },
    extra: () => F.confirm('تبدأ الآن اليوم الدراسي التالي لتتقدم على الخطة؟', () => { F.extraDay(); F.render(); }, 'ابدأ'),
    streak: () => { const st = F.S.streak; F.sheet(`<div class="sum"><div class="sumic">🔥</div><h2>${F.streakAlive()} يوماً متتالياً</h2><div class="suml">أطول سلسلة: ${st.best} يوماً</div><div class="suml">🛡️ دروع الحماية: ${st.shields} (تكسب درعاً كل 7 أيام، ويحمي سلسلتك تلقائياً إذا فاتك يوم)</div><div class="suml">تُحسب لك السلسلة بمجرد إنهاء المراجعة وكلمات اليوم.</div></div>`, 'small'); },
    open: el => F.startFree(el.dataset.k, el.dataset.id),
    word: el => F.wordSheet(el.dataset.id),
    addw: () => F.addWordSheet(),
    url: el => F.openUrl(el.dataset.u),
    mock: () => mockSheet(),
    set: el => setValue(el),
    perm: el => { const k = el.dataset.k; if (k === 'notif') F.nat('askNotifPermission'); else if (k === 'batt') F.nat('askBatteryExemption'); else if (k === 'test') { F.syncRem(); F.nat('testReminder'); } else if (k === 'nset') F.nat('openNotifSettings'); setTimeout(F.render, 1200); },
    exp: () => { const j = F.exportState(), name = 'fasih-backup-' + dateStr() + '.json'; if (F.isApp) F.nat('saveFile', name, 'application/json', j); else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = name; a.click(); } },
    imp: () => $('#impf').click(),
    reset: () => F.confirm('حذف كل تقدمك والبدء من جديد؟ لا يمكن التراجع.', () => { localStorage.removeItem('fasih-state'); F.nat('store', '{"savedAt":0}'); F.S = null; F.load(); F.S.cards = {}; F.flush(); location.hash = ''; location.reload(); }, 'احذف'),
    place: () => F.flows.placement((fin, res) => { if (fin) placeResult(res); else F.render(); }),
  };
  document.addEventListener('click', e => {
    const say = e.target.closest('[data-say]'); if (say) { e.preventDefault(); e.stopPropagation(); F.say(say.dataset.say); return; }
    const w = e.target.closest('.lk .w'); if (w) { F.wordPop(w.textContent); return; }
    const go = e.target.closest('[data-go]'); if (go) { F.go(go.dataset.go); return; }
    const a = e.target.closest('[data-a]'); if (a && act[a.dataset.a]) { act[a.dataset.a](a, e); }
  });
  document.addEventListener('change', e => { const a = e.target.closest('[data-set]'); if (a) setValue(a); if (e.target.id === 'impf' && e.target.files[0]) { const r = new FileReader(); r.onload = () => { try { F.importState(r.result); F.buildDB(); F.buildSeq(); F.toast('تمت استعادة النسخة ✓'); F.render(); } catch (x) { F.toast('هذا الملف ليس نسخة احتياطية صالحة'); } }; r.readAsText(e.target.files[0]); } });

  /* ---------- library ---------- */
  const cnt = (kinds) => { let n = 0, d = 0; kinds.forEach(k => { n += F.DB[k].length; d += (k === 'grammar' ? Object.keys(F.S.gram) : Object.keys(F.S.done[k] || {})).filter(id => id.slice(0, 2) !== 't:').length; }); return { n, d }; };
  routes.lib = () => {
    const st = F.stats();
    const tile = (go, ic, name, sub) => `<button class="tile" data-go="${go}"><span class="tic">${ic}</span><b>${name}</b><small>${sub}</small></button>`;
    const c = k => { const x = cnt(k); return `${x.d} / ${x.n}`; };
    return `<header class="top"><div><h1>المكتبة</h1><small>كل المحتوى مفتوح لك في أي وقت، خارج خطة اليوم</small></div></header><div class="tiles">
      ${tile('words', '🗂️', 'كلماتي', st.total + ' كلمة · ' + st.due + ' مستحقة')}
      ${tile('list/grammar', '🧩', 'القواعد', c(['grammar']))}
      ${tile('list/reading', '📖', 'القراءة', c(['reading']))}
      ${tile('list/listening', '🎧', 'الاستماع', c(['listening']))}
      ${tile('list/speaking', '🎙️', 'المحادثة والنطق', c(['shadow', 'pron', 'sp1', 'sp2', 'sp3']))}
      ${tile('list/writing', '✍️', 'الكتابة', c(['wlesson', 'wsent', 'w2', 'w1']))}
      ${tile('ielts', '🎯', 'ركن IELTS', 'أدلة، نتائج تجريبية، مصادر رسمية')}
      ${tile('phrases', '💬', 'عبارات جاهزة', F.DB.phrases.length + ' عبارة حسب الوظيفة')}
      ${tile('list/method', '🧠', 'كيف أحفظ وأدرس؟', 'خلاصة البحث العلمي')}
      ${tile('list/mission', '🌍', 'مهام الانغماس', 'استماع وقراءة خارج التطبيق')}</div>`;
  };
  const GROUPS = { grammar: ['grammar'], reading: ['reading'], listening: ['listening'], speaking: ['shadow', 'pron', 'sp1', 'sp2', 'sp3'], writing: ['wlesson', 'wsent', 'w2', 'w1'], method: ['guide'], mission: ['mission'] };
  const GT = { grammar: 'القواعد', reading: 'القراءة', listening: 'الاستماع', speaking: 'المحادثة والنطق', writing: 'الكتابة', method: 'كيف أحفظ وأدرس؟', mission: 'مهام الانغماس' };
  routes.list = p => {
    const g = p[0], kinds = GROUPS[g] || [], S = F.S;
    let html = `<header class="top"><div><button class="back" data-go="lib">‹ المكتبة</button><h1>${GT[g] || ''}</h1></div></header>`;
    kinds.forEach(k => {
      let items = F.DB[k]; if (g === 'method') items = items.filter(x => x.cat === 'method');
      if (!items.length) return;
      if (kinds.length > 1) html += `<h3 class="sec">${F.SK[k].ic} ${F.SK[k].n}</h3>`;
      html += '<div class="list">' + items.map(o => {
        const rec = k === 'grammar' ? S.gram[o.id] : (S.done[k] || {})[o.id], title = o.titleAr || o.title || o.topic || o.card || o.task || o.prompt || o.id, sub = (o.titleAr && o.title) ? o.title : '';
        const sc = rec && rec.score != null ? Math.round(rec.score * 100) + '%' : (rec ? '✓' : '›');
        return `<button class="li ${rec ? 'done' : ''}" data-a="open" data-k="${k}" data-id="${o.id}">${o.l ? `<em class="tag l${o.l}">${o.l}</em>` : ''}<span class="tb"><b ${F.dirAttr(title)}>${esc(String(title).slice(0, 90))}</b>${sub ? `<small class="en" dir="ltr">${esc(sub)}</small>` : ''}</span><span class="tr">${sc}</span></button>`;
      }).join('') + '</div>';
    });
    return html;
  };
  routes.phrases = () => {
    const FN = { opinion: 'إبداء الرأي', agree: 'الموافقة', disagree: 'الاعتراض', contrast: 'التضاد', addition: 'الإضافة', cause: 'السبب', result: 'النتيجة', example: 'التمثيل', hedge: 'التحفّظ الأكاديمي', trend: 'وصف الرسوم', compare: 'المقارنة', sequence: 'الترتيب', conclude: 'الخاتمة', clarify: 'طلب التوضيح', fillers: 'كسب الوقت في الكلام', email: 'الرسائل الرسمية', court: 'قاعة المحكمة', thesis: 'المذكرة والبحث', pitch: 'عرض المشروع', meeting: 'الاجتماعات' };
    const by = {}; F.DB.phrases.forEach(p => (by[p.fn] = by[p.fn] || []).push(p));
    return `<header class="top"><div><button class="back" data-go="lib">‹ المكتبة</button><h1>عبارات جاهزة</h1><small>اضغط 🔊 واحفظ العبارة كاملة كقطعة واحدة</small></div></header>` + Object.keys(by).map(fn => `<details class="acc"><summary>${FN[fn] || fn} <small>${by[fn].length}</small></summary>${by[fn].map(p => `<div class="phr"><div class="en" dir="ltr"><b>${esc(p.en)}</b> ${spk(p.ex, 'mini')}</div><div>${esc(p.ar)}</div><small class="en" dir="ltr">${esc(p.ex)}</small></div>`).join('')}</details>`).join('');
  };
  /* ---------- words ---------- */
  let wq = '', wf = 'all';
  const wordRows = () => {
    const S = F.S, today = dayNum(), q = F.norm(wq), qa = wq.trim();
    let ids = Object.keys(S.cards).filter(id => F.DB.byId[id]);
    if (wf === 'due') ids = ids.filter(id => S.cards[id].due <= today); if (wf === 'leech') ids = ids.filter(id => SRS.isLeech(S.cards[id])); if (wf === 'dom') ids = ids.filter(id => F.DB.byId[id].tr === 'd'); if (wf === 'mine') ids = ids.filter(id => F.DB.byId[id].tr === 'x');
    if (qa) ids = ids.filter(id => { const v = F.DB.byId[id]; return (q && F.norm(v.w).includes(q)) || v.ar.includes(qa); });
    ids.sort((a, b) => S.cards[a].due - S.cards[b].due);
    return `<div class="hint">${ids.length} كلمة</div><div class="list">` + ids.slice(0, 80).map(id => { const v = F.DB.byId[id], c = S.cards[id]; return `<button class="li" data-a="word" data-id="${esc(id)}"><i class="dot s${SRS.stage(c)}"></i><span class="tb"><b class="en" dir="ltr">${esc(v.w)}</b><small>${esc(v.ar)}</small></span><span class="tr">${c.due <= today ? 'الآن' : (c.due - today) + ' ي'}</span></button>`; }).join('') + '</div>' + (ids.length > 80 ? '<div class="hint">استعمل البحث لرؤية المزيد</div>' : '');
  };
  routes.words = () => `<header class="top"><div><button class="back" data-go="lib">‹ المكتبة</button><h1>كلماتي</h1></div><button class="btn ghost" data-a="addw">➕ كلمة</button></header>
    <input id="wq" class="inp" placeholder="ابحث بالإنجليزية أو العربية" value="${esc(wq)}"><div class="chipsrow">${[['all', 'الكل'], ['due', 'مستحقة'], ['leech', 'عنيدة'], ['dom', 'تخصصي'], ['mine', 'أضفتُها']].map(f => `<button class="chip ${wf === f[0] ? 'on' : ''}" data-wf="${f[0]}">${f[1]}</button>`).join('')}</div><div id="wl">${wordRows()}</div><div class="hint">● قيد التعلم  <i class="dot s1"></i> فتيّة  <i class="dot s2"></i> ناضجة (تتذكرها بعد 3 أسابيع فأكثر)</div>`;
  after.words = () => { $('#wq').oninput = e => { wq = e.target.value; $('#wl').innerHTML = wordRows(); }; $$('[data-wf]').forEach(b => b.onclick = () => { wf = b.dataset.wf; F.render(); }); };
  F.wordSheet = id => {
    const S = F.S, v = F.DB.byId[id], c = S.cards[id], today = dayNum(); if (!v) return;
    const s = F.sheet(F.vcard(v, { leech: c && SRS.isLeech(c) }) + (c ? `<div class="hint">المراجعة القادمة: ${c.due <= today ? 'اليوم' : 'بعد ' + (c.due - today) + ' يوماً'} · مرات المراجعة ${c.reps} · مرات النسيان ${c.laps}</div><div class="row"><button class="btn ghost off">${c.off ? 'أعدها إلى المراجعة' : 'أوقف مراجعتها'}</button><button class="btn ok">حفظ</button></div>` : `<div class="row"><button class="btn add">➕ أضفها إلى مراجعتي</button></div>`) + (F.tutor && F.tutor.requestSheet ? '<div class="row"><button class="btn ghost ask">🎓 اسأل المعلّم عن هذه الكلمة</button></div>' : ''));
    const sv = () => { const t = s.querySelector('.note'); if (t) { const x = t.value.trim(); if (x) S.notes[id] = x; else delete S.notes[id]; F.save(); } };
    const o = s.querySelector('.off'); if (o) o.onclick = () => { c.off = !c.off; if (!c.off) delete c.off; sv(); F.save(); F.closeSheet(); F.render(); };
    const k = s.querySelector('.ok'); if (k) k.onclick = () => { sv(); F.closeSheet(); };
    const a = s.querySelector('.add'); if (a) a.onclick = () => { sv(); SRS.create(id, 1); F.toast('أُضيفت إلى مراجعة الغد ✓'); F.closeSheet(); };
    const ak = s.querySelector('.ask'); if (ak) ak.onclick = () => { sv(); F.tutor.requestSheet('word', { id }); };
    if (F.S.set.auto) F.say(v.w);
  };
  F.wordPop = raw => { const v = F.lookup(raw); if (v) return F.wordSheet(v.id); const w = raw.replace(/[^A-Za-z'’-]/g, ''); const s = F.sheet(`<div class="vcard"><div class="vword"><span class="en" dir="ltr">${esc(w)}</span>${spk(w)}</div><div class="hint">هذه الكلمة ليست في قاموس التطبيق. إن كانت مهمة لك فأضفها مع معناها.</div></div><div class="row"><button class="btn add">➕ أضفها إلى كلماتي</button></div>`, 'small'); s.querySelector('.add').onclick = () => F.addWordSheet(w); F.say(w); };
  F.addWordSheet = pre => {
    const s = F.sheet(`<h3>كلمة جديدة من عندك</h3><div class="hint">الكلمات التي تلتقطها بنفسك من قراءتك واستماعك تُحفظ أسهل. تدخل في مراجعة الغد.</div><input class="inp en w1" dir="ltr" placeholder="English word or phrase" value="${esc(pre || '')}" autocapitalize="off"><input class="inp w2" placeholder="المعنى بالعربية"><input class="inp en w3" dir="ltr" placeholder="Example sentence (optional)"><div class="row"><button class="btn ok">أضف</button></div>`);
    s.querySelector('.ok').onclick = () => {
      const w = s.querySelector('.w1').value.trim(), ar = s.querySelector('.w2').value.trim(), ex = s.querySelector('.w3').value.trim();
      if (!w || !ar) return F.toast('اكتب الكلمة ومعناها');
      const id = 'x:' + w.toLowerCase();
      if (F.DB.byId[id] || F.DB.lemma[w.toLowerCase()]) { const ex0 = F.DB.byId[id] || F.DB.lemma[w.toLowerCase()]; if (!F.S.cards[ex0.id]) SRS.create(ex0.id, 1); F.toast('هذه الكلمة موجودة، وأضفتها إلى مراجعتك'); return F.closeSheet(); }
      const v = { id, w, p: / /.test(w) ? 'phr' : 'n', l: F.level(), t: 'misc', ar, ex: ex && ex.toLowerCase().includes(w.toLowerCase()) ? ex : w, x: w, tr: 'x' };
      F.S.custom.push(v); F.DB.byId[id] = v; F.DB.vocab.push(v); (F.DB.pos[v.p] = F.DB.pos[v.p] || []).push(v); if (!/ /.test(w)) F.DB.lemma[w.toLowerCase()] = v;
      SRS.create(id, 1); F.toast('أُضيفت ✓ ستراها في مراجعة الغد'); F.closeSheet(); if (!F.runner) F.render();
    };
  };

  /* ---------- journey ---------- */
  routes.journey = () => {
    const S = F.S, st = F.stats(), pc = F.pace(), n = S.day.n, today = dayNum();
    const tot = { A2: 0, B1: 0, B2: 0, C1: 0 }; F.DB.vocab.forEach(v => { if (tot[v.l] != null) tot[v.l]++; });
    let mins = 0; Object.keys(S.hist).forEach(k => mins += S.hist[k].min || 0);
    const heat = []; for (let i = 83; i >= 0; i--) { const dd = F.dayToDate(today - i), k = dd.getFullYear() + '-' + F.pad(dd.getMonth() + 1) + '-' + F.pad(dd.getDate()), m = (S.hist[k] || {}).min || 0; heat.push(`<i class="h${m <= 0 ? 0 : m < 15 ? 1 : m < 40 ? 2 : m < 75 ? 3 : 4}" title="${k}: ${Math.round(m)}"></i>`); }
    const fmax = Math.max(1, ...st.fore);
    return `<header class="top"><div><h1>الرحلة</h1><small>من <span dir="ltr">A2</span> إلى <span dir="ltr">C1</span> ثم <span dir="ltr">IELTS 7.0+</span></small></div></header>
      <section class="card"><div class="stats"><div><b>${st.total}</b><small>كلمة تعلمتها</small></div><div><b>${st.mature}</b><small>ناضجة</small></div><div><b>${st.ret == null ? '…' : st.ret + '%'}</b><small>نسبة التذكر</small></div><div><b>${S.daysDone}</b><small>يوم دراسي</small></div><div><b>${Math.round(mins / 60)}</b><small>ساعة دراسة</small></div><div><b>${S.streak.best}</b><small>أطول سلسلة</small></div></div></section>
      <h3 class="sec">خريطة الطريق (18 شهراً)</h3>${F.PHASES.map(p => { const done = Math.max(0, Math.min(1, (S.daysDone - p.from + 1) / (p.to - p.from + 1))); return `<section class="card phase ${n >= p.from && n <= p.to ? 'cur' : ''}"><div class="crow"><b>${p.id}. ${p.name} <em class="tag" dir="ltr">${p.lv}</em></b><span>من اليوم ${p.from} إلى ${p.to}</span></div>${bar(done * 100)}<small>${p.desc}</small></section>`; }).join('')}
      <section class="card"><b>الموعد المستهدف: ${dfmt(pc.target)}</b><small>بدأت في ${dfmt(pc.start)}. ${pc.proj ? 'بوتيرتك الحالية تنهي الخطة في ' + dfmt(pc.proj) + '.' : 'بعد 5 أيام دراسية سأحسب لك موعد الوصول المتوقع.'}</small></section>
      <h3 class="sec">المفردات حسب المستوى</h3><section class="card">${LVN.map(l => `<div class="crow"><b><em class="tag l${l}">${l}</em></b><span>${st.byL[l]} / ${tot[l]}</span></div>${bar(tot[l] ? 100 * st.byL[l] / tot[l] : 0)}`).join('')}<div class="crow"><b>مصطلحات تخصصك</b><span>${st.dom} / ${F.DB.tracks.d.length}</span></div>${bar(F.DB.tracks.d.length ? 100 * st.dom / F.DB.tracks.d.length : 0)}</section>
      <h3 class="sec">مراجعات الأيام السبعة القادمة</h3><section class="card"><div class="fore">${st.fore.map((x, i) => `<div><i style="height:${Math.round(60 * x / fmax) + 2}px"></i><small>${x}</small><small>+${i + 1}</small></div>`).join('')}</div></section>
      <h3 class="sec">نشاطك في 12 أسبوعاً</h3><section class="card"><div class="heat">${heat.join('')}</div></section>
      <h3 class="sec">الشارات</h3><div class="badges">${F.BADGES.map(b => `<div class="badge ${S.badges[b[0]] ? 'on' : ''}"><span>${b[1]}</span><b>${b[2]}</b><small>${b[3]}</small></div>`).join('')}</div>
      ${S.tests.length ? `<h3 class="sec">الاختبارات</h3><section class="card">${S.tests.slice(-8).reverse().map(t => `<div class="crow"><span>${t.big ? 'اختبار المرحلة' : 'اختبار الأسبوع'} · اليوم ${t.n}</span><b>${Math.round(t.score * 100)}%</b></div>`).join('')}</section>` : ''}`;
  };
  /* ---------- IELTS corner ---------- */
  const mockSheet = () => {
    const f = n => `<label>${n}<select class="inp m${n}">${[4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map(b => `<option ${b === 6 ? 'selected' : ''}>${b}</option>`).join('')}</select></label>`;
    const s = F.sheet(`<h3>سجّل نتيجة اختبار تجريبي</h3><div class="hint">بعد كل اختبار تجريبي رسمي كامل سجّل درجاتك هنا لتتابع اقترابك من 7.0. للكتابة والمحادثة استعمل تقدير Claude أو معلمك.</div><div class="grid4">${['L', 'R', 'W', 'S'].map(f).join('')}</div><div class="row"><button class="btn ok">حفظ</button></div>`);
    s.querySelector('.ok').onclick = () => { const v = ['L', 'R', 'W', 'S'].map(n => +s.querySelector('.m' + n).value), avg = v.reduce((a, b) => a + b, 0) / 4, ov = Math.floor(avg * 2 + 0.5) / 2; F.S.mocks.push({ day: dayNum(), L: v[0], R: v[1], W: v[2], S: v[3], o: ov }); F.save(); F.closeSheet(); F.render(); };
  };
  routes.ielts = () => {
    const S = F.S, gi = F.DB.guide.filter(g => g.cat === 'ielts'), last = S.mocks[S.mocks.length - 1];
    const link = (t, u, sub) => `<button class="li" data-a="url" data-u="${u}"><span class="tb"><b>${t}</b><small>${sub}</small></span><span class="tr">↗</span></button>`;
    return `<header class="top"><div><button class="back" data-go="lib">‹ المكتبة</button><h1>ركن <span dir="ltr">IELTS</span></h1><small><span dir="ltr">Academic</span> · الهدف 7.0 فأكثر (عتبة <span dir="ltr">C1</span>)</small></div></header>
      <section class="card"><div class="crow"><b>آخر نتيجة تجريبية</b><span>${last ? last.o : 'لا يوجد'}</span></div>${last ? `<small>L ${last.L} · R ${last.R} · W ${last.W} · S ${last.S}</small>` : '<small>أول اختبار تجريبي كامل يُنصح به عند دخول مرحلة B2.</small>'}${S.mocks.length > 1 ? `<div class="fore">${S.mocks.slice(-8).map(m => `<div><i style="height:${Math.round((m.o - 3) * 12)}px"></i><small>${m.o}</small></div>`).join('')}</div>` : ''}<button class="btn ghost" data-a="mock">➕ سجّل نتيجة</button></section>
      <section class="card note"><b>للتذكير</b><div>الاستماع والقراءة: نحو 30 إجابة صحيحة من 40 تعطي تقريباً 7.0 (يختلف قليلاً من اختبار لآخر). الاختبار في الجزائر على الحاسوب عبر المجلس الثقافي البريطاني: تأكد من المركز والرسوم والمواعيد من الموقع الرسمي قبل الحجز.</div></section>
      <h3 class="sec">أدلة الاختبار</h3><div class="list">${gi.map(o => { const rec = (S.done.guide || {})[o.id]; return `<button class="li ${rec ? 'done' : ''}" data-a="open" data-k="guide" data-id="${o.id}"><span class="tb"><b>${esc(o.titleAr)}</b></span><span class="tr">${rec ? '✓' : '›'}</span></button>`; }).join('')}</div>
      <h3 class="sec">مصادر رسمية مجانية</h3><div class="list">
        ${link('اختبارات تجريبية مجانية (Academic)', 'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests/academic', 'British Council: استماع، قراءة، كتابة، محادثة')}
        ${link('حجز الاختبار والمواعيد والرسوم', 'https://takeielts.britishcouncil.org/book-ielts-test/test-dates-fees-locations', 'British Council')}
        ${link('معايير تقييم الكتابة (PDF)', 'https://ielts.org/cdn/ielts-downloadable-assets/ielts-guidance-and-support/ielts-guides/ielts-writing-band-descriptors.pdf', 'ielts.org')}
        ${link('معايير تقييم المحادثة (PDF)', 'https://ielts.org/cdn/ielts-downloadable-assets/ielts-guidance-and-support/ielts-guides/ielts-speaking-band-descriptors.pdf', 'ielts.org')}
        ${link('شكل الاختبار', 'https://takeielts.britishcouncil.org/take-ielts/ielts-test-format', 'British Council')}</div>`;
  };
  /* ---------- settings ---------- */
  /* one place that changes a setting (settings page and tutor packs). quiet: do not re-render */
  F.applySetting = (k, raw, quiet) => {
    const S = F.S, num = ['dailyMin', 'newPerDay', 'domain', 'rate', 'retention', 'nagEvery'].includes(k) ? +raw : raw;
    if (k === 'name') S.name = String(raw).trim().slice(0, 30);
    else if (k === 'target') { const d = new Date(raw + 'T12:00:00'); if (!isNaN(d)) S.target = dayNum(d.getTime()); }
    else if (k.startsWith('time')) S.set.rem.times[+k.slice(4)] = raw;
    else if (['on', 'nagFrom', 'nagUntil', 'nagEvery'].includes(k)) S.set.rem[k] = k === 'nagEvery' ? num : raw;
    else S.set[k] = num;
    if (k === 'dailyMin') { S.set.newPerDay = { 30: 5, 45: 7, 60: 8, 75: 10, 90: 12, 120: 14 }[num] || 10; const lt = S.day && S.day.tasks.find(t => t.t === 'learn'); if (lt && !lt.done && !S.day.light) lt.n = Math.max(lt.got || 0, S.set.newPerDay); }
    if (k === 'newPerDay') { const lt = S.day && S.day.tasks.find(t => t.t === 'learn'); if (lt && !lt.done && !S.day.light) lt.n = Math.max(lt.got || 1, num); }
    F.save(); if (k === 'theme') applyTheme(); F.syncRem();
    if (!quiet && ['dailyMin', 'theme', 'calm', 'on'].includes(k)) F.render();
  };
  const setValue = el => F.applySetting(el.dataset.set, el.type === 'checkbox' ? el.checked : el.value);
  const sel = (k, cur, opts) => `<select class="inp" data-set="${k}">${opts.map(o => `<option value="${o[0]}" ${String(o[0]) === String(cur) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  const tog = (k, cur) => `<label class="sw"><input type="checkbox" data-set="${k}" ${cur ? 'checked' : ''}><i></i></label>`;
  routes.me = () => {
    const S = F.S, s = S.set, r = s.rem, rs = F.isApp ? F.remState() : {}, td = F.dayToDate(S.target || dayNum() + 548), tds = td.getFullYear() + '-' + F.pad(td.getMonth() + 1) + '-' + F.pad(td.getDate());
    const row = (l, c, sub) => `<div class="srow"><div><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</div><div>${c}</div></div>`;
    let ver = ''; try { ver = F.isApp ? String(F.nat('version') || '').split('|')[0] : 'web'; } catch (e) { ver = ''; }
    return `<header class="top"><div><h1>أنا والإعدادات</h1></div></header>
      <section class="card">${row('الاسم', `<input class="inp" data-set="name" value="${esc(S.name)}" placeholder="اسمك">`)}
        ${row('وقت الدراسة اليومي', sel('dailyMin', s.dailyMin, [[30, '30 دقيقة'], [45, '45 دقيقة'], [60, '60 دقيقة'], [75, '75 دقيقة (موصى به)'], [90, '90 دقيقة'], [120, 'ساعتان']]), 'الوصول إلى C1 في 18 شهراً يحتاج نحو 70 إلى 80 دقيقة يومياً')}
        ${row('كلمات جديدة في اليوم', sel('newPerDay', s.newPerDay, [3, 5, 7, 8, 10, 12, 14, 16, 20].map(x => [x, x])), 'الكلمات التي تعرفها مسبقاً لا تُحسب')}
        ${row('نسبة مصطلحات تخصصك', sel('domain', s.domain, [[10, '10%'], [20, '20%'], [30, '30%'], [40, '40%']]), 'قانون، مكافحة فساد، ذكاء اصطناعي، بحث علمي')}
        ${row('وتيرة المراجعة', sel('retention', s.retention, [[0.85, 'مخففة (مراجعات أقل)'], [0.9, 'متوازنة'], [0.93, 'مكثفة (أنسى بسرعة)']]), 'يعدّل التطبيق الفواصل تلقائياً حسب نتائجك')}
        ${row('الموعد المستهدف', `<input class="inp" type="date" data-set="target" value="${tds}">`)}</section>
      <h3 class="sec">الصوت</h3><section class="card">${row('اللهجة', sel('accent', s.accent, [['en-GB', 'بريطانية'], ['en-US', 'أمريكية'], ['en-AU', 'أسترالية']]))}${row('سرعة النطق', sel('rate', s.rate, [[0.8, 'بطيئة'], [0.9, 'أهدأ قليلاً'], [1, 'عادية'], [1.1, 'أسرع']]))}${row('نطق تلقائي للكلمات', tog('auto', s.auto))}${row('مؤثرات صوتية', tog('sound', s.sound))}</section>
      <h3 class="sec">التنبيهات</h3><section class="card">${row('تنبيهات الدراسة', tog('on', r.on), 'تتكرر حتى تُنهي مهمة اليوم ثم تتوقف')}
        ${r.on ? row('مواعيد التذكير', [0, 1, 2].map(i => `<input class="inp tm" type="time" data-set="time${i}" value="${r.times[i] || ''}">`).join('')) + row('الإلحاح المسائي', `من <input class="inp tm" type="time" data-set="nagFrom" value="${r.nagFrom}"> إلى <input class="inp tm" type="time" data-set="nagUntil" value="${r.nagUntil}">`, 'إن لم تُنهِ مهمتك بعد') + row('كل', sel('nagEvery', r.nagEvery, [[15, '15 دقيقة'], [30, '30 دقيقة'], [45, '45 دقيقة'], [60, 'ساعة']])) : ''}
        ${F.isApp ? `<div class="perm"><div class="${rs.notifAllowed ? 'okk' : 'bad'}">${rs.notifAllowed ? '✓ الإشعارات مسموحة' : '✗ الإشعارات غير مسموحة'} ${rs.notifAllowed ? '' : '<button class="btn ghost" data-a="perm" data-k="notif">اسمح</button>'}</div><div class="${rs.batteryIgnored ? 'okk' : 'bad'}">${rs.batteryIgnored ? '✓ مستثنى من توفير البطارية' : '✗ قد يوقف الهاتف التنبيهات لتوفير البطارية'} ${rs.batteryIgnored ? '' : '<button class="btn ghost" data-a="perm" data-k="batt">استثنِ التطبيق</button>'}</div><div class="row"><button class="btn ghost" data-a="perm" data-k="test">جرّب تنبيهاً الآن</button><button class="btn ghost" data-a="perm" data-k="nset">إعدادات الإشعارات</button></div>${rs.next ? `<small>التنبيه القادم: ${new Date(rs.next).toLocaleString('ar-DZ', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</small>` : ''}</div>` : '<small>التنبيهات تعمل داخل تطبيق الهاتف.</small>'}</section>
      <h3 class="sec">المظهر</h3><section class="card">${row('السمة', sel('theme', s.theme, [['auto', 'تلقائية'], ['light', 'فاتحة'], ['dark', 'داكنة']]))}${row('وضع هادئ', tog('calm', s.calm), 'إخفاء النقاط والمستويات والتركيز على التعلم')}</section>
      <h3 class="sec">بياناتك</h3><section class="card"><div class="row"><button class="btn ghost" data-a="exp">⬇️ نسخة احتياطية</button><button class="btn ghost" data-a="imp">⬆️ استعادة</button></div><input type="file" id="impf" accept=".json,application/json" hidden><small>تقدمك محفوظ داخل الهاتف فقط. خذ نسخة احتياطية كل شهر أو قبل تغيير الهاتف.</small><div class="row"><button class="btn ghost" data-a="place">أعد اختبار تحديد المستوى</button><button class="btn ghost danger" data-a="reset">حذف كل التقدم</button></div></section>
      <div class="hint">فصيح ${esc(ver)} · ${F.DB.vocab.length} كلمة · ${F.DB.grammar.length} وحدة قواعد · ${F.DB.reading.length} نص · ${F.DB.listening.length} تسجيل</div>`;
  };

  /* ---------- onboarding ---------- */
  let ob = 0; const obd = { min: 75, ret: 0.93, t1: '07:30', t2: '21:00', cue: '' };
  const placeResult = res => {
    const S = F.S, p = res.v.map((x, i) => res.vn[i] ? x / res.vn[i] : 0); let est = 'A2';
    if (p[0] >= 0.8 && p[1] >= 0.6) est = 'B1'; if (est === 'B1' && p[2] >= 0.6) est = 'B2'; if (est === 'B2' && p[3] >= 0.6) est = 'C1';
    S.place = { day: dayNum(), v: res.v, g: res.g, gn: res.gn, est }; F.save(); F.render();
    F.sheet(`<div class="sum"><div class="sumic">📍</div><h2>نقطة البداية: ${est === 'A2' ? 'A2' : 'A2+ / ' + est}</h2>${LVN.map((l, i) => `<div class="suml">كلمات ${l}: <b>${res.v[i]} / ${res.vn[i]}</b></div>`).join('')}<div class="suml">القواعد: <b>${res.g} / ${res.gn}</b></div><div class="suml">يبدأ البرنامج من كلمات A2 ويتخطى سريعاً ما تعرفه: كل كلمة جديدة يسبقها سؤال، فإن عرفتها انتقلنا إلى غيرها.</div><button class="btn big">إلى خطة اليوم</button></div>`, 'small').querySelector('.btn.big').onclick = F.closeSheet;
  };
  const onboard = () => {
    const S = F.S, opt = (k, v, t, sub) => `<button class="pick ${obd[k] === v ? 'on' : ''}" data-ob="${k}" data-v="${v}"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
    const pages = [
      `<div class="obl">F<span>C1</span></div><h1>فصيح</h1><p>برنامجك اليومي من <b dir="ltr">A2</b> إلى <b dir="ltr">C1</b> ثم <b dir="ltr">IELTS 7.0+</b> في 18 شهراً، مع لغة القانون ومكافحة الفساد والذكاء الاصطناعي التي تحتاجها لمشروعك ودكتوراهك.</p><div class="obp">🧠 مراجعة متباعدة تختار لك ما تراجعه في اللحظة المناسبة</div><div class="obp">📅 خطة مرنة: إن فاتك يوم تكمل من حيث توقفت</div><div class="obp">🔔 تنبيهات تتكرر حتى تُنهي مهمة اليوم</div><div class="obp">🎓 معلّم ذكي عند الطلب: Claude أو ChatGPT أو Gemini أو Grok</div><div class="obp">📴 الدروس والمراجعة تعمل بلا إنترنت</div>`,
      `<h2>لنتعارف</h2><label class="obf">اسمك<input class="inp" id="obn" value="${esc(S.name)}" placeholder="الاسم"></label><h3>كم دقيقة تستطيع يومياً؟</h3><div class="picks">${opt('min', 30, '30 د', 'الحد الأدنى')}${opt('min', 45, '45 د')}${opt('min', 60, '60 د')}${opt('min', 75, '75 د', 'موصى به')}${opt('min', 90, '90 د', 'أسرع')}${opt('min', 120, 'ساعتان')}</div><p class="hint">بصراحة: الانتقال من A2 إلى C1 يحتاج نحو 500 إلى 600 ساعة دراسة، أي 70 إلى 80 دقيقة يومياً على 18 شهراً. بأقل من ذلك ستصل أيضاً، لكن في مدة أطول.</p>`,
      `<h2>كيف تصف حفظك للكلمات؟</h2><div class="picks col">${opt('ret', 0.93, 'أنسى بسرعة وأحتاج تكراراً أكثر', 'مراجعات أكثر بفواصل أقصر')}${opt('ret', 0.9, 'عادي', 'الإعداد المتوازن')}${opt('ret', 0.85, 'أحفظ بسهولة', 'مراجعات أقل')}</div><p class="hint">لا يوجد «رأس ثقيل»: الفرق تصنعه الطريقة. ستُختبر في كل كلمة بدل إعادة قراءتها، وتعود إليك قبيل أن تنساها. ثم يضبط التطبيق الفواصل وحده حسب نتائجك الفعلية.</p>`,
      `<h2>متى ستدرس؟</h2><p>الخطة المحددة مسبقاً «إذا حدث كذا فسأدرس» تضاعف فرص الالتزام.</p><label class="obf">جلسة الصباح (مراجعة سريعة)<input class="inp" type="time" id="obt1" value="${obd.t1}"></label><label class="obf">جلسة المساء (الكلمات الجديدة وبقية المهام)<input class="inp" type="time" id="obt2" value="${obd.t2}"></label><label class="obf">أكمل الجملة: «إذا … فسأفتح فصيح»<input class="inp" id="obc" value="${esc(obd.cue)}" placeholder="مثال: إذا أنهيت قهوة الصباح"></label><p class="hint">الأفضل للذاكرة: الكلمات الجديدة مساءً، ثم مراجعتها في الصباح بعد النوم.</p>`,
      `<h2>التنبيهات</h2><p>سيذكّرك فصيح في المواعيد التي اخترتها، ثم يلحّ عليك مساءً كل نصف ساعة حتى تُنهي مهمة اليوم، ويتوقف فور إنهائها.</p>${F.isApp ? '<button class="btn big" data-a="perm" data-k="notif">🔔 اسمح بالإشعارات</button><button class="btn ghost" data-a="perm" data-k="batt">🔋 استثنِ التطبيق من توفير البطارية (مهم لوصول التنبيهات)</button>' : '<p class="hint">التنبيهات تعمل داخل تطبيق الهاتف.</p>'}`,
      `<h2>جاهز؟</h2><p>اختبار قصير (4 دقائق) يحدد من أين تبدأ. يمكنك تخطيه والبدء مباشرة.</p><button class="btn big" id="obpl">ابدأ باختبار تحديد المستوى</button><button class="btn ghost" id="obsk">تخطَّ وابدأ اليوم الأول</button>`,
    ];
    app().innerHTML = `<div class="ob"><div class="obdots">${pages.map((_, i) => `<i class="${i === ob ? 'on' : ''}"></i>`).join('')}</div><div class="obpage">${pages[ob]}</div>${ob < pages.length - 1 ? `<div class="row obnav">${ob ? '<button class="btn ghost" id="obb">رجوع</button>' : ''}<button class="btn big" id="obx">${ob ? 'التالي' : 'هيا نبدأ'}</button></div>` : ''}</div>`;
    const grab = () => { const n = $('#obn'); if (n) S.name = n.value.trim().slice(0, 30); const a = $('#obt1'), b = $('#obt2'), c = $('#obc'); if (a) obd.t1 = a.value || obd.t1; if (b) obd.t2 = b.value || obd.t2; if (c) obd.cue = c.value.trim(); };
    $$('[data-ob]').forEach(b => b.onclick = () => { grab(); obd[b.dataset.ob] = +b.dataset.v; onboard(); });
    const fin = place => {
      grab(); const s = S.set;
      s.dailyMin = obd.min; s.newPerDay = { 30: 5, 45: 7, 60: 8, 75: 10, 90: 12, 120: 14 }[obd.min]; s.retention = obd.ret; S.cue = obd.cue;
      const add = (t, m) => { const [h, mi] = t.split(':').map(Number), x = (h * 60 + mi + m + 1440) % 1440; return F.pad(Math.floor(x / 60)) + ':' + F.pad(x % 60); };
      s.rem = { on: true, times: [obd.t1, '13:00', obd.t2].sort(), nagFrom: add(obd.t2, 30), nagEvery: 30, nagUntil: '23:30' };
      if (s.rem.nagFrom > s.rem.nagUntil || s.rem.nagFrom < '12:00') s.rem.nagFrom = '21:30';
      S.onboard = true; S.start = dayNum(); S.target = S.start + 548; S.mod = 1;
      F.ensureDay(); F.syncRem(); F.flush(); location.hash = '#/home';
      if (place) F.flows.placement((f, res) => { if (f) placeResult(res); else F.render(); }); else F.render();
    };
    const x = $('#obx'); if (x) x.onclick = () => { grab(); ob++; onboard(); };
    const bk = $('#obb'); if (bk) bk.onclick = () => { grab(); ob--; onboard(); };
    const pl = $('#obpl'); if (pl) pl.onclick = () => fin(true);
    const sk = $('#obsk'); if (sk) sk.onclick = () => fin(false);
  };
  F.onPerm = () => { if (!F.runner && F.S.onboard) F.render(); };

  /* ---------- Android back button ---------- */
  F.onBack = () => {
    if (F.closeSheet()) return true;
    if (F.runner) { F.runner.askClose(); return true; }
    if (!F.S.onboard) { if (ob > 0) { ob--; onboard(); return true; } return false; }
    const hs = (location.hash || '#/home').slice(2).split('/'), h = hs[0];
    if (h === 'tutor' && hs[1]) { F.go('tutor'); return true; }
    if (h && h !== 'home') { F.go(['list', 'words', 'ielts', 'phrases'].includes(h) ? 'lib' : 'home'); return true; }
    return false;
  };
  F.on('launch', () => { if (!F.runner && F.S.onboard) { F.go('home'); } });

  /* ---------- start ---------- */
  F.init = () => {
    F.load(); F.buildDB(); F.buildSeq(); applyTheme();
    const S = F.S;
    if (S.onboard) { F.ensureDay(); F.checkDay(); F.syncRem(); }
    S.lastOpen = now(); F.save();
    F.render();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && F.S.onboard && !F.runner && !F._sheet) { const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return; F.ensureDay(); F.checkDay(); F.render(); } });
    setTimeout(() => { const sp = $('#splash'); if (sp) sp.remove(); }, 50);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', F.init); else F.init();
})(window.Fasih);

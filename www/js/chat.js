'use strict';
/* Fasih chat: in-app AI chat with the learner's own API key (see CHAT_SPEC.md) */
(function (F) {
  const esc = F.esc;
  const PATHRE = /^\/v1(beta)?\/[A-Za-z0-9_.:/-]+(\?[A-Za-z0-9_=&.-]*)?$/;
  const NAMES = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini', grok: 'Grok' };
  const CONSOLES = {
    claude: 'https://platform.claude.com/settings/keys',
    chatgpt: 'https://platform.openai.com/api-keys',
    gemini: 'https://aistudio.google.com/apikey',
    grok: 'https://console.x.ai/',
  };
  const ORDER = ['claude', 'chatgpt', 'gemini', 'grok'];
  const nameOf = p => { const a = (F.AIS || []).find(x => x.k === p); return (a && a.n) || NAMES[p] || p; };
  const T_NOAPP = 'وضع API متاح في تطبيق الأندرويد فقط.';
  const FALLBACK_SYS = 'You are a personal English tutor for an Arabic speaker who is aiming for CEFR C1 and IELTS 7. Explain in simple Modern Standard Arabic and give examples in English. Correct mistakes honestly and kindly, always showing the corrected sentence. Keep answers short and practical.';

  /* ---------- provider adapters ---------- */
  const BAD = /embed|tts|whisper|audio|realtime|transcribe|moderation|image|dall-e|imagen|veo|sora|aqa|computer-use|-instruct|davinci|babbage|search-preview|gemini-embedding|learnlm/i;
  const okId = (id, gem) => typeof id === 'string' && id.length > 0 && id.length <= 120 && !id.includes('..') && (gem ? /^[A-Za-z0-9_.-]+$/ : /^[A-Za-z0-9_.:/-]+$/).test(id);
  const badModel = () => { const e = new Error('bad-model'); e.code = 'bad-model'; return e; };
  const sortModels = a => a.sort((x, y) => ((y.at || 0) - (x.at || 0)) || (x.id < y.id ? 1 : x.id > y.id ? -1 : 0));
  const arr = x => (Array.isArray(x) ? x : []);
  const errMsg = o => {
    if (Array.isArray(o)) o = o[0];
    if (!o || typeof o !== 'object' || o.error == null) return null;
    const e = o.error;
    if (typeof e === 'string') return e;
    return String((e && (e.message || e.type || e.status)) || 'error');
  };
  const IMG = id => '@@IMG:' + id + '@@';
  const oaDelta = o => {
    const c = o && o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(x => (x && typeof x.text === 'string' ? x.text : '')).join('');
    return '';
  };
  const oaChat = {
    build(model, system, msgs) {
      if (!okId(model)) throw badModel();
      const messages = [];
      if (system) messages.push({ role: 'system', content: system });
      msgs.forEach(m => {
        if (m.img) {
          const parts = [];
          if (m.text) parts.push({ type: 'text', text: m.text });
          parts.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + IMG(m.img) } });
          messages.push({ role: m.role, content: parts });
        } else messages.push({ role: m.role, content: m.text });
      });
      return { path: '/v1/chat/completions', body: JSON.stringify({ model, stream: true, messages }) };
    },
    delta: oaDelta,
    error: errMsg,
  };
  const oaModels = {
    path: '/v1/models',
    parse(j) {
      const out = [];
      arr(j && j.data).forEach(m => {
        if (!m || typeof m.id !== 'string' || BAD.test(m.id)) return;
        out.push({ id: m.id, name: m.id, at: typeof m.created === 'number' ? m.created * 1000 : 0 });
      });
      return sortModels(out);
    },
  };
  const providers = {
    claude: {
      models: {
        path: '/v1/models?limit=100',
        parse(j) {
          const out = [];
          arr(j && j.data).forEach(m => {
            if (!m || typeof m.id !== 'string' || BAD.test(m.id)) return;
            out.push({ id: m.id, name: m.display_name || m.id, at: Date.parse(m.created_at) || 0 });
          });
          return sortModels(out);
        },
      },
      chat: {
        build(model, system, msgs) {
          if (!okId(model)) throw badModel();
          const messages = msgs.map(m => {
            const content = [];
            if (m.text) content.push({ type: 'text', text: m.text });
            if (m.img) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: IMG(m.img) } });
            return { role: m.role, content };
          });
          const b = { model, max_tokens: 4096, stream: true, messages };
          if (system) b.system = system;
          return { path: '/v1/messages', body: JSON.stringify(b) };
        },
        delta(o) { return o && o.type === 'content_block_delta' && o.delta && o.delta.type === 'text_delta' && typeof o.delta.text === 'string' ? o.delta.text : ''; },
        error(o) { return o && o.type === 'error' ? String((o.error && o.error.message) || 'error') : errMsg(o); },
      },
    },
    chatgpt: { models: oaModels, chat: oaChat },
    grok: { models: oaModels, chat: oaChat },
    gemini: {
      models: {
        path: '/v1beta/models?pageSize=200',
        parse(j) {
          const out = [];
          arr(j && j.models).forEach(m => {
            if (!m || typeof m.name !== 'string') return;
            if (!arr(m.supportedGenerationMethods).includes('generateContent')) return;
            const id = m.name.replace(/^models\//, '');
            if (BAD.test(id)) return;
            out.push({ id, name: m.displayName || id, at: 0 });
          });
          return sortModels(out);
        },
      },
      chat: {
        build(model, system, msgs) {
          if (!okId(model, true)) throw badModel();
          const path = '/v1beta/models/' + model + ':streamGenerateContent?alt=sse';
          if (!PATHRE.test(path)) throw badModel();
          const contents = msgs.map(m => {
            const parts = [];
            if (m.text) parts.push({ text: m.text });
            if (m.img) parts.push({ inline_data: { mime_type: 'image/jpeg', data: IMG(m.img) } });
            return { role: m.role === 'assistant' ? 'model' : 'user', parts };
          });
          const b = { contents };
          if (system) b.system_instruction = { parts: [{ text: system }] };
          return { path, body: JSON.stringify(b) };
        },
        delta(o) {
          const c = o && o.candidates && o.candidates[0] && o.candidates[0].content;
          return arr(c && c.parts).map(p => (p && typeof p.text === 'string' && !p.thought ? p.text : '')).join('');
        },
        error(o) {
          const e = errMsg(o);
          if (e) return e;
          const br = o && o.promptFeedback && o.promptFeedback.blockReason;
          return br ? 'Prompt blocked: ' + br : null;
        },
      },
    },
  };

  /* ---------- native transport ---------- */
  const reqs = {}; let seq = 0;
  const defTransport = {
    ok() { return !!F.isApp; },
    keys() { try { const j = JSON.parse(F.nat('aiKeys') || '{}'); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } },
    askKey(p) { F.nat('askAiKey', p); },
    http(req, h) {
      const id = 'h' + (++seq) + '_' + Date.now().toString(36);
      reqs[id] = h || {};
      F.nat('aiHttp', JSON.stringify({ id, p: req.p, method: req.method || 'GET', path: req.path, body: req.body, stream: !!req.stream }));
      return () => { delete reqs[id]; F.nat('aiHttpCancel', id); };
    },
  };
  F.on('http', d => {
    const h = reqs[d.id]; if (!h) return;
    if (d.ev === 'open') h.open && h.open(d.status);
    else if (d.ev === 'data') h.data && h.data(d.text || '');
    else if (d.ev === 'done') { delete reqs[d.id]; h.done && h.done(); }
    else if (d.ev === 'error') { delete reqs[d.id]; h.error && h.error(d.status | 0, String(d.body || '')); }
  });
  F.on('aikey', d => { if (F.chat && F.chat.onKey) F.chat.onKey(d); });

  /* ---------- state ---------- */
  const st = () => {
    const S = F.S, C = (S.chat = S.chat && typeof S.chat === 'object' ? S.chat : {});
    if (!C.model || typeof C.model !== 'object') C.model = {};
    if (!Array.isArray(C.convs)) C.convs = [];
    if (C.cur === undefined) C.cur = null;
    return C;
  };
  const prov = () => { const a = F.S && F.S.tutor && F.S.tutor.ai; return providers[a] ? a : 'claude'; };
  const T = () => F.chat.transport;
  const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nowT = () => (F.now ? F.now() : Date.now());
  const findConv = id => st().convs.find(c => c.id === id) || null;
  const csize = c => (c.sys || '').length + (c.title || '').length + c.msgs.reduce((a, m) => a + (m.text || '').length, 0);
  const trim = () => {
    const C = st(), cur = C.cur;
    C.convs.forEach(c => { while (c.msgs.length > 80) c.msgs.splice(1, 1); });
    const dropOld = () => { for (let i = C.convs.length - 1; i >= 0; i--) if (C.convs[i].id !== cur) { C.convs.splice(i, 1); return true; } return false; };
    while (C.convs.length > 12 && dropOld());
    let tot = C.convs.reduce((a, c) => a + csize(c), 0);
    while (tot > 400000 && C.convs.length > 1 && dropOld()) tot = C.convs.reduce((a, c) => a + csize(c), 0);
    const c = findConv(cur);
    while (c && tot > 400000 && c.msgs.length > 2) { c.msgs.splice(1, 1); tot = C.convs.reduce((a, x) => a + csize(x), 0); }
  };
  const commit = () => { trim(); F.save(); };
  const sysFree = () => { try { if (F.tutor && typeof F.tutor.system === 'function') { const s = F.tutor.system(); if (s && typeof s === 'string') return s; } } catch (e) { /* tutor module unfinished */ } return FALLBACK_SYS; };

  /* ---------- markdown (safe) ---------- */
  const inline = raw => {
    const e = esc(raw);
    return e.split(/(`[^`\n]+`)/).map((seg, i) => {
      if (i % 2) return '<code>' + seg.slice(1, -1) + '</code>';
      return seg
        .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
        .replace(/\*\*([^\n]+?)\*\*/g, '<b>$1</b>')
        .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1<i>$2</i>');
    }).join('');
  };
  const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
  const md = text => {
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    const out = []; let i = 0, para = [], list = null, tbl = [];
    const flushP = () => { if (para.length) { out.push('<p dir="auto">' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushL = () => { if (list) { out.push('<' + list.t + ' dir="auto">' + list.items.map(x => '<li dir="auto">' + inline(x) + '</li>').join('') + '</' + list.t + '>'); list = null; } };
    const flushT = () => { if (tbl.length) { out.push('<pre class="mdt" dir="ltr">' + esc(tbl.join('\n')) + '</pre>'); tbl = []; } };
    const flush = () => { flushP(); flushL(); flushT(); };
    while (i < lines.length) {
      const ln = lines[i], fm = FENCE.exec(ln);
      if (fm) {
        flush();
        const mk = fm[1], body = []; i++;
        while (i < lines.length) {
          const m2 = FENCE.exec(lines[i]);
          if (m2 && m2[1][0] === mk[0] && m2[1].length >= mk.length && /^\s*$/.test(lines[i].slice(m2[0].length))) break;
          body.push(lines[i]); i++;
        }
        i++;
        out.push('<pre class="code" dir="ltr"><code>' + esc(body.join('\n')) + '</code></pre>');
        continue;
      }
      i++;
      if (/^\s*$/.test(ln)) { flush(); continue; }
      let m;
      if ((m = /^\s{0,3}#{1,6}\s+(.*)$/.exec(ln))) { flush(); out.push('<p class="mh" dir="auto"><b>' + inline(m[1].replace(/\s+#+\s*$/, '')) + '</b></p>'); continue; }
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(ln)) { flush(); out.push('<hr>'); continue; }
      if (/^\s*\|/.test(ln)) { flushP(); flushL(); tbl.push(ln); continue; }
      if ((m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(ln))) {
        flushP(); flushT();
        const t = /\d/.test(m[1]) ? 'ol' : 'ul';
        if (list && list.t !== t) flushL();
        if (!list) list = { t, items: [] };
        list.items.push(m[2]); continue;
      }
      flushL(); flushT(); para.push(ln);
    }
    flush();
    return out.join('');
  };

  /* fenced blocks with offsets (used to find and hide Fasih packs) */
  const scanFences = t => {
    const out = []; let pos = 0, cur = null;
    t.split('\n').forEach(ln => {
      const end = pos + ln.length, m = FENCE.exec(ln);
      if (!cur) { if (m) cur = { start: pos, mk: m[1], bs: end + 1 }; }
      else if (m && m[1][0] === cur.mk[0] && m[1].length >= cur.mk.length && /^\s*$/.test(ln.slice(m[0].length))) {
        cur.end = end; cur.body = t.slice(cur.bs, Math.max(cur.bs, pos - 1)); cur.closed = true; out.push(cur); cur = null;
      }
      pos = end + 1;
    });
    if (cur) { cur.end = t.length; cur.body = t.slice(cur.bs); cur.closed = false; out.push(cur); }
    return out;
  };
  const hasPackMark = b => /"fasih"/.test(b);
  const stripPack = t => {
    const f = scanFences(t).find(x => x.closed && hasPackMark(x.body));
    if (!f) return t;
    return (t.slice(0, f.start).replace(/\s+$/, '') + '\n\n' + t.slice(f.end + 1).replace(/^\s+/, '')).replace(/^\s+|\s+$/g, '');
  };
  const hideLive = t => {
    let res = t;
    scanFences(t).reverse().forEach(f => {
      const b = f.body.replace(/\s/g, '');
      const hit = hasPackMark(f.body) || (!f.closed && b.length > 0 && '{"fasih"'.startsWith(b));
      if (hit) res = res.slice(0, f.start) + '\n\n*… يجهّز المعلّم حزمة فصيح*\n\n' + (f.closed ? res.slice(Math.min(res.length, f.end + 1)) : '');
    });
    return res;
  };
  const packCache = new WeakMap();
  const packOf = m => {
    if (!m || m.role !== 'assistant' || !m.text || !hasPackMark(m.text)) return null;
    const c = packCache.get(m);
    if (c && c.t === m.text) return c.p;
    let p = null;
    try { const o = F.tutor && typeof F.tutor.offer === 'function' ? F.tutor.offer(m.text) : null; if (o && o.ok && o.pack) p = o.pack; } catch (e) { p = null; }
    packCache.set(m, { t: m.text, p });
    return p;
  };

  /* ---------- history for a request ---------- */
  const history = conv => {
    const ms = conv.msgs.filter(m => !m.err && (m.text || m.img));
    if (!ms.length) return [];
    const len = m => (m.text || '').length + 20;
    const tail = []; let chars = len(ms[0]);
    for (let i = ms.length - 1; i >= 1 && tail.length < 39; i--) {
      const l = len(ms[i]);
      if (tail.length && chars + l > 80000) break;
      chars += l; tail.unshift(ms[i]);
    }
    let out = [ms[0]].concat(tail).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.text || '', img: m.img || '' }));
    let kept = 0;
    for (let i = out.length - 1; i >= 0; i--) {
      if (!out[i].img) continue;
      if (kept < 2) kept++;
      else { out[i].text = (out[i].text ? out[i].text + '\n' : '') + '[photo no longer attached]'; out[i].img = ''; }
    }
    const merged = [];
    out.forEach(m => {
      const p = merged[merged.length - 1];
      if (p && p.role === m.role) {
        if (p.img && m.img) { p.text = (p.text ? p.text + '\n' : '') + '[photo no longer attached]'; p.img = ''; }
        p.text = [p.text, m.text].filter(Boolean).join('\n\n'); p.img = m.img || p.img;
      } else merged.push(m);
    });
    out = merged;
    return out.map(m => (m.img ? m : { role: m.role, text: m.text }));
  };

  /* ---------- errors ---------- */
  const errLine = (p, s) => {
    const n = nameOf(p);
    if (s === 401 || s === 403) return 'المفتاح غير صحيح أو لا يملك صلاحية هذا النموذج.';
    if (s === 404) return 'هذا النموذج غير متاح لمفتاحك. اختر نموذجاً آخر.';
    if (s === 429) return 'بلغتَ حدّ الاستعمال أو انتهى رصيدك لدى ' + n + '.';
    if (s === 400) return 'رفض ' + n + ' الطلب.';
    if (s >= 500) return 'خدمة ' + n + ' مشغولة الآن. أعد المحاولة بعد قليل.';
    if (s === 0) return 'لا اتصال بالإنترنت أو انتهت المهلة.';
    if (s === -1) return 'انقطع الرد قبل أن يكتمل.';
    if (s === -2) return 'لم يُختر نموذج بعد، فلم تُرسل رسالتك.';
    if (s === -3) return 'معرّف النموذج غير صالح. اختر نموذجاً آخر.';
    if (s === -4) return 'لم يصل أي ردّ من النموذج.';
    return 'تعذّر إكمال الطلب (' + s + ').';
  };
  const rawMsg = (p, body) => {
    let m = null;
    try { m = providers[p].chat.error(JSON.parse(body)); } catch (e) { m = null; }
    if (!m) m = String(body || '').replace(/\s+/g, ' ').trim();
    return m.slice(0, 300);
  };

  /* ---------- screen ---------- */
  let el = null, conv = null, run = null, stick = true, pend = null, listen = false, speakI = -1, liveT = null, menuOn = false;
  const curConv = () => conv;
  const ensureSaved = c => {
    const C = st();
    let i = C.convs.indexOf(c);
    if (i < 0) { C.convs.unshift(c); }
    else if (i > 0) { C.convs.splice(i, 1); C.convs.unshift(c); }
    C.cur = c.id;
  };
  const newConv = (o) => ({ id: uid(), ai: prov(), title: '', at: nowT(), sys: '', msgs: [], ...(o || {}) });
  const q = s => el && el.querySelector(s);
  const onGone = (w, fn) => {
    const mo = new MutationObserver(() => { if (!document.body.contains(w)) { mo.disconnect(); fn(); } });
    mo.observe(document.body, { childList: true });
  };
  const toast = m => F.toast && F.toast(m);

  const header = () => {
    if (!el) return;
    const m = st().model[conv.ai];
    q('.ch-ti').innerHTML = `<b>${esc(nameOf(conv.ai))}</b> · <span dir="ltr" class="ch-mid">${m ? esc(m) : 'اختر نموذجاً'}</span>`;
  };
  const scrollDown = force => { const b = q('.ch-b'); if (b && (force || stick)) b.scrollTop = b.scrollHeight; };
  const imgTag = id => `<img class="ch-ph" alt="" src="${esc(F.img && F.img.url ? F.img.url(id) : '')}">`;

  const msgHtml = (m, i, last) => {
    if (m.role === 'user') {
      if (conv.req && i === 0) {
        return `<div class="ch-m ch-req" data-i="${i}"><b>${esc(conv.title || 'طلب')}</b><details><summary>عرض الطلب كاملاً</summary><pre dir="auto">${esc(m.text)}</pre></details>${m.img ? imgTag(m.img) : ''}</div>`;
      }
      const ps = String(m.text || '').split('\n').filter(x => x.trim()).map(x => `<p dir="auto">${esc(x)}</p>`).join('');
      return `<div class="ch-m ch-u" data-i="${i}">${m.img ? imgTag(m.img) : ''}${ps || (m.img ? '<p>📷</p>' : '')}</div>`;
    }
    if (run && run.msg === m) return `<div class="ch-m ch-a ch-live" data-i="${i}"><div class="ch-t">${md(hideLive(m.text || ''))}</div></div>`;
    const pk = packOf(m);
    const shown = pk ? stripPack(m.text || '') : (m.text || '');
    let h = shown.trim() ? `<div class="ch-t">${md(shown)}</div>` : '';
    if (pk) {
      const t = pk.title == null ? '' : String(pk.title);
      h += `<div class="ch-pack"><b>📦 حزمة فصيح${t ? ': ' + esc(t) : ''}</b>${m.imp ? '<span class="ch-done">أُضيفت ✓</span>' : '<button class="btn" data-c="pack">راجعها وأضفها</button>'}</div>`;
    }
    if (m.err) {
      const s = m.err.s | 0, ps = providers[conv.ai];
      h += `<div class="ch-err"><div>${esc(errLine(conv.ai, s))}</div>${m.err.b ? `<div class="ch-raw" dir="ltr">${esc(m.err.b)}</div>` : ''}${ps && last ? `<div class="ch-eb"><button class="btn ghost" data-c="retry">↻ أعد المحاولة</button>${s === 401 || s === 403 ? '<button class="btn ghost" data-c="keys">🔑 المفاتيح</button>' : ''}${s === 404 || s === -2 || s === -3 ? '<button class="btn ghost" data-c="model">اختر نموذجاً</button>' : ''}</div>` : ''}</div>`;
    }
    if (m.text && !m.err) h += `<div class="ch-act"><button data-c="copy">📋 نسخ</button><button data-c="speak" class="${speakI === i ? 'on' : ''}">${speakI === i ? '■ إيقاف' : '🔊 استمع'}</button></div>`;
    return `<div class="ch-m ch-a" data-i="${i}">${h}</div>`;
  };

  const emptyHtml = () => `<div class="ch-empty"><div class="ch-wic">💬</div><h2>أهلاً بك في محادثة فصيح</h2><p>اسألني عن الإنجليزية بالعربية أو بالإنجليزية، وأنا أصحّح وأشرح وأحاورك.</p><div class="ch-sug">${['صحّح هذه الجملة: ', 'اشرح لي الفرق بين ', 'حاورني بالإنجليزية عن يومي', 'اختبرني في كلماتي الأخيرة'].map(s => `<button class="chip" data-c="sug" data-t="${esc(s)}">${esc(s.trim().replace(/:$/, '…'))}</button>`).join('')}</div></div>`;

  const renderAll = () => {
    if (!el) return;
    const b = q('.ch-b'), ms = conv.msgs;
    let h = ms.length ? '' : (conv.req ? '' : emptyHtml());
    ms.forEach((m, i) => { h += msgHtml(m, i, i === ms.length - 1); });
    if (run && !run.msg) h += '<div class="ch-m ch-a ch-typing"><i></i><i></i><i></i></div>';
    b.innerHTML = h;
    scrollDown();
    busyUI();
  };
  const busyUI = () => {
    const s = q('.ch-send'); if (!s) return;
    s.textContent = run ? '■' : '➤'; s.classList.toggle('stop', !!run); s.setAttribute('aria-label', run ? 'إيقاف' : 'إرسال');
  };
  const liveUpdate = () => {
    if (liveT || !el || !run || !run.msg) return;
    liveT = setTimeout(() => {
      liveT = null;
      if (!el || !run || !run.msg) return;
      const b = q('.ch-b'), ty = b.querySelector('.ch-typing');
      if (ty) { ty.remove(); }
      let last = b.querySelector('.ch-live');
      if (!last) { b.insertAdjacentHTML('beforeend', `<div class="ch-m ch-a ch-live" data-i="${conv.msgs.indexOf(run.msg)}"><div class="ch-t"></div></div>`); last = b.lastElementChild; }
      const t = last.querySelector('.ch-t'); if (t) t.innerHTML = md(hideLive(run.msg.text));
      scrollDown();
    }, 50);
  };

  /* ---------- sending ---------- */
  const addErr = (c, err) => {
    c.msgs.push({ role: 'assistant', text: '', at: nowT(), err });
    commit(); if (el && conv === c) renderAll();
  };
  const go = c => {
    if (run) return;
    const p = c.ai, P = providers[p], model = st().model[p];
    if (!model) { pickModel(p, ok => { if (ok) go(c); else addErr(c, { s: -2 }); }); return; }
    let built;
    try { built = P.chat.build(model, c.sys || sysFree(), history(c)); }
    catch (e) { addErr(c, { s: -3, b: '' }); return; }
    const r = run = { c, p, P, text: '', msg: null, buf: '', status: 0, errBody: '', fail: null, fin: false, cancel: null };
    renderAll();
    const feedLine = ln => {
      if (r.fin) return;
      ln = ln.replace(/\r$/, '');
      const m = /^data:\s?(.*)$/.exec(ln); if (!m) return;
      const pl = m[1].trim();
      if (!pl) return;
      if (pl === '[DONE]') { r.fin = true; return; }
      let o; try { o = JSON.parse(pl); } catch (e) { return; }
      const em = P.chat.error(o);
      if (em) { if (!r.fail) r.fail = { s: -1, b: String(em).slice(0, 300) }; return; }
      const d = P.chat.delta(o);
      if (d) {
        r.text += d;
        if (!r.msg) { r.msg = { role: 'assistant', text: '', at: nowT() }; c.msgs.push(r.msg); }
        r.msg.text = r.text; F.save(); liveUpdate();
      }
    };
    const feed = t => { r.buf += t; const ls = r.buf.split('\n'); r.buf = ls.pop(); ls.forEach(feedLine); };
    const end = err => {
      if (run !== r) return;
      run = null;
      if (liveT) { clearTimeout(liveT); liveT = null; }
      if (err) {
        if (r.msg) { r.msg.err = err; } else c.msgs.push({ role: 'assistant', text: '', at: nowT(), err });
      } else if (!r.msg) c.msgs.push({ role: 'assistant', text: '', at: nowT(), err: { s: -4 } });
      commit(); if (el && conv === c) renderAll();
    };
    r.cancel = T().http({ p, method: 'POST', path: built.path, body: built.body, stream: true }, {
      open(s) { if (run === r) r.status = s | 0; },
      data(t) { if (run !== r) return; if (r.status >= 400) r.errBody += t; else feed(String(t)); },
      done() {
        if (run !== r) return;
        if (r.status >= 400) return end({ s: r.status, b: rawMsg(p, r.errBody) });
        if (r.buf) { const rest = r.buf; r.buf = ''; feedLine(rest); }
        end(r.fail);
      },
      error(s, body) {
        if (run !== r) return;
        if (s && typeof s === 'object') { body = s.body; s = s.status; }
        end({ s: s | 0, b: rawMsg(p, body) });
      },
    });
  };
  const stopRun = () => {
    if (!run) return;
    const r = run; run = null;
    if (liveT) { clearTimeout(liveT); liveT = null; }
    try { r.cancel && r.cancel(); } catch (e) { /* ignore */ }
    commit(); if (el) renderAll();
  };
  const sendUser = (c, text, img) => {
    text = String(text || '').trim();
    if (!text && !img) return false;
    if (run) return false;
    if (!F.chat.ready(c.ai)) { keysSheet(); return false; }
    if (!c.sys) c.sys = sysFree();
    if (!c.title) c.title = text.replace(/\s+/g, ' ').slice(0, 40) || 'صورة';
    const last = c.msgs[c.msgs.length - 1];
    if (last && last.err && last.role === 'assistant' && !last.text) c.msgs.pop();
    const m = { role: 'user', text, at: nowT() }; if (img) m.img = String(img);
    c.msgs.push(m);
    ensureSaved(c); commit();
    stick = true; renderAll(); scrollDown(true);
    go(c);
    return true;
  };

  /* ---------- model picker ---------- */
  const modelCache = {};
  const fetchModels = (p, cb) => {
    const c = modelCache[p];
    if (c && nowT() - c.at < 300000) return cb(null, c.list), () => {};
    let status = 0, body = '';
    return T().http({ p, method: 'GET', path: providers[p].models.path, stream: false }, {
      open(s) { status = s | 0; },
      data(t) { body += t; },
      done() {
        if (status >= 400) return cb({ s: status, b: rawMsg(p, body) });
        let list;
        try { list = providers[p].models.parse(JSON.parse(body)); } catch (e) { return cb({ s: -4, b: 'bad response' }); }
        modelCache[p] = { at: nowT(), list }; cb(null, list);
      },
      error(s, b) { if (s && typeof s === 'object') { b = s.body; s = s.status; } cb({ s: s | 0, b: rawMsg(p, b) }); },
    });
  };
  const pickModel = (p, cb) => {
    if (!F.chat.available()) return unavailable();
    if (!F.chat.ready(p)) { keysSheet(); if (cb) cb(false); return; }
    let chosen = false, list = null, cancel = null;
    const sh = F.sheet(`<h2>اختر النموذج · ${esc(nameOf(p))}</h2><input class="inp cp-q" dir="ltr" placeholder="ابحث…" autocomplete="off"><div class="cp-list"><div class="hint">جارٍ تحميل النماذج…</div></div><div class="hint">الأحدث في الأعلى. النماذج الأصغر (mini، flash، haiku) أرخص وأسرع وتكفي للتصحيح اليومي.</div><label class="cp-lab">أو اكتب معرّف النموذج</label><div class="cp-free"><input class="inp cp-id" dir="ltr" placeholder="model-id" autocomplete="off"><button class="btn cp-use">استعمل</button></div>`, 'cp');
    const w = F._sheet, box = sh.querySelector('.cp-list'), cur = st().model[p];
    const choose = id => {
      id = String(id || '').trim();
      if (!okId(id, p === 'gemini')) return toast('معرّف النموذج غير صالح');
      st().model[p] = id; chosen = true; F.save(); F.closeSheet(); header(); if (cb) cb(true);
    };
    const draw = () => {
      if (!list) return;
      const s = sh.querySelector('.cp-q').value.trim().toLowerCase();
      const items = list.filter(m => !s || m.id.toLowerCase().includes(s) || String(m.name).toLowerCase().includes(s));
      box.innerHTML = items.length ? items.map(m => `<button class="cp-it ${m.id === cur ? 'on' : ''}" data-id="${esc(m.id)}"><b dir="auto">${esc(m.name)}</b><small dir="ltr">${esc(m.id)}</small></button>`).join('') : '<div class="hint">لا نتائج. يمكنك كتابة المعرّف يدوياً أدناه.</div>';
    };
    const load = () => {
      box.innerHTML = '<div class="hint">جارٍ تحميل النماذج…</div>';
      cancel = fetchModels(p, (err, l) => {
        if (!document.body.contains(w)) return;
        if (err) { box.innerHTML = `<div class="ch-err"><div>${esc(errLine(p, err.s))}</div>${err.b ? `<div class="ch-raw" dir="ltr">${esc(err.b)}</div>` : ''}<div class="ch-eb"><button class="btn ghost cp-re">↻ أعد المحاولة</button></div></div>`; return; }
        list = l; draw();
      });
    };
    sh.addEventListener('click', e => {
      const it = e.target.closest('.cp-it'); if (it) return choose(it.dataset.id);
      if (e.target.closest('.cp-use')) return choose(sh.querySelector('.cp-id').value);
      if (e.target.closest('.cp-re')) load();
    });
    sh.querySelector('.cp-q').addEventListener('input', draw);
    sh.querySelector('.cp-id').addEventListener('keydown', e => { if (e.key === 'Enter') choose(e.target.value); });
    onGone(w, () => { if (cancel && !list) try { cancel(); } catch (e) { /* ignore */ } if (!chosen && cb) cb(false); });
    load();
  };

  /* ---------- keys sheet, history sheet ---------- */
  const unavailable = () => { F.sheet(`<p class="cmsg">${T_NOAPP}</p>`, 'small'); };
  let keysW = null, keysDraw = null;
  const keysSheet = () => {
    if (!F.chat.available()) return unavailable();
    const sh = F.sheet('<div class="kx"></div>', 'kx-s'), w = keysW = F._sheet, box = sh.querySelector('.kx');
    const draw = keysDraw = () => {
      const k = T().keys() || {};
      box.innerHTML = `<h2>🔑 المفاتيح</h2>${ORDER.map(p => `<div class="kx-row"><b>${esc(nameOf(p))}</b><span class="kx-st ${k[p] ? 'on' : ''}">${k[p] ? 'محفوظ ✓' : 'لا مفتاح'}</span><button class="btn ghost" data-k="${p}">${k[p] ? 'غيّر' : 'أضف'}</button></div>`).join('')}<p class="kx-note">تكتب المفتاح في نافذة خاصة خارج صفحة التطبيق. يُحفظ مشفّراً في هاتفك ولا يُرسل إلا إلى خوادم الشركة صاحبتها. فصيح لا يملك خوادم ولا يرى محادثاتك. الاستعمال يُحسب على رصيدك لدى الشركة، وهو منفصل عن اشتراك تطبيقها.</p><div class="hint">أنشئ مفتاحاً من لوحة الشركة:</div><div class="kx-links">${ORDER.map(p => `<button class="btn ghost" data-u="${p}">${esc(nameOf(p))} ↗</button>`).join('')}</div>`;
    };
    draw();
    sh.addEventListener('click', e => {
      const k = e.target.closest('[data-k]'); if (k) return T().askKey(k.dataset.k);
      const u = e.target.closest('[data-u]'); if (u && CONSOLES[u.dataset.u]) F.openUrl(CONSOLES[u.dataset.u]);
    });
    onGone(w, () => { if (keysW === w) { keysW = null; keysDraw = null; } });
  };
  const listSheet = () => {
    const C = st();
    const rows = C.convs.map(c => `<div class="cl-row ${c.id === C.cur ? 'on' : ''}" data-id="${esc(c.id)}"><button class="cl-open" data-c2="open"><b dir="auto">${esc(c.title || 'محادثة')}</b><small>${esc(nameOf(c.ai))} · ${esc(new Date(c.at).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long' }))} · ${c.msgs.length} رسالة</small></button><button class="cl-del" data-c2="del" aria-label="حذف">🗑</button></div>`).join('');
    const sh = F.sheet(`<h2>المحادثات السابقة</h2>${rows || '<p class="hint">لا محادثات محفوظة بعد.</p>'}`, 'cl');
    sh.addEventListener('click', e => {
      const b = e.target.closest('[data-c2]'), row = e.target.closest('.cl-row'); if (!b || !row) return;
      const id = row.dataset.id;
      if (b.dataset.c2 === 'open') { F.closeSheet(); openConv(findConv(id)); }
      else F.confirm('حذف هذه المحادثة؟', () => {
        if (conv && conv.id === id) { stopRun(); conv = newConv(); }
        const i = st().convs.findIndex(c => c.id === id); if (i >= 0) st().convs.splice(i, 1);
        if (st().cur === id) st().cur = null;
        F.save(); if (el) { header(); renderAll(); } listSheet();
      }, 'احذف');
    });
  };

  /* ---------- open / close ---------- */
  const openConv = c => {
    if (!c) return;
    stopRun();
    c.msgs = c.msgs.filter((m, i) => !(m.role === 'assistant' && !m.text && !m.err && i === c.msgs.length - 1));
    conv = c; st().cur = c.id; F.save();
    if (!el) build(); else { header(); renderAll(); }
  };
  const build = () => {
    const d = el = document.createElement('div'); d.className = 'chat';
    d.innerHTML = `<header class="ch-h"><button class="ch-x" data-c="close" aria-label="إغلاق">✕</button><button class="ch-ti" data-c="model"></button><button class="ch-mn" data-c="menu" aria-label="القائمة">⋮</button></header>
<div class="ch-menu" hidden><button data-c="new">محادثة جديدة</button><button data-c="list">المحادثات السابقة</button><button data-c="keys">🔑 المفاتيح</button></div>
<main class="ch-b"></main>
<footer class="ch-f"><div class="ch-chip" hidden></div><div class="ch-cam" hidden><button data-c="cam" data-s="camera">التقط صورة</button><button data-c="cam" data-s="gallery">من المعرض</button></div>
<div class="ch-in">${F.img && F.img.ok && F.img.ok() ? '<button class="ch-ic" data-c="photo" aria-label="صورة">📷</button>' : ''}${F.stt && F.stt.ok && F.stt.ok() ? '<button class="ch-ic ch-mic" data-c="mic" aria-label="إملاء">🎤</button>' : ''}<textarea dir="auto" rows="1" placeholder="اكتب رسالتك…" aria-label="رسالة"></textarea><button class="ch-send" data-c="send" aria-label="إرسال">➤</button></div></footer>`;
    document.body.appendChild(d); document.body.classList.add('running');
    F.runner = { askClose() { F.chat.close(); }, close() { F.chat.close(); } };
    F.nat('keepAwake', true);
    const body = q('.ch-b');
    body.addEventListener('scroll', () => { stick = body.scrollHeight - body.scrollTop - body.clientHeight < 80; });
    body.addEventListener('error', e => { if (e.target && e.target.tagName === 'IMG') e.target.style.display = 'none'; }, true);
    const ta = q('textarea');
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
    ta.addEventListener('input', grow);
    d.addEventListener('click', onClick);
    d.__grow = grow;
    header(); renderAll(); chipUI();
  };
  const chipUI = () => {
    const c = q('.ch-chip'); if (!c) return;
    c.hidden = !pend;
    c.innerHTML = pend ? `${imgTag(pend)}<button data-c="unpend" aria-label="إزالة الصورة">✕</button>` : '';
  };
  const menu = on => { menuOn = on; const m = q('.ch-menu'); if (m) m.hidden = !on; };
  const doSend = () => {
    const ta = q('textarea');
    if (run) return stopRun();
    if (listen) { try { F.stt.stop(); } catch (e) { /* ignore */ } }
    const ok = sendUser(conv, ta.value, pend);
    if (ok) { ta.value = ''; pend = null; ta.__v = ''; chipUI(); el.__grow(); }
  };
  const onClick = e => {
    const b = e.target.closest('[data-c]');
    if (menuOn && !(b && b.dataset.c === 'menu')) menu(false);
    if (!b) return;
    const c = b.dataset.c, ta = q('textarea'), mi = b.closest('.ch-m'), idx = mi ? +mi.dataset.i : -1;
    if (c === 'close') F.chat.close();
    else if (c === 'menu') menu(!menuOn);
    else if (c === 'model') pickModel(conv.ai);
    else if (c === 'new') { stopRun(); conv = newConv(); st().cur = null; pend = null; chipUI(); header(); renderAll(); F.save(); }
    else if (c === 'list') listSheet();
    else if (c === 'keys') keysSheet();
    else if (c === 'send') doSend();
    else if (c === 'sug') { ta.value = b.dataset.t; el.__grow(); ta.focus(); }
    else if (c === 'photo') { const m = q('.ch-cam'); m.hidden = !m.hidden; }
    else if (c === 'cam') { q('.ch-cam').hidden = true; F.img.pick(b.dataset.s, r => { if (r && r.id != null) { pend = String(r.id); chipUI(); } }); }
    else if (c === 'unpend') { pend = null; chipUI(); }
    else if (c === 'mic') mic(b, ta);
    else if (c === 'retry') {
      const last = conv.msgs[conv.msgs.length - 1];
      if (last && last.err && !run) { conv.msgs.pop(); commit(); renderAll(); go(conv); }
    } else if (c === 'copy') copyMsg(conv.msgs[idx]);
    else if (c === 'speak') speak(idx);
    else if (c === 'pack') {
      const m = conv.msgs[idx], pk = packOf(m);
      if (!pk) return;
      if (!F.tutor || typeof F.tutor.preview !== 'function') return toast('ميزة الحزم غير متاحة الآن.');
      try { F.tutor.preview(pk, ok => { if (ok) { m.imp = 1; F.save(); if (el) renderAll(); } }); } catch (x) { toast('تعذّر فتح الحزمة.'); }
    }
  };
  const copyMsg = m => {
    if (!m) return;
    const t = String(m.text || '');
    let r; try { r = F.nat('copyText', t); } catch (e) { r = undefined; }
    if (r === undefined && navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
    toast('نُسخ النص ✓');
  };
  const englishLines = text => {
    const out = []; let code = false;
    String(text).split('\n').forEach(l => {
      if (/^\s*(```|~~~)/.test(l)) { code = !code; return; }
      if (code || /^\s*\|/.test(l)) return;
      l = l.replace(/^\s*(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|__|`|\*/g, '').trim();
      const ar = (l.match(/[؀-ۿ]/g) || []).length, la = (l.match(/[A-Za-z]/g) || []).length;
      if (la >= 3 && la > ar) { l = l.replace(/[؀-ۿ]+/g, ' ').replace(/\s+/g, ' ').trim(); if (l) out.push({ t: l }); }
    });
    return out;
  };
  const speak = i => {
    const m = conv.msgs[i]; if (!m) return;
    if (speakI === i) { F.tts.stop(); speakI = -1; renderAll(); return; }
    const items = englishLines(packOf(m) ? stripPack(m.text) : m.text);
    if (!items.length) return toast('لا توجد جمل إنجليزية في هذا الرد.');
    speakI = i; renderAll();
    F.tts.speak(items, () => { if (speakI === i) { speakI = -1; if (el) renderAll(); } });
  };
  const mic = (b, ta) => {
    if (listen) { try { F.stt.stop(); } catch (e) { /* ignore */ } return; }
    listen = true; b.classList.add('on');
    const base = ta.value, join = t => (base && !/\s$/.test(base) ? base + ' ' : base) + t;
    const fin = () => { listen = false; b.classList.remove('on'); };
    F.stt.start({
      partial(t) { ta.value = join(t); el && el.__grow(); },
      result(t) { ta.value = join(t); fin(); el && el.__grow(); },
      error() { fin(); toast('تعذّر الإملاء الصوتي.'); },
      end() { fin(); },
    });
  };

  /* ---------- public API ---------- */
  F.chat = {
    providers, transport: defTransport, md,
    available() { const t = this.transport; return !!(t && (typeof t.ok === 'function' ? t.ok() : true)); },
    ready(ai) { if (!this.available()) return false; try { return !!(this.transport.keys() || {})[ai]; } catch (e) { return false; } },
    keys() { keysSheet(); },
    open() {
      if (!this.available()) return unavailable();
      if (el) return;
      const c = findConv(st().cur);
      conv = c || newConv();
      if (c) { c.msgs = c.msgs.filter((m, i) => !(m.role === 'assistant' && !m.text && !m.err && i === c.msgs.length - 1)); }
      pend = null; stick = true; listen = false; speakI = -1;
      build();
    },
    start(o) {
      o = o || {};
      if (!this.available()) { unavailable(); return false; }
      const ai = prov();
      if (!this.ready(ai)) { keysSheet(); return false; }
      if (el) stopRun();
      const c = newConv({ ai, title: String(o.title || ''), sys: String(o.system || '') || sysFree(), req: 1 });
      conv = c; pend = null;
      if (el) { header(); renderAll(); } else { stick = true; listen = false; speakI = -1; build(); }
      sendUser(c, o.user, o.img ? String(o.img) : '');
      return true;
    },
    close() {
      if (!el) return;
      stopRun();
      try { F.tts.stop(); speakI = -1; F.stt.cancel(); } catch (e) { /* ignore */ }
      listen = false; menuOn = false;
      el.remove(); el = null; conv = null;
      document.body.classList.remove('running');
      F.runner = null; F.nat('keepAwake', false);
      F.save();
      if (F.render) F.render();
    },
    onKey(d) { if (keysW && document.body.contains(keysW) && keysDraw) keysDraw(); },
    current() { return conv; },
  };
})(window.Fasih);

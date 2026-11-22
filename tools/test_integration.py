#!/usr/bin/env python3
"""Tutor + chat together, over a stub of the Android bridge (window.FasihNative), as the real app wires them.
usage: test_integration.py [shots_dir]"""
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/integ-shots'
os.makedirs(OUT, exist_ok=True)
URL = 'file://' + os.path.join(ROOT, 'www', 'index.html')
res = []


def ok(name, cond, extra=''):
    res.append(bool(cond))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  <- ' + str(extra)[:300]))


PACK = {"fasih": 1, "title": "مشتريات عمومية", "note": "راجعها غداً.",
        "words": [{"w": "zzprocure", "p": "v", "l": "B2", "ar": "يقتني، يشتري", "d": "to obtain something, especially with effort", "ex": "The ministry will zzprocure new computers.", "x": "zzprocure", "exar": "ستقتني الوزارة حواسيب جديدة."},
                  {"w": "zztender", "p": "n", "l": "B2", "ar": "مناقصة", "ex": "Three firms answered the zztender.", "x": "zztender"}],
        "mistakes": [{"q": "I am agree with you.", "bad": "am agree", "good": ["agree"], "why": "agree فعل"}]}
REPLY = 'إليك كلمات عن المشتريات العمومية.\n\n- **procure**: يقتني\n\n```json\n' + json.dumps(PACK, ensure_ascii=False) + '\n```\n'

STUB = r"""
(() => {
  const state = { log: [], clip: '', shared: '', keys: { claude: true, chatgpt: false, gemini: false, grok: false }, saved: '' };
  const emit = (t, d) => window.Fasih && window.Fasih.onNative && window.Fasih.onNative(t, d);
  const sse = o => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
  window.__stub = state;
  window.FasihNative = {
    store(j) { state.saved = j; return true; }, restore() { return ''; }, version() { return '9.9.9|999'; },
    keepAwake() {}, toast() {}, vibrate() {}, stopSpeak() {}, sttAvailable() { return false; }, sttCancel() {}, recStopPlay() {}, isNight() { return false; }, setBars() {},
    launchInfo() { return '{"from":""}'; }, reminderState() { return '{}'; }, setReminders() {}, setDayStatus() {},
    aiApps() { return JSON.stringify({ claude: { inst: true, send: true, img: true }, chatgpt: { inst: true, send: false, img: true }, gemini: { inst: false, send: false, img: false }, grok: { inst: false, send: false, img: false } }); },
    aiSend(k, t, i) { state.log.push({ m: 'aiSend', n: arguments.length, k, t, i }); state.clip = t; return state.sendResult || (i ? 'sendimg' : 'send'); },
    copyText(t) { state.clip = String(t); return true; }, pasteText() { return state.clip; },
    takeShared() { const s = state.shared; state.shared = ''; return s; },
    pickImage(src) { state.log.push({ m: 'pickImage', src }); setTimeout(() => emit('img', { ev: 'ok', id: 'ph7', w: 800, h: 600 }), 30); },
    aiKeys() { return JSON.stringify(state.keys); }, askAiKey(p) { state.log.push({ m: 'askAiKey', p }); state.keys[p] = true; setTimeout(() => emit('aikey', { p, has: true }), 20); },
    aiHttpCancel(id) { state.log.push({ m: 'cancel', id }); },
    aiHttp(json) {
      const r = JSON.parse(json); state.log.push({ m: 'aiHttp', r });
      setTimeout(() => {
        if (r.method === 'GET') { emit('http', { id: r.id, ev: 'open', status: 200 }); const body = JSON.stringify({ data: [{ id: 'claude-test-1', display_name: 'Claude Test', created_at: '2026-05-01T00:00:00Z' }] }); emit('http', { id: r.id, ev: 'data', text: body.slice(0, 25) }); emit('http', { id: r.id, ev: 'data', text: body.slice(25) }); emit('http', { id: r.id, ev: 'done' }); return; }
        if (state.fail) { emit('http', { id: r.id, ev: 'error', status: state.fail, body: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}' }); return; }
        emit('http', { id: r.id, ev: 'open', status: 200 });
        const text = window.__reply, parts = []; for (let i = 0; i < text.length; i += 37) parts.push(text.slice(i, i + 37));
        let all = sse({ type: 'message_start', message: { id: 'm1' } }) + sse({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + sse({ type: 'ping' });
        parts.forEach(p => { all += sse({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: p } }); });
        all += sse({ type: 'content_block_stop', index: 0 }) + sse({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }) + sse({ type: 'message_stop' });
        let i = 0; const step = () => { if (i >= all.length) { emit('http', { id: r.id, ev: 'done' }); return; } const n = 23 + (i % 41); emit('http', { id: r.id, ev: 'data', text: all.slice(i, i + n) }); i += n; setTimeout(step, 1); }; step();
      }, 10);
    },
  };
  if (!localStorage.getItem('fasih-state')) localStorage.setItem('fasih-state', JSON.stringify({ onboard: true, name: 'test', set: { theme: 'light' } }));
})();
"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    ctx.add_init_script(STUB)
    ctx.add_init_script('window.__reply = ' + json.dumps(REPLY) + ';')
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('console', lambda m: errs.append('console: ' + m.text[:300]) if m.type == 'error' and 'ERR_FILE_NOT_FOUND' not in m.text and '/shots/' not in m.text else None)
    page.goto(URL)
    page.wait_for_timeout(700)
    q = lambda js: page.evaluate(js)

    ok('app starts as the Android app (bridge stub seen)', q('Fasih.isApp === true && !!Fasih.tutor && !!Fasih.chat && Fasih.chat.available()'))
    q('Fasih.go("tutor")'); page.wait_for_timeout(250)
    ok('tutor page shows the mode switch and both modes', q('/اشتراكي العادي/.test(document.querySelector(".page").innerText) && /مفتاح API/.test(document.querySelector(".page").innerText)'))
    page.screenshot(path=f'{OUT}/1-tutor-app.png')

    # ---- bridge mode: hand-off with three string arguments, photo id passed on
    r = q('Fasih.tutor.send("words", { topic: "public procurement", n: 10 }, "")')
    last = q('__stub.log.filter(x => x.m === "aiSend").pop()')
    ok('bridge mode calls aiSend(key, text, "") with 3 arguments', r == 'send' and last and last['n'] == 3 and last['k'] == 'claude' and last['i'] == '' and '[Fasih tutor request]' in last['t'] and '"fasih":1' in last['t'], [r, last and {k: v for k, v in last.items() if k != 't'}])
    r = q('Fasih.tutor.send("photo", {}, "ph7")')
    last = q('__stub.log.filter(x => x.m === "aiSend").pop()')
    ok('a photo id is handed to the native side', r == 'sendimg' and last['i'] == 'ph7', [r, last['i']])
    ok('the request is logged for the "waiting for the pack" card', q('Fasih.S.tutor.sent === 2 && Fasih.S.tutor.last.req === "photo"'))

    # ---- paste a pack from the clipboard (what the learner copies from the AI app)
    q('__stub.clip = window.__reply')
    q('Fasih.go("tutor")'); page.wait_for_timeout(200)
    btn = page.locator('text=📥').first
    btn.click(); page.wait_for_timeout(300)
    sheet = q('(document.querySelector(".sheetw") || {}).innerText || ""')
    ok('paste button reads the clipboard and opens the approval sheet', 'مشتريات عمومية' in sheet and 'zzprocure' in sheet and 'I am agree' in sheet, sheet[:200])
    page.screenshot(path=f'{OUT}/2-preview-app.png')
    page.locator('.sheetw button:has-text("أضف إلى خطتي")').click(); page.wait_for_timeout(300)
    ok('pack applied: words wait in the tutor track, mistake in the notebook', q('Fasih.S.custom.filter(v => v.tr === "t").length === 2 && Fasih.S.tutor.mistakes.length === 1 && Fasih.S.tutor.packs.length === 1 && !Fasih.S.cards["x:zzprocure"]'))
    ok('the next new-words session starts with the tutor words', q('(() => { const g = Fasih.SRS.newQueue(); const a = [g.next().value.w, g.next().value.w]; Fasih.SRS.clearQueued(); return a.join(","); })()') == 'zzprocure,zztender')
    q('Fasih.tutor.remove(Fasih.S.tutor.packs[0].id)')
    ok('removing the pack removes its words and mistakes', q('Fasih.S.custom.length === 0 && Fasih.S.tutor.mistakes.length === 0 && !Fasih.DB.byId["x:zzprocure"]'))

    # ---- text shared into the app while it runs
    q('__stub.shared = window.__reply; Fasih.onNative("shared", { n: 1 })'); page.wait_for_timeout(300)
    ok('a pack shared from another app opens the approval sheet', 'zzprocure' in q('(document.querySelector(".sheetw") || {}).innerText || ""'))
    q('Fasih.closeSheet()')
    q('__stub.shared = "whistleblower"; Fasih.onNative("shared", { n: 1 })'); page.wait_for_timeout(300)
    ok('a shared word opens the add-word sheet', q('!!document.querySelector(".sheetw input") && [...document.querySelectorAll(".sheetw input")].some(i => i.value === "whistleblower")'))
    q('Fasih.closeSheet()')

    # ---- API mode over the native transport
    q('Fasih.S.tutor.mode = "api"; Fasih.S.chat.model = {}; Fasih.save()')
    r = q('Fasih.tutor.send("words", { topic: "public procurement", n: 10 }, "ph7")')
    page.wait_for_timeout(500)
    ok('API mode opens the chat instead of the AI app', r == 'api' and q('!!document.querySelector(".ch-b") && !!Fasih.runner'), r)
    # first use: model picker, loaded through the native transport
    picked = False
    for _ in range(30):
        if q('!!document.querySelector(".sheetw") && /claude-test-1/.test(document.querySelector(".sheetw").innerText)'):
            page.locator('.sheetw >> text=claude-test-1').first.click(); picked = True; break
        page.wait_for_timeout(100)
    ok('model list arrives through the native transport and a model is chosen', picked and q('Fasih.S.chat.model.claude') == 'claude-test-1', q('(document.querySelector(".sheetw") || {}).innerText || "no sheet"'))
    done = False
    for _ in range(80):
        if q('(() => { const c = Fasih.chat.current(); const m = c && c.msgs[c.msgs.length - 1]; return !!(m && m.role === "assistant" && m.text && /```\\s*$/.test(m.text.trim()) && !document.querySelector(".ch-send.stop")); })()'):
            done = True; break
        page.wait_for_timeout(100)
    page.wait_for_timeout(300)
    msg = q('(() => { const c = Fasih.chat.current(); return c.msgs[c.msgs.length - 1].text; })()')
    ok('the streamed reply is reassembled exactly', done and msg.strip() == REPLY.strip(), msg[-200:])
    post = q('__stub.log.filter(x => x.m === "aiHttp" && x.r.method === "POST").pop().r')
    body = json.loads(post['body'])
    ok('chat request: path, model, system prompt, user request and photo token', post['p'] == 'claude' and post['path'] == '/v1/messages' and post['stream'] is True and body['model'] == 'claude-test-1' and 'FASIH PACK' in body['system'] and 'ABOUT ME' in body['system'] and 'Teach me 10' in body['messages'][0]['content'][0]['text'] and body['messages'][0]['content'][1]['source']['data'] == '@@IMG:ph7@@', json.dumps(body)[:400])
    card = q('(document.querySelector(".ch-b") || {}).innerText || ""')
    ok('the reply shows a pack card and hides the raw JSON', 'حزمة فصيح' in card and 'مشتريات عمومية' in card and '"fasih"' not in card and 'zzprocure' not in card, card[-300:])
    page.screenshot(path=f'{OUT}/3-chat-pack.png')
    page.locator('.ch-b button:has-text("راجعها وأضفها")').click(); page.wait_for_timeout(300)
    sheet = q('(document.querySelector(".sheetw") || {}).innerText || ""')
    ok('the card opens the tutor approval sheet', 'zzprocure' in sheet and 'أضف إلى خطتي' in sheet, sheet[:200])
    page.locator('.sheetw button:has-text("أضف إلى خطتي")').click(); page.wait_for_timeout(400)
    ok('approved inside the chat: pack stored, chat still open, card marked as added', q('Fasih.S.tutor.packs.length === 1 && Fasih.S.custom.length === 2 && !!document.querySelector(".ch-b")') and 'أُضيفت' in q('document.querySelector(".ch-b").innerText'), q('document.querySelector(".ch-b") ? document.querySelector(".ch-b").innerText.slice(-200) : "chat closed"'))
    page.screenshot(path=f'{OUT}/4-chat-added.png')
    # a failing key
    q('__stub.fail = 401')
    page.fill('.ch-in textarea', 'Thanks'); page.locator('.ch-send').click(); page.wait_for_timeout(600)
    err = q('(document.querySelector(".ch-b") || {}).innerText || ""')
    ok('a refused key gives the Arabic explanation and the provider message', 'المفتاح غير صحيح' in err and 'invalid x-api-key' in err, err[-300:])
    q('__stub.fail = 0')
    q('Fasih.onBack()'); page.wait_for_timeout(300)
    ok('the back button closes the chat and the app re-renders', q('!document.querySelector(".ch-b") && !Fasih.runner && !!document.querySelector(".tabs")'))
    # no key for the chosen provider: the keys sheet, not a silent hand-off
    q('Fasih.S.tutor.ai = "gemini"; Fasih.save()')
    n0 = q('__stub.log.filter(x => x.m === "aiSend").length')
    r = q('Fasih.tutor.send("ask", { text: "What is a tender?" }, "")'); page.wait_for_timeout(300)
    ok('API mode without a key asks for the key', r == 'keys' and q('__stub.log.filter(x => x.m === "aiSend").length') == n0 and 'Gemini' in q('(document.querySelector(".sheetw") || {}).innerText || ""'), r)
    page.screenshot(path=f'{OUT}/5-keys.png')
    q('Fasih.closeSheet()')
    # state survives a reload
    q('Fasih.S.tutor.ai = "claude"; Fasih.flush()')
    page.reload(); page.wait_for_timeout(700)
    ok('after a reload: pack, tutor words and the conversation are still there', q('Fasih.S.tutor.packs.length === 1 && Fasih.DB.tracks.t.length === 2 && Fasih.S.chat.convs.length === 1 && Fasih.S.chat.convs[0].msgs.length >= 2'))
    ok('no page errors', not errs, errs[:3])
    b.close()

print(f'{sum(res)}/{len(res)} checks passed')
sys.exit(0 if all(res) else 1)

#!/usr/bin/env python3
"""Test the in-app AI chat (www/js/chat.js) with a mock transport. usage: test_chat.py [shots_dir]
The tutor module is replaced by a stub on purpose: this test must not depend on its state."""
import json, os, re, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/chat-shots'
os.makedirs(OUT, exist_ok=True)
URL = 'file://' + os.path.join(ROOT, 'www', 'index.html')
PATHRE = re.compile(r'^/v1(beta)?/[A-Za-z0-9_.:/-]+(\?[A-Za-z0-9_=&.-]*)?$')
results = []
errors = []


def ok(name, cond, detail=''):
    results.append(bool(cond))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(detail)[:300]))


SEED = """if (!localStorage.getItem('fasih-state')) localStorage.setItem('fasih-state', JSON.stringify({onboard: true, name: 'test', set: {theme: 'light'}, tutor: {ai: 'claude'}}));"""

MOCK = r"""
(() => {
  const F = Fasih;
  const M = window.__m = { keys: {claude: false, chatgpt: false, gemini: false, grok: false}, calls: [], asked: [], cancelled: 0, queue: [], gate: null,
    models: {
      claude: {data: [{id: 'claude-old-1', display_name: 'Old One', created_at: '2024-01-01T00:00:00Z'}, {id: 'claude-new-9', display_name: 'New Nine', created_at: '2026-01-01T00:00:00Z'}]},
      chatgpt: {data: [{id: 'gpt-a', created: 1000}, {id: 'text-embedding-x', created: 5}, {id: 'gpt-b', created: 2000}, {id: 'whisper-1', created: 3}]},
      gemini: {models: [{name: 'models/gemini-a', displayName: 'Gem A', supportedGenerationMethods: ['generateContent']}, {name: 'models/embedding-001', displayName: 'Emb', supportedGenerationMethods: ['embedContent']}, {name: 'models/gemini-z', displayName: 'Gem Z', supportedGenerationMethods: ['generateContent', 'countTokens']}]},
      grok: {data: [{id: 'grok-a', created: 10}, {id: 'grok-b-image', created: 20}]},
    } };
  M.pieces = (t, n) => { const a = []; for (let i = 0; i < t.length; i += n) a.push(t.slice(i, i + n)); return a; };
  M.sse = (p, text, step) => {
    let s = ''; const ps = M.pieces(text, step || 7);
    if (p === 'claude') {
      s += 'event: message_start\ndata: {"type":"message_start","message":{"id":"m","role":"assistant","content":[]}}\n\nevent: ping\ndata: {"type": "ping"}\n\n';
      ps.forEach(x => { s += 'event: content_block_delta\ndata: ' + JSON.stringify({type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: x}}) + '\n\n'; });
      s += 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
    } else if (p === 'gemini') {
      ps.forEach(x => { s += 'data: ' + JSON.stringify({candidates: [{content: {parts: [{text: x}], role: 'model'}, index: 0}]}) + '\r\n\r\n'; });
    } else {
      s += 'data: ' + JSON.stringify({choices: [{index: 0, delta: {role: 'assistant', content: ''}}]}) + '\n\n';
      ps.forEach(x => { s += 'data: ' + JSON.stringify({choices: [{index: 0, delta: {content: x}, finish_reason: null}]}) + '\n\n'; });
      s += 'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\ndata: {"choices":[{"delta":{"content":"AFTERDONE"}}]}\n\n';
    }
    return s;
  };
  M.errEvent = (p, m) => p === 'claude' ? 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"' + m + '"}}\n\n' : 'data: {"error":{"message":"' + m + '"}}\n\n';
  F.chat.transport = {
    keys() { return Object.assign({}, M.keys); },
    askKey(p) { M.asked.push(p); M.keys[p] = true; F.onNative('aikey', {p, has: true}); },
    http(req, h) {
      M.calls.push(JSON.parse(JSON.stringify(req)));
      let dead = false; const ts = [];
      const at = (ms, f) => ts.push(setTimeout(() => { if (!dead) f(); }, ms));
      const cancel = () => { dead = true; ts.forEach(clearTimeout); M.cancelled++; };
      if (req.method === 'GET') { at(5, () => { h.open(200); h.data(JSON.stringify(M.models[req.p])); h.done(); }); return cancel; }
      const spec = M.queue.length ? M.queue.shift() : {text: 'OK'};
      if (spec.err) { at(5, () => h.error(spec.err.status, spec.err.body)); return cancel; }
      let body = spec.raw != null ? spec.raw : M.sse(req.p, spec.text, spec.step);
      if (spec.streamErr) body += M.errEvent(req.p, spec.streamErr);
      const chunks = M.pieces(body, spec.cut || 40); let t = 5;
      at(t, () => h.open(200));
      chunks.forEach(c => { t += (spec.gap == null ? 4 : spec.gap); at(t, () => h.data(c)); });
      if (spec.after === 'error') at(t + 4, () => h.error(spec.status || 0, spec.body || 'net'));
      else if (!spec.hang) at(t + 4, () => h.done());
      return cancel;
    },
  };
  F.tutor = {
    system() { return 'STUB SYSTEM PROMPT'; },
    offer(text) {
      const m = /```[^\n]*\n([\s\S]*?)\n```/.exec(text); if (!m || !/"fasih"/.test(m[1])) return {ok: false};
      try { return {ok: true, pack: JSON.parse(m[1])}; } catch (e) { return {ok: false}; }
    },
    preview(pack, cb) { window.__prev = pack; window.__cb = cb; },
  };
  F.S.chat.model = {claude: 'claude-new-9', chatgpt: 'gpt-b', gemini: 'gemini-z', grok: 'grok-a'};
  Object.keys(M.keys).forEach(k => { M.keys[k] = true; });
})();
"""

SAMPLE_MIX = ("لتصحيح جملتك: **I am agree** غير صحيحة.\n\nالصيغة الصحيحة:\n\n- I agree with you.\n- She *doesn't* agree.\n\n"
              "### مثال على الكود\n\n```python\ndef greet(name):\n    return 'Hello, ' + name  # a very long line to force horizontal scrolling inside the code box ................................\n```\n\n"
              "1. Use `agree` as a verb.\n2. لا نستعمل am مع agree.\n\n---\n\nThe weather is lovely today, isn't it? هذه جملة للتدريب على الحوار.\n\n| a | b |\n| - | - |\n| 1 | 2 |")


def run():
    def wait(page, js, timeout=8000):
        # polling with evaluate: wait_for_function would use eval, which the page CSP forbids
        import time
        t0 = time.time()
        while time.time() - t0 < timeout / 1000:
            if page.evaluate('!!(' + js + ')'):
                return
            page.wait_for_timeout(40)
        raise AssertionError('timeout waiting for: ' + js[:120])

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='ar-DZ', timezone_id='Africa/Algiers')
        ctx.add_init_script(SEED)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)[:300]))
        page.on('console', lambda m: errors.append('console: ' + m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)

        def load(mock=True):
            page.goto(URL); wait(page, 'window.Fasih && Fasih.S && Fasih.chat')
            page.wait_for_timeout(250)
            if mock:
                page.evaluate(MOCK)

        def idle():
            wait(page, '!document.querySelector(".ch-send.stop") && !document.querySelector(".ch-typing")', timeout=8000)
            page.wait_for_timeout(80)

        def send(text):
            page.fill('.chat textarea', text); page.click('.ch-send')

        def q(js):
            return page.evaluate(js)

        def shot(name, dark=False):
            page.evaluate(f'Fasih.S.set.theme = "{"dark" if dark else "light"}"; Fasih.applyTheme()')
            page.wait_for_timeout(120); page.screenshot(path=f'{OUT}/{name}-{"dark" if dark else "light"}.png')

        def fresh(spec=None):
            """new conversation through the public API; waits until idle"""
            if spec is not None:
                q(f'__m.queue.push({json.dumps(spec)})')
            q('Fasih.chat.start({title: "Req", system: "SYS", user: "hello"})'); idle()

        # ---------------- unavailable in a plain browser ----------------
        load(mock=False)
        ok('plain browser: available() and ready() are false', q('Fasih.chat.available() === false && Fasih.chat.ready("claude") === false'))
        q('Fasih.chat.keys()')
        ok('plain browser: keys() shows the app-only message', 'وضع API متاح في تطبيق الأندرويد فقط.' in q('document.querySelector(".sheetw").innerText'))
        q('Fasih.closeSheet(); Fasih.chat.open()')
        ok('plain browser: open() shows the message and no chat screen', q('!document.querySelector(".chat") && document.querySelector(".sheetw").innerText.includes("الأندرويد")'))
        q('Fasih.closeSheet()')

        # ---------------- 1. adapters ----------------
        load()
        r = q(r"""(() => {
          const P = Fasih.chat.providers, o = {};
          const hist = [{role: 'user', text: 'hi', img: '7'}, {role: 'assistant', text: 'yo'}, {role: 'user', text: 'again'}];
          for (const k of Object.keys(P)) { const m = k === 'gemini' ? 'gem-x' : 'model-1'; const b = P[k].chat.build(m, 'SYS', hist); o[k] = {path: b.path, body: JSON.parse(b.body), raw: b.body}; }
          o.mp = Object.fromEntries(Object.keys(P).map(k => [k, P[k].models.path]));
          o.claudeDelta = [P.claude.chat.delta({type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: 'ello frien'}}), P.claude.chat.delta({type: 'ping'}), P.claude.chat.delta({type: 'content_block_delta', index: 1, delta: {type: 'input_json_delta', partial_json: '{'}}), P.claude.chat.delta({type: 'message_start', message: {}})];
          o.claudeErr = [P.claude.chat.error({type: 'error', error: {type: 'overloaded_error', message: 'Overloaded'}}), P.claude.chat.error({type: 'content_block_delta', delta: {type: 'text_delta', text: 'x'}})];
          o.oaDelta = ['chatgpt', 'grok'].map(k => [P[k].chat.delta({id: 'c', object: 'chat.completion.chunk', choices: [{index: 0, delta: {content: 'Hel'}, finish_reason: null}]}), P[k].chat.delta({choices: [{index: 0, delta: {role: 'assistant', content: ''}}]}), P[k].chat.delta({choices: [], usage: {total_tokens: 3}}), P[k].chat.delta({choices: [{index: 0, delta: {}, finish_reason: 'stop'}]})]);
          o.oaErr = [P.chatgpt.chat.error({error: {message: 'Rate limit reached', type: 'x'}}), P.grok.chat.error({error: 'plain grok error'}), P.chatgpt.chat.error({choices: [{delta: {content: 'a'}}]})];
          o.gDelta = [P.gemini.chat.delta({candidates: [{content: {parts: [{text: 'Hi '}, {text: 'there'}], role: 'model'}, index: 0}]}), P.gemini.chat.delta({candidates: [{finishReason: 'STOP'}]}), P.gemini.chat.delta({promptFeedback: {blockReason: 'SAFETY'}})];
          o.gErr = [P.gemini.chat.error({promptFeedback: {blockReason: 'SAFETY'}}), P.gemini.chat.error({error: {code: 400, message: 'API key not valid', status: 'INVALID_ARGUMENT'}}), P.gemini.chat.error({candidates: [{content: {parts: [{text: 'x'}]}}]})];
          const bad = {};
          for (const k of Object.keys(P)) { for (const id of ['a b', 'x/../y', 'a?b', '', 'q"w']) { try { P[k].chat.build(id, 's', hist); bad[k + ':' + id] = false; } catch (e) { bad[k + ':' + id] = true; } } }
          o.bad = bad;
          o.models = {};
          for (const k of Object.keys(P)) o.models[k] = P[k].models.parse(__m.models[k]).map(x => x.id + '|' + x.name);
          o.noKeyBuild = P.claude.chat.build('m', '', [{role: 'user', text: 'x'}]);
          return o;
        })()""")
        c, g, a2, gr = r['claude'], r['gemini'], r['chatgpt'], r['grok']
        ok('adapter claude: path, system placement, no system role, max_tokens, stream',
           c['path'] == '/v1/messages' and c['body']['system'] == 'SYS' and c['body']['max_tokens'] == 4096 and c['body']['stream'] is True and all(m['role'] in ('user', 'assistant') for m in c['body']['messages']) and c['body']['model'] == 'model-1', c)
        cm = c['body']['messages']
        ok('adapter claude: content blocks (text then base64 image with token)',
           cm[0]['content'][0] == {'type': 'text', 'text': 'hi'} and cm[0]['content'][1] == {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': '@@IMG:7@@'}} and cm[1]['content'] == [{'type': 'text', 'text': 'yo'}], cm)
        for k, d in (('chatgpt', a2), ('grok', gr)):
            m = d['body']['messages']
            ok(f'adapter {k}: path, system message first, image_url data URL, no max-token field',
               d['path'] == '/v1/chat/completions' and m[0] == {'role': 'system', 'content': 'SYS'} and d['body']['stream'] is True
               and m[1]['content'] == [{'type': 'text', 'text': 'hi'}, {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,@@IMG:7@@'}}]
               and m[2] == {'role': 'assistant', 'content': 'yo'} and m[3] == {'role': 'user', 'content': 'again'}
               and set(d['body'].keys()) == {'model', 'stream', 'messages'} and 'max_tokens' not in d['raw'] and 'max_completion_tokens' not in d['raw'], d)
        gc = g['body']['contents']
        ok('adapter gemini: path, system_instruction, roles user/model, inline_data',
           g['path'] == '/v1beta/models/gem-x:streamGenerateContent?alt=sse' and g['body']['system_instruction'] == {'parts': [{'text': 'SYS'}]}
           and [x['role'] for x in gc] == ['user', 'model', 'user'] and gc[0]['parts'] == [{'text': 'hi'}, {'inline_data': {'mime_type': 'image/jpeg', 'data': '@@IMG:7@@'}}] and set(g['body'].keys()) == {'contents', 'system_instruction'}, g)
        ok('adapter paths all match the native path pattern',
           all(PATHRE.match(x['path']) for x in (c, g, a2, gr)) and all(PATHRE.match(v) for v in r['mp'].values()) and r['mp'] == {'claude': '/v1/models?limit=100', 'chatgpt': '/v1/models', 'grok': '/v1/models', 'gemini': '/v1beta/models?pageSize=200'}, r['mp'])
        ok('adapter claude: delta/error from official stream samples', r['claudeDelta'] == ['ello frien', '', '', ''] and r['claudeErr'] == ['Overloaded', None], r['claudeDelta'])
        ok('adapter chatgpt/grok: delta/error from official chunk samples', r['oaDelta'] == [['Hel', '', '', ''], ['Hel', '', '', '']] and r['oaErr'] == ['Rate limit reached', 'plain grok error', None], r['oaDelta'])
        ok('adapter gemini: delta/error incl. blocked prompt', r['gDelta'] == ['Hi there', '', ''] and r['gErr'][0] == 'Prompt blocked: SAFETY' and r['gErr'][1] == 'API key not valid' and r['gErr'][2] is None, r['gDelta'])
        ok('adapters reject unsafe model ids', all(r['bad'].values()), [k for k, v in r['bad'].items() if not v])
        ok('adapter claude: empty system omitted', 'system' not in json.loads(r['noKeyBuild']['body']))
        ms = r['models']
        ok('model lists: filtered and newest first', ms['claude'] == ['claude-new-9|New Nine', 'claude-old-1|Old One'] and ms['chatgpt'] == ['gpt-b|gpt-b', 'gpt-a|gpt-a'] and ms['gemini'] == ['gemini-z|Gem Z', 'gemini-a|Gem A'] and ms['grok'] == ['grok-a|grok-a'], ms)

        # ---------------- md helper ----------------
        h = q('Fasih.chat.md("# T\\n\\n**b** *i* `c<d>` [x](https://e.com) <b>raw</b>\\n- a\\n- b\\n\\n1. one\\n\\n```js\\nif (a<b) {}\\n```\\n---\\n| x | y |")')
        ok('md: allowed constructs', all(s in h for s in ['<b>T</b>', '<b>b</b>', '<i>i</i>', '<code>c&lt;d&gt;</code>', 'x (https://e.com)', '&lt;b&gt;raw&lt;/b&gt;', '<ul', '<ol', '<pre class="code" dir="ltr"><code>if (a&lt;b) {}</code></pre>', '<hr>', 'class="mdt"']) and '<a' not in h, h)

        # ---------------- 2. streaming ----------------
        for prov in ('claude', 'chatgpt', 'gemini', 'grok'):
            q(f'Fasih.S.tutor.ai = "{prov}"; Fasih.S.chat.cur = null')
            text = 'Hello **world**: مرحباً بك في فصيح\nسطر ثانٍ with "quotes" and \\ backslash.'
            q(f'__m.queue.push({json.dumps({"text": text, "cut": 5, "gap": 1})})')
            q('Fasih.chat.start({title: "S", system: "SYS", user: "go"})'); idle()
            got = q('Fasih.chat.current().msgs.map(m => m.text)')
            shown = q('document.querySelector(".ch-a .ch-t").innerText')
            ok(f'streaming {prov}: chunks cut mid-line assemble exactly ([DONE] stops)', got == ['go', text] and 'AFTERDONE' not in got[1] and 'Hello world' in shown, got)
            q('Fasih.chat.close()')
        q('Fasih.S.tutor.ai = "claude"')
        q('__m.queue.push({text: "partial words that keep coming and coming and coming", cut: 6, gap: 40, hang: true})')
        q('Fasih.chat.start({title: "C", system: "SYS", user: "cancel me"})')
        wait(page, 'Fasih.chat.current().msgs.length > 1 && Fasih.chat.current().msgs[1].text.length > 8')
        ok('streaming: send button turns into stop while streaming', q('document.querySelector(".ch-send").textContent') == '■')
        page.click('.ch-send'); page.wait_for_timeout(250)
        part = q('Fasih.chat.current().msgs[1] && Fasih.chat.current().msgs[1].text')
        ok('cancel keeps the partial text, cancels transport, no error bubble', q('__m.cancelled') >= 1 and part and part.startswith('partial') and not q('document.querySelector(".ch-err")') and q('document.querySelector(".ch-send").textContent') == '➤', part)
        page.wait_for_timeout(200)
        ok('cancel: text stays unchanged afterwards', q('Fasih.chat.current().msgs[1].text') == part)
        q('Fasih.chat.close()')
        fresh({'text': 'half an answer', 'cut': 9, 'after': 'error', 'status': 0, 'body': 'connection reset'})
        m = q('Fasih.chat.current().msgs[1]')
        ok('mid-stream transport error keeps partial text and shows the error bubble', m['text'] == 'half an answer' and m['err']['s'] == 0 and 'half an answer' in q('document.querySelector(".ch-a").innerText') and 'لا اتصال بالإنترنت أو انتهت المهلة.' in q('document.querySelector(".ch-err").innerText'), m)
        q('Fasih.chat.close()')
        fresh({'text': 'some text', 'streamErr': 'Overloaded'})
        m = q('Fasih.chat.current().msgs[1]')
        ok('in-stream error object keeps partial text and shows provider message', m['text'] == 'some text' and 'Overloaded' in q('document.querySelector(".ch-raw").innerText'), m)
        q('Fasih.chat.close()')

        # ---------------- 3. UI flow ----------------
        load()
        q('Fasih.chat.transport.keys = () => __m.keys; Object.keys(__m.keys).forEach(k => { __m.keys[k] = false; }); Fasih.S.chat = {model: {}, cur: null, convs: []}; Fasih.S.tutor.ai = "claude"')
        q('Fasih.chat.keys()')
        t = q('document.querySelector(".sheetw").innerText')
        ok('keys sheet: four providers, "no key" state and the explanation', all(n in t for n in ['Claude', 'ChatGPT', 'Gemini', 'Grok']) and t.count('لا مفتاح') == 4 and 'فصيح لا يملك خوادم ولا يرى محادثاتك' in t and q('document.querySelectorAll(".kx-links [data-u]").length') == 4, t)
        ok('start() without a key opens the keys sheet instead of a chat', q('Fasih.chat.start({title: "x", system: "s", user: "u"})') is False and not q('document.querySelector(".chat")'))
        page.click('.kx-row [data-k=claude]'); page.wait_for_timeout(100)
        ok('keys sheet: askKey called, row refreshes on the aikey event, ready() true',
           q('__m.asked') == ['claude'] and 'محفوظ ✓' in q('document.querySelector(".sheetw").innerText') and q('Fasih.chat.ready("claude")') is True and q('Fasih.chat.ready("gemini")') is False)
        q('window.__urls = []; Fasih.openUrl = u => __urls.push(u); 0'); page.click('.kx-links [data-u=gemini]')
        urls = q('window.__urls'); ok('keys sheet: console button opens the provider page', bool(urls) and urls[0].startswith('https://aistudio.google.com'), urls)
        q('Fasih.closeSheet()')
        q('__m.queue.push({text: "First **reply** here.", cut: 7})')
        q('Fasih.chat.start({title: "درس اليوم", system: "SYS-FROM-TUTOR", user: "Please help me", img: ""})')
        page.wait_for_selector('.cp-it', timeout=5000)
        items = q('Array.from(document.querySelectorAll(".cp-it")).map(e => e.querySelector("small").textContent)')
        ok('model picker opens on first use, newest first, with the hint', items == ['claude-new-9', 'claude-old-1'] and 'الأحدث في الأعلى' in q('document.querySelector(".sheetw").innerText') and 'أو اكتب معرّف النموذج' in q('document.querySelector(".sheetw").innerText'), items)
        ok('model picker: nothing sent before a model is chosen', len([x for x in q('__m.calls') if x['method'] == 'POST']) == 0)
        page.fill('.cp-q', 'old'); ok('model picker: search filters', q('document.querySelectorAll(".cp-it").length') == 1)
        page.fill('.cp-q', ''); page.click('.cp-it[data-id=claude-new-9]'); idle()
        calls = [x for x in q('__m.calls') if x['method'] == 'POST']
        body = json.loads(calls[0]['body'])
        ok('after choosing a model the pending message is sent (system from start(), chosen model)', len(calls) == 1 and body['model'] == 'claude-new-9' and body['system'] == 'SYS-FROM-TUTOR' and body['messages'][0]['content'][0]['text'] == 'Please help me', calls)
        ok('reply streamed into the screen; header shows provider and model; request card shown',
           'First reply here.' in q('document.querySelector(".ch-a .ch-t").innerText') and 'Claude' in q('document.querySelector(".ch-ti").innerText') and 'claude-new-9' in q('document.querySelector(".ch-ti").innerText')
           and 'درس اليوم' in q('document.querySelector(".ch-req").innerText') and q('!!document.querySelector(".ch-req details")'))
        ok('F.runner is set while the chat is open', q('!!(Fasih.runner && typeof Fasih.runner.askClose === "function")'))
        q('__m.queue.push({text: "Second reply."})'); send('and a second question'); idle()
        calls = [x for x in q('__m.calls') if x['method'] == 'POST']; body = json.loads(calls[1]['body'])
        ok('second message: history sent in order', [m['role'] for m in body['messages']] == ['user', 'assistant', 'user'] and body['messages'][1]['content'][0]['text'] == 'First **reply** here.', body['messages'])
        ok('conversation saved: 4 messages', q('Fasih.S.chat.convs.length') == 1 and q('Fasih.S.chat.convs[0].msgs.length') == 4)
        q('Fasih.flush()')
        load()
        q('Fasih.chat.open()')
        ok('after reload the conversation is still there', q('Fasih.S.chat.convs[0].msgs.length') == 4 and 'Second reply.' in q('document.querySelector(".ch-b").innerText') and q('Fasih.S.chat.model.claude') == 'claude-new-9')
        # menu: new chat, history, delete
        page.click('.ch-mn'); ok('menu shows the three entries', all(s in q('document.querySelector(".ch-menu").innerText') for s in ['محادثة جديدة', 'المحادثات السابقة', '🔑 المفاتيح']))
        page.click('.ch-menu [data-c=new]'); ok('new conversation shows the welcome and 4 suggestions', q('document.querySelectorAll(".ch-sug .chip").length') == 4 and q('!document.querySelector(".ch-m")'))
        page.click('.ch-sug .chip'); ok('suggestion fills the composer', q('document.querySelector(".chat textarea").value').startswith('صحّح هذه الجملة'))
        page.click('.ch-mn'); page.click('.ch-menu [data-c=list]'); page.wait_for_timeout(100)
        ok('history sheet lists the saved conversation', q('document.querySelectorAll(".cl-row").length') == 1)
        page.click('.cl-open'); page.wait_for_timeout(100)
        ok('tapping a saved conversation reopens it', 'Second reply.' in q('document.querySelector(".ch-b").innerText'))
        page.click('.ch-mn'); page.click('.ch-menu [data-c=list]'); page.click('.cl-del'); page.click('.sheet .yes'); page.wait_for_timeout(150)
        ok('delete removes the conversation', q('Fasih.S.chat.convs.length') == 0 and 'لا محادثات' in q('document.querySelector(".sheetw").innerText'))
        q('Fasih.closeSheet()')
        q('Fasih.chat.close()')
        ok('close clears F.runner and removes the screen', q('Fasih.runner === null && !document.querySelector(".chat")'))
        # caps
        q('Fasih.S.chat = {model: {claude: "claude-new-9"}, cur: null, convs: []}')
        q('Fasih.chat.transport.keys = () => __m.keys; __m.keys.claude = true')
        for i in range(13):
            q(f'__m.queue.push({{text: "ok {i}", step: 3}}); Fasih.chat.start({{title: "conv-{i}", system: "s", user: "u{i}"}})'); idle()
        titles = q('Fasih.S.chat.convs.map(c => c.title)')
        ok('13th conversation drops the oldest (12 kept, newest first, current kept)', len(titles) == 12 and titles[0] == 'conv-12' and 'conv-0' not in titles and q('Fasih.S.chat.cur') == q('Fasih.S.chat.convs[0].id'), titles)
        q('Fasih.chat.current().msgs = Array.from({length: 79}, (_, i) => ({role: i % 2 ? "assistant" : "user", text: "m" + i, at: 1}))')
        q('__m.queue.push({text: "last reply"})'); send('the 80th'); idle()
        mm = q('Fasih.chat.current().msgs.map(m => m.text)')
        ok('81st message is trimmed (80 kept, first kept, newest kept)', len(mm) == 80 and mm[0] == 'm0' and mm[-1] == 'last reply' and mm[-2] == 'the 80th', (len(mm), mm[:2], mm[-2:]))
        q('Fasih.chat.current().msgs[1].text = "x".repeat(300000); Fasih.S.chat.convs[3].msgs[0].text = "y".repeat(200000); Fasih.S.chat.convs[5].msgs[0].text = "z".repeat(200000); __m.queue.push({text: "r"})'); send('trigger'); idle()
        tot = q('Fasih.S.chat.convs.reduce((a, c) => a + (c.sys || "").length + c.msgs.reduce((b, m) => b + m.text.length, 0), 0)')
        ok('total text capped at 400000 chars, current conversation kept', tot <= 400000 and q('Fasih.S.chat.convs[0].id === Fasih.S.chat.cur'), tot)
        q('Fasih.chat.close()')

        # ---------------- 4. pack card ----------------
        load()
        q('Fasih.S.chat = {model: {claude: "claude-new-9"}, cur: null, convs: []}')
        PACK = 'Here is your pack:\n\n```json\n{"fasih":1,"title":"Legal words <img src=x onerror=window.__pwn=1>","words":[]}\n```\n\nEnjoy studying!'
        q(f'__m.queue.push({json.dumps({"text": PACK, "step": 4, "cut": 12, "gap": 25})})')
        q('Fasih.chat.start({title: "pack", system: "s", user: "make a pack"})')
        wait(page, '(document.querySelector(".ch-live .ch-t") || {innerText: ""}).innerText.includes("يجهّز المعلّم")', timeout=8000)
        live = q('document.querySelector(".ch-live .ch-t").innerText')
        ok('while streaming the partial pack block is hidden behind a placeholder line', '"fasih"' not in live and '{' not in live and 'يجهّز المعلّم حزمة فصيح' in live, live)
        idle()
        card = q('document.querySelector(".ch-pack") && document.querySelector(".ch-pack").innerText')
        ok('pack card shown with its title and the button, raw JSON hidden',
           card and '📦 حزمة فصيح' in card and 'Legal words' in card and 'راجعها وأضفها' in card and '"fasih"' not in q('document.querySelector(".ch-b").innerText') and 'Enjoy studying!' in q('document.querySelector(".ch-a .ch-t").innerText') and not q('document.querySelector(".ch-t pre")'), card)
        shot('4-pack', False)
        page.click('.ch-pack [data-c=pack]')
        ok('tap calls F.tutor.preview with the pack', q('window.__prev && window.__prev.fasih') == 1 and q('window.__prev.words.length') == 0)
        q('window.__cb(true)'); page.wait_for_timeout(100)
        ok('after import: "أُضيفت ✓" replaces the button and imp is persisted', 'أُضيفت ✓' in q('document.querySelector(".ch-pack").innerText') and not q('document.querySelector(".ch-pack button")') and q('Fasih.chat.current().msgs[1].imp') == 1)
        q('Fasih.flush()')
        load(); q('Fasih.chat.open()')
        ok('imp survives a reload (card still shows "added")', 'أُضيفت ✓' in q('document.querySelector(".ch-pack").innerText'))
        shot('pack-card', False); shot('pack-card', True)
        q('Fasih.chat.close()')

        # ---------------- 5. errors ----------------
        CASES = [(401, '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}', 'المفتاح غير صحيح أو لا يملك صلاحية هذا النموذج.', 'invalid x-api-key', '🔑 المفاتيح'),
                 (404, '{"type":"error","error":{"type":"not_found_error","message":"model: nope"}}', 'هذا النموذج غير متاح لمفتاحك. اختر نموذجاً آخر.', 'model: nope', 'اختر نموذجاً'),
                 (429, '{"type":"error","error":{"type":"rate_limit_error","message":"Rate limited"}}', 'بلغتَ حدّ الاستعمال أو انتهى رصيدك لدى Claude.', 'Rate limited', None),
                 (400, '{"type":"error","error":{"type":"invalid_request_error","message":"credit balance is too low"}}', 'رفض Claude الطلب.', 'credit balance is too low', None),
                 (500, 'Internal Server Error', 'خدمة Claude مشغولة الآن. أعد المحاولة بعد قليل.', 'Internal Server Error', None),
                 (529, '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', 'خدمة Claude مشغولة الآن. أعد المحاولة بعد قليل.', 'Overloaded', None),
                 (0, 'timeout after 60s', 'لا اتصال بالإنترنت أو انتهت المهلة.', 'timeout after 60s', None)]
        load()
        q('Fasih.S.chat = {model: {claude: "claude-new-9"}, cur: null, convs: []}')
        for status, body, line, raw, btn in CASES:
            q('Fasih.chat.close()')
            fresh({'err': {'status': status, 'body': body}})
            t = q('document.querySelector(".ch-err").innerText')
            rawel = q('document.querySelector(".ch-raw") && document.querySelector(".ch-raw").getAttribute("dir")')
            ok(f'error {status}: Arabic line + raw provider message (ltr)' + (f' + button {btn}' if btn else ''), line in t and raw in t and rawel == 'ltr' and '↻' in t and (btn is None or btn in t), t)
            if status == 401:
                shot('5-error', False); shot('5-error', True)
        q('Fasih.chat.close()')
        fresh({'err': {'status': 500, 'body': 'boom'}})
        before = [x for x in q('__m.calls') if x['method'] == 'POST']
        q('__m.queue.push({text: "recovered fine"})'); page.click('[data-c=retry]'); idle()
        after = [x for x in q('__m.calls') if x['method'] == 'POST']
        ok('retry resends the same request and replaces the error bubble', len(after) == len(before) + 1 and after[-1]['body'] == before[-1]['body'] and not q('document.querySelector(".ch-err")') and 'recovered fine' in q('document.querySelector(".ch-b").innerText') and q('Fasih.chat.current().msgs.length') == 2)
        q('Fasih.chat.close()')
        fresh({'err': {'status': 404, 'body': '{}'}})
        page.click('[data-c=model]'); page.wait_for_selector('.cp-it'); ok('404 error button opens the model picker', True)
        page.fill('.cp-id', 'bad id!'); page.click('.cp-use'); ok('free-text model id with illegal characters is rejected', q('Fasih.S.chat.model.claude') == 'claude-new-9')
        page.fill('.cp-id', 'claude-custom-1'); page.click('.cp-use'); page.wait_for_timeout(100)
        ok('free-text model id accepted', q('Fasih.S.chat.model.claude') == 'claude-custom-1' and 'claude-custom-1' in q('document.querySelector(".ch-ti").innerText'))
        q('Fasih.S.chat.model.claude = "claude-new-9"; Fasih.chat.close()')

        # ---------------- 6. security ----------------
        load()
        q('Fasih.S.chat = {model: {claude: "claude-new-9"}, cur: null, convs: []}')
        EVIL = ('<img src=x onerror=window.__pwn=1> and <script>window.__pwn=1</script> and [x](javascript:window.__pwn=1)\n\n'
                '**<svg onload=window.__pwn=1>** `<iframe src=javascript:1>`\n\n```html\n<script>window.__pwn=1</script><img src=x onerror=window.__pwn=1>\n```\n\n- <a href="javascript:window.__pwn=1">li</a>\n\n# <img src=x onerror=window.__pwn=1>')
        TITLE = '<img src=x onerror=window.__pwn=1><script>window.__pwn=1</script>'
        q(f'__m.queue.push({json.dumps({"text": EVIL, "cut": 11})}); Fasih.chat.start({{title: {json.dumps(TITLE)}, system: "s", user: {json.dumps(TITLE)}}})'); idle()
        page.wait_for_timeout(400)
        n = q('({img: document.querySelectorAll(".ch-b img").length, script: document.querySelectorAll(".chat script").length, a: document.querySelectorAll(".chat a").length, svg: document.querySelectorAll(".chat svg, .chat iframe").length, pwn: typeof window.__pwn})')
        ok('security: no img/script/a/svg/iframe created from model text or titles, __pwn undefined', n == {'img': 0, 'script': 0, 'a': 0, 'svg': 0, 'pwn': 'undefined'}, n)
        txt = q('document.querySelector(".ch-b").innerText')
        ok('security: payloads are shown as plain text; links become "label (url)"', '<img src=x' in txt and 'x (javascript:window.__pwn=1)' in txt and q('document.querySelector(".ch-req b").textContent') == TITLE, txt[:200])
        q('Fasih.chat.keys(); Fasih.closeSheet()')
        page.click('.ch-mn'); page.click('.ch-menu [data-c=list]'); page.wait_for_timeout(100)
        ok('security: conversation list escapes the title too', q('document.querySelectorAll(".sheetw img, .sheetw script").length') == 0 and q('typeof window.__pwn') == 'undefined' and '<img src=x' in q('document.querySelector(".cl-open b").textContent'))
        q('Fasih.closeSheet()')
        q('Fasih.chat.close()')
        q('window.__prev = null')
        PK2 = 'x\n\n```json\n{"fasih":1,"title":"<img src=x onerror=window.__pwn=1>"}\n```'
        q(f'__m.queue.push({json.dumps({"text": PK2})}); Fasih.chat.start({{title: "t", system: "s", user: "u"}})'); idle(); page.wait_for_timeout(200)
        ok('security: pack title is escaped', q('document.querySelectorAll(".ch-pack img").length') == 0 and q('typeof window.__pwn') == 'undefined' and '<img src=x' in q('document.querySelector(".ch-pack").innerText'))
        q('Fasih.chat.close()')

        # ---------------- 7. photo ----------------
        load()
        q('Fasih.S.chat = {model: {claude: "claude-new-9", chatgpt: "gpt-b", gemini: "gemini-z", grok: "grok-a"}, cur: null, convs: []}')
        q('Fasih.img = {ok: () => true, pick: (s, cb) => { window.__src = s; cb({id: "7", w: 800, h: 600}); }, url: id => "/shots/" + id + ".jpg"}')
        def at(body, prov):
            if prov == 'claude': return body['messages'][-1]['content'][1]['source']['data']
            if prov == 'gemini': return body['contents'][-1]['parts'][1]['inline_data']['data']
            return body['messages'][-1]['content'][1]['image_url']['url']
        for prov in ('claude', 'chatgpt', 'gemini', 'grok'):
            q(f'Fasih.S.tutor.ai = "{prov}"; Fasih.S.chat.cur = null; Fasih.chat.close(); Fasih.chat.open()')
            page.click('[data-c=photo]'); ok(f'photo {prov}: camera menu offers both sources', 'التقط صورة' in q('document.querySelector(".ch-cam").innerText') and 'من المعرض' in q('document.querySelector(".ch-cam").innerText'))
            page.click('[data-c=cam][data-s=gallery]'); page.wait_for_timeout(80)
            ok(f'photo {prov}: thumbnail chip appears', q('!document.querySelector(".ch-chip").hidden') and q('__src') == 'gallery')
            send('what is this?'); idle()
            last = [x for x in q('__m.calls') if x['method'] == 'POST'][-1]
            body = json.loads(last['body'])
            ok(f'photo {prov}: token @@IMG:7@@ in the right place', '@@IMG:7@@' in last['body'] and last['body'].count('@@IMG:7@@') == 1 and ('@@IMG:7@@' in at(body, prov)), last['body'][:200])
            ok(f'photo {prov}: chip cleared, stored message keeps only the id', q('document.querySelector(".ch-chip").hidden') and q('Fasih.chat.current().msgs[0].img') == '7' and 'base64' not in q('JSON.stringify(Fasih.S.chat)'))
        q('Fasih.S.tutor.ai = "claude"; Fasih.S.chat.cur = null; Fasih.chat.close()')
        q('__m.queue.push({text: "seen"}); Fasih.chat.start({title: "img", system: "s", user: "look", img: "7"})'); idle()
        ok('start({img}) sends the photo with the first message', '@@IMG:7@@' in [x for x in q('__m.calls') if x['method'] == 'POST'][-1]['body'])
        q('Fasih.chat.current().msgs = [1, 2, 3].flatMap(i => [{role: "user", text: "p" + i, img: String(i), at: 1}, {role: "assistant", text: "a" + i, at: 1}])')
        send('no photo now'); idle()
        body = [x for x in q('__m.calls') if x['method'] == 'POST'][-1]['body']
        ok('only the two most recent photos are sent, older become text', body.count('@@IMG:') == 2 and '@@IMG:2@@' in body and '@@IMG:3@@' in body and '@@IMG:1@@' not in body and '[photo no longer attached]' in body, body[:300])
        ok('a photo that fails to load is hidden', q('(() => { const i = document.querySelector(".ch-u img"); return !i || i.style.display === "none" || !i.complete || i.naturalWidth === 0; })()'))
        q('Fasih.chat.close()')

        # ---------------- misc: tts / copy / mic ----------------
        load()
        q('Fasih.S.chat = {model: {claude: "claude-new-9"}, cur: null, convs: []}')
        q('window.__said = []; Fasih.tts.speak = (items, done) => { window.__said.push(items.map(x => x.t)); window.__ttsDone = done; return "t"; }; Fasih.tts.stop = () => { window.__stopped = 1; }')
        q(f'__m.queue.push({json.dumps({"text": SAMPLE_MIX, "step": 40, "cut": 400, "gap": 1})}); Fasih.chat.start({{title: "x", system: "s", user: "mix"}})'); idle()
        page.click('[data-c=speak]'); page.wait_for_timeout(50)
        said = q('__said[0]')
        ok('listen reads English lines only (skips Arabic lines, code and tables)', said and all(not re.search(r'[؀-ۿ]', s) for s in said) and any('I agree with you.' in s for s in said) and not any('def greet' in s for s in said) and not any('| a' in s for s in said), said)
        page.click('[data-c=speak]'); ok('tapping listen again stops', q('window.__stopped') == 1)
        # screenshots of the mixed conversation
        page.set_viewport_size({'width': 390, 'height': 844})
        shot('2-mixed', False); shot('2-mixed', True)
        pre = q('(() => { const p = document.querySelector(".ch-t pre"); const m = document.querySelector(".ch-b"); return [getComputedStyle(p).direction, p.scrollWidth > p.clientWidth, m.scrollWidth <= m.clientWidth + 1]; })()')
        ok('code block is LTR, scrolls inside its own box, page does not overflow', pre == ['ltr', True, True], pre)
        page.set_viewport_size({'width': 360, 'height': 760}); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/2-mixed-360-dark.png')
        ok('360px: no horizontal overflow', q('document.querySelector(".ch-b").scrollWidth <= document.querySelector(".ch-b").clientWidth + 1'))
        page.set_viewport_size({'width': 390, 'height': 844})
        q('Fasih.chat.close()')

        # ---------------- screenshots: empty chat, picker, keys ----------------
        q('Fasih.S.chat = {model: {}, cur: null, convs: []}; Fasih.chat.open()')
        shot('1-empty', False); shot('1-empty', True)
        q('Fasih.chat.keys()'); shot('6-keys', False); shot('6-keys', True)
        q('Fasih.closeSheet(); document.querySelector(".ch-ti").click()'); page.wait_for_selector('.cp-it')
        shot('3-picker', False); shot('3-picker', True)
        q('Fasih.closeSheet()')
        # keyboard case: the composer must stay visible in a short viewport
        page.set_viewport_size({'width': 390, 'height': 420}); page.wait_for_timeout(100)
        pos = q('(() => { const f = document.querySelector(".ch-f").getBoundingClientRect(); return [f.bottom <= innerHeight + 1, f.top >= 0]; })()')
        ok('composer stays visible when the viewport shrinks (keyboard)', pos == [True, True], pos)
        page.set_viewport_size({'width': 390, 'height': 844})
        q('Fasih.chat.close()')
        b.close()
    ok('no page errors', not errors, errors[:5])
    n = len(results); bad = results.count(False)
    print(f'{n - bad}/{n} checks passed')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    run()

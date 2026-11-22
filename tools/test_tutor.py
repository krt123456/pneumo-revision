#!/usr/bin/env python3
"""Tests for the AI tutor bridge (www/js/tutor.js). usage: test_tutor.py [--no-regression] [shots_dir]
One PASS/FAIL line per check, exit code 1 on any failure. Screenshots (390x844) go to /tmp/tutor-shots/."""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
REGRESSION = '--no-regression' not in sys.argv
SHOTS = args[0] if args else '/tmp/tutor-shots'
os.makedirs(SHOTS, exist_ok=True)
URL = 'file://' + os.path.join(ROOT, 'www', 'index.html')
AUTO = open(os.path.join(ROOT, 'tools', 'auto.js'), encoding='utf-8').read()
results = []
errors = []


def check(name, ok, detail=''):
    results.append(bool(ok))
    print(('PASS ' if ok else 'FAIL ') + name + ((' :: ' + str(detail)[:300]) if (detail and not ok) else ''))


def play(page, label, limit=1500):
    idle = 0
    for _ in range(limit):
        r = page.evaluate('window.__auto(0.85, 0.35)')
        if r == 'closed':
            break
        if r == 'idle':
            idle += 1
            if idle > 300:
                errors.append(f'{label}: stuck: ' + page.evaluate("(document.querySelector('.stage') || {innerText: ''}).innerText.slice(0, 200)"))
                page.evaluate('Fasih.runner && Fasih.runner.close(false)')
                return False
        else:
            idle = 0
        page.wait_for_timeout(3)
    else:
        errors.append(f'{label}: did not finish')
        page.evaluate('Fasih.runner && Fasih.runner.close(false)')
        return False
    page.wait_for_timeout(100)
    page.evaluate('Fasih.closeSheet()')
    return True


def new_page(b, init=None, onboard=True, vp=(390, 844)):
    ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=2, locale='ar-DZ', timezone_id='Africa/Algiers')
    if init:
        ctx.add_init_script(init)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)[:300]))
    page.on('console', lambda m: errors.append('console: ' + m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    page.goto(URL)
    page.wait_for_timeout(500)
    page.evaluate(AUTO)
    page.evaluate('Fasih.debug = true')
    if onboard:
        for _ in range(5):
            page.click('#obx')
        page.click('#obsk')
        page.wait_for_timeout(250)
    page.evaluate('Fasih.S.set.sound = false; Fasih.S.set.auto = false')
    return page


def shot(page, name):
    page.screenshot(path=f'{SHOTS}/{name}.png')


EX10 = [
    {"k": "mc", "q": "She ___ to work by bus every day.", "o": ["go", "goes", "is going"], "a": 1, "why": "المضارع البسيط"},
    {"k": "mc", "q": "They ___ football now.", "o": ["play", "are playing", "plays"], "a": "are playing", "why": "المضارع المستمر"},
    {"k": "gap", "q": "I ______ (not/see) him since Monday.", "a": ["haven't seen", "have not seen"], "why": "المضارع التام"},
    {"k": "fix", "q": "He don't like coffee.", "bad": "don't", "good": ["doesn't", "does not"], "why": "ضمير الغائب"},
    {"k": "order", "a": "I have never been to London.", "ar": "لم أذهب إلى لندن قط."},
    {"k": "trans", "q": "People say that he is very rich.", "start": "He is said", "a": ["He is said to be very rich."], "why": "المبني للمجهول"},
    {"k": "mc", "q": "If I ___ rich, I would travel.", "o": ["am", "were", "will be", "be"], "a": 1, "why": "الشرط الثاني"},
    {"k": "gap", "q": "She has lived here ___ 2015.", "a": ["since"], "why": "since مع نقطة زمنية"},
    {"k": "fix", "q": "I am agree with you.", "bad": "am agree", "good": ["agree"], "why": "agree فعل"},
    {"k": "order", "a": "She has already finished her homework.", "ar": "أنهت واجبها."},
]
READ = {
    "l": "B1", "title": "Open contracts", "paras": [
        "Many cities publish their public contracts online so that citizens can read them.",
        "When contracts are open, companies compete fairly and prices often fall.",
        "However, some officials worry about the cost of publishing every document."],
    "gloss": [{"w": "compete", "ar": "يتنافس"}],
    "qs": [
        {"k": "mc", "q": "Why do cities publish contracts?", "o": ["To hide them", "So citizens can read them", "To raise taxes"], "a": 1, "why": "الفقرة 1"},
        {"k": "tfng", "q": "Open contracts can lower prices.", "a": "T", "why": "الفقرة 2"},
        {"k": "tfng", "q": "All officials support publishing.", "a": "F", "why": "الفقرة 3"},
        {"k": "gap", "q": "Companies ___ fairly when contracts are open.", "a": ["compete"], "why": "الفقرة 2"},
        {"k": "head", "para": 2, "o": ["Worries about cost", "A new law", "Happy citizens"], "a": 0},
        {"k": "mc", "q": "What do some officials worry about?", "o": ["Cost", "Speed"], "a": "Cost", "why": "الفقرة 3"}],
    "sumAr": "المدن تنشر عقودها ليقرأها المواطنون.",
}


def full_pack(prio_w, known_w, new_w):
    return {
        "fasih": 1, "title": "حزمة تجريبية", "note": "ركّز على الأفعال هذا الأسبوع.",
        "words": [
            {"w": new_w, "p": "n", "l": "B2", "ar": "مشتريات عمومية", "d": "the process of buying goods for an organisation", "ex": f"Open {new_w} must be fair.", "x": new_w, "exar": "…", "c": ["public " + new_w]},
            {"w": prio_w, "ar": "كلمة موجودة بلا بطاقة"},
            {"w": known_w, "ar": "كلمة معروفة"}],
        "mistakes": [
            {"q": "I am agree with you.", "bad": "am agree", "good": ["agree"], "why": "agree فعل لا يحتاج am"},
            {"q": "She don't like tea.", "bad": "don't", "good": "doesn't", "why": "ضمير الغائب"},
            {"q": "He go to school every day.", "bad": "go", "good": ["goes"], "why": "s مع he"}],
        "lesson": {"l": "B1", "title": "Present perfect", "titleAr": "المضارع التام", "why": "تحتاجه كثيراً",
                   "rules": [{"ar": "نستعمل have/has مع التصريف الثالث", "form": "S + have/has + V3", "ex": [{"en": "I have finished.", "ar": "لقد أنهيت."}]}],
                   "mistakes": [{"x": "I have seen him yesterday.", "ok": "I saw him yesterday.", "ar": "yesterday يحتاج الماضي البسيط"}],
                   "tip": "have = علاقة بالحاضر", "exs": EX10},
        "reading": READ,
        "quiz": {"title": "تمارين الأزمنة", "exs": EX10[:6]},
        "plan": {"dailyMin": 90, "newPerDay": 16, "domain": 30, "retention": 0.85, "focus": "listening", "focusDays": 5, "why": "الاستماع هو الأضعف عندك"},
    }


def new_word_for(page):
    for c in ['e-procurement', 'audit trail', 'asset declaration', 'integrity pact']:
        if not page.evaluate('w => Fasih.DB.vocab.some(v => v.w.toLowerCase() === w)', c):
            return c
    return 'zyxtestword'


def sheet_count(page):
    return page.evaluate("document.querySelectorAll('.sheetw').length")


def run_all(b):
    # ------------------------------------------------------------------ 1. prompts
    page = new_page(b)
    lvl = page.evaluate('Fasih.level()')
    inputs = {'fix': {'text': 'x' * 12000, 'task': 'Task 2', 'kind': 'w2'}, 'talk': {'mode': 'p2', 'topic': 'law'}, 'words': {'topic': 'public procurement', 'n': 20}, 'lesson': {'topic': 'present perfect'},
              'read': {'topic': 'corruption'}, 'photo': {}, 'plan': {}, 'ask': {'text': 'q' * 2500}, 'word': {'id': page.evaluate('Fasih.DB.tracks.g[3].id')}, 'explain': {'text': 'e' * 5000}}
    bad = []
    for rid, inp in inputs.items():
        r = page.evaluate('([id, i]) => { const b = Fasih.tutor.build(id, i); return { text: b.text, system: b.system, user: b.user, title: b.title, same: Fasih.tutor.prompt(id, i) === b.text }; }', [rid, inp])
        t = r['text']
        if not ('[Fasih tutor request]' in t and '"fasih":1' in t and lvl in t and len(t) < 24000 and r['system'] and r['user'] and r['title'] and r['same'] and t.endswith(r['system'][r['system'].index('FASIH PACK'):]) and r['user'] in t):
            bad.append((rid, len(t)))
    check('1 every request builds a valid prompt (<24000, marker, "fasih":1, level)', not bad, bad)
    t = page.evaluate('Fasih.tutor.build("fix", { text: "w".repeat(12000), task: "T", kind: "w2" }).text')
    check('1 essay of 12000 chars stays under 24000', len(t) < 24000 and 'IELTS band' in t, len(t))
    ok = page.evaluate('''() => { const s = Fasih.tutor.standing(), y = Fasih.tutor.system();
      return s.includes('Whenever I ask for a Fasih pack') && s.includes('"lesson"') && s.includes('"plan"') && s.includes('Question objects') && y.includes('"fasih":1') && y.includes('ABOUT ME'); }''')
    check('1 standing instructions and system prompt', ok)
    tx = page.evaluate('Fasih.tutor.build("read", {}).text')
    check('1 reading request carries the question objects, lesson request the exercise objects', 'Question objects' in tx and 'Exercise objects' in page.evaluate('Fasih.tutor.build("lesson", {}).text') and 'Exercise objects' not in tx)

    # ------------------------------------------------------------------ 2. parse
    pack = {"fasih": 1, "title": "t", "words": [{"w": "alpha", "ar": "ألف"}]}
    pj = json.dumps(pack, ensure_ascii=False)
    P = lambda s: page.evaluate('s => Fasih.tutor.parse(s)', s)
    r = P(pj)
    check('2 parse plain JSON', r['ok'] and r['pack']['title'] == 't')
    long_reply = 'Here is my feedback {not json} and an example {"a": 1, "b": [1,2]}.\n\nنصيحة: راجع الأزمنة.\n```json\n' + pj + '\n```\nGood luck!'
    check('2 parse fenced block inside a long reply with other {...} before', P(long_reply)['ok'])
    curly = pj.replace('"', '\u201c', 1)
    curly = '{\u201cfasih\u201d:1,\u201ctitle\u201d:\u201ccurly\u201d,\u201cwords\u201d:[{\u201cw\u201d:\u201calpha\u201d,\u201car\u201d:\u201cألف\u201d}]}'
    r = P(curly)
    check('2 parse curly quotes', r['ok'] and r['pack']['title'] == 'curly', r)
    r = P('{"fasih":1,"title":"tc","words":[{"w":"alpha","ar":"ألف",},],}')
    check('2 parse trailing commas', r['ok'] and r['pack']['title'] == 'tc', r)
    r = P('Sorry, I cannot help with { that } and the text has no pack at all.')
    check('2 garbage gives err none', (not r['ok']) and r['err'] == 'none', r)
    r = P('```json\n{"fasih":1,"title":"x","words":[{"w":"a" "ar":}\n```')
    check('2 broken pack gives err json', (not r['ok']) and r['err'] == 'json', r)
    r = P('{"fasih":2,"title":"x"}')
    check('2 newer version gives err ver', (not r['ok']) and r['err'] == 'ver', r)
    zw = pj.replace('"fasih"', '"fas\u200bih"')
    check('2 zero-width characters are stripped', P(zw)['ok'])
    o = page.evaluate('s => Fasih.tutor.offer(s)', long_reply)
    check('2 offer returns {ok, pack}', o['ok'] and o['pack']['title'] == 't')
    page.context.close()

    # ------------------------------------------------------------------ 3. full pack
    page = new_page(b)
    S = lambda e: page.evaluate(e)
    page.evaluate('window.__created = []; const o = Fasih.SRS.create; Fasih.SRS.create = (id, g) => { window.__created.push(id); return o(id, g); }; 0')
    prio = page.evaluate('({ w: Fasih.DB.tracks.g[300].w, id: Fasih.DB.tracks.g[300].id })')
    known = page.evaluate('(() => { const v = Fasih.DB.tracks.g[1]; Fasih.SRS.create(v.id, 3); window.__created.length = 0; return { w: v.w, id: v.id }; })()')
    new_w = new_word_for(page)
    before = page.evaluate('({ set: {dailyMin: Fasih.S.set.dailyMin, newPerDay: Fasih.S.set.newPerDay, domain: Fasih.S.set.domain, retention: Fasih.S.set.retention}, cards: Object.keys(Fasih.S.cards).length, custom: Fasih.S.custom.length, vocab: Fasih.DB.vocab.length, byId: Object.keys(Fasih.DB.byId).length, gram: Object.keys(Fasih.S.gram).length })')
    page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(200)
    shot(page, '01-tutor-empty')
    txt = page.evaluate('document.querySelector(".page").innerText')
    check('3 empty tutor page renders (tiles, switcher, how it works)', 'المعلّم الذكي' in txt and 'اطلب من معلّمك' in txt and 'صحّح كتابتي' in txt and 'كيف يعمل المعلّم؟' in txt and page.evaluate('document.querySelectorAll(".tile[data-k=req]").length') == 8 and page.evaluate('document.querySelectorAll(".tu-seg").length') in (0, 1))
    full = full_pack(prio['w'], known['w'], new_w)
    page.evaluate('p => Fasih.tutor.preview(JSON.parse(p))', json.dumps(full, ensure_ascii=False)); page.wait_for_timeout(200)
    prev = page.evaluate('document.querySelector(".tu-prev") ? document.querySelector(".tu-prev").innerText : ""')
    shot(page, '04-preview')
    check('3 preview shows words, mistakes, lesson, reading, quiz and plan rows', new_w in prev and 'agree' in prev and 'Present perfect' in prev and 'Open contracts' in prev and 'تمارين الأزمنة' in prev and 'وقت الدراسة اليومي' in prev and 'أضف إلى خطتي' in prev and 'إلغاء' in prev, prev[:400])
    page.evaluate('document.documentElement.dataset.theme = "dark"'); shot(page, '08-preview-dark'); page.evaluate('document.documentElement.dataset.theme = "light"')
    page.click('.tu-prev .go'); page.wait_for_timeout(300)
    st = page.evaluate('''() => { const S = Fasih.S, T = S.tutor, r = T.packs[0]; return { packs: T.packs.length, hash: location.hash, prio: T.prio.slice(), custom: S.custom.map(v => [v.id, v.tr, v.pk]), lessons: T.lessons.map(l => l.id), readings: T.readings.map(l => l.id), quizzes: T.quizzes.map(l => l.id), mistakes: T.mistakes.map(m => m.id),
      set: { dailyMin: S.set.dailyMin, newPerDay: S.set.newPerDay, domain: S.set.domain, retention: S.set.retention }, focus: T.focus, tracksT: Fasih.DB.tracks.t.length, byId: !!Fasih.DB.byId[T.lessons[0] && T.lessons[0].id], inGrammar: Fasih.DB.grammar.length, inReading: Fasih.DB.reading.length, rec: r }; }''')
    wid = 'x:' + new_w.lower()
    check('3 apply: pack record, new word (tr t), priority word, lesson, reading, quiz, mistakes', st['packs'] == 1 and st['hash'] == '#/tutor' and [wid, 't', 'p1'] in st['custom'] and len(st['custom']) == 1 and st['prio'] == [prio['id']] and st['lessons'] == ['t:l:p1:0'] and st['readings'] == ['t:r:p1:0'] and st['quizzes'] == ['t:q:p1:0'] and st['mistakes'] == ['t:m:p1:0', 't:m:p1:1', 't:m:p1:2'] and st['tracksT'] == 1 and st['byId'], st)
    check('3 apply: known word skipped, tutor material not in D.grammar / D.reading', st['inGrammar'] == before['byId'] * 0 + page.evaluate('Fasih.DB.grammar.length') and page.evaluate('Fasih.DB.grammar.every(g => g.id.slice(0,2) !== "t:") && Fasih.DB.reading.every(g => g.id.slice(0,2) !== "t:")') and wid in page.evaluate('Object.keys(Fasih.DB.byId)') and known['id'] not in st['prio'])
    check('3 plan applied (dailyMin 90, newPerDay 16, domain 30, retention 0.85, focus listening)', st['set'] == {'dailyMin': 90, 'newPerDay': 16, 'domain': 30, 'retention': 0.85} and st['focus']['skill'] == 'listening', st)
    check('3 plan record keeps before/after', st['rec']['plan']['before']['dailyMin'] == before['set']['dailyMin'] and st['rec']['plan']['after']['newPerDay'] == 16)
    page.wait_for_timeout(200)
    txt = page.evaluate('document.querySelector(".page").innerText')
    check('3 tutor page lists pending lesson/reading/quiz/mistakes and the pack', 'بانتظارك' in txt and 'المضارع التام' in txt and 'Open contracts' in txt and 'تمارين الأزمنة' in txt and 'دفتر أخطائي: 3 للمراجعة' in txt and 'حزمة تجريبية' in txt and 'ركّز على الأفعال' in txt, txt[:300])
    shot(page, '02-tutor-pending')
    page.evaluate('document.documentElement.dataset.theme = "dark"'); shot(page, '07-tutor-dark'); page.evaluate('document.documentElement.dataset.theme = "light"')
    page.evaluate('Fasih.go("home")'); page.wait_for_timeout(250)
    check('3 home page shows the tutor card', page.evaluate('!!document.querySelector(".tu-home")') and 'من المعلّم' in page.evaluate('document.querySelector(".tu-home").innerText'))
    page.wait_for_timeout(3000); page.evaluate('document.querySelector(".tu-home").scrollIntoView({block: "center"})'); page.wait_for_timeout(100)
    shot(page, '06-home-card')
    # learning session: tutor words first
    idx = page.evaluate('Fasih.S.day.tasks.findIndex(t => t.t === "learn")')
    page.evaluate(f'Fasih.startTask({idx})'); page.wait_for_timeout(150)
    ok = play(page, 'learn-tutor')
    created = page.evaluate('window.__created')
    check('3 the priority word and the new tutor word are the first two words taught', ok and created[:2] == [prio['id'], wid], created[:4])
    # flows
    page.evaluate('Fasih.startFree("grammar", "t:l:p1:0")'); page.wait_for_timeout(120)
    check('3 tutor lesson flow runs to the end', play(page, 'lesson') and page.evaluate('!!Fasih.S.gram["t:l:p1:0"]'))
    page.evaluate('Fasih.startFree("reading", "t:r:p1:0")'); page.wait_for_timeout(120)
    check('3 tutor reading flow runs to the end', play(page, 'reading') and page.evaluate('!!(Fasih.S.done.reading || {})["t:r:p1:0"]'))
    page.evaluate('Fasih.startFree("tquiz", "t:q:p1:0")'); page.wait_for_timeout(120)
    check('3 tutor quiz flow runs to the end', play(page, 'tquiz') and page.evaluate('!!(Fasih.S.done.tquiz || {})["t:q:p1:0"]'))
    xp0 = page.evaluate('Fasih.S.xp')
    page.evaluate('Fasih.go("tutor/errs")'); page.wait_for_timeout(200); shot(page, '05-errs')
    txt = page.evaluate('document.querySelector(".page").innerText')
    check('3 mistakes notebook page', 'دفتر أخطائي' in txt and 'I am agree with you.' in txt and 'راجع الآن (3)' in txt and page.evaluate('document.querySelectorAll(".tu-err1").length') == 3, txt[:200])
    page.click('[data-k=errrun]'); page.wait_for_timeout(150)
    ok = play(page, 'terr')
    mi = page.evaluate('Fasih.S.tutor.mistakes.map(m => [m.n, m.ok, m.box, m.due - Fasih.dayNum()])')
    check('3 mistakes flow runs; boxes and due dates move', ok and all(m[0] == 1 for m in mi) and all((m[2] == 1 and m[3] == 1) or (m[2] == 0 and m[3] == 1) for m in mi) and page.evaluate('Fasih.S.xp') > xp0, mi)
    # library counters
    page.evaluate('Fasih.go("lib")'); page.wait_for_timeout(150)
    tiles = page.evaluate('Array.from(document.querySelectorAll(".tile small")).map(s => s.innerText)')
    gr = [t for t in tiles if '/' in t and t.strip().endswith(str(page.evaluate('Fasih.DB.grammar.length')))]
    check('3 library counters ignore tutor items (grammar d / 80, reading)', len(gr) >= 1 and all(int(t.split('/')[0]) <= int(t.split('/')[1]) for t in gr) and page.evaluate('Object.keys(Fasih.S.gram).filter(i => i.slice(0, 2) === "t:").length') == 1 and page.evaluate('(() => { const t = Array.from(document.querySelectorAll(".tile")).find(x => x.dataset.go === "list/grammar"); return t.querySelector("small").innerText.split("/")[0].trim(); })()') == '0', tiles)
    # focus task on the next day
    page.evaluate('Fasih.S.day.done = true; Fasih.timeOffset = 864e5; Fasih.ensureDay(); Fasih.checkDay(); Fasih.render()'); page.wait_for_timeout(150)
    fx = page.evaluate('Fasih.S.day.tasks.filter(t => t.fx).map(t => t.t)')
    check('3 focus adds one extra core task marked fx on a fresh day', len(fx) == 1 and fx[0] in ('listening', 'mission') and page.evaluate('Fasih.S.day.tasks.filter(t => t.fx)[0].core'), fx)
    page.evaluate('Fasih.timeOffset = 0')
    # remove
    page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(150)
    page.click('[data-k=pack]'); page.wait_for_timeout(150)
    check('3 pack details sheet has the delete button', page.evaluate('!!document.querySelector(".sheet .del")'))
    page.click('.sheet .del'); page.wait_for_timeout(100)
    page.click('.sheet .yes'); page.wait_for_timeout(250)
    after = page.evaluate('''() => { const S = Fasih.S, T = S.tutor; return { set: { dailyMin: S.set.dailyMin, newPerDay: S.set.newPerDay, domain: S.set.domain, retention: S.set.retention }, custom: S.custom.length, vocab: Fasih.DB.vocab.length,
      wordGone: !Fasih.DB.byId[arguments[0]] , tr: Fasih.DB.tracks.t.length, card: !!S.cards[arguments[0]], lessons: T.lessons.length, readings: T.readings.length, quizzes: T.quizzes.length, mistakes: T.mistakes.length, packs: T.packs.length, prio: T.prio.length, focus: T.focus,
      gram: Object.keys(S.gram).filter(i => i.slice(0, 2) === 't:').length, rd: Object.keys(S.done.reading || {}).filter(i => i.slice(0, 2) === 't:').length, tq: Object.keys(S.done.tquiz || {}).length, ids: Object.keys(Fasih.DB.byId).filter(i => i.slice(0, 2) === 't:' || i === arguments[0]).length, note: S.notes[arguments[0]] }; }'''.replace('arguments[0]', json.dumps(wid)))
    check('3 delete pack restores settings, DB ids, cards, lesson/reading/quiz records', after['set'] == before['set'] and after['custom'] == 0 and after['vocab'] == before['vocab'] and after['wordGone'] and after['tr'] == 0 and not after['card'] and after['lessons'] == after['readings'] == after['quizzes'] == after['mistakes'] == after['packs'] == after['prio'] == 0 and after['focus'] is None and after['gram'] == 0 and after['rd'] == 0 and after['tq'] == 0 and after['ids'] == 0, after)
    page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(150)
    check('3 the tutor page is empty again after delete', 'لا حزم بعد' in page.evaluate('document.querySelector(".page").innerText') and not page.evaluate('!!document.querySelector(".tu-home")'))
    # a setting changed by the learner after the import is NOT reverted
    page.evaluate('p => Fasih.tutor.preview(JSON.parse(p))', json.dumps({"fasih": 1, "title": "plan only", "plan": {"dailyMin": 45, "domain": 40}}))
    page.wait_for_timeout(100); page.click('.tu-prev .go'); page.wait_for_timeout(200)
    page.evaluate('Fasih.applySetting("domain", 10, true)')
    page.evaluate('Fasih.tutor.remove(Fasih.S.tutor.packs[0].id)')
    s2 = page.evaluate('({ d: Fasih.S.set.dailyMin, dom: Fasih.S.set.domain, n: Fasih.S.set.newPerDay })')
    check('3 delete reverts a plan key only while it still equals the proposed value', s2['d'] == before['set']['dailyMin'] and s2['dom'] == 10 and s2['n'] == before['set']['newPerDay'], s2)
    page.context.close()

    # ------------------------------------------------------------------ 4. security
    page = new_page(b)
    X1, X2, X3 = '<img src=x onerror=window.__pwn=1>', '<script>window.__pwn=2</script>', '<img src=x onerror=window.__pwn=3>'
    ex = [dict(e, pre=X3, post=X3, sub=X3, say=X3, keep=True) for e in EX10]
    for e in ex:
        if 'q' in e and e['k'] == 'mc':
            e['q'] = e['q'] + ' ' + X1
    evil = {
        "fasih": 1, "title": X1 + X2, "note": X2 + X1, "__proto__": {"polluted": 1}, "constructor": {"x": 1},
        "words": [{"w": "evil " + X1, "p": "constructor", "l": "Z9", "ar": X1 + X2, "d": X1, "ex": "an " + X1 + " example", "x": X1, "exar": X2, "c": [X1, X2], "f": [X1], "tr": "d", "id": "x:hacked", "onclick": X1}],
        "mistakes": [{"q": "I " + X1 + " am agree", "bad": X1, "good": [X2], "why": X1}],
        "lesson": {"l": "B1", "title": X1, "titleAr": X2, "why": X1, "rules": [{"ar": X1, "form": X2, "ex": [{"en": X1, "ar": X2}]}], "mistakes": [{"x": X1, "ok": X2, "ar": X1}], "tip": X1, "exs": ex, "id": "g-evil", "onclick": X1},
        "reading": dict(READ, title=X1, paras=[X1, X2, "Normal paragraph " + X1], gloss=[{"w": X1, "ar": X2}], sumAr=X1, qs=[dict(q, pre=X3) for q in READ['qs']]),
        "quiz": {"title": X1, "exs": ex[:5]},
        "plan": {"dailyMin": 90, "why": X1 + X2, "focus": "listening", "evil": X1},
    }
    page.evaluate('p => Fasih.tutor.preview(JSON.parse(p))', json.dumps(evil))
    page.wait_for_timeout(200)
    page.click('.tu-prev .go'); page.wait_for_timeout(300)
    lessons_json = page.evaluate('JSON.stringify(Fasih.S.tutor)')
    check('4 no `pre`/`post`/`sub`/`say`/unknown keys survive normalisation', all(('"%s"' % k) not in lessons_json for k in ['pre', 'post', 'sub', 'say', 'keep', 'onclick', 'evil', '__proto__', 'constructor']) and page.evaluate('({}).polluted') is None, lessons_json[:200])
    check('4 invalid values were coerced (pos, level, tr, id)', page.evaluate('(() => { const v = Fasih.S.custom[0]; return v && v.p === "phr" && Fasih.LVN.includes(v.l) && v.tr === "t" && v.id === "x:evil " + v.w.slice(5).toLowerCase(); })()'))
    for route in ['tutor', 'tutor/errs', 'home', 'words', 'lib', 'journey']:
        page.evaluate(f'Fasih.go("{route}")'); page.wait_for_timeout(150)
    page.click('[data-go=tutor]') if page.evaluate('!!document.querySelector("[data-go=tutor]")') else None
    page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(150)
    page.click('[data-k=pack]'); page.wait_for_timeout(120); page.evaluate('Fasih.closeSheet()')
    for sel in [None]:
        pass
    sess = page.evaluate('Fasih.S.day.tasks.findIndex(t => t.t === "learn")')
    page.evaluate(f'Fasih.startTask({sess})'); page.wait_for_timeout(120); play(page, 'evil-learn')
    for kind, ref in [('grammar', 't:l:p1:0'), ('reading', 't:r:p1:0'), ('tquiz', 't:q:p1:0')]:
        page.evaluate(f'Fasih.startFree("{kind}", "{ref}")'); page.wait_for_timeout(120)
        page.evaluate("(() => { const s = document.querySelector('.run .stage'); window.__html = (window.__html || '') + (s ? s.innerHTML : ''); })()")
        play(page, 'evil-' + kind)
    page.evaluate('Fasih.flows.terr({ t: "terr" }, () => Fasih.render())'); page.wait_for_timeout(120); play(page, 'evil-terr')
    wid4 = page.evaluate('Fasih.S.custom[0].id')
    page.evaluate('id => Fasih.wordSheet(id)', wid4); page.wait_for_timeout(100); page.evaluate('Fasih.closeSheet()')
    page.evaluate('Fasih.go("words")'); page.wait_for_timeout(150)
    page.evaluate('Fasih.tutor.requestSheet("word", { id: Fasih.S.custom[0].id })'); page.wait_for_timeout(100)
    page.evaluate('Fasih.tutor.requestSheet("explain", { text: "<img src=x onerror=window.__pwn=5>" })'); page.wait_for_timeout(100); page.evaluate('Fasih.closeSheet()')
    page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(300)
    pwn = page.evaluate('typeof window.__pwn')
    bad_el = page.evaluate('document.querySelectorAll("img[src=x], img[onerror], [onerror], script:not([src])").length')
    check('4 nothing from a hostile pack executes (window.__pwn undefined)', pwn == 'undefined', pwn)
    check('4 no img/script element was created from pack text', bad_el == 0, bad_el)
    check('4 hostile text is shown as text (escaped)', '&lt;img' in page.evaluate('document.body.innerHTML') and page.evaluate('document.body.innerText.includes("<img src=x")'))
    page.context.close()

    # ------------------------------------------------------------------ 5. limits
    page = new_page(b)
    many = {"fasih": 1, "title": "big", "words": [{"w": "zq" + str(i) + "abc".replace('0', 'o'), "ar": "كلمة %d" % i} for i in range(100)], "mistakes": [{"q": "I am agree %d." % i, "bad": "am agree", "good": ["agree"]} for i in range(25)]}
    # words need a latin letter: 'zq' prefix; make them unique letters-only to avoid digits-only issues
    many['words'] = [{"w": "zq" + "".join(chr(97 + int(c)) for c in str(i)), "ar": "كلمة %d" % i} for i in range(100)]
    n = page.evaluate('p => { const n = Fasih.tutor.normalise(JSON.parse(p)); return { words: n.words.length, mistakes: n.mistakes.length, drop: n.drop }; }', json.dumps(many))
    check('5 100 words -> 40 kept; 25 mistakes -> 20 kept; dropped counted', n['words'] == 40 and n['mistakes'] == 20 and n['drop'] == 60 + 5, n)
    two = {"fasih": 1, "lesson": {"title": "L", "rules": [{"ar": "قاعدة"}], "exs": EX10[:2] + [{"k": "mc", "q": "bad", "o": ["a"], "a": 0}]}}
    n = page.evaluate('p => Fasih.tutor.normalise(JSON.parse(p))', json.dumps(two))
    check('5 lesson with only 2 valid exercises is dropped (pack empty)', n['lessons'] == [] and n['empty'] is True, n)
    sh = {"fasih": 1, "words": [{"w": "alpha beta", "ar": "x", "ex": "I like Alpha Beta very much", "x": "nope"}, {"w": "gamma", "ar": "y", "ex": "no such thing", "x": "gamma"}, {"w": "ثلاثة", "ar": "z"}, {"w": "delta", "ar": ""}]}
    n = page.evaluate('p => Fasih.tutor.normalise(JSON.parse(p))', json.dumps(sh))
    wa = {w['w']: w for w in n['words']}
    check('5 word rules: x recovered from ex, ex replaced when the word is absent, non-latin and empty-ar dropped, phr default', len(n['words']) == 2 and wa['alpha beta']['x'] == 'Alpha Beta' and wa['alpha beta']['p'] == 'phr' and wa['gamma']['ex'] == 'gamma' and wa['gamma']['x'] == 'gamma' and n['drop'] == 2, n)
    for name, text in [('400k string', '{"fasih":1,"title":"' + 'a' * 400000 + '"}'), ('400k braces', '{' * 400000), ('nested', '{"a":' * 80000), ('many objects', '{"a":1}' * 60000 + '{"fasih":1,"title":"late"}'), ('400k brackets', '[' * 400000)]:
        t0 = time.time(); r = page.evaluate('s => { const t = performance.now(); const r = Fasih.tutor.parse(s); return [r.ok, r.err || "", performance.now() - t]; }', text)
        check(f'5 {name} input does not hang (< 2 s)', r[2] < 2000 and (time.time() - t0) < 4, r)
    r = page.evaluate('p => { const n = Fasih.tutor.normalise(JSON.parse(p)); return n.plan; }', json.dumps({"fasih": 1, "plan": {"dailyMin": 77, "newPerDay": 9, "domain": 5, "retention": 0.5, "focus": "reading", "focusDays": 99, "why": "x"}}))
    check('5 plan values snap to allowed ones (dailyMin 77->75 equals current: dropped; 9->8 or 10; domain 5->10; retention 0.5->0.85; focus days 21)', r and r.get('domain') == 10 and r.get('retention') == 0.85 and r.get('focusDays') == 21 and 'dailyMin' not in r and r.get('newPerDay') in (8, 10) and r.get('newPerDay') != 10, r)
    page.context.close()

    # ------------------------------------------------------------------ 6. reload
    page = new_page(b)
    prio = page.evaluate('({ w: Fasih.DB.tracks.g[200].w, id: Fasih.DB.tracks.g[200].id })')
    page.evaluate('p => Fasih.tutor.preview(JSON.parse(p))', json.dumps(full_pack(prio['w'], 'zzzknown', 'sandbox-term')))
    page.wait_for_timeout(100); page.click('.tu-prev .go'); page.wait_for_timeout(200)
    page.evaluate('Fasih.flush()'); page.reload(); page.wait_for_timeout(600); page.evaluate(AUTO); page.evaluate('Fasih.debug = true')
    r = page.evaluate('({ packs: Fasih.S.tutor.packs.length, w: !!Fasih.DB.byId["x:sandbox-term"], tr: Fasih.DB.tracks.t.length, l: !!Fasih.DB.byId["t:l:p1:0"], rd: !!Fasih.DB.byId["t:r:p1:0"], m: Fasih.S.tutor.mistakes.length, prio: Fasih.S.tutor.prio.length, focus: Fasih.S.tutor.focus && Fasih.S.tutor.focus.skill })')
    check('6 tutor words, lesson, reading, mistakes, priority and focus survive a reload', r == {'packs': 1, 'w': True, 'tr': 2, 'l': True, 'rd': True, 'm': 3, 'prio': 1, 'focus': 'listening'}, r)
    page.evaluate('Fasih.startFree("grammar", "t:l:p1:0")'); page.wait_for_timeout(120)
    check('6 the stored lesson still plays after a reload', play(page, 'lesson-reload'))
    page.context.close()

    # ------------------------------------------------------------------ 7. modes
    clip = '''(() => { window.__clip = null; window.__opened = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__clip = t; return Promise.resolve(); }, readText: () => Promise.resolve(window.__clipIn || '') } }); window.open = u => { window.__opened.push(u); return null; }; })()'''
    page = new_page(b)
    page.evaluate(clip)
    page.evaluate('''window.__nat = []; const on = Fasih.nat; Fasih.nat = (n, ...a) => { window.__nat.push(n); return on(n, ...a); };
      window.__started = null; Fasih.chat = { ready: () => true, start: o => (window.__started = o), open() { window.__chatOpen = 1; }, keys() { window.__keys = 1; } }; Fasih.S.tutor.mode = 'api';''')
    page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(200)
    txt = page.evaluate('document.querySelector(".page").innerText')
    check('7 API mode page: mode switch, key row, key state, open-chat button, no "other" chip', page.evaluate('document.querySelectorAll(".tu-seg button").length') == 2 and '🔑 مفاتيحي' in txt and 'المفتاح محفوظ ✓' in txt and '💬 افتح المحادثة' in txt and 'تطبيق آخر' not in page.evaluate('document.querySelector(".chipsrow").innerText') and 'المحادثة والصور والحزم كلها داخل فصيح' in txt, txt[:300])
    page.click('[data-k=chat]'); page.click('[data-k=keys]')
    check('7 key and chat buttons call F.chat.keys / F.chat.open', page.evaluate('window.__chatOpen === 1 && window.__keys === 1'))
    page.click('.tile[data-v=words]'); page.wait_for_timeout(150)
    check('7 API request sheet button says "ابدأ المحادثة ›"', 'ابدأ المحادثة ›' in page.evaluate('document.querySelector(".tu-send").innerText'))
    page.fill('.tu-topic', 'public procurement'); page.click('.tu-send'); page.wait_for_timeout(150)
    st = page.evaluate('({ s: window.__started, nat: window.__nat.filter(n => n === "aiSend").length, ai: Fasih.S.tutor.sent, last: Fasih.S.tutor.last })')
    check('7 API mode: F.chat.start gets title/system/user, aiSend never called', st['s'] and st['s']['system'] and 'public procurement' in st['s']['user'] and st['s']['title'] and st['s']['img'] == '' and st['nat'] == 0 and st['ai'] == 1 and st['last']['req'] == 'words', st)
    page.evaluate('Fasih.chat.ready = () => false; window.__started = null; window.__keys = 0')
    page.evaluate('Fasih.tutor.send("plan", {}, "")')
    check('7 API mode without a key opens the key sheet and does not send', page.evaluate('window.__keys === 1 && window.__started === null && window.__nat.filter(n => n === "aiSend").length === 0'))
    page.evaluate('delete Fasih.chat; window.__keys = 0')
    page.evaluate('Fasih.go("home")'); page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(200)
    check('7 without F.chat the mode switch is hidden', page.evaluate('document.querySelectorAll(".tu-seg").length') == 0 and 'المعلّم الذكي' in page.evaluate('document.querySelector(".page").innerText'))
    page.evaluate('Fasih.S.tutor.mode = "bridge"; Fasih.S.tutor.ai = "claude"; Fasih.save()'); page.evaluate('Fasih.go("home")'); page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(150)
    page.click('.tile[data-v=fix]'); page.wait_for_timeout(150)
    page.fill('.tu-text', 'I am agree with this idea because it is very good for we.'); page.wait_for_timeout(100)
    page.evaluate('document.querySelector(".tu-det").open = true'); page.wait_for_timeout(3000)
    shot(page, '03-request-prompt')
    pre = page.evaluate('document.querySelector(".tu-pre").textContent')
    check('7 request sheet shows the exact prompt in <details>', '[Fasih tutor request]' in pre and 'I am agree with this idea' in pre and 'أرسل إلى Claude ›' in page.evaluate('document.querySelector(".tu-send").innerText'))
    page.click('.tu-send'); page.wait_for_timeout(250)
    st = page.evaluate('({ clip: window.__clip, opened: window.__opened, sent: Fasih.S.tutor.sent, last: Fasih.S.tutor.last, toast: Array.from(document.querySelectorAll(".toast")).map(t => t.innerText).join("|") })')
    if st['clip'] != pre:
        import difflib
        print('   clip/pre differ:', [d for d in difflib.ndiff(pre.splitlines(), (st['clip'] or '').splitlines()) if d[0] in '+-'][:6])
    check('7 browser fallback: prompt copied to the clipboard, website opened without the prompt in the URL', st['clip'] == pre and st['opened'] == ['https://claude.ai/new'] and st['sent'] == 2 and st['last']['ai'] == 'claude' and 'نُسخ طلبك' in st['toast'], {k: v for k, v in st.items() if k != 'clip'})
    # clipboard unavailable -> manual copy sheet; paste by hand
    page.evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })")
    page.evaluate('Fasih.tutor.send("plan", {}, "")'); page.wait_for_timeout(200)
    check('7 no clipboard: sheet with a readonly textarea holding the prompt', page.evaluate('(() => { const t = document.querySelector(".sheet textarea[readonly]"); return !!t && t.value.includes("[Fasih tutor request]"); })()'))
    page.evaluate('Fasih.closeSheet()')
    page.click('[data-k=import]'); page.wait_for_timeout(200)
    check('7 no clipboard: import opens a textarea to paste by hand', page.evaluate('!!document.querySelector(".sheet textarea:not([readonly])")'))
    page.fill('.sheet textarea', 'nothing useful here'); page.click('.sheet .go'); page.wait_for_timeout(150)
    check('7 pasting a text without a pack shows the "none" message', 'لم أجد «حزمة فصيح»' in page.evaluate('document.querySelector(".sheet").innerText'))
    page.fill('.sheet textarea', '```json\n{"fasih":1,"title":"x","words":[{"w":"a" "ar":"b"}]\n```'); page.click('.sheet .go'); page.wait_for_timeout(150)
    check('7 broken JSON shows the "json" message and keeps the text', 'غير صالح' in page.evaluate('document.querySelector(".sheet").innerText') and 'a" "ar' in page.evaluate('document.querySelector(".sheet textarea").value'))
    page.fill('.sheet textarea', '{"fasih":1,"title":"hand","note":"ok"}'); page.click('.sheet .go'); page.wait_for_timeout(200)
    check('7 pasting by hand opens the preview', page.evaluate('!!document.querySelector(".tu-prev")') and 'hand' in page.evaluate('document.querySelector(".tu-prev").innerText'))
    page.click('.tu-prev .go'); page.wait_for_timeout(200)
    check('7 a note-only pack is importable (advice shown on the page)', page.evaluate('Fasih.S.tutor.packs.length') == 1 and 'ok' in page.evaluate('document.querySelector(".page").innerText'))
    # clipboard import
    page.evaluate("window.__clipIn = '" + json.dumps({"fasih": 1, "title": "from clipboard", "words": [{"w": "clipword", "ar": "كلمة"}]}).replace("'", "\\'") + "'; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => Promise.resolve(), readText: () => Promise.resolve(window.__clipIn) } })")
    page.click('[data-k=import]'); page.wait_for_timeout(300)
    check('7 import button reads the clipboard and opens the preview', 'clipword' in page.evaluate('(document.querySelector(".tu-prev") || {innerText: ""}).innerText'))
    page.evaluate('Fasih.closeSheet()')
    # waiting card after sending
    page.evaluate('Fasih.S.tutor.packs = []; Fasih.S.tutor.last = { req: "fix", ai: "gemini", at: Fasih.now() - 3600e3 }; Fasih.go("home"); Fasih.go("tutor")'); page.wait_for_timeout(150)
    check('7 waiting card after a recent send', 'بعد أن يجيبك Gemini' in page.evaluate('document.querySelector(".page").innerText') and '📥 الصق حزمة فصيح' in page.evaluate('document.querySelector(".page").innerText'))
    page.evaluate('Fasih.S.tutor.last = { req: "fix", ai: "gemini", at: Fasih.now() - 30 * 3600e3 }; Fasih.go("home"); Fasih.go("tutor")'); page.wait_for_timeout(150)
    check('7 no waiting card after 24 hours', 'بعد أن يجيبك' not in page.evaluate('document.querySelector(".page").innerText'))
    page.click('.chip[data-v=grok]'); page.wait_for_timeout(150)
    check('7 selecting a provider saves it', page.evaluate('Fasih.S.tutor.ai') == 'grok' and page.evaluate('document.querySelector(".chip.on").innerText.trim()') == 'Grok')
    page.evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__clip = t; return Promise.resolve(); }, readText: () => Promise.resolve('') } }); window.__opened = []; window.__clip = null")
    page.click('.chip[data-v=other]'); page.evaluate('Fasih.tutor.send("plan", {}, "")'); page.wait_for_timeout(150)
    check('7 "other" in bridge mode copies the prompt and opens nothing', page.evaluate('window.__opened.length') == 0 and '[Fasih tutor request]' in page.evaluate('window.__clip || ""') and page.evaluate('Fasih.S.tutor.ai') == 'other')
    # the writing flow button
    page.evaluate('Fasih.S.tutor.ai = "chatgpt"; Fasih.startFree("w2", "w2-01")'); page.wait_for_timeout(200)
    page.fill('.essay', 'I think that technology is useful for the courts because it saves time and money for everybody.')
    page.click('.fin'); page.wait_for_timeout(150)
    sh = page.evaluate('(document.querySelector(".share") || {innerText: ""}).innerText')
    page.evaluate('window.__opened = []'); page.click('.share'); page.wait_for_timeout(200)
    check('7 writing flow: "send my text to the tutor" uses the chosen AI and request fix', 'المعلّم (ChatGPT)' in sh and page.evaluate('Fasih.S.tutor.last.req') == 'fix' and page.evaluate('window.__opened') == ['https://chatgpt.com/'])
    page.evaluate('Fasih.runner && Fasih.runner.close(false)')
    page.evaluate('Fasih.S.tutor.ai = "claude"')
    # word sheet button
    page.evaluate('Fasih.wordSheet(Fasih.DB.tracks.g[5].id)'); page.wait_for_timeout(100)
    check('7 word sheet has "ask the tutor" button opening the word request', page.evaluate('!!document.querySelector(".sheet .ask")'))
    page.click('.sheet .ask'); page.wait_for_timeout(150)
    check('7 word request prompt mentions the word', 'Help me really master the word' in page.evaluate('document.querySelector(".tu-pre").textContent'))
    page.evaluate('Fasih.closeSheet()')
    # tab bar fits
    page.evaluate('Fasih.closeSheet(); document.querySelectorAll(".confetti").forEach(e => e.remove())'); page.wait_for_timeout(3200)
    page.set_viewport_size({'width': 360, 'height': 780}); page.evaluate('Fasih.go("home")'); page.wait_for_timeout(200)
    w = page.evaluate('Array.from(document.querySelectorAll(".tabs button")).map(b => [Math.round(b.getBoundingClientRect().left), Math.round(b.getBoundingClientRect().right), b.scrollWidth, b.clientWidth])')
    check('7 five tabs fit in 360 px', len(w) == 5 and all(x[2] <= x[3] + 1 for x in w) and min(x[0] for x in w) >= 0 and max(x[1] for x in w) <= 360, w)
    shot(page, '09-tabs-360')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.context.close()

    # ------------------------------------------------------------------ 7b. app mode (native bridge stub)
    init = '''window.__calls = []; window.__sharedQ = []; window.__aiRes = 'send';
      window.FasihNative = { aiApps() { return JSON.stringify({ claude: { inst: false, send: true, img: true }, chatgpt: { inst: true, send: true, img: true }, gemini: { inst: true, send: true, img: false }, grok: { inst: true, send: false, img: false } }); },
        aiSend(...a) { window.__calls.push(['aiSend', ...a]); return window.__aiRes; }, copyText(t) { window.__copied = t; return true; }, pasteText() { return window.__paste || ''; }, takeShared() { return window.__sharedQ.shift() || ''; },
        pickImage(src) { setTimeout(() => window.Fasih.onNative('img', { ev: 'ok', id: 'shot1', w: 10, h: 10 }), 20); } };'''
    page = new_page(b, init=init, onboard=False)
    page.evaluate('window.__sharedQ.push("accountability"); Fasih.onNative("shared", {})'); page.wait_for_timeout(200)
    check('7b shared text before onboarding is ignored', sheet_count(page) == 0)
    for _ in range(5):
        page.click('#obx')
    page.click('#obsk'); page.wait_for_timeout(250)
    page.evaluate('Fasih.S.set.sound = false; Fasih.S.set.auto = false; Fasih.go("tutor")'); page.wait_for_timeout(200)
    chips = page.evaluate('Array.from(document.querySelectorAll(".chipsrow .chip")).map(c => c.innerText.replace(/\\s+/g, " ").trim())')
    check('7b in the app a chip whose app is not installed shows "عبر الموقع"', chips[0] == 'Claude عبر الموقع' and chips[1] == 'ChatGPT' and len(chips) == 5 and chips[4] == 'تطبيق آخر', chips)
    page.click('.tile[data-v=photo]'); page.wait_for_timeout(150)
    check('7b photo buttons appear when F.img.ok()', page.evaluate('!!document.querySelector(".pcam") && !!document.querySelector(".pgal")'))
    page.click('.pcam'); page.wait_for_timeout(200)
    check('7b a picked photo shows a removable thumbnail', page.evaluate('!!document.querySelector(".tu-ph img") && document.querySelector(".tu-ph img").getAttribute("src").includes("shot1")'))
    page.click('.tu-send'); page.wait_for_timeout(200)
    call = page.evaluate('window.__calls[0]')
    check('7b aiSend gets three string arguments (key, text, imgId)', call and len(call) == 4 and call[0] == 'aiSend' and call[1] == 'claude' and '[Fasih tutor request]' in call[2] and call[3] == 'shot1' and all(isinstance(x, str) for x in call), call)
    check('7b result "send" toast', 'فُتح Claude ومعه طلبك' in page.evaluate('Array.from(document.querySelectorAll(".toast")).map(t => t.innerText).join("|")'))
    for res, frag in [('sendimg', 'ومعه الصورة'), ('copy', 'نُسخ طلبك. الصقه في خانة الرسالة في Claude. وأرفق الصورة'), ('web', 'غير مثبّت'), ('chooser', None), ('fail', 'READONLY')]:
        page.wait_for_timeout(3100)
        page.evaluate(f'window.__aiRes = "{res}"')
        page.evaluate('Fasih.tutor.send("plan", {}, "shot1")'); page.wait_for_timeout(150)
        t = page.evaluate('Array.from(document.querySelectorAll(".toast")).map(t => t.innerText).join("|")')
        if frag is None:
            check('7b result "chooser": no toast', t == '', t)
        elif frag == 'READONLY':
            check('7b result "fail": manual-copy sheet', page.evaluate('!!document.querySelector(".sheet textarea[readonly]")'))
            page.evaluate('Fasih.closeSheet()')
        else:
            check(f'7b result "{res}" toast', frag in t, t)
    page.evaluate('window.__aiRes = "send"; window.__calls.length = 0')
    page.evaluate('Fasih.S.tutor.ai = "other"; Fasih.tutor.send("ask", { text: "hi" }, "")'); page.wait_for_timeout(100)
    check('7b "other" is sent to the Android share sheet', page.evaluate('window.__calls[0][1]') == 'other' and page.evaluate('window.__calls[0][3]') == '')
    page.evaluate('Fasih.S.tutor.ai = "claude"')
    page.evaluate('window.__paste = ' + json.dumps(json.dumps({"fasih": 1, "title": "app paste", "mistakes": [{"q": "He go home.", "bad": "go", "good": ["goes"]}]})) + '; Fasih.go("home"); Fasih.go("tutor")'); page.wait_for_timeout(150)
    page.click('[data-k=import]'); page.wait_for_timeout(250)
    check('7b import reads the native clipboard (pasteText)', 'app paste' in page.evaluate('(document.querySelector(".tu-prev") || {innerText: ""}).innerText'))
    page.click('.tu-prev .no'); page.wait_for_timeout(100)
    packtxt = json.dumps({"fasih": 1, "title": "shared pack", "words": [{"w": "sharedword", "ar": "كلمة"}]})
    page.evaluate('t => { window.__sharedQ.push(t); Fasih.onNative("shared", {}); }', packtxt); page.wait_for_timeout(250)
    check('7b shared pack opens the preview', 'sharedword' in page.evaluate('(document.querySelector(".tu-prev") || {innerText: ""}).innerText'))
    page.click('.tu-prev .no'); page.wait_for_timeout(100)
    page.evaluate('window.__sharedQ.push("accountability"); Fasih.onNative("shared", {})'); page.wait_for_timeout(200)
    check('7b a short word shared from another app opens the add-word sheet', page.evaluate('(document.querySelector(".sheet .w1") || {}).value') == 'accountability')
    page.evaluate('Fasih.closeSheet(); window.__sharedQ.push("The committee published a report about transparency in public spending. It was long."); Fasih.onNative("shared", {})'); page.wait_for_timeout(200)
    check('7b a longer text opens "نص من تطبيق آخر" with the explain button', 'نص من تطبيق آخر' in page.evaluate('document.querySelector(".sheet").innerText') and 'اطلب شرحه من المعلّم' in page.evaluate('document.querySelector(".sheet").innerText'))
    page.click('.sheet .ex'); page.wait_for_timeout(150)
    check('7b the explain button opens the explain request with the text', 'Explain this English text' in page.evaluate('document.querySelector(".tu-pre").textContent') and 'The committee published' in page.evaluate('document.querySelector(".tu-pre").textContent'))
    page.evaluate('Fasih.closeSheet(); new Fasih.Runner({ title: "x" }).add(() => {}).open()'); page.wait_for_timeout(100)
    page.evaluate('t => { window.__sharedQ.push(t); Fasih.onNative("shared", {}); }', packtxt); page.wait_for_timeout(200)
    check('7b a shared pack during a session is kept (toast, no sheet)', sheet_count(page) == 0 and 'وصلت حزمة' in page.evaluate('Array.from(document.querySelectorAll(".toast")).map(t => t.innerText).join("|")'))
    page.evaluate('Fasih.runner.close(false)'); page.wait_for_timeout(100)
    page.evaluate('Fasih.go("tutor")'); page.wait_for_timeout(600)
    check('7b ... and shown when the tutor page is next rendered', 'sharedword' in page.evaluate('(document.querySelector(".tu-prev") || {innerText: ""}).innerText'))
    page.context.close()

    # ------------------------------------------------------------------ 8. mistakes notebook screenshot (with several states) and dark theme
    page = new_page(b)
    page.evaluate('p => Fasih.tutor.preview(JSON.parse(p))', json.dumps(full_pack('x', 'y', 'sandbox-term')))
    page.wait_for_timeout(100); page.click('.tu-prev .go'); page.wait_for_timeout(200)
    page.evaluate('Fasih.S.tutor.mistakes[0].box = 3; Fasih.S.tutor.mistakes[0].due = Fasih.dayNum() + 7; Fasih.S.tutor.mistakes[1].box = 5; Fasih.go("tutor/errs")'); page.wait_for_timeout(250)
    shot(page, '05b-errs-states')
    page.evaluate('Fasih.S.set.theme = "dark"; Fasih.applyTheme(); Fasih.go("tutor")'); page.wait_for_timeout(200)
    shot(page, '10-tutor-dark-full')
    page.context.close()


with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
    try:
        run_all(b)
    except Exception as e:  # a crash in the harness is a failure, not a pass
        import traceback
        traceback.print_exc()
        check('harness ran to the end', False, repr(e))
    b.close()

check('no page errors or console errors during the tests', not errors, errors[:6])
if errors:
    print('\n'.join(errors[:12]))

if REGRESSION:
    for cmd in (['python3', os.path.join(ROOT, 'tools', 'test_web.py'), '/tmp/fasih-shots-tutor'], ['python3', os.path.join(ROOT, 'tools', 'sim.py'), '12']):
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
        last = [l for l in (r.stdout + r.stderr).splitlines() if 'ERRORS' in l]
        body = (r.stdout + r.stderr).strip().splitlines()
        check('8 regression ' + os.path.basename(cmd[1]) + ' (0 ERRORS)', bool(last) and last[-1].startswith('0 '), '\n'.join(body[-8:]))
        print('   ->', last[-1] if last else body[-3:])

print(f'{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)

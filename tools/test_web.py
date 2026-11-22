#!/usr/bin/env python3
"""Drive the web app in headless Chrome like a learner would. usage: test_web.py [outdir]"""
import json, os, sys, collections
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/fasih-shots'
os.makedirs(OUT, exist_ok=True)
URL = 'file://' + os.path.join(ROOT, 'www', 'index.html')
AUTO = open(os.path.join(ROOT, 'tools', 'auto.js'), encoding='utf-8').read()
errors = []


def play(page, label, limit=900):
    seen = collections.Counter(); idle = 0
    for _ in range(limit):
        r = page.evaluate('window.__auto(0.85, 0.35)')
        seen[r] += 1
        if r == 'closed':
            break
        if r == 'idle':
            idle += 1
            if idle > 300:
                errors.append(f'{label}: stuck. stage={page.evaluate("document.querySelector(\'.stage\').innerText.slice(0,300)")!r}')
                page.screenshot(path=f'{OUT}/stuck-{label}.png')
                page.evaluate('Fasih.runner && Fasih.runner.close(false)')
                break
        else:
            idle = 0
        page.wait_for_timeout(4)
    else:
        errors.append(f'{label}: did not finish in {limit} steps {dict(seen)}')
        page.evaluate('Fasih.runner && Fasih.runner.close(false)')
    page.wait_for_timeout(120)
    page.evaluate('Fasih.closeSheet()')
    return dict(seen)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='ar-DZ', timezone_id='Africa/Algiers')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)[:400]))
    page.on('console', lambda m: errors.append('console: ' + m.text[:300]) if m.type == 'error' else None)
    page.goto(URL); page.wait_for_timeout(600)
    page.evaluate(AUTO); page.evaluate('Fasih.debug = true')
    shot = lambda n: page.screenshot(path=f'{OUT}/{n}.png')
    info = page.evaluate('({v: Fasih.DB.vocab.length, g: Fasih.DB.grammar.length, tr: Object.fromEntries(Object.entries(Fasih.DB.tracks).map(([k, a]) => [k, a.length]))})')
    print('DB', info)
    # onboarding
    shot('01-welcome'); page.click('#obx'); page.fill('#obn', 'عبد الفتاح'); page.click('[data-ob=min][data-v="75"]'); shot('02-profile'); page.click('#obx')
    page.click('[data-ob=ret][data-v="0.93"]'); shot('03-memory'); page.click('#obx'); shot('04-habit'); page.click('#obx'); shot('05-notif'); page.click('#obx'); shot('06-ready')
    page.click('#obpl'); page.wait_for_timeout(200); shot('07-placement'); print('placement', play(page, 'placement')); page.wait_for_timeout(200); shot('08-place-result'); page.evaluate('Fasih.closeSheet()')
    shot('09-home')
    print('day1 tasks', page.evaluate('Fasih.S.day.tasks.map(t => t.t + (t.ref ? ":" + t.ref : ""))'))
    # learn
    page.click('[data-a=task][data-i="1"]'); page.wait_for_timeout(150); shot('10-pretest')
    for _ in range(3):
        page.evaluate('window.__auto(0.85, 0.35)'); page.wait_for_timeout(120)
    shot('11-learn-step'); print('learn', play(page, 'learn'))
    print('after learn', page.evaluate('({cards: Object.keys(Fasih.S.cards).length, got: Fasih.S.day.tasks[1].got, done: Fasih.S.day.tasks[1].done, xp: Fasih.S.xp, streak: Fasih.S.streak.cur})'))
    shot('12-home-after-learn')
    # every other task of day 1
    n = page.evaluate('Fasih.S.day.tasks.length')
    for i in range(n):
        t = page.evaluate(f'Fasih.S.day.tasks[{i}]')
        if t.get('done') or t['t'] in ('learn',):
            continue
        page.evaluate(f'Fasih.startTask({i})'); page.wait_for_timeout(200); shot(f'13-task-{t["t"]}')
        print(t['t'], play(page, 't-' + t['t']))
    page.wait_for_timeout(300); shot('14-day-done'); page.evaluate('Fasih.closeSheet()')
    print('day1 state', page.evaluate('({done: Fasih.S.day.done, daysDone: Fasih.S.daysDone, tasks: Fasih.S.day.tasks.map(t => t.t + ":" + !!t.done)})'))
    # following days: time travel, do everything
    for d in range(1, 7):
        page.evaluate(f'Fasih.timeOffset = {d} * 864e5; Fasih.ensureDay(); Fasih.checkDay(); Fasih.render()')
        tasks = page.evaluate('Fasih.S.day.tasks.map(t => t.t + (t.ref ? ":" + t.ref : ""))')
        due = page.evaluate('Fasih.SRS.dueCount()')
        if d in (1, 2): shot(f'15-day{d + 1}-home')
        res = {}
        for i in range(len(tasks)):
            t = page.evaluate(f'Fasih.S.day.tasks[{i}]')
            if t.get('done'):
                continue
            page.evaluate(f'Fasih.startTask({i})'); page.wait_for_timeout(150)
            if d <= 3 or t['t'] in ('quiz', 'guide', 'w2', 'w1', 'sp1', 'sp2', 'sp3', 'mission', 'grev'): shot(f'16-d{d + 1}-{t["t"]}')
            res[t['t']] = sum(play(page, f'd{d + 1}-{t["t"]}').values())
        st = page.evaluate('({done: Fasih.S.day.done, n: Fasih.S.day.n, daysDone: Fasih.S.daysDone, cards: Object.keys(Fasih.S.cards).length, streak: Fasih.S.streak.cur, xp: Fasih.S.xp})')
        print(f'day {d + 1}: due={due} tasks={tasks} steps={res} -> {st}')
        page.evaluate('Fasih.closeSheet()')
    # missed days then come back; light mode
    page.evaluate('Fasih.timeOffset = 11 * 864e5; Fasih.ensureDay(); Fasih.checkDay(); Fasih.render()'); shot('17-comeback')
    print('comeback', page.evaluate('({back: Fasih.S.day.back, n: Fasih.S.day.n, due: Fasih.SRS.dueCount(), streak: Fasih.streakAlive(), tasks: Fasih.S.day.tasks.map(t => t.t)})'))
    page.click('[data-a=light]'); page.wait_for_timeout(100); shot('18-light')
    print('light', page.evaluate('Fasih.S.day.tasks.map(t => t.t + ":" + t.core + ":" + (t.n || ""))'))
    # screens
    for r in ['lib', 'list/grammar', 'list/reading', 'list/listening', 'list/speaking', 'list/writing', 'list/method', 'list/mission', 'words', 'phrases', 'ielts', 'journey', 'me', 'home']:
        page.evaluate(f'Fasih.go("{r}")'); page.wait_for_timeout(150); shot('20-' + r.replace('/', '-'))
        if page.evaluate('document.querySelector(".page").innerText.trim().length') < 40: errors.append('empty screen ' + r)
    # free practice of advanced content
    for kind, ref in [('w1', 'w1-01'), ('w1', 'w1-08'), ('w1', 'w1-14'), ('w1', 'w1-18'), ('w2', 'w2-01'), ('sp2', 'sp2-01'), ('sp3', 'sp3-01'), ('reading', 'r-c1-01'), ('listening', 'l-c1-01'), ('grammar', 'g-c1-01'), ('grammar', 'g-b2-10'), ('pron', 'pr-01'), ('pron', 'pr-12'), ('guide', 'gd-ielts-01'), ('mission', 'm-mock-1'), ('wlesson', 'wl-01'), ('shadow', 'sh-a2-01')]:
        page.evaluate(f'Fasih.startFree("{kind}", "{ref}")'); page.wait_for_timeout(200); shot(f'30-{ref}')
        play(page, f'free-{ref}')
    # word sheet, add word, dark theme
    page.evaluate('Fasih.go("words")'); page.wait_for_timeout(100); page.click('.li[data-a=word]'); page.wait_for_timeout(150); shot('40-word-sheet'); page.evaluate('Fasih.closeSheet()')
    page.evaluate('Fasih.addWordSheet("jurisprudence")'); page.fill('.sheet .w2', 'فقه القانون'); page.click('.sheet .ok'); page.wait_for_timeout(100)
    page.evaluate('Fasih.S.set.theme = "dark"; Fasih.applyTheme(); Fasih.go("home")'); page.wait_for_timeout(150); shot('41-dark-home')
    # persistence
    page.evaluate('Fasih.flush()'); before = page.evaluate('JSON.stringify([Fasih.S.xp, Object.keys(Fasih.S.cards).length, Fasih.S.daysDone])')
    page.reload(); page.wait_for_timeout(500); page.evaluate('Fasih.timeOffset = 11 * 864e5')
    after = page.evaluate('JSON.stringify([Fasih.S.xp, Object.keys(Fasih.S.cards).length, Fasih.S.daysDone])')
    if before != after: errors.append(f'state not persisted: {before} -> {after}')
    print('persist', before, after, 'state KB', page.evaluate('Math.round(JSON.stringify(Fasih.S).length / 1024)'))
    b.close()
print(len(errors), 'ERRORS'); print('\n'.join(errors[:30]))

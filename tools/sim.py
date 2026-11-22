#!/usr/bin/env python3
"""Simulate a learner for N days (answers right with probability P, already knows a share K of new words). usage: sim.py [days] [P] [K]"""
import os, sys, collections
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 30
P = float(sys.argv[2]) if len(sys.argv) > 2 else 0.88
K = float(sys.argv[3]) if len(sys.argv) > 3 else 0.3
AUTO = open(os.path.join(ROOT, 'tools', 'auto.js'), encoding='utf-8').read()
errors = []
def play(page, label, limit=4000):
    idle = 0; n = 0
    for _ in range(limit):
        r = page.evaluate(f'window.__auto({P}, {K})'); n += 1
        if r == 'closed': break
        if r == 'idle':
            idle += 1
            if idle > 400:
                errors.append(f'{label}: stuck: ' + page.evaluate("document.querySelector('.stage').innerText.slice(0,200)")); page.evaluate('Fasih.runner && Fasih.runner.close(false)'); break
            page.wait_for_timeout(3)
        else: idle = 0
    else:
        errors.append(f'{label}: not finished'); page.evaluate('Fasih.runner && Fasih.runner.close(false)')
    page.evaluate('Fasih.closeSheet()'); return n
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = b.new_context(viewport={'width': 390, 'height': 844}, locale='ar-DZ', timezone_id='Africa/Algiers').new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)[:300]))
    page.on('console', lambda m: errors.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.goto('file://' + os.path.join(ROOT, 'www', 'index.html')); page.wait_for_timeout(500)
    page.evaluate(AUTO); page.evaluate('Fasih.debug = true; Fasih.S.set.sound = false; Fasih.S.set.auto = false')
    page.click('#obx'); page.click('#obx'); page.click('#obx'); page.click('#obx'); page.click('#obx'); page.click('#obsk'); page.wait_for_timeout(200)
    page.evaluate('Fasih.S.set.sound = false; Fasih.S.set.auto = false')
    print('day due rev% new kn tasks -> cards mature mod daysDone streak level')
    for d in range(DAYS):
        page.evaluate(f'Fasih.timeOffset = {d} * 864e5; Fasih.ensureDay(); Fasih.checkDay(); Fasih.render()')
        due = page.evaluate('Fasih.SRS.dueCount()')
        tasks = page.evaluate('Fasih.S.day.tasks.map(t => t.t)')
        for i in range(len(tasks)):
            if page.evaluate(f'!!Fasih.S.day.tasks[{i}].done'): continue
            page.evaluate(f'Fasih.startTask({i})'); play(page, f'd{d+1}-{tasks[i]}')
        st = page.evaluate('(() => { const S = Fasih.S, h = Fasih.hist(), s = Fasih.stats(); return [h.rev, h.rev ? Math.round(100 * h.ok / h.rev) : 0, h.new, s.total, s.mature, S.mod, S.daysDone, S.streak.cur, Fasih.level(), S.day.done, Object.values(S.cards).filter(c => c.born === Fasih.dayNum() && c.reps === 0 && c.s > 2).length]; })()')
        if d < 12 or d % 3 == 2 or not st[9]:
            print(f'{d+1:3d} due={due:3d} rev={st[0]:3d} ok={st[1]:3d}% new={st[2]:2d} known={st[10]:2d} {"+".join(t for t in tasks if t not in ("review","learn","recap"))} -> cards={st[3]} mature={st[4]} mod={st[5]} done={st[6]} streak={st[7]} lvl={st[8]} {"" if st[9] else "NOT DONE"}')
    print('state KB', page.evaluate('Math.round(JSON.stringify(Fasih.S).length / 1024)'), 'fore', page.evaluate('Fasih.stats().fore'), 'ptr', page.evaluate('Fasih.S.ptr'), 'badges', page.evaluate('Object.keys(Fasih.S.badges)'))
    b.close()
print(len(errors), 'ERRORS'); print('\n'.join(errors[:20]))

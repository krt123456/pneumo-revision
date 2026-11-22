// Emulator tests for the Fasih Android app (run by .github/workflows/fasih-test.yml).
// 1) adb checks: install, launch, crash log, screenshots; 2) WebView checks through Chrome DevTools: native bridge, state, speech, reminders, a real learning session, restart.
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';

const API = process.argv[2] || 'x', APK = process.argv[3] || 'fasih.apk', PKG = 'io.github.krt123456.fasih', OUT = `results-${API}`;
fs.mkdirSync(OUT, { recursive: true });
const rep = { api: API, pass: [], fail: [], notes: [], pageErrors: [] };
const ok = (c, m) => { (c ? rep.pass : rep.fail).push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
const note = m => { rep.notes.push(String(m)); console.log('NOTE ' + m); };
const sh = (c, ms = 120000) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, timeout: ms }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// one command line for the device shell, without the host shell touching its quotes
const dsh = (c, ms = 60000) => { try { return execFileSync('adb', ['shell', c], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, timeout: ms }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
let shotN = 0;
const shot = name => { const f = `${OUT}/${String(++shotN).padStart(2, '0')}-${name}.png`; try { execSync(`adb exec-out screencap -p > "${f}"`); } catch (e) { note('no screenshot ' + name); } };
const start = () => sh(`adb shell am start -W -n ${PKG}/.MainActivity --ez devtools true`, 60000);
const pidOf = () => sh(`adb shell pidof ${PKG}`).trim().split(/\s+/)[0] || '';
const save = () => { fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1)); };
process.on('unhandledRejection', e => { note('unhandled rejection: ' + String((e && e.message) || e).split('\n')[0]); save(); });
let crashSeen = false;
const ownCrash = c => /Process: io\.github\.krt123456\.fasih/.test(c);
const crashCheck = where => { const c = sh('adb logcat -d -b crash'); if (!crashSeen && /FATAL EXCEPTION/.test(c)) { crashSeen = true; note((ownCrash(c) ? 'CRASH of the app during ' : 'another app crashed during ') + where + ': ' + c.split('\n').filter(l => /FATAL|Exception|Error|at io\.github|Caused by/.test(l)).slice(0, 12).join(' | ').slice(0, 900)); fs.writeFileSync(`${OUT}/crash.txt`, c.split('\n').slice(-120).join('\n')); } };

let pw = null, device = null, browser = null;
const uiXml = () => { sh('adb shell rm -f /sdcard/ui.xml'); sh('adb shell uiautomator dump /sdcard/ui.xml'); return sh('adb shell cat /sdcard/ui.xml'); };
// the emulator's own launcher sometimes shows "isn't responding": tap Wait so that it does not cover the app
const dismissAnr = () => { for (let i = 0; i < 3; i++) { const x = uiXml(); if (!/isn(&apos;|')t responding/.test(x)) return; const m = x.match(/text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/); if (m) sh(`adb shell input tap ${(+m[1] + +m[3]) >> 1} ${(+m[2] + +m[4]) >> 1}`); else sh('adb shell input keyevent 4'); note('dismissed a system "not responding" dialog'); } };
async function connect(timeout = 90000) {
  const end = Date.now() + timeout; let last = '';
  if (!pw) { try { const m = await import('playwright-core'); pw = m._android; [device] = await pw.devices(); } catch (e) { note('Playwright Android unavailable: ' + String(e.message || e).split('\n')[0]); return null; } }
  while (Date.now() < end) {
    const pid = +pidOf();
    if (pid) {
      try {
        await Promise.race([device.webView({ pkg: PKG }, { timeout: 3000 }), sleep(5000)]).catch(() => null);
        const wv = device.webViews().find(w => w.pkg() === PKG && w.pid() === pid);
        if (wv) {
          const page = await Promise.race([wv.page(), sleep(25000).then(() => null)]);
          if (page) {
            await page.waitForFunction(() => window.Fasih && window.Fasih.S && window.Fasih.DB && window.Fasih.DB.vocab, null, { timeout: 25000 });
            page.on('pageerror', e => rep.pageErrors.push(String(e).slice(0, 300)));
            return page;
          }
        }
      } catch (e) { last = String(e.message || e).split('\n')[0]; }
    }
    await sleep(1000);
  }
  note('WebView connection failed: ' + last + ' | sockets: ' + [...new Set(sh('adb shell cat /proc/net/unix').match(/webview_devtools_remote_\d+/g) || [])].join(','));
  return null;
}
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(false, name + ': ' + String(e.message || e).split('\n')[0]); } crashCheck(name); save(); };
const AUTO = fs.readFileSync(new URL('./auto.js', import.meta.url), 'utf8');
async function play(page, label, limit = 1500) {
  let idle = 0, n = 0;
  for (let i = 0; i < limit; i++) {
    const r = await page.evaluate(() => window.__auto(0.92, 0.4)); n++;
    if (r === 'closed') return n;
    if (r === 'idle') { if (++idle > 150) { note(label + ' stuck: ' + await page.evaluate(() => (document.querySelector('.stage') || document.body).innerText.slice(0, 160))); await page.evaluate(() => window.Fasih.runner && window.Fasih.runner.close(false)); return -1; } await sleep(20); } else idle = 0;
  }
  await page.evaluate(() => window.Fasih.runner && window.Fasih.runner.close(false));
  return -2;
}

(async () => {
  console.log(sh(`adb install -r "${APK}"`));
  ok(sh(`adb shell pm list packages ${PKG}`).includes(PKG), 'APK installed');
  const dump = sh(`adb shell dumpsys package ${PKG}`);
  note((dump.match(/versionName=\S+/) || ['versionName=?'])[0] + ' ' + (dump.match(/versionCode=\d+/) || [''])[0] + ' targetSdk=' + ((dump.match(/targetSdk=(\d+)/) || [])[1] || '?'));
  note('WebView: ' + ((sh('adb shell dumpsys webviewupdate').match(/Current WebView package \(name, version\): \(([^)]*)\)/) || [])[1] || '?'));
  note('Android ' + sh('adb shell getprop ro.build.version.release').trim() + ' (API ' + sh('adb shell getprop ro.build.version.sdk').trim() + ')');
  note('INTERNET permission requested: ' + /android\.permission\.INTERNET/.test(dump) + ' (used only by the optional API mode of the tutor)');
  if (+API >= 33) sh(`adb shell pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
  sh(`adb shell pm grant ${PKG} android.permission.RECORD_AUDIO`);
  sh('adb logcat -G 16M'); sh('adb logcat -c');

  const r0 = start(); note('cold start ms: ' + ((r0.match(/TotalTime: (\d+)/) || [])[1] || '?'));
  await sleep(7000); dismissAnr(); shot('first-launch');
  ok(!/FATAL EXCEPTION/.test(sh('adb logcat -d -b crash')), 'no crash at start');
  ok(!!pidOf(), 'app is running');
  save();

  let page = await connect();
  if (!page) { note('WebView tests skipped: only adb checks count'); }
  else {
    await step('bridge', async () => {
      ok(await page.evaluate(() => !!(window.FasihNative && window.Fasih.isApp)), 'native bridge present');
      const db = await page.evaluate(() => ({ v: window.Fasih.DB.vocab.length, g: window.Fasih.DB.grammar.length, r: window.Fasih.DB.reading.length, l: window.Fasih.DB.listening.length }));
      note('content: ' + JSON.stringify(db)); ok(db.v > 4000 && db.g === 80, 'content loaded in the app');
      note('version seen by the web app: ' + await page.evaluate(() => window.FasihNative.version()));
      note('tts: ' + await page.evaluate(() => window.FasihNative.ttsInfo()) + ' | speech recognition available: ' + await page.evaluate(() => window.FasihNative.sttAvailable()));
    });
    await step('onboarding', async () => {
      await page.evaluate(AUTO);
      await page.evaluate(() => { window.Fasih.debug = true; });
      for (let i = 0; i < 5; i++) { if (i === 1) { await page.fill('#obn', 'Abdelfattah'); } await page.click('#obx'); await sleep(350); if (i === 0) shot('onboarding-profile'); if (i === 3) shot('onboarding-notifications'); }
      await page.click('#obsk'); await sleep(900);
      ok(await page.evaluate(() => window.Fasih.S.onboard === true && !!window.Fasih.S.day), 'onboarding finished, first day planned');
      shot('home-day1');
      note('day 1: ' + await page.evaluate(() => JSON.stringify(window.Fasih.S.day.tasks.map(t => t.t + (t.ref ? ':' + t.ref : '')))));
    });
    await step('speech', async () => {
      const r = await page.evaluate(() => new Promise(res => { const t = setTimeout(() => res('timeout'), 15000); window.Fasih.tts.speak('Hello. This is a test of the English voice.', () => { clearTimeout(t); res(window.Fasih.ttsMissing ? 'nolang' : 'done'); }); }));
      note('text-to-speech result: ' + r); ok(r === 'done' || r === 'nolang', 'text-to-speech call completes (' + r + ')');
    });
    await step('reminders', async () => {
      await page.evaluate(() => window.Fasih.syncRem());
      const st = JSON.parse(await page.evaluate(() => window.FasihNative.reminderState()));
      note('reminder state: ' + JSON.stringify(st));
      ok(st.on === true && st.next > Date.now(), 'next reminder scheduled (' + new Date(st.next).toISOString() + ')');
      ok(/io\.github\.krt123456\.fasih\.REMIND/.test(sh('adb shell dumpsys alarm')), 'alarm registered in the system');
      await page.evaluate(() => window.FasihNative.testReminder()); await sleep(1500);
      const nd = sh('adb shell dumpsys notification --noredact');
      ok(nd.includes('pkg=' + PKG), 'notification posted');
      sh('adb shell cmd statusbar expand-notifications'); await sleep(1500); shot('notification'); sh('adb shell cmd statusbar collapse'); await sleep(800);
      const today = await page.evaluate(() => window.Fasih.dateStr());
      await page.evaluate(d => window.FasihNative.setDayStatus(d, true, 0, 3), today); await sleep(800);
      const st2 = JSON.parse(await page.evaluate(() => window.FasihNative.reminderState()));
      ok(!sh('adb shell dumpsys notification --noredact').includes('pkg=' + PKG + ' '), 'notification removed once the day is done');
      ok(st2.next - Date.now() > 3 * 3600e3 || new Date(st2.next).getDate() !== new Date().getDate(), 'after the day is done the next reminder moves to tomorrow (' + new Date(st2.next).toISOString() + ')');
      await page.evaluate(d => window.FasihNative.setDayStatus(d, false, 40, 3), today);
      const st3 = JSON.parse(await page.evaluate(() => window.FasihNative.reminderState()));
      note('not done again -> next ' + new Date(st3.next).toISOString());
    });
    let cards = 0;
    await step('learning session', async () => {
      await page.evaluate(() => { window.Fasih.S.set.auto = true; window.Fasih.startTask(1); }); await sleep(800); shot('pretest');
      for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!document.querySelector('.run .vcard'))) break; await page.evaluate(() => window.__auto(0.9, 0)); await sleep(120); }
      await sleep(600); shot('teach-card');
      const n = await play(page, 'learn'); note('learn steps: ' + n);
      cards = await page.evaluate(() => Object.keys(window.Fasih.S.cards).length);
      ok(n > 0 && cards >= 10, 'new-words session completed (' + cards + ' cards)');
      await page.evaluate(() => window.Fasih.startTask(2)); await sleep(900); shot('grammar-lesson');
      ok((await play(page, 'grammar')) > 0, 'grammar unit completed');
      await page.evaluate(() => window.Fasih.startTask(3)); await sleep(900); shot('reading');
      ok((await play(page, 'reading')) > 0, 'reading task completed');
      await sleep(800); shot('day-done'); await page.evaluate(() => window.Fasih.closeSheet());
      ok(await page.evaluate(() => window.Fasih.S.day.done === true && window.Fasih.S.daysDone === 1), 'day 1 marked complete');
      await page.evaluate(() => window.Fasih.startFree('listening', 'l-a2-01')); await sleep(900);
      await page.click('.run .play'); await sleep(6000); shot('listening-playing');
      note('listening progress after 6 s: ' + await page.evaluate(() => (document.querySelector('.pstat') || {}).textContent || ''));
      await page.evaluate(() => window.Fasih.runner && window.Fasih.runner.close(false));
      await page.evaluate(() => window.Fasih.startFree('w1', 'w1-01')); await sleep(900); shot('writing-task1'); await page.evaluate(() => window.Fasih.runner && window.Fasih.runner.close(false));
      await page.evaluate(() => window.Fasih.startFree('shadow', 'sh-a2-01')); await sleep(600); await page.evaluate(() => window.__auto(1, 0)); await sleep(900); shot('speaking'); await page.evaluate(() => window.Fasih.runner && window.Fasih.runner.close(false));
      for (const r of ['journey', 'me', 'lib', 'ielts']) { await page.evaluate(x => window.Fasih.go(x), r); await sleep(500); shot('screen-' + r); }
      await page.evaluate(() => window.Fasih.flush());
    });
    await step('tutor bridge', async () => {
      const apps = JSON.parse(await page.evaluate(() => window.FasihNative.aiApps()));
      ok(['claude', 'chatgpt', 'gemini', 'grok'].every(k => apps[k] && typeof apps[k].inst === 'boolean'), 'AI app detection answers ' + JSON.stringify(apps));
      dismissAnr();
      let cp = await page.evaluate(() => window.FasihNative.copyText('fasih clip 123') && window.FasihNative.pasteText());
      if (cp !== 'fasih clip 123') { note('clipboard first try: ' + JSON.stringify(cp) + ' focus=' + sh('adb shell dumpsys window | grep mCurrentFocus').trim().slice(0, 160)); dismissAnr(); start(); await sleep(2000); cp = await page.evaluate(() => window.FasihNative.copyText('fasih clip 123') && window.FasihNative.pasteText()); }
      ok(cp === 'fasih clip 123', 'clipboard copy and paste (' + cp + ')');
      const fx = await page.evaluate(() => fetch('https://example.com/').then(r => 'reached, status ' + r.status, () => 'blocked'));
      ok(fx === 'blocked', 'the web page itself cannot reach the internet (' + fx + ')');
      await page.evaluate(() => window.Fasih.go('tutor')); await sleep(700); shot('tutor-page');
      ok(await page.evaluate(() => !!(window.Fasih.tutor && document.querySelector('.page') && /المعلّم/.test(document.querySelector('.page').innerText))), 'tutor page renders');
      // a pack shared into Fasih from another app
      const pack = '{"fasih":1,"title":"Emulator pack","note":"Test note","words":[{"w":"zzprocurement","p":"n","l":"B2","ar":"test meaning","ex":"Public zzprocurement must be open and fair.","x":"zzprocurement"}],"mistakes":[{"q":"I am agree with you.","bad":"am agree","good":["agree"],"why":"test"}]}';
      dsh(`am start -a android.intent.action.SEND -t text/plain -n ${PKG}/.MainActivity --es android.intent.extra.TEXT '${pack}'`); await sleep(2500);
      const sheet = await page.evaluate(() => (document.querySelector('.sheetw') || {}).innerText || '');
      ok(/Emulator pack/.test(sheet) && /zzprocurement/.test(sheet), 'a pack shared from another app opens the approval sheet'); shot('pack-preview');
      await page.evaluate(() => window.Fasih.closeSheet());
      // a single word selected in another app
      dsh(`am start -a android.intent.action.PROCESS_TEXT -t text/plain -n ${PKG}/.MainActivity --es android.intent.extra.PROCESS_TEXT 'whistleblower'`); await sleep(2000);
      const sheet2 = await page.evaluate(() => { const s = document.querySelector('.sheetw'); return s ? s.innerText + ' ' + [...s.querySelectorAll('input')].map(i => i.value).join(' ') : ''; });
      ok(/whistleblower/.test(sheet2), 'a word selected in another app opens the add-word sheet'); shot('word-from-other-app');
      await page.evaluate(() => window.Fasih.closeSheet());
      // hand-off: no AI app on the emulator, so the website route is expected
      const how = await page.evaluate(() => window.FasihNative.aiSend('claude', 'Fasih test request', '')); await sleep(2500); shot('handoff');
      ok(how === 'web' || how === 'send' || how === 'copy', 'hand-off to the AI app answers (' + how + ')');
      start(); await sleep(1500); sh('adb shell am force-stop com.android.chrome'); await sleep(1000); dismissAnr();
      ok(await page.evaluate(() => window.FasihNative.aiKeys()).then(() => true, () => false), 'app still answers after the hand-off');
    });
    await step('api keys and transport', async () => {
      const keys0 = JSON.parse(await page.evaluate(() => window.FasihNative.aiKeys()));
      ok(Object.values(keys0).every(v => v === false), 'no API key saved at first');
      const call = (p, path, body) => page.evaluate(([p, path, body]) => new Promise(res => {
        const out = { ev: [], text: '' }, id = 't' + Math.random().toString(36).slice(2), t = setTimeout(() => res(Object.assign(out, { timeout: true })), 40000);
        window.Fasih.on('http', d => { if (d.id !== id) return; out.ev.push(d.ev); if (d.ev === 'data') out.text += d.text; if (d.ev === 'error') { out.status = d.status; out.body = d.body; } if (d.ev === 'error' || d.ev === 'done') { clearTimeout(t); out.text = out.text.slice(0, 300); res(out); } });
        window.FasihNative.aiHttp(JSON.stringify(body ? { id, p, method: 'POST', path, body, stream: true } : { id, p, method: 'GET', path, stream: false }));
      }), [p, path, body || '']);
      globalThis.__call = call;
      const r0 = await call('claude', '/v1/models');
      ok(r0.status === 401 && /no usable key/.test(r0.body || ''), 'without a key the transport refuses locally (' + JSON.stringify(r0).slice(0, 120) + ')');
      const bad = await call('claude', '/v1/../x');
      ok(bad.status === 0 && /bad request/.test(bad.body || ''), 'the transport rejects paths outside the API');
      // type a DUMMY key in the native dialog, then check that each provider is reached and refuses it
      const hasKey = async prov => JSON.parse(await page.evaluate(() => window.FasihNative.aiKeys()))[prov] === true;
      const typeKey = async (prov) => {
        dismissAnr();
        await page.evaluate(p => window.FasihNative.askAiKey(p), prov); await sleep(2200);
        sh('adb shell input text dummy-key-0123456789abcdef'); await sleep(900);
        sh('adb shell input keyevent 66'); await sleep(1300);
        if (await hasKey(prov)) return true;
        // fallback: find the field and the button on screen
        let x = uiXml(); let m = x.match(/class="android\.widget\.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        if (!m) { await page.evaluate(p => window.FasihNative.askAiKey(p), prov); await sleep(2200); x = uiXml(); m = x.match(/class="android\.widget\.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/); }
        if (m) { sh(`adb shell input tap ${(+m[1] + +m[3]) >> 1} ${(+m[2] + +m[4]) >> 1}`); await sleep(600); sh('adb shell input text dummy-key-0123456789abcdef'); await sleep(900); }
        x = uiXml(); m = x.match(/text="حفظ"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        if (m) { sh(`adb shell input tap ${(+m[1] + +m[3]) >> 1} ${(+m[2] + +m[4]) >> 1}`); await sleep(1300); }
        if (await hasKey(prov)) return true;
        note('key dialog could not be driven for ' + prov + ' (focus: ' + sh('adb shell dumpsys window | grep mCurrentFocus').trim().slice(0, 140) + ')'); shot('key-dialog-' + prov);
        sh('adb shell input keyevent 4'); await sleep(500); sh('adb shell input keyevent 4'); await sleep(500); start(); await sleep(1500);
        return false;
      };
      for (const [prov, path] of [['claude', '/v1/models?limit=5'], ['chatgpt', '/v1/models'], ['gemini', '/v1beta/models?pageSize=5'], ['grok', '/v1/models']]) {
        const saved = await typeKey(prov);
        ok(saved, prov + ': key saved (encrypted) through the native dialog');
        if (!saved) continue;
        const r = await call(prov, path);
        note(prov + ' with a dummy key → ' + JSON.stringify({ ev: r.ev, status: r.status, body: String(r.body || r.text || '').slice(0, 220), timeout: r.timeout }));
        ok(r.status >= 400 && r.status < 500, prov + ': its API is reached over HTTPS and refuses the dummy key (HTTP ' + r.status + ')');
        // the chat request exactly as the app builds it: the endpoint must exist (an authentication refusal, not "not found")
        const req = await page.evaluate(p => { try { const a = window.Fasih.chat.providers[p].chat.build(p === 'gemini' ? 'gemini-2.5-flash' : 'test-model', 'You are a tutor.', [{ role: 'user', text: 'Hello' }]); return a; } catch (e) { return { err: String(e) }; } }, prov);
        if (req && req.path) {
          const c = await call(prov, req.path, req.body);
          note(prov + ' chat endpoint ' + req.path + ' → ' + JSON.stringify({ ev: c.ev, status: c.status, body: String(c.body || c.text || '').slice(0, 200), timeout: c.timeout }));
          ok([400, 401, 403].includes(c.status), prov + ': chat endpoint exists and refuses the dummy key (HTTP ' + c.status + ')');
        } else note(prov + ': chat request not built: ' + JSON.stringify(req));
      }
      shot('after-keys');
      await page.evaluate(() => { setTimeout(() => location.reload(), 50); }).catch(() => null); await sleep(3000);
      page = await connect(60000);
      ok(!!page, 'app page reloads after the transport checks');
    });
    const tapNode = (x, re) => { const m = x.match(re); if (!m) return false; sh(`adb shell input tap ${(+m[1] + +m[3]) >> 1} ${(+m[2] + +m[4]) >> 1}`); return true; };
    const B = 'bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"';
    const backToApp = async () => { for (let i = 0; i < 3 && !/fasih/.test(sh('adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity"')); i++) { sh('adb shell input keyevent 4'); await sleep(900); } start(); await sleep(1800); dismissAnr(); if (!page || page.isClosed()) page = await connect(60000); };
    await step('camera', async () => {
      if (!page || page.isClosed()) page = await connect(60000);
      if (!page) throw new Error('no page');
      for (const pm of ['CAMERA', 'RECORD_AUDIO', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE']) sh('adb shell pm grant com.android.camera2 android.permission.' + pm);
      sh('adb logcat -c');
      const wait = page.evaluate(() => new Promise(res => { const t = setTimeout(() => res('timeout'), 45000); window.Fasih.img.pick('camera', (r, d) => { clearTimeout(t); res(r ? 'ok ' + r.id + ' ' + r.w + 'x' + r.h : ((d && d.ev) || 'null') + ' ' + ((d && d.msg) || '')); }); })).catch(e => 'evaluate failed: ' + String(e.message || e).split('\n')[0]);
      await sleep(5000); shot('camera-app');
      note('after camera request: top=' + sh('adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity"').trim().replace(/\s+/g, ' ').slice(0, 160) + ' | app pid=' + pidOf());
      let shot1 = false, done1 = false;
      const size = (sh('adb shell wm size').match(/(\d+)x(\d+)/) || [0, 1080, 2280]).slice(1).map(Number);
      for (let i = 0; i < 9 && !done1; i++) {
        const x = uiXml();
        if (i === 0) fs.writeFileSync(`${OUT}/ui-camera-1.xml`, x);
        if (shot1 && !fs.existsSync(`${OUT}/ui-camera-2.xml`)) fs.writeFileSync(`${OUT}/ui-camera-2.xml`, x);
        if (tapNode(x, new RegExp('text="(NEXT|Next|ALLOW|Allow|While using the app|WHILE USING THE APP|OK)"[^>]*' + B))) { await sleep(1500); continue; }
        if (shot1 && tapNode(x, new RegExp('(resource-id="com\\.android\\.camera2:id/done_button"|content-desc="Done")[^>]*' + B))) { done1 = true; break; }
        if (!shot1 && tapNode(x, new RegExp('(resource-id="com\\.android\\.camera2:id/shutter_button"|content-desc="Shutter")[^>]*' + B))) { shot1 = true; await sleep(5000); shot('camera-taken'); continue; }
        if (shot1 && i === 4) { sh(`adb shell input tap ${size[0] >> 1} ${Math.round(size[1] * 0.866)}`); note('shutter tapped again at its place on screen'); await sleep(5000); shot('camera-taken-2'); continue; }
        await sleep(1500);
      }
      note('camera automation: shutter ' + shot1 + ', done ' + done1);
      fs.writeFileSync(`${OUT}/camera-log.txt`, sh('adb logcat -d').split('\n').filter(l => /Fasih|fasih|AndroidRuntime|FileProvider|Force finishing|has died/i.test(l)).slice(-120).join('\n'));
      if (!done1) { sh('adb shell input keyevent 4'); await sleep(1500); }
      const cam = await Promise.race([wait, sleep(20000).then(() => 'no answer')]); note('camera request result: ' + cam);
      await backToApp();
      if (!page) throw new Error('page lost after the camera request');
      ok(/^ok |cancel/.test(cam), 'camera request returns to the app (' + cam + ')');
      if (/^ok /.test(cam)) {
        const id = cam.split(' ')[1];
        const img = await page.evaluate(i => fetch(window.Fasih.img.url(i)).then(r => r.status + ' ' + r.headers.get('content-type'), e => 'fail ' + e), id);
        ok(/^200 image\/jpeg/.test(img), 'a photo taken with the camera is scaled and shown inside the app (' + cam + ' → ' + img + ')');
        globalThis.__photo = id;
      }
    });
    await step('gallery', async () => {
      if (!page || page.isClosed()) page = await connect(60000);
      if (!page) throw new Error('no page');
      // gallery: push a picture and choose it in the system picker (best effort: the picker differs between Android versions)
      sh('adb push test/sample.jpg /sdcard/Download/fasihtest.jpg'); sh('adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/fasihtest.jpg'); await sleep(1500);
      const wait2 = page.evaluate(() => new Promise(res => { const t = setTimeout(() => res('timeout'), 40000); window.Fasih.img.pick('gallery', (r, d) => { clearTimeout(t); res(r ? 'ok ' + r.id + ' ' + r.w + 'x' + r.h : ((d && d.ev) || 'null') + ' ' + ((d && d.msg) || '')); }); })).catch(e => 'evaluate failed: ' + String(e.message || e).split('\n')[0]);
      let tapped = false;
      for (let i = 0; i < 8 && !tapped; i++) {
        await sleep(2500); const x = uiXml();
        const tap = re => { const m = x.match(re); if (!m) return false; sh(`adb shell input tap ${(+m[1] + +m[3]) >> 1} ${(+m[2] + +m[4]) >> 1}`); return true; };
        if (i === 0) { shot('picker'); fs.writeFileSync(`${OUT}/ui-picker-1.xml`, x); }
        if (tap(/text="fasihtest\.jpg"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || tap(/content-desc="[^"]*fasihtest[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
          || tap(/resource-id="[^"]*id\/(icon_thumbnail|icon_thumb|item_root|thumbnail)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)) { tapped = true; fs.writeFileSync(`${OUT}/ui-picker-2.xml`, x); await sleep(2500); const y = uiXml(); const m2 = y.match(/text="(Add|ADD|Done|DONE|Select|SELECT|Open|OPEN)[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/); if (m2 && !/fasih/.test(sh('adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity"'))) { sh(`adb shell input tap ${(+m2[2] + +m2[4]) >> 1} ${(+m2[3] + +m2[5]) >> 1}`); } break; }
        // open the drawer / the Downloads root when the file is not on the first screen
        if (!(tap(/text="Downloads?"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || tap(/content-desc="Show roots"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || tap(/text="(Files|Documents)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/))) { /* wait for the next dump */ }
      }
      if (!tapped) { shot('picker-not-automated'); fs.writeFileSync(`${OUT}/ui-picker-3.xml`, uiXml()); for (let i = 0; i < 3; i++) { sh('adb shell input keyevent 4'); await sleep(700); } }
      const gal = await Promise.race([wait2, sleep(45000).then(() => 'no answer')]);
      await backToApp(); note('gallery request result: ' + gal + (tapped ? '' : ' (the picker could not be driven automatically)'));
      if (/^ok /.test(gal) && page) {
        const id = gal.split(' ')[1]; globalThis.__photo = id;
        const img = await page.evaluate(i => fetch(window.Fasih.img.url(i)).then(r => r.status + ' ' + r.headers.get('content-type'), e => 'fail ' + e), id);
        ok(/^200 image\/jpeg/.test(img), 'the picked photo is scaled and shown inside the app (' + gal + ' → ' + img + ')');
      } else note('gallery pick not verified on this emulator');
    });
    await step('photo request', async () => {
      const id = globalThis.__photo;
      if (!id || !globalThis.__call || !page || page.isClosed()) { note('no photo available on this emulator: the request with a photo was not exercised'); return; }
      const body = JSON.stringify({ model: 'test-model', max_tokens: 16, messages: [{ role: 'user', content: [{ type: 'text', text: 'What is in this photo?' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '@@IMG:' + id + '@@' } }] }] });
      const c = await globalThis.__call('claude', '/v1/messages', body);
      note('request with the photo attached → ' + JSON.stringify({ ev: c.ev, status: c.status, body: String(c.body || '').slice(0, 160) }));
      ok(c.status === 401, 'a request carrying the photo is sent (refused only because the key is a dummy, HTTP ' + c.status + ')');
      const gone = await globalThis.__call('claude', '/v1/messages', body.replace('@@IMG:' + id + '@@', '@@IMG:nosuchphoto@@'));
      ok(gone.status === 0 && /photo no longer available/.test(gone.body || ''), 'a request whose photo is missing is stopped before it is sent');
      const how = await page.evaluate(i => window.FasihNative.aiSend('claude', 'Fasih test request with a photo', i), id); await sleep(3000); shot('share-with-photo');
      const top = sh('adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity"').trim().replace(/\s+/g, ' ').slice(0, 160);
      ok(how === 'chooser' && /Chooser|chooser|ResolverActivity|intentresolver/.test(top), 'sharing the photo with the request opens the Android share sheet (' + how + ' | ' + top + ')');
      sh('adb shell input keyevent 4'); await sleep(1200); await backToApp();
    });
    await step('restart', async () => {
      if (!page || page.isClosed()) { start(); await sleep(2500); page = await connect(60000); }
      if (!page) throw new Error('no page');
      const native = await page.evaluate(() => { try { const o = JSON.parse(window.FasihNative.restore()); return o.onboard === true && Object.keys(o.cards).length; } catch (e) { return -1; } });
      ok(native === cards, 'progress stored in the native file (' + native + ' cards)');
      sh(`adb shell am force-stop ${PKG}`); await sleep(2500); start(); await sleep(3000); dismissAnr();
      page = await connect(60000);
      ok(!!page && await page.evaluate(() => window.Fasih.S.onboard === true && Object.keys(window.Fasih.S.cards).length) === cards, 'progress kept after force stop');
      shot('after-restart');
      if (page) {
        await page.evaluate(() => { window.Fasih.flush(); localStorage.clear(); }); await sleep(500);
        sh(`adb shell am force-stop ${PKG}`); await sleep(2500); start(); await sleep(3000); dismissAnr();
        page = await connect(60000);
        ok(!!page && await page.evaluate(() => window.Fasih.S.onboard === true && Object.keys(window.Fasih.S.cards).length) === cards, 'progress restored from the native file when web storage is empty');
      }
    });
    await step('dark and back', async () => {
      sh('adb shell cmd uimode night yes'); await sleep(1500); sh(`adb shell am force-stop ${PKG}`); await sleep(1500); start(); await sleep(5000); shot('dark-mode'); sh('adb shell cmd uimode night no');
      sh('adb shell input keyevent 4'); await sleep(1200);
      ok(!!pidOf(), 'back button leaves the app alive in the background');
    });
  }
  const crash = sh('adb logcat -d -b crash');
  ok(!ownCrash(crash), 'no crash of the app during the tests');
  if (/FATAL EXCEPTION/.test(crash)) fs.writeFileSync(`${OUT}/crash.txt`, crash.split('\n').slice(-80).join('\n'));
  fs.writeFileSync(`${OUT}/logcat.txt`, sh('adb logcat -d -s Fasih:V FasihJS:V AndroidRuntime:E chromium:E').split('\n').slice(-400).join('\n'));
  if (rep.pageErrors.length) ok(false, 'JavaScript errors: ' + rep.pageErrors.slice(0, 3).join(' | '));
  console.log(`\n${rep.pass.length} passed, ${rep.fail.length} failed`);
  save();
  if (device) { try { await device.close(); } catch (e) { /* ignore */ } }
  process.exit(0);
})();

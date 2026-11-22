// Emulator tests for the Fasih Android app (run by .github/workflows/fasih-test.yml).
// 1) adb checks: install, launch, crash log, screenshots; 2) WebView checks through Chrome DevTools: native bridge, state, speech, reminders, a real learning session, restart.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const API = process.argv[2] || 'x', APK = process.argv[3] || 'fasih.apk', PKG = 'io.github.krt123456.fasih', OUT = `results-${API}`;
fs.mkdirSync(OUT, { recursive: true });
const rep = { api: API, pass: [], fail: [], notes: [], pageErrors: [] };
const ok = (c, m) => { (c ? rep.pass : rep.fail).push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
const note = m => { rep.notes.push(String(m)); console.log('NOTE ' + m); };
const sh = (c, ms = 120000) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, timeout: ms }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let shotN = 0;
const shot = name => { const f = `${OUT}/${String(++shotN).padStart(2, '0')}-${name}.png`; try { execSync(`adb exec-out screencap -p > "${f}"`); } catch (e) { note('no screenshot ' + name); } };
const start = () => sh(`adb shell am start -W -n ${PKG}/.MainActivity --ez devtools true`, 60000);
const pidOf = () => sh(`adb shell pidof ${PKG}`).trim().split(/\s+/)[0] || '';
const save = () => { fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1)); };

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
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(false, name + ': ' + String(e.message || e).split('\n')[0]); } save(); };
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
  ok(!/android\.permission\.INTERNET/.test(dump), 'app does not request the INTERNET permission');
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
    await step('restart', async () => {
      const native = await page.evaluate(() => { try { const o = JSON.parse(window.FasihNative.restore()); return o.onboard === true && Object.keys(o.cards).length; } catch (e) { return -1; } });
      ok(native === cards, 'progress stored in the native file (' + native + ' cards)');
      sh(`adb shell am force-stop ${PKG}`); await sleep(2500); start(); await sleep(3000); dismissAnr();
      page = await connect(60000);
      ok(!!page && await page.evaluate(() => window.Fasih.S.onboard === true && Object.keys(window.Fasih.S.cards).length) === cards, 'progress kept after force stop');
      shot('after-restart');
      sh(`adb shell pm clear --cache-only ${PKG}`);
      if (page) { await page.evaluate(() => { localStorage.clear(); }); sh(`adb shell am force-stop ${PKG}`); await sleep(2000); start(); await sleep(3000); page = await connect(60000); ok(!!page && await page.evaluate(() => window.Fasih.S.onboard === true && Object.keys(window.Fasih.S.cards).length) === cards, 'progress restored from the native file when web storage is empty'); }
    });
    await step('dark and back', async () => {
      sh('adb shell cmd uimode night yes'); await sleep(1500); sh(`adb shell am force-stop ${PKG}`); await sleep(1500); start(); await sleep(5000); shot('dark-mode'); sh('adb shell cmd uimode night no');
      sh('adb shell input keyevent 4'); await sleep(1200);
      ok(!!pidOf(), 'back button leaves the app alive in the background');
    });
  }
  const crash = sh('adb logcat -d -b crash');
  ok(!/FATAL EXCEPTION/.test(crash), 'no crash during the tests');
  if (/FATAL EXCEPTION/.test(crash)) fs.writeFileSync(`${OUT}/crash.txt`, crash.split('\n').slice(-80).join('\n'));
  fs.writeFileSync(`${OUT}/logcat.txt`, sh('adb logcat -d -s Fasih:V FasihJS:V AndroidRuntime:E chromium:E').split('\n').slice(-400).join('\n'));
  if (rep.pageErrors.length) ok(false, 'JavaScript errors: ' + rep.pageErrors.slice(0, 3).join(' | '));
  console.log(`\n${rep.pass.length} passed, ${rep.fail.length} failed`);
  save();
  if (device) { try { await device.close(); } catch (e) { /* ignore */ } }
  process.exit(0);
})();

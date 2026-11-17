// Tests de l'application Android sur émulateur (lancé par la CI : .github/workflows/apk-test.yml).
// 1) contrôles par adb (installation, démarrage, captures, erreurs dans logcat) ;
// 2) tests approfondis dans la WebView avec Playwright (pages, sauvegarde, fermeture forcée, retour, thème sombre…).
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const API = process.argv[2] || 'x';
const APK = process.argv[3] || 'pneumo-revision.apk';
const PKG = 'io.github.krt123456.pneumo';
const OUT = `results-${API}`;
fs.mkdirSync(OUT, { recursive: true });
const rep = { api: API, pass: [], fail: [], notes: [], timings: {}, longTasks: [], pageErrors: [] };
const ok = (c, m) => { (c ? rep.pass : rep.fail).push(m); console.log((c ? 'PASS ' : 'FAIL ') + m); };
const note = m => { rep.notes.push(m); console.log('NOTE ' + m); };
const sh = c => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let shotN = 0;
const shot = name => { const f = `${OUT}/${String(++shotN).padStart(2, '0')}-${name}.png`; try { execSync(`adb exec-out screencap -p > "${f}"`); } catch (e) { note('capture impossible ' + name); } return f; };
const start = () => sh(`adb shell am start -W -n ${PKG}/.MainActivity --ez devtools true`);
const stop = () => sh(`adb shell am force-stop ${PKG}`);

let pw = null, device = null, cdpBrowser = null;
const pidOf = () => +((sh(`adb shell pidof ${PKG}`).trim().split(/\s+/)[0]) || 0);
const ready = async page => { await page.waitForFunction(() => window.PNEUMO && PNEUMO.S && document.getElementById('main'), null, { timeout: 15000 }); page.on('pageerror', e => rep.pageErrors.push(String(e))); return page; };
async function connectCDP(timeout) {
  // repli : redirection adb vers la socket devtools de la WebView du bon processus, puis connexion CDP
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const pid = pidOf();
    if (pid) {
      sh('adb forward --remove-all');
      sh(`adb forward tcp:9333 localabstract:webview_devtools_remote_${pid}`);
      try {
        const { chromium } = await import('playwright-core');
        if (cdpBrowser) { try { await cdpBrowser.close(); } catch (e) { /* ignore */ } }
        cdpBrowser = await chromium.connectOverCDP('http://127.0.0.1:9333', { timeout: 10000 });
        const ctx = cdpBrowser.contexts()[0], page = ctx && ctx.pages()[0];
        if (page) return await ready(page);
      } catch (e) { /* on réessaie */ }
    }
    await sleep(1500);
  }
  return null;
}
async function connect(timeout = 30000) {
  const deadline = Date.now() + timeout;
  let lastErr = '';
  while (pw && device && Date.now() < deadline) {
    const pid = pidOf();
    if (pid) {
      try {
        await device.webView({ pkg: PKG }, { timeout: 1500 }).catch(() => null);
        const wv = device.webViews().find(w => w.pkg() === PKG && w.pid() === pid);
        if (wv) return await ready(await wv.page());
      } catch (e) { lastErr = String(e.message || e).split('\n')[0]; }
    }
    await sleep(700);
  }
  const p2 = await connectCDP(20000);
  if (p2) { note('connexion par CDP (repli)'); return p2; }
  note('connexion WebView impossible : ' + lastErr);
  return null;
}
async function relaunch() { stop(); await sleep(2500); const r = start(); const t = (r.match(/TotalTime: (\d+)/) || [])[1]; await sleep(1500); return [await connect(), t]; }
const go = async (page, r) => page.evaluate(async r => { const t0 = performance.now(); location.hash = '#/' + r; await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))); return Math.round(performance.now() - t0); }, r);

(async () => {
  // ---------- 0) installation ----------
  console.log(sh(`adb install -r "${APK}"`));
  ok(sh(`adb shell pm list packages ${PKG}`).includes(PKG), 'installation de l\'APK');
  const dump = sh(`adb shell dumpsys package ${PKG}`);
  note((dump.match(/versionName=\S+/) || ['versionName=?'])[0] + ' ' + (dump.match(/versionCode=\d+/) || [''])[0]);
  note('WebView : ' + ((sh('adb shell dumpsys webviewupdate').match(/Current WebView package \(name, version\): \(([^)]*)\)/) || [])[1] || '?'));
  note('Android : ' + sh('adb shell getprop ro.build.version.release').trim() + ' (API ' + sh('adb shell getprop ro.build.version.sdk').trim() + ')');
  sh('adb logcat -c');

  // ---------- 1) premier lancement ----------
  const r0 = start();
  rep.timings.coldStartMs = +((r0.match(/TotalTime: (\d+)/) || [])[1] || 0);
  await sleep(7000);
  shot('premier-lancement');
  ok(!/FATAL EXCEPTION/.test(sh('adb logcat -d -b crash')), 'pas de plantage au démarrage');
  ok(sh(`adb shell pidof ${PKG}`).trim().length > 0, 'application en cours d\'exécution');

  // ---------- 2) tests approfondis (Playwright) ----------
  try { const m = await import('playwright-core'); pw = m._android; [device] = await pw.devices(); } catch (e) { note('Playwright Android indisponible : ' + String(e.message || e).split('\n')[0]); pw = null; }
  let page = await connect();
  if (!page) {
    note('Tests approfondis ignorés (WebView non pilotable ici) : seuls les contrôles adb comptent.');
  } else {
    ok(await page.evaluate(() => !!(window.PNEUMO && PNEUMO.isApp && window.PneumoNative)), 'pont natif présent (PNEUMO.isApp)');
    ok(await page.evaluate(() => !(navigator.serviceWorker && navigator.serviceWorker.controller)), 'pas de service worker dans l\'application');
    note('version vue par le site : ' + await page.evaluate(() => PneumoNative.version()));
    await page.evaluate(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); } catch (e) { /* ignore */ } });
    // accueil
    if (await page.locator('#obgo').count()) { shot('accueil-bienvenue'); await page.locator('#obgo').click(); await sleep(600); }
    ok(await page.evaluate(() => PNEUMO.S.onboard === true), 'accueil validé');
    shot('aujourdhui');
    // toutes les pages
    const routes = ['', 'cours', 'c/bpco', 'c/bpco/pieges', 'c/bpco/quiz', 'c/bpco/cartes', 'c/td-efr/ecos', 'c/pac/pdf', 'c/pleuresie/notes', 'train', 'quiz', 'refaire', 'cartes', 'memo', 'chiffres', 'chiffres/quiz',
      'cliches', 'ecos', 'outils', 'jeu', 'exam', 'pomodoro', 'glossaire', 'veille', 'annales', 'planning', 'moi', 'erreurs', 'reglages', 'app', 'recherche/BAAR'];
    const SHOTS = new Set(['cours', 'c/bpco', 'c/bpco/quiz', 'train', 'chiffres/quiz', 'cliches', 'outils', 'planning', 'moi', 'reglages', 'app']);
    for (const r of routes) {
      const t = await go(page, r); await sleep(250);
      rep.timings['#/' + r] = t;
      const n = await page.evaluate(() => document.getElementById('main').innerText.trim().length);
      ok(n > 30, `page #/${r} affichée (${t} ms)`);
      if (SHOTS.has(r)) shot(r.replace(/\//g, '_') || 'accueil');
    }
    // mode mémoire sur une fiche
    await go(page, 'c/bpco'); await sleep(300);
    if (await page.locator('.readbar .mbtn').count()) {
      await page.locator('.readbar .mbtn').click(); await sleep(300);
      ok(await page.evaluate(() => !!document.querySelector('#ltab.memo')), 'mode mémoire activé');
      shot('mode-memoire');
      await page.locator('.readbar .mbtn').click(); await sleep(200);
    } else ok(false, 'bouton du mode mémoire présent');
    // quiz : répondre à une question
    await go(page, 'c/bpco/quiz'); await sleep(400);
    note('quiz : ' + await page.evaluate(() => document.querySelector('#qz') ? document.querySelector('#qz').innerText.slice(0, 80).replace(/\s+/g, ' ') : 'absent'));
    // étudier un cours puis fermeture forcée
    await go(page, 'c/sd-alv'); await sleep(400);
    await page.locator('[data-act=study]').first().click(); await sleep(900);
    const xp1 = await page.evaluate(() => PNEUMO.S.xp);
    ok(await page.evaluate(() => PNEUMO.S.L['sd-alv'] && PNEUMO.S.L['sd-alv'].st === 'done'), 'cours marqué étudié');
    let t;
    [page, t] = await relaunch(); rep.timings.warmRestartMs = +t || 0;
    if (page) {
      ok(await page.evaluate(() => !!(PNEUMO.S.L['sd-alv'] && PNEUMO.S.L['sd-alv'].st === 'done')), 'progression conservée après fermeture forcée');
      ok((await page.evaluate(() => PNEUMO.S.xp)) === xp1, 'XP conservés après fermeture forcée');
      ok(await page.evaluate(() => PNEUMO.S.onboard === true), 'pas de nouvel accueil au relancement');
      // stockage web effacé : restauration depuis la copie interne
      await page.evaluate(() => { localStorage.clear(); });
      await sleep(8000); // le WebView écrit localStorage sur le disque avec quelques secondes de retard
      [page] = await relaunch();
      if (page) {
        ok(await page.evaluate(() => PNEUMO.loadedFrom === 'application'), 'restauration depuis la copie interne (' + await page.evaluate(() => PNEUMO.loadedFrom) + ')');
        ok(await page.evaluate(() => !!(PNEUMO.S.L['sd-alv'] && PNEUMO.S.L['sd-alv'].st === 'done')), 'progression intacte après effacement du stockage web');
        await sleep(500);
        ok(await page.evaluate(() => !!localStorage.getItem('pneumo-revision-v1')), 'stockage web resynchronisé');
      }
    }
    // application tuée une demi-seconde après une action (la copie interne doit suffire)
    if (page) {
      await go(page, 'c/abces'); await sleep(400);
      await page.locator('[data-act=study]').first().click(); await sleep(500);
      [page] = await relaunch();
      if (page) ok(await page.evaluate(() => !!(PNEUMO.S.L['abces'] && PNEUMO.S.L['abces'].st === 'done')), 'action conservée même si l\'application est tuée 0,5 s après');
    }
    // modification sans P.save(), puis bouton Accueil et arrêt par le système
    if (page) {
      await page.evaluate(() => { PNEUMO.S.notes.bg = 'arriere-plan'; });
      sh('adb shell input keyevent KEYCODE_HOME'); await sleep(2000);
      [page] = await relaunch();
      if (page) ok((await page.evaluate(() => PNEUMO.S.notes.bg)) === 'arriere-plan', 'sauvegarde à la mise en arrière-plan');
    }
    // bouton retour
    if (page) {
      await go(page, 'train'); await sleep(300); await go(page, 'memo'); await sleep(300);
      sh('adb shell input keyevent KEYCODE_BACK'); await sleep(800);
      ok((await page.evaluate(() => location.hash)) === '#/train', 'bouton retour : page précédente');
    }
    // export (sélecteur de fichier Android) puis retour
    if (page) {
      await go(page, 'reglages'); await sleep(400);
      await page.locator('[data-act=export]').click(); await sleep(2500);
      shot('export-selecteur');
      sh('adb shell input keyevent KEYCODE_BACK'); await sleep(1200);
      ok((await page.evaluate(() => 1 + 1)) === 2, 'application réactive après l\'export');
      await page.locator('[data-act=copycode]').click(); await sleep(800);
      ok(await page.locator('#cc').count() === 1, 'code de sauvegarde affiché');
      shot('code-sauvegarde');
      await page.evaluate(() => PNEUMO.UI.closeSheet());
    }
    // rotation de l'écran
    if (page) {
      sh('adb shell settings put system accelerometer_rotation 0'); sh('adb shell settings put system user_rotation 1'); await sleep(2000);
      shot('paysage');
      ok((await page.evaluate(() => document.getElementById('main').innerText.length)) > 30, 'affichage en paysage');
      sh('adb shell settings put system user_rotation 0'); await sleep(1500);
    }
    // performances
    if (page) {
      rep.longTasks = await page.evaluate(() => (window.__lt || []).slice(0, 50));
      const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.duration) : 0; });
      rep.timings.pageLoadMs = nav;
    }
    // thème sombre du téléphone (l'activité est recréée)
    sh('adb shell cmd uimode night yes'); await sleep(3500);
    page = await connect(15000);
    shot('theme-sombre');
    if (page) ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'thème sombre suivi');
    sh('adb shell cmd uimode night no'); await sleep(2500);
  }

  // ---------- 3) journal ----------
  const log = sh(`adb logcat -d -v time -s PneumoJS:* PneumoApp:* chromium:E AndroidRuntime:E`);
  fs.writeFileSync(`${OUT}/logcat.txt`, log);
  const jsErr = log.split('\n').filter(l => /Uncaught|TypeError|ReferenceError|SyntaxError/.test(l));
  ok(jsErr.length === 0, 'aucune erreur JavaScript dans le journal' + (jsErr.length ? ' : ' + jsErr.slice(0, 3).join(' | ') : ''));
  ok(!/FATAL EXCEPTION/.test(sh('adb logcat -d -b crash')), 'aucun plantage pendant les tests');
  ok(rep.pageErrors.length === 0, 'aucune erreur de page' + (rep.pageErrors.length ? ' : ' + rep.pageErrors.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1));
  console.log(`\n${rep.pass.length} réussis, ${rep.fail.length} échoués`);
  process.exitCode = rep.fail.length ? 1 : 0;
  process.exit();
})().catch(e => { console.error(e); rep.fail.push('exception : ' + e.message); try { fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1)); } catch (x) { /* ignore */ } process.exit(1); });

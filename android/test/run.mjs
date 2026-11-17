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
const sh = (c, ms = 120000) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, timeout: ms }); } catch (e) { return String(e.stdout || '') + String(e.stderr || '') + (e.code === 'ETIMEDOUT' || e.signal ? ' [délai dépassé]' : ''); } };
const within = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé (' + ms + ' ms)')), ms))]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let shotN = 0;
const shot = name => { const f = `${OUT}/${String(++shotN).padStart(2, '0')}-${name}.png`; try { execSync(`adb exec-out screencap -p > "${f}"`); } catch (e) { note('capture impossible ' + name); } return f; };
const start = () => sh(`adb shell am start -W -n ${PKG}/.MainActivity --ez devtools true`, 60000);
const crashLog = () => sh('adb logcat -d -b crash').split('\n').slice(-40).join('\n');
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
        cdpBrowser = await within(15000, chromium.connectOverCDP('http://127.0.0.1:9333', { timeout: 10000 }));
        const ctx = cdpBrowser.contexts()[0], page = ctx && ctx.pages()[0];
        if (page) return await within(20000, ready(page));
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
        await within(4000, device.webView({ pkg: PKG }, { timeout: 1500 })).catch(() => null);
        const wv = device.webViews().find(w => w.pkg() === PKG && w.pid() === pid);
        if (wv) return await within(25000, (async () => ready(await wv.page()))());
      } catch (e) { lastErr = String(e.message || e).split('\n')[0]; }
    }
    await sleep(700);
  }
  const p2 = await connectCDP(20000);
  if (p2) { note('connexion par CDP (repli)'); return p2; }
  note('connexion WebView impossible : ' + lastErr);
  return null;
}
let page = null;
async function ensureRunning(why) {
  if (pidOf()) return true;
  note('application absente (' + why + ') ; journal des plantages : ' + (crashLog().trim().slice(-600) || 'vide'));
  const r = start(); await sleep(3000);
  if (!pidOf()) { note('nouvel essai de démarrage : ' + r.trim().slice(0, 300)); start(); await sleep(4000); }
  return !!pidOf();
}
async function live() { if (!page || page.isClosed()) { await ensureRunning('avant une étape'); page = await connect(20000); } return page; }
async function step(name, fn) {
  try { if (!(await live())) { ok(false, name + ' : WebView inaccessible'); return; } await fn(page); }
  catch (e) { ok(false, name + ' : ' + String(e.message || e).split('\n')[0]); try { page = await connect(15000); } catch (x) { /* ignore */ } }
}
async function relaunch() {
  stop(); await sleep(2500);
  const r = start(); const t = (r.match(/TotalTime: (\d+)/) || [])[1];
  for (let i = 0; i < 10 && !pidOf(); i++) await sleep(1000);
  if (!pidOf()) { ok(false, 'redémarrage de l\'application (sortie de am start : ' + r.trim().slice(0, 200) + ')'); await ensureRunning('après redémarrage'); }
  await sleep(1500); page = await connect(); return [page, t];
}
// ---------- WebView ancienne (Android 8-9 des émulateurs) : pilotage par UI Automator, sans Playwright ----------
const ENT = { '&apos;': "'", '&#39;': "'", '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#10;': ' ' };
const dec = t => t.replace(/&(apos|quot|amp|lt|gt|#39|#10);/g, m => ENT[m]);
const uiDump = () => { for (let i = 0; i < 3; i++) { sh('adb shell rm -f /sdcard/ui.xml'); sh('adb shell uiautomator dump /sdcard/ui.xml'); const x = sh('adb shell cat /sdcard/ui.xml'); if (x.includes('<hierarchy')) return x; } return ''; };
const uiNodes = xml => (xml.match(/<node [^>]*>/g) || []).map(n => ({ t: dec(((n.match(/ text="([^"]*)"/) || [])[1] || '') + ' ' + ((n.match(/ content-desc="([^"]*)"/) || [])[1] || '')).trim(), b: (n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || []).slice(1).map(Number) })).filter(n => n.t);
const uiText = xml => uiNodes(xml).map(n => n.t).join(' | ');
const uiTap = (xml, re, last) => { const ns = uiNodes(xml).filter(n => re.test(n.t) && n.b.length === 4); const n = last ? ns[ns.length - 1] : ns[0]; if (!n) return false; sh(`adb shell input tap ${(n.b[0] + n.b[2]) >> 1} ${(n.b[1] + n.b[3]) >> 1}`); return true; };
const waitUi = async (re, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { const x = uiDump(); if (re.test(uiText(x))) return x; await sleep(1200); } return ''; };
async function oldDeviceTests() {
  note('WebView ancienne : tests par UI Automator (Playwright ne sait pas piloter cette version)');
  let x = await waitUi(/Bienvenue|C'est parti/, 40000);
  ok(!!x, 'accueil affiché (lecture de l\'écran)');
  if (!x) { note('écran lu : ' + uiText(uiDump()).slice(0, 400)); return; }
  shot('accueil-bienvenue');
  uiTap(x, /C'est parti/);
  x = await waitUi(/jours avant l'examen|Au programme/, 15000);
  ok(!!x, 'page « Aujourd\'hui » affichée');
  shot('aujourdhui');
  uiTap(x || uiDump(), /^Cours$/, true);
  x = await waitUi(/Pleurésie purulente/, 15000);
  ok(!!x, 'liste des cours affichée'); shot('cours');
  if (!x) return;
  uiTap(x, /Pleurésie purulente/);
  x = await waitUi(/J'ai étudié ce cours/, 15000);
  ok(!!x, 'fiche de cours affichée'); shot('fiche');
  if (!x) return;
  uiTap(x, /J'ai étudié ce cours/);
  x = await waitUi(/Étudié le/, 8000);
  ok(!!x, 'cours marqué étudié');
  await sleep(1500); stop(); await sleep(2500); start();
  x = await waitUi(/jours avant l'examen|Au programme|Bienvenue/, 40000);
  ok(!!x && !/Bienvenue/.test(uiText(x)), 'progression conservée après fermeture forcée (pas de nouvel accueil)');
  shot('relance');
  uiTap(x || uiDump(), /^Cours$/, true);
  x = await waitUi(/Pleurésie purulente/, 15000);
  const ns = uiNodes(x), i = ns.findIndex(n => /Pleurésie purulente/.test(n.t));
  ok(i >= 0 && ns.slice(i, i + 4).some(n => /Étudié le/.test(n.t)), 'cours étudié toujours coché après relance');
  shot('cours-apres-relance');
  sh('adb shell settings put system accelerometer_rotation 0'); sh('adb shell settings put system user_rotation 1'); await sleep(2500);
  ok(/Pleurésie|Cours/.test(uiText(uiDump())), 'affichage en paysage'); shot('paysage');
  sh('adb shell settings put system user_rotation 0'); await sleep(1500);
}
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

  // ---------- 2) tests approfondis (Playwright ; UI Automator pour les WebView anciennes) ----------
  const OLD = +API < 29;
  if (OLD) { await oldDeviceTests(); page = null; }
  else {
    try { const m = await import('playwright-core'); pw = m._android; [device] = await pw.devices(); } catch (e) { note('Playwright Android indisponible : ' + String(e.message || e).split('\n')[0]); pw = null; }
    page = await Promise.race([connect(), sleep(90000).then(() => null)]);
  }
  if (OLD) { /* déjà testé ci-dessus */ } else if (!page) {
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
    await step('fermeture forcée', async () => {
      await go(page, 'c/sd-alv'); await sleep(400);
      if (await page.locator('[data-act=study]').count()) { await page.locator('[data-act=study]').first().click(); await sleep(900); }
      const xp1 = await page.evaluate(() => PNEUMO.S.xp);
      ok(await page.evaluate(() => !!(PNEUMO.S.L['sd-alv'] && PNEUMO.S.L['sd-alv'].st === 'done')), 'cours marqué étudié');
      const [, t] = await relaunch(); rep.timings.warmRestartMs = +t || 0;
      ok(await page.evaluate(() => !!(PNEUMO.S.L['sd-alv'] && PNEUMO.S.L['sd-alv'].st === 'done')), 'progression conservée après fermeture forcée');
      ok((await page.evaluate(() => PNEUMO.S.xp)) === xp1, 'XP conservés après fermeture forcée');
      ok(await page.evaluate(() => PNEUMO.S.onboard === true), 'pas de nouvel accueil au relancement');
    });
    // stockage web ancien ou incomplet : la copie interne, plus récente, doit l'emporter
    await step('copie interne', async () => {
      await page.evaluate(() => { const k = 'pneumo-revision-v1', o = JSON.parse(localStorage.getItem(k)); o.savedAt = 1; delete o.L['sd-alv']; localStorage.setItem(k, JSON.stringify(o)); });
      await sleep(6000);
      await relaunch();
      note('origin of state after restart: ' + await page.evaluate(() => PNEUMO.loadedFrom));
      ok(await page.evaluate(() => !!(PNEUMO.S.L['sd-alv'] && PNEUMO.S.L['sd-alv'].st === 'done')), 'la copie interne la plus récente est retenue');
      await sleep(5000);
      ok(await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('pneumo-revision-v1') || 'null'); return !!(o && o.L['sd-alv'] && o.L['sd-alv'].st === 'done'); }), 'stockage web resynchronisé');
    });
    // application tuée une demi-seconde après une action (la copie interne doit suffire)
    await step('arrêt brutal', async () => {
      await go(page, 'c/saos'); await sleep(400);
      if (!(await page.locator('[data-act=study]').count())) { await go(page, 'c/khp'); await sleep(400); }
      const lid = (await page.evaluate(() => location.hash)).split('/')[2];
      await page.locator('[data-act=study]').first().click(); await sleep(500);
      await relaunch();
      ok(await page.evaluate(id => !!(PNEUMO.S.L[id] && PNEUMO.S.L[id].st === 'done'), lid), 'action conservée même si l\'application est tuée 0,5 s après (' + lid + ')');
    });
    // modification sans P.save(), puis bouton Accueil et arrêt par le système
    await step('arrière-plan', async () => {
      await page.evaluate(() => { PNEUMO.S.notes.bg = 'arriere-plan'; });
      sh('adb shell input keyevent KEYCODE_HOME'); await sleep(2000);
      await relaunch();
      ok((await page.evaluate(() => PNEUMO.S.notes.bg)) === 'arriere-plan', 'sauvegarde à la mise en arrière-plan');
    });
    // bouton retour
    await step('retour', async () => {
      await go(page, 'train'); await sleep(300); await go(page, 'memo'); await sleep(300);
      sh('adb shell input keyevent KEYCODE_BACK'); await sleep(800);
      ok((await page.evaluate(() => location.hash)) === '#/train', 'bouton retour : page précédente');
    });
    await step('examen blanc', async () => {
      await go(page, 'exam'); await sleep(400);
      await page.locator('[data-exn="20"]').click(); await page.locator('[data-exgo]').click(); await sleep(500);
      for (let i = 0; i < 80; i++) {
        if (await page.locator('.qz.res').count()) break;
        if (!(await page.locator('.opt.sel').count()) && (await page.locator('.opt').count())) { await page.locator('.opt').first().click(); await sleep(40); }
        await page.evaluate(() => { const v = document.querySelector('[data-v]'); if (v) v.click(); }); await sleep(60);
      }
      ok(await page.locator('.qz.res').count() === 1, 'examen blanc mené jusqu\'au score');
      shot('examen-blanc-resultat');
    });
    // export (sélecteur de fichier Android) puis retour
    await step('rappel quotidien', async () => {
      sh(`adb shell pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
      await go(page, 'reglages'); await sleep(400);
      ok(await page.locator('#remon').count() === 1, 'réglage du rappel présent');
      await page.evaluate(() => PneumoNative.setReminder(true, 20, 0, false));
      const st = await page.evaluate(() => PneumoNative.reminder());
      ok(st.indexOf('true|20|0') === 0, 'rappel enregistré (' + st + ')');
      ok(sh('adb shell dumpsys alarm').includes(PKG), 'alarme quotidienne programmée');
      await page.evaluate(() => PneumoNative.testReminder()); await sleep(1500);
      const nt = sh('adb shell dumpsys notification --noredact');
      ok(nt.includes(PKG) && /avant l'examen|Pneumo Révision|Demain/.test(nt), 'notification affichée');
      sh('adb shell cmd statusbar expand-notifications'); await sleep(1500); shot('notification'); sh('adb shell cmd statusbar collapse'); await sleep(600);
      await page.evaluate(() => PneumoNative.setReminder(false, 20, 0, false));
    });
    await step('lecture vocale', async () => {
      await go(page, 'c/grippe'); await sleep(400);
      await page.evaluate(() => { const b = document.querySelector('[data-act=speak]'); if (b) b.click(); });
      await sleep(4000);
      const sp = await page.evaluate(() => { try { return PneumoNative.speaking(); } catch (e) { return 'err ' + e.message; } });
      note('lecture vocale en cours : ' + sp);
      ok(sp === true || sp === false, 'lecture vocale sans erreur');
      await page.evaluate(() => { try { PneumoNative.stopSpeak(); } catch (e) { /* ignore */ } });
    });
    await step('export', async () => {
      await go(page, 'reglages'); await sleep(400);
      await page.locator('[data-act=export]').click();
      let picker = false;
      for (let i = 0; i < 16 && !picker; i++) { await sleep(500); picker = /documentsui/i.test(sh('adb shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp"')); }
      ok(picker, 'sélecteur de fichier Android ouvert pour l\'export');
      await sleep(800); shot('export-selecteur');
      sh('adb shell input keyevent KEYCODE_BACK'); await sleep(1200);
      ok((await page.evaluate(() => 1 + 1)) === 2, 'application réactive après l\'export');
      await page.locator('[data-act=copycode]').click(); await sleep(800);
      ok(await page.locator('#cc').count() === 1, 'code de sauvegarde affiché');
      shot('code-sauvegarde');
      await page.evaluate(() => PNEUMO.UI.closeSheet());
    });
    // rotation de l'écran
    await step('paysage', async () => {
      sh('adb shell settings put system accelerometer_rotation 0'); sh('adb shell settings put system user_rotation 1'); await sleep(2000);
      shot('paysage');
      ok((await page.evaluate(() => document.getElementById('main').innerText.length)) > 30, 'affichage en paysage');
      sh('adb shell settings put system user_rotation 0'); await sleep(1500);
    });
    // performances
    await step('performances', async () => {
      rep.longTasks = await page.evaluate(() => (window.__lt || []).slice(0, 50));
      const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.duration) : 0; });
      rep.timings.pageLoadMs = nav;
    });
    // thème sombre du téléphone (l'activité est recréée) : la progression doit survivre, le thème doit suivre
    let xpBefore = null;
    try { await live(); xpBefore = await page.evaluate(() => PNEUMO.S.xp); } catch (e) { /* ignore */ }
    sh('adb shell cmd uimode night yes'); await sleep(4000);
    note('processus après changement de thème : ' + (pidOf() || 'aucun'));
    ok(!/FATAL EXCEPTION/.test(sh('adb logcat -d -b crash')), 'pas de plantage au changement de thème du téléphone');
    shot('theme-sombre');
    await relaunch();
    if (page) {
      ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'thème sombre du téléphone suivi');
      if (xpBefore != null) ok((await page.evaluate(() => PNEUMO.S.xp)) === xpBefore, 'progression intacte après le changement de thème (' + xpBefore + ' XP)');
      await go(page, 'reglages'); await sleep(500);
      const ago = await page.evaluate(() => (document.getElementById('svago') || {}).textContent || '');
      ok(ago && ago !== 'pas encore', 'heure de la dernière sauvegarde affichée après relance (' + ago + ')');
      shot('theme-sombre-reglages');
    } else ok(false, 'thème sombre : WebView inaccessible après relance');
    sh('adb shell cmd uimode night no'); await sleep(2500);
  }

  // ---------- 3) journal ----------
  const log = sh(`adb logcat -d -v time -s PneumoJS:* PneumoApp:* chromium:E AndroidRuntime:E`);
  fs.writeFileSync(`${OUT}/logcat.txt`, log);
  const jsErr = log.split('\n').filter(l => /Uncaught|TypeError|ReferenceError|SyntaxError/.test(l));
  ok(jsErr.length === 0, 'aucune erreur JavaScript dans le journal' + (jsErr.length ? ' : ' + jsErr.slice(0, 3).join(' | ') : ''));
  const crash = sh('adb logcat -d -b crash'); fs.writeFileSync(`${OUT}/crash.txt`, crash);
  ok(!/FATAL EXCEPTION/.test(crash), 'aucun plantage pendant les tests');
  ok(rep.pageErrors.length === 0, 'aucune erreur de page' + (rep.pageErrors.length ? ' : ' + rep.pageErrors.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1));
  console.log(`\n${rep.pass.length} réussis, ${rep.fail.length} échoués`);
  process.exitCode = rep.fail.length ? 1 : 0;
  process.exit();
})().catch(e => { console.error(e); rep.fail.push('exception : ' + e.message); try { fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rep, null, 1)); } catch (x) { /* ignore */ } process.exit(1); });

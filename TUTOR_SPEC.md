# Fasih: "المعلّم" (AI tutor bridge) — implementation spec v1

Fasih is an offline Android app (WebView + vanilla JS SPA in `www/`) that teaches English to an Arabic speaker (A2 → C1, IELTS). UI language: Arabic, RTL. Read `www/js/*.js` first (they are short and dense) and follow their style exactly: `'use strict'`, one IIFE per file `(function (F) { ... })(window.Fasih)`, no frameworks, no build step, template strings + `esc()` for every dynamic value.

## Goal
The learner has a normal consumer subscription to an AI chat app (Claude, ChatGPT, Gemini or Grok). No API keys, and the app keeps NO internet permission. The feature is a bridge:
1. In Fasih he picks a request. Fasih builds a prompt (his level, weak points, request, and the exact "Fasih pack" JSON format the AI must end its reply with) and hands it to the chosen AI app.
2. He talks to the AI in that app (text, voice, photos).
3. He copies the AI's final code block ("حزمة فصيح") and pastes it into Fasih (or shares it into Fasih). Fasih validates it, shows a preview, and only after his approval adds the content: words, his mistakes, a lesson, a reading text, a quiz, plan changes, advice. Everything can be undone by deleting the pack.

## Two modes (the same requests, packs and screens serve both)
- **Bridge mode** (default, `S.tutor.mode === 'bridge'`): what is described above. Works with a normal subscription.
- **API mode** (`S.tutor.mode === 'api'`): for learners who saved their own API key. The conversation happens inside Fasih in a chat screen that ANOTHER developer is writing in `www/js/chat.js` (`F.chat`). You only call it: `F.chat.ready(ai)` → true when a key is saved for that provider; `F.chat.start({ title, system, user, img })` opens the chat and sends the first message; `F.chat.open()` opens the chat screen; `F.chat.keys()` opens the key sheet. `chat.js` may be missing or unfinished while you work: ALWAYS guard (`F.chat && F.chat.ready && F.chat.ready(ai)`), and when API mode is selected but not ready, fall back to the key sheet if it exists, else to bridge mode with a toast.
  The chat calls back into your module: `F.tutor.system()` (system prompt for a free chat), `F.tutor.offer(text)` (parse a reply; when it contains a pack return `{ ok: true, pack }`), `F.tutor.preview(pack, onDone)` (your preview/approval sheet). Keep these three names and signatures.

## Files
- NEW `www/js/tutor.js` (loaded after `ui.js` in `www/index.html`), NEW `tools/test_tutor.py`.
- `core.js` already contains (do not redo): the `tutor` and `chat` state defaults, `F.AIS` (the four providers: `k`, `n`, `url`) and `F.img` (`F.img.ok()`, `F.img.pick('camera'|'gallery', cb)` → `cb({ id, w, h })` or `cb(null)`, `F.img.url(id)` for an `<img>` thumbnail). `www/index.html` already loads `js/tutor.js` (an empty stub now) and `js/chat.js`.
- Small edits: `core.js` (DB build only), `srs.js` (queue priority), `plan.js` (focus task), `ui.js` (expose routes, nav tab, home card, word-sheet button, shared setting function, counters), `flows.js` (writing share button), `www/css/app.css`.
- Another developer is writing `www/js/chat.js`, `www/css/chat.css` and `tools/test_chat.py` at the same time in this folder: never edit those three files.
- DO NOT touch: `android/`, `.github/`, `content/`, `www/content/`, `test/`, `keystore/`. Do not commit, do not push.

## Native bridge (implemented in Java by someone else; call through `F.nat(name, ...args)`, which returns `undefined` in a browser)
- `aiApps()` → JSON string `{"claude":{"inst":true,"send":true,"img":true},"chatgpt":{...},"gemini":{...},"grok":{...}}` (`inst` = app installed, `send` = accepts shared text, `img` = accepts a shared photo).
- `aiSend(key, text, imgId)`: ALWAYS pass three string arguments (`imgId` = `''` when there is no photo). `key` is a provider key or `'other'` (the Android share sheet, any app). The text is always copied to the clipboard as well. Returns: `"send"` (the AI app was opened with the text), `"sendimg"` (opened with the photo; the text may or may not have arrived with it: tell him to paste it if he does not see it), `"copy"` (app opened, text only on the clipboard: he must paste), `"web"` (app not installed: its website was opened in the browser, text on the clipboard), `"chooser"` (the Android share sheet was shown), `"fail"`.
- `copyText(text)` → boolean. `pasteText()` → clipboard text or `""`. `takeShared()` → text that another app shared into Fasih (consumed once) or `""`.
- Event `F.on('shared', fn)`: fired when text is shared into Fasih while it is running; then call `takeShared()`.
- Photos: use `F.img` (see Files). In a browser `F.img.ok()` is false: hide the photo buttons.
- Browser fallback (used by the tests and the web build): `navigator.clipboard.writeText/readText` inside try/catch, and `window.open(url, '_blank')`. If the clipboard is unavailable, show a sheet with the text in a `<textarea readonly>` to copy by hand, and for import a `<textarea>` to paste by hand.

Providers: `F.AIS` plus a fifth choice `other` ("تطبيق آخر": bridge mode only, uses the share sheet). Never put the prompt in a URL.

## State (already in `core.js` DEF)
`tutor: { ai: 'claude', mode: 'bridge', n: 0, sent: 0, last: null, packs: [], lessons: [], readings: [], quizzes: [], mistakes: [], prio: [], focus: null }`
Older saved states lack it: `merge(DEF(), saved)` fills it, but also guard with `S.tutor = S.tutor || {...}` where needed (imported backups).
- New tutor words are stored in the existing `S.custom` array with `tr: 't'` and `pk: <packId>`, id = `'x:' + w.toLowerCase()` (same scheme as hand-added words). In `F.buildDB` keep `tr` `'t'` for those (currently every custom word is forced to `'x'`), add `t: []` to `D.tracks`, and register `S.tutor.lessons/readings/quizzes` objects in `D.byId` (also expose them as `D.tlesson`, `D.treading`, `D.tquiz`). They must NOT be added to `D.grammar` / `D.reading` (those drive the 540-day plan and its counters).
- Ids: pack `p<S.tutor.n>`; lesson `t:l:<pack>:<i>`, reading `t:r:<pack>:<i>`, quiz `t:q:<pack>:<i>`, mistake `t:m:<pack>:<i>`.
- `prio`: ids of words that already exist in the built-in vocabulary, have no card yet, and that the tutor wants taught first.
- `focus`: `{ skill, until }` (`until` = `dayNum()` value) or null.

## Pack format v1 (what the AI is asked to output)
```json
{"fasih":1,"title":"…","note":"…",
 "words":[{"w":"procurement","p":"n","l":"B2","ar":"مشتريات عمومية","d":"the process of buying goods for an organisation","ex":"Public procurement must be open and fair.","x":"procurement","exar":"…","c":["public procurement"]}],
 "mistakes":[{"q":"I am agree with you.","bad":"am agree","good":["agree"],"why":"…"}],
 "lesson":{"l":"B1","title":"…","titleAr":"…","why":"…","rules":[{"ar":"…","form":"…","ex":[{"en":"…","ar":"…"}]}],"mistakes":[{"x":"…","ok":"…","ar":"…"}],"tip":"…","exs":[ …exercise objects… ]},
 "reading":{"l":"B1","title":"…","paras":["…","…"],"gloss":[{"w":"…","ar":"…"}],"qs":[ …question objects… ],"sumAr":"…"},
 "quiz":{"title":"…","exs":[ … ]},
 "plan":{"dailyMin":75,"newPerDay":10,"domain":30,"retention":0.93,"focus":"listening","focusDays":14,"why":"…"}}
```
Every part is optional. Also accept `lessons`, `readings`, `quizzes` as arrays (and a single object under the plural key, or an array under the singular key). Exercise objects are exactly the app's existing ones (see `SPEC.md` "Exercise objects" and `ex.js`): `mc`, `gap`, `fix`, `order`, `trans`; inside `reading.qs` only the kinds that `F.quizForm` really supports (read it; do not guess).

### Parsing (`F.tutor.parse(text)` → `{ ok, pack, err }`)
Input is whatever he copied: maybe the whole AI reply, maybe with markdown fences, maybe with other `{...}` blocks before it. Cap input at 300 000 chars. Strip zero-width characters and replace non-breaking spaces. Scan for `{` positions (string-aware brace matching), `JSON.parse` each balanced candidate, accept the first object that has a `fasih` key. If none parses, retry once after converting curly quotes (“ ” „ ‟ → ", ‘ ’ → ') and removing trailing commas before `}` / `]`. `err`: `'none'` (no candidate at all), `'json'` (a block mentions "fasih" but is not valid JSON), `'ver'` (`fasih` > 1: tell him to update the app). No `eval`, no `Function`.

### Validation / normalisation (`F.tutor.normalise(pack)`): SECURITY-CRITICAL
A pack is untrusted input. Build NEW objects from whitelisted keys only; coerce types; trim; cap lengths; drop everything else (e.g. a `pre` key on an exercise must never survive, because `Ex.run` renders `pre` as raw HTML). Remove control characters. Never insert pack strings into HTML without `esc()` / `F.md()` / `F.words()`. Limits (drop the excess, count what was dropped and show the count in the preview):
- `title` ≤ 80 chars (default "حزمة من المعلّم"), `note` ≤ 800.
- words ≤ 40. Required: `w` (1–60 chars, must contain a Latin letter), `ar` (1–120). `p` ∈ keys of `F.POS` (default `phr` if `w` contains a space, else `n`). `l` ∈ A2/B1/B2/C1 (default `F.level()`). `t` = `'misc'`. `d` ≤ 160, `ex` ≤ 220, `exar` ≤ 220, `c` ≤ 3 items × 60, `f` ≤ 4 × 40. `x` must be an exact substring of `ex`; if not, look for `w` in `ex` case-insensitively and take that substring; if `ex` does not contain the word, set `ex = w`, `x = w` (as `F.addWordSheet` does).
  Dedupe (case-insensitive on `w`) inside the pack and against the DB (`'x:'+w` id, `F.DB.lemma`, any vocab entry with the same `w`): existing + has a card → skip, count as "known"; existing + no card → add its id to `prio` (count as "priority"); else new word.
- mistakes ≤ 20: same shape and checks as a `fix` exercise (`q` ≤ 240, `bad` non-empty exact substring of `q`, `good` 1–5 strings ≤ 80 (a string → one-item array), `why` ≤ 300). Skip duplicates of an existing notebook item (same `q`).
- exercises: `mc` (`q` ≤ 300; `o` 2–5 strings ≤ 140; `a` integer index in range, or a string equal to one option → its index; `why`), `gap` (`q` contains 2+ underscores → normalise to `___`; `a` 1–6 strings ≤ 80), `fix` (as above), `order` (`a` = sentence of 4–14 words; `ar` ≤ 220), `trans` (`q`, `start`, `a` 1–5 strings each starting with `start` ignoring case). `why` ≤ 300, default `''`. Invalid ones are dropped.
- lesson: `title` required (≤ 120), `titleAr` (default = title), `l`, `why` ≤ 500, `rules` 1–6 × `{ ar ≤ 600 (required), form ≤ 200, ex: ≤ 4 × { en ≤ 220, ar ≤ 220 } }`, `mistakes` ≤ 5 × `{ x, ok, ar }` (always an array), `tip` ≤ 300, `exs` 3–20 valid exercises (fewer than 3 valid → drop the lesson). Max 3 lessons per pack.
- reading: `title`, `l`, `paras` 2–10 strings ≤ 1500, `gloss` ≤ 15 × `{ w, ar }`, `qs` 3–12 valid questions (fewer → drop), `sumAr` ≤ 700 (default `''`). Max 2 per pack.
- quiz: `title` (default "تمارين من المعلّم"), `exs` 3–25 valid. Max 2 per pack.
- plan: only these keys, value snapped to the nearest allowed value: `dailyMin` [30,45,60,75,90,120], `newPerDay` [3,5,7,8,10,12,14,16,20], `domain` [10,20,30,40], `retention` [0.85,0.9,0.93], `focus` ∈ reading/listening/speaking/writing/grammar with `focusDays` 3–21 (default 7), `why` ≤ 500. Drop keys whose value equals the current setting.
A pack with nothing usable left → error sheet "الحزمة فارغة أو غير صالحة".

### Preview and apply
Preview sheet (`F.sheet`): title, the note, then one block per part: word rows (`w` — `ar`) and mistake rows (✗ `q` → ✓ corrected) each with a checked checkbox so he can untick items; lesson / reading / quiz titles with exercise counts; plan rows "الإعداد: الحالي ← المقترح" each with a checkbox, plus the tutor's `why`; a small line for known/priority/dropped counts. Buttons: "أضف إلى خطتي" and "إلغاء".
Apply: create the pack record `{ id, at: F.now(), ai: S.tutor.ai, title, note, items: { words: [ids], prio: [ids], mistakes: [ids], lessons: [ids], readings: [ids], quizzes: [ids] }, plan: { before: {...}, after: {...} } | null }`, `S.tutor.packs.unshift(rec)`. Words: push to `S.custom` and into the live DB exactly like `F.addWordSheet` does, plus `F.DB.tracks.t`. Do NOT create cards: tutor words go through the normal "كلمات جديدة" learning flow (pretest → teach → recalls), first in the queue. Lessons/readings/quizzes: store and register in `F.DB.byId`. Mistakes: `{ id, pk, q, bad, good, why, box: 0, due: dayNum(), n: 0, ok: 0 }`. Plan: apply through ONE shared function used by both the settings page and the tutor (refactor `setValue` in `ui.js` into `F.applySetting(key, value)`; apply `dailyMin` before `newPerDay` because `dailyMin` resets `newPerDay`); `focus` → `S.tutor.focus = { skill, until: dayNum() + focusDays }`. Then `F.save()`, `F.checkBadges()` not needed, toast "أُضيفت الحزمة ✓", go to the tutor page.
Delete a pack (from the pack list, after `F.confirm`): remove its words from `S.custom`/DB and their cards + notes, its ids from `prio`, its lessons/readings/quizzes (+ `S.gram[id]`, `S.done.reading[id]`, `S.done.tquiz[id]`), its mistakes; revert each plan key to `before` only if the current value still equals `after`; clear `focus` if it came from this pack. Then `F.buildDB(); F.buildSeq();`.

## Queue priority (`srs.js`)
`F.tutorQueue = () =>` pending tutor words: `prio` ids resolved through `F.DB.byId` that still have no card, then `F.DB.tracks.t` entries without a card. In `SRS.newQueue`, on every second word (`n % 2 === 0`) take the first tutor-queue word that has no card and no `_q`; otherwise the existing track logic. Guard `cnt[k]++` for the new key. `SRS.clearQueued` must also clear `_q` on tutor-queue words; `SRS.remaining()` must add the tutor-queue length. When `prio` ids get a card or disappear from the DB, prune them lazily.

## Focus task (`plan.js`)
In `F.ensureDay`, for a fresh day (not a carried-over one), after `F.planSkills(n)`: if `S.tutor.focus` is active (`dayNum() <= until`), add ONE extra core task of that skill that is not already in the day (`pickSeq(skill, taken)` → fallback `missionFor(...)`; for `grammar`: the next new unit if the day has no grammar task, else `{ t: 'grev' }` if `F.gramDue().length`). Mark it `fx: 1`. Expired focus → set to null.

## Flows
- Tutor lesson: `F.startFree('grammar', id)` already works once the lesson is in `F.DB.byId` (it records `S.gram[id]`, so the lesson joins the spaced grammar review and the weekly quiz). Verify it.
- Tutor reading: `F.startFree('reading', id)`. Verify it.
- NEW `flows.tquiz` (Runner + `Ex.run`, summary, `F.markDone('tquiz', id, { score })`, XP like the weekly quiz).
- NEW `flows.terr` "دفتر أخطائي": up to 10 due mistakes (`due <= dayNum()` and `box < 5`), each through `Ex.fix`; correct → `box++`, `due = dayNum() + [1,3,7,16,35][box-1]`; wrong → `box = 0`, `due = dayNum() + 1`; `n++`, `ok++`; +1 XP per correct; summary at the end. `box === 5` = mastered.
- The library counters in `ui.js` (`cnt`) and nothing else must ignore ids starting with `t:` so "القواعد 12 / 80" never exceeds the total.

## UI
1. Nav: 5 tabs: اليوم · المكتبة · **المعلّم (🎓, route `tutor`)** · الرحلة · أنا. Expose `F.routes = routes; F.after = after;` in `ui.js` so `tutor.js` can register `routes.tutor` (sub-routes `tutor/errs`, `tutor/packs` if you want pages instead of sheets). Check the tab bar still fits a 360 px wide screen in both themes.
2. Tutor page, top to bottom:
   - header "المعلّم الذكي", small: "يعمل باشتراكك العادي في تطبيق الذكاء. بلا مفاتيح ولا رسوم إضافية."
   - AI switcher: chips Claude · ChatGPT · Gemini · Grok · "تطبيق آخر"; one tap selects and saves `S.tutor.ai`; in the app, a chip whose app is not installed shows a tiny "عبر الموقع" label.
   - Mode switch under it (two segments): "اشتراكي العادي" (bridge) · "مفتاح API" (api), with a one-line explanation of the selected mode: bridge: "تُفتح رسالتك في {AI} وتكمل المحادثة هناك، ثم تلصق الحزمة هنا." · api: "المحادثة والصور والحزم كلها داخل فصيح، بمفتاحك أنت وعلى حسابك لدى الشركة." In API mode show a row "🔑 مفاتيحي" (→ `F.chat.keys()`), the state of the selected provider ("المفتاح محفوظ ✓" / "لا مفتاح لـ {AI} بعد"), and a button "💬 افتح المحادثة" (→ `F.chat.open()`). "تطبيق آخر" is not available in API mode (switch to Claude). Hide the mode switch entirely when `F.chat` does not exist.
   - If a request was sent in the last 24 h and no pack was imported after it: card "بعد أن يجيبك {AI}: انسخ «حزمة فصيح» من آخر ردّه ثم اضغط هنا" + button "📥 الصق حزمة فصيح".
   - "بانتظارك" (only if something is pending): rows for unfinished tutor lessons, readings, quizzes, and "دفتر أخطائي: N للمراجعة", each starting its flow.
   - "اطلب من معلّمك": tiles (icon, name, one-line description):
     ✍️ صحّح كتابتي — تقييم وتصحيح، وأخطاؤك تدخل دفترك · 🗣️ حاورني — محادثة صوتية أو كتابية ثم ملاحظات · 🧩 كلمات لموضوع — مصطلحات مجالك عند الطلب · 📘 درس مخصص — قاعدة تُشرح لك مع تمارين · 📖 نص للقراءة — نص بمستواك عن موضوع تختاره · 📷 اشرح صورة — صوّر نصاً أو سؤالاً واسأل عنه · 📊 راجع خطتي — يحلل نتائجك ويقترح تعديل الخطة · ❓ سؤال حر — أي سؤال، ومعه مستواك وسياقك
   - buttons: "📥 استيراد حزمة" · "📒 دفتر أخطائي (N)".
   - last advice (`note` of the newest pack), then "الحزم المستوردة" list (title, date, counts; tap → details sheet with "حذف الحزمة").
   - `<details>` "كيف يعمل المعلّم؟": «١. اختر طلباً: يجهّز فصيح رسالة فيها مستواك ونقاط ضعفك وطلبك. ٢. يُفتح تطبيق الذكاء الذي اخترته: أرسل الرسالة وتابع المحادثة هناك بالنص أو الصوت أو الصور. ٣. انسخ «حزمة فصيح» من آخر الرد والصقها هنا: تراجعها ثم تدخل كلماتها ودروسها وأخطاؤك في خطتك.» + «فصيح نفسه لا يتصل بالإنترنت. ما يخرج من هاتفك هو الرسالة التي ترسلها أنت عبر تطبيق الذكاء فقط، وتستطيع قراءتها قبل الإرسال.» + button "انسخ التعليمات الدائمة" (copies `F.tutor.standing()`; hint: "الصقها مرة واحدة في تعليمات مشروع Claude أو تعليمات ChatGPT المخصصة أو Gem، فيفهم أي محادثة لاحقة حزمة فصيح.").
3. Request sheet (one per tile): the inputs listed below; when `F.img.ok()`, a photo row "📷 التقط صورة" · "🖼️ من المعرض" that shows a removable thumbnail once a photo is attached (any request may carry one photo; the `photo` request asks for it first); a `<details>` "ما الذي سيُرسل؟" showing the exact prompt (`<pre>` with `esc`, `dir="ltr"`); and the button "أرسل إلى {AI} ›" (API mode: "ابدأ المحادثة ›").
   Sending = `F.tutor.send(reqId, input, imgId)`: build `{ system, user, text, title }` (see Prompts). API mode and `F.chat.ready(ai)` → `F.chat.start({ title, system, user, img: imgId || '' })`. Otherwise `F.nat('aiSend', ai, text, imgId || '')` and a toast by result — `send`: "فُتح {AI} ومعه طلبك. إن لم يظهر النص فالصقه، فهو منسوخ." · `sendimg`: "فُتح {AI} ومعه الصورة. الصق الطلب في خانة الرسالة، فهو منسوخ." · `copy`: "نُسخ طلبك. الصقه في خانة الرسالة في {AI}." (with a photo add: "وأرفق الصورة من هناك.") · `web`: "{AI} غير مثبّت: فتحتُ موقعه، والطلب منسوخ فالصقه هناك." · `chooser`: no toast · fail/undefined → the manual-copy sheet. Record `S.tutor.sent++`, `S.tutor.last = { req, ai, at }`.
4. Home page: when anything is pending (see "بانتظارك"), one card "🎓 من المعلّم: …" with a short summary and a button to the tutor page.
5. Word sheet (`F.wordSheet`): add a small ghost button "🎓 اسأل المعلّم عن هذه الكلمة" → request `word`.
6. Writing flow (`flows.js`, the `.share` button): text "📤 أرسل نصي إلى المعلّم ({AI}) للتصحيح", hint "يفتح {AI} ومعه نصك وطلب تصحيح جاهز. بعد الرد انسخ «حزمة فصيح» والصقها في تبويب المعلّم، فتدخل أخطاؤك وكلماتك الجديدة في مراجعتك." → sends request `fix` with the task prompt and his text (remove the old `claudePrompt` and the Claude-specific toast in `F.share`).
7. Incoming text (`shared` event, and once after `F.init` via `takeShared()`): if onboarding is not finished → ignore. If a session (`F.runner`) is open → keep it and show it when the tutor page is next rendered (toast "وصلت حزمة: تجدها في تبويب المعلّم بعد الجلسة"). Pack found → preview. No pack and the text is short (≤ 40 chars, ≤ 4 words, has Latin letters) → `F.addWordSheet(text)`. Otherwise sheet "نص من تطبيق آخر" with the first 300 chars and buttons "🎓 اطلب شرحه من المعلّم" (request `explain`) / "إغلاق".
8. "دفتر أخطائي" page or sheet: all mistakes (✗ sentence, ✓ corrected, why, progress dots for `box`), button "راجع الآن (N)".
Back button: sub-pages of the tutor go back to `tutor`. Empty states must look fine (new user with nothing imported).

## Prompts (English; build in `tutor.js`; cap the whole prompt at 24 000 chars; cap user inputs: essay 12 000, question 2 000, topic 300)
`F.tutor.build(reqId, input)` returns `{ title, system, user, text }`: `user` = the `MY REQUEST` body alone; `system` = everything else (tutor role, ABOUT ME, HOW TO ANSWER, FASIH PACK section for this request); `text` = the single message used in bridge mode, laid out as below; `title` = short Arabic label of the request. `F.tutor.prompt(reqId, input)` = `.text`. `F.tutor.system()` = the same system part with the pack section of `F.tutor.standing()` (all parts, "only when useful").
Layout of the bridge message:
```
[Fasih tutor request]
I am learning English with a spaced-repetition app called Fasih. Please act as my personal English tutor.

MY REQUEST: <request text, see below>

ABOUT ME (data from the app, <YYYY-MM-DD>):
- Arabic speaker (Algeria). Goal: CEFR C1 and IELTS Academic band 7+ within 18 months. My field: law, anti-corruption and transparency, and AI.
- Plan: study day <n> of 540 (phase <A2 → B1>), <dailyMin> minutes a day, <newPerDay> new words a day, streak <k> days, <on schedule | N days ahead | N days behind>.
- Current vocabulary level: <F.level()>. Words learned in the app: <total> (<mature> long-term, <leech> difficult). Recall accuracy: <ret>% (omit if null).
- Grammar units finished: <k> of 80. Weakest: <up to 5 titles with the lowest S.gram score>.   (omit the "Weakest" part if none)
- Words I keep forgetting: <up to 15 words with most lapses (laps >= 2)>.   (omit line if none)
- My recent mistakes: <up to 6 from the notebook as "wrong → right">.   (omit line if none)

HOW TO ANSWER:
- Explain in clear Modern Standard Arabic; examples and practice in English at my level or one step above it.
- Be honest and specific. Correct every real mistake. No flattery.
- British spelling. Write original material only (never copy real exam questions).

FASIH PACK (required at the END of your reply):
Finish with exactly ONE fenced code block (```json) containing one JSON object and nothing else. My app imports it, so it must be valid JSON: double quotes only, no comments, no trailing commas, no line breaks inside strings. Shape:
{"fasih":1,"title":"short Arabic title","note":"1-2 sentences of personal advice in Arabic", <parts>}
Parts to include:
<part descriptions for this request>
```
Part descriptions (use verbatim, substituting N):
- words: `"words": up to N items like {"w":"headword in lowercase base form","p":"n|v|adj|adv|phr","l":"A2|B1|B2|C1","ar":"Arabic meaning, 1-2 senses","d":"simple English definition, max 14 words","ex":"one natural example sentence of 6-16 words containing the word","x":"the word exactly as written inside ex","exar":"Arabic translation of ex","c":["up to 3 common collocations"]}`
- mistakes: `"mistakes": my real mistakes, most important first, up to N, like {"q":"my sentence (max 20 words) keeping exactly ONE error","bad":"the wrong word(s) exactly as written in q","good":["correct replacement for bad","another accepted replacement"],"why":"short reason in Arabic"}`
- lesson: `"lesson": {"l":"A2|B1|B2|C1","title":"English title","titleAr":"Arabic title","why":"when I need this, in Arabic","rules":[{"ar":"rule explained in Arabic","form":"pattern, e.g. S + have/has + past participle","ex":[{"en":"example","ar":"its translation"}]}],"mistakes":[{"x":"typical wrong sentence of an Arabic speaker","ok":"correct sentence","ar":"why, in Arabic"}],"tip":"memory trick in Arabic","exs":[10-12 exercise objects, easy to hard]}  (2-4 rules, 2-3 examples each)`
- reading: `"reading": {"l":"A2|B1|B2|C1","title":"…","paras":["paragraph 1","paragraph 2"],"gloss":[{"w":"hard word","ar":"meaning"}],"qs":[6-8 question objects],"sumAr":"two-sentence summary in Arabic"}`
- quiz: `"quiz": {"title":"…","exs":[10-15 exercise objects]}`
- plan: `"plan": only the settings you want to change, each with one of the allowed values: {"dailyMin":30|45|60|75|90|120,"newPerDay":3|5|7|8|10|12|14|16|20,"domain":10|20|30|40,"retention":0.85|0.9|0.93,"focus":"reading|listening|speaking|writing|grammar","focusDays":3-21,"why":"reason in Arabic"}  (domain = % of new words taken from my field; retention = review intensity, 0.93 means more reviews; focus = one extra daily task of that skill for focusDays days)`
- exercise objects (append whenever lesson or quiz is requested): the five example lines from `SPEC.md` (mc, gap, fix, order, trans) with their bracketed rules, introduced by `Exercise objects (key "k" = type; "why" = short explanation in Arabic):`
- question objects (append when reading is requested): `Question objects:` + the kinds `F.quizForm` supports, in the same style.

Requests (id → inputs → request text → parts):
- `fix` → textarea (prefilled when coming from the writing flow; on the tutor page also offer his 5 most recent saved texts from `S.texts` as quick picks) → `Correct my writing.` + (`TASK: …` when known) + `MY TEXT:` + text + `Please: 1) <w2/w1: estimate an IELTS band for each of the four criteria and overall | otherwise: estimate my CEFR level for this text>. 2) Show the corrected text. 3) List my mistakes with a short explanation in Arabic. 4) Rewrite my two weakest sentences at a higher level. 5) Tell me the three things to practise next.` → mistakes (10), words (8, "that would have improved this text"), note.
- `talk` → select mode (محادثة حرة / IELTS Part 1 / IELTS Part 2 / IELTS Part 3 / مقابلة عن مشروعي وبحثي) + optional topic → `Speaking practice (<mode>). Topic: <topic | choose one that fits my level and my field>. Rules: speak only English with me; ask ONE question at a time and wait for my answer; keep your turns short (1-3 sentences); do not correct me during the conversation, just note my mistakes silently. After about 10 exchanges, or when I say "finish", stop and give me feedback in Arabic: what I did well, my main mistakes with corrections, and better ways to say two of my sentences.` + (IELTS modes: `Follow the real format of that part and give an estimated band for fluency, vocabulary and grammar.`) + `Only then add the pack. I may use voice mode. Start now with your first question.` → mistakes (10), words (8, "that I needed but did not know"), note. Hint under the button: "للمحادثة الصوتية افتح الوضع الصوتي في {AI} بعد إرسال الرسالة. قل finish حين تريد الملاحظات."
- `words` → topic (required) + count select 10/15/20/30 → `Teach me N useful English words or fixed phrases about: <topic>. Choose items an educated speaker really uses for this topic, at my level and one step above, that I am unlikely to know yet. Point out false friends or confusions typical of Arabic speakers.` → words (N), note.
- `lesson` → topic (optional) → `Give me a mini-lesson on: <topic | the grammar point that would help me most now, judging from my mistakes and level>. Explain it simply in Arabic with English examples, then show the typical mistakes of Arabic speakers.` → lesson, note.
- `read` → topic (optional) → `Write an original reading text for me about: <topic | a topic from my field>. Length: <A2 150-200 | B1 250-300 | B2 350-420 | C1 450-550> words in 3-6 paragraphs, IELTS Academic style adapted to level <level>. In your visible reply write only one introductory line: the text itself goes inside the pack.` → reading, words (8, "key words from the text"), note.
- `photo` → no input; hint "أرفق الصورة في {AI} قبل أن ترسل الرسالة." → `I am attaching a photo (an English text, a question, or something I saw). Explain it to me in Arabic at my level: the meaning, the difficult words and any grammar worth noticing. If it is an exercise, guide me to the answer step by step instead of only giving it.` → words (10, "from the photo"), note.
- `plan` → no input → `Review my study plan and results like a personal coach. Tell me in Arabic what is going well, what worries you, and at most THREE concrete changes. Be realistic about my time.` and ADD to ABOUT ME: minutes / new words / reviews for each of the last 14 days (from `S.hist`), counts of finished items per skill (`S.done`), cards due now, weekly quiz scores (`S.tests`, last 6), mock results (`S.mocks`, last 3), current settings (`dailyMin`, `newPerDay`, `domain`, `retention`), active focus → plan, note.
- `ask` → textarea (required) → the text as typed → words (8), mistakes (5), note, preceded by "(only the parts that are useful)".
- `word` (from the word sheet) → `Help me really master the word "<w>" (<ar>). Give me its main meanings with 4 short examples at my level, the most common collocations, how it differs from similar words, a memory trick in Arabic, and then ask me 3 quick questions to check that I can use it (wait for my answers).` → words (5, "related words or collocations; do not repeat the word itself"), note.
- `explain` (shared text) → `Explain this English text to me in Arabic at my level: overall meaning, difficult words and useful expressions.` + `TEXT:` + first 3 000 chars → words (10, "from the text"), note.
`F.tutor.standing()` = the "act as my tutor" line + ABOUT ME goal line + HOW TO ANSWER + the pack section listing ALL parts + exercise/question objects, introduced by "Whenever I ask for a Fasih pack, or when you have material I should study, end your reply with:".
Expose: `F.tutor.build`, `F.tutor.prompt`, `F.tutor.system`, `F.tutor.standing`, `F.tutor.send`, `F.tutor.parse`, `F.tutor.offer`, `F.tutor.normalise`, `F.tutor.preview(pack, onDone)`, `F.tutor.apply(norm)`, `F.tutor.remove(packId)`, `F.tutor.pending()`.

## Tests (`tools/test_tutor.py`, same harness style as `tools/test_web.py`: read it and `tools/auto.js` first)
Must cover and print one PASS/FAIL line each, exit code 1 on any failure:
1. every request id builds a prompt containing `[Fasih tutor request]`, `"fasih":1` and the level; length < 24 000 even with a 12 000-char essay.
2. parse: plain JSON; fenced inside a long reply with another `{...}` before it; curly quotes; trailing comma; garbage → `none`; broken → `json`.
3. import a full pack (words incl. one existing-without-card word, one already-known word and one new; mistakes; lesson; reading; quiz; plan): preview shows, apply works; the new word and the priority word are the first two words taught in the next learning session; lesson, reading and quiz flows run to the end with the auto-player; the mistakes flow runs; plan settings changed; after `F.tutor.remove` everything is back (settings, counts, DB ids, cards).
4. security: a pack whose strings contain `<img src=x onerror=window.__pwn=1>` and `<script>`, plus an exercise with a `pre` key: after import and after opening every screen/flow that shows them, `window.__pwn` is undefined and no `img`/`script` element was created from pack text.
5. limits: 100 words → 40 kept; lesson with 2 valid exercises → dropped; a 400 000-char input does not hang (< 2 s).
6. state survives reload (`F.flush()` + page reload): tutor words, lesson and mistakes still there.
7. modes: with a stub `F.chat = { ready: () => true, start: o => (window.__started = o), open() {}, keys() {} }` and `S.tutor.mode = 'api'`, sending a request calls `F.chat.start` with non-empty `system` and `user` and never calls `aiSend`; with `F.chat` deleted the tutor page renders without the mode switch and sending works in bridge mode; a stub `FasihNative`-less browser run copies the prompt (stub `navigator.clipboard`).
8. regression: `python3 tools/test_web.py` and `python3 tools/sim.py` still pass (run them, report the result lines).
Take 6 screenshots at 390×844 into `/tmp/tutor-shots/` (tutor page empty, tutor page with pending items, a request sheet with the prompt details open, the pack preview, the mistakes notebook, the home page with the tutor card) and LOOK at them (Read tool) to fix layout problems in RTL, light and dark.

## Final reply (max 15 lines)
Files changed with line counts, the test result lines, anything you could not finish or are unsure about. No code in the reply.

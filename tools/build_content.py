#!/usr/bin/env python3
"""Build www/content/*.js from content/raw/*.json (dedupe vocabulary, order the tracks, add missions)."""
import glob, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'content', 'raw')
OUT = os.path.join(ROOT, 'www', 'content')
LV = {'A2': 0, 'B1': 1, 'B2': 2, 'C1': 3}
norm = lambda s: re.sub(r'\s+', ' ', re.sub(r"[^a-z0-9' -]", ' ', s.lower().replace('’', "'"))).strip()


def load(prefix):
    out = []
    for f in sorted(glob.glob(os.path.join(RAW, prefix + '*.json'))):
        for o in json.load(open(f, encoding='utf-8')):
            o['_f'] = os.path.basename(f)
            out.append(o)
    return out


def clean(o):
    for k, v in list(o.items()):
        if isinstance(v, str):
            o[k] = v.strip()
    return o


# ---------- vocabulary ----------
voc = [clean(o) for o in load('vocab_')]
for o in voc:
    f = o['_f']
    o['tr'] = 'd' if f.startswith('vocab_dom_') else 'c' if f.startswith('vocab_chunks_') else 'g'
    o['w'] = o['w'].strip()
    if not o.get('x') or o['x'].lower() not in o['ex'].lower():
        o['x'] = o['w']
    if o['l'] in ('B2', 'C1'):
        o.pop('exar', None)
# priority: domain copy (tailored example), then chunk, then the lowest general level
prio = lambda o: (0 if o['tr'] == 'd' else 1 if o['tr'] == 'c' else 2, LV[o['l']])
best = {}
for o in voc:
    k = (o['w'].lower(), o['p'])
    if k not in best or prio(o) < prio(best[k]):
        best[k] = o
# the same word tagged with two parts of speech by different writers but the same Arabic meaning: keep one
seen_wa = {}
uniq = []
for o in sorted(best.values(), key=prio):
    k2 = (o['w'].lower(), norm(o['ar']) or o['ar'])
    if k2 in seen_wa:
        continue
    seen_wa[k2] = 1
    uniq.append(o)
dropped = len(voc) - len(uniq)


def h(s):
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


gen = [o for o in uniq if o['tr'] == 'g']
gen.sort(key=lambda o: (LV[o['l']], h(o['w'])))
for i, o in enumerate(gen):
    o['o'] = i
dom = [o for o in uniq if o['tr'] == 'd']
tier = lambda o: int(re.search(r'_(\d+)\.json$', o['_f']).group(1))
pack = lambda o: re.match(r'vocab_dom_([a-z]+)_', o['_f']).group(1)
order = {id(o): i for i, o in enumerate(voc)}
out_dom = []
for t in sorted({tier(o) for o in dom}):
    packs = {}
    for o in sorted([o for o in dom if tier(o) == t], key=lambda o: order[id(o)]):
        packs.setdefault(pack(o), []).append(o)
    keys = ['law', 'ac', 'ai', 'res']
    keys = [k for k in keys if k in packs] + [k for k in packs if k not in keys]
    while any(packs[k] for k in keys):
        for k in keys:
            if packs[k]:
                out_dom.append(packs[k].pop(0))
for i, o in enumerate(out_dom):
    o['o'] = i
chk = sorted([o for o in uniq if o['tr'] == 'c'], key=lambda o: order[id(o)])
for i, o in enumerate(chk):
    o['o'] = i
vocab = gen + out_dom + chk
for o in vocab:
    o.pop('_f', None)
    for k in ('c', 'f'):
        if k in o and not o[k]:
            del o[k]


# ---------- everything else ----------
def kind(prefix, key='id'):
    items = [clean(o) for o in load(prefix)]
    seen, out = set(), []
    for o in items:
        o.pop('_f', None)
        if key and o.get(key) in seen:
            continue
        seen.add(o.get(key))
        out.append(o)
    return out


grammar = kind('grammar_')
reading = kind('reading_')
listening = kind('listening_')
shadow, pron, sp1, sp2, sp3 = kind('shadow_'), kind('pron_'), kind('sp1_'), kind('sp2_'), kind('sp3_')
wsent, wlesson, w2, w1 = kind('wsent_'), kind('wlesson_'), kind('w2_'), kind('w1_')
guide, phrases = kind('guide_'), kind('phrases_')
motiv = kind('motiv_', key=None)
DROP_TIPS = ['اختر ثلاث كلمات جديدة فقط', 'استعمل تطبيقاً للبطاقات', 'توقف عند كل كلمة تصعب عليك', 'اكتب بطاقة تعليمية تحمل',
             # reminders that promise something specific the app may not be showing at that moment
             'كتاب المفردات', 'خمس كلمات جديدة', 'بعد الظهر', 'يومك بدأ', 'التدريب على المحادثة', 'أقل من عشر دقائق تفصلك', 'جلسة الاستماع الآن',
             'تدريب الكتابة ينتظرك', 'ضع الهاتف جانباً لدقائق', 'عن الزمن الماضي', 'فاستمع الآن', 'تبدأ يومك بكلمة', 'رغم ضيق الوقت', 'الاستماع والقراءة والمفردات اكتملت']
motiv = [m for m in motiv if not any(d in m['ar'] for d in DROP_TIPS)]
for m in motiv:
    m['ar'] = re.sub(r'([A-Za-z])و([A-Za-z])', r'\1 و \2', m['ar']).replace('وwatch', 'و watch')

BC = 'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests/academic'
mission = [
    dict(id='m-listen-1', kind='listen', min='A2', max='B1', titleAr='استماع قصير من مستواك', site='British Council LearnEnglish', url='https://learnenglish.britishcouncil.org',
         bodyAr='افتح قسم Listening في موقع LearnEnglish واختر تسجيلاً من مستواك (A2 أو B1). استمع مرتين: الأولى للفكرة العامة دون توقف، والثانية مع حل تمرين الموقع.',
         steps=['استمعت مرتين', 'حللت تمرين الموقع', 'أضفت 3 كلمات جديدة إلى «كلماتي»']),
    dict(id='m-listen-2', kind='listen', min='A2', max='B2', titleAr='خبر بالإنجليزية الهادئة', site='VOA Learning English', url='https://learningenglish.voanews.com',
         bodyAr='اختر خبراً أو تقريراً قصيراً من VOA Learning English: المذيعون يتكلمون ببطء وبكلمات شائعة. استمع أولاً دون قراءة، ثم مع النص.',
         steps=['استمعت دون نص', 'استمعت مع النص', 'كتبت جملتين تلخصان الخبر بالإنجليزية']),
    dict(id='m-listen-3', kind='listen', min='B1', max='C1', titleAr='ست دقائق من الإنجليزية الحقيقية', site='BBC Learning English', url='https://www.bbc.co.uk/learningenglish',
         bodyAr='ابحث في BBC Learning English عن برنامج «6 Minute English» واختر حلقة يعجبك موضوعها. دوّن التعابير الجديدة التي يشرحها المقدّمان.',
         steps=['استمعت للحلقة كاملة', 'دوّنت 4 تعابير جديدة', 'أضفتها إلى «كلماتي»']),
    dict(id='m-listen-4', kind='listen', min='B2', max='C1', titleAr='محاضرة قصيرة في تخصصك',
         bodyAr='ابحث عن محاضرة أو مقابلة من 10 إلى 15 دقيقة بالإنجليزية حول القانون أو مكافحة الفساد أو الذكاء الاصطناعي. شغّل الترجمة الإنجليزية (لا العربية)، وأوقف الفيديو لتدوين المصطلحات.',
         steps=['شاهدت المحاضرة بترجمة إنجليزية', 'دوّنت 5 مصطلحات من تخصصي', 'لخّصت الفكرة الرئيسية في 3 جمل']),
    dict(id='m-read-1', kind='read', min='A2', max='B1', titleAr='نص قراءة من مستواك', site='British Council LearnEnglish', url='https://learnenglish.britishcouncil.org',
         bodyAr='افتح قسم Reading في LearnEnglish واختر نصاً من مستواك. اقرأه مرة كاملة دون قاموس، ثم حل التمرين، ثم ابحث عن الكلمات التي عطّلت فهمك فقط.',
         steps=['قرأت النص دون قاموس', 'حللت التمرين', 'أضفت 3 كلمات إلى «كلماتي»']),
    dict(id='m-read-2', kind='read', min='B1', max='C1', titleAr='ربع ساعة قراءة في تخصصك',
         bodyAr='اقرأ 15 دقيقة مقالاً بالإنجليزية عن موضوع قريب من مشروعك (الذكاء الاصطناعي في المحاماة، الشفافية، مكافحة الفساد). لا تتوقف عند كل كلمة: يكفي أن تفهم الفكرة. القراءة الكثيرة السهلة تبني المفردات أكثر من القراءة القليلة الصعبة.',
         steps=['قرأت 15 دقيقة متواصلة', 'لخّصت المقال في 3 جمل بكلماتي', 'أضفت 4 كلمات تكررت في المقال']),
    dict(id='m-read-3', kind='read', min='B2', max='C1', titleAr='ملخص بحث علمي',
         bodyAr='ابحث عن ورقة علمية بالإنجليزية في موضوع أطروحتك واقرأ الملخص (abstract) والمقدمة فقط. لاحظ الأفعال التي يستعملها الباحثون: examine, argue, suggest, demonstrate.',
         steps=['قرأت الملخص والمقدمة', 'نسخت 3 جمل أكاديمية أعجبتني', 'كتبت جملة واحدة عن بحثي على منوالها']),
    dict(id='m-speak-1', kind='speak', min='A2', max='C1', titleAr='دقيقتان من الكلام الحر',
         bodyAr='سجّل نفسك بهاتفك تتحدث دقيقتين بالإنجليزية عن يومك أو عن شيء تعلمته. لا تتوقف لتصحيح نفسك. ثم استمع للتسجيل ودوّن خطأين فقط تريد تصحيحهما في المرة القادمة.',
         steps=['سجّلت دقيقتين دون توقف', 'استمعت للتسجيل', 'دوّنت خطأين وأعدت الجملتين صحيحتين']),
    dict(id='m-speak-2', kind='speak', min='B1', max='C1', titleAr='اشرح مشروعك في دقيقة',
         bodyAr='تخيّل أنك أمام مستثمر أو مشرف دكتوراه: اشرح بالإنجليزية في 60 ثانية ما مشروعك، ولمن هو، ولماذا هو مهم. سجّل ثلاث محاولات: الثالثة ستكون أفضل بوضوح.',
         steps=['المحاولة الأولى', 'المحاولة الثانية', 'المحاولة الثالثة: الأسلس']),
    dict(id='m-write-1', kind='write', min='A2', max='B1', titleAr='يوميات بخمس جمل',
         bodyAr='اكتب خمس جمل بالإنجليزية عن يومك مستعملاً ثلاثاً من كلمات اليوم الجديدة. استعمال الكلمة في جملة من حياتك يثبّتها أكثر من قراءتها عشر مرات.',
         steps=['كتبت خمس جمل', 'استعملت 3 كلمات جديدة', 'راجعت الأزمنة وأدوات التعريف']),
    dict(id='m-write-2', kind='write', min='B1', max='C1', titleAr='فقرة عن مشروعك',
         bodyAr='اكتب فقرة من 100 إلى 150 كلمة تشرح جانباً واحداً من مشروعك أو مذكرتك. ابدأ بجملة رئيسية، ثم سببين ومثالاً. يمكنك لصقها في محادثة مع Claude وطلب تصحيحها.',
         steps=['كتبت الفقرة', 'راجعتها مرة بنفسي', 'صحّحتها مع Claude أو مع معلم']),
    dict(id='m-mock-1', kind='mock', min='B2', max='C1', titleAr='اختبار استماع تجريبي رسمي', site='British Council', url=BC + '/listening',
         bodyAr='أجرِ اختبار استماع IELTS كاملاً من الموقع الرسمي في ظروف الاختبار: 30 دقيقة، مرة واحدة، دون توقف. ثم سجّل نتيجتك في «ركن IELTS».',
         steps=['أجريت الاختبار في ظروف حقيقية', 'راجعت كل خطأ وعرفت سببه', 'سجّلت النتيجة في ركن IELTS']),
    dict(id='m-mock-2', kind='mock', min='B2', max='C1', titleAr='اختبار قراءة تجريبي رسمي', site='British Council', url=BC + '/reading',
         bodyAr='أجرِ اختبار قراءة IELTS Academic كاملاً: 60 دقيقة لثلاثة نصوص و40 سؤالاً. التزم بعشرين دقيقة لكل نص.',
         steps=['أجريت الاختبار في 60 دقيقة', 'راجعت كل خطأ وعرفت سببه', 'سجّلت النتيجة في ركن IELTS']),
    dict(id='m-mock-3', kind='mock', min='B2', max='C1', titleAr='اختبار كتابة تجريبي رسمي', site='British Council', url=BC + '/writing',
         bodyAr='اكتب المهمتين في 60 دقيقة: 20 للمهمة الأولى و40 للثانية. ثم أرسل نصيك إلى Claude للتقييم حسب المعايير الأربعة.',
         steps=['كتبت المهمتين في 60 دقيقة', 'حصلت على تقييم', 'سجّلت النتيجة في ركن IELTS']),
    dict(id='m-mock-4', kind='mock', min='B2', max='C1', titleAr='اختبار محادثة تجريبي', site='British Council', url=BC + '/speaking',
         bodyAr='اتبع أسئلة اختبار المحادثة التجريبي الرسمي وسجّل إجاباتك كاملة (11 إلى 14 دقيقة). استمع للتسجيل وقيّم نفسك في الطلاقة والمفردات والقواعد والنطق.',
         steps=['سجّلت الأجزاء الثلاثة', 'استمعت وقيّمت نفسي', 'سجّلت النتيجة في ركن IELTS']),
]

# ---------- checks ----------
warn = []
ids = {}
for name, arr in [('grammar', grammar), ('reading', reading), ('listening', listening), ('shadow', shadow), ('pron', pron), ('sp1', sp1), ('sp2', sp2), ('sp3', sp3), ('wsent', wsent), ('wlesson', wlesson), ('w2', w2), ('w1', w1), ('guide', guide), ('phrases', phrases), ('mission', mission)]:
    for o in arr:
        if o['id'] in ids:
            warn.append(f'duplicate id {o["id"]} in {name} and {ids[o["id"]]}')
        ids[o['id']] = name
for o in listening:
    text = norm(' '.join(l['t'] for l in o['lines']))
    for i, q in enumerate(o['qs']):
        if q['k'] == 'gap' and not any(norm(a) in text for a in q['a']):
            warn.append(f'listening {o["id"]} q{i}: gap answer {q["a"]} not heard literally')

os.makedirs(OUT, exist_ok=True)


def write(fn, parts):
    with open(os.path.join(OUT, fn), 'w', encoding='utf-8') as f:
        for k, arr in parts:
            f.write('Fasih.add(' + json.dumps(k) + ',' + json.dumps(arr, ensure_ascii=False, separators=(',', ':')) + ');\n')
    return os.path.getsize(os.path.join(OUT, fn))


sizes = {
    'vocab.js': write('vocab.js', [('vocab', vocab)]),
    'grammar.js': write('grammar.js', [('grammar', grammar)]),
    'skills.js': write('skills.js', [('reading', reading), ('listening', listening), ('shadow', shadow), ('pron', pron), ('sp1', sp1), ('sp2', sp2), ('sp3', sp3), ('wsent', wsent), ('wlesson', wlesson), ('w2', w2), ('w1', w1)]),
    'extra.js': write('extra.js', [('guide', guide), ('phrases', phrases), ('motiv', motiv), ('mission', mission)]),
}
lv = lambda arr: {l: sum(1 for o in arr if o.get('l') == l) for l in LV}
print('vocab total', len(vocab), '(raw', len(voc), 'dropped', dropped, ')')
print('  general', len(gen), lv(gen)); print('  domain', len(out_dom), lv(out_dom)); print('  chunks', len(chk), lv(chk))
for name, arr in [('grammar', grammar), ('reading', reading), ('listening', listening), ('shadow', shadow), ('pron', pron), ('sp1', sp1), ('sp2', sp2), ('sp3', sp3), ('wsent', wsent), ('wlesson', wlesson), ('w2', w2), ('w1', w1), ('guide', guide), ('phrases', phrases), ('motiv', motiv), ('mission', mission)]:
    print(f'{name:10s} {len(arr):4d}', lv(arr) if arr and 'l' in arr[0] else '')
print('sizes', {k: f'{v/1024:.0f} KB' for k, v in sizes.items()})
print(len(warn), 'warnings'); print('\n'.join(warn[:40]))

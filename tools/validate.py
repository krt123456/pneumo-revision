#!/usr/bin/env python3
"""Validate a Fasih content file.  usage: validate.py <kind> <file.json>"""
import json, re, sys

LEVELS = {"A2", "B1", "B2", "C1"}
POS = {"n", "v", "adj", "adv", "prep", "conj", "pron", "det", "phr", "num", "excl"}
TOPICS = set("daily people home food health body travel transport city nature environment weather animals work business money education science technology media arts sport society government law crime feelings mind communication time quantity movement description academic anticorruption ai research startup misc".split())
AR = re.compile(r"[؀-ۿ]")
LAT = re.compile(r"[A-Za-z]")
errs = []


def E(i, msg):
    errs.append(f"item {i}: {msg}")


def is_ar(s):
    return isinstance(s, str) and len(AR.findall(s)) >= 2


def is_en(s, n=1):
    return isinstance(s, str) and len(LAT.findall(s)) >= n


def words(s):
    return len(re.findall(r"[A-Za-z0-9'’\-]+", s))


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]", " ", s.lower().replace("’", "'"))).strip()


def chk_ex(e, i, allow):
    if not isinstance(e, dict):
        return E(i, "exercise is not an object")
    k = e.get("k")
    if k not in allow:
        return E(i, f"exercise type {k!r} not allowed here (allowed: {sorted(allow)})")
    need_why = k in ("mc", "gap", "fix", "trans", "tfng")
    if need_why and not is_ar(e.get("why", "")):
        E(i, f"{k}: missing Arabic 'why'")
    if k == "mc":
        o = e.get("o")
        if not is_en(e.get("q", "")) and not is_ar(e.get("q", "")):
            E(i, "mc: bad q")
        if not (isinstance(o, list) and 3 <= len(o) <= 4 and all(isinstance(x, str) and x.strip() for x in o)):
            return E(i, "mc: o must be 3-4 non-empty strings")
        if len(set(norm(x) for x in o)) != len(o):
            E(i, "mc: duplicate options")
        if not (isinstance(e.get("a"), int) and 0 <= e["a"] < len(o)):
            E(i, "mc: a must be a valid option index")
    elif k == "gap":
        if "___" not in str(e.get("q", "")):
            E(i, "gap: q must contain ___")
        a = e.get("a")
        if not (isinstance(a, list) and a and all(isinstance(x, str) and x.strip() for x in a)):
            E(i, "gap: a must be a non-empty list of strings")
        elif any(words(x) > 4 for x in a):
            E(i, "gap: answer longer than 4 words")
    elif k == "fix":
        q, bad, good = e.get("q", ""), e.get("bad", ""), e.get("good")
        if not (isinstance(bad, str) and bad and bad in q):
            E(i, "fix: 'bad' must be an exact substring of q")
        if not (isinstance(good, list) and good and all(isinstance(x, str) for x in good)):
            E(i, "fix: 'good' must be a non-empty list")
        elif bad in good:
            E(i, "fix: good contains the wrong form")
    elif k == "order":
        a = e.get("a", "")
        if not is_en(a) or not (4 <= words(a) <= 14):
            E(i, "order: a must be a 4-14 word sentence")
    elif k == "trans":
        st, a = e.get("start", ""), e.get("a")
        if not is_en(e.get("q", "")) or not is_en(st):
            E(i, "trans: need q and start")
        if not (isinstance(a, list) and a and all(isinstance(x, str) and norm(x).startswith(norm(st)) for x in a)):
            E(i, "trans: every answer must begin with 'start'")
    elif k == "tfng":
        if e.get("a") not in ("T", "F", "NG") or not is_en(e.get("q", "")):
            E(i, "tfng: a must be T/F/NG and q English")
    elif k == "head":
        o = e.get("o")
        if not (isinstance(o, list) and 3 <= len(o) <= 5 and isinstance(e.get("a"), int) and 0 <= e["a"] < len(o) and isinstance(e.get("para"), int)):
            E(i, "head: need para (int), o (3-5), a (index)")


def lvl(o, i):
    if o.get("l") not in LEVELS:
        E(i, f"bad level {o.get('l')!r}")
    return o.get("l")


def need_id(o, i, seen, prefix=None):
    d = o.get("id")
    if not isinstance(d, str) or not d:
        return E(i, "missing id")
    if d in seen:
        E(i, f"duplicate id {d}")
    seen.add(d)
    if prefix and not d.startswith(prefix):
        E(i, f"id should start with {prefix}")


def v_vocab(items):
    seen = set()
    for i, o in enumerate(items):
        w = o.get("w")
        if not isinstance(w, str) or not w.strip() or not is_en(w):
            E(i, "bad w"); continue
        tag = f"{i} ({w})"
        if o.get("p") not in POS: E(tag, f"bad p {o.get('p')!r}")
        l = lvl(o, tag)
        if o.get("t") not in TOPICS: E(tag, f"bad topic {o.get('t')!r}")
        if not is_ar(o.get("ar", "")): E(tag, "missing Arabic meaning")
        ex = o.get("ex", "")
        if not is_en(ex, 8) or not (4 <= words(ex) <= 20): E(tag, "ex must be a 5-18 word sentence")
        x = o.get("x") or w
        if x.lower() not in ex.lower(): E(tag, f"x {x!r} is not inside ex")
        if l in ("B2", "C1") and not is_en(o.get("d", ""), 6): E(tag, "d (definition) required for B2/C1")
        if l in ("A2", "B1") and not is_ar(o.get("exar", "")): E(tag, "exar required for A2/B1")
        for key in ("c", "f"):
            if key in o and not (isinstance(o[key], list) and all(isinstance(s, str) for s in o[key])): E(tag, f"{key} must be a list of strings")
        key = (w.lower(), o.get("p"))
        if key in seen: E(tag, "duplicate word")
        seen.add(key)


def v_grammar(items):
    seen = set()
    for i, o in enumerate(items):
        need_id(o, i, seen, "g-"); l = lvl(o, i)
        if not is_en(o.get("title", "")) or not is_ar(o.get("titleAr", "")) or not is_ar(o.get("why", "")): E(i, "need title, titleAr, why")
        r = o.get("rules")
        if not (isinstance(r, list) and 2 <= len(r) <= 6): E(i, "rules: 2-5 blocks")
        else:
            for b in r:
                if not is_ar(b.get("ar", "")) or not (isinstance(b.get("ex"), list) and b["ex"] and all(is_en(e.get("en", "")) and is_ar(e.get("ar", "")) for e in b["ex"])): E(i, "rule block needs ar + ex[{en,ar}]")
        m = o.get("mistakes")
        if not (isinstance(m, list) and len(m) >= 2 and all(is_en(e.get("x", "")) and is_en(e.get("ok", "")) and is_ar(e.get("ar", "")) for e in m)): E(i, "mistakes: >=2 of {x, ok, ar}")
        exs = o.get("exs")
        if not (isinstance(exs, list) and len(exs) >= 12): E(i, "exs: need at least 12 exercises"); continue
        for j, e in enumerate(exs): chk_ex(e, f"{i}.ex{j}", {"mc", "gap", "fix", "order", "trans"})
        kinds = [e.get("k") for e in exs if isinstance(e, dict)]
        if kinds.count("mc") < 4 or kinds.count("gap") < 3 or kinds.count("fix") < 2 or kinds.count("order") < 2: E(i, "exs mix: need >=4 mc, >=3 gap, >=2 fix, >=2 order")
        if l in ("B2", "C1") and kinds.count("trans") < 2: E(i, "B2/C1 need >=2 trans")


RLEN = {"A2": (140, 250), "B1": (260, 420), "B2": (430, 660), "C1": (620, 880)}
LLEN = {"A2": (110, 210), "B1": (185, 340), "B2": (300, 500), "C1": (430, 680)}


def v_reading(items):
    seen = set()
    for i, o in enumerate(items):
        need_id(o, i, seen, "r-"); l = lvl(o, i)
        p = o.get("paras")
        if not (isinstance(p, list) and len(p) >= 3 and all(is_en(s, 20) for s in p)): E(i, "paras: >=3 paragraphs"); continue
        n = sum(words(s) for s in p)
        lo, hi = RLEN.get(l, (0, 9999))
        if not lo <= n <= hi: E(i, f"length {n} words, expected {lo}-{hi} for {l}")
        if not is_en(o.get("title", "")) or not is_ar(o.get("sumAr", "")): E(i, "need title and sumAr")
        g = o.get("gloss")
        if not (isinstance(g, list) and len(g) >= 4 and all(is_en(e.get("w", "")) and is_ar(e.get("ar", "")) for e in g)): E(i, "gloss: >=4 {w, ar}")
        qs = o.get("qs")
        need = 10 if l in ("B2", "C1") else 8
        if not (isinstance(qs, list) and len(qs) >= need): E(i, f"qs: need {need}"); continue
        text = norm(" ".join(p))
        for j, e in enumerate(qs):
            chk_ex(e, f"{i}.q{j}", {"mc", "gap", "tfng", "head"})
            if isinstance(e, dict) and e.get("k") == "gap" and isinstance(e.get("a"), list) and not any(norm(a) in text for a in e["a"] if isinstance(a, str)): E(f"{i}.q{j}", "gap answer not found in the text")
            if isinstance(e, dict) and e.get("k") == "head" and isinstance(e.get("para"), int) and not 0 <= e["para"] < len(p): E(f"{i}.q{j}", "head: para out of range")
        kinds = [e.get("k") for e in qs if isinstance(e, dict)]
        if l in ("B2", "C1") and (kinds.count("tfng") < 3 or kinds.count("head") < 1 or kinds.count("gap") < 2 or kinds.count("mc") < 2): E(i, "B2/C1 mix: >=3 tfng, >=1 head, >=2 gap, >=2 mc")


def v_listening(items):
    seen = set()
    for i, o in enumerate(items):
        need_id(o, i, seen, "l-"); l = lvl(o, i)
        ln = o.get("lines")
        if not (isinstance(ln, list) and ln and all(e.get("s") in ("A", "B", "C") and is_en(e.get("t", "")) for e in ln)): E(i, "lines: [{s: A|B|C, t}]"); continue
        if any(words(e["t"]) > 34 for e in ln): E(i, "a line is longer than 30 words")
        n = sum(words(e["t"]) for e in ln)
        lo, hi = LLEN.get(l, (0, 9999))
        if not lo <= n <= hi: E(i, f"length {n} words, expected {lo}-{hi} for {l}")
        if o.get("part") not in (1, 2, 3, 4) or o.get("accent") not in ("GB", "US", "AU"): E(i, "part 1-4 and accent GB/US/AU")
        if not is_en(o.get("title", "")): E(i, "need title")
        qs = o.get("qs")
        if not (isinstance(qs, list) and len(qs) >= 6): E(i, "qs: need >=6"); continue
        for j, e in enumerate(qs):
            chk_ex(e, f"{i}.q{j}", {"mc", "gap", "tfng"})
            if isinstance(e, dict) and e.get("k") == "tfng" and e.get("a") == "NG": E(f"{i}.q{j}", "listening tfng: only T or F")


def v_simple(prefix, fn):
    def run(items):
        seen = set()
        for i, o in enumerate(items):
            need_id(o, i, seen, prefix)
            fn(o, i)
    return run


def c_shadow(o, i):
    lvl(o, i)
    ln = o.get("lines")
    if not (isinstance(ln, list) and len(ln) >= 7 and all(is_en(e.get("en", "")) and is_ar(e.get("ar", "")) for e in ln)): E(i, "lines: >=7 {en, ar}")
    if not is_en(o.get("title", "")): E(i, "need title")


def c_sp1(o, i):
    lvl(o, i)
    q = o.get("qs")
    if not (isinstance(q, list) and len(q) >= 4 and all(is_en(e.get("q", "")) and is_en(e.get("a", ""), 20) for e in q)): E(i, "qs: >=4 {q, a}")


def c_sp2(o, i):
    lvl(o, i)
    if not is_en(o.get("card", "")) or not (isinstance(o.get("pts"), list) and len(o["pts"]) >= 3): E(i, "need card and pts")
    n = words(o.get("model", ""))
    if not 150 <= n <= 260: E(i, f"model {n} words, expected 170-230")
    if not (isinstance(o.get("phr"), list) and len(o["phr"]) >= 4): E(i, "phr: >=4")


def c_sp3(o, i):
    lvl(o, i)
    q = o.get("qs")
    if not (isinstance(q, list) and len(q) >= 4 and all(is_en(e.get("q", "")) and 35 <= words(e.get("a", "")) <= 95 for e in q)): E(i, "qs: >=4 {q, a 45-75 words}")


def c_pron(o, i):
    if not is_ar(o.get("ar", "")) or not is_en(o.get("title", "") + "x"): E(i, "need title and ar")
    p = o.get("pairs")
    if not (isinstance(p, list) and len(p) >= 6 and all(isinstance(e, list) and len(e) == 2 and is_en(e[0]) for e in p)): E(i, "pairs: >=6 [a, b]")
    if not (isinstance(o.get("sent"), list) and len(o["sent"]) >= 3): E(i, "sent: >=3")


def c_wsent(o, i):
    lvl(o, i)
    if not is_en(o.get("task", "")) or not is_ar(o.get("taskAr", "")) or not is_en(o.get("model", ""), 20): E(i, "need task, taskAr, model")
    if not (isinstance(o.get("check"), list) and len(o["check"]) >= 2): E(i, "check: >=2")


def c_w2(o, i):
    lvl(o, i)
    if o.get("type") not in ("opinion", "discuss", "problem", "advdis", "twopart"): E(i, "bad type")
    if not is_en(o.get("prompt", ""), 60) or not is_ar(o.get("planAr", "")): E(i, "need prompt and planAr")
    if not (isinstance(o.get("ideas"), list) and len(o["ideas"]) >= 4) or not (isinstance(o.get("vocab"), list) and len(o["vocab"]) >= 5): E(i, "ideas >=4, vocab >=5")
    if "model" in o:
        n = words(o["model"])
        if not 250 <= n <= 330: E(i, f"model {n} words, expected 260-300")


def c_w1(o, i):
    lvl(o, i)
    if o.get("chart") not in ("line", "bar", "pie", "table"): E(i, "bad chart")
    x, s = o.get("x"), o.get("series")
    if not (isinstance(x, list) and len(x) >= 2 and isinstance(s, list) and s): return E(i, "need x and series")
    for e in s:
        if not (isinstance(e.get("data"), list) and len(e["data"]) == len(x) and all(isinstance(v, (int, float)) for v in e["data"]) and isinstance(e.get("name"), str)): E(i, "each series: name + data with the same length as x")
    n = words(o.get("model", ""))
    if not 150 <= n <= 215: E(i, f"model {n} words, expected 160-190")
    if not is_en(o.get("prompt", ""), 40) or not is_ar(o.get("keyAr", "")): E(i, "need prompt and keyAr")


def c_wlesson(o, i):
    lvl(o, i)
    if not is_en(o.get("title", "")) or not is_ar(o.get("titleAr", "")) or not is_ar(o.get("bodyAr", "")): E(i, "need title, titleAr, bodyAr")
    exs = o.get("exs")
    if not (isinstance(exs, list) and len(exs) >= 5): return E(i, "exs: >=5")
    for j, e in enumerate(exs): chk_ex(e, f"{i}.ex{j}", {"mc", "gap", "fix", "order", "trans"})


def c_guide(o, i):
    if o.get("cat") not in ("ielts", "method"): E(i, "cat: ielts|method")
    if not is_ar(o.get("titleAr", "")) or not is_ar(o.get("bodyAr", "")) or len(o.get("bodyAr", "")) < 400: E(i, "need titleAr and bodyAr (150+ words)")
    if not (isinstance(o.get("keyPoints"), list) and len(o["keyPoints"]) >= 3): E(i, "keyPoints: >=3")
    q = o.get("quiz")
    if not (isinstance(q, list) and len(q) >= 3): return E(i, "quiz: >=3 mc")
    for j, e in enumerate(q): chk_ex(e, f"{i}.q{j}", {"mc"})


def c_phr(o, i):
    lvl(o, i)
    if not is_en(o.get("en", "")) or not is_ar(o.get("ar", "")) or not is_en(o.get("ex", ""), 10) or not isinstance(o.get("fn"), str): E(i, "need fn, en, ar, ex")


def v_motiv(items):
    for i, o in enumerate(items):
        if o.get("k") not in ("notif", "done", "comeback", "streak", "tip") or not is_ar(o.get("ar", "")): E(i, "need k and ar")
        elif len(o["ar"]) > 260: E(i, "too long (max ~40 words)")


KINDS = {
    "vocab": v_vocab, "grammar": v_grammar, "reading": v_reading, "listening": v_listening,
    "shadow": v_simple("sh-", c_shadow), "sp1": v_simple("sp1-", c_sp1), "sp2": v_simple("sp2-", c_sp2), "sp3": v_simple("sp3-", c_sp3),
    "pron": v_simple("pr-", c_pron), "wsent": v_simple("ws-", c_wsent), "w2": v_simple("w2-", c_w2), "w1": v_simple("w1-", c_w1),
    "wlesson": v_simple("wl-", c_wlesson), "guide": v_simple("gd-", c_guide), "phrases": v_simple("ph-", c_phr), "motiv": v_motiv,
}

if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in KINDS:
        sys.exit("usage: validate.py <" + "|".join(KINDS) + "> <file.json>")
    try:
        data = json.load(open(sys.argv[2], encoding="utf-8"))
    except Exception as ex:
        sys.exit(f"INVALID JSON: {ex}")
    if not isinstance(data, list) or not all(isinstance(o, dict) for o in data):
        sys.exit("File must be a JSON array of objects")
    KINDS[sys.argv[1]](data)
    if errs:
        print(f"{len(errs)} ERROR(S):")
        print("\n".join(errs[:40]))
        sys.exit(1)
    print(f"OK {len(data)} items")

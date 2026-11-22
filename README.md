# فصيح (Fasih)

تطبيق أندرويد يعمل بلا إنترنت لنقل متعلم عربي من مستوى A2 إلى C1 في الإنجليزية (IELTS Academic 7.0+) خلال 18 شهراً، مع مصطلحات القانون ومكافحة الفساد والذكاء الاصطناعي والبحث العلمي.

- `www/` تطبيق الويب (المحرك والواجهة والمحتوى): يعمل أيضاً بفتح `www/index.html` في متصفح الحاسوب.
- `android/` غلاف أندرويد (WebView + تنبيهات + نطق + تعرف على الكلام + تسجيل).
- `content/raw/` المحتوى الأصلي بصيغة JSON، و`tools/build_content.py` يحوّله إلى `www/content/*.js`.
- `tools/validate.py` فحص بنية المحتوى، `tools/test_web.py` و`tools/sim.py` اختبارات آلية للواجهة ومحاكاة متعلم.
- `SPEC.md` مواصفات المحتوى، `research/` خلاصة البحث العلمي وحقائق IELTS مع المصادر.

## البناء
الدفع إلى الفرع `fasih-src` يبني APK غير موقّع عبر GitHub Actions وينشره في الفرع `fasih-build`. التوقيع يتم خارج GitHub بمفتاح محفوظ على حاسوب صاحب التطبيق (مجلد `keystore/`، غير منشور).

All learning content is original. No real exam material is included.

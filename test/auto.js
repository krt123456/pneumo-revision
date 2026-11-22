window.__auto = (p, k) => {
  const run = document.querySelector('.run'); if (!run) return 'closed';
  const sb = document.querySelector('.sheetw .btn.yes, .sheetw .sum .btn.big'); if (sb) { sb.click(); return 'sheet'; }
  const q = s => run.querySelector(s), rnd = n => Math.floor(Math.random() * n);
  const fb = q('.fb .fbn'); if (fb) { fb.click(); return 'fb'; }
  const sum = q('.sum .btn.big'); if (sum) { sum.click(); return 'summary'; }
  const step = q('.step'), ans = step && step.dataset.ans, smart = !!ans && Math.random() < p;
  const form = q('.qform');
  if (form) { if (q('.chk')) { form.querySelectorAll('.fq').forEach(f => { const a = f.dataset.ans || '', good = Math.random() < p; const o = f.querySelectorAll('.opt'); if (o.length) (good && a.startsWith('mc:') ? o[+a.slice(3)] : o[rnd(o.length)]).click(); const i = f.querySelector('.inp'); if (i) i.value = good ? a.slice(3) : 'test'; }); q('.chk').click(); return 'form-check'; } const nx = q('.nx'); if (nx) { nx.click(); return 'form-next'; } }
  const essay = q('.essay'); if (essay) { if (q('.fin')) { essay.value = 'This is my short test answer for the task today. I usually study English in the evening.'; essay.dispatchEvent(new Event('input')); q('.fin').click(); return 'essay'; } const nx = q('.nx'); if (nx) { nx.click(); return 'essay-next'; } }
  const opts = [...run.querySelectorAll('.opts .opt')];
  if (opts.length && !opts.some(o => o.classList.contains('right'))) {
    const dk = q('.dk');
    if (dk) { if (Math.random() < k) { run.querySelector('.opts .opt[data-i="' + ans.slice(3) + '"]').click(); return 'known'; } dk.click(); return 'dk'; }
    (smart && ans.startsWith('mc:') ? run.querySelector('.opts .opt[data-i="' + ans.slice(3) + '"]') : opts[rnd(opts.length)]).click(); return 'mc';
  }
  if (ans && ans.startsWith('tok:') && !q('.tok.bad')) { (smart ? q('.tok[data-i="' + ans.slice(4) + '"]') : q('.tok')).click(); return 'fix-tap'; }
  const inp = q('.step .inp:not([disabled])'); if (inp && q('.chk:not([disabled])')) { inp.value = smart && ans.startsWith('in:') ? ans.slice(3) : 'answer'; q('.chk:not([disabled])').click(); return 'input'; }
  const pool = [...run.querySelectorAll('.pool .chip')];
  if (pool.length) {
    let c = pool[rnd(pool.length)];
    if (ans && ans.startsWith('ord:') && (smart || window.__ordSmart === ans)) { window.__ordSmart = ans; const need = JSON.parse(ans.slice(4))[run.querySelectorAll('.line .chip').length]; c = pool.find(x => x.textContent === need) || c; } else window.__ordSmart = null;
    c.click(); const chk = q('.chk'); if (chk && !chk.disabled) chk.click(); return 'chip';
  }
  const chk = q('.chk:not([disabled])'); if (chk) { chk.click(); return 'chk'; }
  const next = q('[data-k=next]') || q('.nx') || q('.step .btn.big'); if (next) { next.click(); return 'next'; }
  return 'idle';
};

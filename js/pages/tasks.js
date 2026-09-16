// Xodimlar uchun: Test (avtomatik baholanadigan) va Uy vazifasi yaratish/boshqarish.
import { sb, run } from '../db.js';
import { $, $$, esc, formModal, confirmDialog, toast, btnCls, modal, emptyState, fmtDate, today } from '../ui.js';
import { currentUser } from '../app.js';

let tab = 'test';

export async function render(container) {
  const [tests, homework, groups, results, subs] = await Promise.all([
    run(sb.from('tests').select('*, groups(name)').order('created_at', { ascending: false })),
    run(sb.from('homework').select('*, groups(name)').order('created_at', { ascending: false })),
    run(sb.from('groups').select('id,name').eq('status', 'aktiv').order('name')),
    run(sb.from('test_results').select('test_id')),
    run(sb.from('homework_submissions').select('homework_id, grade')),
  ]);
  const resCount = (tid) => results.filter((r) => r.test_id === tid).length;
  const subCount = (hid) => subs.filter((s) => s.homework_id === hid).length;
  const ungraded = (hid) => subs.filter((s) => s.homework_id === hid && s.grade == null).length;

  container.innerHTML = `
    <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div class="flex gap-1.5">
        <button data-t="test" class="px-4 py-2 rounded-lg text-sm font-semibold border">📝 Testlar</button>
        <button data-t="hw" class="px-4 py-2 rounded-lg text-sm font-semibold border">📋 Uy vazifalari</button>
      </div>
      <button id="addBtn" class="${btnCls.primary}"></button>
    </div>
    <div id="list"></div>`;

  const paint = () => {
    $$('[data-t]', container).forEach((b) => {
      const on = b.dataset.t === tab;
      b.className = `px-4 py-2 rounded-lg text-sm font-semibold border ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50'}`;
    });
    $('#addBtn', container).textContent = tab === 'test' ? '+ Test yaratish' : '+ Vazifa berish';
    const list = $('#list', container);

    if (tab === 'test') {
      list.innerHTML = tests.length === 0 ? `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState('Hozircha test yo\'q')}</div>` : `
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          ${tests.map((t) => `
            <div class="bg-white rounded-xl border border-slate-200/80 p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0"><div class="font-bold truncate">${esc(t.title)}</div>
                <div class="text-xs text-slate-400">${esc(t.groups?.name || '')} · ${(t.questions || []).length} savol</div></div>
                <button data-del-test="${t.id}" class="${btnCls.iconDel} shrink-0">🗑</button>
              </div>
              <div class="flex items-center justify-between mt-3">
                <span class="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">✅ ${resCount(t.id)} topshirdi</span>
                <button data-res="${t.id}" class="text-sm text-blue-600 font-semibold hover:underline">Natijalar →</button>
              </div>
            </div>`).join('')}
        </div>`;
      $$('[data-res]', list).forEach((b) => b.onclick = () => showResults(b.dataset.res, tests));
      $$('[data-del-test]', list).forEach((b) => b.onclick = async () => {
        if (!(await confirmDialog('Test o\'chiriladi. Davom etasizmi?'))) return;
        await run(sb.from('tests').delete().eq('id', b.dataset.delTest)); toast('O\'chirildi'); render(container);
      });
    } else {
      list.innerHTML = homework.length === 0 ? `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState('Hozircha vazifa yo\'q')}</div>` : `
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          ${homework.map((h) => `
            <div class="bg-white rounded-xl border border-slate-200/80 p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0"><div class="font-bold truncate">${esc(h.title)}</div>
                <div class="text-xs text-slate-400">${esc(h.groups?.name || '')}${h.due_date ? ' · muddat: ' + fmtDate(h.due_date) : ''}</div></div>
                <button data-del-hw="${h.id}" class="${btnCls.iconDel} shrink-0">🗑</button>
              </div>
              <div class="flex items-center justify-between mt-3">
                <span class="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">📥 ${subCount(h.id)} topshirdi${ungraded(h.id) ? ` · ${ungraded(h.id)} yangi` : ''}</span>
                <button data-sub="${h.id}" class="text-sm text-blue-600 font-semibold hover:underline">Tekshirish →</button>
              </div>
            </div>`).join('')}
        </div>`;
      $$('[data-sub]', list).forEach((b) => b.onclick = () => showSubmissions(b.dataset.sub, homework, container));
      $$('[data-del-hw]', list).forEach((b) => b.onclick = async () => {
        if (!(await confirmDialog('Vazifa o\'chiriladi. Davom etasizmi?'))) return;
        await run(sb.from('homework').delete().eq('id', b.dataset.delHw)); toast('O\'chirildi'); render(container);
      });
    }
  };

  $('#addBtn', container).onclick = () => tab === 'test' ? openTestBuilder(groups, container) : openHomework(groups, container);
  $$('[data-t]', container).forEach((b) => b.onclick = () => { tab = b.dataset.t; paint(); });
  paint();
}

// === Test yaratish (savollar builder) ===
function openTestBuilder(groups, pageContainer) {
  let qs = [{ q: '', o: ['', '', '', ''], a: 0 }];
  const m = modal('Yangi test', '', { wide: true });

  const qRow = (item, i) => `
    <div class="border border-slate-200 rounded-xl p-3 mb-2.5" data-q="${i}">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-slate-500">Savol ${i + 1}</span>
        ${qs.length > 1 ? `<button type="button" data-rmq="${i}" class="text-xs text-rose-500 hover:underline">o'chirish</button>` : ''}
      </div>
      <input data-qtext="${i}" value="${esc(item.q)}" placeholder="Savol matni" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2">
      <div class="grid sm:grid-cols-2 gap-2">
        ${item.o.map((opt, j) => `
          <label class="flex items-center gap-2 border ${item.a === j ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200'} rounded-lg px-2 py-1.5">
            <input type="radio" name="correct-${i}" ${item.a === j ? 'checked' : ''} data-correct="${i}-${j}" class="accent-emerald-600 shrink-0">
            <input data-opt="${i}-${j}" value="${esc(opt)}" placeholder="Variant ${String.fromCharCode(65 + j)}" class="flex-1 min-w-0 text-sm outline-none bg-transparent">
          </label>`).join('')}
      </div>
    </div>`;

  const draw = () => {
    m.body.innerHTML = `
      <div class="grid sm:grid-cols-2 gap-3 mb-3">
        <input id="tTitle" placeholder="Test nomi (masalan: 1-mavzu testi)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <select id="tGroup" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Guruh tanlang...</option>
          ${groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
        </select>
      </div>
      <div id="qList" class="max-h-[50vh] overflow-y-auto">${qs.map(qRow).join('')}</div>
      <button type="button" id="addQ" class="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 text-sm font-semibold hover:border-blue-400 hover:text-blue-600 mb-3">+ Savol qo'shish</button>
      <div class="flex justify-end gap-2">
        <button type="button" id="cancel" class="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium">Bekor</button>
        <button type="button" id="save" class="${btnCls.primary}">Testni saqlash</button>
      </div>`;
    // restore title/group after redraw
    $('#tTitle', m.body).value = draw._title || '';
    $('#tGroup', m.body).value = draw._group || '';
    bind();
  };

  const sync = () => {
    draw._title = $('#tTitle', m.body).value;
    draw._group = $('#tGroup', m.body).value;
    qs.forEach((item, i) => {
      item.q = $(`[data-qtext="${i}"]`, m.body)?.value || '';
      item.o = item.o.map((_, j) => $(`[data-opt="${i}-${j}"]`, m.body)?.value || '');
      const checked = $(`[name="correct-${i}"]:checked`, m.body);
      if (checked) item.a = Number(checked.dataset.correct.split('-')[1]);
    });
  };

  const bind = () => {
    $('#addQ', m.body).onclick = () => { sync(); qs.push({ q: '', o: ['', '', '', ''], a: 0 }); draw(); };
    $$('[data-rmq]', m.body).forEach((b) => b.onclick = () => { sync(); qs.splice(Number(b.dataset.rmq), 1); draw(); });
    $('#cancel', m.body).onclick = () => m.close();
    $('#save', m.body).onclick = async () => {
      sync();
      const title = draw._title.trim(); const group_id = draw._group;
      if (!title) return toast('Test nomini kiriting', 'error');
      if (!group_id) return toast('Guruhni tanlang', 'error');
      const valid = qs.filter((x) => x.q.trim() && x.o.every((o) => o.trim()));
      if (valid.length === 0) return toast('Kamida 1 ta to\'liq savol kiriting', 'error');
      await run(sb.from('tests').insert({ title, group_id, questions: valid }));
      toast(`Test saqlandi (${valid.length} savol)`); m.close(); render(pageContainer);
    };
  };
  draw();
}

async function showResults(testId, tests) {
  const t = tests.find((x) => x.id === testId);
  const results = await run(sb.from('test_results').select('*, students(first_name,last_name)').eq('test_id', testId).order('correct', { ascending: false }));
  const m = modal(`${t.title} — natijalar`, results.length === 0 ? emptyState('Hali hech kim topshirmagan') : `
    <div class="space-y-1.5">
      ${results.map((r, i) => {
        const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
        return `<div class="flex items-center justify-between py-2 px-3 rounded-lg border border-slate-100">
          <span class="text-sm font-medium">${i + 1}. ${esc(r.students?.first_name)} ${esc(r.students?.last_name || '')}</span>
          <span class="text-sm font-bold ${pct >= 60 ? 'text-emerald-600' : 'text-rose-500'}">${r.correct}/${r.total} (${pct}%)</span>
        </div>`;
      }).join('')}
    </div>`, { wide: false });
  return m;
}

// === Uy vazifasi berish ===
async function openHomework(groups, pageContainer) {
  const v = await formModal('Yangi uy vazifasi', [
    { name: 'title', label: 'Sarlavha', required: true, full: true },
    { name: 'group_id', label: 'Guruh', type: 'select', required: true, placeholder: 'Tanlang', options: groups.map((g) => ({ value: g.id, label: g.name })) },
    { name: 'due_date', label: 'Muddat', type: 'date', value: today() },
    { name: 'description', label: 'Vazifa matni / topshiriq', type: 'textarea', full: true },
  ], {}, { wide: true });
  if (!v) return;
  await run(sb.from('homework').insert(v));
  toast('Vazifa berildi'); render(pageContainer);
}

async function showSubmissions(hwId, homework, pageContainer) {
  const h = homework.find((x) => x.id === hwId);
  const subsList = await run(sb.from('homework_submissions').select('*, students(first_name,last_name)').eq('homework_id', hwId).order('submitted_at', { ascending: false }));
  const m = modal(`${h.title} — topshiriqlar`, subsList.length === 0 ? emptyState('Hali hech kim topshirmagan') : `
    <div class="space-y-3">
      ${subsList.map((s) => `
        <div class="border border-slate-200 rounded-xl p-3">
          <div class="flex items-center justify-between mb-1.5">
            <span class="font-semibold text-sm">${esc(s.students?.first_name)} ${esc(s.students?.last_name || '')}</span>
            ${s.grade != null ? `<span class="text-xs font-bold px-2 py-0.5 rounded-lg ${s.grade >= 60 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}">${s.grade} ball</span>` : '<span class="text-xs text-amber-600 font-semibold">tekshirilmagan</span>'}
          </div>
          <div class="text-sm text-slate-600 bg-slate-50 rounded-lg p-2 mb-2 whitespace-pre-wrap">${esc(s.answer || '—')}</div>
          <button data-grade="${s.id}" class="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold">${s.grade != null ? 'Bahoni o\'zgartirish' : '✓ Baholash'}</button>
        </div>`).join('')}
    </div>`, { wide: true });

  $$('[data-grade]', m.body).forEach((b) => b.onclick = async () => {
    const s = subsList.find((x) => x.id === b.dataset.grade);
    const v = await formModal('Baholash', [
      { name: 'grade', label: 'Ball (0-100)', type: 'number', value: s.grade ?? 100, required: true },
      { name: 'feedback', label: 'Izoh (ixtiyoriy)', type: 'textarea', full: true, value: s.feedback },
    ]);
    if (!v) return;
    await run(sb.from('homework_submissions').update({ grade: Number(v.grade), feedback: v.feedback, graded_at: new Date().toISOString() }).eq('id', s.id));
    toast('Baholandi'); m.close(); render(pageContainer);
  });
}

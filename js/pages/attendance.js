import { sb, run } from '../db.js';
import { $, $$, esc, toast, today, emptyState, fmtDays, fmtTime, confirmDialog } from '../ui.js';
import { smsCall } from '../app.js';

const ST = {
  keldi: ['Keldi', 'bg-emerald-600 text-white border-emerald-600'],
  kelmadi: ['Kelmadi', 'bg-rose-600 text-white border-rose-600'],
  sababli: ['Sababli', 'bg-amber-500 text-white border-amber-500'],
};

let sel = { groupId: '', date: today() };

export async function render(container) {
  const groups = await run(sb.from('groups').select('id,name,days,start_time,end_time').eq('status', 'aktiv').order('name'));
  if (!sel.groupId && groups.length) sel.groupId = groups[0].id;

  container.innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200/80 p-5 mb-5 flex flex-wrap gap-3 items-end">
      <div>
        <label class="block text-xs font-semibold text-slate-500 mb-1.5">Guruh</label>
        <select id="grp" class="border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[220px]">
          ${groups.map((g) => `<option value="${g.id}" ${g.id === sel.groupId ? 'selected' : ''}>${esc(g.name)} (${fmtDays(g.days)} ${fmtTime(g.start_time)})</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-500 mb-1.5">Sana</label>
        <input id="date" type="date" value="${sel.date}" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
      </div>
    </div>
    <div id="sheet"></div>
    <div id="history" class="mt-5"></div>`;

  if (groups.length === 0) {
    $('#sheet', container).innerHTML = `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState("Avval guruh oching")}</div>`;
    return;
  }

  $('#grp', container).onchange = (e) => { sel.groupId = e.target.value; drawSheet(container); };
  $('#date', container).onchange = (e) => { sel.date = e.target.value; drawSheet(container); };
  drawSheet(container);
}

async function drawSheet(container) {
  const sheet = $('#sheet', container);
  sheet.innerHTML = '<div class="text-slate-400 text-sm py-6 text-center">Yuklanmoqda...</div>';

  const [members, marks, lesson] = await Promise.all([
    run(sb.from('group_students').select('students(id,first_name,last_name)').eq('group_id', sel.groupId).eq('status', 'aktiv')),
    run(sb.from('attendance').select('*').eq('group_id', sel.groupId).eq('date', sel.date)),
    run(sb.from('lessons').select('*').eq('group_id', sel.groupId).eq('date', sel.date).maybeSingle()),
  ]);
  const markOf = (sid) => marks.find((m) => m.student_id === sid)?.status;

  sheet.innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200/80 p-5 mb-4">
      <label class="block text-xs font-semibold text-slate-500 mb-1.5">📚 Bugungi dars mavzusi <span class="text-slate-300">(o'quvchilar ko'radi)</span></label>
      <div class="flex gap-2">
        <input id="topicInput" value="${esc(lesson?.topic || '')}" placeholder="Masalan: Ikki tomonlama yozuv, provodkalar"
          class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <button id="topicSave" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Saqlash</button>
      </div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200/80 p-5">
      <div class="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h3 class="font-bold">Davomat — ${sel.date}</h3>
        <button id="smsAbsent" class="px-3.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold transition">📩 Kelmaganlarga SMS</button>
      </div>
      ${members.length === 0 ? emptyState("Guruhda o'quvchi yo'q") : `
      <div class="space-y-2">
        ${members.map((m, i) => {
          const s = m.students; const cur = markOf(s.id);
          return `<div class="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 rounded-xl border border-slate-100">
            <span class="font-medium text-sm">${i + 1}. ${esc(s.first_name)} ${esc(s.last_name)}</span>
            <div class="flex gap-1.5">
              ${Object.entries(ST).map(([v, [l, activeCls]]) => `
                <button data-mark data-sid="${s.id}" data-st="${v}" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${cur === v ? activeCls : 'border-slate-200 text-slate-500 hover:bg-slate-50'}">${l}</button>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>`;

  $$('[data-mark]', sheet).forEach((b) => b.onclick = async () => {
    await run(sb.from('attendance').upsert(
      { group_id: sel.groupId, student_id: b.dataset.sid, date: sel.date, status: b.dataset.st },
      { onConflict: 'group_id,student_id,date' },
    ));
    drawSheet(container);
  });

  const saveTopic = async () => {
    const topic = $('#topicInput', sheet).value.trim();
    if (!topic) { toast('Mavzu bo\'sh', 'error'); return; }
    await run(sb.from('lessons').upsert(
      { group_id: sel.groupId, date: sel.date, topic },
      { onConflict: 'group_id,date' },
    ));
    toast('Dars mavzusi saqlandi');
  };
  $('#topicSave', sheet).onclick = saveTopic;
  $('#topicInput', sheet).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveTopic(); } });

  $('#smsAbsent', sheet).onclick = async () => {
    const absent = members.map((m) => m.students).filter((s) => markOf(s.id) === 'kelmadi');
    if (absent.length === 0) return toast('Bu darsda "kelmadi" belgilangan o\'quvchi yo\'q', 'info');
    if (!(await confirmDialog(`${absent.length} ta kelmagan o'quvchiga SMS yuboriladi. Davom etasizmi?`))) return;
    const btn = $('#smsAbsent', sheet); btn.disabled = true; btn.textContent = 'Yuborilmoqda...';
    let sent = 0, test = 0, fail = 0;
    for (const s of absent) {
      const res = await smsCall('notify', { type: 'davomat', student_id: s.id, date: sel.date });
      if (res?.ok && res.status === 'yuborildi') sent++;
      else if (res?.ok && res.test) test++;
      else fail++;
    }
    if (test > 0 && sent === 0) toast(`TEST rejimi: ${test} ta SMS tayyorlandi (real yuborish uchun Sozlamalarda Eskiz'ni yoqing)`, 'info');
    else toast(`✅ ${sent} ta SMS yuborildi${fail ? `, ${fail} xato` : ''}`);
    btn.disabled = false; btn.textContent = '📩 Kelmaganlarga SMS';
  };

  drawHistory(container, members);
}

async function drawHistory(container, members) {
  const box = $('#history', container);
  const from = new Date(); from.setDate(from.getDate() - 30);
  const rows = await run(sb.from('attendance').select('*').eq('group_id', sel.groupId).gte('date', from.toISOString().slice(0, 10)).order('date'));
  const dates = [...new Set(rows.map((r) => r.date))].sort().reverse().slice(0, 10).reverse();
  if (dates.length === 0 || members.length === 0) { box.innerHTML = ''; return; }

  const icon = { keldi: '✅', kelmadi: '❌', sababli: '⚠️' };
  box.innerHTML = `
    <div class="bg-white rounded-xl border border-slate-200/80 p-5 overflow-x-auto">
      <h3 class="font-bold mb-4">Oxirgi darslar jurnali</h3>
      <table class="text-sm min-w-[500px]">
        <thead><tr class="text-xs text-slate-400">
          <th class="text-left py-2 pr-4 font-semibold">O'quvchi</th>
          ${dates.map((d) => `<th class="px-2 py-2 font-semibold">${d.slice(8, 10)}.${d.slice(5, 7)}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${members.map((m) => `<tr class="border-t border-slate-50">
            <td class="py-2 pr-4 font-medium whitespace-nowrap">${esc(m.students.first_name)} ${esc(m.students.last_name)}</td>
            ${dates.map((d) => {
              const r = rows.find((x) => x.student_id === m.students.id && x.date === d);
              return `<td class="px-2 py-2 text-center">${r ? icon[r.status] || '·' : '<span class="text-slate-200">·</span>'}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

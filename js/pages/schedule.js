import { sb, run } from '../db.js';
import { $$, esc, fmtTime, fmtDays, DAYS, statCard, emptyState, toast, formModal } from '../ui.js';
import { currentUser } from '../app.js';

const canEdit = () => ['direktor', 'moliyachi', 'admin'].includes(currentUser.role);

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
// Ikki dars vaqti kesishadimi (bir xona / bir ustoz uchun)
const overlap = (a, b) => toMin(a.start_time) < toMin(b.end_time) && toMin(b.start_time) < toMin(a.end_time);
const byTime = (a, b) => toMin(a.start_time) - toMin(b.start_time);
const dayList = Object.keys(DAYS).map(Number);

export async function render(container) {
  const [rooms, groups] = await Promise.all([
    run(sb.from('rooms').select('*, branches(name)').order('name')),
    run(sb.from('groups').select('id,name,days,start_time,end_time,room_id,teacher_id,is_online, courses(name), employees(first_name,last_name)').eq('status', 'aktiv').order('start_time')),
  ]);

  const offline = groups.filter((g) => !g.is_online);
  const online = groups.filter((g) => g.is_online);
  const noRoom = offline.filter((g) => !g.room_id);
  const teacherOf = (g) => (g.employees ? `${g.employees.first_name} ${g.employees.last_name}`.trim() : null);

  // --- To'qnashuvlarni aniqlash ---
  const inDay = (g, d) => (g.days || []).includes(d);
  const clashIds = new Set();   // "groupId|day" — qizil bo'yash uchun
  const roomClashes = [];
  const teacherClashes = [];

  const collect = (items, day, label, into) => {
    const sorted = [...items].sort(byTime);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (!overlap(sorted[i], sorted[j])) continue;
        into.push({ day, label, a: sorted[i], b: sorted[j] });
        clashIds.add(`${sorted[i].id}|${day}`);
        clashIds.add(`${sorted[j].id}|${day}`);
      }
    }
  };

  dayList.forEach((d) => {
    rooms.forEach((r) => {
      collect(offline.filter((g) => g.room_id === r.id && inDay(g, d)), d, r.name, roomClashes);
    });
    const teacherIds = [...new Set(groups.filter((g) => g.teacher_id).map((g) => g.teacher_id))];
    teacherIds.forEach((tid) => {
      const items = groups.filter((g) => g.teacher_id === tid && inDay(g, d));
      collect(items, d, teacherOf(items[0]) || 'Ustoz', teacherClashes);
    });
  });

  // --- Xona yuklamasi: haftada necha soat band ---
  const loadOf = (rid) => offline.filter((g) => g.room_id === rid)
    .reduce((sum, g) => sum + ((toMin(g.end_time) - toMin(g.start_time)) / 60) * (g.days || []).length, 0);

  const chip = (g, d) => {
    const bad = clashIds.has(`${g.id}|${d}`);
    return `<div class="rounded-lg px-2 py-1 mb-1 border text-[11px] leading-tight ${bad ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-900'}">
      <div class="font-bold truncate">${bad ? '⚠️ ' : ''}${esc(g.name)}</div>
      <div class="opacity-80">${fmtTime(g.start_time)}–${fmtTime(g.end_time)}</div>
      ${teacherOf(g) ? `<div class="opacity-60 truncate">${esc(teacherOf(g))}</div>` : ''}
    </div>`;
  };

  const clashPanel = (title, list, icon) => list.length === 0 ? '' : `
    <div class="bg-white rounded-xl border border-rose-200 border-t-4 border-t-rose-400 p-4 mb-4">
      <div class="font-bold text-sm mb-2 text-rose-700">${icon} ${title} <span class="text-xs bg-rose-100 rounded-full px-2 py-0.5 ml-1">${list.length}</span></div>
      <div class="space-y-1.5">
        ${list.map((c) => `
          <div class="text-sm border-b border-slate-100 last:border-0 pb-1.5 last:pb-0">
            <span class="font-semibold">${esc(c.label)}</span>
            <span class="text-xs bg-slate-100 rounded px-1.5 py-0.5 ml-1">${DAYS[c.day]}</span>
            <div class="text-xs text-slate-500 mt-0.5">
              ${esc(c.a.name)} (${fmtTime(c.a.start_time)}–${fmtTime(c.a.end_time)})
              <span class="text-rose-500 font-bold mx-1">✕</span>
              ${esc(c.b.name)} (${fmtTime(c.b.start_time)}–${fmtTime(c.b.end_time)})
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  const roomRow = (r) => `
    <tr class="border-t border-slate-100">
      <th class="sticky left-0 bg-white text-left align-top px-3 py-2 border-r border-slate-100 min-w-[130px]">
        <div class="font-bold text-sm">${esc(r.name)}</div>
        <div class="text-[11px] text-slate-400 font-normal">${esc(r.branches?.name || '')}${r.capacity ? ` · ${r.capacity} kishi` : ''}</div>
        <div class="text-[11px] text-slate-500 font-semibold mt-0.5">${loadOf(r.id).toFixed(1)} soat/hafta</div>
      </th>
      ${dayList.map((d) => {
    const items = offline.filter((g) => g.room_id === r.id && (g.days || []).includes(d)).sort(byTime);
    return `<td class="align-top px-1.5 py-2 border-r border-slate-50 min-w-[120px]">${items.map((g) => chip(g, d)).join('') || '<div class="text-[11px] text-slate-300 text-center py-1">—</div>'}</td>`;
  }).join('')}
    </tr>`;

  container.innerHTML = `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
      ${statCard('Xonalar', rooms.length, 'blue', '🚪')}
      ${statCard('Aktiv guruh', groups.length, 'green', '👥')}
      ${statCard("To'qnashuv", roomClashes.length + teacherClashes.length, (roomClashes.length + teacherClashes.length) ? 'red' : 'slate', '⚠️')}
      ${statCard('Xonasiz guruh', noRoom.length, noRoom.length ? 'orange' : 'slate', '❓')}
    </div>

    ${clashPanel("Xona to'qnashuvi — bir xonada ikki guruh", roomClashes, '🚪')}
    ${clashPanel("Ustoz to'qnashuvi — bir vaqtda ikki guruh", teacherClashes, '🧑‍🏫')}

    ${noRoom.length ? `
    <div class="bg-white rounded-xl border border-amber-200 border-t-4 border-t-amber-400 p-4 mb-4">
      <div class="font-bold text-sm mb-2 text-amber-700">❓ Xona biriktirilmagan guruhlar <span class="text-xs bg-amber-100 rounded-full px-2 py-0.5 ml-1">${noRoom.length}</span></div>
      <div class="flex flex-wrap gap-2">
        ${noRoom.map((g) => `
          <div class="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <span class="font-semibold">${esc(g.name)}</span>
            <span class="text-slate-400 ml-1">${fmtDays(g.days)} · ${fmtTime(g.start_time)}–${fmtTime(g.end_time)}</span>
            ${canEdit() ? `<button data-assign="${g.id}" class="ml-1.5 text-blue-600 font-semibold hover:underline">xona tanlash</button>` : ''}
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span class="font-bold text-sm">Haftalik xona jadvali</span>
        <span class="text-xs text-slate-400">faqat oflayn guruhlar</span>
      </div>
      ${rooms.length === 0 ? emptyState("Xona qo'shilmagan — Sozlamalar → Xonalar") : `
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-slate-50">
              <th class="sticky left-0 bg-slate-50 z-10 text-left px-3 py-2 text-xs font-bold text-slate-500 border-r border-slate-100">Xona</th>
              ${dayList.map((d) => `<th class="px-2 py-2 text-xs font-bold text-slate-500 border-r border-slate-100">${DAYS[d]}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rooms.map(roomRow).join('')}</tbody>
        </table>
      </div>`}
    </div>

    ${online.length ? `
    <div class="bg-white rounded-xl border border-slate-200/80 p-4 mt-4">
      <div class="font-bold text-sm mb-2">💻 Onlayn guruhlar <span class="text-xs text-slate-400 font-normal">— xona talab qilmaydi</span></div>
      <div class="flex flex-wrap gap-2">
        ${online.map((g) => `<span class="text-xs border border-violet-200 bg-violet-50 text-violet-800 rounded-lg px-2.5 py-1">${esc(g.name)} · ${fmtDays(g.days)} · ${fmtTime(g.start_time)}–${fmtTime(g.end_time)}</span>`).join('')}
      </div>
    </div>` : ''}`;

  $$('[data-assign]', container).forEach((b) => b.onclick = async () => {
    if (rooms.length === 0) { toast("Avval Sozlamalarda xona qo'shing", 'error'); return; }
    const g = groups.find((x) => x.id === b.dataset.assign);
    const v = await formModal(`${g.name} — xona tanlash`, [
      { name: 'room_id', label: 'Xona', type: 'select', required: true, placeholder: 'Tanlang', full: true, options: rooms.map((r) => ({ value: r.id, label: `${r.name}${r.branches?.name ? ' (' + r.branches.name + ')' : ''}` })) },
    ]);
    if (!v) return;
    // Tanlangan xonada shu kun/vaqtda band guruh bormi?
    const busy = offline.filter((x) => x.room_id === v.room_id && x.id !== g.id
      && (x.days || []).some((d) => (g.days || []).includes(d)) && overlap(x, g));
    if (busy.length) { toast(`Bu xona band: ${busy.map((x) => x.name).join(', ')}`, 'error'); return; }
    await run(sb.from('groups').update({ room_id: v.room_id }).eq('id', g.id));
    toast('Xona biriktirildi');
    render(container);
  });
}

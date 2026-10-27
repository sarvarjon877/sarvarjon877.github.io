import { sb, run } from '../db.js';
import { $, $$, esc, formModal, confirmDialog, toast, fmtTime, fmtDays, fmtMoney, btnCls, modal, emptyState, today } from '../ui.js';
import { currentUser } from '../app.js';

const canEdit = () => ['direktor', 'moliyachi', 'admin'].includes(currentUser.role);
const canCharge = () => ['direktor', 'moliyachi'].includes(currentUser.role);
const showMoney = () => ['direktor', 'moliyachi'].includes(currentUser.role);

let refs = { courses: [], teachers: [], rooms: [], branches: [] };
let filter = 'aktiv'; // hozir | aktiv | arxiv | hammasi

const groupFields = (initial = {}) => [
  { name: 'name', label: 'Guruh nomi', required: true, value: initial.name, placeholder: 'Masalan: BX-12' },
  { name: 'course_id', label: 'Kurs', type: 'select', required: true, placeholder: 'Tanlang', options: refs.courses.map((c) => ({ value: c.id, label: c.name })), value: initial.course_id },
  { name: 'teacher_id', label: "O'qituvchi", type: 'select', placeholder: 'Tanlang', options: refs.teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` })), value: initial.teacher_id },
  { name: 'branch_id', label: 'Filial', type: 'select', placeholder: 'Tanlang', options: refs.branches.map((b) => ({ value: b.id, label: b.name })), value: initial.branch_id },
  { name: 'room_id', label: 'Xona', type: 'select', placeholder: 'Tanlang', options: refs.rooms.map((r) => ({ value: r.id, label: r.name })), value: initial.room_id },
  { name: 'price', label: 'Oylik narxi', type: 'money', value: initial.price ?? 500000 },
  { name: 'days', label: 'Dars kunlari', type: 'days', full: true, value: initial.days || [1, 3, 5] },
  { name: 'start_time', label: 'Boshlanish vaqti', type: 'time', value: initial.start_time ? String(initial.start_time).slice(0, 5) : '14:00' },
  { name: 'end_time', label: 'Tugash vaqti', type: 'time', value: initial.end_time ? String(initial.end_time).slice(0, 5) : '15:30' },
  { name: 'start_date', label: 'Boshlanish sanasi', type: 'date', value: initial.start_date || today() },
  { name: 'status', label: 'Holati', type: 'select', options: [{ value: 'aktiv', label: 'Aktiv' }, { value: 'tugagan', label: 'Tugagan' }], value: initial.status || 'aktiv' },
  { name: 'is_online', label: 'Dars turi', type: 'checkbox', checkboxLabel: 'Onlayn guruh (masofaviy)', value: initial.is_online ?? false },
  { name: 'lesson_link', label: 'Onlayn dars havolasi', type: 'text', placeholder: 'https://zoom.us/... yoki Google Meet', value: initial.lesson_link },
];

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Xona yoki o'qituvchi shu kun/vaqtda boshqa guruhga band bo'lsa — ogohlantiradi
async function clashOk(v, groups, selfId = null) {
  if (v.status !== 'aktiv') return true;
  const days = v.days || [];
  const hits = groups.filter((g) => g.id !== selfId && g.status === 'aktiv'
    && (g.days || []).some((d) => days.includes(d))
    && toMin(v.start_time) < toMin(g.end_time) && toMin(g.start_time) < toMin(v.end_time)
    && ((!v.is_online && !g.is_online && v.room_id && g.room_id === v.room_id)
      || (v.teacher_id && g.teacher_id === v.teacher_id)));
  if (hits.length === 0) return true;
  const txt = hits.map((g) => `${g.name} (${fmtDays(g.days)} ${fmtTime(g.start_time)}–${fmtTime(g.end_time)})`).join(', ');
  return confirmDialog(`Diqqat — xona yoki o'qituvchi band: ${txt}.\nShunday saqlansinmi?`);
}

export async function render(container) {
  const [groups, members, courses, teachers, rooms, branches] = await Promise.all([
    run(sb.from('groups').select('*, courses(name), employees(first_name,last_name), rooms(name)').order('created_at', { ascending: false })),
    run(sb.from('group_students').select('group_id').eq('status', 'aktiv')),
    run(sb.from('courses').select('id,name').order('name')),
    run(sb.from('employees').select('id,first_name,last_name').eq('role', 'oqituvchi').eq('active', true)),
    run(sb.from('rooms').select('id,name').order('name')),
    run(sb.from('branches').select('id,name').order('name')),
  ]);
  refs = { courses, teachers, rooms, branches };
  const countOf = (gid) => members.filter((m) => m.group_id === gid).length;

  // Hozir dars ketayotgan guruhlar: bugungi kun + joriy vaqt oraliqda
  const now = new Date();
  const nowDow = ((now.getDay() + 6) % 7) + 1; // 1=Du ... 7=Yak
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const inSession = (g) => g.status === 'aktiv' && (g.days || []).includes(nowDow)
    && toMin(g.start_time) <= nowMin && nowMin < toMin(g.end_time);

  const FILTERS = [
    { id: 'hozir', label: '🔴 Hozir dars ketyapti', test: inSession },
    { id: 'aktiv', label: 'Aktiv', test: (g) => g.status === 'aktiv' },
    { id: 'arxiv', label: 'Arxiv', test: (g) => g.status !== 'aktiv' },
    { id: 'hammasi', label: 'Hammasi', test: () => true },
  ];
  const active = FILTERS.find((f) => f.id === filter) || FILTERS[1];
  const shown = groups.filter(active.test);

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex gap-1.5 flex-wrap" id="gfilters">
        ${FILTERS.map((f) => {
    const n = groups.filter(f.test).length;
    const on = f.id === active.id;
    return `<button data-gf="${f.id}" class="px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50'}">${f.label} <span class="${on ? 'opacity-70' : 'text-slate-400'}">${n}</span></button>`;
  }).join('')}
      </div>
      ${canEdit() ? `<button id="addGroup" class="${btnCls.primary}">+ Guruh ochish</button>` : ''}
    </div>
    ${shown.length === 0 ? `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState(
    active.id === 'hozir' ? "Hozir dars ketayotgan guruh yo'q" : "Bu bo'limda guruh yo'q")}</div>` : `
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      ${shown.map((g) => `
        <div class="bg-white rounded-xl border p-5 hover:shadow-md transition ${inSession(g) ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200/80'} ${g.status !== 'aktiv' ? 'opacity-60' : ''}">
          <div class="flex items-start justify-between mb-2">
            <div>
              <div class="font-bold text-base">${esc(g.name)}${inSession(g) ? ' <span class="align-middle text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">hozir dars</span>' : ''}</div>
              <div class="text-xs text-slate-400 mt-0.5">${esc(g.courses?.name || '')} ${g.is_online ? '· <span class="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold">Onlayn</span>' : ''}</div>
            </div>
            <div class="flex shrink-0">
              ${canEdit() ? `<button data-edit="${g.id}" class="${btnCls.iconEdit}">✏️</button>
              <button data-del="${g.id}" class="${btnCls.iconDel}">🗑</button>` : ''}
            </div>
          </div>
          <div class="text-sm text-slate-500 space-y-1 mb-3">
            <div>🧑‍🏫 ${esc(g.employees ? g.employees.first_name + ' ' + g.employees.last_name : "O'qituvchi tanlanmagan")}</div>
            <div>📅 ${fmtDays(g.days)} · ${fmtTime(g.start_time)}–${fmtTime(g.end_time)} · ${g.is_online ? '💻 Onlayn' : '🚪 ' + esc(g.rooms?.name || '—')}</div>
            ${showMoney() ? `<div>💰 ${fmtMoney(g.price)} / oy</div>` : ''}
            ${g.is_online && g.lesson_link ? `<div class="truncate">🔗 <a href="${esc(g.lesson_link)}" target="_blank" class="text-blue-600 hover:underline">${esc(g.lesson_link)}</a></div>` : ''}
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">👥 ${countOf(g.id)} o'quvchi</span>
            <button data-open="${g.id}" class="text-sm text-blue-600 font-semibold hover:underline">Batafsil →</button>
          </div>
        </div>`).join('')}
    </div>`}`;

  if ($('#addGroup', container)) $('#addGroup', container).onclick = async () => {
    const v = await formModal('Yangi guruh ochish', groupFields(), {}, { wide: true });
    if (!v) return;
    if (!(await clashOk(v, groups))) return;
    await run(sb.from('groups').insert(v));
    toast('Guruh ochildi'); render(container);
  };
  const openEdit = async (g) => {
    if (!g) return;
    const v = await formModal('Guruhni tahrirlash', groupFields(g), {}, { wide: true });
    if (!v) return;
    if (!(await clashOk(v, groups, g.id))) return;
    await run(sb.from('groups').update(v).eq('id', g.id));
    toast('Saqlandi'); render(container);
  };
  $$('[data-edit]', container).forEach((b) => b.onclick = () => openEdit(groups.find((x) => x.id === b.dataset.edit)));

  $$('#gfilters button', container).forEach((b) => b.onclick = () => { filter = b.dataset.gf; render(container); });

  // Bosh sahifadagi dars jadvalidan "#/groups?edit=<id>" bilan kelinsa — darrov tahrirlash oynasi
  const editId = new URLSearchParams(location.hash.split('?')[1] || '').get('edit');
  if (editId) {
    history.replaceState(null, '', '#/groups');
    const g = groups.find((x) => x.id === editId);
    if (g) openEdit(g); else toast('Guruh topilmadi', 'error');
  }
  $$('[data-del]', container).forEach((b) => b.onclick = async () => {
    if (!(await confirmDialog("Guruh o'chiriladi (o'quvchilar o'chmaydi). Davom etasizmi?"))) return;
    await run(sb.from('groups').delete().eq('id', b.dataset.del));
    toast("O'chirildi"); render(container);
  });
  $$('[data-open]', container).forEach((b) => b.onclick = () => openGroup(b.dataset.open, container));
}

async function openGroup(groupId, pageContainer) {
  const [g, members, allStudents] = await Promise.all([
    run(sb.from('groups').select('*, courses(name), employees(first_name,last_name), rooms(name)').eq('id', groupId).single()),
    run(sb.from('group_students').select('*, students(id,first_name,last_name,phone,status)').eq('group_id', groupId).eq('status', 'aktiv').order('joined_at')),
    run(sb.from('students').select('id,first_name,last_name').not('status', 'in', '(arxiv)').order('first_name')),
  ]);

  const m = modal(`${g.name} — guruh`, `
    <div class="text-sm text-slate-500 mb-4 space-y-1">
      <div>📚 ${esc(g.courses?.name || '')} · 🧑‍🏫 ${esc(g.employees ? g.employees.first_name + ' ' + g.employees.last_name : '—')}</div>
      <div>📅 ${fmtDays(g.days)} · ${fmtTime(g.start_time)}–${fmtTime(g.end_time)} · ${g.is_online ? '💻 Onlayn' : '🚪 ' + esc(g.rooms?.name || '—')}${showMoney() ? ` · 💰 ${fmtMoney(g.price)}/oy` : ''}</div>
      ${g.is_online && g.lesson_link ? `<div>🔗 <a href="${esc(g.lesson_link)}" target="_blank" class="text-blue-600 hover:underline">${esc(g.lesson_link)}</a></div>` : ''}
    </div>
    <div class="flex flex-wrap gap-2 mb-4">
      ${canEdit() ? `<select id="addSel" class="flex-1 min-w-[180px] border border-slate-200 rounded-lg px-2 py-2 text-sm">
        <option value="">O'quvchi tanlang...</option>
        ${allStudents.filter((s) => !members.some((mm) => mm.students?.id === s.id)).map((s) => `<option value="${s.id}">${esc(s.first_name)} ${esc(s.last_name)}</option>`).join('')}
      </select>
      <button id="addBtn" class="${btnCls.primary}">Qo'shish</button>` : ''}
      ${canCharge() ? `<button id="chargeBtn" class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold">Oylik hisobdan yechish</button>` : ''}
    </div>
    <table class="w-full text-sm">
      <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
        <th class="py-2 font-semibold">#</th><th class="py-2 font-semibold">F.I.O</th><th class="py-2 font-semibold">Telefon</th><th class="py-2 font-semibold">Qo'shilgan</th><th></th>
      </tr></thead>
      <tbody>
        ${members.map((mm, i) => `<tr class="border-b border-slate-50">
          <td class="py-2 text-slate-400">${i + 1}</td>
          <td class="py-2 font-medium">${esc(mm.students?.first_name)} ${esc(mm.students?.last_name)}</td>
          <td class="py-2 text-slate-500">${esc(mm.students?.phone || '—')}</td>
          <td class="py-2 text-slate-400 text-xs">${esc(mm.joined_at || '')}</td>
          <td class="py-2 text-right">${canEdit() ? `<button data-rm="${mm.id}" class="text-xs text-rose-500 hover:underline">chiqarish</button>` : ''}</td>
        </tr>`).join('') || `<tr><td colspan="5">${emptyState("Guruhda o'quvchi yo'q")}</td></tr>`}
      </tbody>
    </table>`, { wide: true });

  const refresh = () => { m.close(); openGroup(groupId, pageContainer); };

  if ($('#addBtn', m.body)) $('#addBtn', m.body).onclick = async () => {
    const sid = $('#addSel', m.body).value;
    if (!sid) return;
    await run(sb.from('group_students').insert({ group_id: groupId, student_id: sid }));
    toast("Qo'shildi"); refresh();
  };
  $$('[data-rm]', m.body).forEach((b) => b.onclick = async () => {
    if (!(await confirmDialog("O'quvchini guruhdan chiqarasizmi?"))) return;
    await run(sb.from('group_students').delete().eq('id', b.dataset.rm));
    refresh();
  });
  if ($('#chargeBtn', m.body)) $('#chargeBtn', m.body).onclick = async () => {
    if (members.length === 0) return toast("Guruhda o'quvchi yo'q", 'error');
    if (!(await confirmDialog(`${members.length} ta o'quvchining har biridan ${fmtMoney(g.price)} hisobdan yechiladi. Davom etasizmi?`))) return;
    await run(sb.from('charges').insert(members.map((mm) => ({
      student_id: mm.students.id, group_id: groupId, amount: g.price, reason: `${g.name} — oylik to'lov`,
    }))));
    toast('Hisobdan yechildi'); m.close(); render(pageContainer);
  };
}

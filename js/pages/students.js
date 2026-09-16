import { sb, run } from '../db.js';
import { $, $$, esc, formModal, confirmDialog, toast, fmtDate, fmtMoney, btnCls, modal, today, emptyState } from '../ui.js';
import { currentUser, smsCall } from '../app.js';

// Kelishuv summasi va qarzdorlikni direktor, moliyachi VA admin ko'radi/kiritadi.
// O'quvchi va o'qituvchi ko'rmaydi.
const canEdit = () => ['direktor', 'moliyachi', 'admin'].includes(currentUser.role);
const canPay = () => ['direktor', 'moliyachi', 'admin'].includes(currentUser.role);
const showMoney = () => ['direktor', 'moliyachi', 'admin'].includes(currentUser.role);

export const STATUS_LABELS = {
  buyurtma: ['Buyurtma', 'bg-amber-50 text-amber-700'],
  sinov: ['Sinov darsi', 'bg-cyan-50 text-cyan-700'],
  yangi: ['Yangi', 'bg-blue-50 text-blue-700'],
  aktiv: ['Aktiv', 'bg-emerald-50 text-emerald-700'],
  muzlatilgan: ['Muzlatilgan', 'bg-slate-100 text-slate-600'],
  arxiv: ['Arxiv', 'bg-slate-100 text-slate-500'],
};

const METHODS = [
  { value: 'naqd', label: 'Naqd' }, { value: 'karta', label: 'Karta' },
  { value: 'click', label: 'Click' }, { value: 'payme', label: 'Payme' }, { value: 'otkazma', label: "O'tkazma" },
];

const studentFields = (initial = {}, groupOptions = []) => [
  { name: 'first_name', label: 'Ism', required: true, value: initial.first_name },
  { name: 'last_name', label: 'Familiya', value: initial.last_name },
  { name: 'phone', label: 'Telefon', type: 'tel', value: initial.phone },
  { name: 'parent_phone', label: 'Ota-ona telefoni', type: 'tel', value: initial.parent_phone },
  { name: 'gender', label: 'Jinsi', type: 'select', placeholder: 'Tanlang', options: [{ value: 'erkak', label: 'Erkak' }, { value: 'ayol', label: 'Ayol' }], value: initial.gender },
  { name: 'birth_date', label: "Tug'ilgan sana", type: 'date', value: initial.birth_date },
  { name: 'status', label: 'Holati', type: 'select', options: Object.entries(STATUS_LABELS).map(([v, [l]]) => ({ value: v, label: l })), value: initial.status || 'yangi' },
  ...(showMoney() ? [{ name: 'deal_amount', label: 'Kelishuv summasi (umumiy)', type: 'money', value: initial.deal_amount ?? 0 }] : []),
  { name: 'group_id', label: "Qaysi guruhga qo'shiladi", type: 'select', placeholder: 'Tanlang (ixtiyoriy)', options: groupOptions },
  { name: 'note', label: 'Izoh', type: 'textarea', full: true, value: initial.note },
];

let state = { tab: 'all', search: '' };

export async function render(container) {
  const [students, balances, memberships, activeGroups] = await Promise.all([
    run(sb.from('students').select('*').order('created_at', { ascending: false })),
    run(sb.from('student_balances').select('*')),
    run(sb.from('group_students').select('student_id, groups(id,name)').eq('status', 'aktiv')),
    run(sb.from('groups').select('id,name,courses(name)').eq('status', 'aktiv').order('name')),
  ]);
  const groupOptions = activeGroups.map((g) => ({ value: g.id, label: `${g.name}${g.courses?.name ? ' — ' + g.courses.name : ''}` }));
  const finOf = (id) => balances.find((b) => b.student_id === id) || {};
  const remOf = (id) => Number(finOf(id).remaining || 0); // qoldi (to'lanmagan qismi)
  const groupsOf = (id) => memberships.filter((m) => m.student_id === id).map((m) => m.groups?.name).filter(Boolean);

  const tabs = [
    ['all', `Barchasi (${students.length})`],
    ...Object.entries(STATUS_LABELS).map(([v, [l]]) => [v, `${l} (${students.filter((s) => s.status === v).length})`]),
    ...(showMoney() ? [['qarzdor', `Qarzdorlar (${students.filter((s) => remOf(s.id) > 0).length})`]] : []),
  ];

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <input id="search" value="${esc(state.search)}" placeholder="Qidirish (ism, telefon)..." class="border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-72 max-w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
      <div class="flex gap-2">
        ${canPay() ? `<button id="smsDebt" class="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-semibold transition">📩 Qarzdorlarga SMS</button>` : ''}
        ${canEdit() ? `<button id="addStudent" class="${btnCls.primary}">+ O'quvchi qo'shish</button>` : ''}
      </div>
    </div>
    <div class="flex gap-1.5 flex-wrap mb-4" id="tabs">
      ${tabs.map(([v, l]) => `<button data-tab="${v}" class="px-3.5 py-1.5 rounded-full text-sm font-medium border ${state.tab === v ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50'}">${l}</button>`).join('')}
    </div>
    <div class="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
      <table class="w-full text-sm min-w-[760px]">
        <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
          <th class="px-5 py-3 font-semibold">F.I.O</th><th class="px-4 py-3 font-semibold">Telefon</th>
          <th class="px-4 py-3 font-semibold">Holati</th>${showMoney() ? '<th class="px-4 py-3 font-semibold">Qoldi (to\'lanadi)</th>' : ''}
          <th class="px-4 py-3 font-semibold">Guruhlar</th><th class="px-4 py-3 font-semibold">Qo'shilgan</th>
          <th class="px-4 py-3"></th>
        </tr></thead>
        <tbody id="rows"></tbody>
      </table>
      <div id="empty"></div>
    </div>`;

  const draw = () => {
    let list = students;
    if (state.tab === 'qarzdor') list = list.filter((s) => remOf(s.id) > 0);
    else if (state.tab !== 'all') list = list.filter((s) => s.status === state.tab);
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((s) => `${s.first_name} ${s.last_name} ${s.phone || ''}`.toLowerCase().includes(q));
    }
    $('#empty', container).innerHTML = list.length ? '' : emptyState();
    $('#rows', container).innerHTML = list.map((s) => {
      const rem = remOf(s.id);
      const [lbl, cls] = STATUS_LABELS[s.status] || [s.status, 'bg-slate-100'];
      return `<tr class="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer" data-open="${s.id}">
        <td class="px-5 py-3 font-semibold">${esc(s.first_name)} ${esc(s.last_name)}</td>
        <td class="px-4 py-3 text-slate-500">${esc(s.phone || '—')}</td>
        <td class="px-4 py-3"><span class="text-xs font-semibold px-2.5 py-1 rounded-lg ${cls}">${lbl}</span></td>
        ${showMoney() ? `<td class="px-4 py-3 font-semibold ${rem > 0 ? 'text-rose-600' : 'text-emerald-600'}">${rem > 0 ? fmtMoney(rem) : '<span class="text-emerald-600">To\'liq to\'langan</span>'}</td>` : ''}
        <td class="px-4 py-3 text-slate-500 text-xs">${groupsOf(s.id).map((g) => esc(g)).join(', ') || '—'}</td>
        <td class="px-4 py-3 text-slate-400 text-xs">${fmtDate(s.created_at)}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          ${canEdit() ? `<button data-edit="${s.id}" class="${btnCls.iconEdit}">✏️</button>
          <button data-del="${s.id}" class="${btnCls.iconDel}">🗑</button>` : ''}
        </td>
      </tr>`;
    }).join('');
    bindRows();
  };

  function bindRows() {
    $$('[data-edit]', container).forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const s = students.find((x) => x.id === b.dataset.edit);
      const cur = memberships.find((m) => m.student_id === s.id)?.groups?.id || '';
      const v = await formModal("O'quvchini tahrirlash", studentFields({ ...s, group_id: cur }, groupOptions), {});
      if (!v) return;
      const { group_id, ...data } = v;
      await run(sb.from('students').update(data).eq('id', s.id));
      if (group_id && group_id !== cur) {
        await run(sb.from('group_students').upsert({ group_id, student_id: s.id, status: 'aktiv' }, { onConflict: 'group_id,student_id' }));
      }
      toast('Saqlandi'); render(container);
    });
    $$('[data-del]', container).forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog("O'quvchi va uning barcha ma'lumotlari (to'lovlar, davomat) o'chiriladi. Davom etasizmi?"))) return;
      await run(sb.from('students').delete().eq('id', b.dataset.del));
      toast("O'chirildi"); render(container);
    });
    $$('[data-open]', container).forEach((r) => r.onclick = () => openProfile(r.dataset.open, container));
  }

  if ($('#addStudent', container)) $('#addStudent', container).onclick = async () => {
    const v = await formModal("Yangi o'quvchi", studentFields({}, groupOptions));
    if (!v) return;
    const { group_id, ...data } = v;
    const [created] = await run(sb.from('students').insert(data).select());
    if (group_id) await run(sb.from('group_students').insert({ group_id, student_id: created.id }));
    toast(group_id ? "O'quvchi qo'shildi va guruhga biriktirildi" : "O'quvchi qo'shildi"); render(container);
  };
  if ($('#smsDebt', container)) $('#smsDebt', container).onclick = async () => {
    const debtors = students.filter((s) => remOf(s.id) > 0);
    if (debtors.length === 0) return toast('Qarzdor o\'quvchi yo\'q', 'info');
    if (!(await confirmDialog(`${debtors.length} ta qarzdor o'quvchiga qarzdorlik haqida SMS yuboriladi. Davom etasizmi?`))) return;
    const btn = $('#smsDebt', container); btn.disabled = true; btn.textContent = 'Yuborilmoqda...';
    const res = await smsCall('notify-debtors');
    if (!res?.ok) { toast(res?.message || 'SMS yuborishda xato', 'error'); btn.disabled = false; btn.textContent = '📩 Qarzdorlarga SMS'; return; }
    if (res.test > 0 && res.sent === 0) toast(`TEST rejimi: ${res.test} ta SMS tayyorlandi (real yuborish uchun Sozlamalarda Eskiz'ni yoqing)`, 'info');
    else toast(`✅ ${res.sent} ta SMS yuborildi${res.fail ? `, ${res.fail} xato` : ''}`);
    btn.disabled = false; btn.textContent = '📩 Qarzdorlarga SMS';
  };
  $('#search', container).oninput = (e) => { state.search = e.target.value; draw(); };
  $$('#tabs button', container).forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; render(container); });

  draw();
}

export async function openProfile(studentId, pageContainer) {
  const [s, bal, memberships, payments, charges, groups, tgSettings] = await Promise.all([
    run(sb.from('students').select('*').eq('id', studentId).single()),
    run(sb.from('student_balances').select('*').eq('student_id', studentId).single()),
    run(sb.from('group_students').select('*, groups(id,name,price)').eq('student_id', studentId).eq('status', 'aktiv')),
    run(sb.from('payments').select('*').eq('student_id', studentId).order('paid_at', { ascending: false }).limit(20)),
    run(sb.from('charges').select('*').eq('student_id', studentId).order('charged_at', { ascending: false }).limit(20)),
    run(sb.from('groups').select('id,name').eq('status', 'aktiv').order('name')),
    run(sb.from('settings').select('telegram_bot').single()),
  ]);
  const tgBot = tgSettings?.telegram_bot || '';
  const deal = Number(bal?.deal_amount || 0);
  const paid = Number(bal?.paid || 0);
  const remaining = Number(bal?.remaining || 0);
  const [lbl, cls] = STATUS_LABELS[s.status] || [s.status, 'bg-slate-100'];

  const m = modal(`${s.first_name} ${s.last_name}`, `
    <div class="grid sm:grid-cols-2 gap-5">
      <div class="space-y-2 text-sm">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-lg ${cls}">${lbl}</span>
        </div>
        <div class="text-slate-500">📞 ${esc(s.phone || '—')} ${s.parent_phone ? `· 👨‍👩‍👦 ${esc(s.parent_phone)}` : ''}</div>
        ${s.note ? `<div class="text-slate-500 italic text-xs">${esc(s.note)}</div>` : ''}
        ${tgBot && canEdit() ? `<div class="pt-1">
          ${s.telegram_chat_id
            ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">✈️ Telegram ulangan</span>`
            : `<button id="tgLinkBtn" class="text-xs px-3 py-1.5 rounded-lg bg-[#229ED9] hover:bg-[#1c8bc0] text-white font-semibold">✈️ Telegram ulash havolasini olish</button>
               <div class="text-[11px] text-slate-400 mt-1">Havolani o'quvchiga yuboring — u bosib, botда Start bossa ulanadi</div>`}
        </div>` : ''}
        ${showMoney() ? `
        <div class="grid grid-cols-3 gap-2 pt-1">
          <div class="rounded-xl border border-slate-100 p-2.5 text-center">
            <div class="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Kelishuv</div>
            <div class="font-bold text-slate-800 text-sm mt-0.5">${fmtMoney(deal)}</div>
          </div>
          <div class="rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5 text-center">
            <div class="text-[10px] uppercase tracking-wide text-emerald-500 font-semibold">To'landi</div>
            <div class="font-bold text-emerald-600 text-sm mt-0.5">${fmtMoney(paid)}</div>
          </div>
          <div class="rounded-xl border ${remaining > 0 ? 'border-rose-100 bg-rose-50/40' : 'border-emerald-100 bg-emerald-50/40'} p-2.5 text-center">
            <div class="text-[10px] uppercase tracking-wide ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'} font-semibold">Qoldi</div>
            <div class="font-bold ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'} text-sm mt-0.5">${fmtMoney(remaining)}</div>
          </div>
        </div>
        ${canPay() ? `<button id="dealBtn" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium mt-1">✏️ Kelishuv summasini o'zgartirish</button>` : ''}
        ` : ''}
        ${canEdit() ? `<div class="flex flex-wrap gap-1.5 pt-1">
          ${['aktiv', 'muzlatilgan', 'arxiv'].filter((x) => x !== s.status).map((x) => `<button data-st="${x}" class="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium">${STATUS_LABELS[x][0]}ga o'tkazish</button>`).join('')}
        </div>` : ''}
        <div class="pt-2">
          <div class="font-bold mb-1.5">Guruhlari</div>
          ${memberships.length ? memberships.map((mm) => `
            <div class="flex items-center justify-between py-1.5 border-b border-slate-50 text-sm">
              <span>${esc(mm.groups?.name)}</span>
              ${canEdit() ? `<button data-leave="${mm.id}" class="text-xs text-rose-500 hover:underline">chiqarish</button>` : ''}
            </div>`).join('') : '<div class="text-xs text-slate-400">Guruhga qo\'shilmagan</div>'}
          ${canEdit() ? `<div class="flex gap-2 mt-2">
            <select id="grpSel" class="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
              <option value="">Guruh tanlang...</option>
              ${groups.filter((g) => !memberships.some((mm) => mm.groups?.id === g.id)).map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
            </select>
            <button id="joinBtn" class="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium">Qo'shish</button>
          </div>` : ''}
        </div>
      </div>
      <div class="text-sm ${showMoney() ? '' : 'hidden'}">
        <div class="flex items-center justify-between mb-1.5">
          <div class="font-bold">To'lovlar tarixi</div>
          ${canPay() ? `<button id="payBtn" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">+ To'lov</button>` : ''}
        </div>
        <div class="max-h-64 overflow-y-auto space-y-1">
          ${[...payments.map((p) => ({ ...p, _t: 'in', _d: p.paid_at })), ...charges.map((c) => ({ ...c, _t: 'out', _d: c.charged_at }))]
            .sort((a, b) => String(b._d).localeCompare(String(a._d)))
            .map((r) => `
            <div class="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span class="text-xs text-slate-400">${fmtDate(r._d)} ${r._t === 'in' ? '· ' + esc(METHODS.find((mt) => mt.value === r.method)?.label || r.method || '') : '· ' + esc(r.reason || 'hisobdan yechish')}</span>
              <span class="font-semibold ${r._t === 'in' ? 'text-emerald-600' : 'text-rose-500'}">${r._t === 'in' ? '+' : '−'}${fmtMoney(r.amount)}</span>
            </div>`).join('') || '<div class="text-xs text-slate-400">Hozircha yozuvlar yo\'q</div>'}
        </div>
      </div>
    </div>`, { wide: true });

  const refresh = () => { m.close(); openProfile(studentId, pageContainer); };

  if ($('#tgLinkBtn', m.body)) $('#tgLinkBtn', m.body).onclick = async () => {
    const code = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).replace(/-/g, '').slice(0, 18);
    await run(sb.from('students').update({ tg_link_code: code }).eq('id', studentId));
    const link = `https://t.me/${tgBot}?start=${code}`;
    try { await navigator.clipboard.writeText(link); toast('Havola nusxalandi! O\'quvchiga yuboring'); }
    catch { toast('Havola: ' + link, 'info'); }
    window.open(link, '_blank');
  };

  $$('[data-st]', m.body).forEach((b) => b.onclick = async () => {
    await run(sb.from('students').update({ status: b.dataset.st }).eq('id', studentId));
    toast('Holat yangilandi'); m.close(); render(pageContainer);
  });
  if ($('#joinBtn', m.body)) $('#joinBtn', m.body).onclick = async () => {
    const gid = $('#grpSel', m.body).value;
    if (!gid) return;
    await run(sb.from('group_students').insert({ group_id: gid, student_id: studentId }));
    toast("Guruhga qo'shildi"); refresh();
  };
  $$('[data-leave]', m.body).forEach((b) => b.onclick = async () => {
    if (!(await confirmDialog("O'quvchini guruhdan chiqarasizmi?"))) return;
    await run(sb.from('group_students').delete().eq('id', b.dataset.leave));
    refresh();
  });
  if ($('#dealBtn', m.body)) $('#dealBtn', m.body).onclick = async () => {
    const v = await formModal("Kelishuv summasi", [
      { name: 'deal_amount', label: 'Umumiy kelishilgan summa', type: 'money', required: true, value: deal },
    ]);
    if (!v) return;
    await run(sb.from('students').update({ deal_amount: v.deal_amount || 0 }).eq('id', studentId));
    toast('Kelishuv summasi saqlandi'); refresh();
  };
  if ($('#payBtn', m.body)) $('#payBtn', m.body).onclick = async () => {
    const v = await formModal("To'lov qabul qilish", [
      { name: 'amount', label: 'Summa', type: 'money', required: true },
      { name: 'method', label: "To'lov usuli", type: 'select', options: METHODS },
      { name: 'paid_at', label: 'Sana', type: 'date', value: today() },
      { name: 'group_id', label: 'Guruh (ixtiyoriy)', type: 'select', placeholder: '—', options: memberships.map((mm) => ({ value: mm.groups?.id, label: mm.groups?.name })) },
      { name: 'note', label: 'Izoh', type: 'textarea', full: true },
    ]);
    if (!v) return;
    await run(sb.from('payments').insert({ ...v, student_id: studentId }));
    toast("To'lov saqlandi"); refresh();
  };
}

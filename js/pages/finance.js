import { sb, run } from '../db.js';
import { $, $$, esc, formModal, confirmDialog, toast, fmtDate, fmtMoney, btnCls, statCard, emptyState, today } from '../ui.js';
import { openProfile } from './students.js';
import { currentUser } from '../app.js';

// Moliyaviy to'liq huquq: direktor va moliyachi. Admin faqat to'lov qabul qiladi va qarzdorlarni ko'radi.
const fullFinance = () => ['direktor', 'moliyachi'].includes(currentUser.role);

const METHODS = [
  { value: 'naqd', label: 'Naqd' }, { value: 'karta', label: 'Karta' },
  { value: 'click', label: 'Click' }, { value: 'payme', label: 'Payme' }, { value: 'otkazma', label: "O'tkazma" },
];

let tab = 'payments';

export async function render(container) {
  const [payments, charges, balances, students, subs, expenses] = await Promise.all([
    run(sb.from('payments').select('*, students(id,first_name,last_name), groups(name)').order('paid_at', { ascending: false }).limit(200)),
    run(sb.from('charges').select('*, students(id,first_name,last_name)').order('charged_at', { ascending: false }).limit(200)),
    run(sb.from('student_balances').select('*')),
    run(sb.from('students').select('id,first_name,last_name,phone,status,due_date,blocked')),
    run(sb.from('subscriptions').select('*').order('price')),
    run(sb.from('expenses').select('*').order('spent_at', { ascending: false }).limit(200)),
  ]);

  const monthStart = new Date(); monthStart.setDate(1);
  const monthIncome = payments.filter((p) => new Date(p.paid_at) >= monthStart).reduce((a, p) => a + Number(p.amount), 0);
  const monthExpense = expenses.filter((x) => new Date(x.spent_at) >= monthStart).reduce((a, x) => a + Number(x.amount), 0);
  const todayIncome = payments.filter((p) => p.paid_at === today()).reduce((a, p) => a + Number(p.amount), 0);
  // Qarzdor = kelishuv summasidan hali to'lanmagan qismi qolgan o'quvchi
  const debtors = balances.filter((b) => Number(b.remaining) > 0);
  const totalDebt = debtors.reduce((a, b) => a + Number(b.remaining), 0);
  const profit = monthIncome - monthExpense;

  const TABS = fullFinance() ? [
    ['payments', `To'lovlar (${payments.length})`],
    ['expenses', `Xarajatlar (${expenses.length})`],
    ['debtors', `Qarzdorlar (${debtors.length})`],
    ['charges', `Hisobdan yechishlar (${charges.length})`],
    ['subs', `Abonementlar (${subs.length})`],
  ] : [
    ['payments', `To'lovlar (${payments.length})`],
    ['debtors', `Qarzdorlar (${debtors.length})`],
  ];
  if (!TABS.some(([v]) => v === tab)) tab = 'payments';

  container.innerHTML = `
    ${fullFinance() ? `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
      ${statCard('Joriy oy tushumi', `<span class="text-base">${fmtMoney(monthIncome)}</span>`, 'green', '📈')}
      ${statCard('Joriy oy xarajati', `<span class="text-base">${fmtMoney(monthExpense)}</span>`, 'orange', '📉')}
      ${statCard('Sof foyda (joriy oy)', `<span class="text-base ${profit < 0 ? 'text-rose-600' : ''}">${fmtMoney(profit)}</span>`, profit < 0 ? 'red' : 'blue', '🏦')}
      ${statCard('Bugungi tushum', `<span class="text-base">${fmtMoney(todayIncome)}</span>`, 'cyan', '💵')}
      ${statCard('Yig\'iladigan qoldiq', `<span class="text-base">${fmtMoney(totalDebt)}</span>`, 'red', '💸')}
    </div>` : ''}
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex gap-1.5 flex-wrap" id="tabs">
        ${TABS.map(([v, l]) => `<button data-tab="${v}" class="px-3.5 py-1.5 rounded-full text-sm font-medium border ${tab === v ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50'}">${l}</button>`).join('')}
      </div>
      <div class="flex gap-2">
        <button id="addPay" class="${btnCls.primary}">+ To'lov qabul qilish</button>
      </div>
    </div>
    <div id="body" class="bg-white rounded-xl border border-slate-200/80 overflow-x-auto"></div>`;

  const body = $('#body', container);

  const draw = () => {
    if (tab === 'payments') {
      body.innerHTML = payments.length === 0 ? emptyState("To'lovlar yo'q") : `
        <table class="w-full text-sm min-w-[640px]">
          <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
            <th class="px-5 py-3 font-semibold">Sana</th><th class="px-4 py-3 font-semibold">O'quvchi</th>
            <th class="px-4 py-3 font-semibold">Summa</th><th class="px-4 py-3 font-semibold">Usul</th>
            <th class="px-4 py-3 font-semibold">Guruh</th><th class="px-4 py-3 font-semibold">Izoh</th><th></th>
          </tr></thead>
          <tbody>${payments.map((p) => `<tr class="border-b border-slate-50 hover:bg-slate-50/60">
            <td class="px-5 py-3 text-slate-500">${fmtDate(p.paid_at)}</td>
            <td class="px-4 py-3 font-semibold">${esc(p.students ? p.students.first_name + ' ' + p.students.last_name : '—')}</td>
            <td class="px-4 py-3 font-bold text-emerald-600">+${fmtMoney(p.amount)}</td>
            <td class="px-4 py-3 text-slate-500">${esc(METHODS.find((m) => m.value === p.method)?.label || p.method)}</td>
            <td class="px-4 py-3 text-slate-500">${esc(p.groups?.name || '—')}</td>
            <td class="px-4 py-3 text-slate-400 text-xs">${esc(p.note || '')}</td>
            <td class="px-4 py-3 text-right">${fullFinance() ? `<button data-delpay="${p.id}" class="${btnCls.iconDel}">🗑</button>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table>`;
      $$('[data-delpay]', body).forEach((b) => b.onclick = async () => {
        if (!(await confirmDialog("To'lov o'chiriladi. Davom etasizmi?"))) return;
        await run(sb.from('payments').delete().eq('id', b.dataset.delpay));
        toast("O'chirildi"); render(container);
      });
    }

    if (tab === 'expenses') {
      const CATS = [
        { value: 'ijara', label: 'Ijara' }, { value: 'oylik', label: 'Oyliklar' },
        { value: 'kommunal', label: 'Kommunal' }, { value: 'reklama', label: 'Reklama' },
        { value: 'jihoz', label: 'Jihozlar' }, { value: 'boshqa', label: 'Boshqa' },
      ];
      body.innerHTML = `
        <div class="p-4 flex justify-end"><button id="addExp" class="${btnCls.ghost}">+ Xarajat qo'shish</button></div>
        ${expenses.length === 0 ? emptyState("Xarajatlar yo'q") : `
        <table class="w-full text-sm min-w-[520px]">
          <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
            <th class="px-5 py-3 font-semibold">Sana</th><th class="px-4 py-3 font-semibold">Kategoriya</th>
            <th class="px-4 py-3 font-semibold">Summa</th><th class="px-4 py-3 font-semibold">Izoh</th><th></th>
          </tr></thead>
          <tbody>${expenses.map((x) => `<tr class="border-b border-slate-50 hover:bg-slate-50/60">
            <td class="px-5 py-3 text-slate-500">${fmtDate(x.spent_at)}</td>
            <td class="px-4 py-3"><span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700">${esc(CATS.find((c) => c.value === x.category)?.label || x.category)}</span></td>
            <td class="px-4 py-3 font-bold text-rose-500">−${fmtMoney(x.amount)}</td>
            <td class="px-4 py-3 text-slate-500 text-xs">${esc(x.note || '')}</td>
            <td class="px-4 py-3 text-right"><button data-delexp="${x.id}" class="${btnCls.iconDel}">🗑</button></td>
          </tr>`).join('')}</tbody>
        </table>`}`;
      $('#addExp', body).onclick = async () => {
        const v = await formModal('Xarajat kiritish', [
          { name: 'amount', label: 'Summa', type: 'money', required: true },
          { name: 'category', label: 'Kategoriya', type: 'select', options: CATS },
          { name: 'spent_at', label: 'Sana', type: 'date', value: today() },
          { name: 'note', label: 'Izoh', type: 'textarea', full: true },
        ]);
        if (!v) return;
        await run(sb.from('expenses').insert(v));
        toast('Xarajat saqlandi'); render(container);
      };
      $$('[data-delexp]', body).forEach((b) => b.onclick = async () => {
        if (!(await confirmDialog("Xarajat o'chiriladi. Davom etasizmi?"))) return;
        await run(sb.from('expenses').delete().eq('id', b.dataset.delexp));
        toast("O'chirildi"); render(container);
      });
    }

    if (tab === 'debtors') {
      const rows = debtors
        .map((d) => ({ ...d, s: students.find((s) => s.id === d.student_id) }))
        .filter((d) => d.s)
        .sort((a, b) => Number(b.remaining) - Number(a.remaining));
      const isOverdue = (s) => s.due_date && (new Date(s.due_date).getTime() + 5 * 86400000) < Date.now();
      const overdueCount = rows.filter((d) => d.s.blocked || isOverdue(d.s)).length;
      body.innerHTML = rows.length === 0 ? emptyState("Qarzdorlar yo'q 🎉") : `
        ${overdueCount ? `<div class="mb-3 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-rose-700"><b>${overdueCount}</b> ta o'quvchining to'lov muddati o'tgan (5+ kun). 🔒 belgilanganlar avtomat bloklangan.</div>` : ''}
        <div class="overflow-x-auto"><table class="w-full text-sm min-w-[760px]">
          <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
            <th class="px-5 py-3 font-semibold">O'quvchi</th><th class="px-4 py-3 font-semibold">Telefon</th>
            <th class="px-4 py-3 font-semibold">Qoldi</th><th class="px-4 py-3 font-semibold">Muddat</th>
            <th class="px-4 py-3 font-semibold">Holat</th><th></th>
          </tr></thead>
          <tbody>${rows.map((d) => {
            const od = isOverdue(d.s);
            return `<tr class="border-b border-slate-50 hover:bg-slate-50/60 ${d.s.blocked ? 'bg-rose-50/40' : ''}">
            <td class="px-5 py-3 font-semibold">${esc(d.s.first_name)} ${esc(d.s.last_name || '')}</td>
            <td class="px-4 py-3 text-slate-500">${esc(d.s.phone || '—')}</td>
            <td class="px-4 py-3 font-bold text-rose-600">${fmtMoney(d.remaining)}</td>
            <td class="px-4 py-3 ${od ? 'text-rose-600 font-semibold' : 'text-slate-500'}">${d.s.due_date ? fmtDate(d.s.due_date) : '—'}</td>
            <td class="px-4 py-3">${d.s.blocked ? '<span class="text-xs font-bold px-2 py-1 rounded-lg bg-rose-100 text-rose-700">🔒 Bloklangan</span>' : od ? '<span class="text-xs font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700">Muddat o\'tgan</span>' : '<span class="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-500">Qarz</span>'}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              ${d.s.blocked
                ? `<button data-unblock="${d.student_id}" class="text-xs font-semibold text-emerald-600 hover:underline mr-3">Blokdan chiqar</button>`
                : `<button data-block="${d.student_id}" class="text-xs font-semibold text-rose-600 hover:underline mr-3">Blok</button>`}
              <button data-arch="${d.student_id}" class="text-xs font-semibold text-slate-500 hover:underline mr-3">Arxivga</button>
              <button data-prof="${d.student_id}" class="text-xs text-blue-600 font-semibold hover:underline">Profil →</button>
            </td>
          </tr>`;
          }).join('')}</tbody>
        </table></div>`;
      $$('[data-prof]', body).forEach((b) => b.onclick = () => openProfile(b.dataset.prof, container));
      $$('[data-block]', body).forEach((b) => b.onclick = async () => {
        await run(sb.from('students').update({ blocked: true, blocked_at: new Date().toISOString() }).eq('id', b.dataset.block));
        toast("O'quvchi bloklandi"); render(container);
      });
      $$('[data-unblock]', body).forEach((b) => b.onclick = async () => {
        await run(sb.from('students').update({ blocked: false, blocked_at: null }).eq('id', b.dataset.unblock));
        toast("Blokdan chiqarildi"); render(container);
      });
      $$('[data-arch]', body).forEach((b) => b.onclick = async () => {
        if (!(await confirmDialog("O'quvchi arxivga o'tkaziladi (tizimdan chiqariladi). Davom etasizmi?"))) return;
        await run(sb.from('students').update({ status: 'arxiv', blocked: true }).eq('id', b.dataset.arch));
        toast("Arxivga o'tkazildi"); render(container);
      });
    }

    if (tab === 'charges') {
      body.innerHTML = charges.length === 0 ? emptyState("Yozuvlar yo'q") : `
        <table class="w-full text-sm min-w-[520px]">
          <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
            <th class="px-5 py-3 font-semibold">Sana</th><th class="px-4 py-3 font-semibold">O'quvchi</th>
            <th class="px-4 py-3 font-semibold">Summa</th><th class="px-4 py-3 font-semibold">Sabab</th><th></th>
          </tr></thead>
          <tbody>${charges.map((c) => `<tr class="border-b border-slate-50 hover:bg-slate-50/60">
            <td class="px-5 py-3 text-slate-500">${fmtDate(c.charged_at)}</td>
            <td class="px-4 py-3 font-semibold">${esc(c.students ? c.students.first_name + ' ' + c.students.last_name : '—')}</td>
            <td class="px-4 py-3 font-bold text-rose-500">−${fmtMoney(c.amount)}</td>
            <td class="px-4 py-3 text-slate-500">${esc(c.reason || '—')}</td>
            <td class="px-4 py-3 text-right"><button data-delch="${c.id}" class="${btnCls.iconDel}">🗑</button></td>
          </tr>`).join('')}</tbody>
        </table>`;
      $$('[data-delch]', body).forEach((b) => b.onclick = async () => {
        if (!(await confirmDialog("Yozuv o'chiriladi. Davom etasizmi?"))) return;
        await run(sb.from('charges').delete().eq('id', b.dataset.delch));
        toast("O'chirildi"); render(container);
      });
    }

    if (tab === 'subs') {
      body.innerHTML = `
        <div class="p-4 flex justify-end"><button id="addSub" class="${btnCls.ghost}">+ Abonement qo'shish</button></div>
        ${subs.length === 0 ? emptyState("Abonementlar yo'q") : `
        <table class="w-full text-sm min-w-[520px]">
          <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
            <th class="px-5 py-3 font-semibold">Nomi</th><th class="px-4 py-3 font-semibold">Narxi</th>
            <th class="px-4 py-3 font-semibold">Turi</th><th class="px-4 py-3 font-semibold">Muddati</th>
            <th class="px-4 py-3 font-semibold">Darslar soni</th><th></th>
          </tr></thead>
          <tbody>${subs.map((s) => `<tr class="border-b border-slate-50 hover:bg-slate-50/60">
            <td class="px-5 py-3 font-semibold">${esc(s.name)}</td>
            <td class="px-4 py-3 font-bold">${fmtMoney(s.price)}</td>
            <td class="px-4 py-3 text-slate-500">${esc(s.type)}</td>
            <td class="px-4 py-3 text-slate-500">${s.duration_days} kun</td>
            <td class="px-4 py-3 text-slate-500">${s.lessons_count} ta</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              <button data-editsub="${s.id}" class="${btnCls.iconEdit}">✏️</button>
              <button data-delsub="${s.id}" class="${btnCls.iconDel}">🗑</button>
            </td>
          </tr>`).join('')}</tbody>
        </table>`}`;
      const subFields = (i = {}) => [
        { name: 'name', label: 'Nomi', required: true, value: i.name },
        { name: 'price', label: 'Narxi', type: 'money', required: true, value: i.price },
        { name: 'type', label: 'Turi', type: 'select', options: [{ value: 'oylik', label: 'Oylik' }, { value: 'kurs', label: "To'liq kurs" }, { value: 'individual', label: 'Individual' }], value: i.type || 'oylik' },
        { name: 'duration_days', label: 'Muddati (kun)', type: 'number', value: i.duration_days ?? 30 },
        { name: 'lessons_count', label: 'Darslar soni', type: 'number', value: i.lessons_count ?? 12 },
      ];
      $('#addSub', body).onclick = async () => {
        const v = await formModal('Yangi abonement', subFields());
        if (!v) return;
        await run(sb.from('subscriptions').insert(v));
        toast("Qo'shildi"); render(container);
      };
      $$('[data-editsub]', body).forEach((b) => b.onclick = async () => {
        const s = subs.find((x) => x.id === b.dataset.editsub);
        const v = await formModal('Abonementni tahrirlash', subFields(s));
        if (!v) return;
        await run(sb.from('subscriptions').update(v).eq('id', s.id));
        toast('Saqlandi'); render(container);
      });
      $$('[data-delsub]', body).forEach((b) => b.onclick = async () => {
        if (!(await confirmDialog("Abonement o'chiriladi. Davom etasizmi?"))) return;
        await run(sb.from('subscriptions').delete().eq('id', b.dataset.delsub));
        toast("O'chirildi"); render(container);
      });
    }
  };

  $$('#tabs button', container).forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(container); });

  $('#addPay', container).onclick = async () => {
    const v = await formModal("To'lov qabul qilish", [
      { name: 'student_id', label: "O'quvchi", type: 'select', required: true, placeholder: 'Tanlang', options: students.filter((s) => s.status !== 'arxiv').map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })) },
      { name: 'amount', label: 'Summa', type: 'money', required: true },
      { name: 'method', label: 'Usul', type: 'select', options: METHODS },
      { name: 'paid_at', label: 'Sana', type: 'date', value: today() },
      { name: 'note', label: 'Izoh', type: 'textarea', full: true },
    ]);
    if (!v) return;
    await run(sb.from('payments').insert(v));
    toast("To'lov saqlandi ✅"); render(container);
  };

  draw();
}

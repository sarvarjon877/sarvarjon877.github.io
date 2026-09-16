// Analitika — o'quv markazni to'liq tahlil + guruh ochish kalkulyatori (tavsiya bilan).
// Faqat direktor/moliyachi. Ma'lumot: students, groups, payments, expenses, employees.
import { sb, run } from '../db.js';
import { $, $$, esc, fmtMoney, statCard, emptyState } from '../ui.js';

const money = (n) => fmtMoney(Math.round(Number(n) || 0));
const pctf = (n) => (Math.round((Number(n) || 0) * 10) / 10) + '%';
const num = (v) => Number(String(v || '').replace(/\D/g, '')) || 0;

export async function render(container) {
  container.innerHTML = '<div class="text-slate-400 text-sm py-10 text-center">Tahlil yuklanmoqda...</div>';
  const [students, groups, payments, expenses, members] = await Promise.all([
    run(sb.from('students').select('id,status,deal_amount')),
    run(sb.from('groups').select('id,name,price,status, employees(first_name,last_name,salary_type,percent,salary), rooms(name)')),
    run(sb.from('payments').select('amount,paid_at,group_id')),
    run(sb.from('expenses').select('amount,spent_at').limit(500)),
    run(sb.from('group_students').select('group_id,status').eq('status', 'aktiv')),
  ]);

  const cnt = (st) => students.filter((s) => s.status === st).length;
  const gStudents = (gid) => members.filter((m) => m.group_id === gid).length;
  const activeGroups = groups.filter((g) => g.status === 'aktiv');

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const inMonth = (d) => new Date(d) >= monthStart;
  const monthIncome = payments.filter((p) => inMonth(p.paid_at)).reduce((a, p) => a + Number(p.amount), 0);
  const monthExpense = expenses.filter((e) => inMonth(e.spent_at)).reduce((a, e) => a + Number(e.amount), 0);

  // O'qituvchilar hisoblangan ish haqi (foizga: shu oy guruhiga tushgan to'lov × foiz; fiks: oylik)
  let teacherCost = 0;
  for (const g of activeGroups) {
    const emp = g.employees;
    if (!emp) continue;
    if (emp.salary_type === 'fiks') { teacherCost += Number(emp.salary) || 0; continue; }
    const gIncome = payments.filter((p) => p.group_id === g.id && inMonth(p.paid_at)).reduce((a, p) => a + Number(p.amount), 0);
    teacherCost += gIncome * (Number(emp.percent) || 0) / 100;
  }
  const netProfit = monthIncome - monthExpense - teacherCost;
  const margin = monthIncome ? (netProfit / monthIncome) * 100 : 0;

  // Guruhlar rentabelligi
  const groupRows = activeGroups.map((g) => {
    const scount = gStudents(g.id);
    const income = scount * (Number(g.price) || 0);
    const emp = g.employees;
    let tcost = 0;
    if (emp) tcost = emp.salary_type === 'fiks' ? (Number(emp.salary) || 0) : income * (Number(emp.percent) || 0) / 100;
    const net = income - tcost;
    return { name: g.name, scount, income, tcost, net, teacher: emp ? `${emp.first_name} ${emp.last_name || ''}`.trim() : '—' };
  }).sort((a, b) => b.net - a.net);

  const totalDebt = students.reduce((a, s) => a + Math.max(0, Number(s.deal_amount || 0)), 0); // taxminiy (deal - paid keyin)

  container.innerHTML = `
    <div class="mb-5 text-sm text-slate-500">Bu oy uchun to'liq tahlil · <b>${new Date().toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' })}</b></div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      ${statCard('Bu oy daromad', `<span class="text-base">${money(monthIncome)}</span>`, 'green', '💰')}
      ${statCard('Xarajat + ish haqi', `<span class="text-base">${money(monthExpense + teacherCost)}</span>`, 'orange', '📉')}
      ${statCard('Sof foyda', `<span class="text-base ${netProfit < 0 ? 'text-rose-600' : ''}">${money(netProfit)}</span>`, netProfit < 0 ? 'red' : 'blue', '📈')}
      ${statCard('Foyda marjasi', pctf(margin), margin < 20 ? 'orange' : 'green', '🎯')}
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      ${statCard("Aktiv o'quvchi", cnt('aktiv'), 'blue', '🎓')}
      ${statCard('Sinovда', cnt('sinov'), 'cyan', '🧪')}
      ${statCard('Aktiv guruh', activeGroups.length, 'purple', '👥')}
      ${statCard("O'rt. guruh to'ldi", activeGroups.length ? Math.round(members.length / activeGroups.length) + ' ta' : '0', 'slate', '📊')}
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <div class="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
        <div class="font-bold text-slate-800 mb-3">🏆 Guruhlar rentabelligi (bu oy)</div>
        ${groupRows.length === 0 ? emptyState('Aktiv guruh yo\'q') : `<div class="overflow-x-auto"><table class="w-full text-sm min-w-[440px]">
          <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
            <th class="py-2 font-semibold">Guruh</th><th class="py-2 font-semibold">O'quvchi</th>
            <th class="py-2 font-semibold">Daromad</th><th class="py-2 font-semibold">Sof</th></tr></thead>
          <tbody>${groupRows.map((r) => `<tr class="border-b border-slate-50">
            <td class="py-2 font-semibold text-slate-700">${esc(r.name)}<div class="text-[11px] text-slate-400 font-normal">🧑‍🏫 ${esc(r.teacher)}</div></td>
            <td class="py-2 text-slate-500">${r.scount}</td>
            <td class="py-2 text-slate-500">${money(r.income)}</td>
            <td class="py-2 font-bold ${r.net < 0 ? 'text-rose-600' : 'text-emerald-600'}">${money(r.net)}</td>
          </tr>`).join('')}</tbody></table></div>`}
      </div>

      <div class="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-lg text-white" id="calcCard">
        <div class="font-bold text-lg mb-1">📊 Guruh ochish kalkulyatori</div>
        <div class="text-blue-100 text-xs mb-4">Raqamlarni kiriting — foyda va tavsiyani ko'rsataman</div>
        <div class="space-y-2.5">
          <div class="grid grid-cols-2 gap-2.5">
            <label class="block"><span class="text-[11px] text-blue-100">O'quvchilar soni</span>
              <input id="cN" type="number" inputmode="numeric" value="12" class="w-full mt-1 rounded-lg px-3 py-2 text-slate-800 text-sm"></label>
            <label class="block"><span class="text-[11px] text-blue-100">O'quvchi narxi (oylik)</span>
              <input id="cP" data-money value="500 000" class="w-full mt-1 rounded-lg px-3 py-2 text-slate-800 text-sm"></label>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <label class="block"><span class="text-[11px] text-blue-100">O'qituvchi turi</span>
              <select id="cType" class="w-full mt-1 rounded-lg px-3 py-2 text-slate-800 text-sm"><option value="foiz">Foizga</option><option value="fiks">Belgilangan oylik</option></select></label>
            <label class="block"><span class="text-[11px] text-blue-100" id="cTL">O'qituvchi foizi (%)</span>
              <input id="cTV" type="number" inputmode="numeric" value="40" class="w-full mt-1 rounded-lg px-3 py-2 text-slate-800 text-sm"></label>
          </div>
          <label class="block"><span class="text-[11px] text-blue-100">Qo'shimcha xarajat (xona, oyiga)</span>
            <input id="cOv" data-money value="1 000 000" class="w-full mt-1 rounded-lg px-3 py-2 text-slate-800 text-sm"></label>
        </div>
        <div id="calcOut" class="mt-4"></div>
      </div>
    </div>`;

  // Kalkulyator mantiqi
  const el = (id) => $('#' + id, container);
  const recompute = () => {
    const N = num(el('cN').value);
    const P = num(el('cP').value);
    const type = el('cType').value;
    const tv = num(el('cTV').value);
    const overhead = num(el('cOv').value);
    const income = N * P;
    const teacher = type === 'foiz' ? income * tv / 100 : tv;
    const expense = teacher + overhead;
    const profit = income - expense;
    const marg = income ? profit / income * 100 : 0;
    // Zararsizlik nuqtasi (nechta o'quvchi kerak)
    let breakEven;
    if (type === 'foiz') {
      const perStudent = P * (1 - tv / 100);
      breakEven = perStudent > 0 ? Math.ceil(overhead / perStudent) : Infinity;
    } else {
      breakEven = P > 0 ? Math.ceil((tv + overhead) / P) : Infinity;
    }
    let verdict, cls, advice;
    if (profit <= 0) {
      verdict = '❌ Tavsiya etilmaydi'; cls = 'bg-rose-500/20 border-rose-300/40 text-rose-50';
      advice = isFinite(breakEven)
        ? `Bu shartda <b>zarar</b> (${money(profit)}). Zararsiz bo'lish uchun kamida <b>${breakEven} ta</b> o'quvchi kerak, yoki narxni oshiring.`
        : `O'quvchi narxi juda past — bu narxда foyda chiqmaydi. Narxni oshiring.`;
    } else if (marg < 20) {
      verdict = '⚠️ Ehtiyotkorlik bilan'; cls = 'bg-amber-500/20 border-amber-300/40 text-amber-50';
      advice = `Foyda bor (${money(profit)}), lekin marja past (${pctf(marg)}). Yaxshiroq bo'lishi uchun narxni biroz oshiring yoki <b>${Math.max(N + 2, breakEven + 3)} ta</b> o'quvchi to'plang.`;
    } else {
      verdict = '✅ Ochish tavsiya etiladi'; cls = 'bg-emerald-500/20 border-emerald-300/40 text-emerald-50';
      advice = `Yaxshi variant! Oyiga <b>${money(profit)}</b> sof foyda (marja ${pctf(marg)}). Zararsizlik: ${isFinite(breakEven) ? breakEven + ' ta o\'quvchi' : '—'}.`;
    }
    el('calcOut').innerHTML = `
      <div class="grid grid-cols-3 gap-2 mb-3 text-center">
        <div class="rounded-xl bg-white/10 p-2"><div class="text-sm font-extrabold">${money(income)}</div><div class="text-[10px] text-blue-100">Daromad</div></div>
        <div class="rounded-xl bg-white/10 p-2"><div class="text-sm font-extrabold">${money(expense)}</div><div class="text-[10px] text-blue-100">Xarajat</div></div>
        <div class="rounded-xl bg-white/10 p-2"><div class="text-sm font-extrabold ${profit < 0 ? 'text-rose-200' : 'text-emerald-200'}">${money(profit)}</div><div class="text-[10px] text-blue-100">Foyda</div></div>
      </div>
      <div class="rounded-xl border p-3 ${cls}">
        <div class="font-bold text-sm mb-1">${verdict}</div>
        <div class="text-xs leading-relaxed">${advice}</div>
      </div>`;
  };

  // money mask
  $$('[data-money]', container).forEach((inp) => inp.addEventListener('input', () => {
    const d = inp.value.replace(/\D/g, '').slice(0, 12);
    inp.value = d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    recompute();
  }));
  ['cN', 'cP', 'cType', 'cTV', 'cOv'].forEach((id) => el(id).addEventListener('input', recompute));
  el('cType').addEventListener('change', () => {
    el('cTL').textContent = el('cType').value === 'foiz' ? "O'qituvchi foizi (%)" : "O'qituvchi oyligi";
    if (el('cType').value === 'fiks') { el('cTV').value = '2 000 000'.replace(/ /g, ''); }
    else { el('cTV').value = '40'; }
    recompute();
  });
  recompute();
}

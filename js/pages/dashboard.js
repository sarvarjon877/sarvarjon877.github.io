import { sb, run } from '../db.js';
import { $, $$, esc, statCard, fmtTime, fmtMoney, fmtDate, DAYS, emptyState } from '../ui.js';
import { currentUser } from '../app.js';

export async function render(container) {
  const role = currentUser.role;
  const showMoney = role === 'direktor' || role === 'moliyachi'; // umumiy tushum
  const showDebt = ['direktor', 'moliyachi', 'admin'].includes(role); // qarzdorlar soni
  const showStats = role !== 'oqituvchi';
  const [students, leads, groups, balances, payments, risks, memberships] = await Promise.all([
    run(sb.from('students').select('id,first_name,last_name,status,due_date')),
    run(sb.from('leads').select('id,status')),
    run(sb.from('groups').select('*, courses(name), employees(first_name,last_name), rooms(name)').eq('status', 'aktiv')),
    run(sb.from('student_balances').select('*')),
    run(sb.from('payments').select('amount,paid_at')),
    run(sb.from('student_attendance_risk').select('*')),
    run(sb.from('group_students').select('student_id, groups(name)').eq('status', 'aktiv')),
  ]);

  const byStatus = (st) => students.filter((s) => s.status === st).length;
  const activeLeads = leads.filter((l) => !['oquvchi', 'yoqotildi'].includes(l.status)).length;
  const debtors = balances.filter((b) => Number(b.remaining) > 0).length;
  const monthStart = new Date(); monthStart.setDate(1);
  const monthIncome = payments.filter((p) => new Date(p.paid_at) >= monthStart).reduce((a, p) => a + Number(p.amount), 0);


  // ---- Signallar: qarzdorlik va ketish xavfi ----
  const liveIds = new Set(students.filter((s) => s.status !== 'arxiv').map((s) => s.id));
  const nameOf = Object.fromEntries(students.map((s) => [s.id, `${s.first_name || ''} ${s.last_name || ''}`.trim()]));
  const groupOf = {};
  (memberships || []).forEach((m) => { if (m.groups?.name && !groupOf[m.student_id]) groupOf[m.student_id] = m.groups.name; });

  const debtList = (balances || [])
    .filter((b) => liveIds.has(b.student_id) && Number(b.remaining) > 0)
    .sort((a, b) => Number(b.remaining) - Number(a.remaining));
  const debtTotal = debtList.reduce((a, b) => a + Number(b.remaining), 0);

  const liveRisks = (risks || []).filter((r) => liveIds.has(r.student_id));
  const riskList = liveRisks
    .filter((r) => r.ketma_ket_kelmagan >= 2 || r.foiz < 75)
    .sort((a, b) => (b.ketma_ket_kelmagan - a.ketma_ket_kelmagan) || (a.foiz - b.foiz));
  const attSumJami = liveRisks.reduce((a, r) => a + (r.jami || 0), 0);
  const attSumKeldi = liveRisks.reduce((a, r) => a + (r.keldi || 0), 0);
  const attPct = attSumJami ? Math.round((attSumKeldi * 100) / attSumJami) : null;

  const row = (left, right) => `<div class="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">${left}${right}</div>`;
  const sub = (t) => `<div class="text-xs text-slate-400">${esc(t)}</div>`;

  const debtCard = !showDebt ? '' : `
    <div class="bg-white rounded-xl border border-slate-200/80 p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold flex items-center gap-2">💸 Qarzdorlar</h3>
        <a href="#/finance" class="text-xs font-semibold text-blue-600 hover:underline">Hammasi →</a>
      </div>
      <div class="text-2xl font-extrabold text-red-600 leading-none">${fmtMoney(debtTotal)}</div>
      <div class="text-xs text-slate-500 mt-1 mb-3">${debtList.length} o'quvchi</div>
      ${debtList.length === 0 ? emptyState('Qarzdor yo'q 🎉') : debtList.slice(0, 6).map((b) => row(
        `<div class="min-w-0"><div class="font-semibold text-sm truncate">${esc(nameOf[b.student_id] || '—')}</div>${sub(groupOf[b.student_id] || '—')}</div>`,
        `<div class="text-sm font-bold text-red-600 shrink-0">${fmtMoney(b.remaining)}</div>`
      )).join('')}
    </div>`;

  const riskCard = `
    <div class="bg-white rounded-xl border border-slate-200/80 p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold flex items-center gap-2">⚠️ Ketish xavfi</h3>
        <a href="#/attendance" class="text-xs font-semibold text-blue-600 hover:underline">Davomat →</a>
      </div>
      <div class="text-2xl font-extrabold ${attPct !== null && attPct < 85 ? 'text-amber-600' : 'text-emerald-600'} leading-none">${attPct === null ? '—' : attPct + '%'}</div>
      <div class="text-xs text-slate-500 mt-1 mb-3">umumiy davomat · ${riskList.length} ta signal</div>
      ${riskList.length === 0 ? emptyState('Xavf signali yo'q 👍') : riskList.slice(0, 6).map((r) => row(
        `<div class="min-w-0"><div class="font-semibold text-sm truncate">${esc(nameOf[r.student_id] || '—')}</div>${sub(groupOf[r.student_id] || '—')}</div>`,
        `<div class="text-right shrink-0">
           ${r.ketma_ket_kelmagan >= 2 ? `<div class="text-sm font-bold text-red-600">${r.ketma_ket_kelmagan} dars yo'q</div>` : ''}
           <div class="text-xs ${r.foiz < 75 ? 'text-amber-600 font-semibold' : 'text-slate-400'}">davomat ${r.foiz}%</div>
         </div>`
      )).join('')}
    </div>`;


  const todayStr = new Date().toISOString().slice(0, 10);
  const in3Str = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const withDue = students.filter((s) => s.status !== 'arxiv' && s.due_date);
  const overdue = withDue.filter((s) => s.due_date < todayStr).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const dueSoon = withDue.filter((s) => s.due_date >= todayStr && s.due_date <= in3Str).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const dueName = (s) => `${s.first_name || ''} ${s.last_name || ''}`.trim();

  const dueCard = !showDebt ? '' : `
    <div class="bg-white rounded-xl border border-slate-200/80 p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold flex items-center gap-2">📅 To'lov kuni</h3>
        <a href="#/finance" class="text-xs font-semibold text-blue-600 hover:underline">Moliya →</a>
      </div>
      <div class="flex gap-6 mb-3">
        <div><div class="text-2xl font-extrabold text-rose-600 leading-none">${overdue.length}</div><div class="text-xs text-slate-500 mt-1">kechikkan</div></div>
        <div><div class="text-2xl font-extrabold text-amber-600 leading-none">${dueSoon.length}</div><div class="text-xs text-slate-500 mt-1">3 kun ichida</div></div>
      </div>
      ${[...overdue, ...dueSoon].length === 0
        ? `<div class="text-xs text-slate-400 py-2">To'lov kuni belgilangan o'quvchi yo'q. Kartada "Keyingi to'lov kuni"ni qo'ying.</div>`
        : [...overdue, ...dueSoon].slice(0, 6).map((s) => row(
            `<div class="min-w-0"><div class="font-semibold text-sm truncate">${esc(dueName(s))}</div>${sub(groupOf[s.id] || '—')}</div>`,
            `<div class="text-sm font-bold shrink-0 ${s.due_date < todayStr ? 'text-rose-600' : 'text-amber-600'}">${fmtDate(s.due_date)}</div>`
          )).join('')}
    </div>`;

  const signals = (showDebt || showStats) ? `<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-6">${debtCard}${riskCard}${dueCard}</div>` : '';

  const todayDow = ((new Date().getDay() + 6) % 7) + 1; // 1=Du ... 7=Yak
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
  const banner = `
    <div class="relative overflow-hidden rounded-3xl p-6 mb-6 text-white" style="background:linear-gradient(120deg,#2563eb 0%,#4f46e5 55%,#7c3aed 100%); box-shadow:0 20px 44px -20px rgba(79,70,229,.7);">
      <div class="absolute -right-12 -top-14 w-56 h-56 rounded-full" style="background:radial-gradient(circle, rgba(255,255,255,.22), transparent 70%);"></div>
      <div class="relative flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div class="text-blue-100 text-sm mb-1">${greet} 👋</div>
          <div class="text-2xl font-extrabold leading-tight">${esc(currentUser.name)}</div>
          <div class="text-sm text-blue-50/90 mt-1.5">${byStatus('aktiv')} aktiv o'quvchi · ${groups.length} aktiv guruh${showStats ? ` · ${activeLeads} faol lid` : ''}</div>
        </div>
        ${showMoney ? `<div class="text-right shrink-0"><div class="text-blue-100 text-xs">Bu oy tushum</div><div class="text-2xl font-extrabold">${fmtMoney(monthIncome)}</div></div>` : ''}
      </div>
    </div>`;

  container.innerHTML = `
    ${banner}
    ${showStats ? `<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
      ${statCard('Faol lidlar', activeLeads, 'purple', '🎯', '#/leads')}
      ${statCard('Sinov darsiga yozilganlar', byStatus('sinov'), 'cyan', '🧪', '#/students')}
      ${statCard("Yangi o'quvchilar", byStatus('yangi'), 'blue', '✨', '#/students')}
      ${statCard("Aktiv o'quvchilar", byStatus('aktiv'), 'green', '🎓', '#/students')}
      ${showDebt ? statCard('Qarzdorlar', debtors, 'red', '💸', '#/finance') : ''}
      ${statCard('Bitirganlar', byStatus('bitirgan'), 'purple', '🎓', '#/students')}
      ${statCard('Muzlatilgan', byStatus('muzlatilgan'), 'slate', '❄️', '#/students')}
      ${statCard('Arxiv', byStatus('arxiv'), 'slate', '📦', '#/students')}
      ${statCard('Aktiv guruhlar', groups.length, 'orange', '👥', '#/groups')}
      ${statCard('Buyurtmalar', byStatus('buyurtma'), 'yellow', '📝', '#/leads')}
      ${showMoney ? statCard('Oylik tushum', `<span class="text-base">${fmtMoney(monthIncome)}</span>`, 'green', '💰', '#/finance') : ''}
    </div>` : ''}

    ${signals}

    <div class="bg-white rounded-xl border border-slate-200/80 p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 class="font-bold">Dars jadvali</h3>
        <div class="flex gap-1.5 flex-wrap" id="dayTabs">
          ${Object.entries(DAYS).map(([d, l]) => `
            <button data-day="${d}" class="px-3.5 py-1.5 rounded-full text-sm font-medium border ${Number(d) === todayDow ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:bg-slate-50'}">${l}</button>`).join('')}
        </div>
      </div>
      <div id="timetable"></div>
    </div>`;

  const renderDay = (day) => {
    const list = groups
      .filter((g) => (g.days || []).includes(day))
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    $('#timetable', container).innerHTML = list.length === 0
      ? emptyState('Bu kunda darslar yo\'q')
      : `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${list.map((g) => `
          <div class="border border-slate-100 rounded-xl p-4 hover:shadow-md transition bg-slate-50/50">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold">${esc(g.name)}</span>
              <span class="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">${fmtTime(g.start_time)} – ${fmtTime(g.end_time)}</span>
            </div>
            <div class="text-sm text-slate-500 space-y-1">
              <div>📚 ${esc(g.courses?.name || '—')} ${g.is_online ? '<span class="inline-block px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-xs font-semibold">Onlayn</span>' : ''}</div>
              <div>🧑‍🏫 ${esc(g.employees ? g.employees.first_name + ' ' + g.employees.last_name : '—')}</div>
              <div>${g.is_online ? '💻 Masofaviy' : '🚪 ' + esc(g.rooms?.name || '—')}</div>
            </div>
          </div>`).join('')}
      </div>`;
  };

  $$('#dayTabs button', container).forEach((b) => {
    b.onclick = () => {
      $$('#dayTabs button', container).forEach((x) => x.className = 'px-3.5 py-1.5 rounded-full text-sm font-medium border border-slate-200 hover:bg-slate-50');
      b.className = 'px-3.5 py-1.5 rounded-full text-sm font-medium border bg-slate-900 text-white border-slate-900';
      renderDay(Number(b.dataset.day));
    };
  });
  renderDay(todayDow);
}

import { sb, run } from '../db.js';
import { $, $$, esc, statCard, fmtTime, fmtMoney, DAYS, emptyState } from '../ui.js';
import { currentUser } from '../app.js';

export async function render(container) {
  const role = currentUser.role;
  const showMoney = role === 'direktor' || role === 'moliyachi'; // umumiy tushum
  const showDebt = ['direktor', 'moliyachi', 'admin'].includes(role); // qarzdorlar soni
  const showStats = role !== 'oqituvchi';
  const [students, leads, groups, balances, payments] = await Promise.all([
    run(sb.from('students').select('id,status')),
    run(sb.from('leads').select('id,status')),
    run(sb.from('groups').select('*, courses(name), employees(first_name,last_name), rooms(name)').eq('status', 'aktiv')),
    run(sb.from('student_balances').select('*')),
    run(sb.from('payments').select('amount,paid_at')),
  ]);

  const byStatus = (st) => students.filter((s) => s.status === st).length;
  const activeLeads = leads.filter((l) => !['oquvchi', 'yoqotildi'].includes(l.status)).length;
  const debtors = balances.filter((b) => Number(b.remaining) > 0).length;
  const monthStart = new Date(); monthStart.setDate(1);
  const monthIncome = payments.filter((p) => new Date(p.paid_at) >= monthStart).reduce((a, p) => a + Number(p.amount), 0);

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
      ${statCard('Muzlatilgan', byStatus('muzlatilgan'), 'slate', '❄️', '#/students')}
      ${statCard('Arxiv', byStatus('arxiv'), 'slate', '📦', '#/students')}
      ${statCard('Aktiv guruhlar', groups.length, 'orange', '👥', '#/groups')}
      ${statCard('Buyurtmalar', byStatus('buyurtma'), 'yellow', '📝', '#/leads')}
      ${showMoney ? statCard('Oylik tushum', `<span class="text-base">${fmtMoney(monthIncome)}</span>`, 'green', '💰', '#/finance') : ''}
    </div>` : ''}

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

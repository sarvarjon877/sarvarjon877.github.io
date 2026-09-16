import { sb, run } from '../db.js';
import { esc, fmtMoney, statCard, emptyState } from '../ui.js';

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

export async function render(container) {
  const [payments, expenses, students, leads, groups, employees, memberships] = await Promise.all([
    run(sb.from('payments').select('amount,paid_at,group_id')),
    run(sb.from('expenses').select('amount,spent_at')),
    run(sb.from('students').select('id,status,created_at')),
    run(sb.from('leads').select('id,status,source,created_at')),
    run(sb.from('groups').select('id,name,teacher_id,price,status').eq('status', 'aktiv')),
    run(sb.from('employees').select('id,first_name,last_name,role,percent,salary_type,salary').eq('active', true)),
    run(sb.from('group_students').select('group_id').eq('status', 'aktiv')),
  ]);

  // Oxirgi 6 oy: tushum va xarajat
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      income: payments.filter((p) => String(p.paid_at).slice(0, 7) === key).reduce((a, p) => a + Number(p.amount), 0),
      expense: expenses.filter((x) => String(x.spent_at).slice(0, 7) === key).reduce((a, x) => a + Number(x.amount), 0),
      newStudents: students.filter((s) => String(s.created_at).slice(0, 7) === key).length,
    });
  }
  const maxVal = Math.max(...months.map((m) => Math.max(m.income, m.expense)), 1);

  // Lidlar konversiyasi
  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.status === 'oquvchi').length;
  const lostLeads = leads.filter((l) => l.status === 'yoqotildi').length;
  const conv = totalLeads ? Math.round((wonLeads / totalLeads) * 100) : 0;

  // Manbalar bo'yicha lidlar
  const SRC = { target: 'Target (reklama)', instagram: 'Instagram', telegram: 'Telegram', tavsiya: 'Tavsiya', reklama: 'Tashqi reklama', kelib_ketgan: "O'zi kelgan", boshqa: 'Boshqa' };
  const bySource = Object.entries(SRC).map(([k, l]) => [l, leads.filter((x) => x.source === k).length]).filter(([, n]) => n > 0);
  const maxSrc = Math.max(...bySource.map(([, n]) => n), 1);

  // O'qituvchilar bo'yicha (joriy oy)
  const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const teacherRows = employees.filter((e) => e.role === 'oqituvchi').map((t) => {
    const gids = groups.filter((g) => g.teacher_id === t.id).map((g) => g.id);
    const income = payments.filter((p) => gids.includes(p.group_id) && String(p.paid_at).slice(0, 7) === mKey).reduce((a, p) => a + Number(p.amount), 0);
    const studentCount = memberships.filter((m) => gids.includes(m.group_id)).length;
    const salary = t.salary_type === 'fiks' ? Number(t.salary) : income * Number(t.percent || 0) / 100;
    return { name: `${t.first_name} ${t.last_name}`, groups: gids.length, students: studentCount, income, salary };
  }).sort((a, b) => b.income - a.income);

  const bar = (label, value, max, color, valueLabel) => `
    <div class="flex items-center gap-3 text-sm">
      <div class="w-24 shrink-0 text-slate-500 text-xs font-medium">${esc(label)}</div>
      <div class="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
        <div class="h-full ${color} rounded-full transition-all" style="width:${Math.max((value / max) * 100, value > 0 ? 3 : 0)}%"></div>
      </div>
      <div class="w-28 shrink-0 text-right text-xs font-bold text-slate-700">${valueLabel}</div>
    </div>`;

  container.innerHTML = `
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
      ${statCard('Jami lidlar', totalLeads, 'purple', '🎯')}
      ${statCard("O'quvchiga aylangan", wonLeads, 'green', '✅')}
      ${statCard('Konversiya', conv + '%', 'blue', '📈')}
      ${statCard("Yo'qotilgan lidlar", lostLeads, 'red', '📉')}
    </div>

    <div class="grid gap-5 lg:grid-cols-2 mb-5">
      <div class="bg-white rounded-xl border border-slate-200/80 p-5">
        <h3 class="font-bold mb-1">Tushum va xarajat</h3>
        <p class="text-xs text-slate-400 mb-4">Oxirgi 6 oy · <span class="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 align-middle"></span> tushum · <span class="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400 align-middle"></span> xarajat</p>
        <div class="flex items-end gap-3 h-44">
          ${months.map((m) => `
            <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div class="w-full flex items-end justify-center gap-1 flex-1">
                <div class="w-2/5 bg-emerald-500 rounded-t" style="height:${(m.income / maxVal) * 100}%" title="Tushum: ${fmtMoney(m.income)}"></div>
                <div class="w-2/5 bg-orange-400 rounded-t" style="height:${(m.expense / maxVal) * 100}%" title="Xarajat: ${fmtMoney(m.expense)}"></div>
              </div>
              <div class="text-[10px] text-slate-400 font-semibold">${m.label}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200/80 p-5">
        <h3 class="font-bold mb-1">Yangi o'quvchilar dinamikasi</h3>
        <p class="text-xs text-slate-400 mb-4">Oxirgi 6 oyda ro'yxatga olinganlar</p>
        <div class="space-y-2.5 pt-1">
          ${months.map((m) => bar(m.label, m.newStudents, Math.max(...months.map((x) => x.newStudents), 1), 'bg-slate-700', m.newStudents + ' ta')).join('')}
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200/80 p-5">
        <h3 class="font-bold mb-4">Lidlar manbalari</h3>
        ${bySource.length === 0 ? emptyState("Hozircha lidlar yo'q") : `
        <div class="space-y-2.5">
          ${bySource.map(([l, n]) => bar(l, n, maxSrc, 'bg-violet-500', n + ' ta')).join('')}
        </div>`}
      </div>

      <div class="bg-white rounded-xl border border-slate-200/80 p-5">
        <h3 class="font-bold mb-4">O'qituvchilar samaradorligi (joriy oy)</h3>
        ${teacherRows.length === 0 ? emptyState("O'qituvchilar yo'q") : `
        <table class="w-full text-sm">
          <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
            <th class="py-2 font-semibold">O'qituvchi</th><th class="py-2 font-semibold">Guruh</th>
            <th class="py-2 font-semibold">O'quvchi</th><th class="py-2 font-semibold text-right">Tushum</th><th class="py-2 font-semibold text-right">Ish haqi</th>
          </tr></thead>
          <tbody>
            ${teacherRows.map((t) => `<tr class="border-b border-slate-50">
              <td class="py-2.5 font-medium">${esc(t.name)}</td>
              <td class="py-2.5 text-slate-500">${t.groups}</td>
              <td class="py-2.5 text-slate-500">${t.students}</td>
              <td class="py-2.5 text-right font-semibold text-emerald-600">${fmtMoney(t.income)}</td>
              <td class="py-2.5 text-right font-semibold">${fmtMoney(t.salary)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;
}

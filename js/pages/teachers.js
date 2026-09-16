import { sb, run } from '../db.js';
import { $, $$, esc, formModal, confirmDialog, toast, fmtMoney, btnCls, emptyState } from '../ui.js';
import { currentUser } from '../app.js';

const canEdit = () => ['direktor', 'moliyachi'].includes(currentUser.role);

const ROLES = [
  { value: 'oqituvchi', label: "O'qituvchi" },
  { value: 'admin', label: 'Administrator' },
  { value: 'moliyachi', label: 'Moliyachi' },
  { value: 'menejer', label: 'Menejer' },
  { value: 'direktor', label: 'Direktor' },
];

const fields = (initial = {}) => [
  { name: 'first_name', label: 'Ism', required: true, value: initial.first_name },
  { name: 'last_name', label: 'Familiya', value: initial.last_name },
  { name: 'phone', label: 'Telefon', type: 'tel', placeholder: '+998...', value: initial.phone },
  { name: 'email', label: 'Login (email) — kirish uchun', type: 'email', placeholder: 'ism@finway.uz', value: initial.email },
  { name: 'login_password', label: initial.has_login ? "Parol (yangilash uchun — bo'sh qoldiring)" : "Parol (login berish uchun, kamida 6 belgi)", type: 'password', placeholder: '••••••••', full: true },
  { name: 'gender', label: 'Jinsi', type: 'select', placeholder: 'Tanlang', options: [{ value: 'erkak', label: 'Erkak' }, { value: 'ayol', label: 'Ayol' }], value: initial.gender },
  { name: 'birth_date', label: "Tug'ilgan sana", type: 'date', value: initial.birth_date },
  { name: 'role', label: 'Vazifasi', type: 'select', options: ROLES, value: initial.role || 'oqituvchi' },
  { name: 'salary_type', label: 'Ish haqi turi', type: 'select', options: [{ value: 'foizga', label: 'Foizga' }, { value: 'fiks', label: 'Belgilangan oylik' }], value: initial.salary_type || 'foizga' },
  { name: 'percent', label: 'Oladigan foizi (%)', type: 'number', step: '5', value: initial.percent ?? 50 },
  { name: 'salary', label: 'Oylik (fiks bo\'lsa)', type: 'money', value: initial.salary ?? 0 },
  { name: 'active', label: 'Holati', type: 'checkbox', checkboxLabel: 'Faol xodim', value: initial.active ?? true, full: true },
];

// login/parol ustunlari employees jadvalida yo'q — insert/update oldidan ajratamiz
const EMP_COLS = ['first_name', 'last_name', 'phone', 'email', 'gender', 'birth_date', 'role', 'salary_type', 'percent', 'salary', 'active'];
const pickEmp = (v) => Object.fromEntries(Object.entries(v).filter(([k]) => EMP_COLS.includes(k)));

// staff edge funksiyasi (auth user yaratish/parol/o'chirish)
async function staffCall(payload) {
  try {
    const { data, error } = await sb.functions.invoke('staff', { body: payload });
    if (error) return { ok: false, message: error.message };
    return data;
  } catch (e) { return { ok: false, message: String(e?.message || e) }; }
}

export async function render(container) {
  const [employees, groups, payments] = await Promise.all([
    run(sb.from('employees').select('*').order('created_at', { ascending: false })),
    run(sb.from('groups').select('id,teacher_id').eq('status', 'aktiv')),
    run(sb.from('payments').select('amount,paid_at,group_id')),
  ]);

  const monthStart = new Date(); monthStart.setDate(1);
  const monthPays = payments.filter((p) => new Date(p.paid_at) >= monthStart);
  const earned = (emp) => {
    if (emp.role !== 'oqituvchi') return null;
    if (emp.salary_type === 'fiks') return Number(emp.salary) || 0;
    const gids = groups.filter((g) => g.teacher_id === emp.id).map((g) => g.id);
    const sum = monthPays.filter((p) => gids.includes(p.group_id)).reduce((a, p) => a + Number(p.amount), 0);
    return sum * (Number(emp.percent) || 0) / 100;
  };

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div class="text-sm text-slate-500">Jami: <b>${employees.length}</b> ta xodim (${employees.filter((e) => e.active).length} faol)</div>
      ${canEdit() ? `<button id="addEmp" class="${btnCls.primary}">+ Xodim qo'shish</button>` : ''}
    </div>
    <div class="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
      <table class="w-full text-sm min-w-[720px]">
        <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
          <th class="px-5 py-3 font-semibold">F.I.O</th><th class="px-4 py-3 font-semibold">Telefon</th>
          <th class="px-4 py-3 font-semibold">Vazifasi</th><th class="px-4 py-3 font-semibold">Ish haqi</th>
          <th class="px-4 py-3 font-semibold">Guruhlari</th><th class="px-4 py-3 font-semibold">Joriy oy hisoblangan</th>
          <th class="px-4 py-3 font-semibold">Login</th><th class="px-4 py-3 font-semibold">Holati</th><th></th>
        </tr></thead>
        <tbody>
          ${employees.map((e) => {
            const cnt = groups.filter((g) => g.teacher_id === e.id).length;
            const pay = earned(e);
            return `<tr class="border-b border-slate-50 hover:bg-slate-50/60">
              <td class="px-5 py-3 font-semibold">${esc(e.first_name)} ${esc(e.last_name)}</td>
              <td class="px-4 py-3 text-slate-500">${esc(e.phone || '—')}</td>
              <td class="px-4 py-3"><span class="text-xs font-semibold px-2.5 py-1 rounded-lg ${e.role === 'oqituvchi' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}">${esc(ROLES.find((r) => r.value === e.role)?.label || e.role)}</span></td>
              <td class="px-4 py-3 text-slate-500">${e.salary_type === 'fiks' ? fmtMoney(e.salary) + '/oy' : (e.percent || 0) + '%'}</td>
              <td class="px-4 py-3 text-slate-500">${e.role === 'oqituvchi' ? cnt + ' ta' : '—'}</td>
              <td class="px-4 py-3 font-semibold ${pay ? 'text-emerald-600' : 'text-slate-400'}">${pay === null ? '—' : fmtMoney(pay)}</td>
              <td class="px-4 py-3">${e.has_login ? '<span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">✓ Bor</span>' : '<span class="text-xs text-slate-400">—</span>'}</td>
              <td class="px-4 py-3">${e.active ? '<span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">Faol</span>' : '<span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500">Nofaol</span>'}</td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                ${canEdit() ? `<button data-pass="${e.id}" class="${btnCls.iconEdit}" title="Login/parol o'rnatish">🔑</button>
                <button data-edit="${e.id}" class="${btnCls.iconEdit}">✏️</button>
                <button data-del="${e.id}" class="${btnCls.iconDel}">🗑</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${employees.length === 0 ? emptyState("Xodimlar yo'q — birinchi xodimni qo'shing") : ''}
    </div>
    <p class="text-xs text-slate-400 mt-3">* «Joriy oy hisoblangan» — foizga ishlaydigan o'qituvchi uchun: uning guruhlariga shu oyda tushgan to'lovlar × foiz.</p>`;

  if ($('#addEmp', container)) $('#addEmp', container).onclick = async () => {
    const v = await formModal("Yangi xodim qo'shish", fields(), {}, { wide: true });
    if (!v) return;
    const pass = String(v.login_password || '').trim();
    const email = String(v.email || '').trim().toLowerCase();
    const [row] = await run(sb.from('employees').insert(pickEmp(v)).select());
    // Login berilsa — auth user yaratamiz
    if (email && pass) {
      if (pass.length < 6) { toast("Login yaratilmadi: parol kamida 6 belgi bo'lsin", 'error'); }
      else {
        const r = await staffCall({ action: 'create', employee_id: row.id, email, password: pass });
        if (!r?.ok) toast('Xodim qo\'shildi, lekin login yaratilmadi: ' + (r?.message || ''), 'error');
        else toast("Xodim va login qo'shildi");
      }
    } else {
      toast("Xodim qo'shildi");
    }
    render(container);
  };
  $$('[data-edit]', container).forEach((b) => b.onclick = async () => {
    const e = employees.find((x) => x.id === b.dataset.edit);
    const v = await formModal('Xodimni tahrirlash', fields(e), {}, { wide: true });
    if (!v) return;
    const pass = String(v.login_password || '').trim();
    const email = String(v.email || '').trim().toLowerCase();
    await run(sb.from('employees').update(pickEmp(v)).eq('id', e.id));
    // Parol kiritilgan bo'lsa — login yaratamiz/yangilaymiz
    if (pass) {
      if (pass.length < 6) { toast("Parol saqlanmadi: kamida 6 belgi", 'error'); }
      else {
        const r = await staffCall({ action: e.has_login ? 'set-password' : 'create', employee_id: e.id, auth_uid: e.auth_uid || undefined, email, password: pass });
        if (!r?.ok) toast('Saqlandi, lekin login/parol o\'rnatilmadi: ' + (r?.message || ''), 'error');
        else toast('Saqlandi ✓ login yangilandi');
      }
    } else {
      toast('Saqlandi');
    }
    render(container);
  });
  $$('[data-pass]', container).forEach((b) => b.onclick = async () => {
    const e = employees.find((x) => x.id === b.dataset.pass);
    const v = await formModal(`Login / parol — ${e.first_name} ${e.last_name || ''}`, [
      { name: 'email', label: 'Login (email)', type: 'email', required: true, placeholder: 'ism@finway.uz', value: e.email, full: true },
      { name: 'password', label: 'Yangi parol (kamida 6 belgi)', type: 'password', required: true, placeholder: '••••••••', full: true },
    ]);
    if (!v) return;
    const email = String(v.email || '').trim().toLowerCase();
    const password = String(v.password || '').trim();
    if (password.length < 6) { toast("Parol kamida 6 belgi bo'lsin", 'error'); return; }
    const r = await staffCall({ action: e.has_login ? 'set-password' : 'create', employee_id: e.id, auth_uid: e.auth_uid || undefined, email, password });
    if (!r?.ok) { toast('Xato: ' + (r?.message || ''), 'error'); return; }
    toast(`✓ ${email} logini o'rnatildi`);
    render(container);
  });
  $$('[data-del]', container).forEach((b) => b.onclick = async () => {
    if (!(await confirmDialog("Xodim o'chiriladi. Davom etasizmi?"))) return;
    const e = employees.find((x) => x.id === b.dataset.del);
    if (e?.has_login || e?.auth_uid) await staffCall({ action: 'remove', employee_id: e.id, auth_uid: e.auth_uid || undefined, email: e.email || undefined });
    await run(sb.from('employees').delete().eq('id', b.dataset.del));
    toast("O'chirildi"); render(container);
  });
}

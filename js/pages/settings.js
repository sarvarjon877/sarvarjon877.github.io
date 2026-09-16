import { sb, run } from '../db.js';
import { $, $$, esc, formModal, confirmDialog, toast, btnCls } from '../ui.js';
import { currentUser } from '../app.js';

export async function render(container) {
  const [settings, branches, rooms, courses] = await Promise.all([
    run(sb.from('settings').select('*').single()),
    run(sb.from('branches').select('*').order('created_at')),
    run(sb.from('rooms').select('*, branches(name)').order('name')),
    run(sb.from('courses').select('*').order('name')),
  ]);

  const section = (title, addId, rowsHtml) => `
    <div class="bg-white rounded-xl border border-slate-200/80 p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold">${title}</h3>
        <button id="${addId}" class="${btnCls.ghost}">+ Qo'shish</button>
      </div>
      <div class="space-y-1.5">${rowsHtml || '<div class="text-xs text-slate-400 py-3">Bo\'sh</div>'}</div>
    </div>`;

  const row = (label, editAttr, delAttr, id) => `
    <div class="flex items-center justify-between py-2 px-3 rounded-lg border border-slate-100 text-sm">
      <span class="font-medium">${label}</span>
      <div class="shrink-0">
        <button ${editAttr}="${id}" class="${btnCls.iconEdit}">✏️</button>
        <button ${delAttr}="${id}" class="${btnCls.iconDel}">🗑</button>
      </div>
    </div>`;

  container.innerHTML = `
    <div class="grid gap-5 lg:grid-cols-2">
      <div class="bg-white rounded-xl border border-slate-200/80 p-5 lg:col-span-2">
        <h3 class="font-bold mb-3">Markaz ma'lumotlari</h3>
        <form id="centerForm" class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-[220px]">
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">O'quv markazi nomi</label>
            <input name="center_name" value="${esc(settings.center_name || '')}" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <button class="${btnCls.primary}">Saqlash</button>
        </form>
      </div>

      ${section('Filiallar', 'addBranch', branches.map((b) => row(esc(b.name), 'data-eb', 'data-db', b.id)).join(''))}
      ${section('Xonalar', 'addRoom', rooms.map((r) => row(`${esc(r.name)} <span class="text-xs text-slate-400">(${r.capacity} kishi · ${esc(r.branches?.name || '')})</span>`, 'data-er', 'data-dr', r.id)).join(''))}
      ${section('Kurslar', 'addCourse', courses.map((c) => row(`${esc(c.name)} ${c.description ? `<span class="text-xs text-slate-400">— ${esc(c.description)}</span>` : ''}`, 'data-ec', 'data-dc', c.id)).join(''))}

      <div class="bg-white rounded-xl border border-slate-200/80 p-5">
        <h3 class="font-bold mb-3">Kirish hisoblari (rollar)</h3>
        <div class="text-sm text-slate-600 space-y-2">
          <p class="text-xs text-slate-500 mb-1">Kirishda bo'lim tanlanadi — har bir bo'limning o'z paroli bor:</p>
          <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
            <span><b>👑 Direktor</b> — to'liq dostup</span>${currentUser.role === 'direktor' ? '<code class="text-xs text-slate-500">Sevara877</code>' : ''}
          </div>
          <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
            <span><b>💰 Moliyachi</b> — to'liq dostup</span>${currentUser.role === 'direktor' ? '<code class="text-xs text-slate-500">Isroiljon877</code>' : ''}
          </div>
          <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
            <span><b>🛎 Administrator</b> — moliyasiz</span>${currentUser.role === 'direktor' ? '<code class="text-xs text-slate-500">Admin877</code>' : ''}
          </div>
          <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
            <span><b>🧑‍🏫 O'qituvchi</b> — darslar va davomat</span>${currentUser.role === 'direktor' ? '<code class="text-xs text-slate-500">Ustoz877</code>' : ''}
          </div>
          <p class="text-xs text-slate-400 pt-1">Direktor va Moliyachi hammasini ko'radi. Administrator pulga oid hech narsani ko'rmaydi (to'lovlar, balans, narxlar, hisobotlar yashirin). O'qituvchi faqat o'quvchilar, guruhlar va davomatni ko'radi. Parollar faqat direktorga ko'rinadi.</p>
        </div>
      </div>

      ${currentUser.role === 'direktor' ? `
      <div class="bg-white rounded-xl border border-slate-200/80 p-5 lg:col-span-2">
        <h3 class="font-bold mb-1">📩 SMS (Eskiz.uz)</h3>
        <p class="text-xs text-slate-500 mb-4">Kirish kodi, qarzdorlik va davomat SMS'lari. Token kiritilmasa <b>TEST rejimi</b> (kod ekranda ko'rinadi, SMS ketmaydi). Maxfiylik uchun joriy qiymatlar ko'rsatilmaydi — o'zgartirish uchun qaytadan kiriting.</p>
        <form id="smsForm" class="grid sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">Eskiz email</label>
            <input name="email" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="email@example.com">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">Eskiz parol</label>
            <input name="password" type="password" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="••••••••">
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">Yoki API token (ixtiyoriy — email/parol o'rniga)</label>
            <input name="token" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="eyJ...">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">Sender nomi</label>
            <input name="sender" value="4546" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Finway yoki 4546">
          </div>
          <div class="flex items-end">
            <label class="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="enabled" class="w-4 h-4 accent-blue-600"> Real SMS yoqilsin (test rejimidan chiqish)</label>
          </div>
          <div class="sm:col-span-2 border-t border-slate-100 pt-3 mt-1">
            <label class="inline-flex items-center gap-2 text-sm font-medium mb-3"><input type="checkbox" name="staff_otp" ${settings.staff_otp ? 'checked' : ''} class="w-4 h-4 accent-blue-600"> Xodimlar kirishida ham SMS kod (2 bosqichli)</label>
            <div class="grid sm:grid-cols-2 gap-3">
              ${[['direktor', 'Direktor'], ['moliyachi', 'Moliyachi'], ['admin', 'Administrator'], ['oqituvchi', "O'qituvchi"]].map(([k, l]) => `
                <div>
                  <label class="block text-xs font-semibold text-slate-500 mb-1.5">${l} telefoni (kod shu raqamga)</label>
                  <input name="phone_${k}" value="${esc(settings[`phone_${k}`] || '')}" inputmode="tel" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="+998 90 123 45 67">
                </div>`).join('')}
            </div>
          </div>
          <div class="sm:col-span-2">
            <button class="${btnCls.primary}">SMS sozlamalarini saqlash</button>
          </div>
        </form>
      </div>` : ''}
    </div>`;

  $('#centerForm', container).onsubmit = async (e) => {
    e.preventDefault();
    await run(sb.from('settings').update({ center_name: new FormData(e.target).get('center_name') }).eq('id', 1));
    toast('Saqlandi — sahifani yangilang');
  };

  // Filiallar
  $('#addBranch', container).onclick = async () => {
    const v = await formModal('Yangi filial', [{ name: 'name', label: 'Nomi', required: true, full: true }]);
    if (!v) return; await run(sb.from('branches').insert(v)); toast("Qo'shildi"); render(container);
  };
  $$('[data-eb]', container).forEach((b) => b.onclick = async () => {
    const x = branches.find((i) => i.id === b.dataset.eb);
    const v = await formModal('Filialni tahrirlash', [{ name: 'name', label: 'Nomi', required: true, full: true }], x);
    if (!v) return; await run(sb.from('branches').update(v).eq('id', x.id)); toast('Saqlandi'); render(container);
  });
  $$('[data-db]', container).forEach((b) => b.onclick = async () => {
    if (!(await confirmDialog("Filial va unga tegishli xonalar o'chiriladi. Davom etasizmi?"))) return;
    await run(sb.from('branches').delete().eq('id', b.dataset.db)); toast("O'chirildi"); render(container);
  });

  // Xonalar
  const roomFields = (i = {}) => [
    { name: 'name', label: 'Nomi', required: true, value: i.name },
    { name: 'capacity', label: "Sig'imi", type: 'number', value: i.capacity ?? 14 },
    { name: 'branch_id', label: 'Filial', type: 'select', required: true, placeholder: 'Tanlang', options: branches.map((br) => ({ value: br.id, label: br.name })), value: i.branch_id },
  ];
  $('#addRoom', container).onclick = async () => {
    const v = await formModal('Yangi xona', roomFields());
    if (!v) return; await run(sb.from('rooms').insert(v)); toast("Qo'shildi"); render(container);
  };
  $$('[data-er]', container).forEach((b) => b.onclick = async () => {
    const x = rooms.find((i) => i.id === b.dataset.er);
    const v = await formModal('Xonani tahrirlash', roomFields(x));
    if (!v) return; await run(sb.from('rooms').update(v).eq('id', x.id)); toast('Saqlandi'); render(container);
  });
  $$('[data-dr]', container).forEach((b) => b.onclick = async () => {
    if (!(await confirmDialog("Xona o'chiriladi. Davom etasizmi?"))) return;
    await run(sb.from('rooms').delete().eq('id', b.dataset.dr)); toast("O'chirildi"); render(container);
  });

  // Kurslar
  const courseFields = (i = {}) => [
    { name: 'name', label: 'Nomi', required: true, value: i.name },
    { name: 'description', label: 'Tavsif', value: i.description },
  ];
  $('#addCourse', container).onclick = async () => {
    const v = await formModal('Yangi kurs', courseFields());
    if (!v) return; await run(sb.from('courses').insert(v)); toast("Qo'shildi"); render(container);
  };
  $$('[data-ec]', container).forEach((b) => b.onclick = async () => {
    const x = courses.find((i) => i.id === b.dataset.ec);
    const v = await formModal('Kursni tahrirlash', courseFields(x));
    if (!v) return; await run(sb.from('courses').update(v).eq('id', x.id)); toast('Saqlandi'); render(container);
  });
  $$('[data-dc]', container).forEach((b) => b.onclick = async () => {
    if (!(await confirmDialog("Kurs o'chiriladi. Davom etasizmi?"))) return;
    await run(sb.from('courses').delete().eq('id', b.dataset.dc)); toast("O'chirildi"); render(container);
  });

  // SMS sozlamalari (faqat direktor)
  const smsForm = $('#smsForm', container);
  if (smsForm) smsForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    // sms_config — faqat to'ldirilgan maxfiy maydonlar (bo'shini yozib yubormaymiz)
    const cfg = { provider: 'eskiz', enabled: fd.get('enabled') === 'on', sender: (fd.get('sender') || '4546').trim() };
    const email = (fd.get('email') || '').trim();
    const password = (fd.get('password') || '').trim();
    const token = (fd.get('token') || '').trim();
    if (email) cfg.email = email;
    if (password) cfg.password = password;
    if (token) cfg.token = token;
    await run(sb.from('sms_config').update(cfg).eq('id', 1));
    // settings — xodim OTP va rol telefonlari
    const norm = (v) => { const d = String(v || '').replace(/\D/g, ''); return d ? (d.length === 9 ? '+998' + d : '+' + d) : null; };
    await run(sb.from('settings').update({
      staff_otp: fd.get('staff_otp') === 'on',
      phone_direktor: norm(fd.get('phone_direktor')),
      phone_moliyachi: norm(fd.get('phone_moliyachi')),
      phone_admin: norm(fd.get('phone_admin')),
      phone_oqituvchi: norm(fd.get('phone_oqituvchi')),
    }).eq('id', 1));
    toast(cfg.enabled ? 'SMS sozlandi — real rejim yoqildi' : 'SMS sozlandi (test rejimi)');
    render(container);
  };
}

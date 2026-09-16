// Bot & Xavfsizlik — Telegram bot, OTP kirish tizimi va raqamlar boshqaruvi.
// Bo'limlar: Holat (statistika) · Ulanganlar · Kirish loglari · Xavfsizlik (blok).
import { sb, run } from '../db.js';
import { $, $$, esc, toast, formModal, confirmDialog, btnCls, emptyState, statCard, fmtDate } from '../ui.js';

let tab = 'status';

// Telefonni 998XXXXXXXXX ko'rinishiga (send-otp bilan bir xil) keltiradi
function norm(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  if (d.startsWith('8') && d.length === 12) d = '998' + d.slice(1);
  return d;
}
const fmtPhone = (p) => {
  const d = norm(p);
  if (d.length === 12) return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  return p || '—';
};
const fmtDT = (t) => {
  if (!t) return '—';
  const d = new Date(t);
  return `${fmtDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const STATUS_BADGE = {
  telegram: ['📲 Telegram', 'bg-sky-50 text-sky-700'],
  yuborildi: ['📩 SMS', 'bg-emerald-50 text-emerald-700'],
  test: ['🧪 Test', 'bg-amber-50 text-amber-700'],
  xato: ['❌ Xato', 'bg-rose-50 text-rose-700'],
};
const badge = (s) => { const b = STATUS_BADGE[s] || [s || '—', 'bg-slate-100 text-slate-600']; return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-lg ${b[1]}">${esc(b[0])}</span>`; };

export async function render(container) {
  container.innerHTML = '<div class="text-slate-400 text-sm py-10 text-center">Yuklanmoqda...</div>';

  const [settingsRow, cfgRow] = await Promise.all([
    sb.from('settings').select('telegram_bot, center_name').maybeSingle().then((r) => r.data).catch(() => null),
    sb.from('sms_config').select('enabled, provider').eq('id', 1).maybeSingle().then((r) => r.data).catch(() => null),
  ]);
  const [linked, logs, otps, blocked] = await Promise.all([
    run(sb.from('students').select('id,first_name,last_name,phone,telegram_chat_id').not('telegram_chat_id', 'is', null).order('first_name')),
    run(sb.from('sms_log').select('phone,type,status,created_at').order('created_at', { ascending: false }).limit(40)),
    run(sb.from('otp_codes').select('phone,attempts,used,created_at').gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()).order('created_at', { ascending: false })),
    run(sb.from('blocked_numbers').select('*').order('created_at', { ascending: false })),
  ]);

  const botName = settingsRow?.telegram_bot || '—';
  const tgReady = !!settingsRow?.telegram_bot;
  const smsOn = !!cfgRow?.enabled;
  const codesToday = otps.filter((o) => new Date(o.created_at) >= new Date(new Date().setHours(0, 0, 0, 0))).length;
  const suspicious = otps.filter((o) => (o.attempts || 0) >= 3);

  const TABS = [
    { id: 'status', label: '📊 Holat' },
    { id: 'linked', label: `📲 Ulanganlar (${linked.length})` },
    { id: 'logs', label: '📜 Kirish loglari' },
    { id: 'security', label: `🛡 Xavfsizlik${blocked.length ? ' (' + blocked.length + ')' : ''}` },
  ];

  container.innerHTML = `
    <div class="flex flex-wrap items-center gap-1.5 mb-5">
      ${TABS.map((t) => `<button data-tab="${t.id}" class="px-3.5 py-2 rounded-lg text-sm font-semibold border">${t.label}</button>`).join('')}
      <div class="ml-auto"><button id="addNum" class="${btnCls.primary}">+ Raqam qo'shish</button></div>
    </div>
    <div id="body"></div>`;

  const paintTabs = () => $$('[data-tab]', container).forEach((b) => {
    const on = b.dataset.tab === tab;
    b.className = `px-3.5 py-2 rounded-lg text-sm font-semibold border ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50'}`;
  });

  const draw = () => {
    paintTabs();
    const body = $('#body', container);

    if (tab === 'status') {
      body.innerHTML = `
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-5">
          ${statCard('Telegram bot', botName === '—' ? '—' : '@' + esc(botName), 'cyan', '🤖')}
          ${statCard('Telegram xabar', tgReady ? 'Faol' : 'Ulanmagan', tgReady ? 'green' : 'red', '📲')}
          ${statCard('SMS (Eskiz)', smsOn ? 'Yoqilgan' : 'O\'chirilgan', smsOn ? 'green' : 'slate', '📩')}
          ${statCard('Ulangan o\'quvchilar', linked.length, 'blue', '🔗')}
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          ${statCard('Bugungi kodlar', codesToday, 'purple', '🔑')}
          ${statCard('24 soatda so\'rov', otps.length, 'slate', '⏱')}
          ${statCard('Shubhali urinish', suspicious.length, suspicious.length ? 'orange' : 'slate', '⚠️')}
          ${statCard('Bloklangan', blocked.length, blocked.length ? 'red' : 'slate', '🚫')}
        </div>
        <div class="mt-5 bg-white rounded-xl border border-slate-200/80 p-4 text-sm text-slate-500 leading-relaxed">
          <div class="font-semibold text-slate-700 mb-1">Kirish tizimi qanday ishlaydi</div>
          O'quvchi «Men o'quvchiman» → telefon raqamini kiritadi → 6 xonali kod yuboriladi:
          <b>Telegram</b>ga (agar botga ulangan bo'lsa), aks holda <b>SMS</b>ga, ikkalasi ham yo'q bo'lsa <b>sinov rejimi</b>da ekranda ko'rinadi.
          Ulanish uchun o'quvchi <b>@${esc(botName)}</b> botiga Start bosib telefon raqamini ulashadi.
        </div>`;
    }

    else if (tab === 'linked') {
      body.innerHTML = linked.length === 0
        ? `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState('Hali hech kim Telegram\'ga ulanmagan')}</div>`
        : `<div class="bg-white rounded-xl border border-slate-200/80 overflow-x-auto"><table class="w-full text-sm min-w-[520px]">
            <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
              <th class="px-5 py-3 font-semibold">O'quvchi</th><th class="px-4 py-3 font-semibold">Telefon</th>
              <th class="px-4 py-3 font-semibold">Chat ID</th><th></th></tr></thead>
            <tbody>${linked.map((s) => `<tr class="border-b border-slate-50 hover:bg-slate-50/60">
              <td class="px-5 py-3 font-semibold">${esc(s.first_name)} ${esc(s.last_name || '')}</td>
              <td class="px-4 py-3 text-slate-500">${esc(fmtPhone(s.phone))}</td>
              <td class="px-4 py-3 text-slate-400 text-xs">${esc(s.telegram_chat_id)}</td>
              <td class="px-4 py-3 text-right"><button data-unlink="${s.id}" class="${btnCls.ghost} text-rose-600">Uzish</button></td>
            </tr>`).join('')}</tbody></table></div>`;
    }

    else if (tab === 'logs') {
      body.innerHTML = logs.length === 0
        ? `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState('Loglar yo\'q')}</div>`
        : `<div class="bg-white rounded-xl border border-slate-200/80 overflow-x-auto"><table class="w-full text-sm min-w-[560px]">
            <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
              <th class="px-5 py-3 font-semibold">Telefon</th><th class="px-4 py-3 font-semibold">Turi</th>
              <th class="px-4 py-3 font-semibold">Holat</th><th class="px-4 py-3 font-semibold">Vaqt</th></tr></thead>
            <tbody>${logs.map((l) => `<tr class="border-b border-slate-50 hover:bg-slate-50/60">
              <td class="px-5 py-3 font-medium text-slate-700">${esc(fmtPhone(l.phone))}</td>
              <td class="px-4 py-3 text-slate-500">${esc(l.type === 'login' ? 'Kirish kodi' : l.type)}</td>
              <td class="px-4 py-3">${badge(l.status)}</td>
              <td class="px-4 py-3 text-slate-400 text-xs">${esc(fmtDT(l.created_at))}</td>
            </tr>`).join('')}</tbody></table></div>
          <p class="text-xs text-slate-400 mt-3">Oxirgi 40 ta yozuv. «Telegram» — kod botga bordi; «SMS» — SMS orqali; «Test» — kanal yo'q, kod ekranda; «Xato» — yuborilmadi.</p>`;
    }

    else if (tab === 'security') {
      body.innerHTML = `
        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="text-sm font-bold text-slate-600">🚫 Bloklangan raqamlar</div>
          <button id="addBlock" class="${btnCls.ghost}">+ Raqam bloklash</button>
        </div>
        ${blocked.length === 0
          ? `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState('Bloklangan raqam yo\'q')}</div>`
          : `<div class="bg-white rounded-xl border border-slate-200/80 overflow-x-auto mb-6"><table class="w-full text-sm min-w-[480px]">
              <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                <th class="px-5 py-3 font-semibold">Telefon</th><th class="px-4 py-3 font-semibold">Sabab</th>
                <th class="px-4 py-3 font-semibold">Sana</th><th></th></tr></thead>
              <tbody>${blocked.map((b) => `<tr class="border-b border-slate-50">
                <td class="px-5 py-3 font-medium">${esc(fmtPhone(b.phone))}</td>
                <td class="px-4 py-3 text-slate-500">${esc(b.reason || '—')}</td>
                <td class="px-4 py-3 text-slate-400 text-xs">${esc(fmtDT(b.created_at))}</td>
                <td class="px-4 py-3 text-right"><button data-unblock="${esc(b.phone)}" class="${btnCls.ghost}">Blokdan chiqarish</button></td>
              </tr>`).join('')}</tbody></table></div>`}
        <div class="text-sm font-bold text-slate-600 mb-3">⚠️ Shubhali urinishlar (24 soat, 3+ xato kod)</div>
        ${suspicious.length === 0
          ? `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState('Shubhali urinish yo\'q')}</div>`
          : `<div class="bg-white rounded-xl border border-slate-200/80 overflow-x-auto"><table class="w-full text-sm min-w-[480px]">
              <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                <th class="px-5 py-3 font-semibold">Telefon</th><th class="px-4 py-3 font-semibold">Xato urinish</th>
                <th class="px-4 py-3 font-semibold">Vaqt</th><th></th></tr></thead>
              <tbody>${suspicious.map((o) => `<tr class="border-b border-slate-50">
                <td class="px-5 py-3 font-medium">${esc(fmtPhone(o.phone))}</td>
                <td class="px-4 py-3"><span class="font-bold text-rose-600">${o.attempts}</span></td>
                <td class="px-4 py-3 text-slate-400 text-xs">${esc(fmtDT(o.created_at))}</td>
                <td class="px-4 py-3 text-right"><button data-block="${esc(o.phone)}" class="${btnCls.ghost} text-rose-600">Bloklash</button></td>
              </tr>`).join('')}</tbody></table></div>`}`;
    }

    bindActions();
  };

  const blockNumber = async (phone, reason) => {
    await run(sb.from('blocked_numbers').upsert({ phone: norm(phone), reason: reason || null }, { onConflict: 'phone' }));
    toast('Raqam bloklandi'); render(container);
  };

  function bindActions() {
    $$('[data-unlink]', container).forEach((b) => b.onclick = async () => {
      if (!(await confirmDialog('Bu o\'quvchining Telegram ulanishi uziladi. Davom etasizmi?'))) return;
      await run(sb.from('students').update({ telegram_chat_id: null, tg_link_code: null }).eq('id', b.dataset.unlink));
      toast('Uzildi'); render(container);
    });
    $$('[data-unblock]', container).forEach((b) => b.onclick = async () => {
      await run(sb.from('blocked_numbers').delete().eq('phone', b.dataset.unblock));
      toast('Blokdan chiqarildi'); render(container);
    });
    $$('[data-block]', container).forEach((b) => b.onclick = async () => {
      if (!(await confirmDialog(`${fmtPhone(b.dataset.block)} raqami bloklanadi. Davom etasizmi?`))) return;
      blockNumber(b.dataset.block, 'Shubhali urinishlar');
    });
    const ab = $('#addBlock', container);
    if (ab) ab.onclick = async () => {
      const v = await formModal('Raqamni bloklash', [
        { name: 'phone', label: 'Telefon', type: 'tel', required: true, full: true },
        { name: 'reason', label: 'Sabab (ixtiyoriy)', type: 'text', full: true },
      ]);
      if (!v) return;
      if (norm(v.phone).length !== 12) return toast('Telefon raqami noto\'g\'ri', 'error');
      blockNumber(v.phone, v.reason);
    };
  }

  $$('[data-tab]', container).forEach((b) => b.onclick = () => { tab = b.dataset.tab; draw(); });
  $('#addNum', container).onclick = async () => {
    const v = await formModal("Raqam qo'shish (yangi o'quvchi)", [
      { name: 'first_name', label: 'Ism', required: true },
      { name: 'last_name', label: 'Familiya' },
      { name: 'phone', label: 'Telefon', type: 'tel', required: true, full: true },
    ], {}, { wide: false });
    if (!v) return;
    if (norm(v.phone).length !== 12) return toast('Telefon raqami noto\'g\'ri', 'error');
    await run(sb.from('students').insert({ first_name: v.first_name, last_name: v.last_name, phone: '+' + norm(v.phone), status: 'aktiv', deal_amount: 0, coins: 0 }));
    toast('Raqam (o\'quvchi) qo\'shildi ✅'); render(container);
  };

  draw();
}

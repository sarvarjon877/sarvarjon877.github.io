// Xodimlar uchun sovg'a so'rovlari: o'quvchilar coinga almashtirgan sovg'alarni
// ko'rish va "berildi" deb belgilash.
import { sb, run } from '../db.js';
import { $, $$, esc, fmtDate, toast, emptyState, confirmDialog } from '../ui.js';

const ST = {
  kutilmoqda: ['Kutilmoqda', 'bg-amber-50 text-amber-700'],
  berildi: ['Berildi', 'bg-emerald-50 text-emerald-700'],
  rad: ['Rad etildi', 'bg-rose-50 text-rose-600'],
};

let tab = 'kutilmoqda';

export async function render(container) {
  const [reqs, students] = await Promise.all([
    run(sb.from('reward_requests').select('*').order('created_at', { ascending: false })),
    run(sb.from('students').select('id,first_name,last_name,phone,coins')),
  ]);
  const sOf = (id) => students.find((s) => s.id === id);

  const counts = { kutilmoqda: 0, berildi: 0, rad: 0 };
  reqs.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

  container.innerHTML = `
    <div class="flex gap-1.5 mb-4 flex-wrap">
      ${Object.entries(ST).map(([v, [l]]) => `<button data-tab="${v}" class="px-3.5 py-1.5 rounded-full text-sm font-medium border">${l} (${counts[v] || 0})</button>`).join('')}
    </div>
    <div id="list"></div>`;

  const draw = () => {
    $$('[data-tab]', container).forEach((b) => {
      const on = b.dataset.tab === tab;
      b.className = `px-3.5 py-1.5 rounded-full text-sm font-medium border ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50'}`;
    });
    const list = reqs.filter((r) => r.status === tab);
    $('#list', container).innerHTML = list.length === 0 ? `<div class="bg-white rounded-xl border border-slate-200/80">${emptyState('So\'rovlar yo\'q')}</div>` : `
      <div class="bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-100">
        ${list.map((r) => {
          const s = sOf(r.student_id);
          return `<div class="px-4 py-3.5 flex items-center gap-3 flex-wrap">
            <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0">🎁</div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm">${esc(s ? s.first_name + ' ' + (s.last_name || '') : "O'quvchi")}</div>
              <div class="text-xs text-slate-500">${esc(r.reward_title || '')} · 🪙 ${r.cost} · ${fmtDate(r.created_at)}</div>
              ${s?.phone ? `<div class="text-[11px] text-slate-400">${esc(s.phone)}</div>` : ''}
            </div>
            ${r.status === 'kutilmoqda' ? `<div class="flex gap-1.5 shrink-0">
              <button data-give="${r.id}" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">✓ Berildi</button>
              <button data-reject="${r.id}" data-student="${r.student_id}" data-cost="${r.cost}" class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold">Rad</button>
            </div>` : `<span class="text-xs font-semibold px-2.5 py-1 rounded-lg ${ST[r.status][1]} shrink-0">${ST[r.status][0]}</span>`}
          </div>`;
        }).join('')}
      </div>`;

    $$('[data-give]', container).forEach((b) => b.onclick = async () => {
      await run(sb.from('reward_requests').update({ status: 'berildi' }).eq('id', b.dataset.give));
      toast('Sovg\'a berildi deb belgilandi'); render(container);
    });
    $$('[data-reject]', container).forEach((b) => b.onclick = async () => {
      if (!(await confirmDialog('So\'rovni rad etib, coinlarni o\'quvchiga qaytaramizmi?'))) return;
      const s = sOf(b.dataset.student);
      await run(sb.from('reward_requests').update({ status: 'rad' }).eq('id', b.dataset.reject));
      if (s) await run(sb.from('students').update({ coins: Number(s.coins || 0) + Number(b.dataset.cost) }).eq('id', s.id));
      toast('Rad etildi, coinlar qaytarildi'); render(container);
    });
  };

  $$('[data-tab]', container).forEach((b) => b.onclick = () => { tab = b.dataset.tab; draw(); });
  draw();
}

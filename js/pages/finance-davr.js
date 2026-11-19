// Moliya → Davr hisoboti.
//
// Ikki sana belgilanadi va o'sha oraliq uchun tushum, xarajat va sof foyda
// chiqadi: to'lov usullari va xarajat turlari bo'yicha, oylar kesimida.
// Yonida umumiy (boshidan buyon) raqamlar ham turadi — taqqoslash uchun.
import { sb, run } from '../db.js';
import { $, $$, esc, fmtMoney, statCard, emptyState } from '../ui.js';

const OYLAR = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

const USULLAR = { naqd: 'Naqd', karta: 'Karta', click: 'Click', payme: 'Payme', otkazma: "O'tkazma" };
// Xarajat turlari — Moliya sahifasidagi ro'yxat bilan bir xil
const TURLAR = {
  ijara: 'Ijara', oylik: 'Oyliklar', kommunal: 'Kommunal',
  reklama: 'Reklama', jihoz: 'Jihozlar', boshqa: 'Boshqa',
};

const iso = (d) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
};
const son = (n) => (Number(n) || 0);

/** Tayyor oraliqlar: tugma bosilganda sanalar shu yerdan olinadi. */
function oraliq(kalit) {
  const b = new Date();
  const yil = b.getFullYear();
  const oy = b.getMonth();
  if (kalit === 'bugun') return [iso(b), iso(b)];
  if (kalit === 'hafta') {
    const k = new Date(b);
    const kun = (b.getDay() + 6) % 7;          // dushanba = 0
    k.setDate(b.getDate() - kun);
    return [iso(k), iso(b)];
  }
  if (kalit === 'oy') return [iso(new Date(yil, oy, 1)), iso(b)];
  if (kalit === 'otgan') return [iso(new Date(yil, oy - 1, 1)), iso(new Date(yil, oy, 0))];
  if (kalit === 'uch') return [iso(new Date(yil, oy - 2, 1)), iso(b)];
  if (kalit === 'yil') return [iso(new Date(yil, 0, 1)), iso(b)];
  return [iso(new Date(yil, oy, 1)), iso(b)];
}

// Sahifa qayta chizilganda tanlov saqlanib qolsin
let holat = null;

/** Oraliqdagi yozuvlarni guruhlab, nomi bo'yicha jamlaydi. */
function jamla(rows, maydon, nomlar) {
  const map = new Map();
  rows.forEach((r) => {
    const k = r[maydon] || 'boshqa';
    map.set(k, (map.get(k) || 0) + son(r.amount));
  });
  return [...map.entries()]
    .map(([k, v]) => [nomlar[k] || k, v])
    .sort((a, b) => b[1] - a[1]);
}

/** Oyma-oy kesim (oraliq bir oydan uzun bo'lsa foydali). */
function oylarBoyicha(pays, exps) {
  const map = new Map();
  const qoy = (sana, kalit, qiymat) => {
    const k = String(sana).slice(0, 7);
    if (!map.has(k)) map.set(k, { tushum: 0, xarajat: 0 });
    map.get(k)[kalit] += son(qiymat);
  };
  pays.forEach((p) => qoy(p.paid_at, 'tushum', p.amount));
  exps.forEach((x) => qoy(x.spent_at, 'xarajat', x.amount));
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => {
      const [y, m] = k.split('-');
      return { nom: `${OYLAR[Number(m) - 1]} ${y}`, ...v, foyda: v.tushum - v.xarajat };
    });
}

function chiziq(nom, qiymat, eng, rang) {
  return `<div class="flex items-center gap-3 text-sm">
    <div class="w-32 shrink-0 text-slate-600 text-xs font-medium truncate">${esc(nom)}</div>
    <div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
      <div class="h-full ${rang} rounded-full" style="width:${Math.max((qiymat / eng) * 100, qiymat > 0 ? 3 : 0)}%"></div>
    </div>
    <div class="w-32 shrink-0 text-right text-xs font-bold text-slate-700">${fmtMoney(qiymat)}</div>
  </div>`;
}

export async function davrHisoboti(body) {
  body.innerHTML = '<div class="p-6 text-sm text-slate-400">Yuklanmoqda...</div>';

  // Hamma yozuv bir marta olinadi — oraliqni almashtirish shu zahoti ishlaydi
  const [pays, exps] = await Promise.all([
    run(sb.from('payments').select('amount, paid_at, method')),
    run(sb.from('expenses').select('amount, spent_at, category')),
  ]);

  if (!holat) {
    const [a, b] = oraliq('oy');
    holat = { from: a, to: b, kalit: 'oy' };
  }

  const chiz = () => {
    const { from, to } = holat;
    const p = pays.filter((x) => x.paid_at >= from && x.paid_at <= to);
    const e = exps.filter((x) => x.spent_at >= from && x.spent_at <= to);

    const tushum = p.reduce((a, x) => a + son(x.amount), 0);
    const xarajat = e.reduce((a, x) => a + son(x.amount), 0);
    const foyda = tushum - xarajat;

    const jamiTushum = pays.reduce((a, x) => a + son(x.amount), 0);
    const jamiXarajat = exps.reduce((a, x) => a + son(x.amount), 0);
    const jamiFoyda = jamiTushum - jamiXarajat;

    const usullar = jamla(p, 'method', USULLAR);
    const turlar = jamla(e, 'category', TURLAR);
    const engU = Math.max(...usullar.map(([, v]) => v), 1);
    const engT = Math.max(...turlar.map(([, v]) => v), 1);
    const oylar = oylarBoyicha(p, e);

    const kunlar = Math.max(Math.round((new Date(to) - new Date(from)) / 86400000) + 1, 1);
    const kunlikOrtacha = Math.round(tushum / kunlar);

    const tugma = (k, l) => `<button data-davr="${k}" class="px-3 py-1.5 rounded-full text-xs font-semibold border transition ${holat.kalit === k ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}">${l}</button>`;

    body.innerHTML = `
      <div class="p-5">
        <div class="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Boshlanishi</label>
            <input id="dFrom" type="date" value="${from}" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Tugashi</label>
            <input id="dTo" type="date" value="${to}" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="flex flex-wrap gap-1.5 pb-0.5">
            ${tugma('bugun', 'Bugun')}${tugma('hafta', 'Shu hafta')}${tugma('oy', 'Shu oy')}
            ${tugma('otgan', "O'tgan oy")}${tugma('uch', "3 oy")}${tugma('yil', 'Shu yil')}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          ${statCard('Tushum', `<span class="text-base">${fmtMoney(tushum)}</span>`, 'green', '📈')}
          ${statCard('Xarajat', `<span class="text-base">${fmtMoney(xarajat)}</span>`, 'orange', '📉')}
          ${statCard('Sof foyda', `<span class="text-base ${foyda < 0 ? 'text-rose-600' : ''}">${fmtMoney(foyda)}</span>`, foyda < 0 ? 'red' : 'blue', '🏦')}
          ${statCard(`Kunlik o'rtacha (${kunlar} kun)`, `<span class="text-base">${fmtMoney(kunlikOrtacha)}</span>`, 'cyan', '📅')}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <div class="rounded-xl border border-slate-200 p-4">
            <div class="text-sm font-bold text-slate-700 mb-3">To'lov usullari bo'yicha tushum</div>
            ${usullar.length ? `<div class="space-y-2">${usullar.map(([n, v]) => chiziq(n, v, engU, 'bg-emerald-500')).join('')}</div>`
              : '<div class="text-xs text-slate-400 py-3">Bu oraliqda to\'lov yo\'q</div>'}
            <div class="flex justify-between text-xs font-bold text-slate-700 mt-3 pt-3 border-t border-slate-100">
              <span>Jami</span><span>${fmtMoney(tushum)}</span>
            </div>
          </div>
          <div class="rounded-xl border border-slate-200 p-4">
            <div class="text-sm font-bold text-slate-700 mb-3">Xarajat turlari bo'yicha</div>
            ${turlar.length ? `<div class="space-y-2">${turlar.map(([n, v]) => chiziq(n, v, engT, 'bg-orange-500')).join('')}</div>`
              : '<div class="text-xs text-slate-400 py-3">Bu oraliqda xarajat yo\'q</div>'}
            <div class="flex justify-between text-xs font-bold text-slate-700 mt-3 pt-3 border-t border-slate-100">
              <span>Jami</span><span>${fmtMoney(xarajat)}</span>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 overflow-x-auto mb-5">
          <div class="px-4 py-3 text-sm font-bold text-slate-700 border-b border-slate-100">Oylar kesimida</div>
          ${oylar.length ? `<table class="w-full text-sm min-w-[520px]">
            <thead><tr class="text-left text-xs text-slate-400 border-b border-slate-100">
              <th class="px-4 py-2.5 font-semibold">Oy</th>
              <th class="px-4 py-2.5 font-semibold text-right">Tushum</th>
              <th class="px-4 py-2.5 font-semibold text-right">Xarajat</th>
              <th class="px-4 py-2.5 font-semibold text-right">Sof foyda</th>
            </tr></thead>
            <tbody>${oylar.map((o) => `<tr class="border-b border-slate-50">
              <td class="px-4 py-2.5 font-semibold text-slate-700">${esc(o.nom)}</td>
              <td class="px-4 py-2.5 text-right text-emerald-600 font-semibold">${fmtMoney(o.tushum)}</td>
              <td class="px-4 py-2.5 text-right text-orange-600 font-semibold">${fmtMoney(o.xarajat)}</td>
              <td class="px-4 py-2.5 text-right font-bold ${o.foyda < 0 ? 'text-rose-600' : 'text-slate-800'}">${fmtMoney(o.foyda)}</td>
            </tr>`).join('')}</tbody>
            <tfoot><tr class="bg-slate-50 font-bold">
              <td class="px-4 py-2.5 text-slate-700">Oraliq bo'yicha jami</td>
              <td class="px-4 py-2.5 text-right text-emerald-700">${fmtMoney(tushum)}</td>
              <td class="px-4 py-2.5 text-right text-orange-700">${fmtMoney(xarajat)}</td>
              <td class="px-4 py-2.5 text-right ${foyda < 0 ? 'text-rose-600' : 'text-slate-900'}">${fmtMoney(foyda)}</td>
            </tr></tfoot>
          </table>` : emptyState('Bu oraliqda yozuv yo\'q')}
        </div>

        <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div class="text-sm font-bold text-slate-700 mb-3">Umumiy — boshidan buyon</div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div class="bg-white rounded-lg border border-slate-200 px-4 py-3">
              <div class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Jami tushum</div>
              <div class="text-lg font-extrabold text-emerald-600">${fmtMoney(jamiTushum)}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">${pays.length} ta to'lov</div>
            </div>
            <div class="bg-white rounded-lg border border-slate-200 px-4 py-3">
              <div class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Jami xarajat</div>
              <div class="text-lg font-extrabold text-orange-600">${fmtMoney(jamiXarajat)}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">${exps.length} ta yozuv</div>
            </div>
            <div class="bg-white rounded-lg border border-slate-200 px-4 py-3">
              <div class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Jami sof foyda</div>
              <div class="text-lg font-extrabold ${jamiFoyda < 0 ? 'text-rose-600' : 'text-slate-800'}">${fmtMoney(jamiFoyda)}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">tushum − xarajat</div>
            </div>
          </div>
        </div>
      </div>`;

    $$('[data-davr]', body).forEach((b) => b.onclick = () => {
      const [a, z] = oraliq(b.dataset.davr);
      holat = { from: a, to: z, kalit: b.dataset.davr };
      chiz();
    });
    const sana = () => {
      const a = $('#dFrom', body).value;
      const z = $('#dTo', body).value;
      if (!a || !z) return;
      holat = { from: a <= z ? a : z, to: a <= z ? z : a, kalit: '' };
      chiz();
    };
    $('#dFrom', body).onchange = sana;
    $('#dTo', body).onchange = sana;
  };

  chiz();
}

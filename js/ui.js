// Umumiy UI yordamchilari: modal, toast, forma, formatlash

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const DAYS = { 1: 'Du', 2: 'Se', 3: 'Chor', 4: 'Pay', 5: 'Ju', 6: 'Shan', 7: 'Yak' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtMoney = (n) => (Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + " so'm";

export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
};

export const today = () => new Date().toISOString().slice(0, 10);

export const fmtTime = (t) => (t ? String(t).slice(0, 5) : '');

export const fmtDays = (days) => (days || []).map((d) => DAYS[d]).join(', ');

export function toast(msg, type = 'success') {
  const box = $('#toasts');
  const el = document.createElement('div');
  const colors = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-blue-600' };
  el.className = `${colors[type] || colors.info} text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg fade-in max-w-sm`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function modal(title, bodyHtml, { wide = false } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 overflow-y-auto';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} my-8 fade-in">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 class="font-bold text-lg">${esc(title)}</h3>
        <button data-close class="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
      </div>
      <div class="p-6" data-body></div>
    </div>`;
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) close(); });
  $('[data-body]', overlay).innerHTML = bodyHtml;
  $('#modals').appendChild(overlay);
  return { overlay, body: $('[data-body]', overlay), close };
}

export function confirmDialog(msg) {
  return new Promise((resolve) => {
    const m = modal('Tasdiqlash', `
      <p class="text-slate-600 mb-5">${esc(msg)}</p>
      <div class="flex justify-end gap-2">
        <button data-no class="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium">Bekor qilish</button>
        <button data-yes class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium">Ha, davom etish</button>
      </div>`);
    $('[data-no]', m.body).onclick = () => { m.close(); resolve(false); };
    $('[data-yes]', m.body).onclick = () => { m.close(); resolve(true); };
  });
}

// Telefon: +998 XX XXX XX XX formatiga keltiradi
export function fmtTelInput(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  let out = '+998';
  if (d.length > 0) out += ' ' + d.slice(0, 2);
  if (d.length > 2) out += ' ' + d.slice(2, 5);
  if (d.length > 5) out += ' ' + d.slice(5, 7);
  if (d.length > 7) out += ' ' + d.slice(7, 9);
  return out;
}

// Summa: 1 000 000 ko'rinishida ajratadi
export function fmtMoneyInput(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 12);
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Universal forma modali.
// fields: [{name, label, type, options: [{value,label}], required, value, placeholder}]
// type: text | tel | money | number | date | time | select | textarea | days | checkbox
export function formModal(title, fields, initial = {}, { submitLabel = 'Saqlash', wide = false } = {}) {
  return new Promise((resolve) => {
    const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
    const rows = fields.map((f) => {
      const val = initial[f.name] ?? f.value ?? '';
      const req = f.required ? '<span class="text-rose-500">*</span>' : '';
      let input = '';
      if (f.type === 'select') {
        input = `<select name="${f.name}" class="${inputCls}" ${f.required ? 'required' : ''}>
          ${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}
          ${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>`;
      } else if (f.type === 'textarea') {
        input = `<textarea name="${f.name}" rows="2" class="${inputCls}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
      } else if (f.type === 'days') {
        const sel = Array.isArray(val) ? val : [];
        input = `<div class="flex flex-wrap gap-2" data-days="${f.name}">
          ${Object.entries(DAYS).map(([d, l]) => `
            <label class="cursor-pointer">
              <input type="checkbox" value="${d}" class="peer hidden" ${sel.includes(Number(d)) ? 'checked' : ''}>
              <span class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 inline-block">${l}</span>
            </label>`).join('')}
        </div>`;
      } else if (f.type === 'checkbox') {
        input = `<label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''} class="w-4 h-4 accent-blue-600"> ${esc(f.checkboxLabel || '')}</label>`;
      } else if (f.type === 'tel') {
        input = `<input name="${f.name}" type="text" inputmode="tel" data-mask="tel" value="${esc(val ? fmtTelInput(val) : '')}" class="${inputCls}" placeholder="+998 97 999 99 99" ${f.required ? 'required' : ''}>`;
      } else if (f.type === 'money') {
        input = `<div class="relative">
          <input name="${f.name}" type="text" inputmode="numeric" data-mask="money" value="${esc(val !== '' && val !== null ? fmtMoneyInput(val) : '')}" class="${inputCls} pr-12" placeholder="0" ${f.required ? 'required' : ''}>
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">so'm</span>
        </div>`;
      } else {
        input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" class="${inputCls}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.type === 'number' ? 'step="any" inputmode="numeric"' : ''}>`;
      }
      return `<div class="${f.full ? 'sm:col-span-2' : ''}">
        <label class="block text-xs font-semibold text-slate-500 mb-1.5">${esc(f.label)} ${req}</label>${input}
      </div>`;
    }).join('');

    const m = modal(title, `
      <form class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${rows}
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" data-cancel class="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium">Bekor qilish</button>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 transition">${esc(submitLabel)}</button>
        </div>
      </form>`, { wide });

    // Telefon va summa maskalarini ulash
    $$('[data-mask="tel"]', m.body).forEach((inp) => {
      inp.addEventListener('focus', () => { if (!inp.value) inp.value = '+998 '; });
      inp.addEventListener('blur', () => { if (inp.value.trim() === '+998') inp.value = ''; });
      inp.addEventListener('input', () => { inp.value = fmtTelInput(inp.value); });
    });
    $$('[data-mask="money"]', m.body).forEach((inp) => {
      inp.addEventListener('input', () => { inp.value = fmtMoneyInput(inp.value); });
    });

    $('[data-cancel]', m.body).onclick = () => { m.close(); resolve(null); };
    $('form', m.body).onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const out = {};
      for (const f of fields) {
        if (f.type === 'days') {
          out[f.name] = $$(`[data-days="${f.name}"] input:checked`, m.body).map((i) => Number(i.value));
        } else if (f.type === 'checkbox') {
          out[f.name] = fd.get(f.name) === 'on';
        } else if (f.type === 'money') {
          const d = String(fd.get(f.name) || '').replace(/\D/g, '');
          out[f.name] = d === '' ? null : Number(d);
        } else if (f.type === 'tel') {
          const v = String(fd.get(f.name) || '').trim();
          out[f.name] = (v === '' || v === '+998') ? null : v;
        } else {
          let v = fd.get(f.name);
          if (v === '') v = null;
          if (f.type === 'number' && v !== null) v = Number(v);
          out[f.name] = v;
        }
      }
      m.close();
      resolve(out);
    };
  });
}

export function statCard(label, value, color = 'blue', icon = '', href = null) {
  const grad = {
    blue: 'from-blue-500 to-indigo-500', green: 'from-emerald-500 to-teal-500',
    purple: 'from-violet-500 to-purple-500', orange: 'from-orange-500 to-amber-500',
    red: 'from-rose-500 to-red-500', slate: 'from-slate-400 to-slate-500',
    cyan: 'from-cyan-500 to-sky-500', yellow: 'from-amber-400 to-yellow-500',
  }[color] || 'from-blue-500 to-indigo-500';
  const inner = `
    <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center text-lg shrink-0 shadow-md shadow-slate-300/50">${icon}</div>
    <div class="min-w-0 flex-1">
      <div class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold truncate">${esc(label)}</div>
      <div class="text-xl font-extrabold text-slate-800 leading-tight">${value}</div>
    </div>
    ${href ? '<span class="text-slate-300 text-lg shrink-0">›</span>' : ''}`;
  const cls = `bg-white rounded-2xl border border-slate-200/70 p-4 flex items-center gap-3.5 shadow-sm shadow-slate-200/60 transition ${href ? 'hover:shadow-md hover:-translate-y-0.5 hover:border-blue-300 cursor-pointer' : ''}`;
  return href ? `<a href="${href}" class="${cls}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
}

export function emptyState(msg = "Ma'lumotlar topilmadi") {
  return `<div class="text-center py-12 text-slate-400 text-sm">${esc(msg)}</div>`;
}

export const btnCls = {
  primary: 'px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 transition',
  ghost: 'px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-sm font-medium transition',
  iconEdit: 'p-2 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition',
  iconDel: 'p-2 rounded-lg hover:bg-rose-50 text-rose-500 transition',
};

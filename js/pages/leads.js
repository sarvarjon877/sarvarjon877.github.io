import { sb, run } from '../db.js';
import { $, $$, esc, formModal, confirmDialog, toast, fmtDate, btnCls } from '../ui.js';

const STATUSES = [
  { id: 'yangi', title: 'Yangi', color: 'border-blue-400' },
  { id: 'boglanildi', title: "Bog'lanildi", color: 'border-violet-400' },
  { id: 'sinovga_yozildi', title: 'Sinovga yozildi', color: 'border-amber-400' },
  { id: 'keldi', title: 'Sinovga keldi', color: 'border-emerald-400' },
  { id: 'yoqotildi', title: "Yo'qotildi", color: 'border-rose-400' },
];
const SOURCES = [
  { value: 'target', label: 'Target (reklama)' },
  { value: 'instagram', label: 'Instagram' }, { value: 'telegram', label: 'Telegram' },
  { value: 'tavsiya', label: 'Tavsiya' }, { value: 'reklama', label: 'Tashqi reklama' },
  { value: 'kelib_ketgan', label: "O'zi kelgan" }, { value: 'boshqa', label: 'Boshqa' },
];

let courses = [];

const leadFields = (initial = {}) => [
  { name: 'name', label: 'Ism familiya', required: true, value: initial.name },
  { name: 'phone', label: 'Telefon raqam', type: 'tel', placeholder: '+998 90 123 45 67', value: initial.phone },
  { name: 'source', label: 'Manba', type: 'select', options: SOURCES, value: initial.source || 'instagram' },
  { name: 'course_id', label: 'Qiziqqan kursi', type: 'select', placeholder: 'Tanlang', options: courses.map((c) => ({ value: c.id, label: c.name })), value: initial.course_id },
  { name: 'note', label: 'Izoh', type: 'textarea', full: true, value: initial.note },
];

export async function render(container) {
  courses = await run(sb.from('courses').select('id,name').order('name'));
  const leads = await run(sb.from('leads').select('*, courses(name)').order('created_at', { ascending: false }));
  const converted = leads.filter((l) => l.status === 'oquvchi').length;

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div class="text-sm text-slate-500">Jami: <b>${leads.length}</b> ta lid, o'quvchiga aylangan: <b class="text-emerald-600">${converted}</b> ta</div>
      <button id="addLead" class="${btnCls.primary}">+ Lid qo'shish</button>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start" id="board"></div>`;

  const board = $('#board', container);
  board.innerHTML = STATUSES.map((st) => {
    const items = leads.filter((l) => l.status === st.id);
    return `
      <div class="bg-white rounded-xl border border-slate-200/80 border-t-4 ${st.color}">
        <div class="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <span class="font-bold text-sm">${st.title}</span>
          <span class="text-xs bg-slate-100 rounded-full px-2 py-0.5 font-semibold">${items.length}</span>
        </div>
        <div class="p-3 space-y-2 min-h-[60px]">
          ${items.map((l) => `
            <div class="border border-slate-100 rounded-xl p-3 bg-slate-50/60 text-sm space-y-1">
              <div class="flex items-start justify-between gap-2">
                <span class="font-semibold">${esc(l.name)}</span>
                <div class="flex shrink-0">
                  <button data-edit="${l.id}" class="${btnCls.iconEdit}" title="Tahrirlash">✏️</button>
                  <button data-del="${l.id}" class="${btnCls.iconDel}" title="O'chirish">🗑</button>
                </div>
              </div>
              ${l.phone ? `<div class="text-slate-500">📞 ${esc(l.phone)}</div>` : ''}
              <div class="text-xs text-slate-400">${esc(SOURCES.find((s) => s.value === l.source)?.label || l.source)} · ${esc(l.courses?.name || 'Kurs tanlanmagan')} · ${fmtDate(l.created_at)}</div>
              ${l.note ? `<div class="text-xs text-slate-500 italic">${esc(l.note)}</div>` : ''}
              <div class="flex flex-wrap gap-1.5 pt-1.5">
                ${st.id !== 'yoqotildi' ? nextBtn(l, st.id) : ''}
                ${st.id !== 'yoqotildi' ? `<button data-lost="${l.id}" class="text-xs px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-medium hover:bg-rose-100">Yo'qotildi</button>` : `<button data-move="${l.id}" data-to="yangi" class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 font-medium hover:bg-slate-200">Qaytarish</button>`}
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  function nextBtn(l, cur) {
    const flow = { yangi: ['boglanildi', "Bog'lanildi →"], boglanildi: ['sinovga_yozildi', 'Sinovga yozish →'], sinovga_yozildi: ['keldi', 'Keldi →'] };
    if (flow[cur]) return `<button data-move="${l.id}" data-to="${flow[cur][0]}" class="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium hover:bg-blue-100">${flow[cur][1]}</button>`;
    if (cur === 'keldi') return `<button data-convert="${l.id}" class="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700">O'quvchiga aylantirish ✓</button>`;
    return '';
  }

  $('#addLead', container).onclick = async () => {
    const v = await formModal("Yangi lid qo'shish", leadFields());
    if (!v) return;
    await run(sb.from('leads').insert(v));
    toast("Lid qo'shildi");
    render(container);
  };

  $$('[data-edit]', board).forEach((b) => b.onclick = async () => {
    const l = leads.find((x) => x.id === b.dataset.edit);
    const v = await formModal('Lidni tahrirlash', leadFields(l), l);
    if (!v) return;
    await run(sb.from('leads').update(v).eq('id', l.id));
    toast('Saqlandi');
    render(container);
  });

  $$('[data-del]', board).forEach((b) => b.onclick = async () => {
    if (!(await confirmDialog("Bu lidni o'chirmoqchimisiz?"))) return;
    await run(sb.from('leads').delete().eq('id', b.dataset.del));
    toast("O'chirildi");
    render(container);
  });

  $$('[data-move]', board).forEach((b) => b.onclick = async () => {
    await run(sb.from('leads').update({ status: b.dataset.to }).eq('id', b.dataset.move));
    render(container);
  });

  $$('[data-lost]', board).forEach((b) => b.onclick = async () => {
    await run(sb.from('leads').update({ status: 'yoqotildi' }).eq('id', b.dataset.lost));
    render(container);
  });

  $$('[data-convert]', board).forEach((b) => b.onclick = async () => {
    const l = leads.find((x) => x.id === b.dataset.convert);
    const parts = l.name.trim().split(/\s+/);
    const student = { first_name: parts[0] || l.name, last_name: parts.slice(1).join(' ') || '', phone: l.phone, status: 'yangi', note: l.note };
    const [created] = await run(sb.from('students').insert(student).select());
    await run(sb.from('leads').update({ status: 'oquvchi', student_id: created.id }).eq('id', l.id));
    toast("O'quvchilar ro'yxatiga qo'shildi 🎉");
    render(container);
  });
}

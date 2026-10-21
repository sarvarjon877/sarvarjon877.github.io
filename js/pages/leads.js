import { sb, run } from '../db.js';
import { $, $$, esc, formModal, confirmDialog, toast, fmtDate, fmtTime, btnCls, today } from '../ui.js';

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

const trialFields = (groups, initial = {}) => [
  { name: 'trial_date', label: 'Sinov darsi sanasi', type: 'date', required: true, value: initial.trial_date || today() },
  { name: 'trial_time', label: 'Vaqti', type: 'time', value: initial.trial_time ? String(initial.trial_time).slice(0, 5) : '14:00' },
  { name: 'trial_group_id', label: "Qaysi guruhga qo'shiladi", type: 'select', placeholder: 'Tanlang', full: true, options: groups.map((g) => ({ value: g.id, label: g.name })), value: initial.trial_group_id },
];

export async function render(container) {
  const [cs, groups, leads] = await Promise.all([
    run(sb.from('courses').select('id,name').order('name')),
    run(sb.from('groups').select('id,name').eq('status', 'aktiv').order('name')),
    run(sb.from('leads').select('*, courses(name)').order('created_at', { ascending: false })),
  ]);
  courses = cs;
  const groupName = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  const converted = leads.filter((l) => l.status === 'oquvchi').length;

  const td = today();
  const booked = leads.filter((l) => l.status === 'sinovga_yozildi' && l.trial_date);
  const trialsToday = booked.filter((l) => l.trial_date === td).sort((a, b) => String(a.trial_time || '').localeCompare(String(b.trial_time || '')));
  const trialsLate = booked.filter((l) => l.trial_date < td).sort((a, b) => a.trial_date.localeCompare(b.trial_date));
  const trialsSoon = booked.filter((l) => l.trial_date > td).sort((a, b) => a.trial_date.localeCompare(b.trial_date));

  const trialRow = (l, showDate) => `
    <div class="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <div class="min-w-0">
        <span class="font-semibold">${esc(l.name)}</span>
        ${l.phone ? `<span class="text-slate-400 text-xs ml-1.5">${esc(l.phone)}</span>` : ''}
        <div class="text-xs text-slate-400">${showDate ? fmtDate(l.trial_date) + ' · ' : ''}${l.trial_time ? fmtTime(l.trial_time) : 'vaqt belgilanmagan'}${l.trial_group_id ? ' · ' + esc(groupName[l.trial_group_id] || '—') : ''}</div>
      </div>
      <div class="flex gap-1.5 shrink-0">
        <button data-trial="${l.id}" data-res="keldi" class="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700">Keldi ✓</button>
        <button data-trial="${l.id}" data-res="kelmadi" class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium hover:bg-slate-200">Kelmadi</button>
      </div>
    </div>`;

  const panel = (title, items, cls, showDate) => items.length === 0 ? '' : `
    <div class="bg-white rounded-xl border border-slate-200/80 border-t-4 ${cls} p-4">
      <div class="font-bold text-sm mb-2">${title} <span class="text-xs bg-slate-100 rounded-full px-2 py-0.5 ml-1">${items.length}</span></div>
      ${items.map((l) => trialRow(l, showDate)).join('')}
    </div>`;

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div class="text-sm text-slate-500">Jami: <b>${leads.length}</b> ta lid, o'quvchiga aylangan: <b class="text-emerald-600">${converted}</b> ta</div>
      <button id="addLead" class="${btnCls.primary}">+ Lid qo'shish</button>
    </div>
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-6">
      ${panel('🕐 Bugungi sinov darslari', trialsToday, 'border-amber-400', false)}
      ${panel("⚠️ O'tib ketgan — natijasi belgilanmagan", trialsLate, 'border-rose-400', true)}
      ${panel('📅 Kelgusi sinov darslari', trialsSoon, 'border-blue-400', true)}
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
              ${l.trial_date ? `<div class="text-xs ${l.trial_result === 'kelmadi' ? 'text-rose-600' : 'text-amber-700'} font-medium bg-white border border-slate-100 rounded-lg px-2 py-1">
                🕐 Sinov: ${fmtDate(l.trial_date)}${l.trial_time ? ' ' + fmtTime(l.trial_time) : ''}${l.trial_group_id ? ' · ' + esc(groupName[l.trial_group_id] || '—') : ''}${l.trial_result === 'kelmadi' ? ' · kelmadi' : ''}
              </div>` : ''}
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
    const flow = { yangi: ['boglanildi', "Bog'lanildi →"], boglanildi: ['sinovga_yozildi', 'Sinovga yozish →'] };
    if (flow[cur]) return `<button data-move="${l.id}" data-to="${flow[cur][0]}" class="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium hover:bg-blue-100">${flow[cur][1]}</button>`;
    if (cur === 'sinovga_yozildi') return `
      <button data-trial="${l.id}" data-res="keldi" class="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700">Keldi ✓</button>
      <button data-trial="${l.id}" data-res="kelmadi" class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium hover:bg-slate-200">Kelmadi</button>
      <button data-retrial="${l.id}" class="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium hover:bg-amber-100">Sanani ko'chirish</button>`;
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
    const to = b.dataset.to;
    const patch = { status: to };
    if (to === 'sinovga_yozildi') {
      if (groups.length === 0) { toast('Avval aktiv guruh ochish kerak', 'error'); return; }
      const v = await formModal('Sinov darsiga yozish', trialFields(groups));
      if (!v) return;
      Object.assign(patch, v, { trial_result: null });
    }
    if (to === 'yangi') Object.assign(patch, { trial_date: null, trial_time: null, trial_group_id: null, trial_result: null });
    await run(sb.from('leads').update(patch).eq('id', b.dataset.move));
    render(container);
  });

  $$('[data-retrial]', board).forEach((b) => b.onclick = async () => {
    const l = leads.find((x) => x.id === b.dataset.retrial);
    const v = await formModal("Sinov darsini ko'chirish", trialFields(groups, l));
    if (!v) return;
    await run(sb.from('leads').update({ ...v, trial_result: null }).eq('id', l.id));
    toast("Sinov darsi ko'chirildi");
    render(container);
  });

  $$('[data-trial]', container).forEach((b) => b.onclick = async () => {
    const keldi = b.dataset.res === 'keldi';
    await run(sb.from('leads').update(keldi
      ? { status: 'keldi', trial_result: 'keldi' }
      : { status: 'boglanildi', trial_result: 'kelmadi' }).eq('id', b.dataset.trial));
    toast(keldi ? 'Sinov darsiga keldi ✓' : "Kelmadi — qayta bog'lanishga qaytarildi", keldi ? 'success' : 'error');
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
    if (l.trial_group_id) {
      await run(sb.from('group_students').insert({ group_id: l.trial_group_id, student_id: created.id, status: 'aktiv', joined_at: today() }));
    }
    await run(sb.from('leads').update({ status: 'oquvchi', student_id: created.id }).eq('id', l.id));
    toast(l.trial_group_id ? "O'quvchi qo'shildi va guruhga biriktirildi 🎉" : "O'quvchilar ro'yxatiga qo'shildi 🎉");
    render(container);
  });
}

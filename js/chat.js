// Jonli chat komponenti — guruh chati va shaxsiy savol-javob uchun.
// Ham o'quvchi portali, ham xodimlar sahifasi shu komponentdan foydalanadi.
import { sb, run } from './db.js';
import { $, esc, toast } from './ui.js';

const ROLE_BADGE = {
  student: ['O\'quvchi', 'bg-blue-50 text-blue-600'],
  oqituvchi: ['O\'qituvchi', 'bg-emerald-50 text-emerald-700'],
  direktor: ['Direktor', 'bg-violet-50 text-violet-700'],
  admin: ['Admin', 'bg-amber-50 text-amber-700'],
  moliyachi: ['Moliyachi', 'bg-cyan-50 text-cyan-700'],
};

let activeChannel = null;   // bir vaqtda bitta chat obunasi

function closeActive() {
  if (activeChannel) { sb.removeChannel(activeChannel); activeChannel = null; }
}

function timeOf(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Chatni el ichiga o'rnatadi.
 * opts: { groupId, channel:'group'|'private', studentId, me:{role,id,name}, readOnly, placeholder }
 * me.id — o'quvchi.id yoki xodim.id (umumiy hisoblarda null bo'lishi mumkin)
 */
export async function mountChat(el, opts) {
  const { groupId, channel = 'group', studentId = null, me, readOnly = false, dark = false } = opts;
  closeActive();

  const T = dark ? {
    wrap: 'bg-slate-900 border-slate-800', form: 'border-slate-800 bg-slate-900',
    input: 'border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500',
    empty: 'text-slate-500', name: 'text-slate-300',
    other: 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-md', time: 'text-slate-500',
  } : {
    wrap: 'bg-slate-50 border-slate-200/80', form: 'border-slate-200 bg-white',
    input: 'border-slate-200', empty: 'text-slate-400', name: 'text-slate-600',
    other: 'bg-white border border-slate-200 text-slate-800 rounded-bl-md', time: 'text-slate-400',
  };

  el.innerHTML = `
    <div class="flex flex-col h-full ${T.wrap} rounded-xl border overflow-hidden">
      <div id="msgs" class="flex-1 overflow-y-auto p-4 space-y-2.5"></div>
      ${readOnly ? '' : `
      <form id="chatForm" class="flex gap-2 p-3 border-t ${T.form}">
        <input id="chatInput" autocomplete="off" placeholder="${esc(opts.placeholder || 'Xabar yozing...')}"
          class="flex-1 border ${T.input} rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <button class="w-11 h-11 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-lg flex items-center justify-center transition">➤</button>
      </form>`}
    </div>`;

  const box = $('#msgs', el);

  const isMine = (m) => (me.id && m.sender_id === me.id) ||
    (!me.id && m.sender_role === me.role && m.sender_name === me.name);

  const clearPlaceholder = () => { const ph = box.querySelector('[data-empty]'); if (ph) ph.remove(); };

  const seen = new Set();
  const append = (m, scroll = true) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    clearPlaceholder();
    const mine = isMine(m);
    const [badge, badgeCls] = ROLE_BADGE[m.sender_role] || [m.sender_role, 'bg-slate-100 text-slate-500'];
    const row = document.createElement('div');
    row.className = `flex ${mine ? 'justify-end' : 'justify-start'}`;
    row.innerHTML = `
      <div class="max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col">
        ${mine ? '' : `<div class="flex items-center gap-1.5 mb-0.5 px-1">
          <span class="text-xs font-semibold ${T.name}">${esc(m.sender_name)}</span>
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeCls}">${badge}</span>
        </div>`}
        <div class="px-3.5 py-2 rounded-2xl text-sm leading-snug break-words ${mine ? 'bg-blue-600 text-white rounded-br-md' : T.other}">
          ${esc(m.body)}
        </div>
        <div class="text-[10px] ${T.time} mt-0.5 px-1">${timeOf(m.created_at)}</div>
      </div>`;
    box.appendChild(row);
    if (scroll) box.scrollTop = box.scrollHeight;
  };

  // Tarixni yuklash
  let q = sb.from('messages').select('*').eq('group_id', groupId).eq('channel', channel).order('created_at');
  if (channel === 'private') q = q.eq('student_id', studentId);
  const history = await run(q);
  box.innerHTML = '';
  if (history.length === 0) {
    box.innerHTML = `<div data-empty class="text-center ${T.empty} text-sm py-10">Hozircha xabar yo'q.<br>Birinchi bo'lib yozing 👇</div>`;
  } else {
    history.forEach((m) => append(m, false));
    box.scrollTop = box.scrollHeight;
  }

  // Jonli obuna (realtime)
  activeChannel = sb.channel(`chat:${channel}:${groupId}:${studentId || 'all'}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
      (payload) => {
        const m = payload.new;
        if (m.channel !== channel) return;
        if (channel === 'private' && m.student_id !== studentId) return;
        append(m);
      })
    .subscribe();

  // Yuborish
  if (!readOnly) {
    const form = $('#chatForm', el);
    const input = $('#chatInput', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      input.focus();
      try {
        const [row] = await run(sb.from('messages').insert({
          group_id: groupId, channel, student_id: channel === 'private' ? studentId : null,
          sender_role: me.role, sender_id: me.id || null, sender_name: me.name, body,
        }).select());
        append(row); // realtime kechiksa ham darhol ko'rinadi
      } catch {
        toast('Xabar yuborilmadi', 'error');
      }
    };
  }

  return { destroy: closeActive };
}

export { closeActive as closeChat };

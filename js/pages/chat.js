// Xodimlar uchun chat sahifasi: guruh chatlari + o'quvchilarning shaxsiy savollari.
// Direktor/admin/o'qituvchi hammasini ko'radi va javob beradi.
import { sb, run } from '../db.js';
import { $, $$, esc, emptyState, fmtDate } from '../ui.js';
import { currentUser } from '../app.js';
import { mountChat, closeChat } from '../chat.js';

let view = { tab: 'group', open: null };

const me = () => ({ role: currentUser.role, id: null, name: currentUser.name });

export async function render(container) {
  view = { tab: 'group', open: null };
  window.__cleanup = closeChat;

  const [groups, priv] = await Promise.all([
    run(sb.from('groups').select('id,name,courses(name)').eq('status', 'aktiv').order('name')),
    run(sb.from('messages').select('student_id,group_id,body,created_at,sender_role').eq('channel', 'private').order('created_at', { ascending: false })),
  ]);

  // Shaxsiy savollarni o'quvchi bo'yicha guruhlash (oxirgi xabar)
  const threadsMap = new Map();
  for (const m of priv) {
    const key = `${m.student_id}:${m.group_id}`;
    if (!threadsMap.has(key)) threadsMap.set(key, { ...m, count: 0 });
    threadsMap.get(key).count++;
  }
  const threadKeys = [...threadsMap.values()];
  // O'quvchi va guruh nomlarini olish
  const sIds = [...new Set(threadKeys.map((t) => t.student_id))];
  const students = sIds.length ? await run(sb.from('students').select('id,first_name,last_name').in('id', sIds)) : [];
  const nameOf = (id) => { const s = students.find((x) => x.id === id); return s ? `${s.first_name} ${s.last_name || ''}`.trim() : 'O\'quvchi'; };
  const gNameOf = (id) => groups.find((g) => g.id === id)?.name || '';

  container.innerHTML = `
    <div class="flex gap-1.5 mb-4">
      <button data-t="group" class="px-4 py-2 rounded-lg text-sm font-semibold border">💬 Guruh chatlari</button>
      <button data-t="private" class="px-4 py-2 rounded-lg text-sm font-semibold border">❓ Shaxsiy savollar (${threadKeys.length})</button>
    </div>
    <div id="chatView"></div>`;

  const paint = () => {
    $$('[data-t]', container).forEach((b) => {
      const on = b.dataset.t === view.tab;
      b.className = `px-4 py-2 rounded-lg text-sm font-semibold border ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50'}`;
    });
    const v = $('#chatView', container);
    closeChat();

    if (view.open) return openChat(v);

    if (view.tab === 'group') {
      v.innerHTML = groups.length === 0 ? emptyState('Aktiv guruh yo\'q') : `
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          ${groups.map((g) => `
            <button data-grp="${g.id}" class="text-left bg-white rounded-xl border border-slate-200/80 p-4 hover:shadow-md hover:border-blue-300 transition">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">💬</div>
                <div class="min-w-0"><div class="font-bold truncate">${esc(g.name)}</div>
                <div class="text-xs text-slate-400 truncate">${esc(g.courses?.name || '')}</div></div>
              </div>
            </button>`).join('')}
        </div>`;
      $$('[data-grp]', v).forEach((b) => b.onclick = () => { view.open = { type: 'group', groupId: b.dataset.grp, title: groups.find((g) => g.id === b.dataset.grp)?.name }; paint(); });
    } else {
      v.innerHTML = threadKeys.length === 0 ? emptyState('Hozircha shaxsiy savol yo\'q') : `
        <div class="bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-100">
          ${threadKeys.map((t) => `
            <button data-th="${t.student_id}:${t.group_id}" class="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">${esc(nameOf(t.student_id).slice(0, 1))}</div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold text-sm truncate">${esc(nameOf(t.student_id))}</span>
                  <span class="text-[11px] text-slate-400 shrink-0">${fmtDate(t.created_at)}</span>
                </div>
                <div class="text-xs text-slate-500 truncate">${t.sender_role === 'student' ? '' : '✓ '}${esc(t.body)}</div>
                <div class="text-[11px] text-slate-400">${esc(gNameOf(t.group_id))}</div>
              </div>
            </button>`).join('')}
        </div>`;
      $$('[data-th]', v).forEach((b) => b.onclick = () => {
        const [sid, gid] = b.dataset.th.split(':');
        view.open = { type: 'private', groupId: gid, studentId: sid, title: nameOf(sid) + ' — shaxsiy savol' };
        paint();
      });
    }
  };

  async function openChat(v) {
    const o = view.open;
    v.innerHTML = `
      <button id="backBtn" class="text-sm text-blue-600 font-semibold mb-3 hover:underline">← Orqaga</button>
      <div class="mb-2 font-bold">${esc(o.title || '')}</div>
      <div id="cbox" style="height: 65vh"></div>`;
    $('#backBtn', v).onclick = () => { view.open = null; paint(); };
    await mountChat($('#cbox', v), {
      groupId: o.groupId, channel: o.type, studentId: o.studentId || null, me: me(),
      placeholder: o.type === 'private' ? 'Javob yozing...' : 'Guruhga xabar yozing...',
    });
  }

  $$('[data-t]', container).forEach((b) => b.onclick = () => { view.tab = b.dataset.t; view.open = null; paint(); });
  paint();
}

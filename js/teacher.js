// O'qituvchi paneli (mobil, fokuslangan) — o'z guruhlari, o'quvchilar, davomat+faollik bahosi,
// uy vazifa, darsliklar (video/modul) va profil. Login umumiy bo'lgani uchun o'qituvchi
// ro'yxatdan o'zini tanlaydi (localStorage 'finway_teacher').
import { sb, run } from './db.js';
import { $, $$, esc, toast, fmtDays, fmtTime, today, fmtDate, modal, formModal, confirmDialog } from './ui.js';
import * as Library from './pages/lessons.js';
import { mountChat, closeChat } from './chat.js';
import { smsCall } from './app.js';

const TABS = [
  { id: 'home', label: 'Bosh', icon: '🏠' },
  { id: 'groups', label: 'Guruhlarim', icon: '👥' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'library', label: 'Darslik', icon: '📚' },
  { id: 'profile', label: 'Profil', icon: '👤' },
];

const ATT = {
  keldi: ['Keldi', '✅', 'emerald'],
  kelmadi: ['Kelmadi', '❌', 'rose'],
  sababli: ['Sababli', '⚠️', 'amber'],
};

let T = { teacher: null, groups: [], tab: 'home', centerName: "O'quv markazi" };

const wdToday = () => { const d = new Date().getDay(); return d === 0 ? 7 : d; };
const initials = (f, l) => `${(f || '').slice(0, 1)}${(l || '').slice(0, 1)}`.toUpperCase() || '👤';
const fullName = (e) => `${e.first_name || ''} ${e.last_name || ''}`.trim();

export async function renderTeacherApp(centerName) {
  T = { teacher: null, groups: [], tab: 'home', centerName: centerName || "O'quv markazi" };
  const teachers = await run(sb.from('employees').select('id,first_name,last_name,photo_url').eq('role', 'oqituvchi').eq('active', true).order('first_name'));

  const savedId = localStorage.getItem('finway_teacher');
  const saved = savedId && teachers.find((t) => t.id === savedId);
  if (saved) { T.teacher = saved; return renderPanel(); }
  return renderPicker(teachers);
}

function renderPicker(teachers) {
  $('#app').innerHTML = `
    <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-6 fade-in">
        <div class="text-center mb-5">
          <div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl">🧑‍🏫</div>
          <h1 class="text-xl font-extrabold text-slate-800">Siz qaysi o'qituvchisiz?</h1>
          <p class="text-slate-500 text-sm mt-1">Panel faqat sizning guruhlaringizni ko'rsatadi</p>
        </div>
        ${teachers.length === 0 ? `<div class="text-center text-slate-400 text-sm py-6">O'qituvchilar ro'yxati bo'sh.<br>Administrator «Xodimlar» bo'limidan o'qituvchi qo'shsin.</div>` : `
        <div class="space-y-2">
          ${teachers.map((t) => `
            <button data-t="${t.id}" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition text-left">
              ${avatar(t, 10)}
              <span class="font-semibold text-slate-700">${esc(fullName(t))}</span>
            </button>`).join('')}
        </div>`}
        <button id="tLogout" class="mt-5 w-full text-xs text-slate-400 hover:text-rose-500">↩ Boshqa hisobga chiqish</button>
      </div>
    </div>`;
  $$('#app [data-t]').forEach((b) => b.onclick = () => {
    localStorage.setItem('finway_teacher', b.dataset.t);
    renderTeacherApp(T.centerName);
  });
  $('#tLogout').onclick = doLogout;
}

function avatar(e, size = 10) {
  const cls = `w-${size} h-${size}`;
  if (e?.photo_url) return `<img src="${esc(e.photo_url)}" class="${cls} rounded-full object-cover shrink-0 border border-slate-200">`;
  return `<span class="${cls} rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">${esc(initials(e?.first_name, e?.last_name))}</span>`;
}

async function doLogout() {
  localStorage.removeItem('finway_teacher');
  await sb.auth.signOut();
  location.hash = '';
  location.reload();
}

async function renderPanel() {
  T.groups = await run(sb.from('groups')
    .select('id,name,course_id,days,start_time,end_time,is_online,lesson_link,status,courses(name),rooms(name)')
    .eq('teacher_id', T.teacher.id).eq('status', 'aktiv').order('name'));

  $('#app').innerHTML = `
    <div class="min-h-screen flex flex-col bg-slate-100 max-w-lg mx-auto">
      <header class="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          ${avatar(T.teacher, 9)}
          <div class="min-w-0">
            <div class="font-bold text-slate-800 leading-tight truncate">${esc(fullName(T.teacher))}</div>
            <div class="text-[11px] text-slate-400">O'qituvchi · ${esc(T.centerName)}</div>
          </div>
        </div>
        <button id="hdrLogout" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-lg font-medium shrink-0">Chiqish</button>
      </header>
      <main id="tMain" class="flex-1 p-4 pb-24 fade-in"></main>
      <nav class="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-white/95 backdrop-blur border-t border-slate-200 flex z-20 px-1.5 pt-1.5 pb-2">
        ${TABS.map((t) => `
          <button data-tab="${t.id}" class="flex-1 flex flex-col items-center gap-1 py-1.5 mx-0.5 rounded-xl text-[10px] font-semibold text-slate-400">
            <span class="text-[17px] leading-none">${t.icon}</span>${t.label}
          </button>`).join('')}
      </nav>
    </div>`;

  $('#hdrLogout').onclick = doLogout;
  $$('#app [data-tab]').forEach((b) => b.onclick = () => { T.tab = b.dataset.tab; drawTab(); });
  drawTab();
}

function setNav() {
  $$('#app [data-tab]').forEach((b) => {
    const on = b.dataset.tab === T.tab;
    b.className = `flex-1 flex flex-col items-center gap-1 py-1.5 mx-0.5 rounded-xl text-[10px] font-semibold transition ${on ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`;
  });
}

const card = (inner, cls = '') => `<div class="bg-white rounded-2xl border border-slate-200 p-4 ${cls}">${inner}</div>`;

async function drawTab() {
  setNav();
  closeChat();
  const main = $('#tMain');
  main.scrollTop = 0;
  if (T.tab === 'home') return drawHome(main);
  if (T.tab === 'groups') return drawGroups(main);
  if (T.tab === 'chat') return drawChat(main);
  if (T.tab === 'library') return Library.render(main);
  if (T.tab === 'profile') return drawProfile(main);
}

// ---------- BOSH ----------
async function drawHome(main) {
  main.innerHTML = '<div class="text-slate-400 text-sm text-center py-8">Yuklanmoqda...</div>';
  const gids = T.groups.map((g) => g.id);
  const members = gids.length
    ? await run(sb.from('group_students').select('group_id').in('group_id', gids).eq('status', 'aktiv'))
    : [];
  const totalStudents = members.length;
  const wd = wdToday();
  const todayGroups = T.groups.filter((g) => (g.days || []).includes(wd));
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  main.innerHTML = `
    <div class="relative overflow-hidden rounded-3xl p-5 mb-4 text-white" style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 50%,#0ea5e9 100%); box-shadow:0 16px 36px -18px rgba(37,99,235,.85);">
      <div class="absolute -right-8 -top-10 w-40 h-40 rounded-full" style="background:radial-gradient(circle, rgba(255,255,255,.28), transparent 70%);"></div>
      <div class="relative">
        <div class="text-blue-100 text-xs mb-0.5">${greet} 👋</div>
        <div class="text-2xl font-extrabold mb-1 leading-tight">${esc(fullName(T.teacher))}</div>
        <div class="text-sm text-blue-50/90">${todayGroups.length ? `Bugun <b>${todayGroups.length}</b> ta darsingiz bor` : 'Bugun darsingiz yo\'q — dam oling 🌿'}</div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-5">
      ${stat('Guruhlarim', T.groups.length, '👥', 'blue')}
      ${stat("O'quvchilar", totalStudents, '🎓', 'green')}
    </div>
    <div class="mb-2 text-sm font-bold text-slate-600 px-1">📅 Bugungi darslar</div>
    ${todayGroups.length === 0
      ? card('<div class="text-center text-slate-400 text-sm py-4">Bugun darsingiz yo\'q.</div>')
      : `<div class="space-y-2">${todayGroups.map((g) => card(`
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-bold text-slate-800 truncate">${esc(g.name)}</div>
              <div class="text-xs text-slate-400">${esc(g.courses?.name || '')} · ${g.is_online ? '💻 Onlayn' : '🚪 ' + esc(g.rooms?.name || '—')}</div>
            </div>
            <div class="text-sm font-semibold text-blue-600 shrink-0">${fmtTime(g.start_time)}</div>
          </div>
          <button data-open="${g.id}" class="mt-3 w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Guruhni ochish →</button>
        `)).join('')}</div>`}`;
  $$('[data-open]', main).forEach((b) => b.onclick = () => { T.tab = 'groups'; setNav(); openGroup(b.dataset.open); });
}

const STAT_COLORS = {
  blue: ['from-blue-500 to-indigo-500', 'text-blue-600'],
  green: ['from-emerald-500 to-teal-500', 'text-emerald-600'],
  violet: ['from-violet-500 to-purple-500', 'text-violet-600'],
  amber: ['from-amber-500 to-orange-500', 'text-amber-600'],
};
function stat(label, val, icon, color = 'blue') {
  const [grad] = STAT_COLORS[color] || STAT_COLORS.blue;
  return `<div class="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-center gap-3 shadow-sm shadow-slate-200/60">
    <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center text-lg shrink-0 shadow-md shadow-slate-300/40">${icon}</div>
    <div class="min-w-0"><div class="text-2xl font-extrabold text-slate-800 leading-none">${val}</div>
    <div class="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mt-1 truncate">${esc(label)}</div></div>
  </div>`;
}

// ---------- GURUHLARIM ----------
async function drawGroups(main) {
  main.innerHTML = '<div class="text-slate-400 text-sm text-center py-8">Yuklanmoqda...</div>';
  const gids = T.groups.map((g) => g.id);
  const members = gids.length
    ? await run(sb.from('group_students').select('group_id').in('group_id', gids).eq('status', 'aktiv'))
    : [];
  const cnt = (gid) => members.filter((m) => m.group_id === gid).length;

  main.innerHTML = `
    <div class="mb-3 text-sm font-bold text-slate-600 px-1">👥 Mening guruhlarim (${T.groups.length})</div>
    ${T.groups.length === 0
      ? card('<div class="text-center text-slate-400 text-sm py-6">Sizga hali guruh biriktirilmagan.<br>Administrator bilan bog\'laning.</div>')
      : `<div class="space-y-2">${T.groups.map((g) => `
          <button data-open="${g.id}" class="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-300 transition">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="font-bold text-slate-800 truncate">${esc(g.name)}</div>
                <div class="text-xs text-slate-400 mt-0.5">${esc(g.courses?.name || '')}</div>
                <div class="text-xs text-slate-400 mt-0.5">📅 ${fmtDays(g.days)} · ${fmtTime(g.start_time)}–${fmtTime(g.end_time)}</div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-lg font-extrabold text-blue-600 leading-none">${cnt(g.id)}</div>
                <div class="text-[10px] text-slate-400 font-semibold">o'quvchi</div>
              </div>
            </div>
          </button>`).join('')}</div>`}`;
  $$('[data-open]', main).forEach((b) => b.onclick = () => openGroup(b.dataset.open));
}

async function openGroup(gid) {
  const g = T.groups.find((x) => x.id === gid);
  if (!g) return;
  const main = $('#tMain');
  main.scrollTop = 0;
  main.innerHTML = '<div class="text-slate-400 text-sm text-center py-8">Yuklanmoqda...</div>';
  const members = await run(sb.from('group_students')
    .select('students(id,first_name,last_name,photo_url)')
    .eq('group_id', gid).eq('status', 'aktiv'));
  const students = members.map((m) => m.students).filter(Boolean)
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  main.innerHTML = `
    <button id="gBack" class="mb-3 text-sm text-slate-500 hover:text-slate-800 font-medium">← Guruhlarim</button>
    <div class="mb-1 font-bold text-lg text-slate-800">${esc(g.name)}</div>
    <div class="text-xs text-slate-400 mb-3">${esc(g.courses?.name || '')} · 📅 ${fmtDays(g.days)} · ${fmtTime(g.start_time)}–${fmtTime(g.end_time)}</div>
    <div class="grid grid-cols-2 gap-2 mb-4">
      <button id="gAtt" class="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">📋 Davomat</button>
      <button id="gHw" class="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold">📝 Uy vazifa</button>
    </div>
    <div class="mb-2 text-sm font-bold text-slate-600 px-1">O'quvchilar (${students.length})</div>
    ${students.length === 0 ? card('<div class="text-center text-slate-400 text-sm py-4">Guruhda o\'quvchi yo\'q.</div>')
      : `<div class="space-y-2">${students.map((s) => `
        <button data-st="${s.id}" class="w-full flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3 hover:border-blue-300 transition text-left">
          ${avatar(s, 10)}
          <span class="font-semibold text-sm text-slate-700 flex-1 min-w-0 truncate">${esc(fullName(s))}</span>
          <span class="text-slate-300">›</span>
        </button>`).join('')}</div>`}`;

  $('#gBack', main).onclick = () => drawGroups(main);
  $('#gAtt', main).onclick = () => takeAttendance(g, students);
  $('#gHw', main).onclick = () => assignHomework(g);
  $$('[data-st]', main).forEach((b) => b.onclick = () => openStudent(students.find((s) => s.id === b.dataset.st), g));
}

// Davomat + faollik bahosi (bir modalda)
async function takeAttendance(g, students) {
  const d = today();
  const existing = await run(sb.from('attendance').select('student_id,status,activity').eq('group_id', g.id).eq('date', d));
  const exOf = (sid) => existing.find((e) => e.student_id === sid) || {};
  const state = {}; // sid -> {status, activity}
  students.forEach((s) => { const e = exOf(s.id); state[s.id] = { status: e.status || null, activity: e.activity ?? null }; });

  const m = modal(`Davomat — ${g.name}`, `
    <div class="text-xs text-slate-500 mb-3">Sana: <b>${d}</b>. Har o'quvchiga holat va faollik bahosini (0–5) belgilang.</div>
    <div class="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
      ${students.map((s) => `
        <div class="border border-slate-200 rounded-xl p-2.5" data-row="${s.id}">
          <div class="font-semibold text-sm text-slate-700 mb-2">${esc(fullName(s))}</div>
          <div class="flex items-center gap-1.5 flex-wrap">
            ${Object.entries(ATT).map(([k, v]) => `<button type="button" data-set="${s.id}|${k}" class="att-btn px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 text-slate-500">${v[1]} ${v[0]}</button>`).join('')}
            <span class="text-xs text-slate-400 ml-1">Ball:</span>
            <input type="number" min="0" max="5" data-act="${s.id}" value="${state[s.id].activity ?? ''}" class="w-14 border border-slate-200 rounded-lg px-2 py-1 text-sm" placeholder="0-5">
          </div>
        </div>`).join('')}
    </div>
    <div class="flex justify-end gap-2 pt-4">
      <button type="button" data-cancel class="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium">Bekor</button>
      <button type="button" data-save class="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">Saqlash</button>
    </div>`, { wide: false });

  const paintBtns = () => $$('.att-btn', m.body).forEach((b) => {
    const [sid, k] = b.dataset.set.split('|');
    const on = state[sid].status === k;
    const color = ATT[k][2];
    b.className = `att-btn px-2.5 py-1 rounded-lg text-xs font-semibold border ${on ? `bg-${color}-500 text-white border-${color}-500` : 'border-slate-200 text-slate-500'}`;
  });
  paintBtns();
  $$('.att-btn', m.body).forEach((b) => b.onclick = () => {
    const [sid, k] = b.dataset.set.split('|');
    state[sid].status = state[sid].status === k ? null : k;
    paintBtns();
  });
  $('[data-cancel]', m.body).onclick = () => m.close();
  $('[data-save]', m.body).onclick = async () => {
    const btn = $('[data-save]', m.body);
    btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
    const rows = [];
    students.forEach((s) => {
      const actEl = $(`[data-act="${s.id}"]`, m.body);
      const act = actEl && actEl.value !== '' ? Math.max(0, Math.min(5, Number(actEl.value))) : null;
      const st = state[s.id].status;
      if (st || act !== null) rows.push({ group_id: g.id, student_id: s.id, date: d, status: st || 'keldi', activity: act });
    });
    if (rows.length === 0) { toast('Hech narsa belgilanmadi', 'error'); btn.disabled = false; btn.textContent = 'Saqlash'; return; }
    try {
      await run(sb.from('attendance').upsert(rows, { onConflict: 'group_id,student_id,date' }));
      m.close();
      toast(`Davomat saqlandi (${rows.length})`);
      const absent = students.filter((s) => state[s.id].status === 'kelmadi');
      if (absent.length && await confirmDialog(`${absent.length} ta kelmagan o'quvchiga "darsga kelmadingiz" xabari yuborilsinmi?`)) {
        let sent = 0, test = 0, fail = 0;
        for (const s of absent) {
          const res = await smsCall('notify', { type: 'davomat', student_id: s.id, date: d });
          if (res?.ok && (res.status === 'yuborildi' || res.via === 'telegram')) sent++;
          else if (res?.ok && res.test) test++;
          else fail++;
        }
        if (test > 0 && sent === 0) toast(`Sinov rejimi: ${test} ta xabar tayyorlandi (Eskiz/Telegram hali to'liq ulanmagan)`, 'info');
        else toast(`✅ ${sent} ta xabar yuborildi${fail ? `, ${fail} xato` : ''}`);
      }
    } catch (e) { toast('Xatolik: ' + (e.message || ''), 'error'); btn.disabled = false; btn.textContent = 'Saqlash'; }
  };
}

async function assignHomework(g) {
  const v = await formModal(`Uy vazifa — ${g.name}`, [
    { name: 'title', label: 'Sarlavha', required: true, full: true },
    { name: 'due_date', label: 'Muddat', type: 'date', value: today() },
    { name: 'description', label: 'Vazifa matni', type: 'textarea', full: true },
  ], {}, { wide: false });
  if (!v) return;
  try {
    await run(sb.from('homework').insert({ group_id: g.id, title: v.title, due_date: v.due_date, description: v.description }));
    toast('Uy vazifa berildi ✅');
  } catch (e) { toast('Xatolik: ' + (e.message || ''), 'error'); }
}

async function openStudent(s, g) {
  if (!s) return;
  const [att, tres, hw, subs] = await Promise.all([
    run(sb.from('attendance').select('status,activity,date').eq('student_id', s.id).eq('group_id', g.id).order('date', { ascending: false })),
    run(sb.from('test_results').select('correct,total, tests(title,group_id)').eq('student_id', s.id)),
    run(sb.from('homework').select('id,title,due_date').eq('group_id', g.id).order('created_at', { ascending: false })),
    run(sb.from('homework_submissions').select('*').eq('student_id', s.id)),
  ]);
  const total = att.length;
  const came = att.filter((a) => a.status === 'keldi').length;
  const pct = total ? Math.round((came / total) * 100) : 0;
  const acts = att.filter((a) => a.activity != null);
  const avgAct = acts.length ? (acts.reduce((x, a) => x + a.activity, 0) / acts.length).toFixed(1) : '—';
  const gTests = tres.filter((r) => r.tests?.group_id === g.id);
  const subOf = (hid) => subs.find((x) => x.homework_id === hid);

  const m = modal(fullName(s), `
    <div class="flex items-center gap-3 mb-4">${avatar(s, 12)}
      <div><div class="font-bold text-slate-800">${esc(fullName(s))}</div>
      <div class="text-xs text-slate-400">${esc(g.name)}</div></div>
    </div>
    <div class="grid grid-cols-3 gap-2 mb-4">
      <div class="rounded-xl border border-slate-200 p-3 text-center"><div class="text-lg font-extrabold ${pct >= 80 ? 'text-emerald-600' : 'text-amber-600'}">${pct}%</div><div class="text-[10px] text-slate-400 font-semibold uppercase">Davomat</div></div>
      <div class="rounded-xl border border-slate-200 p-3 text-center"><div class="text-lg font-extrabold text-slate-800">${came}/${total}</div><div class="text-[10px] text-slate-400 font-semibold uppercase">Kelgan</div></div>
      <div class="rounded-xl border border-slate-200 p-3 text-center"><div class="text-lg font-extrabold text-blue-600">${avgAct}</div><div class="text-[10px] text-slate-400 font-semibold uppercase">O'rtacha ball</div></div>
    </div>
    ${gTests.length ? `<div class="mb-3"><div class="text-xs font-bold text-slate-500 mb-1.5">📝 Testlar</div>
      <div class="space-y-1">${gTests.map((r) => { const p = r.total ? Math.round(r.correct / r.total * 100) : 0; return `<div class="flex justify-between text-sm"><span class="text-slate-600 truncate">${esc(r.tests?.title || '')}</span><span class="font-bold ${p >= 60 ? 'text-emerald-600' : 'text-rose-500'}">${r.correct}/${r.total}</span></div>`; }).join('')}</div></div>` : ''}
    <div><div class="text-xs font-bold text-slate-500 mb-1.5">📋 Uy vazifalar</div>
      ${hw.length === 0 ? '<div class="text-sm text-slate-400">Vazifa yo\'q</div>' : `<div class="space-y-2">${hw.map((h) => {
        const sub = subOf(h.id);
        return `<div class="border border-slate-200 rounded-xl p-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0"><div class="font-semibold text-sm text-slate-700 truncate">${esc(h.title)}</div>
            <div class="text-[11px] ${sub ? 'text-slate-400' : 'text-amber-600'}">${sub ? (sub.grade != null ? `Baho: ${sub.grade}` : 'Topshirdi — tekshirilmagan') : 'Topshirmagan'}</div></div>
            ${sub ? `<button data-grade="${sub.id}" class="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">${sub.grade != null ? 'O\'zgartir' : 'Baholash'}</button>` : ''}
          </div>
          ${sub?.answer ? `<div class="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2 whitespace-pre-wrap">${esc(sub.answer)}</div>` : ''}
        </div>`;
      }).join('')}</div>`}
    </div>`, { wide: false });

  $$('[data-grade]', m.body).forEach((b) => b.onclick = async () => {
    const sub = subs.find((x) => x.id === b.dataset.grade);
    const v = await formModal('Baholash', [
      { name: 'grade', label: 'Ball (0–100)', type: 'number', value: sub.grade ?? 100, required: true },
      { name: 'feedback', label: 'Izoh (ixtiyoriy)', type: 'textarea', full: true, value: sub.feedback },
    ]);
    if (!v) return;
    await run(sb.from('homework_submissions').update({ grade: Number(v.grade), feedback: v.feedback, graded_at: new Date().toISOString() }).eq('id', sub.id));
    toast('Baholandi ✅'); m.close(); openStudent(s, g);
  });
}

// ---------- CHAT / SAVOLLAR ----------
async function drawChat(main) {
  main.innerHTML = '<div class="text-slate-400 text-sm text-center py-8">Yuklanmoqda...</div>';
  const gids = T.groups.map((g) => g.id);
  const priv = gids.length
    ? await run(sb.from('messages').select('student_id,group_id,body,created_at,sender_role').eq('channel', 'private').in('group_id', gids).order('created_at', { ascending: false }))
    : [];
  const map = new Map();
  for (const m of priv) { const k = `${m.student_id}:${m.group_id}`; if (!map.has(k)) map.set(k, m); }
  const threads = [...map.values()];
  const sIds = [...new Set(threads.map((t) => t.student_id))];
  const students = sIds.length ? await run(sb.from('students').select('id,first_name,last_name').in('id', sIds)) : [];
  const nameOf = (id) => { const s = students.find((x) => x.id === id); return s ? fullName(s) : "O'quvchi"; };
  const gName = (id) => T.groups.find((g) => g.id === id)?.name || '';
  const me = { role: 'oqituvchi', id: T.teacher.id, name: fullName(T.teacher) };

  let sub = 'group', open = null;

  const paint = async () => {
    closeChat();
    if (open) {
      main.innerHTML = `
        <button id="cBack" class="mb-3 text-sm text-slate-500 hover:text-slate-800 font-medium">← Orqaga</button>
        <div class="mb-2 font-bold text-slate-800">${esc(open.title || '')}</div>
        <div id="cbox" style="height:calc(100vh - 210px)"></div>`;
      $('#cBack', main).onclick = () => { open = null; paint(); };
      await mountChat($('#cbox', main), {
        groupId: open.groupId, channel: open.type, studentId: open.studentId || null, me,
        placeholder: open.type === 'private' ? 'Javob yozing...' : 'Guruhga xabar...',
      });
      return;
    }
    main.innerHTML = `
      <div class="flex gap-1.5 mb-4">
        <button data-cs="group" class="flex-1 px-3 py-2 rounded-lg text-sm font-semibold border">💬 Guruh chati</button>
        <button data-cs="private" class="flex-1 px-3 py-2 rounded-lg text-sm font-semibold border">❓ Savollar (${threads.length})</button>
      </div>
      <div id="cList"></div>`;
    $$('[data-cs]', main).forEach((b) => {
      const on = b.dataset.cs === sub;
      b.className = `flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white'}`;
      b.onclick = () => { sub = b.dataset.cs; paint(); };
    });
    const list = $('#cList', main);
    if (sub === 'group') {
      list.innerHTML = T.groups.length === 0 ? card('<div class="text-center text-slate-400 text-sm py-4">Guruh yo\'q</div>')
        : `<div class="space-y-2">${T.groups.map((g) => `
          <button data-g="${g.id}" class="w-full flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3.5 hover:border-blue-300 text-left">
            <span class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">💬</span>
            <span class="font-semibold text-sm text-slate-700 flex-1 min-w-0 truncate">${esc(g.name)}</span><span class="text-slate-300">›</span>
          </button>`).join('')}</div>`;
      $$('[data-g]', list).forEach((b) => b.onclick = () => { open = { type: 'group', groupId: b.dataset.g, title: T.groups.find((g) => g.id === b.dataset.g)?.name }; paint(); });
    } else {
      list.innerHTML = threads.length === 0 ? card('<div class="text-center text-slate-400 text-sm py-6">Hozircha shaxsiy savol yo\'q.</div>')
        : `<div class="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">${threads.map((t) => `
          <button data-th="${t.student_id}:${t.group_id}" class="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3">
            <span class="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">${esc(nameOf(t.student_id).slice(0, 1))}</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center justify-between gap-2"><span class="font-semibold text-sm text-slate-700 truncate">${esc(nameOf(t.student_id))}</span><span class="text-[11px] text-slate-400 shrink-0">${fmtDate(t.created_at)}</span></span>
              <span class="block text-xs text-slate-500 truncate">${t.sender_role === 'student' ? '' : '✓ '}${esc(t.body)}</span>
              <span class="block text-[11px] text-slate-400">${esc(gName(t.group_id))}</span>
            </span>
          </button>`).join('')}</div>`;
      $$('[data-th]', list).forEach((b) => b.onclick = () => { const [sid, gid] = b.dataset.th.split(':'); open = { type: 'private', groupId: gid, studentId: sid, title: nameOf(sid) + ' — savol' }; paint(); });
    }
  };
  await paint();
}

// ---------- PROFIL ----------
async function uploadPhoto(file, keyPrefix) {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'jpg';
  const path = `${keyPrefix}_${(crypto.randomUUID?.() || String(Date.now())).replace(/[^\w-]/g, '')}.${ext}`;
  const { error } = await sb.storage.from('hodim-rasmlar').upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (error) throw error;
  return sb.storage.from('hodim-rasmlar').getPublicUrl(path).data.publicUrl;
}

function drawProfile(main) {
  const t = T.teacher;
  main.innerHTML = `
    <div class="flex flex-col items-center py-4">
      <div class="relative">
        ${avatar(t, 24)}
        <label class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer border-2 border-white shadow">
          📷<input type="file" accept="image/*" id="photoInp" class="hidden">
        </label>
      </div>
      <div class="mt-3 font-bold text-lg text-slate-800">${esc(fullName(t))}</div>
      <div class="text-sm text-slate-400">O'qituvchi</div>
    </div>
    <div class="space-y-2 mt-2">
      <button id="editName" class="w-full flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3.5 text-sm font-medium text-slate-700 hover:border-blue-300">✏️ Ismni o'zgartirish</button>
      <button id="switchT" class="w-full flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3.5 text-sm font-medium text-slate-700 hover:border-blue-300">🔄 Boshqa o'qituvchi</button>
      <button id="profLogout" class="w-full flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3.5 text-sm font-medium text-rose-600 hover:border-rose-300">↩ Chiqish</button>
    </div>`;

  $('#photoInp', main).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Rasm 5 MB dan katta', 'error');
    toast('Yuklanmoqda...', 'info');
    try {
      const url = await uploadPhoto(file, `emp_${t.id}`);
      await run(sb.from('employees').update({ photo_url: url }).eq('id', t.id));
      T.teacher.photo_url = url;
      localStorage.setItem('finway_teacher', t.id);
      toast('Rasm yangilandi ✅'); renderPanel();
    } catch (err) { toast('Xatolik: ' + (err.message || ''), 'error'); }
  };
  $('#editName', main).onclick = async () => {
    const v = await formModal('Ismni o\'zgartirish', [
      { name: 'first_name', label: 'Ism', required: true, value: t.first_name },
      { name: 'last_name', label: 'Familiya', value: t.last_name },
    ]);
    if (!v) return;
    await run(sb.from('employees').update({ first_name: v.first_name, last_name: v.last_name }).eq('id', t.id));
    T.teacher.first_name = v.first_name; T.teacher.last_name = v.last_name;
    toast('Saqlandi'); renderPanel();
  };
  $('#switchT', main).onclick = () => { localStorage.removeItem('finway_teacher'); renderTeacherApp(T.centerName); };
  $('#profLogout', main).onclick = doLogout;
}

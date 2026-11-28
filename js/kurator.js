// Kurator paneli — faqat onlayn kurs.
//
// Kurator o'quvchilarning savollariga javob beradi va ular qanday natija
// qilayotganini kuzatadi. Moliya, guruhlar, davomat, lidlar — bu yerda yo'q.
//
// Uch bo'lim:
//   Savollar   — o'quvchilar yozgan shaxsiy savollar (javob shu yerda yoziladi)
//   O'quvchilar — kim qancha dars ko'rgan, vazifalarni necha foizga yechgan
//   Darslar    — kursdagi modul va darslar ro'yxati (savolga javob berish uchun)
import { sb, run } from './db.js';
import { $, $$, esc, toast, fmtDate } from './ui.js';
import { currentUser } from './app.js';
import { mountChat, closeChat } from './chat.js';
import { resolveVideoUrl } from './video-store.js';
import { runVazifa } from './student.js';

const OTISH_FOIZ = 80;

let K = {
  tab: 'savollar',
  centerName: "O'quv markazi",
  ochiqSavol: null,     // tanlangan o'quvchi (savollar bo'limi)
  ochiqOquvchi: null,   // tanlangan o'quvchi (natijalar bo'limi)
  data: null,
};

const TABS = [
  { id: 'savollar', label: 'Savollar', icon: '❓' },
  { id: 'oquvchilar', label: "O'quvchilar", icon: '🎓' },
  { id: 'darslar', label: 'Darslar', icon: '📚' },
];

const ism = (s) => `${s?.first_name || ''} ${s?.last_name || ''}`.trim() || "O'quvchi";
const bosh = (s) => (ism(s).slice(0, 1) || '?').toUpperCase();
const foiz = (r) => (r && r.total ? Math.round((r.correct / r.total) * 100) : 0);

function vaqt(t) {
  if (!t) return '';
  const d = new Date(t);
  const bugun = new Date();
  const shuKun = d.toDateString() === bugun.toDateString();
  const soat = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return shuKun ? soat : `${fmtDate(d)} ${soat}`;
}

// --- Ma'lumotlarni bir marta yig'amiz ---
//
// Har bir so'rov alohida himoyalangan: bittasi ishlamay qolsa ham panel
// ochiladi, faqat o'sha bo'lim bo'sh turadi va tepada ogohlantirish chiqadi.
// Aks holda bitta xato butun ekranni "Ma'lumot yuklanmadi" ga aylantirardi.
async function malumot() {
  const xatolar = [];
  const oq = async (q, nom) => {
    try { return (await run(q)) || []; } catch (e) {
      xatolar.push(`${nom}: ${String(e?.message || e).slice(0, 120)}`);
      return [];
    }
  };

  const [kurslar, oquvchilar, xabarlar] = await Promise.all([
    oq(sb.from('courses').select('id,name').order('name'), 'Kurslar'),
    oq(sb.from('student_courses').select('student_id, course_id, students(id,first_name,last_name,phone)'), "O'quvchilar"),
    oq(sb.from('messages').select('student_id, body, created_at, sender_role')
      .eq('channel', 'private').is('group_id', null).order('created_at', { ascending: false }), 'Savollar'),
  ]);

  const stud = [];
  const korilgan = new Set();
  for (const r of oquvchilar || []) {
    const s = r.students;
    if (!s || korilgan.has(s.id)) continue;
    korilgan.add(s.id);
    stud.push({ ...s, course_id: r.course_id });
  }
  stud.sort((a, b) => ism(a).localeCompare(ism(b)));

  const sIds = stud.map((s) => s.id);
  const kursIds = [...new Set(stud.map((s) => s.course_id).filter(Boolean))];

  const [modullar, progress, natijalar] = await Promise.all([
    kursIds.length
      ? oq(sb.from('course_modules').select('id,title,sort_order,opens_at,locked,course_id').in('course_id', kursIds).order('sort_order'), 'Modullar')
      : Promise.resolve([]),
    sIds.length
      ? oq(sb.from('lesson_progress').select('student_id, lesson_id, completed, updated_at').in('student_id', sIds), 'Darslar progressi')
      : Promise.resolve([]),
    sIds.length
      ? oq(sb.from('test_results').select('student_id, test_id, correct, total, taken_at, finished_at').in('student_id', sIds), 'Vazifa natijalari')
      : Promise.resolve([]),
  ]);

  const modIds = modullar.map((m) => m.id);
  const darslar = modIds.length
    ? await oq(sb.from('course_lessons').select('id,title,description,module_id,sort_order,duration_min,qoshimcha,video_provider,video_path,video_url,pdf_url,pdf_name').in('module_id', modIds).order('sort_order'), 'Darslar')
    : [];
  const lesIds = darslar.map((l) => l.id);
  const vazifalar = lesIds.length
    ? await oq(sb.from('tests').select('*').in('lesson_id', lesIds).eq('active', true).order('tartib'), 'Vazifalar')
    : [];

  return { kurslar, stud, xabarlar, modullar, darslar, vazifalar, progress, natijalar, xatolar };
}

export async function renderKuratorApp(centerName) {
  K = { tab: 'savollar', centerName: centerName || "O'quv markazi", ochiqSavol: null, ochiqOquvchi: null, data: null };
  $('#app').innerHTML = `
    <div class="min-h-screen bg-slate-100 flex items-center justify-center">
      <div class="text-slate-400 text-sm">Yuklanmoqda...</div>
    </div>`;
  try {
    K.data = await malumot();
  } catch (e) {
    // Bu yerga faqat kutilmagan nosozlikda tushamiz (masalan tarmoq uzilsa)
    $('#app').innerHTML = `<div class="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-center">
      <div><div class="text-3xl mb-2">⚠️</div><div class="text-slate-600 font-semibold">Ma'lumot yuklanmadi</div>
      <div class="text-xs text-slate-400 mt-2 max-w-xs mx-auto">${esc(String(e?.message || e).slice(0, 160))}</div>
      <button id="qayta" class="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">Qayta urinish</button></div></div>`;
    $('#qayta').onclick = () => renderKuratorApp(centerName);
    return;
  }
  chiz();
}

function chiz() {
  $('#app').innerHTML = `
    <div class="min-h-screen bg-slate-100 flex flex-col">
      <header class="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div class="mx-auto px-4 py-3 flex items-center gap-3" style="max-width:48rem">
          <div class="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center text-lg shrink-0">👩‍🏫</div>
          <div class="min-w-0 flex-1">
            <div class="font-extrabold text-slate-800 truncate">${esc(currentUser.name || 'Kurator')}</div>
            <div class="text-[11px] text-slate-400">Kurator · ${esc(K.centerName)}</div>
          </div>
          <button id="kChiq" class="text-xs text-slate-400 hover:text-rose-500 shrink-0">Chiqish</button>
        </div>
      </header>

      ${(K.data?.xatolar || []).length ? `<div class="w-full mx-auto px-4 pt-3" style="max-width:48rem">
        <div class="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <div class="text-xs font-bold text-amber-800">Ba'zi ma'lumotlar yuklanmadi</div>
          <div class="text-[11px] text-amber-700 mt-0.5">${esc(K.data.xatolar.join(' · '))}</div>
        </div>
      </div>` : ''}

      <main id="kMain" class="flex-1 w-full mx-auto px-4 py-4 pb-24" style="max-width:48rem"></main>

      <nav class="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-20">
        <div class="mx-auto grid grid-cols-3" style="max-width:48rem">
          ${TABS.map((t) => `
            <button data-tab="${t.id}" class="py-2.5 flex flex-col items-center gap-0.5 transition">
              <span class="text-lg">${t.icon}</span>
              <span class="text-[11px] font-semibold">${t.label}</span>
            </button>`).join('')}
        </div>
      </nav>
    </div>`;

  $$('#app [data-tab]').forEach((b) => {
    const on = b.dataset.tab === K.tab;
    b.className = `py-2.5 flex flex-col items-center gap-0.5 transition ${on ? 'text-violet-600' : 'text-slate-400'}`;
    b.onclick = () => { K.tab = b.dataset.tab; K.ochiqSavol = null; K.ochiqOquvchi = null; closeChat(); chiz(); };
  });
  $('#kChiq').onclick = async () => {
    closeChat();
    try { localStorage.removeItem('finway_teacher'); } catch { /* yopiq rejim */ }
    await sb.auth.signOut();
    location.reload();
  };

  const main = $('#kMain');
  if (K.tab === 'savollar') return savollarBolimi(main);
  if (K.tab === 'oquvchilar') return oquvchilarBolimi(main);
  return darslarBolimi(main);
}

// ============ SAVOLLAR ============
function savollarBolimi(main) {
  const { stud, xabarlar } = K.data;

  if (K.ochiqSavol) {
    const s = K.ochiqSavol;
    main.innerHTML = `
      <button id="orqaga" class="text-sm text-slate-500 hover:text-slate-700 mb-3">← Savollar</button>
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-bold">${esc(bosh(s))}</div>
          <div class="min-w-0">
            <div class="font-bold text-slate-800 truncate">${esc(ism(s))}</div>
            <div class="text-[11px] text-slate-400">${esc(s.phone || '')}</div>
          </div>
        </div>
        <div id="kChat" class="h-[60vh]"></div>
      </div>`;
    $('#orqaga').onclick = () => { K.ochiqSavol = null; closeChat(); chiz(); };
    mountChat($('#kChat'), {
      groupId: null,
      channel: 'private',
      studentId: s.id,
      me: { role: 'kurator', id: currentUser.empId || null, name: currentUser.name || 'Kurator' },
      placeholder: 'Javob yozing...',
    });
    return;
  }

  // Har bir o'quvchi bo'yicha oxirgi xabar
  const oxirgi = new Map();
  for (const m of xabarlar) {
    if (!m.student_id) continue;
    if (!oxirgi.has(m.student_id)) oxirgi.set(m.student_id, m);
  }
  const suhbatlar = stud
    .filter((s) => oxirgi.has(s.id))
    .map((s) => ({ s, m: oxirgi.get(s.id) }))
    .sort((a, b) => String(b.m.created_at).localeCompare(String(a.m.created_at)));

  const javobsiz = suhbatlar.filter((x) => x.m.sender_role === 'student');

  main.innerHTML = `
    ${javobsiz.length ? `<div class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 mb-3">
      <span class="text-lg">⏳</span>
      <div class="text-sm font-semibold text-amber-800">${javobsiz.length} ta savol javob kutmoqda</div>
    </div>` : ''}

    ${suhbatlar.length === 0
      ? `<div class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
           <div class="text-3xl mb-2">💬</div>
           <div class="text-slate-500 text-sm">Hali savol kelmagan.</div>
         </div>`
      : `<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          ${suhbatlar.map(({ s, m }) => {
            const kutmoqda = m.sender_role === 'student';
            return `<button data-s="${esc(s.id)}" class="w-full text-left px-4 py-3 flex items-start gap-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
              <div class="w-10 h-10 rounded-xl ${kutmoqda ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'} flex items-center justify-center font-bold shrink-0">${esc(bosh(s))}</div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-800 truncate">${esc(ism(s))}</span>
                  ${kutmoqda ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">javob kutyapti</span>' : ''}
                  <span class="text-[11px] text-slate-400 ml-auto shrink-0">${esc(vaqt(m.created_at))}</span>
                </div>
                <div class="text-sm text-slate-500 truncate mt-0.5">${kutmoqda ? '' : '<span class="text-slate-400">Siz: </span>'}${esc(String(m.body || '').slice(0, 90))}</div>
              </div>
            </button>`;
          }).join('')}
        </div>`}

    <div class="mt-4 bg-white rounded-2xl border border-slate-200 p-4">
      <div class="text-xs font-bold text-slate-500 mb-2">Savol yozmagan o'quvchilar</div>
      <div class="flex flex-wrap gap-1.5">
        ${stud.filter((s) => !oxirgi.has(s.id)).map((s) => `
          <button data-s="${esc(s.id)}" class="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-600 transition">${esc(ism(s))}</button>`).join('')
          || '<span class="text-xs text-slate-400">Hammasi yozgan</span>'}
      </div>
    </div>`;

  $$('[data-s]', main).forEach((b) => b.onclick = () => {
    K.ochiqSavol = K.data.stud.find((x) => String(x.id) === b.dataset.s) || null;
    chiz();
  });
}

// ============ O'QUVCHILAR (natijalar) ============
function oquvchilarBolimi(main) {
  const { stud, darslar, vazifalar, progress, natijalar } = K.data;

  const asosiy = darslar.filter((l) => !l.qoshimcha);
  const tugatgan = (sid) => progress.filter((p) => p.student_id === sid && p.completed).length;
  const natijaOf = (sid, tid) => natijalar.find((r) => r.student_id === sid && r.test_id === tid);
  const otgan = (sid) => vazifalar.filter((t) => foiz(natijaOf(sid, t.id)) >= OTISH_FOIZ).length;
  const oxirgiFaollik = (sid) => {
    const p = progress.filter((x) => x.student_id === sid).map((x) => x.updated_at);
    const n = natijalar.filter((x) => x.student_id === sid).map((x) => x.finished_at || x.taken_at);
    const hammasi = [...p, ...n].filter(Boolean).sort();
    return hammasi.length ? hammasi[hammasi.length - 1] : null;
  };

  if (K.ochiqOquvchi) {
    const s = K.ochiqOquvchi;
    const modBoyicha = K.data.modullar.map((m) => {
      const ls = darslar.filter((l) => l.module_id === m.id);
      const vs = vazifalar.filter((t) => ls.some((l) => l.id === t.lesson_id));
      return { m, ls, vs };
    }).filter((x) => x.ls.length);

    main.innerHTML = `
      <button id="orqaga" class="text-sm text-slate-500 hover:text-slate-700 mb-3">← O'quvchilar</button>
      <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-lg font-bold">${esc(bosh(s))}</div>
          <div class="min-w-0 flex-1">
            <div class="font-extrabold text-slate-800 truncate">${esc(ism(s))}</div>
            <div class="text-xs text-slate-400">${esc(s.phone || '')}</div>
          </div>
          <button data-savol="${esc(s.id)}" class="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold shrink-0">💬 Yozish</button>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-4">
          <div class="rounded-xl bg-slate-50 p-2.5 text-center">
            <div class="text-lg font-extrabold text-slate-800">${tugatgan(s.id)}</div>
            <div class="text-[10px] text-slate-400 font-semibold">dars tugatgan</div>
          </div>
          <div class="rounded-xl bg-slate-50 p-2.5 text-center">
            <div class="text-lg font-extrabold text-slate-800">${otgan(s.id)}/${vazifalar.length}</div>
            <div class="text-[10px] text-slate-400 font-semibold">vazifa o'tgan</div>
          </div>
          <div class="rounded-xl bg-slate-50 p-2.5 text-center">
            <div class="text-[13px] font-extrabold text-slate-800 leading-tight pt-1">${esc(vaqt(oxirgiFaollik(s.id)) || '—')}</div>
            <div class="text-[10px] text-slate-400 font-semibold">oxirgi faollik</div>
          </div>
        </div>
      </div>

      ${modBoyicha.map(({ m, ls, vs }) => `
        <div class="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <div class="font-bold text-slate-800 mb-2">${esc(m.title)}</div>
          <div class="space-y-1.5">
            ${ls.map((l) => {
              const done = progress.some((p) => p.student_id === s.id && p.lesson_id === l.id && p.completed);
              return `<div class="flex items-center gap-2 text-sm">
                <span class="shrink-0">${done ? '✅' : '⬜️'}</span>
                <span class="min-w-0 flex-1 truncate ${done ? 'text-slate-700' : 'text-slate-400'}">${esc(l.title)}</span>
              </div>`;
            }).join('')}
          </div>
          ${vs.length ? `<div class="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            ${vs.map((t) => {
              const r = natijaOf(s.id, t.id);
              const f = foiz(r);
              const rang = !r ? 'text-slate-400' : f >= OTISH_FOIZ ? 'text-emerald-600' : 'text-amber-600';
              return `<div class="flex items-center gap-2 text-sm">
                <span class="min-w-0 flex-1 truncate text-slate-600">${esc(t.title)}</span>
                <span class="font-bold shrink-0 ${rang}">${r ? `${r.correct}/${r.total} · ${f}%` : 'yechmagan'}</span>
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>`).join('')}`;

    $('#orqaga').onclick = () => { K.ochiqOquvchi = null; chiz(); };
    const sb2 = $('[data-savol]', main);
    if (sb2) sb2.onclick = () => { K.ochiqSavol = s; K.tab = 'savollar'; K.ochiqOquvchi = null; chiz(); };
    return;
  }

  const jamiDars = asosiy.length + darslar.filter((l) => l.qoshimcha).length;

  main.innerHTML = `
    <div class="grid grid-cols-3 gap-2 mb-3">
      <div class="bg-white rounded-xl border border-slate-200 p-3 text-center">
        <div class="text-xl font-extrabold text-slate-800">${stud.length}</div>
        <div class="text-[10px] text-slate-400 font-semibold">o'quvchi</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-3 text-center">
        <div class="text-xl font-extrabold text-slate-800">${jamiDars}</div>
        <div class="text-[10px] text-slate-400 font-semibold">dars</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-3 text-center">
        <div class="text-xl font-extrabold text-slate-800">${vazifalar.length}</div>
        <div class="text-[10px] text-slate-400 font-semibold">vazifa</div>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      ${stud.length === 0
        ? '<div class="p-8 text-center text-slate-400 text-sm">Onlayn o\'quvchi yo\'q</div>'
        : stud.map((s) => {
          const d = tugatgan(s.id);
          const v = otgan(s.id);
          const faol = oxirgiFaollik(s.id);
          const holat = !faol ? ['bg-rose-50 text-rose-600', 'hali kirmagan']
            : d === 0 ? ['bg-amber-50 text-amber-600', 'boshlamagan']
              : ['bg-emerald-50 text-emerald-600', 'ishlayapti'];
          return `<button data-o="${esc(s.id)}" class="w-full text-left px-4 py-3 flex items-center gap-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
            <div class="w-10 h-10 rounded-xl ${holat[0]} flex items-center justify-center font-bold shrink-0">${esc(bosh(s))}</div>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-slate-800 truncate">${esc(ism(s))}</div>
              <div class="text-[11px] text-slate-400">${esc(holat[1])}${faol ? ` · ${esc(vaqt(faol))}` : ''}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-sm font-bold text-slate-700">${d} dars</div>
              <div class="text-[11px] ${v ? 'text-emerald-600 font-semibold' : 'text-slate-400'}">${v}/${vazifalar.length} vazifa</div>
            </div>
          </button>`;
        }).join('')}
    </div>`;

  $$('[data-o]', main).forEach((b) => b.onclick = () => {
    K.ochiqOquvchi = K.data.stud.find((x) => String(x.id) === b.dataset.o) || null;
    chiz();
  });
}

// ============ DARSLAR ============
function darslarBolimi(main) {
  const { modullar, darslar, vazifalar } = K.data;
  const bugun = (() => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  main.innerHTML = modullar.length === 0
    ? '<div class="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Kurs hali to\'ldirilmagan</div>'
    : modullar.map((m) => {
      const ls = darslar.filter((l) => l.module_id === m.id);
      const kutilmoqda = !m.locked && m.opens_at && m.opens_at > bugun;
      return `<div class="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
        <div class="flex items-center gap-2 mb-1">
          <div class="font-bold text-slate-800 min-w-0 flex-1">${esc(m.title)}</div>
          ${kutilmoqda
            ? `<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500 shrink-0">${esc(m.opens_at)} da ochiladi</span>`
            : '<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">ochiq</span>'}
        </div>
        ${ls.length === 0
          ? '<div class="text-xs text-slate-400 mt-2">Dars yo\'q</div>'
          : `<div class="space-y-1.5 mt-2">
            ${ls.map((l) => {
              const vs = vazifalar.filter((t) => t.lesson_id === l.id);
              return `<button data-dars="${esc(l.id)}" class="w-full flex items-center gap-2 text-sm text-left px-2 py-1.5 -mx-2 rounded-lg hover:bg-slate-50 transition">
                <span class="shrink-0">${l.qoshimcha ? '➕' : '🎬'}</span>
                <span class="min-w-0 flex-1 truncate text-slate-700">${esc(l.title)}</span>
                <span class="text-[11px] text-slate-400 shrink-0">${l.duration_min ? `${l.duration_min} daq` : ''}${vs.length ? ` · ${vs.length} vazifa` : ''}</span>
                <span class="text-slate-400 shrink-0">›</span>
              </button>`;
            }).join('')}
          </div>`}
      </div>`;
    }).join('');

  $$('[data-dars]', main).forEach((b) => b.onclick = () => {
    const l = K.data.darslar.find((x) => String(x.id) === b.dataset.dars);
    if (l) darsOch(l);
  });
}

// ============ DARSNI KO'RISH (tekshiruv rejimi) ============
//
// Kurator darsni xuddi o'quvchi kabi ochadi: video, material, vazifalar.
// Farqi bitta — vazifa yechilsa natija saqlanmaydi va guruhga xabar ketmaydi.
async function darsOch(l) {
  closeChat();
  const vs = K.data.vazifalar.filter((t) => t.lesson_id === l.id)
    .sort((a, b) => (a.tartib || 0) - (b.tartib || 0));

  $('#app').innerHTML = `
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <div class="mx-auto px-4 py-4" style="max-width:42rem" id="kDars">
        <button id="kOrqa" class="text-sm text-slate-400 hover:text-slate-200 mb-3">← Darslar</button>
        <div class="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 mb-4">
          <span class="text-base">🔍</span>
          <div class="text-xs font-semibold text-amber-200">Tekshiruv rejimi — natija saqlanmaydi, guruhga xabar ketmaydi</div>
        </div>
        <h1 class="text-lg font-extrabold mb-1">${esc(l.title)}</h1>
        ${l.description ? `<div class="text-sm text-slate-400 mb-3 whitespace-pre-wrap leading-relaxed">${esc(l.description)}</div>` : ''}
        <div id="kVideo" class="mb-3"></div>
        ${l.pdf_url ? `<a href="${esc(l.pdf_url)}" target="_blank" rel="noopener"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold mb-3">📄 ${esc(l.pdf_name || 'Material')}</a>` : ''}
        ${vs.length ? `<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div class="text-xs font-bold text-slate-400 mb-2">Vazifalar</div>
          <div class="space-y-1.5">
            ${vs.map((t, i) => `<button data-v="${esc(t.id)}" class="w-full text-left px-3.5 py-3 rounded-xl border border-indigo-500/40 bg-indigo-600/10 hover:bg-indigo-600/20 transition flex items-center gap-3">
              <span class="w-8 h-8 shrink-0 rounded-lg bg-indigo-500/25 text-indigo-200 flex items-center justify-center text-sm font-bold">${i + 1}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold truncate">${esc(t.title)}</span>
                <span class="block text-[11px] text-indigo-300/80">${(t.questions || []).length} ta savol${t.time_limit ? ` · ${t.time_limit} daqiqa` : ''}</span>
              </span>
              <span class="text-slate-500">›</span>
            </button>`).join('')}
          </div>
        </div>` : '<div class="text-sm text-slate-500">Bu darsda vazifa yo\'q</div>'}
      </div>
    </div>`;

  $('#kOrqa').onclick = () => chiz();
  $$('#kDars [data-v]').forEach((b) => b.onclick = () => {
    const t = vs.find((x) => String(x.id) === b.dataset.v);
    if (t) runVazifa(t, $('#kDars'), () => darsOch(l), { sinov: true, nom: currentUser.name || 'Kurator' });
  });

  // Video — R2 uchun vaqtincha havola so'raladi
  const vd = $('#kVideo');
  if (!l.video_path && !l.video_url) {
    vd.innerHTML = '<div class="text-sm text-slate-500 mb-2">Bu darsda video yo\'q</div>';
    return;
  }
  vd.innerHTML = '<div class="text-sm text-slate-500">Video yuklanmoqda...</div>';
  try {
    const src = await resolveVideoUrl(l);
    if (!src) throw new Error('Havola olinmadi');
    vd.innerHTML = `<div class="relative w-full rounded-xl overflow-hidden bg-black" style="aspect-ratio:16/9">
      <video class="absolute inset-0 w-full h-full" controls playsinline preload="metadata" src="${esc(src)}"></video>
    </div>`;
  } catch (e) {
    vd.innerHTML = `<div class="text-sm text-rose-300">Video ochilmadi: ${esc(String(e?.message || e).slice(0, 100))}</div>`;
  }
}

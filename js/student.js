// O'quvchi portali (DARK dizayn) — guruh, davomat, dars mavzulari, o'yin (coin),
// guruh chati va o'qituvchiga shaxsiy savol. Telefon uchun moslashtirilgan.
import { sb, run } from './db.js';
import { $, $$, esc, fmtDate, fmtDays, fmtTime, toast, today, formModal, modal, confirmDialog } from './ui.js';
import { mountChat, closeChat } from './chat.js';
import { renderGame } from './game.js';
import { isFileVideo, resolveVideoUrl } from './video-store.js';
import { openPdfViewer, closePdfViewer } from './pdf-viewer.js';

const ATT = {
  keldi: ['Keldi', '✅', 'text-emerald-400'],
  kelmadi: ['Kelmadi', '❌', 'text-rose-400'],
  sababli: ['Sababli', '⚠️', 'text-amber-400'],
};

const ALL_TABS = [
  { id: 'home', label: 'Bosh', icon: '🏠' },
  { id: 'library', label: 'Darslik', icon: '📚' },
  { id: 'game', label: "O'yin", icon: '🎮' },
  { id: 'attend', label: 'Davomat', icon: '📋' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'profile', label: 'Profil', icon: '👤' },
];
// Onlayn o'quvchida guruh bo'lmaydi — davomat ham bo'lmaydi
const tabsFor = () => ALL_TABS.filter((t) => t.id !== 'attend' || S.groupId);

// Darslik ichki bo'limlari
const LIB_SUBS = [
  { id: 'darslar', label: 'Darslar', icon: '🎬' },
  { id: 'sinf', label: 'Sinf ishi', icon: '📝' },
  { id: 'uy', label: 'Uy ishi', icon: '📋' },
];
// Chat ichki bo'limlari
const CHAT_SUBS = [
  { id: 'group', label: 'Guruh chati', icon: '💬' },
  { id: 'private', label: "O'qituvchiga savol", icon: '❓' },
];

let S = { student: null, groups: [], groupId: null, tab: 'home', centerName: "O'quv markazi", coins: 0, photo: null };
const JOB_GOAL = 2500; // 🏆 ishga joylash chegarasi (o'yin bilan bir xil)

const sInit = (n) => (String(n || '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()) || '👤';
function sAvatar(size = 10) {
  const cls = `w-${size} h-${size}`;
  return S.photo
    ? `<img src="${esc(S.photo)}" class="${cls} rounded-full object-cover border border-white/10 shrink-0">`
    : `<span class="${cls} rounded-full bg-indigo-500/25 text-indigo-200 flex items-center justify-center font-bold border border-white/10 shrink-0">${esc(sInit(S.me?.name))}</span>`;
}
// Doiraviy progress ring (SVG)
function ring(pct, centerHtml, color = '#818cf8', size = 76) {
  pct = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = (size / 2) - 6, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<div class="relative shrink-0" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" class="w-full h-full" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="6"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center leading-none">${centerHtml}</div>
  </div>`;
}
function miniRing(pct, label, color) {
  return `<div class="flex flex-col items-center gap-2">
    ${ring(pct, `<div class="text-sm font-extrabold text-white">${Math.round(pct)}<span class="text-[9px] font-bold">%</span></div>`, color, 66)}
    <div class="text-[11px] font-semibold text-slate-300 text-center">${esc(label)}</div>
  </div>`;
}

export async function renderStudentApp(student, centerName) {
  S = { student, groups: [], groupId: null, courses: [], courseId: null, tab: 'home', centerName: centerName || "O'quv markazi", coins: 0, libSub: 'darslar', chatSub: 'group' };
  S.me = { role: 'student', id: S.student.id, name: `${S.student.first_name} ${S.student.last_name || ''}`.trim() };

  const [memberships, coinRow, myCourses] = await Promise.all([
    run(sb.from('group_students')
      .select('groups(id,name,course_id,teacher_id,room_id,days,start_time,end_time,is_online,lesson_link,price,courses(name),employees(first_name,last_name),rooms(name))')
      .eq('student_id', student.id).eq('status', 'aktiv')),
    run(sb.from('students').select('coins,photo_url,mode').eq('id', student.id).single()),
    run(sb.from('student_courses').select('course_id,access_until,courses(id,name)').eq('student_id', student.id)),
  ]);
  S.groups = memberships.map((m) => m.groups).filter(Boolean);
  S.groupId = S.groups[0]?.id || null;
  S.coins = Number(coinRow?.coins || 0);
  S.photo = coinRow?.photo_url || null;
  S.mode = coinRow?.mode || student.mode || 'offline';
  // Onlayn kurslar: muddati o'tmaganlari
  const bugun = today();
  S.courses = (myCourses || [])
    .filter((c) => !c.access_until || c.access_until >= bugun)
    .map((c) => c.courses)
    .filter(Boolean);
  S.courseId = S.courses[0]?.id || null;

  $('#app').innerHTML = `
    <div id="sShell" class="min-h-screen flex flex-col text-slate-100 max-w-lg mx-auto relative" style="background:radial-gradient(130% 55% at 50% -5%, #263568 0%, #131a35 45%, #0a0f22 100%); background-attachment:fixed;">
      <header id="sHeader" class="px-5 pt-5 pb-4 sticky top-0 z-20 backdrop-blur-xl border-b border-white/5" style="background:linear-gradient(to bottom, rgba(12,17,36,.75), rgba(12,17,36,.25));">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            ${sAvatar(10)}
            <div class="min-w-0">
              <div class="text-[11px] text-indigo-300/70">${esc(S.centerName)}</div>
              <div class="font-bold text-[15px] leading-tight truncate">${esc(S.me.name)}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div id="coinChip" class="flex items-center gap-1 text-amber-300 border border-amber-400/25 px-2.5 py-1.5 rounded-xl text-sm font-bold" style="background:linear-gradient(135deg, rgba(245,158,11,.18), rgba(245,158,11,.06)); box-shadow:0 0 18px -6px rgba(245,158,11,.5);">🪙 ${S.coins}</div>
            <button id="sLogout" class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-sm">⏻</button>
          </div>
        </div>
      </header>
      <main id="sMain" class="flex-1 p-4 pb-28 fade-in relative z-10"></main>
      <nav id="sNav" class="fixed bottom-0 inset-x-0 max-w-lg mx-auto flex z-20 px-1.5 pt-1.5 pb-2 backdrop-blur-xl border-t border-white/5" style="background:linear-gradient(to top, rgba(10,15,34,.95), rgba(10,15,34,.7));">
        ${tabsFor().map((t) => `
          <button data-tab="${t.id}" class="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl text-[9px] font-semibold text-slate-500 transition">
            <span class="text-[17px] leading-none">${t.icon}</span>${t.label}
          </button>`).join('')}
      </nav>
    </div>`;

  $('#sLogout').onclick = doLogout;
  $$('[data-tab]').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; drawTab(); });

  drawTab();
}

// Chiqishdan oldin tasdiqlash so'raydi
async function doLogout() {
  const ok = await confirmDialog('Hisobdan chiqmoqchimisiz?');
  if (!ok) return;
  closeChat();
  localStorage.removeItem('finway_student');
  await sb.auth.signOut();
  location.reload();
}

export function setCoins(coins) {
  S.coins = coins;
  const chip = $('#coinChip');
  if (chip) chip.innerHTML = `🪙 ${Number(coins).toLocaleString('ru-RU').replace(/,/g, ' ')}`;
}

function setNav() {
  $$('[data-tab]').forEach((b) => {
    const on = b.dataset.tab === S.tab;
    b.className = `flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl text-[9px] font-semibold transition ${on ? 'text-white' : 'text-slate-500'}`;
    b.style.cssText = on ? 'background:linear-gradient(160deg, rgba(99,102,241,.38), rgba(99,102,241,.10)); box-shadow:0 0 16px -4px rgba(99,102,241,.6);' : '';
  });
}

async function drawTab() {
  closeChat();
  closePdfViewer();   // bo'lim almashganda PDF ochiq qolmasin
  setNav();
  const main = $('#sMain');
  main.scrollTop = 0;

  if (S.tab === 'game') return renderGame(main, S.student, setCoins);
  if (S.tab === 'profile') return drawProfile(main);

  if (!S.groupId && !S.courses.length) {
    main.innerHTML = card(`<div class="text-center py-8 text-slate-500 text-sm">
      ${S.mode === 'onlayn' || S.mode === 'aralash'
        ? "Sizga hali kurs ochilmagan.<br>Administrator bilan bog'laning."
        : "Siz hali biror guruhga qo'shilmagansiz.<br>Administrator bilan bog'laning."}</div>`);
    return;
  }

  if (S.tab === 'home') return S.groupId ? drawHome(main) : drawHomeOnline(main);
  if (S.tab === 'library') return drawLibrary(main);
  if (S.tab === 'attend') return drawAttend(main);
  if (S.tab === 'chat') return drawChat(main);
}

const card = (inner, cls = '') => `<div class="rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg shadow-black/20 p-4 ${cls}">${inner}</div>`;

function groupSwitcher() {
  if (S.groups.length < 2) return '';
  return `<select id="grpSw" class="w-full mb-3 border border-white/10 bg-white/5 text-slate-100 rounded-xl px-3 py-2.5 text-sm font-medium backdrop-blur">
    ${S.groups.map((g) => `<option value="${g.id}" ${g.id === S.groupId ? 'selected' : ''} class="bg-slate-900">${esc(g.name)} — ${esc(g.courses?.name || '')}</option>`).join('')}
  </select>`;
}

// Onlayn o'quvchida guruh emas, kurs tanlanadi
function courseSwitcher() {
  if (S.courses.length < 2) return '';
  return `<select id="crsSw" class="w-full mb-3 border border-white/10 bg-white/5 text-slate-100 rounded-xl px-3 py-2.5 text-sm font-medium backdrop-blur">
    ${S.courses.map((c) => `<option value="${c.id}" ${c.id === S.courseId ? 'selected' : ''} class="bg-slate-900">${esc(c.name)}</option>`).join('')}
  </select>`;
}

function bindSwitcher() {
  const sw = $('#grpSw');
  if (sw) sw.onchange = (e) => { S.groupId = e.target.value; drawTab(); };
  const cw = $('#crsSw');
  if (cw) cw.onchange = (e) => { S.courseId = e.target.value; drawTab(); };
}

// Hozir ko'rilayotgan kursning id si (guruhdan yoki onlayn ro'yxatdan)
function activeCourseId() {
  if (S.groupId) return S.groups.find((x) => x.id === S.groupId)?.course_id || null;
  return S.courseId;
}

// Kurs darslari + o'quvchining ko'rganlari
// Vazifa "o'tilgan" hisoblanishi uchun kerak bo'lgan eng kam foiz
const OTISH_FOIZ = 80;
const natijaFoiz = (r) => (r && r.total ? Math.round((r.correct / r.total) * 100) : 0);
const otilganmi = (r) => !!r && natijaFoiz(r) >= OTISH_FOIZ;

async function loadCourseLessons(courseId) {
  const modules = await run(sb.from('course_modules').select('*').eq('course_id', courseId).order('sort_order').order('created_at'));
  const modIds = modules.map((m) => m.id);
  const [lessons, progress] = await Promise.all([
    modIds.length ? run(sb.from('course_lessons').select('*').in('module_id', modIds).order('sort_order').order('created_at')) : Promise.resolve([]),
    run(sb.from('lesson_progress').select('lesson_id,completed').eq('student_id', S.student.id)),
  ]);
  const doneSet = new Set((progress || []).filter((p) => p.completed).map((p) => p.lesson_id));

  // Darslarga biriktirilgan vazifalar va o'quvchining natijalari
  const lesIds = lessons.map((l) => l.id);
  const [vazifalar, natijalar] = await Promise.all([
    lesIds.length ? run(sb.from('tests').select('id, lesson_id, tartib').in('lesson_id', lesIds).eq('active', true)) : Promise.resolve([]),
    run(sb.from('test_results').select('test_id, correct, total').eq('student_id', S.student.id)),
  ]);
  const natijaOf = (testId) => (natijalar || []).find((r) => r.test_id === testId);
  // Dars "to'liq tugatilgan" bo'lishi uchun: belgilangan + barcha vazifalari o'tilgan
  const vazifalarOtilgan = (lessonId) => (vazifalar || [])
    .filter((t) => t.lesson_id === lessonId)
    .every((t) => otilganmi(natijaOf(t.id)));
  const tolaTugadi = (lessonId) => doneSet.has(lessonId) && vazifalarOtilgan(lessonId);

  // Modul yopiq bo'lishi mumkin: qo'lda yopilgan yoki ochilish sanasi hali kelmagan
  const bugun = today();
  modules.forEach((m) => {
    m.kutilmoqda = !m.locked && !!m.opens_at && m.opens_at > bugun;
    m.locked = !!m.locked || m.kutilmoqda;
  });
  const modLocked = new Map(modules.map((m) => [m.id, !!m.locked]));

  // Darslar ketma-ket ochiladi: oldingisini tugatmaguncha keyingisi yopiq.
  // Tugatish = videoni belgilash + o'sha darsning vazifalarini ${OTISH_FOIZ}% ga yechish.
  let oldingi = null;
  lessons.forEach((l) => {
    l.locked = !!l.locked || modLocked.get(l.module_id) === true;
    if (!l.locked && oldingi && !tolaTugadi(oldingi.id)) {
      l.locked = true;
      l.navbat = true;                 // sanasi kelgan, lekin oldingisi tugamagan
      l.navbatSabab = doneSet.has(oldingi.id)
        ? `Avval "${oldingi.title}" vazifalarini ${OTISH_FOIZ}% ga yeching`
        : `Avval "${oldingi.title}" darsini tugating`;
    }
    oldingi = l;
  });

  const ochiq = lessons.filter((l) => !l.locked);
  return { modules, lessons, ochiq, doneSet, vazifalar, natijalar, natijaOf, tolaTugadi };
}

async function markLessonDone(lessonId) {
  try {
    await run(sb.from('lesson_progress').upsert(
      { student_id: S.student.id, lesson_id: lessonId, completed: true, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,lesson_id' },
    ));
    return true;
  } catch { return false; }
}

// --- Onlayn o'quvchi bosh sahifasi (guruh yo'q — kurs va darslik asosiy) ---
// Sayt sifatida ochilganda brauzer xotirani vaqti-vaqti bilan tozalab yuboradi
// va o'quvchi hisobidan chiqib qoladi. Bosh ekranga qo'shilgan ilovada bunday emas.
const ILOVA_REJIMI = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const BANNER_KEY = 'finway_ekran_maslahati';
function ekrangaQoshishBanneri() {
  if (ILOVA_REJIMI()) return '';
  try { if (localStorage.getItem(BANNER_KEY) === 'yopildi') return ''; } catch { /* yopiq rejim */ }
  const iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const yol = iOS
    ? 'Pastdagi "Ulashish" belgisini bosing \u2192 "Bosh ekranga qo\'shish".'
    : 'Brauzer menyusini oching \u2192 "Ilovani o\'rnatish" yoki "Bosh ekranga qo\'shish".';
  return `<div id="ekranBanner" class="flex items-start gap-3 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-3.5 mb-4">
    <span class="text-xl leading-none mt-0.5">\ud83d\udcf2</span>
    <div class="min-w-0 flex-1">
      <div class="text-[13px] font-bold text-indigo-200">Ilovani telefon ekraniga qo'shing</div>
      <div class="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Shunda har safar raqam va kod kiritmaysiz \u2014 ochdingizmi, ichidasiz. ${yol}</div>
    </div>
    <button id="ekranYop" class="shrink-0 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 text-sm">\u2715</button>
  </div>`;
}

async function drawHomeOnline(main) {
  main.innerHTML = '<div class="text-slate-500 text-sm text-center py-8">Yuklanmoqda...</div>';
  const courseId = activeCourseId();
  const course = S.courses.find((c) => c.id === courseId);
  const { modules, lessons, ochiq, doneSet } = courseId ? await loadCourseLessons(courseId) : { modules: [], lessons: [], ochiq: [], doneSet: new Set() };
  const total = ochiq.length;
  const done = ochiq.filter((l) => doneSet.has(l.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const next = ochiq.find((l) => !doneSet.has(l.id));
  const yopiq = lessons.length - ochiq.length;
  const totalMin = ochiq.reduce((a, l) => a + (Number(l.duration_min) || 0), 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  main.innerHTML = `
    ${courseSwitcher()}
    ${ekrangaQoshishBanneri()}
    <div class="relative overflow-hidden rounded-[26px] p-6 mb-4" style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 45%,#3b82f6 100%); box-shadow:0 22px 48px -20px rgba(79,70,229,.95);">
      <div class="absolute right-0 -top-6 w-52 h-52" style="background:radial-gradient(circle at 65% 35%, rgba(255,255,255,.32), transparent 60%);"></div>
      <div class="relative">
        <div class="flex items-start justify-between">
          <div class="min-w-0">
            <div class="text-indigo-100 text-xs mb-0.5">${greet} 👋</div>
            <div class="text-[26px] font-black leading-tight truncate">${esc(S.student.first_name || S.me.name)}!</div>
          </div>
          <div class="text-5xl leading-none shrink-0 ml-2">💻</div>
        </div>
        <div class="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3.5 py-1.5 text-xs font-semibold">${esc(course?.name || 'Onlayn kurs')}</div>
        <div class="mt-4 flex items-center gap-4">
          ${ring(pct, `<div class="text-base font-extrabold text-white">${pct}<span class="text-[9px]">%</span></div>`, '#ffffff', 72)}
          <div class="text-sm">
            <div class="font-bold text-white">${done} / ${total} dars</div>
            <div class="text-indigo-100 text-xs mt-0.5">${total === 0 ? 'Darslar tez orada ochiladi' : (total - done > 0 ? `${total - done} ta dars qoldi` : 'Ochiq darslar tugadi 🎉')}</div>
            ${yopiq ? `<div class="text-indigo-200/70 text-[11px] mt-0.5">🔒 ${yopiq} ta dars hali yopiq</div>` : ''}
            ${totalMin ? `<div class="text-indigo-200/80 text-[11px] mt-0.5">⏱ Jami ${esc(libDur(totalMin))}</div>` : ''}
          </div>
        </div>
      </div>
    </div>

    ${next ? `<button id="goNext" class="w-full mb-4 flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border border-indigo-400/30 bg-indigo-500/15 hover:bg-indigo-500/25 transition">
      <span class="text-2xl shrink-0">▶️</span>
      <span class="min-w-0 flex-1">
        <span class="block text-[11px] text-indigo-300 font-semibold">${done ? 'Davom ettirish' : 'Birinchi darsni boshlash'}</span>
        <span class="block text-sm font-bold text-white truncate">${esc(next.title)}</span>
      </span>
      <span class="text-indigo-300 shrink-0">›</span>
    </button>` : ''}

    <div class="mb-4">${card(`
      <div class="flex items-center gap-2 mb-3"><span class="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">📚</span><span class="font-bold text-sm text-slate-100">Kurs tarkibi</span></div>
      ${modules.length ? `<div class="space-y-2">
        ${modules.map((mod) => {
          const ls = lessons.filter((l) => l.module_id === mod.id);
          const d = ls.filter((l) => doneSet.has(l.id)).length;
          return `<div class="flex items-center justify-between gap-2">
            <div class="text-sm ${mod.locked ? 'text-slate-500' : 'text-slate-300'} truncate">${mod.locked ? '🔒 ' : ''}${esc(mod.title)}</div>
            <div class="text-[11px] font-bold shrink-0 ${mod.locked ? 'text-slate-600' : (d === ls.length && ls.length ? 'text-emerald-400' : 'text-slate-500')}">${mod.locked ? (mod.kutilmoqda ? esc(fmtDate(mod.opens_at)) : 'yopiq') : `${d}/${ls.length}`}</div>
          </div>`;
        }).join('')}
      </div>` : '<div class="text-sm text-slate-500">Darslar hali qo\'shilmagan.</div>'}
    `)}</div>

    <div>${card(`
      <div class="flex items-center gap-2 mb-2"><span class="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">❓</span><span class="font-bold text-sm text-slate-100">Savolingiz bormi?</span></div>
      <div class="text-xs text-slate-400 mb-3">Dars bo'yicha tushunmagan joyingizni o'qituvchiga yozing — javob beradi.</div>
      <button id="goAsk" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition">💬 O'qituvchiga savol berish</button>
    `)}</div>`;

  bindSwitcher();
  const nb = $('#goNext', main);
  if (nb) nb.onclick = () => { S.openLessonId = next.id; S.tab = 'library'; S.libSub = 'darslar'; drawTab(); };
  $('#goAsk', main).onclick = () => { S.tab = 'chat'; S.chatSub = 'private'; drawTab(); };
  const bYop = $('#ekranYop', main);
  if (bYop) bYop.onclick = () => {
    try { localStorage.setItem(BANNER_KEY, 'yopildi'); } catch { /* yopiq rejim */ }
    const b = $('#ekranBanner', main);
    if (b) b.remove();
  };
}

async function drawHome(main) {
  const g = S.groups.find((x) => x.id === S.groupId);
  main.innerHTML = '<div class="text-slate-500 text-sm text-center py-8">Yuklanmoqda...</div>';

  const [lessons, classmates, tgInfo, tgSettings, att, tests, myRes, hw, mySubs] = await Promise.all([
    run(sb.from('lessons').select('*').eq('group_id', S.groupId).order('date', { ascending: false }).limit(8)),
    run(sb.from('group_students').select('students(first_name,last_name)').eq('group_id', S.groupId).eq('status', 'aktiv')),
    run(sb.from('students').select('telegram_chat_id').eq('id', S.student.id).single()),
    run(sb.from('settings').select('telegram_bot').single()),
    run(sb.from('attendance').select('status').eq('student_id', S.student.id).eq('group_id', S.groupId)),
    run(sb.from('tests').select('id').eq('group_id', S.groupId).eq('active', true)),
    run(sb.from('test_results').select('test_id,correct,total').eq('student_id', S.student.id)),
    run(sb.from('homework').select('id').eq('group_id', S.groupId)),
    run(sb.from('homework_submissions').select('homework_id').eq('student_id', S.student.id)),
  ]);
  const todayTopic = lessons.find((l) => l.date === today());
  const tgBot = tgSettings?.telegram_bot || '';
  const tgLinked = !!tgInfo?.telegram_chat_id;
  const total = att.length, came = att.filter((a) => a.status === 'keldi').length;
  const attPct = total ? Math.round((came / total) * 100) : 0;
  const jobPct = Math.min(100, Math.round((S.coins / JOB_GOAL) * 100));
  const tIds = new Set(tests.map((t) => t.id));
  const gRes = myRes.filter((r) => tIds.has(r.test_id));
  const testAvg = gRes.length ? Math.round(gRes.reduce((a, r) => a + (r.total ? r.correct / r.total : 0), 0) / gRes.length * 100) : 0;
  const hIds = new Set(hw.map((h) => h.id));
  const hwPct = hw.length ? Math.round(mySubs.filter((s) => hIds.has(s.homework_id)).length / hw.length * 100) : 0;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  main.innerHTML = `
    ${groupSwitcher()}
    <div class="relative overflow-hidden rounded-[26px] p-6 mb-4" style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 45%,#3b82f6 100%); box-shadow:0 22px 48px -20px rgba(79,70,229,.95);">
      <div class="absolute right-0 -top-6 w-52 h-52" style="background:radial-gradient(circle at 65% 35%, rgba(255,255,255,.32), transparent 60%);"></div>
      <div class="absolute -left-8 -bottom-12 w-36 h-36 rounded-full" style="background:radial-gradient(circle, rgba(129,140,248,.55), transparent 70%);"></div>
      <div class="relative">
        <div class="flex items-start justify-between">
          <div class="min-w-0">
            <div class="text-indigo-100 text-xs mb-0.5">${greet} 👋</div>
            <div class="text-[26px] font-black leading-tight truncate">${esc(S.student.first_name || S.me.name)}!</div>
          </div>
          <div class="text-5xl leading-none shrink-0 ml-2">🎓</div>
        </div>
        <div class="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3.5 py-1.5 text-xs font-semibold">${esc(g.courses?.name || 'Kurs')} · ${esc(g.name)}</div>
        <div class="mt-4 grid grid-cols-2 gap-2 text-[12px] text-white/90">
          <div class="rounded-2xl bg-white/[.14] backdrop-blur px-3 py-2 truncate">🧑‍🏫 ${esc(g.employees ? g.employees.first_name + ' ' + (g.employees.last_name || '') : 'Belgilanmagan')}</div>
          <div class="rounded-2xl bg-white/[.14] backdrop-blur px-3 py-2 truncate">${g.is_online ? (g.lesson_link ? `<a href="${esc(g.lesson_link)}" target="_blank" class="underline">💻 Darsga kirish</a>` : '💻 Onlayn') : '🚪 ' + esc(g.rooms?.name || '—')}</div>
          <div class="col-span-2 rounded-2xl bg-white/[.14] backdrop-blur px-3 py-2">📅 ${fmtDays(g.days)} · ${fmtTime(g.start_time)}–${fmtTime(g.end_time)}</div>
        </div>
      </div>
    </div>

    <div class="mb-4">${card(`
      <div class="flex items-center justify-between mb-4">
        <div class="font-bold text-sm text-slate-100">📊 Mening natijalarim</div>
        <div class="text-[11px] text-amber-300 font-semibold">🪙 ${S.coins}</div>
      </div>
      <div class="grid grid-cols-4 gap-1">
        ${miniRing(attPct, 'Davomat', attPct >= 80 ? '#34d399' : '#fbbf24')}
        ${miniRing(testAvg, 'Sinf ishi', '#60a5fa')}
        ${miniRing(hwPct, 'Uy ishi', '#a78bfa')}
        ${miniRing(jobPct, 'Ishga', '#f59e0b')}
      </div>
    `)}</div>

    <div class="grid grid-cols-3 gap-2.5 mb-4">
      ${card(`<div class="text-center"><div class="text-xl font-black text-emerald-400">${came}/${total}</div><div class="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Kelgan</div></div>`, 'py-3')}
      ${card(`<div class="text-center"><div class="text-xl font-black text-blue-400">${gRes.length}</div><div class="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Test</div></div>`, 'py-3')}
      ${card(`<div class="text-center"><div class="text-xl font-black text-amber-400">${JOB_GOAL - S.coins > 0 ? JOB_GOAL - S.coins : 0}</div><div class="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Coin qoldi</div></div>`, 'py-3')}
    </div>

    ${tgBot && !tgLinked ? `<div class="mb-4">${card(`
      <div class="flex items-center gap-2 mb-2"><span>🔔</span><span class="font-bold text-sm text-slate-100">Telegram bildirishnoma</span></div>
      <div class="text-xs text-slate-400 mb-3">Kirish kodi, qarzdorlik va davomat xabarlarini Telegram orqali oling.</div>
      <button id="tgConnect" class="w-full py-2.5 rounded-xl bg-[#229ED9] hover:bg-[#1c8bc0] text-white font-bold text-sm transition">✈️ Telegram'ga ulash</button>`)}</div>` : ''}

    <div class="mb-4">${card(`
      <div class="flex items-center gap-2 mb-2"><span class="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm">📚</span><span class="font-bold text-sm text-slate-100">Bugungi dars</span></div>
      ${todayTopic
        ? `<div class="font-semibold text-slate-100">${esc(todayTopic.topic)}</div>${todayTopic.description ? `<div class="text-sm text-slate-400 mt-1">${esc(todayTopic.description)}</div>` : ''}`
        : `<div class="text-sm text-slate-500">Bugungi dars mavzusi hali kiritilmagan.</div>`}
    `)}</div>

    <div class="mb-4">${card(`
      <div class="flex items-center gap-2 mb-3"><span class="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">🗂</span><span class="font-bold text-sm text-slate-100">O'tilgan mavzular</span></div>
      ${lessons.length ? `<div class="space-y-2.5">
        ${lessons.map((l) => `<div class="flex gap-3 items-start">
          <div class="text-[11px] text-indigo-300 font-bold w-11 shrink-0 pt-0.5">${fmtDate(l.date).slice(0, 5)}</div>
          <div class="text-sm text-slate-300">${esc(l.topic)}</div>
        </div>`).join('')}
      </div>` : '<div class="text-sm text-slate-500">Hozircha mavzular kiritilmagan.</div>'}
    `)}</div>

    <div>${card(`
      <div class="flex items-center gap-2 mb-3"><span class="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">👥</span><span class="font-bold text-sm text-slate-100">Guruhdoshlarim (${classmates.length})</span></div>
      <div class="flex flex-wrap gap-2">
        ${classmates.map((c) => `<span class="text-xs bg-white/5 border border-white/5 text-slate-300 px-2.5 py-1.5 rounded-lg font-medium">${esc(c.students?.first_name)} ${esc((c.students?.last_name || '').slice(0, 1))}${c.students?.last_name ? '.' : ''}</span>`).join('')}
      </div>
    `)}</div>`;
  bindSwitcher();

  const tgBtn = $('#tgConnect', main);
  if (tgBtn) tgBtn.onclick = async () => {
    const code = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).replace(/-/g, '').slice(0, 18);
    try {
      await run(sb.from('students').update({ tg_link_code: code }).eq('id', S.student.id));
      window.open(`https://t.me/${tgBot}?start=${code}`, '_blank');
      toast("Telegram ochildi — botда \"Start\" bosing, keyin bu sahifani yangilang");
    } catch { toast('Xatolik, qayta urining', 'error'); }
  };
}

// --- Profil (rasm + ism) ---
async function drawProfile(main) {
  main.innerHTML = '<div class="text-slate-500 text-sm text-center py-8">Yuklanmoqda...</div>';
  const [me, pays] = await Promise.all([
    run(sb.from('students').select('first_name,last_name,phone,photo_url,coins,deal_amount,due_date,blocked,mode,access_until').eq('id', S.student.id).single()),
    run(sb.from('payments').select('amount').eq('student_id', S.student.id)),
  ]);
  const money = (n) => (Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + " so'm";
  const paid = pays.reduce((a, p) => a + Number(p.amount), 0);
  const deal = Number(me.deal_amount || 0);
  const remaining = Math.max(0, deal - paid);
  const due = me.due_date;
  const overdue = remaining > 0 && due && (new Date(due).getTime() + 5 * 86400000) < Date.now();
  const payBadge = me.blocked
    ? '<span class="text-[11px] px-2 py-0.5 rounded-lg bg-rose-900/50 text-rose-300 font-bold">🔒 Bloklangan</span>'
    : overdue ? '<span class="text-[11px] px-2 py-0.5 rounded-lg bg-rose-900/50 text-rose-300 font-bold">Muddati o\'tgan</span>'
    : remaining > 0 ? '<span class="text-[11px] px-2 py-0.5 rounded-lg bg-amber-900/40 text-amber-300 font-bold">Qarz bor</span>'
    : '<span class="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-900/40 text-emerald-300 font-bold">To\'langan</span>';
  const initials = `${(me.first_name || '').slice(0, 1)}${(me.last_name || '').slice(0, 1)}`.toUpperCase() || '👤';
  const avatar = me.photo_url
    ? `<img src="${esc(me.photo_url)}" class="w-24 h-24 rounded-full object-cover border-2 border-slate-700">`
    : `<span class="w-24 h-24 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-3xl font-bold border-2 border-slate-700">${esc(initials)}</span>`;

  main.innerHTML = `
    <div class="flex flex-col items-center py-4">
      <div class="relative">
        ${avatar}
        <label class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center cursor-pointer border-2 border-slate-950 shadow">
          📷<input type="file" accept="image/*" id="pInp" class="hidden">
        </label>
      </div>
      <div class="mt-3 font-bold text-lg text-slate-100">${esc(`${me.first_name || ''} ${me.last_name || ''}`.trim())}</div>
      <div class="text-sm text-slate-400">${esc(me.phone || '')}</div>
      <div class="mt-1 text-sm text-amber-400 font-bold">🪙 ${Number(me.coins || 0).toLocaleString('ru-RU').replace(/,/g, ' ')}</div>
    </div>

    ${me.blocked ? `<div class="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 mb-3 text-center">
      <div class="text-2xl mb-1">🔒</div>
      <div class="font-bold text-rose-300 text-sm">Akkauntingiz bloklangan</div>
      <div class="text-xs text-rose-400/80 mt-1">To'lov muddati o'tib ketgan. Iltimos to'lovni amalga oshiring yoki administrator bilan bog'laning.</div>
    </div>` : ''}

    ${S.courses.length ? `<div class="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 mb-3">
      <div class="font-bold text-sm text-slate-100 mb-2">💻 Onlayn kurslarim</div>
      <div class="space-y-1">
        ${S.courses.map((c) => `<div class="text-sm text-slate-200">• ${esc(c.name)}</div>`).join('')}
      </div>
      ${me.access_until ? `<div class="text-xs text-indigo-200/80 mt-2">📅 Kirish muddati: <b>${fmtDate(me.access_until)}</b> gacha</div>` : ''}
    </div>` : ''}

    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-3">
      <div class="flex items-center justify-between mb-3">
        <div class="font-bold text-sm text-slate-100">💳 To'lov holati</div>
        ${payBadge}
      </div>
      <div class="grid grid-cols-3 gap-2 mb-1 text-center">
        <div><div class="text-[13px] font-extrabold text-slate-100">${money(deal)}</div><div class="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Jami</div></div>
        <div><div class="text-[13px] font-extrabold text-emerald-400">${money(paid)}</div><div class="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">To'langan</div></div>
        <div><div class="text-[13px] font-extrabold ${remaining > 0 ? 'text-rose-400' : 'text-slate-100'}">${money(remaining)}</div><div class="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Qoldiq</div></div>
      </div>
      ${due ? `<div class="mt-3 text-xs ${overdue ? 'text-rose-400 font-semibold' : 'text-slate-400'}">📅 To'lov muddati: <b>${fmtDate(due)}</b>${overdue ? " — muddat o'tgan!" : ''}</div>` : ''}
      ${remaining > 0 ? `<div class="grid grid-cols-2 gap-2 mt-3">
        <button data-pay="click" class="py-2.5 rounded-xl text-white font-bold text-sm" style="background:#00A0E3">Click orqali</button>
        <button data-pay="payme" class="py-2.5 rounded-xl font-bold text-sm text-slate-900" style="background:#33CCCC">Payme orqali</button>
      </div>` : '<div class="mt-3 text-xs text-emerald-400 text-center">✅ To\'lov to\'liq amalga oshirilgan</div>'}
    </div>

    <div class="space-y-2 mt-2">
      <button id="pName" class="w-full flex items-center gap-3 bg-slate-900 rounded-xl border border-slate-800 p-3.5 text-sm font-medium text-slate-200">✏️ Ismni o'zgartirish</button>
      <button id="pLogout" class="w-full flex items-center gap-3 bg-slate-900 rounded-xl border border-slate-800 p-3.5 text-sm font-medium text-rose-400">↩ Chiqish</button>
    </div>`;

  $('#pInp', main).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Rasm 5 MB dan katta', 'error');
    toast('Yuklanmoqda...', 'info');
    try {
      const dot = file.name.lastIndexOf('.');
      const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'jpg';
      const path = `stu_${S.student.id}_${(crypto.randomUUID?.() || String(Date.now())).replace(/[^\w-]/g, '')}.${ext}`;
      const { error } = await sb.storage.from('hodim-rasmlar').upload(path, file, { contentType: file.type || undefined, upsert: true });
      if (error) throw error;
      const url = sb.storage.from('hodim-rasmlar').getPublicUrl(path).data.publicUrl;
      await run(sb.from('students').update({ photo_url: url }).eq('id', S.student.id));
      toast('Rasm yangilandi ✅'); drawProfile(main);
    } catch (err) { toast('Xatolik: ' + (err.message || ''), 'error'); }
  };
  $$('[data-pay]', main).forEach((b) => b.onclick = () => {
    // 2-bosqich: bu yerda Click/Payme to'lov havolasi ochiladi (merchant kalitlari bilan)
    toast(`Onlayn to'lov (${b.dataset.pay === 'click' ? 'Click' : 'Payme'}) tez orada ulanadi. Hozircha administrator orqali to'lang.`, 'info');
  });
  $('#pName', main).onclick = async () => {
    const v = await formModal("Ismni o'zgartirish", [
      { name: 'first_name', label: 'Ism', required: true, value: me.first_name },
      { name: 'last_name', label: 'Familiya', value: me.last_name },
    ]);
    if (!v) return;
    await run(sb.from('students').update({ first_name: v.first_name, last_name: v.last_name }).eq('id', S.student.id));
    S.student.first_name = v.first_name; S.student.last_name = v.last_name;
    S.me.name = `${v.first_name} ${v.last_name || ''}`.trim();
    toast('Saqlandi'); drawProfile(main);
  };
  $('#pLogout', main).onclick = doLogout;
}

// --- Darslik (video darslar kutubxonasi) ---
// Darsda video bormi (R2 dagi fayl yoki tashqi havola)
const hasVideo = (l) => !!(l?.video_url || l?.video_path);

function libVideoBlock(lesson) {
  const u = String(lesson?.video_url || '').trim();
  // Bizga yuklangan video — ilova ichidagi pleyer. Havolasi keyin qo'yiladi.
  if (lesson?.video_path || isFileVideo(u, lesson)) {
    // Suv belgisi: o'quvchining ismi va raqami video ustida ko'rinib turadi.
    // Yozib olishni to'xtatmaydi, lekin yozuv tarqalsa kim yozganini bilish mumkin.
    const belgi = `${S.me?.name || ''} · ${String(S.student?.phone || '').slice(-7)}`.trim();
    return `<div class="relative w-full rounded-xl overflow-hidden bg-black mb-3" style="aspect-ratio:16/9">
      <video id="lesVid" class="absolute inset-0 w-full h-full" controls playsinline preload="metadata"
        controlsList="nodownload noplaybackrate" disablePictureInPicture oncontextmenu="return false"></video>
      <div id="vidMark" class="absolute pointer-events-none select-none font-semibold"
        style="left:8%; top:10%; font-size:11px; color:rgba(255,255,255,.3); text-shadow:0 1px 3px rgba(0,0,0,.75); transition:left 1.2s ease, top 1.2s ease;">${esc(belgi)}</div>
    </div>`;
  }
  if (!u) return '';
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  let embed = m ? `https://www.youtube.com/embed/${m[1]}` : null;
  if (!embed) { m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/); if (m) embed = `https://player.vimeo.com/video/${m[1]}`; }
  if (embed) {
    return `<div class="relative w-full rounded-xl overflow-hidden bg-black mb-3" style="aspect-ratio:16/9">
      <iframe src="${esc(embed)}" class="absolute inset-0 w-full h-full" loading="lazy" frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>
    </div>`;
  }
  return `<a href="${esc(u)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 text-sm font-semibold mb-3">▶ Videoni ochish</a>`;
}
const libDur = (m) => {
  m = Number(m) || 0; if (!m) return '';
  const h = Math.floor(m / 60), mm = m % 60;
  return (h ? `${h} soat ` : '') + (mm ? `${mm} daq` : '');
};
// PDF/hujjatni ilova ichida ochish (tashqi faylga chiqmasdan)
async function drawLibrary(main) {
  // Sinf ishi va uy ishi guruhga bog'liq — onlayn o'quvchida faqat darslar bo'ladi
  const subs = S.groupId ? LIB_SUBS : LIB_SUBS.filter((s) => s.id === 'darslar');
  if (!S.groupId) S.libSub = 'darslar';
  main.innerHTML = `
    ${S.groupId ? groupSwitcher() : courseSwitcher()}
    ${subs.length > 1 ? `<div class="flex gap-1 mb-3 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
      ${subs.map((s) => `<button data-libsub="${s.id}" class="flex-1 py-2 rounded-xl text-xs font-bold transition ${S.libSub === s.id ? 'bg-indigo-500/30 text-white shadow' : 'text-slate-400'}"><span class="mr-0.5">${s.icon}</span>${s.label}</button>`).join('')}
    </div>` : ''}
    <div id="libBody"><div class="text-slate-500 text-sm text-center py-8">Yuklanmoqda...</div></div>`;
  bindSwitcher();
  $$('[data-libsub]', main).forEach((b) => b.onclick = () => { S.libSub = b.dataset.libsub; drawLibrary(main); });
  const body = $('#libBody', main);
  if (S.libSub === 'sinf') return libSinf(body, main);
  if (S.libSub === 'uy') return libUy(body);
  return libDarslar(body, main);
}

// Darslik → Darslar (video darslar kutubxonasi)
async function libDarslar(body, main) {
  const courseId = activeCourseId();
  if (!courseId) {
    body.innerHTML = card(`<div class="text-center py-8 text-slate-500 text-sm">${S.groupId ? 'Bu guruhga kurs biriktirilmagan.' : 'Sizga hali kurs ochilmagan.'}</div>`);
    return;
  }
  const { modules, lessons, doneSet } = await loadCourseLessons(courseId);

  const openLesson = async (l) => {
    if (l.locked) return;
    main.scrollTop = 0;
    // Darsga biriktirilgan amaliy vazifa (bo'lsa)
    const [vazifalar, mening] = await Promise.all([
      run(sb.from('tests').select('*').eq('lesson_id', l.id).eq('active', true).order('tartib').order('created_at')),
      run(sb.from('test_results').select('*').eq('student_id', S.student.id)),
    ]);
    const natijaOf = (t) => (mening || []).find((x) => x.test_id === t.id);
    const done = doneSet.has(l.id);
    main.innerHTML = `
      <button id="libBack" class="mb-3 text-sm text-slate-400 hover:text-slate-200 font-medium">← Orqaga</button>
      <div class="font-bold text-lg text-slate-100 mb-3">${esc(l.title)}</div>
      ${hasVideo(l) ? libVideoBlock(l) : card('<div class="text-sm text-slate-500 text-center py-6">Bu darsda video hali qo\'yilmagan.</div>')}
      ${l.duration_min ? `<div class="text-xs text-slate-400 mb-2">⏱ ${esc(libDur(l.duration_min))}</div>` : ''}
      ${l.description ? `<div class="text-sm text-slate-300 whitespace-pre-wrap mb-3 leading-relaxed">${esc(l.description)}</div>` : ''}
      ${l.pdf_url ? `<button id="libPdf" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 text-sm font-semibold mb-3">📄 ${esc(l.pdf_name || 'Material (PDF)')}</button>` : ''}
      ${(vazifalar || []).length ? `<div class="mt-4">
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Amaliy vazifalar</div>
        <div class="space-y-2">
          ${vazifalar.map((t, i) => {
            const r = natijaOf(t);
            const foiz = r && r.total ? Math.round((r.correct / r.total) * 100) : null;
            const soni = (t.questions || []).length;
            const otdi = otilganmi(r);
            // Birinchisi ochiq; keyingisi oldingisini OTISH_FOIZ% ga yechgandan keyin ochiladi
            const qulf = i > 0 && !otilganmi(natijaOf(vazifalar[i - 1]));
            if (qulf) {
              return `<div class="w-full text-left px-3.5 py-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center gap-3 opacity-70">
                <span class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm bg-slate-800 text-slate-500">🔒</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-slate-400 truncate">${esc(t.title)}</span>
                  <span class="block text-[11px] text-slate-500">Avval ${i}-vazifani ${OTISH_FOIZ}% ga yeching</span>
                </span>
              </div>`;
            }
            const rang = otdi ? 'bg-emerald-500/20 text-emerald-300' : r ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/25 text-indigo-200';
            const holat = otdi
              ? `${r.correct}/${r.total} · ${foiz}% · o'tildi`
              : r
                ? `${r.correct}/${r.total} · ${foiz}% · ${OTISH_FOIZ}% kerak — qayta ishlang`
                : `${soni} ta savol${t.time_limit ? ` · ${t.time_limit} daqiqa` : ''}`;
            return `<button data-vazifa="${t.id}" class="w-full text-left px-3.5 py-3 rounded-xl border transition flex items-center gap-3 ${otdi ? 'bg-white/[0.03] border-white/10 hover:border-indigo-400/50' : r ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15' : 'bg-indigo-600/10 border-indigo-500/40 hover:bg-indigo-600/20'}">
              <span class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold ${rang}">${otdi ? '✓' : i + 1}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-slate-100 truncate">${esc(t.title)}</span>
                <span class="block text-[11px] ${otdi ? 'text-emerald-300/80' : r ? 'text-amber-300/90' : 'text-indigo-300/80'}">${holat}</span>
              </span>
              <span class="text-slate-500 shrink-0">›</span>
            </button>`;
          }).join('')}
        </div>
        <div class="mt-2 text-[11px] text-slate-500 leading-relaxed">Keyingi dars ochilishi uchun darsni tugating va barcha vazifalarni kamida ${OTISH_FOIZ}% ga yeching.</div>
      </div>` : ''}
      <button id="libDone" class="w-full mt-2 py-3 rounded-xl text-sm font-bold transition ${done ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}">
        ${done ? '✓ Bu darsni ko\'rgansiz' : '✓ Darsni tugatdim'}
      </button>`;
    $('#libBack', main).onclick = () => drawLibrary(main);
    const pdfBtn = $('#libPdf', main);
    if (pdfBtn) pdfBtn.onclick = () => openPdfViewer(l.pdf_url, l.pdf_name);

    // Belgini joyida yangilaymiz — videoni qaytadan yuklamaslik uchun
    const paintDone = () => {
      const b = $('#libDone', main);
      if (!b) return;
      const d = doneSet.has(l.id);
      b.className = `w-full mt-2 py-3 rounded-xl text-sm font-bold transition ${d ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`;
      b.textContent = d ? "✓ Bu darsni ko'rgansiz" : '✓ Darsni tugatdim';
    };

    // Suv belgisi joyini vaqti-vaqti bilan ko'chiramiz — kesib tashlash qiyin bo'lsin
    const mark = $('#vidMark', main);
    if (mark) {
      const kochir = () => {
        if (!mark.isConnected) return clearInterval(markTimer);
        mark.style.left = `${6 + Math.random() * 55}%`;
        mark.style.top = `${8 + Math.random() * 76}%`;
      };
      var markTimer = setInterval(kochir, 14000);
      setTimeout(kochir, 4000);
    }

    // Video pleyer (fayl): HLS bo'lsa kutubxonani yuklaymiz, tugaganda avtomatik belgilanadi
    const vid = $('#lesVid', main);
    if (vid) {
      let src = null;
      try {
        src = await resolveVideoUrl(l);   // R2 uchun vaqtincha havola so'raydi
      } catch (err) {
        vid.closest('div').innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-sm text-rose-300 px-4 text-center">Video ochilmadi: ${esc(err.message || '')}</div>`;
      }
      if (src) {
        if (/\.m3u8(\?|$)/i.test(src) && !vid.canPlayType('application/vnd.apple.mpegurl')) {
          try {
            const { default: Hls } = await import('https://esm.sh/hls.js@1.5.17');
            if (Hls.isSupported()) { const h = new Hls(); h.loadSource(src); h.attachMedia(vid); }
            else vid.src = src;
          } catch { vid.src = src; }
        } else {
          vid.src = src;
        }
      }
      vid.onended = async () => {
        if (!doneSet.has(l.id) && await markLessonDone(l.id)) { doneSet.add(l.id); paintDone(); }
      };
    }

    $$('[data-vazifa]', main).forEach((b) => b.onclick = () => {
      const t = (vazifalar || []).find((x) => x.id === b.dataset.vazifa);
      if (t) runVazifa(t, main, () => openLesson(l));
    });

    $('#libDone', main).onclick = async () => {
      if (doneSet.has(l.id)) return;
      if (await markLessonDone(l.id)) { doneSet.add(l.id); paintDone(); toast('Dars belgilandi ✅'); }
    };
  };

  body.innerHTML = modules.length === 0
    ? card('<div class="text-center py-8 text-slate-500 text-sm">Bu kurs uchun darslar hali qo\'shilmagan.</div>')
    : `<div class="space-y-3">${modules.map((mod) => {
        const ls = lessons.filter((l) => l.module_id === mod.id);
        const d = ls.filter((l) => doneSet.has(l.id)).length;
        // Yopiq modul: nomi ko'rinadi, ichi ochilmaydi
        if (mod.locked) {
          return card(`
            <div class="flex items-center gap-2.5 opacity-70">
              <span class="text-lg shrink-0">🔒</span>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-slate-300 truncate">${esc(mod.title)}</div>
                ${mod.description ? `<div class="text-xs text-slate-500 truncate">${esc(mod.description)}</div>` : ''}
              </div>
              <span class="text-[10px] font-bold text-slate-400 border border-slate-700 rounded-lg px-2 py-1 shrink-0 text-center leading-tight">${mod.kutilmoqda ? esc(fmtDate(mod.opens_at)) + '<br>da ochiladi' : 'Tez orada'}</span>
            </div>`);
        }
        return card(`
          <div class="flex items-center justify-between gap-2 mb-0.5">
            <div class="font-bold text-slate-100 truncate">${esc(mod.title)}</div>
            ${ls.length ? `<div class="text-[11px] font-bold shrink-0 ${d === ls.length ? 'text-emerald-400' : 'text-slate-500'}">${d}/${ls.length}</div>` : ''}
          </div>
          ${mod.description ? `<div class="text-xs text-slate-500 mb-2">${esc(mod.description)}</div>` : '<div class="mb-2"></div>'}
          ${ls.length === 0 ? '<div class="text-xs text-slate-600">Dars yo\'q</div>' : `<div class="space-y-1.5">
            ${ls.map((l) => l.locked
              ? `<div class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900/50 border border-slate-800/70 opacity-70">
                  <span class="text-lg shrink-0">🔒</span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-semibold text-slate-400 truncate">${esc(l.title)}</span>
                    <span class="block text-[11px] ${l.navbat ? 'text-amber-500/80' : 'text-slate-600'}">${l.navbat ? esc(l.navbatSabab) : 'Hali ochilmagan'}</span>
                  </span>
                </div>`
              : `<button data-lesson="${l.id}" class="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border ${doneSet.has(l.id) ? 'border-emerald-700/50' : 'border-slate-800'} transition">
              <span class="text-lg shrink-0">${doneSet.has(l.id) ? '✅' : (hasVideo(l) ? '🎬' : '📄')}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-slate-100 truncate">${esc(l.title)}</span>
                ${l.duration_min ? `<span class="block text-[11px] text-slate-500">⏱ ${esc(libDur(l.duration_min))}</span>` : ''}
              </span>
              <span class="text-slate-500 shrink-0">›</span>
            </button>`).join('')}
          </div>`}
        `);
      }).join('')}</div>`;
  $$('[data-lesson]', body).forEach((b) => b.onclick = () => {
    const l = lessons.find((x) => x.id === b.dataset.lesson);
    if (l) openLesson(l);
  });

  // Bosh sahifadagi "Davom ettirish" tugmasidan kelgan bo'lsa — o'sha darsni ochamiz
  if (S.openLessonId) {
    const l = lessons.find((x) => x.id === S.openLessonId);
    S.openLessonId = null;
    if (l) openLesson(l);
  }
}

// Darslik → Sinf ishi (testlar)
async function libSinf(body, main) {
  const [tests, myResults] = await Promise.all([
    run(sb.from('tests').select('*').eq('group_id', S.groupId).eq('active', true).order('created_at', { ascending: false })),
    run(sb.from('test_results').select('*').eq('student_id', S.student.id)),
  ]);
  const resOf = (tid) => myResults.find((r) => r.test_id === tid);
  body.innerHTML = tests.length === 0
    ? card('<div class="text-slate-500 text-sm text-center py-6">Hozircha sinf ishi (test) yo\'q</div>')
    : `<div class="space-y-2">
        ${tests.map((t) => {
          const r = resOf(t.id);
          const pct = r && r.total ? Math.round((r.correct / r.total) * 100) : 0;
          return card(`<div class="flex items-center justify-between gap-2">
            <div class="min-w-0"><div class="font-semibold text-sm text-slate-100 truncate">${esc(t.title)}</div>
            <div class="text-xs text-slate-500">${(t.questions || []).length} savol</div></div>
            ${r
              ? `<span class="text-sm font-bold shrink-0 ${pct >= 60 ? 'text-emerald-400' : 'text-rose-400'}">${r.correct}/${r.total} · ${pct}%</span>`
              : `<button data-test="${t.id}" class="shrink-0 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">▶ Boshlash</button>`}
          </div>`);
        }).join('')}
      </div>`;
  $$('[data-test]', body).forEach((b) => b.onclick = () => {
    const t = tests.find((x) => x.id === b.dataset.test);
    runTest(t, main);
  });
}

// Darslik → Uy ishi (uy vazifalari)
async function libUy(body) {
  const [hw, mySubs] = await Promise.all([
    run(sb.from('homework').select('*').eq('group_id', S.groupId).order('created_at', { ascending: false })),
    run(sb.from('homework_submissions').select('*').eq('student_id', S.student.id)),
  ]);
  const subOf = (hid) => mySubs.find((s) => s.homework_id === hid);
  body.innerHTML = hw.length === 0
    ? card('<div class="text-slate-500 text-sm text-center py-6">Hozircha uy ishi yo\'q</div>')
    : `<div class="space-y-2">
        ${hw.map((h) => {
          const s = subOf(h.id);
          return card(`
            <div class="font-semibold text-sm text-slate-100">${esc(h.title)}</div>
            ${h.due_date ? `<div class="text-xs text-slate-500 mb-1">Muddat: ${fmtDate(h.due_date)}</div>` : ''}
            ${h.description ? `<div class="text-sm text-slate-400 mb-2 whitespace-pre-wrap">${esc(h.description)}</div>` : ''}
            ${s ? `
              <div class="mt-2 pt-2 border-t border-slate-800">
                <div class="text-xs text-slate-500 mb-1">Sizning javobingiz:</div>
                <div class="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-2 whitespace-pre-wrap">${esc(s.answer || '')}</div>
                ${s.grade != null
                  ? `<div class="mt-2 flex items-center gap-2"><span class="text-xs font-bold px-2 py-0.5 rounded ${s.grade >= 60 ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'}">${s.grade} ball</span>${s.feedback ? `<span class="text-xs text-slate-400">${esc(s.feedback)}</span>` : ''}</div>`
                  : '<div class="mt-1.5 text-xs text-amber-400">⏳ Tekshirilmoqda</div>'}
              </div>`
              : `<div class="mt-2">
                <textarea data-hwans="${h.id}" rows="3" placeholder="Javobingizni yozing..." class="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm"></textarea>
                <button data-hwsub="${h.id}" class="mt-1.5 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Topshirish</button>
              </div>`}
          `);
        }).join('')}
      </div>`;
  $$('[data-hwsub]', body).forEach((b) => b.onclick = async () => {
    const hid = b.dataset.hwsub;
    const ans = $(`[data-hwans="${hid}"]`, body)?.value.trim();
    if (!ans) return toast('Javob bo\'sh', 'error');
    b.disabled = true; b.textContent = 'Yuborilmoqda...';
    await run(sb.from('homework_submissions').upsert({ homework_id: hid, student_id: S.student.id, answer: ans, grade: null, graded_at: null }, { onConflict: 'homework_id,student_id' }));
    toast('Topshirildi ✅'); drawTab();
  });
}


// --- Amaliy vazifa ---
// Ikki xil savol bor:
//   • variantli  — o'quvchi tayyor javoblardan birini tanlaydi (A / M / XK / X kabi);
//   • raqamli (tur: 'son') — o'quvchi summani o'zi yozadi.
// Javob berilgan zahoti to'g'ri-noto'g'ri ekani va NEGA shundayligi shu yerda
// yoziladi — o'quvchi oxirigacha kutmaydi. Tepada taymer, savolni o'tkazib
// yuborish mumkin. Yakunda hammasi yana bir bor jamlanadi va natija xodimlar
// guruhiga ketadi. Yechish vaqtida ilovadan chiqib ketilsa — darhol xabar beriladi.
function runVazifa(test, main, onBack) {
  const savollar = test.questions || [];
  const umumiyVariantlar = test.options || [];
  const javoblar = new Array(savollar.length).fill(null);
  const tekshirilgan = new Array(savollar.length).fill(false);
  const limitSek = Number(test.time_limit) > 0 ? Number(test.time_limit) * 60 : 0;

  let idx = 0;
  let tugadi = false;
  let chiqishSoni = 0;      // ilovadan necha marta chiqib ketdi
  let xabarYuborildi = false;
  let timerId = null;
  const boshlandi = Date.now();

  const sonli = (q) => q.tur === 'son';
  const variantlarFor = (q) => (Array.isArray(q.options) && q.options.length ? q.options : umumiyVariantlar);
  // "A — aktiv" dan faqat "A" ni olamiz — tahlilda qisqa ko'rinsin
  const belgi = (q, v) => String(variantlarFor(q)[v] ?? '?').split('—')[0].trim();
  const sonOqi = (v) => {
    const t = String(v ?? '').replace(/[\s ]/g, '').replace(',', '.');
    const n = Number(t);
    return t === '' || Number.isNaN(n) ? null : n;
  };
  const sonYoz = (n) => (n == null ? '—' : Number(n).toLocaleString('ru-RU').replace(/,/g, ' '));
  const korinish = (q, v) => (sonli(q) ? sonYoz(v) : belgi(q, v));
  const togrimi = (q, javob) => {
    if (javob === null || javob === undefined) return false;
    if (!sonli(q)) return javob === q.a;
    return Math.abs(Number(javob) - Number(q.a)) <= Number(q.xato || 0);
  };
  const javobsizlar = () => javoblar.reduce((a, v) => a + (v === null ? 1 : 0), 0);
  const vaqt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // --- Ilovadan chiqib ketishni kuzatish ---
  // Ekrandan rasm olishni brauzer taqiqlay olmaydi, lekin boshqa ilovaga
  // o'tib ketganini bilamiz — birinchisida darhol guruhga xabar ketadi.
  const kuzat = () => {
    if (tugadi || document.visibilityState !== 'hidden') return;
    chiqishSoni++;
    if (xabarYuborildi) return;
    xabarYuborildi = true;
    sb.functions.invoke('vazifa-natija', {
      body: { type: 'tark-etdi', test_id: test.id, student_id: S.student.id },
    }).catch(() => { /* xabar ketmasa ham yechish to'xtamaydi */ });
  };
  document.addEventListener('visibilitychange', kuzat);
  const kuzatuvniTo = () => {
    tugadi = true;
    document.removeEventListener('visibilitychange', kuzat);
    if (timerId) { clearInterval(timerId); timerId = null; }
  };
  const chiqish = () => { kuzatuvniTo(); onBack(); };

  const suvBelgisi = () => {
    const ism = [S.student?.first_name, S.student?.last_name].filter(Boolean).join(' ');
    return `<div class="pointer-events-none select-none fixed inset-0 flex items-center justify-center" style="z-index:5">
      <div class="text-[13px] font-semibold" style="color:rgba(255,255,255,.055); transform:rotate(-24deg)">${esc(ism)} · ${esc(S.student?.phone || '')}</div>
    </div>`;
  };

  const taymerniYur = () => {
    if (timerId) clearInterval(timerId);
    const yoz = () => {
      const el = $('#vTimer', main);
      if (!el) return;
      const otgan = Math.floor((Date.now() - boshlandi) / 1000);
      if (limitSek) {
        const qolgan = limitSek - otgan;
        if (qolgan <= 0) { el.textContent = '00:00'; yakunla(true); return; }
        el.textContent = vaqt(qolgan);
        el.className = `text-[13px] font-bold tabular-nums ${qolgan <= 60 ? 'text-rose-300' : qolgan <= 180 ? 'text-amber-300' : 'text-slate-200'}`;
      } else {
        el.textContent = vaqt(otgan);
      }
    };
    yoz();
    timerId = setInterval(yoz, 1000);
  };

  // Javobdan keyingi tahlil — nega to'g'ri yoki nega noto'g'ri
  const tahlilBloki = (q) => {
    const ok = togrimi(q, javoblar[idx]);
    const meniki = korinish(q, javoblar[idx]);
    const togrisi = korinish(q, q.a);
    return `<div class="rounded-2xl border p-4 mt-4 ${ok ? 'border-emerald-500/40 bg-emerald-900/15' : 'border-rose-500/40 bg-rose-900/15'}">
      <div class="flex items-center gap-2">
        <span class="text-2xl leading-none">${ok ? '✅' : '❌'}</span>
        <span class="font-black text-[15px] ${ok ? 'text-emerald-300' : 'text-rose-300'}">${ok ? "To'g'ri javob" : "Noto'g'ri"}</span>
      </div>
      <div class="text-[13px] mt-2 ${ok ? 'text-emerald-200/90' : 'text-slate-200'}">
        ${ok
          ? `Javobingiz: <b>${esc(togrisi)}</b>`
          : `Siz yozdingiz: <b class="text-rose-300">${esc(meniki)}</b> · To'g'ri javob: <b class="text-emerald-300">${esc(togrisi)}</b>`}
      </div>
      ${q.izoh ? `<div class="mt-3 pt-3 border-t ${ok ? 'border-emerald-500/20' : 'border-rose-500/20'}">
        <div class="text-[11px] font-bold uppercase tracking-wider ${ok ? 'text-emerald-400/70' : 'text-rose-400/70'} mb-1.5">Nega shunday</div>
        <div class="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">${esc(q.izoh)}</div>
      </div>` : ''}
    </div>`;
  };

  // --- Savol ekrani ---
  const chiz = () => {
    const q = savollar[idx];
    const tanlangan = javoblar[idx];
    const ochildi = tekshirilgan[idx];
    const variantlar = variantlarFor(q);
    main.scrollTop = 0;
    main.innerHTML = `
      ${suvBelgisi()}
      <div class="relative o-tor" style="z-index:10">
        <div class="flex items-center gap-2 mb-3">
          <button id="vBack" class="text-sm text-slate-400 hover:text-slate-200 font-medium">← Chiqish</button>
          <div class="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10">
            <span class="text-[11px] text-slate-400">${limitSek ? 'Qoldi' : 'Vaqt'}</span>
            <span id="vTimer" class="text-[13px] font-bold tabular-nums text-slate-200">00:00</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span class="font-semibold text-slate-200 truncate pr-2">${esc(test.title)}</span>
          <span class="shrink-0">${idx + 1} / ${savollar.length}</span>
        </div>
        <div class="h-2 rounded-full bg-slate-800 overflow-hidden mb-4">
          <div class="h-full bg-indigo-500 transition-all" style="width:${(idx / savollar.length) * 100}%"></div>
        </div>
        ${test.description && idx === 0 ? `<div class="text-xs text-slate-400 mb-3 leading-relaxed">${esc(test.description)}</div>` : ''}
        <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-5 mb-4 flex items-center" style="min-height:88px">
          <div class="text-slate-100 font-semibold text-[16px] leading-snug">${esc(q.q)}</div>
        </div>
        ${sonli(q) ? `
          <div class="flex items-center gap-2 rounded-xl border px-4 py-3.5 transition ${ochildi ? 'border-slate-700 bg-slate-900/60' : 'border-slate-700 bg-slate-800/70 focus-within:border-indigo-400'}">
            <input id="vSon" inputmode="decimal" autocomplete="off" ${ochildi ? 'disabled' : ''} value="${tanlangan == null ? '' : esc(String(tanlangan))}"
                   class="flex-1 min-w-0 bg-transparent outline-none text-lg font-bold tabular-nums ${ochildi ? 'text-slate-400' : 'text-slate-100'}" placeholder="0">
            ${q.birlik ? `<span class="text-xs text-slate-400 shrink-0">${esc(q.birlik)}</span>` : ''}
          </div>
          ${q.izoh_old && !ochildi ? `<div class="mt-2 text-[11px] text-slate-500 leading-relaxed">${esc(q.izoh_old)}</div>` : ''}
        ` : `
          <div class="space-y-2.5" id="vOpts">
            ${variantlar.map((o, i) => {
              let cls = 'bg-slate-800/70 border-slate-700 text-slate-200 hover:border-slate-500';
              let nishon = '';
              if (ochildi) {
                if (i === q.a) { cls = 'bg-emerald-600/20 border-emerald-500/60 text-emerald-100'; nishon = '✓'; }
                else if (i === tanlangan) { cls = 'bg-rose-600/20 border-rose-500/60 text-rose-100'; nishon = '✕'; }
                else cls = 'bg-slate-800/40 border-slate-800 text-slate-500';
              } else if (tanlangan === i) {
                cls = 'bg-indigo-600 border-indigo-500 text-white';
              }
              return `<button data-opt="${i}" ${ochildi ? 'disabled' : ''} class="w-full flex items-center gap-2 text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition ${cls}">
                <span class="flex-1 min-w-0">${esc(o)}</span>
                ${nishon ? `<span class="shrink-0 font-black">${nishon}</span>` : ''}
              </button>`;
            }).join('')}
          </div>
        `}
        ${ochildi ? tahlilBloki(q) : ''}
        <div class="flex gap-2 mt-5">
          ${idx > 0 ? '<button id="vPrev" class="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold shrink-0">←</button>' : ''}
          ${ochildi ? '' : '<button id="vSkip" class="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold shrink-0">O\'tkazish</button>'}
          ${!ochildi && sonli(q)
            ? '<button id="vCheck" class="flex-1 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition">Tekshirish</button>'
            : `<button id="vNext" class="flex-1 py-3 rounded-xl text-sm font-bold ${ochildi ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-500'} transition">
                 ${idx === savollar.length - 1 ? 'Yakunlash' : 'Keyingi →'}
               </button>`}
        </div>
        <div class="flex flex-wrap gap-1.5 mt-5 pt-4 border-t border-white/10">
          ${savollar.map((qq, i) => {
            const shu = i === idx;
            let cls = 'bg-slate-800 text-slate-500 border border-slate-700';
            if (tekshirilgan[i]) cls = togrimi(qq, javoblar[i]) ? 'bg-emerald-500/25 text-emerald-300' : 'bg-rose-500/25 text-rose-300';
            if (shu) cls = 'bg-indigo-500 text-white';
            return `<button data-jump="${i}" class="w-8 h-8 rounded-lg text-[11px] font-bold transition ${cls}">${i + 1}</button>`;
          }).join('')}
        </div>
      </div>`;

    const keyingi = () => {
      if (idx < savollar.length - 1) { idx++; chiz(); } else yakunla();
    };

    $$('#vOpts [data-opt]', main).forEach((b) => b.onclick = () => {
      if (tekshirilgan[idx]) return;
      javoblar[idx] = Number(b.dataset.opt);
      tekshirilgan[idx] = true;
      chiz();
    });
    $$('[data-jump]', main).forEach((b) => b.onclick = () => { idx = Number(b.dataset.jump); chiz(); });
    $('#vBack', main).onclick = chiqish;
    const prev = $('#vPrev', main);
    if (prev) prev.onclick = () => { idx--; chiz(); };
    const skip = $('#vSkip', main);
    if (skip) skip.onclick = () => { javoblar[idx] = null; keyingi(); };
    const check = $('#vCheck', main);
    if (check) check.onclick = () => {
      const el = $('#vSon', main);
      const son = sonOqi(el ? el.value : '');
      if (son === null) { toast('Avval javobni yozing', 'error'); return; }
      javoblar[idx] = son;
      tekshirilgan[idx] = true;
      chiz();
    };
    const next = $('#vNext', main);
    if (next) next.onclick = () => {
      if (!tekshirilgan[idx]) { toast('Avval javobni tanlang', 'error'); return; }
      keyingi();
    };
    const son = $('#vSon', main);
    if (son && !ochildi) {
      son.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const c = $('#vCheck', main); if (c) c.click(); } };
      setTimeout(() => son.focus(), 40);
    }
    taymerniYur();
  };

  // --- Yakun ---
  async function yakunla(vaqtTugadi = false) {
    if (tugadi) return;
    const qoldi = javobsizlar();
    if (!vaqtTugadi && qoldi > 0 && !confirm(`${qoldi} ta savol javobsiz qoldi. Shundayin yakunlaysizmi?`)) return;

    const sarflangan = Math.floor((Date.now() - boshlandi) / 1000);
    kuzatuvniTo();

    const togri = savollar.reduce((a, q, i) => a + (togrimi(q, javoblar[i]) ? 1 : 0), 0);
    const foiz = savollar.length ? Math.round((togri / savollar.length) * 100) : 0;

    main.scrollTop = 0;
    main.innerHTML = `
      <div class="text-center py-6">
        <div class="text-5xl mb-2">${foiz >= 90 ? '🏆' : foiz >= 70 ? '👍' : foiz >= 50 ? '💪' : '📚'}</div>
        <div class="text-xl font-black text-slate-100">${vaqtTugadi ? 'Vaqt tugadi' : 'Vazifa yakunlandi'}</div>
        <div class="text-4xl font-black my-3 ${foiz >= 70 ? 'text-emerald-400' : foiz >= 50 ? 'text-amber-400' : 'text-rose-400'}">${togri}/${savollar.length} · ${foiz}%</div>
        <div class="text-xs text-slate-400">⏱ ${vaqt(sarflangan)}${qoldi ? ` · ${qoldi} ta javobsiz` : ''}</div>
        <div class="text-xs text-slate-500 mt-1">Natija o'qituvchiga yuborildi</div>
      </div>
      <div class="space-y-2">
        ${savollar.map((q, i) => {
          const ok = togrimi(q, javoblar[i]);
          const bosh = javoblar[i] === null;
          const meniki = korinish(q, javoblar[i]);
          const togrisi = korinish(q, q.a);
          return `<div class="rounded-xl border p-3 ${ok ? 'border-emerald-700/40 bg-emerald-900/10' : bosh ? 'border-slate-700 bg-white/[0.02]' : 'border-rose-700/40 bg-rose-900/10'}">
            <div class="flex gap-2">
              <span class="shrink-0">${ok ? '✅' : bosh ? '⬜️' : '❌'}</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-slate-100">${i + 1}. ${esc(q.q)}</div>
                <div class="text-[12px] mt-1 ${ok ? 'text-emerald-300' : bosh ? 'text-slate-400' : 'text-rose-300'}">
                  ${ok ? `To'g'ri — ${esc(togrisi)}` : bosh ? `Javobsiz qoldi · To'g'risi: ${esc(togrisi)}` : `Siz: ${esc(meniki)} · To'g'risi: ${esc(togrisi)}`}
                </div>
                ${q.izoh ? `<div class="text-[12px] text-slate-400 mt-1.5 leading-relaxed whitespace-pre-line">${esc(q.izoh)}</div>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="flex gap-2 mt-5">
        <button id="vQayta" class="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold">Qayta ishlash</button>
        <button id="vTugat" class="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold">Darsga qaytish</button>
      </div>`;

    $('#vQayta', main).onclick = () => runVazifa(test, main, onBack);
    $('#vTugat', main).onclick = onBack;

    try {
      await run(sb.from('test_results').upsert(
        {
          test_id: test.id, student_id: S.student.id,
          correct: togri, total: savollar.length, answers: javoblar,
          skipped: qoldi, duration_sec: sarflangan, left_count: chiqishSoni,
          finished_at: new Date().toISOString(),
        },
        { onConflict: 'test_id,student_id' },
      ));
      sb.functions.invoke('vazifa-natija', { body: { test_id: test.id, student_id: S.student.id } })
        .catch(() => { /* bildirishnoma bo'lmasa ham natija saqlangan */ });
    } catch { /* saqlanmasa ham o'quvchi natijani ko'rib turibdi */ }
  }

  chiz();
}

const shuffleArr = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

function runTest(test, main) {
  const picks = (test.questions || []).map((q) => {
    const opts = q.o.map((text, idx) => ({ text, correct: idx === q.a }));
    return { q: q.q, opts: shuffleArr(opts) };
  });
  let idx = 0, correct = 0, locked = false;

  const paint = () => {
    const item = picks[idx];
    main.innerHTML = `
      <div class="flex items-center justify-between text-xs text-slate-400 mb-3">
        <span class="font-semibold text-slate-200">${esc(test.title)}</span>
        <span>Savol ${idx + 1}/${picks.length}</span>
      </div>
      <div class="h-2 rounded-full bg-slate-800 overflow-hidden mb-4"><div class="h-full bg-blue-500" style="width:${(idx / picks.length) * 100}%"></div></div>
      <div class="rounded-2xl bg-slate-900 border border-slate-800 p-5 mb-4 min-h-[80px] flex items-center">
        <div class="text-slate-100 font-semibold text-[15px] leading-snug">${esc(item.q)}</div>
      </div>
      <div class="space-y-2.5" id="opts">
        ${item.opts.map((o, i) => `<button data-opt="${i}" class="w-full text-left px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium hover:border-slate-500 transition">${esc(o.text)}</button>`).join('')}
      </div>`;
    $$('#opts [data-opt]', main).forEach((b) => b.onclick = () => answer(Number(b.dataset.opt)));
  };

  const answer = (i) => {
    if (locked) return; locked = true;
    const item = picks[idx];
    if (item.opts[i].correct) correct++;
    $$('#opts [data-opt]', main).forEach((b, bi) => {
      b.disabled = true;
      if (item.opts[bi].correct) b.className = 'w-full text-left px-4 py-3.5 rounded-xl bg-emerald-600 border border-emerald-500 text-white text-sm font-semibold';
      else if (bi === i) b.className = 'w-full text-left px-4 py-3.5 rounded-xl bg-rose-600 border border-rose-500 text-white text-sm font-semibold';
    });
    setTimeout(() => { locked = false; idx++; if (idx >= picks.length) finish(); else paint(); }, 600);
  };

  async function finish() {
    const total = picks.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    try {
      await run(sb.from('test_results').upsert({ test_id: test.id, student_id: S.student.id, correct, total }, { onConflict: 'test_id,student_id' }));
    } catch { /* ignore */ }
    main.innerHTML = `
      <div class="text-center py-8">
        <div class="text-6xl mb-3">${pct >= 60 ? '🎉' : '💪'}</div>
        <div class="text-2xl font-black text-slate-100 mb-1">Test yakunlandi!</div>
        <div class="text-4xl font-black ${pct >= 60 ? 'text-emerald-400' : 'text-rose-400'} my-4">${correct}/${total} · ${pct}%</div>
        <button id="back" class="mt-4 px-6 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold">← Sinf ishi</button>
      </div>`;
    $('#back', main).onclick = () => drawLibrary(main);
  }
  paint();
}

async function drawAttend(main) {
  main.innerHTML = '<div class="text-slate-500 text-sm text-center py-8">Yuklanmoqda...</div>';
  const [rows, lessons] = await Promise.all([
    run(sb.from('attendance').select('*').eq('student_id', S.student.id).eq('group_id', S.groupId).order('date', { ascending: false }).limit(40)),
    run(sb.from('lessons').select('date,topic').eq('group_id', S.groupId)),
  ]);
  const topicOf = (d) => lessons.find((l) => l.date === d)?.topic;
  const total = rows.length;
  const came = rows.filter((r) => r.status === 'keldi').length;
  const pct = total ? Math.round((came / total) * 100) : 0;

  main.innerHTML = `
    ${groupSwitcher()}
    <div class="grid grid-cols-3 gap-2 mb-4">
      ${stat('Jami dars', total, 'text-slate-100')}
      ${stat('Kelgan', came, 'text-emerald-400')}
      ${stat('Davomat', pct + '%', pct >= 80 ? 'text-emerald-400' : 'text-amber-400')}
    </div>
    ${total === 0 ? card('<div class="text-center text-slate-500 text-sm py-6">Hozircha davomat belgilanmagan.</div>') : `
    <div class="space-y-2">
      ${rows.map((r) => {
        const [lbl, icon, cls] = ATT[r.status] || [r.status, '·', 'text-slate-400'];
        const tp = topicOf(r.date);
        return card(`<div class="flex items-center justify-between">
          <div class="min-w-0">
            <div class="font-semibold text-sm text-slate-200">${fmtDate(r.date)}</div>
            ${tp ? `<div class="text-xs text-slate-500 truncate">${esc(tp)}</div>` : ''}
          </div>
          <span class="text-sm font-semibold ${cls} shrink-0 ml-3">${icon} ${lbl}</span>
        </div>`, 'py-3');
      }).join('')}
    </div>`}`;
  bindSwitcher();
}

function stat(label, val, cls) {
  return `<div class="bg-slate-900 rounded-xl border border-slate-800 p-3 text-center">
    <div class="text-lg font-extrabold ${cls}">${val}</div>
    <div class="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mt-0.5">${esc(label)}</div>
  </div>`;
}

async function drawChat(main) {
  closeChat();
  // Guruh chati faqat guruhdagilar uchun; onlayn o'quvchida o'qituvchiga savol qoladi
  const subs = S.groupId ? CHAT_SUBS : CHAT_SUBS.filter((s) => s.id === 'private');
  if (!S.groupId) S.chatSub = 'private';
  main.innerHTML = `
    ${S.groupId ? groupSwitcher() : ''}
    ${subs.length > 1 ? `<div class="flex gap-1 mb-3 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
      ${subs.map((s) => `<button data-chatsub="${s.id}" class="flex-1 py-2 rounded-xl text-xs font-bold transition ${S.chatSub === s.id ? 'bg-indigo-500/30 text-white shadow' : 'text-slate-400'}"><span class="mr-0.5">${s.icon}</span>${s.label}</button>`).join('')}
    </div>` : ''}
    <div id="chatWrap"></div>`;
  bindSwitcher();
  $$('[data-chatsub]', main).forEach((b) => b.onclick = () => { S.chatSub = b.dataset.chatsub; drawChat(main); });
  const wrap = $('#chatWrap', main);
  if (S.chatSub === 'private') {
    wrap.innerHTML = `<div class="mb-2 text-xs text-slate-500 px-1">Faqat siz va o'qituvchi (hamda direktor) ko'radi</div><div id="askBox" style="height: calc(100vh - 265px)"></div>`;
    await mountChat($('#askBox', wrap), { groupId: S.groupId, channel: 'private', studentId: S.student.id, me: S.me, dark: true, placeholder: 'Savolingizni yozing...' });
  } else {
    wrap.innerHTML = `<div id="chatBox" style="height: calc(100vh - 250px)"></div>`;
    await mountChat($('#chatBox', wrap), { groupId: S.groupId, channel: 'group', me: S.me, dark: true });
  }
}

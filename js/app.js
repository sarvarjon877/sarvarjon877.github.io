import { sb, run } from './db.js';
import { $, esc, toast, fmtTelInput, modal, formModal } from './ui.js';
import { renderStudentApp } from './student.js';
import { renderTeacherApp } from './teacher.js';

// Bo'limlar — seksiyalarga bo'lingan. roles: qaysi rollar ko'ra oladi
const SECTIONS = [
  {
    title: 'Asosiy',
    pages: [
      { id: 'dashboard', title: 'Bosh sahifa', icon: '🏠', mod: './pages/dashboard.js', roles: ['direktor', 'moliyachi', 'admin', 'oqituvchi'] },
      { id: 'leads', title: 'Lidlar', icon: '🎯', mod: './pages/leads.js', roles: ['direktor', 'moliyachi', 'admin'] },
    ],
  },
  {
    title: "O'quv jarayoni",
    pages: [
      { id: 'students', title: "O'quvchilar", icon: '🎓', mod: './pages/students.js', roles: ['direktor', 'moliyachi', 'admin', 'oqituvchi'] },
      { id: 'groups', title: 'Guruhlar', icon: '👥', mod: './pages/groups.js', roles: ['direktor', 'moliyachi', 'admin', 'oqituvchi'] },
      { id: 'library', title: 'Darsliklar', icon: '📚', mod: './pages/lessons.js', roles: ['direktor', 'moliyachi', 'admin', 'oqituvchi'] },
      { id: 'attendance', title: 'Davomat', icon: '📋', mod: './pages/attendance.js', roles: ['direktor', 'moliyachi', 'admin', 'oqituvchi'] },
      { id: 'chat', title: 'Chat / Savollar', icon: '💬', mod: './pages/chat.js', roles: ['direktor', 'moliyachi', 'admin', 'oqituvchi'] },
      { id: 'tasks', title: 'Topshiriqlar', icon: '📝', mod: './pages/tasks.js', roles: ['direktor', 'moliyachi', 'admin', 'oqituvchi'] },
    ],
  },
  {
    title: 'Boshqaruv',
    pages: [
      { id: 'analytics', title: 'Analitika', icon: '📈', mod: './pages/analytics.js', roles: ['direktor', 'moliyachi'] },
      { id: 'finance', title: 'Moliya', icon: '💰', mod: './pages/finance.js', roles: ['direktor', 'moliyachi'] },
      { id: 'reports', title: 'Hisobotlar', icon: '📊', mod: './pages/reports.js', roles: ['direktor', 'moliyachi'] },
      { id: 'teachers', title: 'Xodimlar', icon: '🧑‍🏫', mod: './pages/teachers.js', roles: ['direktor', 'moliyachi'] },
      { id: 'rewards', title: 'Sovg\'alar', icon: '🎁', mod: './pages/rewards.js', roles: ['direktor', 'moliyachi', 'admin'] },
    ],
  },
  {
    title: 'Tizim',
    pages: [
      { id: 'notifications', title: 'Bot & Xavfsizlik', icon: '📨', mod: './pages/notifications.js', roles: ['direktor', 'moliyachi', 'admin'] },
      { id: 'settings', title: 'Sozlamalar', icon: '⚙️', mod: './pages/settings.js', roles: ['direktor', 'moliyachi'] },
    ],
  },
];

const ROLE_LABELS = { direktor: 'Direktor', admin: 'Administrator', moliyachi: 'Moliyachi', menejer: 'Menejer', oqituvchi: "O'qituvchi" };

// Kirish oynasidagi rol tanlovi: rol -> ichki hisob emaili
const LOGIN_ROLES = [
  { key: 'direktor', label: 'Direktor', icon: '👑', email: 'direktor@finway.uz' },
  { key: 'moliyachi', label: 'Moliyachi', icon: '💰', email: 'moliya@finway.uz' },
  { key: 'admin', label: 'Administrator', icon: '🛎', email: 'admin@finway.uz' },
  { key: 'oqituvchi', label: "O'qituvchi", icon: '🧑‍🏫', email: 'ustoz@finway.uz' },
];

// Hisob (email) -> rol va ism
const ACCOUNT_ROLES = {
  'direktor@finway.uz': { role: 'direktor', name: 'Direktor' },
  'moliya@finway.uz': { role: 'moliyachi', name: 'Moliyachi' },
  'admin@finway.uz': { role: 'admin', name: 'Administrator' },
  'ustoz@finway.uz': { role: 'oqituvchi', name: "O'qituvchi" },
  'finway.uz@finway.uz': { role: 'direktor', name: 'Finway' },
  'admin@edu.uz': { role: 'admin', name: 'Administrator' },
  'direktor@edu.uz': { role: 'direktor', name: 'Direktor' },
  'ustoz@edu.uz': { role: 'oqituvchi', name: "O'qituvchi" },
};

const STUDENT_EMAIL = 'oquvchi@finway.uz';
const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

let centerName = "O'quv Markazi";
export let currentUser = { email: '', role: 'admin', name: 'Admin' };

// Profil (umumiy hisoblar uchun — qurilma darajasida: ism + rasm)
const profKey = () => `finway_prof_${currentUser.email || currentUser.role}`;
function getProfile() { try { return JSON.parse(localStorage.getItem(profKey())) || {}; } catch { return {}; } }
function saveProfile(p) { localStorage.setItem(profKey(), JSON.stringify(p)); }
const dispName = () => getProfile().name || currentUser.name;
function adminAvatar() {
  const photo = getProfile().photo;
  const ini = (dispName() || '?').trim().slice(0, 1).toUpperCase();
  return photo
    ? `<img src="${esc(photo)}" class="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200">`
    : `<span class="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">${esc(ini)}</span>`;
}

function openProfile() {
  const p = getProfile();
  const m = modal('Profil', `
    <div class="flex flex-col items-center py-2">
      <div class="relative">
        ${adminAvatar().replace('w-9 h-9', 'w-24 h-24').replace('text-sm', 'text-3xl')}
        <label class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer border-2 border-white shadow">
          📷<input type="file" accept="image/*" id="apInp" class="hidden">
        </label>
      </div>
      <div class="mt-3 font-bold text-lg text-slate-800">${esc(dispName())}</div>
      <div class="text-sm text-slate-400">${esc(ROLE_LABELS[currentUser.role] || currentUser.role)}</div>
    </div>
    <div class="mt-2">
      <button id="apName" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700">✏️ Ko'rsatiladigan ismni o'zgartirish</button>
    </div>
    <p class="mt-3 text-[11px] text-slate-400">Bu profil shu qurilmada saqlanadi (umumiy hisob uchun).</p>`);
  $('#apInp', m.body).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Rasm 5 MB dan katta', 'error'); return; }
    toast('Yuklanmoqda...', 'info');
    try {
      const dot = file.name.lastIndexOf('.');
      const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'jpg';
      const path = `prof_${(currentUser.email || currentUser.role).replace(/[^\w-]/g, '')}_${Date.now()}.${ext}`;
      const { error } = await sb.storage.from('hodim-rasmlar').upload(path, file, { contentType: file.type || undefined, upsert: true });
      if (error) throw error;
      const url = sb.storage.from('hodim-rasmlar').getPublicUrl(path).data.publicUrl;
      saveProfile({ ...getProfile(), photo: url });
      toast('Rasm saqlandi'); m.close(); refreshProfileUI();
    } catch (err) { toast('Xatolik: ' + (err.message || ''), 'error'); }
  };
  $('#apName', m.body).onclick = async () => {
    const v = await formModal("Ismni o'zgartirish", [{ name: 'name', label: 'Ism', required: true, value: dispName(), full: true }]);
    if (!v) return;
    saveProfile({ ...getProfile(), name: v.name });
    m.close(); refreshProfileUI(); toast('Saqlandi');
  };
}

function refreshProfileUI() {
  const nm = $('#profName'); if (nm) nm.textContent = dispName();
  const av = $('#profAvatar'); if (av) av.innerHTML = adminAvatar();
}

async function loadCenterName() {
  try {
    const { data } = await sb.from('settings').select('center_name').single();
    if (data?.center_name) centerName = data.center_name;
  } catch { /* ignore */ }
  return centerName;
}

// SMS edge function chaqiruvi (OTP, bildirishnomalar)
export async function smsCall(action, payload = {}) {
  try {
    const { data, error } = await sb.functions.invoke('sms', { body: { action, ...payload } });
    if (error) return { ok: false, message: error.message };
    return data;
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
}

const allowedPages = () => SECTIONS.flatMap((s) => s.pages).filter((p) => p.roles.includes(currentUser.role));

// Login holati: rol tanlash -> (o'quvchi: telefon+kod / xodim: parol[+kod])
function renderLogin() {
  let selectedRole = null;
  let stage = 'input';   // 'input' | 'otp'
  let otpPhone = '';     // OTP yuborilgan raqam

  $('#app').innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style="background:radial-gradient(125% 80% at 50% -10%, #2563eb 0%, #1e40af 38%, #0b1220 100%);">
      <div class="absolute -top-28 -left-24 w-96 h-96 rounded-full" style="background:radial-gradient(circle, rgba(59,130,246,.45), transparent 70%); filter:blur(20px);"></div>
      <div class="absolute -bottom-32 -right-24 w-[26rem] h-[26rem] rounded-full" style="background:radial-gradient(circle, rgba(99,102,241,.4), transparent 70%); filter:blur(20px);"></div>
      <div class="relative w-full max-w-md">
        <div class="text-center mb-6">
          <div class="w-20 h-20 mx-auto mb-4 rounded-[22px] bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center overflow-hidden shadow-2xl shadow-blue-950/50">
            <img src="/icons/icon-192.png" class="w-full h-full object-cover" onerror="this.style.display='none';this.parentNode.insertAdjacentHTML('afterbegin','<span style=&quot;font-size:2rem&quot;>💎</span>')">
          </div>
          <h1 class="text-[34px] font-black tracking-tight text-white leading-none">Finway <span class="text-blue-300">Academy</span></h1>
          <p class="text-blue-200/70 text-sm mt-2">O'quv markazi boshqaruv tizimi</p>
        </div>
        <div class="bg-white rounded-[26px] shadow-2xl shadow-blue-950/40 p-7 fade-in">
          <div class="text-center text-slate-400 text-[11px] font-bold uppercase tracking-[0.15em] mb-4">Kim sifatida kirasiz?</div>
          <div id="rolePick" class="grid grid-cols-2 gap-2 mb-4">
            ${LOGIN_ROLES.map((r) => `
              <button type="button" data-role="${r.key}" class="flex items-center gap-2 px-3 py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:border-blue-300 transition text-left">
                <span class="text-lg">${r.icon}</span> ${r.label}
              </button>`).join('')}
            <button type="button" data-role="oquvchi" class="col-span-2 flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:from-blue-500 hover:to-indigo-500 transition">
              <span class="text-lg">🎓</span> Men o'quvchiman
            </button>
          </div>
          <form id="loginForm" class="space-y-4"><div id="authArea"></div></form>
        </div>
        <div class="text-center text-blue-300/40 text-[11px] mt-5">© Finway Academy · Buxgalterlar akademiyasi</div>
      </div>
    </div>`;

  const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
  const pickBtns = document.querySelectorAll('#rolePick [data-role]');

  const paintPick = () => pickBtns.forEach((x) => {
    const active = x.dataset.role === selectedRole;
    const student = x.dataset.role === 'oquvchi';
    const staff = x.dataset.role === 'xodim';
    if (student) {
      x.className = `col-span-2 flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl text-sm font-bold text-white transition shadow-lg shadow-blue-600/30 ${active ? 'bg-gradient-to-r from-blue-700 to-indigo-700 ring-2 ring-offset-2 ring-blue-400' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}`;
      return;
    }
    if (staff) {
      x.className = `col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'}`;
      return;
    }
    x.className = `flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition text-left ${active ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/40'}`;
  });

  const otpField = (hint = '') => `
    <div>
      <label class="block text-xs font-semibold text-slate-500 mb-1.5">Tasdiqlash kodi</label>
      <input name="code" inputmode="numeric" autocomplete="one-time-code" required class="${inputCls} tracking-[0.25em] text-center text-lg font-bold" placeholder="________" maxlength="8">
      ${hint ? `<div class="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">${hint}</div>` : ''}
      <button type="button" id="backBtn" class="mt-2 text-xs text-slate-400 hover:text-slate-600">← Orqaga</button>
    </div>
    <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition">Tasdiqlash</button>`;

  const drawAuth = (hint = '') => {
    const area = $('#authArea');
    if (!selectedRole) { area.innerHTML = `<div class="text-center text-slate-400 text-sm py-2">Yuqoridan bo'limni tanlang</div>`; return; }
    if (stage === 'otp') { area.innerHTML = otpField(hint); bindOtpArea(); return; }
    if (selectedRole === 'xodim') {
      area.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Login (email)</label>
          <input name="email" type="email" required class="${inputCls}" placeholder="ism@finway.uz" autocomplete="username">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Parol</label>
          <input name="password" type="password" required class="${inputCls}" placeholder="••••••••" autocomplete="current-password">
        </div>
        <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition">Kirish</button>`;
      setTimeout(() => { const el = $('[name=email]', area); if (el) el.focus(); }, 30);
      return;
    }
    if (selectedRole === 'oquvchi') {
      area.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Telefon raqamingiz</label>
          <input name="phone" type="text" inputmode="tel" data-mask="tel" value="+998 " required class="${inputCls}" placeholder="+998 90 123 45 67">
          <div class="mt-1.5 text-[11px] text-slate-400">Kirish kodi Telegram (yoki SMS) orqali yuboriladi</div>
        </div>
        <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition">📩 Kod olish</button>`;
      const inp = $('[data-mask="tel"]', area);
      if (inp) {
        inp.addEventListener('focus', () => { if (!inp.value) inp.value = '+998 '; });
        inp.addEventListener('input', () => { inp.value = fmtTelInput(inp.value); });
        setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 30);
      }
    } else {
      area.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Parol</label>
          <input name="password" type="password" required class="${inputCls}" placeholder="••••••••">
        </div>
        <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition">Kirish</button>`;
    }
  };

  function bindOtpArea() {
    const bb = $('#backBtn');
    if (bb) bb.onclick = () => { stage = 'input'; drawAuth(); };
  }

  pickBtns.forEach((b) => b.onclick = () => { selectedRole = b.dataset.role; stage = 'input'; paintPick(); drawAuth(); });
  paintPick(); drawAuth();

  const showHintForTest = (res) => {
    // Test rejimi (SMS/Telegram hali ulanmagan) — kod ekranda ko'rsatiladi
    if (res?.test && res?.code) return `🧪 Sinov rejimi (SMS hali ulanmagan). Kirish kodingiz:<br><b style="font-size:1.6em;letter-spacing:.15em">${esc(res.code)}</b>`;
    if (res?.via === 'telegram') return `📲 Kod <b>Telegram</b>ingizga yuborildi — <b>@Finway_uzbot</b> botni oching.`;
    if (res?.via === 'sms') return `📩 Kod <b>SMS</b> orqali yuborildi. Telefoningizni tekshiring.`;
    // Kanal yo'q — kod ham qaytmadi
    return `⚠️ Kod yuborilmadi. Administrator bilan bog'laning.`;
  };

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!selectedRole) { toast("Avval bo'limni tanlang", 'error'); return; }
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button');
    const setBusy = (t) => { btn.disabled = true; btn.textContent = t; };
    const unBusy = (t) => { btn.disabled = false; btn.textContent = t; };

    // === O'QUVCHI ===
    if (selectedRole === 'oquvchi') {
      if (stage === 'input') {
        const digits = onlyDigits(fd.get('phone')).slice(-9);
        if (digits.length < 9) { toast('Telefon raqamini to\'liq kiriting', 'error'); return; }
        setBusy('Yuborilmoqda...');
        const res = await smsCall('send-otp', { phone: digits });
        if (!res?.ok) { toast(res?.message || 'Kod yuborilmadi', 'error'); unBusy('📩 Kod olish'); return; }
        otpPhone = digits; stage = 'otp'; drawAuth(showHintForTest(res));
        return;
      }
      // stage otp
      setBusy('Tekshirilmoqda...');
      const code = String(fd.get('code') || '').trim();
      const res = await smsCall('verify-otp', { phone: otpPhone, code, student: true });
      if (!res?.ok || !res.session) { toast(res?.message || 'Kod noto\'g\'ri', 'error'); unBusy('Tasdiqlash'); return; }
      await sb.auth.setSession(res.session);
      try {
        const students = await run(sb.from('students').select('id,first_name,last_name,phone,status,blocked').not('status', 'in', '(arxiv)'));
        const match = students.find((s) => onlyDigits(s.phone).slice(-9) === otpPhone);
        if (!match) { toast('Bu raqam bilan o\'quvchi topilmadi. Administrator bilan bog\'laning.', 'error'); await sb.auth.signOut(); stage = 'input'; drawAuth(); return; }
        if (match.blocked) { toast('🔒 Akkauntingiz bloklangan. To\'lov muddati o\'tgan — administrator bilan bog\'laning.', 'error'); await sb.auth.signOut(); stage = 'input'; drawAuth(); return; }
        localStorage.setItem('finway_student', JSON.stringify(match));
        await loadCenterName();
        renderStudentApp(match, centerName);
      } catch { unBusy('Tasdiqlash'); }
      return;
    }

    // === XODIM (rol hisobi yoki shaxsiy login) ===
    const isPersonal = selectedRole === 'xodim';
    const role = isPersonal ? null : LOGIN_ROLES.find((r) => r.key === selectedRole);
    const loginEmail = isPersonal ? String(fd.get('email') || '').trim().toLowerCase() : role.email;
    if (stage === 'input') {
      if (isPersonal && !loginEmail) { toast('Login (email) kiriting', 'error'); return; }
      setBusy('Kirilmoqda...');
      const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password: fd.get('password') });
      if (error) {
        toast(isPersonal ? "Login yoki parol noto'g'ri" : ("Parol noto'g'ri — " + role.label + " bo'limi uchun parolni tekshiring"), 'error');
        unBusy('Kirish'); return;
      }
      // Shaxsiy login uchun OTP yo'q — to'g'ridan-to'g'ri kiramiz
      if (isPersonal) { boot(); return; }
      // Rol hisobi: xodim OTP yoqilganmi?
      let staffOtp = false, rolePhone = '';
      try {
        const { data: st } = await sb.from('settings').select('staff_otp, phone_direktor, phone_moliyachi, phone_admin, phone_oqituvchi').single();
        staffOtp = !!st?.staff_otp;
        rolePhone = onlyDigits(st?.[`phone_${selectedRole}`] || '').slice(-9);
      } catch { /* ignore */ }
      if (staffOtp && rolePhone.length === 9) {
        const res = await smsCall('send-otp', { phone: rolePhone });
        if (res?.ok) { otpPhone = rolePhone; stage = 'otp'; drawAuth(showHintForTest(res)); return; }
        // OTP yuborilmasa ham parol to'g'ri — kiritamiz (bloklab qo'ymaslik uchun)
      }
      boot();
      return;
    }
    // xodim otp bosqichi
    setBusy('Tekshirilmoqda...');
    const code = String(fd.get('code') || '').trim();
    const res = await smsCall('verify-otp', { phone: otpPhone, code, student: false });
    if (!res?.ok) { toast(res?.message || 'Kod noto\'g\'ri', 'error'); unBusy('Tasdiqlash'); return; }
    boot();
  };
}

function renderLayout() {
  $('#app').innerHTML = `
    <div class="flex min-h-screen">
      <aside class="w-60 bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-50 flex flex-col -translate-x-full lg:translate-x-0 transition-transform" id="sidebar">
        <div class="px-5 py-5 flex items-center gap-3 border-b border-slate-100">
          <div class="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-sm shadow-blue-600/20 bg-blue-600 flex items-center justify-center">
            <img src="/icons/icon-192.png" class="w-full h-full object-cover" onerror="this.replaceWith(document.createTextNode('💎'))">
          </div>
          <div class="min-w-0">
            <div class="font-extrabold text-blue-700 text-lg leading-tight tracking-tight">Finway</div>
            <div class="text-[11px] text-slate-400 truncate">${esc(centerName === 'Finway' ? "O'quv markazi boshqaruvi" : centerName)}</div>
          </div>
        </div>
        <nav class="flex-1 overflow-y-auto py-4 px-3" id="nav"></nav>
        <div class="p-3 border-t border-slate-100">
          <button id="profileBtn" class="w-full flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg hover:bg-slate-50 text-left transition">
            <span id="profAvatar">${adminAvatar()}</span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-slate-700 truncate" id="profName">${esc(dispName())}</span>
              <span class="block text-[11px] text-slate-400">${esc(ROLE_LABELS[currentUser.role] || currentUser.role)}</span>
            </span>
          </button>
          <button id="logoutBtn" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition">↩ Chiqish</button>
        </div>
      </aside>
      <div id="sbBackdrop" class="fixed inset-0 bg-slate-900/40 z-40 hidden lg:hidden"></div>
      <div class="flex-1 lg:ml-60 flex flex-col min-w-0">
        <header class="bg-white/90 backdrop-blur border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div class="flex items-center gap-3">
            <button id="menuBtn" class="lg:hidden text-2xl">☰</button>
            <h2 class="font-bold text-lg tracking-tight" id="pageTitle"></h2>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-sm text-slate-400 hidden md:block" id="todayLabel"></div>
            <div class="relative">
              <button id="quickAdd" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition">+ Qo'shish</button>
              <div id="quickMenu" class="hidden absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 fade-in"></div>
            </div>
          </div>
        </header>
        <main class="flex-1 p-4 lg:p-8 max-w-[1400px] w-full mx-auto" id="page"></main>
      </div>
    </div>`;

  const allowed = allowedPages().map((p) => p.id);
  $('#nav').innerHTML = SECTIONS.map((sec) => {
    const pages = sec.pages.filter((p) => allowed.includes(p.id));
    if (!pages.length) return '';
    return `
      <div class="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">${esc(sec.title)}</div>
      ${pages.map((p) => `
        <a href="#/${p.id}" data-nav="${p.id}" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 mb-0.5">
          <span class="text-base w-5 text-center opacity-80">${p.icon}</span> ${p.title}
        </a>`).join('')}`;
  }).join('');

  const d = new Date();
  $('#todayLabel').textContent = d.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  $('#profileBtn').onclick = openProfile;
  $('#logoutBtn').onclick = async () => { await sb.auth.signOut(); location.hash = ''; renderLogin(); };
  const _sb = $('#sidebar'), _bd = $('#sbBackdrop');
  const openSb = () => { _sb.classList.remove('-translate-x-full'); _bd.classList.remove('hidden'); };
  const closeSb = () => { _sb.classList.add('-translate-x-full'); _bd.classList.add('hidden'); };
  $('#menuBtn').onclick = () => (_sb.classList.contains('-translate-x-full') ? openSb() : closeSb());
  _bd.onclick = closeSb;

  // Tez qo'shish menyusi — istalgan sahifadan ma'lumot kiritish
  const QUICK = [
    { icon: '🎯', label: 'Yangi lid', steps: ['#/leads', '#addLead'], roles: ['direktor', 'moliyachi', 'admin'] },
    { icon: '🎓', label: "Yangi o'quvchi", steps: ['#/students', '#addStudent'], roles: ['direktor', 'moliyachi', 'admin'] },
    { icon: '👥', label: 'Yangi guruh', steps: ['#/groups', '#addGroup'], roles: ['direktor', 'moliyachi', 'admin'] },
    { icon: '🧑‍🏫', label: 'Yangi xodim', steps: ['#/teachers', '#addEmp'], roles: ['direktor', 'moliyachi'] },
    { icon: '💰', label: "To'lov qabul qilish", steps: ['#/finance', '#addPay'], roles: ['direktor', 'moliyachi'] },
    { icon: '📉', label: 'Xarajat kiritish', steps: ['#/finance', '[data-tab="expenses"]', '#addExp'], roles: ['direktor', 'moliyachi'] },
    { icon: '📋', label: 'Davomat olish', steps: ['#/attendance'], roles: ['direktor', 'moliyachi', 'admin', 'oqituvchi'] },
  ].filter((q) => q.roles.includes(currentUser.role));

  const menu = $('#quickMenu');
  menu.innerHTML = QUICK.map((q, i) => `
    <button data-q="${i}" class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 text-left">
      <span>${q.icon}</span> ${q.label}
    </button>`).join('');

  const waitFor = (sel, t = 5000) => new Promise((res) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const el = document.querySelector(sel);
      if (el) { clearInterval(iv); res(el); }
      else if (Date.now() - t0 > t) { clearInterval(iv); res(null); }
    }, 120);
  });

  $('#quickAdd').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); };
  document.addEventListener('click', () => menu.classList.add('hidden'));
  menu.querySelectorAll('[data-q]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    menu.classList.add('hidden');
    const q = QUICK[Number(b.dataset.q)];
    const [hash, ...clicks] = q.steps;
    if (location.hash !== hash) { location.hash = hash; await new Promise((r) => setTimeout(r, 350)); }
    for (const sel of clicks) {
      const el = await waitFor(sel);
      if (!el) return;
      el.click();
      await new Promise((r) => setTimeout(r, 250));
    }
  });
}

async function route() {
  if (window.__cleanup) { try { window.__cleanup(); } catch { /* ignore */ } window.__cleanup = null; }
  const id = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  const pages = allowedPages();
  const page = pages.find((p) => p.id === id) || pages[0];
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const active = a.dataset.nav === page.id;
    a.className = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`;
  });
  $('#pageTitle').textContent = page.title;
  $('#sidebar').classList.add('-translate-x-full');
  const _bd = $('#sbBackdrop'); if (_bd) _bd.classList.add('hidden');
  const container = $('#page');
  container.innerHTML = '<div class="text-slate-400 text-sm py-10 text-center">Yuklanmoqda...</div>';
  try {
    const mod = await import(page.mod);
    await mod.render(container);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="text-rose-500 text-sm">Sahifani yuklashda xato: ${esc(err.message)}</div>`;
  }
}

async function boot() {
  // Rol darhol, tarmoqqa bog'liq bo'lmagan holda aniqlanadi (xavfsizlik uchun)
  let email = '';
  try {
    const { data: { session } } = await sb.auth.getSession();
    email = session?.user?.email || '';
  } catch { /* davom etamiz */ }

  // O'quvchi sessiyasi bo'lsa — o'quvchi portalini ochamiz
  if (email === STUDENT_EMAIL) {
    const saved = localStorage.getItem('finway_student');
    if (saved) {
      await loadCenterName();
      try { renderStudentApp(JSON.parse(saved), centerName); return; }
      catch { /* buzilgan bo'lsa — davom etamiz */ }
    }
    localStorage.removeItem('finway_student');
    await sb.auth.signOut();
    renderLogin();
    return;
  }

  const acc = ACCOUNT_ROLES[email];
  currentUser = {
    email,
    role: acc ? acc.role : 'oqituvchi',
    name: acc ? acc.name : (email.split('@')[0] || 'Foydalanuvchi'),
  };
  try {
    const [s, emp] = await Promise.all([
      sb.from('settings').select('*').single(),
      (!acc && email) ? sb.from('employees').select('first_name,last_name,role').eq('email', email).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (s?.data?.center_name) centerName = s.data.center_name;
    if (!acc && emp?.data) {
      currentUser.role = emp.data.role === 'oqituvchi' ? 'oqituvchi' : (emp.data.role || 'oqituvchi');
      currentUser.name = `${emp.data.first_name} ${emp.data.last_name || ''}`.trim();
    }
  } catch { /* davom etamiz */ }

  // O'qituvchi — alohida fokuslangan panel (o'zini ro'yxatdan tanlaydi)
  if (currentUser.role === 'oqituvchi') {
    renderTeacherApp(centerName);
    return;
  }

  renderLayout();
  window.onhashchange = route;
  route();
}

// Sessiya tekshiruvi osilib qolsa ham login oynasi chiqishi kafolatlanadi
const sessionResult = await Promise.race([
  sb.auth.getSession(),
  new Promise((r) => setTimeout(() => r({ data: { session: null } }), 3000)),
]);
if (sessionResult?.data?.session) boot(); else renderLogin();

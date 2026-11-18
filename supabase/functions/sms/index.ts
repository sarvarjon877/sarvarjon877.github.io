// Finway bildirishnoma funksiyasi: OTP (SMS-only login), qarzdorlik, davomat.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const STUDENT_EMAIL = 'oquvchi@finway.uz';
const STUDENT_PASSWORD = 'finway2026';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

function normPhone(p: string): string {
  let d = (p || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  if (d.startsWith('8') && d.length === 12) d = '998' + d.slice(1);
  return d;
}
const last9 = (p: string) => (p || '').replace(/\D/g, '').slice(-9);
const fullName = (s: any) => [s?.first_name, s?.last_name].filter(Boolean).join(' ').trim();

async function getConfig() {
  const { data } = await admin.from('sms_config').select('*').eq('id', 1).single();
  return data;
}

async function tgSend(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return r.ok;
  } catch { return false; }
}

let eskizToken: string | null = null; let eskizTokenAt = 0;
async function eskizLogin(email: string, password: string): Promise<string | null> {
  if (eskizToken && Date.now() - eskizTokenAt < 20 * 24 * 3600 * 1000) return eskizToken;
  const fd = new FormData(); fd.append('email', email); fd.append('password', password);
  const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body: fd });
  const j = await r.json().catch(() => null);
  eskizToken = j?.data?.token || null; eskizTokenAt = Date.now();
  return eskizToken;
}

async function sendSms(cfg: any, phone: string, message: string): Promise<string> {
  if (!cfg?.enabled || cfg.provider !== 'eskiz' || (!cfg.token && !(cfg.email && cfg.password))) return 'test';
  try {
    let token = cfg.token as string | null;
    if (!token && cfg.email && cfg.password) token = await eskizLogin(cfg.email, cfg.password);
    if (!token) return 'xato';
    const fd = new FormData();
    fd.append('mobile_phone', normPhone(phone)); fd.append('message', message); fd.append('from', cfg.sender || '4546');
    const r = await fetch('https://notify.eskiz.uz/api/message/sms/send', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    return r.ok ? 'yuborildi' : 'xato';
  } catch { return 'xato'; }
}

// Bildirishnomalar uchun: Telegram ulangan bo'lsa -> Telegram; aks holda SMS.
async function deliver(cfg: any, student: any, phone: string, message: string): Promise<string> {
  if (student?.telegram_chat_id && cfg?.telegram_token) {
    const ok = await tgSend(cfg.telegram_token, student.telegram_chat_id, message);
    if (ok) return 'telegram';
  }
  return await sendSms(cfg, phone, message);
}

async function logSms(phone: string, type: string, message: string, status: string, student_id?: string) {
  await admin.from('sms_log').insert({ phone, type, message, status, student_id: student_id || null });
}

const fmtSum = (n: number) => Math.round(Math.abs(Number(n) || 0)).toLocaleString('ru-RU').replace(/,/g, ' ');

// Raqam xodimga tegishlimi (settings phone_* ustunlari)
async function isStaffPhone(phone: string): Promise<boolean> {
  const { data: st } = await admin.from('settings').select('phone_direktor, phone_moliyachi, phone_admin, phone_oqituvchi').single();
  if (!st) return false;
  return ['phone_direktor', 'phone_moliyachi', 'phone_admin', 'phone_oqituvchi']
    .some((k) => (st as any)[k] && last9(String((st as any)[k])) === last9(phone));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = body.action;
  const cfg = await getConfig();

  if (action === 'send-otp') {
    const phone = normPhone(body.phone || '');
    if (phone.length < 12) return json({ ok: false, error: 'phone', message: 'Telefon raqami noto\'g\'ri' });
    const { data: blk } = await admin.from('blocked_numbers').select('phone').eq('phone', phone).maybeSingle();
    if (blk) return json({ ok: false, error: 'blocked', message: 'Bu raqam bloklangan. Administrator bilan bog\'laning.' });

    // Raqam tizimda ro'yxatdan o'tganmi? (o'quvchi yoki xodim). Bo'lmasa — SMS YUBORILMAYDI (pul tejaladi).
    // Bitta raqamda bir nechta yozuv bo'lishi mumkin: arxivdagisi EMAS, aktivi tanlanadi
    // (ilovaning o'zi ham arxivni login qilmaydi — ikki joyda bir xil qoida bo'lsin).
    const { data: studs } = await admin.from('students').select('id, first_name, last_name, phone, blocked, status').not('phone', 'is', null);
    const matches = (studs || []).filter((s: any) => last9(s.phone) === last9(phone));
    const student = matches.find((s: any) => s.status !== 'arxiv');
    if (!student) {
      if (matches.length) return json({ ok: false, error: 'archived', message: 'Bu raqam arxivda. Administrator bilan bog\'laning.' });
      const staff = await isStaffPhone(phone);
      if (!staff) return json({ ok: false, error: 'notfound', message: 'Bu raqam tizimda ro\'yxatdan o\'tmagan. Administrator bilan bog\'laning.' });
    } else if (student.blocked) {
      return json({ ok: false, error: 'blocked', message: 'Akkauntingiz bloklangan (to\'lov muddati o\'tgan). Administrator bilan bog\'laning.' });
    }

    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await admin.from('otp_codes').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', hourAgo);
    if ((count || 0) >= 5) return json({ ok: false, error: 'limit', message: 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.' });

    const code = String(Math.floor(10000000 + Math.random() * 90000000));
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await admin.from('otp_codes').insert({ phone, code, purpose: 'login', expires_at: expires });
    const msg = `Finway Academy tizimiga kirish uchun tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`;
    // LOGIN faqat SMS orqali (Telegram ishlatilmaydi)
    const status = await sendSms(cfg, phone, msg);
    await logSms(phone, 'login', msg, status, student?.id);
    const via = status === 'yuborildi' ? 'sms' : null;
    // Ism qaytadi — kod ekranida "Xush kelibsiz, ..." ko'rsatish uchun
    return json({ ok: true, via, name: fullName(student) || null, test: status === 'test', code: status === 'test' ? code : undefined });
  }

  // --- O'quvchi kirishi: faqat telefon raqami (SMS kod talab qilinmaydi) ---
  // Himoya kodda emas, qurilmada: hisob birinchi kirgan qurilmaga biriktiriladi.
  // Tekshiruvlarning hammasi shu yerda — mijozga ishonmaymiz.
  if (action === 'student-login') {
    const phone = normPhone(body.phone || '');
    if (phone.length < 12) return json({ ok: false, error: 'phone', message: 'Telefon raqami noto\'g\'ri' });

    const { data: blk } = await admin.from('blocked_numbers').select('phone').eq('phone', phone).maybeSingle();
    if (blk) return json({ ok: false, error: 'blocked', message: 'Bu raqam bloklangan. Administrator bilan bog\'laning.' });

    const { data: studs } = await admin.from('students')
      .select('id,first_name,last_name,phone,status,blocked,mode,access_until,device_id,device_name')
      .not('phone', 'is', null);
    const matches = (studs || []).filter((s: any) => last9(s.phone) === last9(phone));
    const student: any = matches.find((s: any) => s.status !== 'arxiv');
    if (!student) {
      return json({
        ok: false,
        error: matches.length ? 'archived' : 'notfound',
        message: matches.length
          ? 'Bu raqam arxivda. Administrator bilan bog\'laning.'
          : 'Bu raqam tizimda ro\'yxatdan o\'tmagan. Administrator bilan bog\'laning.',
      });
    }
    if (student.blocked) {
      return json({ ok: false, error: 'blocked', message: '🔒 Akkauntingiz bloklangan (to\'lov muddati o\'tgan). Administrator bilan bog\'laning.' });
    }

    const online = student.mode === 'onlayn' || student.mode === 'aralash';
    const bugun = new Date().toISOString().slice(0, 10);
    if (online && student.access_until && student.access_until < bugun) {
      return json({ ok: false, error: 'expired', message: '⏳ Onlayn kirish muddatingiz tugagan. To\'lovni yangilash uchun administrator bilan bog\'laning.' });
    }

    // Qurilma: bo'sh bo'lsa biriktiramiz, boshqasi bo'lsa kiritmaymiz
    const dev = String(body.device_id || '').slice(0, 80);
    if (online && dev) {
      if (!student.device_id) {
        await admin.from('students')
          .update({ device_id: dev, device_name: String(body.device_name || '').slice(0, 40) || null, device_at: new Date().toISOString() })
          .eq('id', student.id);
        student.device_id = dev;
      } else if (student.device_id !== dev) {
        return json({
          ok: false,
          error: 'device',
          message: `📱 Bu hisob boshqa qurilmaga (${student.device_name || 'telefon'}) biriktirilgan. Yangi qurilmadan kirish uchun administratorga murojaat qiling.`,
        });
      }
    }

    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data: si, error } = await anon.auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
    if (error || !si?.session) return json({ ok: false, error: 'session', message: 'Sessiya xatosi' });
    return json({
      ok: true,
      session: { access_token: si.session.access_token, refresh_token: si.session.refresh_token },
      student,
    });
  }

  if (action === 'verify-otp') {
    const phone = normPhone(body.phone || '');
    const code = String(body.code || '').trim();
    const isStudent = !!body.student;
    const { data: rows } = await admin.from('otp_codes').select('*').eq('phone', phone).eq('used', false).order('created_at', { ascending: false }).limit(1);
    const row = rows?.[0];
    if (!row) return json({ ok: false, error: 'notfound', message: 'Kod topilmadi. Qayta kod oling.' });
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: 'expired', message: 'Kod muddati tugagan' });
    if ((row.attempts || 0) >= 5) return json({ ok: false, error: 'attempts', message: 'Juda ko\'p xato urinish' });
    if (row.code !== code) {
      await admin.from('otp_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id);
      return json({ ok: false, error: 'wrong', message: 'Kod noto\'g\'ri' });
    }
    await admin.from('otp_codes').update({ used: true }).eq('id', row.id);
    if (isStudent) {
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      const { data: si, error } = await anon.auth.signInWithPassword({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
      if (error || !si?.session) return json({ ok: false, error: 'session', message: 'Sessiya xatosi' });
      return json({ ok: true, session: { access_token: si.session.access_token, refresh_token: si.session.refresh_token } });
    }
    return json({ ok: true });
  }

  if (action === 'notify' || action === 'notify-debtors' || action === 'notify-promises') {
    const authz = req.headers.get('Authorization') || '';
    const jwt = authz.replace('Bearer ', '');
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ ok: false, error: 'unauthorized', message: 'Ruxsat yo\'q' });

    if (action === 'notify-debtors') {
      // MUHIM: qarzdorlik = remaining (kelishuv summasi - to'langan).
      // Ilovadagi "Qarzdorlar" raqami ham shu ustundan olinadi. Avval balance ishlatilardi
      // va qarzdorlarning bir qismi (deal_amount bor, charges yo'q) chetda qolardi.
      const { data: bals } = await admin.from('student_balances').select('student_id, remaining');
      const debtors = (bals || []).filter((b: any) => Number(b.remaining) > 0);
      let tg = 0, sms = 0, test = 0, fail = 0, skipped = 0;
      for (const d of debtors) {
        const { data: s } = await admin.from('students')
          .select('first_name,last_name,phone,telegram_chat_id,status')
          .eq('id', d.student_id).single();
        if (!s) { skipped++; continue; }
        if (s.status === 'arxiv') { skipped++; continue; }
        if (!s.phone && !s.telegram_chat_id) { skipped++; continue; }
        const msg = `Hurmatli ${s.first_name}! Finway o'quv markazida qarzdorligingiz ${fmtSum(d.remaining)} so'm. Iltimos to'lovni amalga oshiring.`;
        const st = await deliver(cfg, s, s.phone, msg);
        await logSms(s.phone || 'tg', 'qarz', msg, st, d.student_id);
        if (st === 'telegram') tg++; else if (st === 'yuborildi') sms++; else if (st === 'test') test++; else fail++;
      }
      return json({ ok: true, total: debtors.length, sent: tg + sms, telegram: tg, sms, test, fail, skipped });
    }

    if (action === 'notify-promises') {
      // To'lov va'dasi bugun yoki o'tib ketgan o'quvchilarga eslatma
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: studs } = await admin.from('students')
        .select('id,first_name,phone,telegram_chat_id,status,due_date')
        .not('due_date', 'is', null).lte('due_date', todayStr).neq('status', 'arxiv');
      const { data: bals } = await admin.from('student_balances').select('student_id, remaining');
      const remOf = (id: string) => Number((bals || []).find((b: any) => b.student_id === id)?.remaining || 0);
      let tg = 0, sms = 0, test = 0, fail = 0, skipped = 0;
      for (const s of studs || []) {
        const rem = remOf(s.id);
        if (rem <= 0) { skipped++; continue; }
        if (!s.phone && !s.telegram_chat_id) { skipped++; continue; }
        const msg = `Hurmatli ${s.first_name}! Bugun to'lov kuningiz. Qoldiq: ${fmtSum(rem)} so'm. Finway o'quv markazi.`;
        const st = await deliver(cfg, s, s.phone, msg);
        await logSms(s.phone || 'tg', 'vada', msg, st, s.id);
        if (st === 'telegram') tg++; else if (st === 'yuborildi') sms++; else if (st === 'test') test++; else fail++;
      }
      return json({ ok: true, total: (studs || []).length, sent: tg + sms, telegram: tg, sms, test, fail, skipped });
    }

    const { data: s } = await admin.from('students').select('first_name,last_name,phone,telegram_chat_id').eq('id', body.student_id).single();
    if (!s || (!s.phone && !s.telegram_chat_id)) return json({ ok: false, error: 'nocontact', message: 'O\'quvchida telefon/Telegram yo\'q' });
    let msg = '';
    if (body.type === 'qarz') {
      const amt = (body.amount != null) ? fmtSum(body.amount) : '';
      msg = `Hurmatli ${s.first_name}! Finway o'quv markazida qarzdorligingiz ${amt} so'm. Iltimos to'lovni amalga oshiring.`;
    } else if (body.type === 'davomat') {
      msg = `Hurmatli ${s.first_name}! Siz ${body.date || 'bugungi'} kungi darsga kelmadingiz. Finway o'quv markazi.`;
    } else return json({ ok: false, error: 'type', message: 'Tur noto\'g\'ri' });
    const st = await deliver(cfg, s, s.phone, msg);
    await logSms(s.phone || 'tg', body.type, msg, st, body.student_id);
    return json({ ok: true, via: st, test: st === 'test', status: st });
  }

  return json({ ok: false, error: 'unknown', message: 'Noma\'lum amal' });
});

// Chat xabarini Telegramga yuboradi.
//
// Nega kerak: o'quvchi ilovadagi chatga savol yozsa, o'qituvchi uni ko'rmay qolardi.
// Endi savol darhol xodimlar Telegram guruhiga tushadi, javob esa o'quvchining
// Telegramiga boradi.
//
// Ilova faqat xabar ID sini yuboradi — matnni funksiyaning o'zi bazadan o'qiydi,
// shuning uchun bu orqali ixtiyoriy matn yubora olmaydi.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROL = {
  student: "O'quvchi",
  oqituvchi: "O'qituvchi",
  direktor: 'Direktor',
  admin: 'Administrator',
  moliyachi: 'Moliyachi',
} as const;

async function tgSend(token: string, chatId: string | number, text: string) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* bo'sh */ }
  const messageId = String(body.message_id || '');
  if (!messageId) return json({ ok: false, message: 'message_id yo\'q' }, 400);

  const { data: cfg } = await admin.from('sms_config').select('telegram_token, tg_staff_chat').eq('id', 1).single();
  const token = cfg?.telegram_token;
  if (!token) return json({ ok: false, message: 'Telegram bot sozlanmagan' });

  const { data: m } = await admin.from('messages')
    .select('id, body, channel, sender_role, sender_name, student_id, group_id')
    .eq('id', messageId).single();
  if (!m) return json({ ok: false, message: 'Xabar topilmadi' });

  const matn = String(m.body || '').slice(0, 1500);
  const kim = ROL[m.sender_role as keyof typeof ROL] || m.sender_role;
  const yuborildi: string[] = [];

  if (m.sender_role === 'student') {
    // O'quvchi yozdi -> xodimlar guruhiga
    if (!cfg?.tg_staff_chat) return json({ ok: false, message: 'Xodimlar guruhi ulanmagan' });
    let kimdan = m.sender_name || "O'quvchi";
    if (m.student_id) {
      const { data: s } = await admin.from('students').select('first_name, last_name, phone').eq('id', m.student_id).single();
      if (s) kimdan = `${s.first_name} ${s.last_name || ''}`.trim() + (s.phone ? ` · ${s.phone}` : '');
    }
    const sarlavha = m.channel === 'private' ? "💬 Yangi savol" : "💬 Guruh chatida yangi xabar";
    const ok = await tgSend(token, cfg.tg_staff_chat,
      `${sarlavha}\n👤 ${kimdan}\n\n${matn}\n\n↩️ Javob berish: ilovadagi «Chat / Savollar» bo'limi`);
    if (ok) yuborildi.push('xodimlar');
  } else if (m.channel === 'private' && m.student_id) {
    // Xodim javob yozdi -> o'quvchining Telegramiga
    const { data: s } = await admin.from('students').select('first_name, telegram_chat_id').eq('id', m.student_id).single();
    if (!s?.telegram_chat_id) return json({ ok: false, message: 'O\'quvchi Telegramga ulanmagan' });
    const ok = await tgSend(token, s.telegram_chat_id,
      `💬 ${kim}dan javob\n\n${matn}\n\n↩️ Ilovadagi «Chat» bo'limida davom ettiring`);
    if (ok) yuborildi.push('oquvchi');
  }

  return json({ ok: true, yuborildi });
});

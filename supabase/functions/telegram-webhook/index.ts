// Telegram bot webhook.
//
// Ikki vazifasi bor:
//   1) O'QUVCHI uchun — Start bosib telefon raqamini yuborsa, hisobiga ulanadi.
//   2) XODIM uchun — shaxsiy chatda /admin <kod> yuborilsa, o'sha chat boshqaruv
//      paneliga aylanadi: raqam yuborib o'quvchi qo'shish, qurilmalarini
//      bo'shatish, bloklash. Kompyuter yonida bo'lmaganda ham ishlaydi.
//
// Maxfiy kalit manzilda keladi (?k=...), sarlavhada ham tekshiriladi.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const last9 = (p: string) => (p || '').replace(/\D/g, '').slice(-9);
const raqamlar = (t: string) => (t || '').replace(/\D/g, '');

/** 9 xonali raqamni "+998 90 232 16 12" ko'rinishiga keltiradi */
function telYoz(d9: string): string {
  const d = last9(d9);
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

async function tgSend(token: string, chatId: number | string, text: string, replyMarkup?: unknown) {
  const body: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).catch(() => {});
}

async function tgAnswer(token: string, id: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text: text || '' }),
  }).catch(() => {});
}

const contactKeyboard = {
  keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]],
  resize_keyboard: true, one_time_keyboard: true,
};

async function linkStudent(token: string, chatId: number | string, student: any) {
  await admin.from('students').update({ telegram_chat_id: String(chatId), tg_link_code: null }).eq('id', student.id);
  await tgSend(token, chatId, `✅ Finway Academy'ga ulandingiz, ${student.first_name}!\n\nEndi kirish kodi, qarzdorlik va davomat xabarlari shu yerga keladi.`, { remove_keyboard: true });
}

// --- Xodim paneli yordamchilari ---

const YORDAM = `🛠 Finway boshqaruv paneli

Telefon raqamini yuboring — o'quvchi kartasi chiqadi.
Masalan: 90 232 16 12

Raqam ro'yxatda bo'lmasa, qo'shish tugmasi chiqadi.

/royxat — onlayn o'quvchilar ro'yxati
/yordam — shu yordam`;

async function holatSaqla(chatId: string, amal: string, qiymat?: string) {
  await admin.from('tg_holat').upsert({ chat_id: chatId, amal, qiymat: qiymat || null, created_at: new Date().toISOString() });
}
async function holatOqi(chatId: string) {
  const { data } = await admin.from('tg_holat').select('*').eq('chat_id', chatId).maybeSingle();
  if (!data) return null;
  // Eski holat (30 daqiqadan oshgan) hisobga olinmaydi
  if (Date.now() - new Date(data.created_at).getTime() > 30 * 60 * 1000) {
    await admin.from('tg_holat').delete().eq('chat_id', chatId);
    return null;
  }
  return data;
}
const holatTozala = (chatId: string) => admin.from('tg_holat').delete().eq('chat_id', chatId);

async function oquvchiTop(phone9: string) {
  const { data: studs } = await admin.from('students')
    .select('id, first_name, last_name, phone, status, blocked, mode, access_until')
    .not('phone', 'is', null);
  const mos = (studs || []).filter((s: any) => last9(s.phone) === phone9);
  return mos.find((s: any) => s.status !== 'arxiv') || mos[0] || null;
}

async function kartaMatni(s: any) {
  const { data: dev } = await admin.from('student_devices').select('device_name, last_at').eq('student_id', s.id);
  const ism = `${s.first_name} ${s.last_name || ''}`.trim();
  const rejim = s.mode === 'onlayn' ? '🌐 Onlayn' : s.mode === 'aralash' ? '🔀 Aralash' : '🏫 Offline';
  const qatorlar = [
    `👤 ${ism}`,
    `📞 ${s.phone}`,
    `${rejim} · ${s.blocked ? '🔒 bloklangan' : '✅ aktiv'}`,
    `📱 Qurilmalar: ${(dev || []).length}/2${(dev || []).length ? ' — ' + dev!.map((d: any) => d.device_name || 'qurilma').join(', ') : ''}`,
  ];
  if (s.access_until) qatorlar.push(`📅 Muddat: ${s.access_until}`);
  return qatorlar.join('\n');
}

function kartaTugmalari(s: any) {
  const tugmalar: unknown[][] = [];
  tugmalar.push([{ text: '💻 Qurilmalarni bo\'shatish', callback_data: `dev:${s.id}` }]);
  if (s.mode !== 'onlayn') tugmalar.push([{ text: '🌐 Onlayn qilish', callback_data: `onl:${s.id}` }]);
  tugmalar.push([{ text: s.blocked ? '🔓 Blokdan chiqarish' : '🔒 Bloklash', callback_data: `blk:${s.id}` }]);
  return { inline_keyboard: tugmalar };
}

async function kursTugmalari() {
  const { data: kurslar } = await admin.from('courses').select('id, name').order('name');
  return {
    inline_keyboard: (kurslar || []).map((k: any) => [{ text: `📚 ${k.name}`, callback_data: `krs:${k.id}` }]),
  };
}

Deno.serve(async (req) => {
  const { data: cfg } = await admin.from('sms_config')
    .select('telegram_token, telegram_secret, tg_staff_code, tg_staff_chat, tg_admin_code').eq('id', 1).single();
  const token = cfg?.telegram_token;

  const kalit = new URL(req.url).searchParams.get('k')
    || req.headers.get('X-Telegram-Bot-Api-Secret-Token');

  let update: any = {};
  try { update = await req.json(); } catch { /* ignore */ }
  const msg = update.message || update.edited_message;
  const cb = update.callback_query;

  if (cfg?.telegram_secret && kalit !== cfg.telegram_secret) {
    return new Response('forbidden', { status: 403 });
  }
  if (!token) return new Response('ok');

  try {
    // === TUGMA BOSILDI ===
    if (cb) {
      const chatId = String(cb.message?.chat?.id || '');
      const { data: isAdmin } = await admin.from('tg_admins').select('chat_id').eq('chat_id', chatId).maybeSingle();
      if (!isAdmin) { await tgAnswer(token, cb.id, 'Ruxsat yo\'q'); return new Response('ok'); }

      const [amal, qiymat] = String(cb.data || '').split(':');

      if (amal === 'dev') {
        await admin.from('student_devices').delete().eq('student_id', qiymat);
        await admin.from('students').update({ device_id: null, device_name: null, device_at: null }).eq('id', qiymat);
        await tgAnswer(token, cb.id, 'Bo\'shatildi');
        await tgSend(token, chatId, '💻 Qurilmalar bo\'shatildi. Endi o\'quvchi istalgan telefon va noutbukdan kira oladi.');
        return new Response('ok');
      }

      if (amal === 'onl') {
        await admin.from('students').update({ mode: 'onlayn' }).eq('id', qiymat);
        await tgAnswer(token, cb.id, 'Onlayn qilindi');
        await tgSend(token, chatId, '🌐 O\'quvchi onlayn rejimga o\'tkazildi — darsliklar ochildi.');
        return new Response('ok');
      }

      if (amal === 'blk') {
        const { data: s } = await admin.from('students').select('blocked').eq('id', qiymat).single();
        const yangi = !s?.blocked;
        await admin.from('students').update({ blocked: yangi }).eq('id', qiymat);
        await tgAnswer(token, cb.id, yangi ? 'Bloklandi' : 'Ochildi');
        await tgSend(token, chatId, yangi ? '🔒 O\'quvchi bloklandi — ilovaga kira olmaydi.' : '🔓 Blok olib tashlandi.');
        return new Response('ok');
      }

      if (amal === 'add') {
        await holatSaqla(chatId, 'ism', qiymat);
        await tgAnswer(token, cb.id);
        await tgSend(token, chatId, `➕ ${telYoz(qiymat)}\n\nEndi ism va familiyani yozing.\nMasalan: Azizbek Qodirov`);
        return new Response('ok');
      }

      if (amal === 'krs') {
        const holat = await holatOqi(chatId);
        if (!holat || holat.amal !== 'kurs' || !holat.qiymat) {
          await tgAnswer(token, cb.id, 'Muddati o\'tdi');
          return new Response('ok');
        }
        const { tel, ism, familiya } = JSON.parse(holat.qiymat);
        const { data: yangi, error } = await admin.from('students').insert({
          first_name: ism, last_name: familiya || null, phone: telYoz(tel),
          status: 'aktiv', mode: 'onlayn',
        }).select().single();
        if (error || !yangi) {
          await tgAnswer(token, cb.id, 'Xato');
          await tgSend(token, chatId, `⚠️ Qo'shib bo'lmadi: ${error?.message || 'nomalum xato'}`);
          return new Response('ok');
        }
        await admin.from('student_courses').insert({ student_id: yangi.id, course_id: qiymat });
        await holatTozala(chatId);
        await tgAnswer(token, cb.id, 'Qo\'shildi');
        await tgSend(token, chatId, `✅ Qo'shildi\n\n${await kartaMatni(yangi)}\n\nO'quvchi online.finway.uz ga kirib, shu raqamni tersa — SMS kod keladi va kiradi.`);
        return new Response('ok');
      }

      await tgAnswer(token, cb.id);
      return new Response('ok');
    }

    if (!msg) return new Response('ok');

    const chatId = msg.chat?.id;
    const chatIdStr = String(chatId);
    const chatType = msg.chat?.type || 'private';
    const text = (msg.text || '').trim();

    // === GURUH ===
    if (chatType === 'group' || chatType === 'supergroup') {
      if (text.startsWith('/ulash')) {
        const kod = (text.split(/\s+/)[1] || '').trim();
        if (!cfg?.tg_staff_code) {
          await tgSend(token, chatId, '⚠️ Ulash kodi berilmagan. Ilovadan yangi kod oling.');
        } else if (kod && kod.toUpperCase() === String(cfg.tg_staff_code).toUpperCase()) {
          await admin.from('sms_config').update({ tg_staff_chat: String(chatId), tg_staff_code: null }).eq('id', 1);
          await tgSend(token, chatId, '✅ Ulandi. Endi o\'quvchilarning savollari shu guruhga tushadi.');
        } else {
          await tgSend(token, chatId, '❌ Kod noto\'g\'ri.');
        }
      }
      return new Response('ok');
    }

    // === SHAXSIY CHAT ===

    // Xodim paneliga ulanish
    if (text.startsWith('/admin')) {
      const kod = (text.split(/\s+/)[1] || '').trim();
      if (cfg?.tg_admin_code && kod && kod.toUpperCase() === String(cfg.tg_admin_code).toUpperCase()) {
        await admin.from('tg_admins').upsert({
          chat_id: chatIdStr,
          nomi: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || null,
        });
        await tgSend(token, chatId, `✅ Boshqaruv paneli ochildi.\n\n${YORDAM}`, { remove_keyboard: true });
      } else {
        await tgSend(token, chatId, '❌ Kod noto\'g\'ri.');
      }
      return new Response('ok');
    }

    const { data: isAdmin } = await admin.from('tg_admins').select('chat_id').eq('chat_id', chatIdStr).maybeSingle();

    // --- XODIM ---
    if (isAdmin) {
      if (text === '/yordam' || text === '/help' || text === '/start') {
        await tgSend(token, chatId, YORDAM);
        return new Response('ok');
      }

      if (text === '/royxat') {
        const { data: studs } = await admin.from('students')
          .select('id, first_name, last_name, phone, blocked')
          .in('mode', ['onlayn', 'aralash']).neq('status', 'arxiv').order('first_name');
        const { data: devs } = await admin.from('student_devices').select('student_id');
        const soni = (id: string) => (devs || []).filter((d: any) => d.student_id === id).length;
        const qatorlar = (studs || []).map((s: any, i: number) =>
          `${i + 1}. ${s.first_name} ${s.last_name || ''}`.trim()
          + `\n    ${s.phone} · 📱${soni(s.id)}/2${s.blocked ? ' · 🔒' : ''}`).join('\n');
        await tgSend(token, chatId, `🌐 Onlayn o'quvchilar: ${(studs || []).length}\n\n${qatorlar || 'Hali yo\'q'}`);
        return new Response('ok');
      }

      // Ism kutyapmizmi?
      const holat = await holatOqi(chatIdStr);
      if (holat?.amal === 'ism' && text && !text.startsWith('/')) {
        const bolaklar = text.split(/\s+/);
        const ism = bolaklar[0];
        const familiya = bolaklar.slice(1).join(' ');
        await holatSaqla(chatIdStr, 'kurs', JSON.stringify({ tel: holat.qiymat, ism, familiya }));
        await tgSend(token, chatId, `📚 ${ism} ${familiya}\n\nQaysi kursga qo'shamiz?`, await kursTugmalari());
        return new Response('ok');
      }

      // Telefon raqami yuborildi
      const d = raqamlar(msg.contact?.phone_number || text);
      if (d.length >= 9) {
        const phone9 = last9(d);
        const s = await oquvchiTop(phone9);
        if (s) {
          await tgSend(token, chatId, await kartaMatni(s), kartaTugmalari(s));
        } else {
          await tgSend(token, chatId, `❌ ${telYoz(phone9)} — ro'yxatda yo'q.`, {
            inline_keyboard: [[{ text: '➕ O\'quvchi qilib qo\'shish', callback_data: `add:${phone9}` }]],
          });
        }
        return new Response('ok');
      }

      await tgSend(token, chatId, YORDAM);
      return new Response('ok');
    }

    // --- O'QUVCHI ---
    if (msg.contact) {
      if (msg.contact.user_id && msg.from?.id && msg.contact.user_id !== msg.from.id) {
        await tgSend(token, chatId, '⚠️ Iltimos, O‘ZINGIZNING raqamingizni yuboring (pastdagi tugma orqali).', contactKeyboard);
        return new Response('ok');
      }
      const phone9 = last9(msg.contact.phone_number || '');
      const { data: studs } = await admin.from('students').select('id, first_name, phone').not('phone', 'is', null).not('status', 'in', '(arxiv)');
      const student = (studs || []).find((s: any) => last9(s.phone) === phone9);
      if (student) { await linkStudent(token, chatId, student); return new Response('ok'); }
      await tgSend(token, chatId, '❌ Bu raqam o‘quv markazi ro‘yxatida topilmadi. Administrator bilan bog‘laning.', { remove_keyboard: true });
      return new Response('ok');
    }

    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/)[1] || '';
      if (payload) {
        const { data: st } = await admin.from('students').select('id, first_name').eq('tg_link_code', payload).maybeSingle();
        if (st) { await linkStudent(token, chatId, st); return new Response('ok'); }
      }
      await tgSend(token, chatId, 'Assalomu alaykum! Finway Academy botiga xush kelibsiz.\n\nUlanish uchun pastdagi tugmani bosib, telefon raqamingizni yuboring 👇', contactKeyboard);
      return new Response('ok');
    }

    await tgSend(token, chatId, 'Ulanish uchun telefon raqamingizni yuboring 👇', contactKeyboard);
    return new Response('ok');
  } catch (err) {
    // Nosozlik yuzaga kelsa — xodimlar guruhiga xabar beramiz, jim qolmaymiz
    const matn = `⚠️ Bot xatosi\n${String((err as Error)?.message || err).slice(0, 500)}`;
    if (cfg?.tg_staff_chat) await tgSend(token, cfg.tg_staff_chat, matn);
    console.error('BOT XATO', err);
    return new Response('ok');
  }
});

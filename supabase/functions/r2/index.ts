// R2 — dars videolari uchun vaqtincha (imzolangan) havolalar beradi.
//
// Bucket yopiq turadi. Brauzer R2 kalitlarini KO'RMAYDI — ular faqat shu
// funksiyaning maxfiy sozlamalarida yashaydi.
//
// Amallar:
//   health      — kalitlar o'rnatilganmi (qiymatini ko'rsatmaydi)
//   upload-url  — videoni yuklash uchun vaqtincha havola (faqat xodimlar)
//   play-url    — videoni ko'rish uchun vaqtincha havola (muddati cheklangan)
//   delete      — videoni o'chirish (faqat xodimlar)
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const env = (k: string) => Deno.env.get(k) || '';
const STUDENT_EMAIL = 'oquvchi@finway.uz';

// Ko'rish havolasi necha soat yashaydi
const PLAY_TTL = 6 * 3600;
// Yuklash havolasi necha soat yashaydi (katta fayl uzoq ketishi mumkin)
const UPLOAD_TTL = 4 * 3600;

/** Authorization sarlavhasidagi JWT ichidan emailni oladi (imzoni Supabase o'zi tekshiradi). */
function callerEmail(req: Request): string {
  try {
    const raw = req.headers.get('authorization') || '';
    const token = raw.replace(/^Bearer\s+/i, '');
    const part = token.split('.')[1];
    if (!part) return '';
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return String(JSON.parse(json)?.email || '').toLowerCase();
  } catch {
    return '';
  }
}

/** Fayl yo'lini xavfsiz holga keltiradi (papkadan chiqib ketmasin). */
function cleanKey(key: unknown): string {
  return String(key || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .map((p) => p.replace(/[^\w.\-]/g, '_'))
    .join('/');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
    });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* bo'sh so'rov — health deb qaraymiz */ }
  const action = String(body.action || 'health');

  const accountId = env('R2_ACCOUNT_ID');
  const bucket = env('R2_BUCKET');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');

  if (action === 'health') {
    const ok = !!(accountId && bucket && accessKeyId && secretAccessKey);
    return json({
      ok,
      sozlamalar: {
        R2_ACCOUNT_ID: !!accountId,
        R2_BUCKET: !!bucket,
        R2_ACCESS_KEY_ID: !!accessKeyId,
        R2_SECRET_ACCESS_KEY: !!secretAccessKey,
      },
      bucket: bucket || null,
      message: ok ? 'R2 sozlangan' : 'R2 kalitlari to\'liq emas',
    });
  }

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return json({ ok: false, message: 'R2 kalitlari sozlanmagan' }, 500);
  }

  const key = cleanKey(body.key);
  if (!key) return json({ ok: false, message: 'Fayl yo\'li ko\'rsatilmagan' }, 400);

  const email = callerEmail(req);
  const isStaff = !!email && email !== STUDENT_EMAIL;

  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;

  try {
    if (action === 'upload-url') {
      if (!isStaff) return json({ ok: false, message: 'Faqat xodimlar video yuklay oladi' }, 403);
      const signed = await client.sign(
        new Request(`${base}?X-Amz-Expires=${UPLOAD_TTL}`, { method: 'PUT' }),
        { aws: { signQuery: true } },
      );
      return json({ ok: true, url: signed.url, key, expires_in: UPLOAD_TTL });
    }

    if (action === 'play-url') {
      const signed = await client.sign(
        new Request(`${base}?X-Amz-Expires=${PLAY_TTL}`, { method: 'GET' }),
        { aws: { signQuery: true } },
      );
      return json({ ok: true, url: signed.url, key, expires_in: PLAY_TTL });
    }

    if (action === 'delete') {
      if (!isStaff) return json({ ok: false, message: 'Faqat xodimlar o\'chira oladi' }, 403);
      const res = await client.fetch(base, { method: 'DELETE' });
      return json({ ok: res.ok || res.status === 404, status: res.status });
    }

    return json({ ok: false, message: `Noma'lum amal: ${action}` }, 400);
  } catch (e) {
    return json({ ok: false, message: String((e as Error)?.message || e) }, 500);
  }
});

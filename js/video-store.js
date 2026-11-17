// Dars videolarini saqlash — Cloudflare R2.
//
// Bucket yopiq turadi. Brauzer R2 kalitlarini KO'RMAYDI: yuklash va ko'rish uchun
// vaqtincha imzolangan havolani "r2" edge funksiyasi beradi (kalitlar o'sha yerda).
//
// Eski (Supabase Storage'dagi) videolar ham ishlayveradi — ular video_url da
// to'liq havola bilan saqlangan.
import { sb } from './db.js';

export const MAX_VIDEO_MB = 2048;   // R2 da amalda chegara yo'q; ehtiyot uchun
export const TAVSIYA_MB = 400;      // bundan kattasida ogohlantiramiz

export const mb = (bytes) => Math.round((Number(bytes) || 0) / 1048576);

/** r2 edge funksiyasini chaqiradi. */
async function r2(action, payload = {}) {
  const { data, error } = await sb.functions.invoke('r2', { body: { action, ...payload } });
  if (error) throw new Error(error.message || 'R2 bilan bog\'lanib bo\'lmadi');
  if (!data?.ok) throw new Error(data?.message || 'R2 xatosi');
  return data;
}

const safeExt = (name) => {
  const dot = String(name || '').lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'mp4';
  return ext || 'mp4';
};

/** Dars videosi fayl ko'rinishidami (R2, eski Supabase fayli yoki to'g'ridan-to'g'ri havola). */
export const isFileVideo = (url, lesson) =>
  lesson?.video_provider === 'r2' ||
  lesson?.video_provider === 'file' ||
  /\.(mp4|webm|mov|m4v|m3u8)(\?|$)/i.test(String(url || ''));

/**
 * Darsni ko'rish uchun havola. R2 dagi video uchun vaqtincha (bir necha soatlik)
 * havola so'raydi; eski videolar uchun saqlangan havolani qaytaradi.
 */
export async function resolveVideoUrl(lesson) {
  if (!lesson) return null;
  if (lesson.video_provider === 'r2' && lesson.video_path) {
    const res = await r2('play-url', { key: lesson.video_path });
    return res.url;
  }
  return lesson.video_url || null;
}

/**
 * Videoni R2 ga yuklaydi. Yuklanish foizi onProgress orqali qaytadi.
 * @returns {Promise<{path:string, size:number}>}
 */
export async function uploadVideo(file, { folder = 'umumiy', onProgress } = {}) {
  const safeFolder = String(folder).replace(/[^\w-]/g, '_');
  const name = (crypto.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^\w-]/g, '');
  const key = `${safeFolder}/${name}.${safeExt(file.name)}`;

  const { url } = await r2('upload-url', { key });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type || 'video/mp4');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ path: key, size: file.size });
      else reject(new Error(`Yuklanmadi (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Tarmoq xatosi — internetni tekshiring'));
    xhr.onabort = () => reject(new Error('Bekor qilindi'));
    xhr.send(file);
    if (onProgress) onProgress(0, 0, file.size);
  });
}

/** Videoni o'chiradi. Eski Supabase fayllari ham hisobga olinadi. */
export async function deleteVideo(path, provider) {
  if (!path) return;
  try {
    if (provider === 'r2') await r2('delete', { key: path });
    else await sb.storage.from('darslar').remove([path]);
  } catch { /* o'chmasa ham davom etamiz */ }
}

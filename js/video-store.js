// Dars videolarini saqlash joyi.
//
// Hozir: Supabase Storage ('darslar' bucket).
// Keyin Cloudflare R2 yoki o'z serverimizga o'tsak — FAQAT shu fayl o'zgaradi,
// qolgan kod (lessons.js, student.js) o'zgarishsiz qoladi.
import { sb } from './db.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const VIDEO_BUCKET = 'darslar';
export const MAX_VIDEO_MB = 1024;          // bitta video uchun chegara
export const TAVSIYA_MB = 250;             // bundan kattasi uchun ogohlantiramiz

export const mb = (bytes) => Math.round((Number(bytes) || 0) / 1048576);

export function videoPublicUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;     // allaqachon to'liq havola
  return `${SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/${path}`;
}

const safeExt = (name) => {
  const dot = String(name || '').lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'mp4';
  return ext || 'mp4';
};

/**
 * Videoni yuklaydi. Yuklanish foizi onProgress orqali qaytadi.
 * @returns {Promise<{path:string, url:string, size:number}>}
 */
export async function uploadVideo(file, { folder = 'umumiy', onProgress } = {}) {
  const path = `${folder}/${(crypto.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^\w-]/g, '')}.${safeExt(file.name)}`;
  let token = SUPABASE_KEY;
  try {
    const { data } = await sb.auth.getSession();
    if (data?.session?.access_token) token = data.session.access_token;
  } catch { /* anon kalit bilan urinib ko'ramiz */ }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${VIDEO_BUCKET}/${path}`);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('content-type', file.type || 'video/mp4');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ path, url: videoPublicUrl(path), size: file.size });
      } else {
        let msg = `Yuklanmadi (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch { /* matn emas */ }
        if (xhr.status === 413) msg = 'Fayl juda katta — saqlagich qabul qilmadi';
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Tarmoq xatosi — internetni tekshiring'));
    xhr.onabort = () => reject(new Error('Bekor qilindi'));
    xhr.send(file);
    if (onProgress) onProgress(0, 0, file.size);
  });
}

export async function deleteVideo(path) {
  if (!path || /^https?:\/\//i.test(path)) return;
  try { await sb.storage.from(VIDEO_BUCKET).remove([path]); } catch { /* o'chmasa ham davom etamiz */ }
}

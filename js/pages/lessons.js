// Darsliklar — kurs bo'yicha video darslar kutubxonasi.
// Struktura: Kurs -> Modul -> Dars (video havolasi + tavsif + PDF/prezentatsiya).
// Xodimlar (direktor/moliyachi/admin/o'qituvchi) qo'shadi; o'quvchilar portalda ko'radi.
import { sb, run } from '../db.js';
import { $, $$, esc, toast, modal, confirmDialog, emptyState, btnCls } from '../ui.js';
import { currentUser } from '../app.js';
import { uploadVideo, deleteVideo, mb, MAX_VIDEO_MB, TAVSIYA_MB } from '../video-store.js';

const canManage = () => ['direktor', 'moliyachi', 'admin', 'oqituvchi'].includes(currentUser.role);
const LS_KEY = 'finway_lib_course';

// --- Video havolasini tahlil qilish (YouTube / Vimeo / oddiy havola) ---
export function parseVideo(url, lesson) {
  const u = String(url || '').trim();
  if (!u) return null;
  // Bizga yuklangan video fayl
  if (lesson?.video_provider === 'file' || /\.(mp4|webm|mov|m4v|m3u8)(\?|$)/i.test(u)) {
    return { type: 'file', embed: null, url: u };
  }
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { type: 'youtube', embed: `https://www.youtube.com/embed/${m[1]}`, url: u };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { type: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}`, url: u };
  return { type: 'link', embed: null, url: u };
}

export function videoBlock(url, dark = false, lesson = null) {
  const v = parseVideo(url, lesson);
  if (!v) return '';
  if (v.type === 'file') {
    return `<div class="relative w-full rounded-xl overflow-hidden bg-black" style="aspect-ratio:16/9">
      <video src="${esc(v.url)}" class="absolute inset-0 w-full h-full" controls playsinline preload="metadata" controlsList="nodownload"></video>
    </div>`;
  }
  if (v.embed) {
    return `<div class="relative w-full rounded-xl overflow-hidden bg-black" style="aspect-ratio:16/9">
      <iframe src="${esc(v.embed)}" class="absolute inset-0 w-full h-full" loading="lazy"
        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>
    </div>`;
  }
  const cls = dark ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
    : 'bg-slate-900 text-white hover:bg-slate-700';
  return `<a href="${esc(v.url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl ${cls} text-sm font-semibold">▶ Videoni ochish</a>`;
}

const fmtDur = (m) => {
  m = Number(m) || 0;
  if (!m) return '';
  const h = Math.floor(m / 60), mm = m % 60;
  return (h ? `${h} soat ` : '') + (mm ? `${mm} daq` : '') || `${m} daq`;
};

const uploadInputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

// --- Dars qo'shish/tahrirlash modali (fayl yuklash bilan) ---
function lessonModal(module, lesson) {
  return new Promise((resolve) => {
    const isEdit = !!lesson;
    const L = lesson || {};
    const m = modal(isEdit ? 'Darsni tahrirlash' : `Yangi dars — ${module.title}`, `
      <form class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Dars nomi <span class="text-rose-500">*</span></label>
          <input name="title" required value="${esc(L.title || '')}" class="${uploadInputCls}" placeholder="Masalan: 1-dars. Balans hisobi">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">🎬 Dars videosi</label>
          ${L.video_url ? `<div class="flex items-center gap-2 mb-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <span>${L.video_provider === 'file' ? '🎞' : '🔗'}</span>
            <span class="truncate flex-1 text-slate-600">${L.video_provider === 'file' ? `Yuklangan video${L.video_size ? ` · ${mb(L.video_size)} MB` : ''}` : esc(L.video_url)}</span>
            <label class="inline-flex items-center gap-1 text-rose-500 cursor-pointer shrink-0"><input type="checkbox" name="remove_video" class="accent-rose-500"> o'chirish</label>
          </div>` : ''}
          <input name="video" type="file" accept="video/*" class="${uploadInputCls} file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-semibold">
          <div class="mt-1.5 text-[11px] text-slate-400">${L.video_url ? 'Yangi video tanlasangiz eskisini almashtiradi. ' : ''}Videoni shu yerga yuklang — o'quvchi uni faqat ilova ichida ko'radi. Maksimum ${MAX_VIDEO_MB} MB, ${TAVSIYA_MB} MB atrofida bo'lsa telefonda tez ochiladi.</div>
          <div id="vidProg" class="hidden mt-2">
            <div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div id="vidBar" class="h-full bg-blue-600 transition-all" style="width:0%"></div></div>
            <div id="vidTxt" class="text-[11px] text-slate-500 mt-1">Yuklanmoqda...</div>
          </div>
          <details class="mt-2" ${L.video_url && L.video_provider !== 'file' ? 'open' : ''}>
            <summary class="text-[11px] text-slate-400 cursor-pointer select-none">yoki tashqi havola qo'yish (YouTube / Vimeo)</summary>
            <input name="video_url" value="${esc(L.video_provider === 'file' ? '' : (L.video_url || ''))}" class="${uploadInputCls} mt-1.5" placeholder="https://youtu.be/...">
          </details>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">Davomiyligi (daqiqa)</label>
            <input name="duration_min" type="number" min="0" inputmode="numeric" value="${esc(L.duration_min ?? '')}" class="${uploadInputCls}" placeholder="240">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 mb-1.5">Tartib raqami</label>
            <input name="sort_order" type="number" min="0" inputmode="numeric" value="${esc(L.sort_order ?? '')}" class="${uploadInputCls}" placeholder="1">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Tavsif (opisaniya)</label>
          <textarea name="description" rows="3" class="${uploadInputCls}" placeholder="Dars haqida qisqacha...">${esc(L.description || '')}</textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">PDF / prezentatsiya</label>
          ${L.pdf_url ? `<div class="flex items-center gap-2 mb-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <span>📄</span><a href="${esc(L.pdf_url)}" target="_blank" class="text-blue-600 hover:underline truncate flex-1">${esc(L.pdf_name || 'Fayl')}</a>
            <label class="inline-flex items-center gap-1 text-rose-500 cursor-pointer"><input type="checkbox" name="remove_pdf" class="accent-rose-500"> o'chirish</label>
          </div>` : ''}
          <input name="pdf" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,application/pdf" class="${uploadInputCls} file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:text-xs file:font-semibold">
          <div class="mt-1.5 text-[11px] text-slate-400">${L.pdf_url ? 'Yangi fayl tanlansangiz eskisini almashtiradi. ' : ''}Maksimum 50 MB.</div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" data-cancel class="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium">Bekor qilish</button>
          <button type="submit" class="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold">${isEdit ? 'Saqlash' : "Qo'shish"}</button>
        </div>
      </form>`, { wide: false });

    $('[data-cancel]', m.body).onclick = () => { m.close(); resolve(false); };
    $('form', m.body).onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim();
      if (!title) return toast('Dars nomi shart', 'error');

      const row = {
        module_id: module.id,
        title,
        description: String(fd.get('description') || '').trim() || null,
        duration_min: fd.get('duration_min') ? Number(fd.get('duration_min')) : null,
        sort_order: fd.get('sort_order') ? Number(fd.get('sort_order')) : (isEdit ? (L.sort_order || 0) : 0),
      };

      // --- Video: yuklangan fayl yoki tashqi havola ---
      const vidFile = fd.get('video');
      const hasVideo = vidFile && vidFile.size > 0;
      const linkUrl = String(fd.get('video_url') || '').trim();
      const rmVideo = fd.get('remove_video') === 'on';
      if (hasVideo && vidFile.size > MAX_VIDEO_MB * 1048576) {
        return toast(`Video ${MAX_VIDEO_MB} MB dan katta (${mb(vidFile.size)} MB). Avval siqib oling.`, 'error');
      }
      if (!hasVideo) {
        if (rmVideo) {
          row.video_url = null; row.video_provider = null; row.video_path = null; row.video_size = null;
        } else if (linkUrl) {
          row.video_url = linkUrl;
          row.video_provider = parseVideo(linkUrl)?.type || 'link';
          row.video_path = null; row.video_size = null;
        } else if (isEdit && L.video_provider !== 'file' && L.video_url) {
          row.video_url = null; row.video_provider = null;   // havola maydoni tozalangan
        }
      }

      const file = fd.get('pdf');
      const hasNewFile = file && file.size > 0;
      if (hasNewFile && file.size > 52428800) return toast('Fayl 50 MB dan katta', 'error');

      submitBtn.disabled = true;
      submitBtn.textContent = hasVideo ? 'Video yuklanmoqda...' : (hasNewFile ? 'Yuklanmoqda...' : 'Saqlanmoqda...');
      try {
        if (hasVideo) {
          const prog = $('#vidProg', m.body), bar = $('#vidBar', m.body), txt = $('#vidTxt', m.body);
          prog.classList.remove('hidden');
          const up = await uploadVideo(vidFile, {
            folder: module.id,
            onProgress: (p, loaded, total) => {
              bar.style.width = `${p}%`;
              txt.textContent = `${p}% · ${mb(loaded)} / ${mb(total)} MB`;
            },
          });
          if (isEdit && L.video_path) await deleteVideo(L.video_path);
          row.video_url = up.url; row.video_provider = 'file'; row.video_path = up.path; row.video_size = up.size;
          txt.textContent = 'Video yuklandi ✅';
        } else if (rmVideo && isEdit && L.video_path) {
          await deleteVideo(L.video_path);
        }
        if (hasNewFile) {
          const dot = file.name.lastIndexOf('.');
          const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'pdf';
          const path = `${module.id}/${(crypto.randomUUID?.() || String(Date.now()) + Math.random()).replace(/[^\w-]/g, '')}.${ext}`;
          const { error: upErr } = await sb.storage.from('materials').upload(path, file, { contentType: file.type || undefined, upsert: false });
          if (upErr) throw upErr;
          row.pdf_url = sb.storage.from('materials').getPublicUrl(path).data.publicUrl;
          row.pdf_name = file.name;
        } else if (isEdit && fd.get('remove_pdf') === 'on') {
          row.pdf_url = null;
          row.pdf_name = null;
        }

        if (isEdit) await run(sb.from('course_lessons').update(row).eq('id', L.id));
        else await run(sb.from('course_lessons').insert(row));
        m.close();
        toast(isEdit ? 'Saqlandi' : "Dars qo'shildi");
        resolve(true);
      } catch (err) {
        console.error(err);
        toast('Xatolik: ' + (err.message || 'saqlanmadi'), 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Saqlash' : "Qo'shish";
      }
    };
  });
}

// --- Modul qo'shish/tahrirlash (oddiy modal) ---
function moduleModal(courseId, module) {
  return new Promise((resolve) => {
    const isEdit = !!module;
    const M = module || {};
    const m = modal(isEdit ? 'Modulni tahrirlash' : 'Yangi modul', `
      <form class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Modul nomi <span class="text-rose-500">*</span></label>
          <input name="title" required value="${esc(M.title || '')}" class="${uploadInputCls}" placeholder="Masalan: 1-modul. Kirish">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Tavsif</label>
          <textarea name="description" rows="2" class="${uploadInputCls}" placeholder="Ixtiyoriy">${esc(M.description || '')}</textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1.5">Tartib raqami</label>
          <input name="sort_order" type="number" min="0" inputmode="numeric" value="${esc(M.sort_order ?? '')}" class="${uploadInputCls}" placeholder="1">
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" data-cancel class="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium">Bekor qilish</button>
          <button type="submit" class="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold">${isEdit ? 'Saqlash' : "Qo'shish"}</button>
        </div>
      </form>`);
    $('[data-cancel]', m.body).onclick = () => { m.close(); resolve(false); };
    $('form', m.body).onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim();
      if (!title) return toast('Modul nomi shart', 'error');
      const row = {
        course_id: courseId,
        title,
        description: String(fd.get('description') || '').trim() || null,
        sort_order: fd.get('sort_order') ? Number(fd.get('sort_order')) : (isEdit ? (M.sort_order || 0) : 0),
      };
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Saqlanmoqda...';
      try {
        if (isEdit) await run(sb.from('course_modules').update(row).eq('id', M.id));
        else await run(sb.from('course_modules').insert(row));
        m.close(); toast(isEdit ? 'Saqlandi' : "Modul qo'shildi"); resolve(true);
      } catch (err) {
        toast('Xatolik: ' + (err.message || ''), 'error');
        btn.disabled = false; btn.textContent = isEdit ? 'Saqlash' : "Qo'shish";
      }
    };
  });
}

// --- PDF/hujjatni ilova ichida ochish (yangi oynaga chiqmasdan) ---
export function openPdf(url, name) {
  const viewer = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  const m = modal(name || 'Hujjat', `
    <iframe src="${esc(viewer)}" class="w-full rounded-lg border border-slate-200 bg-slate-50" style="height:78vh"></iframe>
    <div class="mt-2 text-right"><a href="${esc(url)}" target="_blank" rel="noopener" class="text-xs text-blue-600 hover:underline">Ochilmasa — yangi oynada ochish ↗</a></div>
  `, { wide: true });
  return m;
}

// --- Darsni ko'rish (preview) modali ---
function viewLesson(lesson) {
  const m = modal(lesson.title, `
    ${lesson.video_url ? videoBlock(lesson.video_url, false, lesson) : '<div class="text-sm text-slate-400 py-3">Video qo\'yilmagan</div>'}
    ${lesson.duration_min ? `<div class="mt-3 text-xs text-slate-500">⏱ ${esc(fmtDur(lesson.duration_min))}</div>` : ''}
    ${lesson.description ? `<div class="mt-3 text-sm text-slate-600 whitespace-pre-wrap">${esc(lesson.description)}</div>` : ''}
    ${lesson.pdf_url ? `<button data-pdf class="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700">📄 ${esc(lesson.pdf_name || 'PDF / prezentatsiya')}</button>` : ''}
  `, { wide: true });
  const pb = $('[data-pdf]', m.body);
  if (pb) pb.onclick = () => openPdf(lesson.pdf_url, lesson.pdf_name);
}

export async function render(container) {
  const courses = await run(sb.from('courses').select('id,name').order('name'));
  if (!courses.length) {
    container.innerHTML = emptyState("Avval kurs qo'shing — keyin shu kurs uchun darslik modullarini yarating.");
    return;
  }
  let courseId = localStorage.getItem(LS_KEY);
  if (!courses.some((c) => c.id === courseId)) courseId = courses[0].id;

  async function paint() {
    localStorage.setItem(LS_KEY, courseId);
    container.innerHTML = '<div class="text-slate-400 text-sm py-10 text-center">Yuklanmoqda...</div>';
    const modules = await run(sb.from('course_modules').select('*').eq('course_id', courseId).order('sort_order').order('created_at'));
    const modIds = modules.map((m) => m.id);
    const lessons = modIds.length
      ? await run(sb.from('course_lessons').select('*').in('module_id', modIds).order('sort_order').order('created_at'))
      : [];
    const byMod = (mid) => lessons.filter((l) => l.module_id === mid);

    const manage = canManage();
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-500 font-medium">Kurs:</span>
          <select id="courseSel" class="border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            ${courses.map((c) => `<option value="${c.id}" ${c.id === courseId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        ${manage ? `<button id="addMod" class="${btnCls.primary}">+ Modul qo'shish</button>` : ''}
      </div>

      ${modules.length === 0 ? emptyState("Bu kursda hali modul yo'q." + (manage ? " «+ Modul qo'shish» tugmasini bosing." : ''))
        : `<div class="space-y-4">${modules.map((mod) => {
          const ls = byMod(mod.id);
          return `<div class="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div class="min-w-0">
                <div class="font-bold text-slate-800">${esc(mod.title)}</div>
                ${mod.description ? `<div class="text-xs text-slate-500 mt-0.5">${esc(mod.description)}</div>` : ''}
                <div class="text-[11px] text-slate-400 mt-1">${ls.length} ta dars</div>
              </div>
              ${manage ? `<div class="flex items-center gap-1 shrink-0">
                <button data-addl="${mod.id}" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">+ Dars</button>
                <button data-editm="${mod.id}" class="${btnCls.iconEdit}">✏️</button>
                <button data-delm="${mod.id}" class="${btnCls.iconDel}">🗑</button>
              </div>` : ''}
            </div>
            ${ls.length === 0 ? '<div class="px-5 py-4 text-sm text-slate-400">Dars yo\'q</div>'
              : `<div class="divide-y divide-slate-50">${ls.map((l) => `
                <div class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60">
                  <span class="text-lg shrink-0">${l.video_url ? '🎬' : '📄'}</span>
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-sm text-slate-800 truncate">${esc(l.title)}</div>
                    <div class="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
                      ${l.duration_min ? `<span>⏱ ${esc(fmtDur(l.duration_min))}</span>` : ''}
                      ${l.video_url ? '<span>🎬 Video</span>' : '<span class="text-amber-500">video yo\'q</span>'}
                      ${l.pdf_url ? '<span>📄 PDF</span>' : ''}
                    </div>
                  </div>
                  <button data-view="${l.id}" class="${btnCls.ghost} shrink-0">Ko'rish</button>
                  ${manage ? `<button data-editl="${l.id}" class="${btnCls.iconEdit} shrink-0">✏️</button>
                  <button data-dell="${l.id}" class="${btnCls.iconDel} shrink-0">🗑</button>` : ''}
                </div>`).join('')}</div>`}
          </div>`;
        }).join('')}</div>`}
      <p class="text-xs text-slate-400 mt-4">💡 O'quvchilar bu darslarni portalidagi «Darslik» bo'limida ko'radi — guruhi shu kursga tegishli bo'lsa yoki onlayn o'quvchiga shu kurs ochilgan bo'lsa.</p>`;

    // Kurs almashtirish
    $('#courseSel', container).onchange = (e) => { courseId = e.target.value; paint(); };

    if (manage) {
      const addMod = $('#addMod', container);
      if (addMod) addMod.onclick = async () => { if (await moduleModal(courseId)) paint(); };
      $$('[data-editm]', container).forEach((b) => b.onclick = async () => {
        const mod = modules.find((x) => x.id === b.dataset.editm);
        if (await moduleModal(courseId, mod)) paint();
      });
      $$('[data-delm]', container).forEach((b) => b.onclick = async () => {
        const mod = modules.find((x) => x.id === b.dataset.delm);
        const cnt = byMod(mod.id).length;
        if (!(await confirmDialog(`«${mod.title}» moduli${cnt ? ' va uning ' + cnt + ' ta darsi' : ''} o'chiriladi. Davom etasizmi?`))) return;
        await run(sb.from('course_modules').delete().eq('id', mod.id));
        toast("O'chirildi"); paint();
      });
      $$('[data-addl]', container).forEach((b) => b.onclick = async () => {
        const mod = modules.find((x) => x.id === b.dataset.addl);
        if (await lessonModal(mod)) paint();
      });
      $$('[data-editl]', container).forEach((b) => b.onclick = async () => {
        const l = lessons.find((x) => x.id === b.dataset.editl);
        const mod = modules.find((x) => x.id === l.module_id);
        if (await lessonModal(mod, l)) paint();
      });
      $$('[data-dell]', container).forEach((b) => b.onclick = async () => {
        const l = lessons.find((x) => x.id === b.dataset.dell);
        if (!(await confirmDialog(`«${l.title}» darsi o'chiriladi${l.video_path ? ' (video fayli ham)' : ''}. Davom etasizmi?`))) return;
        await run(sb.from('course_lessons').delete().eq('id', l.id));
        if (l.video_path) await deleteVideo(l.video_path);
        toast("O'chirildi"); paint();
      });
    }
    $$('[data-view]', container).forEach((b) => b.onclick = () => {
      const l = lessons.find((x) => x.id === b.dataset.view);
      viewLesson(l);
    });
  }

  await paint();
}

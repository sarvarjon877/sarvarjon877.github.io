// PDF ni ilova ichida ko'rsatish.
//
// Ilgari Google ko'ruvchisi (docs.google.com/gview) ishlatilgan edi — u har sahifani
// rasm qilib yuborardi: juda sekin ochilardi va sahifalar birin-ketin chiqardi.
// Endi pdf.js: sahifalar brauzerning o'zida chiziladi, matn aniq, ochilishi tez.
import { $, esc } from './ui.js';

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';

export function openPdfViewer(url, name) {
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[60] flex flex-col';
  wrap.style.background = '#0a0f22';
  wrap.innerHTML = `
    <div class="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0" style="background:rgba(10,15,34,.96)">
      <div class="min-w-0 flex-1">
        <div class="text-[11px] text-indigo-300/70">Material</div>
        <div class="text-sm font-bold text-slate-100 truncate">${esc(name || 'PDF')}</div>
      </div>
      <div data-prog class="text-[11px] text-slate-400 shrink-0"></div>
      <button data-x class="w-10 h-10 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 text-xl leading-none flex items-center justify-center">&times;</button>
    </div>
    <div data-body class="flex-1 overflow-y-auto p-3 space-y-3">
      <div class="text-center text-slate-400 text-sm py-10">Ochilmoqda...</div>
    </div>
    <div class="px-4 py-2 border-t border-white/10 shrink-0 text-center">
      <a href="${esc(url)}" target="_blank" rel="noopener" class="text-xs text-indigo-300 hover:underline">Ochilmasa — yangi oynada ochish ↗</a>
    </div>`;
  document.body.appendChild(wrap);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  $('[data-x]', wrap).onclick = close;

  (async () => {
    const body = $('[data-body]', wrap);
    const prog = $('[data-prog]', wrap);
    try {
      const pdfjs = await import(PDFJS_URL);
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_URL.replace('pdf.min.mjs', 'pdf.worker.min.mjs');
      const doc = await pdfjs.getDocument({ url }).promise;
      body.innerHTML = '';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const wPx = Math.min(body.clientWidth - 24, 1100);
        const scale = wPx / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'w-full rounded-lg bg-white shadow-lg';
        body.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        prog.textContent = `${n} / ${doc.numPages}`;
        if (!wrap.isConnected) return;   // foydalanuvchi yopib yubordi
      }
    } catch (err) {
      console.error(err);
      body.innerHTML = `<div class="text-center text-sm text-slate-400 py-10">
        PDF ochilmadi.<br><a href="${esc(url)}" target="_blank" rel="noopener" class="text-indigo-300 underline">Yangi oynada ochib ko'ring</a>
      </div>`;
    }
  })();

  return { close };
}

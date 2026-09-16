// Buxgalteriya o'yini — 10 savol, 60 soniya, to'g'ri +4 coin, xato −1 coin.
// Coinlar akkauntga yig'iladi, sovg'alarga almashtiriladi. Dark dizayn.
import { sb, run } from './db.js';
import { $, $$, esc, toast } from './ui.js';

const CORRECT_COIN = 5;
const WRONG_COIN = 0;
const N = 6;           // kuniga savollar (limitlangan)
const TIME = 45;       // soniya
const JOB_GOAL = 2500; // 🏆 ishga joylash chegarasi (coin)

let QUESTIONS = [];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let ctx = null; // { student, onCoins, container }

export async function renderGame(container, student, onCoins) {
  ctx = { student, onCoins, container };
  if (!QUESTIONS.length) {
    const mod = await import('./game-questions.js');
    QUESTIONS = mod.QUESTIONS;
  }
  drawHub();
}

async function drawHub() {
  const { container, student } = ctx;
  container.innerHTML = '<div class="text-slate-500 text-sm text-center py-8">Yuklanmoqda...</div>';

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [fresh, rewards, myReq, top, playsToday] = await Promise.all([
    run(sb.from('students').select('coins').eq('id', student.id).single()),
    run(sb.from('rewards').select('*').eq('active', true).order('sort')),
    run(sb.from('reward_requests').select('*').eq('student_id', student.id).order('created_at', { ascending: false }).limit(5)),
    run(sb.from('students').select('id,first_name,last_name,coins').order('coins', { ascending: false }).limit(5)),
    run(sb.from('game_plays').select('id').eq('student_id', student.id).gte('played_at', todayStart.toISOString())),
  ]);
  const playedToday = (playsToday || []).length > 0;
  const coins = Number(fresh?.coins || 0);
  ctx.coins = coins;
  ctx.onCoins?.(coins);

  container.innerHTML = `
    <div class="rounded-2xl p-5 mb-4 bg-gradient-to-br from-amber-500 to-amber-600 text-slate-900 shadow-lg">
      <div class="text-amber-900/70 text-xs font-bold uppercase tracking-wide">Coin balansingiz</div>
      <div class="text-4xl font-black mt-1 flex items-center gap-2">🪙 ${coins.toLocaleString('ru-RU').replace(/,/g, ' ')}</div>
    </div>

    <div class="rounded-2xl bg-slate-900 border border-amber-900/40 p-4 mb-4">
      <div class="flex items-center justify-between mb-2">
        <div class="text-slate-200 text-sm font-bold">🏆 Maqsad: Ishga joylash</div>
        <div class="text-xs font-bold text-amber-400">${Math.min(100, Math.round(coins / JOB_GOAL * 100))}%</div>
      </div>
      <div class="h-2.5 rounded-full bg-slate-800 overflow-hidden mb-2"><div class="h-full bg-gradient-to-r from-amber-400 to-amber-500" style="width:${Math.min(100, Math.round(coins / JOB_GOAL * 100))}%"></div></div>
      <div class="text-[11px] text-slate-400">${coins >= JOB_GOAL
        ? '🎉 Chegaraga yetdingiz! «Sovg\'alar»dan «Ishga joylash»ni oling.'
        : `Yana <b class="text-slate-200">${(JOB_GOAL - coins).toLocaleString('ru-RU').replace(/,/g, ' ')}</b> coin — har kuni o'ynab yig'ing.`}</div>
    </div>

    ${playedToday
      ? `<div class="w-full mb-5 py-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 font-bold text-center text-sm">⏰ Bugungi o'yin tugadi — ertaga yangi ${N} savol bilan qayting!</div>`
      : `<button id="playBtn" class="w-full mb-5 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-lg shadow-lg active:scale-[.98] transition flex items-center justify-center gap-2">
      🎮 Bugungi o'yin — ${N} savol
    </button>`}

    <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4 mb-4">
      <div class="text-slate-300 text-sm font-bold mb-2">📜 Qoidalar</div>
      <ul class="text-slate-400 text-xs space-y-1 leading-relaxed">
        <li>• Kuniga <b class="text-slate-200">${N} savol</b>, <b class="text-slate-200">${TIME} soniya</b> ichida (kuniga 1 marta)</li>
        <li>• Har to'g'ri javob <b class="text-emerald-400">+${CORRECT_COIN} coin</b></li>
        <li>• Xato javob <b class="text-slate-300">0 coin</b> — shoshilmang, aniq javob bering</li>
        <li>• Coin yig'ib: 🎓 amaliyot, 🏆 ishga joylashuvni oching!</li>
      </ul>
    </div>

    <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4 mb-4">
      <div class="text-slate-300 text-sm font-bold mb-3">🎁 Sovg'alar</div>
      <div class="space-y-2.5">
        ${rewards.map((r) => {
          const enough = coins >= r.cost;
          const pct = Math.min(100, Math.round((coins / r.cost) * 100));
          return `<div class="rounded-xl bg-slate-800/60 p-3">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-xl">${r.icon || '🎁'}</span>
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-slate-100 truncate">${esc(r.title)}</div>
                  <div class="text-[11px] text-slate-400 truncate">${esc(r.description || '')}</div>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-amber-400 font-bold text-sm">🪙 ${r.cost.toLocaleString('ru-RU').replace(/,/g, ' ')}</div>
              </div>
            </div>
            <div class="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-2"><div class="h-full bg-amber-400" style="width:${pct}%"></div></div>
            <button data-reward="${r.id}" ${enough ? '' : 'disabled'}
              class="w-full py-1.5 rounded-lg text-xs font-bold ${enough ? 'bg-amber-500 text-slate-900 active:scale-95' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} transition">
              ${enough ? 'Sovg\'ani olish' : `Yana ${(r.cost - coins).toLocaleString('ru-RU').replace(/,/g, ' ')} coin kerak`}
            </button>
          </div>`;
        }).join('')}
      </div>
      ${myReq.length ? `<div class="mt-3 pt-3 border-t border-slate-800">
        <div class="text-[11px] text-slate-500 font-semibold mb-1.5">So'rovlarim</div>
        ${myReq.map((q) => `<div class="flex items-center justify-between text-xs py-1">
          <span class="text-slate-300">${esc(q.reward_title || '')}</span>
          <span class="px-2 py-0.5 rounded ${q.status === 'berildi' ? 'bg-emerald-900/50 text-emerald-400' : q.status === 'rad' ? 'bg-rose-900/50 text-rose-400' : 'bg-amber-900/40 text-amber-400'}">${q.status}</span>
        </div>`).join('')}
      </div>` : ''}
    </div>

    <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <div class="text-slate-300 text-sm font-bold mb-3">🏆 Reyting (Top 5)</div>
      <div class="space-y-1.5">
        ${top.filter((t) => t.coins > 0).length ? top.filter((t) => t.coins > 0).map((t, i) => `
          <div class="flex items-center justify-between py-1.5 ${t.id === student.id ? 'bg-blue-950/40 -mx-2 px-2 rounded-lg' : ''}">
            <div class="flex items-center gap-2.5">
              <span class="w-6 text-center font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-500'}">${['🥇', '🥈', '🥉'][i] || (i + 1)}</span>
              <span class="text-sm ${t.id === student.id ? 'text-blue-300 font-bold' : 'text-slate-300'}">${esc(t.first_name)} ${esc((t.last_name || '').slice(0, 1))}${t.last_name ? '.' : ''}</span>
            </div>
            <span class="text-amber-400 font-bold text-sm">🪙 ${Number(t.coins).toLocaleString('ru-RU').replace(/,/g, ' ')}</span>
          </div>`).join('') : '<div class="text-slate-500 text-xs text-center py-3">Hozircha hech kim coin yig\'magan. Birinchi bo\'ling!</div>'}
      </div>
    </div>`;

  const pb = $('#playBtn', container);
  if (pb) pb.onclick = () => startGame();
  $$('[data-reward]', container).forEach((b) => b.onclick = () => redeem(b.dataset.reward, rewards));
}

async function redeem(rewardId, rewards) {
  const r = rewards.find((x) => x.id === rewardId);
  if (!r || ctx.coins < r.cost) return;
  const newCoins = ctx.coins - r.cost;
  await run(sb.from('students').update({ coins: newCoins }).eq('id', ctx.student.id));
  await run(sb.from('reward_requests').insert({
    student_id: ctx.student.id, reward_id: r.id, reward_title: r.title, cost: r.cost,
  }));
  toast(`"${r.title}" uchun so'rov yuborildi! 🎉`);
  drawHub();
}

function startGame() {
  const { container } = ctx;
  const picks = shuffle(QUESTIONS).slice(0, N).map((q) => {
    const opts = q.o.map((text, idx) => ({ text, correct: idx === q.a }));
    return { q: q.q, opts: shuffle(opts) };
  });

  let idx = 0, correct = 0, wrong = 0, timeLeft = TIME, locked = false;

  const paint = () => {
    const item = picks[idx];
    container.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <div class="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
          <div id="timeBar" class="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 ease-linear" style="width:${(timeLeft / TIME) * 100}%"></div>
        </div>
        <div id="timeNum" class="text-lg font-black ${timeLeft <= 10 ? 'text-rose-400' : 'text-slate-200'} w-10 text-right tabular-nums">${timeLeft}</div>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-400 mb-3">
        <span>Savol <b class="text-slate-200">${idx + 1}</b> / ${N}</span>
        <span>✅ ${correct} · ❌ ${wrong}</span>
      </div>
      <div class="rounded-2xl bg-slate-900 border border-slate-800 p-5 mb-4 min-h-[90px] flex items-center">
        <div class="text-slate-100 font-semibold text-[15px] leading-snug">${esc(item.q)}</div>
      </div>
      <div class="space-y-2.5" id="opts">
        ${item.opts.map((o, i) => `
          <button data-opt="${i}" class="w-full text-left px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium hover:border-slate-500 active:scale-[.99] transition">
            ${esc(o.text)}
          </button>`).join('')}
      </div>`;

    $$('#opts [data-opt]', container).forEach((b) => b.onclick = () => answer(Number(b.dataset.opt)));
  };

  const answer = (i) => {
    if (locked) return;
    locked = true;
    const item = picks[idx];
    const btns = $$('#opts [data-opt]', container);
    const chosen = item.opts[i];
    if (chosen.correct) correct++; else wrong++;
    btns.forEach((b, bi) => {
      b.disabled = true;
      if (item.opts[bi].correct) b.className = 'w-full text-left px-4 py-3.5 rounded-xl bg-emerald-600 border border-emerald-500 text-white text-sm font-semibold';
      else if (bi === i) b.className = 'w-full text-left px-4 py-3.5 rounded-xl bg-rose-600 border border-rose-500 text-white text-sm font-semibold';
      else b.className = 'w-full text-left px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-500 text-sm font-medium';
    });
    setTimeout(() => {
      locked = false;
      idx++;
      if (idx >= N) return finish();
      paint();
    }, 650);
  };

  const timer = setInterval(() => {
    timeLeft--;
    const bar = $('#timeBar', container), num = $('#timeNum', container);
    if (bar) bar.style.width = `${(timeLeft / TIME) * 100}%`;
    if (num) { num.textContent = timeLeft; if (timeLeft <= 10) num.className = 'text-lg font-black text-rose-400 w-10 text-right tabular-nums'; }
    if (timeLeft <= 0) finish();
  }, 1000);

  async function finish() {
    clearInterval(timer);
    const delta = correct * CORRECT_COIN + wrong * WRONG_COIN;
    const newCoins = Math.max(0, (ctx.coins || 0) + delta);
    try {
      await run(sb.from('students').update({ coins: newCoins }).eq('id', ctx.student.id));
      await run(sb.from('game_plays').insert({ student_id: ctx.student.id, correct, wrong, coins_delta: delta }));
    } catch { /* ignore */ }
    ctx.coins = newCoins;
    ctx.onCoins?.(newCoins);

    const answered = correct + wrong;
    container.innerHTML = `
      <div class="text-center py-6">
        <div class="text-6xl mb-3">${correct >= 7 ? '🎉' : correct >= 4 ? '👍' : '💪'}</div>
        <div class="text-2xl font-black text-slate-100 mb-1">O'yin tugadi!</div>
        <div class="text-slate-400 text-sm mb-6">${answered}/${N} savolga javob berdingiz</div>
        <div class="grid grid-cols-3 gap-2 mb-6">
          <div class="rounded-xl bg-slate-900 border border-slate-800 p-3"><div class="text-2xl font-black text-emerald-400">${correct}</div><div class="text-[10px] uppercase text-slate-500 font-semibold">To'g'ri</div></div>
          <div class="rounded-xl bg-slate-900 border border-slate-800 p-3"><div class="text-2xl font-black text-rose-400">${wrong}</div><div class="text-[10px] uppercase text-slate-500 font-semibold">Xato</div></div>
          <div class="rounded-xl bg-slate-900 border border-slate-800 p-3"><div class="text-2xl font-black ${delta >= 0 ? 'text-amber-400' : 'text-rose-400'}">${delta >= 0 ? '+' : ''}${delta}</div><div class="text-[10px] uppercase text-slate-500 font-semibold">Coin</div></div>
        </div>
        <div class="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-900 p-4 mb-6">
          <div class="text-amber-900/70 text-xs font-bold uppercase">Yangi balans</div>
          <div class="text-3xl font-black">🪙 ${newCoins.toLocaleString('ru-RU').replace(/,/g, ' ')}</div>
        </div>
        <div class="text-xs text-slate-500 mb-4">⏰ Bugungi o'yin tugadi. Ertaga yangi ${N} savol bilan qayting!</div>
        <button id="hubBtn" class="w-full py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold active:scale-95 transition">🏠 Menyuga qaytish</button>
      </div>`;
    $('#hubBtn', container).onclick = () => drawHub();
  }

  paint();
}

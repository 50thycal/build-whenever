/* Meditate-001 — MVP timer with WebAudio chime + PWA shell */

const el = (id) => document.getElementById(id);
const timeEl = el('time');
const ringEl = el('ring');
const startBtn = el('startBtn');
const pauseBtn = el('pauseBtn');
const resetBtn = el('resetBtn');
const testToneBtn = el('testToneBtn');
const soundHint = el('soundHint');

const customBtn = el('customBtn');
const infoBtn = el('infoBtn');
const helpDialog = el('helpDialog');

const customDialog = el('customDialog');
const customForm = el('customForm');
const minInput = el('minInput');
const secInput = el('secInput');

const completeSheet = el('completeSheet');
const replayBtn = el('replayBtn');
const chooseBtn = el('chooseBtn');

const iosA2H = el('iosA2H');
const dismissA2H = el('dismissA2H');

const chips = Array.from(document.querySelectorAll('.chip-row .chip'));

let audioUnlocked = false;
let ac = null;

let durationMs = 5 * 60_000;
let remainingMs = durationMs;
let targetTs = null;
let isRunning = false;
let paused = false;
let lastSelectedMs = durationMs;
let rafId = null;

/* Audio: create soft chime (WebAudio) */
function ensureAudio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
  }
}
async function unlockAudio() {
  ensureAudio();
  if (ac.state === 'suspended') {
    try { await ac.resume(); } catch {}
  }
  audioUnlocked = ac.state === 'running';
  soundHint.textContent = audioUnlocked ? '• end tone enabled' : '• tap "test tone" if sound is blocked';
}

function playChime() {
  if (!audioUnlocked) return;
  ensureAudio();

  const now = ac.currentTime;
  const duration = 1.25; // seconds
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  // gentle two-tone up-gliss
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.linearRampToValueAtTime(660, now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function setRingProgress(msLeft, total) {
  const frac = 1 - Math.min(1, Math.max(0, msLeft / total));
  const deg = Math.floor(frac * 360);
  document.documentElement.style.setProperty('--deg', `${deg}deg`);
}

function render(ms) {
  timeEl.textContent = fmt(ms);
  setRingProgress(ms, durationMs);
}

function startTimer(ms) {
  lastSelectedMs = ms ?? lastSelectedMs;
  durationMs = lastSelectedMs;
  targetTs = Date.now() + durationMs;
  isRunning = true;
  paused = false;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  resetBtn.disabled = false;
  loop();
}

function pauseTimer() {
  if (!isRunning || paused) return;
  paused = true;
  remainingMs = Math.max(0, targetTs - Date.now());
  cancelAnimationFrame(rafId);
  startBtn.textContent = 'Resume';
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

function resumeTimer() {
  if (!paused) return;
  paused = false;
  targetTs = Date.now() + remainingMs;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  loop();
}

function resetTimer() {
  isRunning = false;
  paused = false;
  cancelAnimationFrame(rafId);
  render(lastSelectedMs);
  startBtn.textContent = 'Start';
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resetBtn.disabled = true;
  document.documentElement.style.setProperty('--deg', '0deg');
}

function loop() {
  if (!isRunning || paused) return;
  const now = Date.now();
  const left = Math.max(0, targetTs - now);
  render(left);

  if (left <= 0) {
    isRunning = false;
    cancelAnimationFrame(rafId);
    startBtn.textContent = 'Start';
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resetBtn.disabled = false;
    playChime();
    openCompleteSheet();
    return;
  }
  rafId = requestAnimationFrame(loop);
}

/* Sheets / dialogs */
function openCompleteSheet() { completeSheet.hidden = false; }
function closeCompleteSheet() { completeSheet.hidden = true; }

/* Events */
chips.forEach(btn => {
  btn.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    if (btn.id === 'customBtn') {
      customDialog.showModal();
      return;
    }
    const mins = Number(btn.dataset.min || 5);
    lastSelectedMs = mins * 60_000;
    render(lastSelectedMs);
  });
});

// default active = 5m
document.querySelector('.chip[data-min="5"]').classList.add('active');

startBtn.addEventListener('click', async () => {
  await unlockAudio();
  if (paused) resumeTimer();
  else startTimer(lastSelectedMs);
});

pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

testToneBtn.addEventListener('click', async () => {
  await unlockAudio();
  playChime();
});

replayBtn.addEventListener('click', () => {
  closeCompleteSheet();
  startTimer(lastSelectedMs);
});
chooseBtn.addEventListener('click', () => {
  closeCompleteSheet();
  resetTimer();
});

infoBtn.addEventListener('click', () => helpDialog.showModal());

/* Custom time */
customDialog.addEventListener('close', () => {
  if (customDialog.returnValue !== 'ok') return;
  const m = Math.max(0, Math.min(999, Number(minInput.value || 0)));
  const s = Math.max(0, Math.min(59, Number(secInput.value || 0)));
  lastSelectedMs = (m * 60 + s) * 1000;
  render(lastSelectedMs);
});

customForm.addEventListener('submit', (e) => {
  // allow dialog to close with value="ok"
});

/* Maintain accuracy across visibility changes */
document.addEventListener('visibilitychange', () => {
  if (!isRunning || paused) return;
  // Re-render based on absolute target
  const left = Math.max(0, targetTs - Date.now());
  render(left);
});

/* Initial render */
render(lastSelectedMs);

/* PWA: register service worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* Show iOS Add to Home hint (simple heuristic) */
(function showA2H() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isIos && !isStandalone) {
    iosA2H.hidden = false;
  }
})();
dismissA2H.addEventListener('click', () => { iosA2H.hidden = true; });

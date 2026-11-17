'use strict';
/* Искра: Провода света — головоломка с поворотом плиток.
   Маска соединений: N=1, E=2, S=4, W=8. Поворот по часовой стрелке. */

const MAX_LEVEL = 150;
const SAVE_KEY = 'spark-wires-save-v1';
const DIRS = [
  { b: 1, dx: 0, dy: -1 },
  { b: 2, dx: 1, dy: 0 },
  { b: 4, dx: 0, dy: 1 },
  { b: 8, dx: -1, dy: 0 },
];
const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
const rotCW = (m) => ((m << 1) | (m >> 3)) & 15;
const rotN = (m, n) => { for (let i = 0; i < (n & 3); i++) m = rotCW(m); return m; };
const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
const period = (m) => (m === 15 ? 1 : (m === 5 || m === 10) ? 2 : 4);

/* ---------- Тексты ---------- */
const I18N = {
  ru: {
    title: 'Искра', subtitle: 'Провода света', play: 'Играть', levels: 'Уровни',
    level: 'Уровень', moves: 'Ходы', complete: 'Уровень пройден!', best: 'Минимум',
    next: 'Дальше', replay: 'Ещё раз', soundOn: '🔊 Звук: вкл', soundOff: '🔇 Звук: выкл',
    howto: 'Поворачивай плитки касанием и проведи свет ко всем лампочкам',
    allDone: 'Все уровни пройдены!',
  },
  en: {
    title: 'Spark', subtitle: 'Wires of Light', play: 'Play', levels: 'Levels',
    level: 'Level', moves: 'Moves', complete: 'Level complete!', best: 'Best',
    next: 'Next', replay: 'Replay', soundOn: '🔊 Sound: on', soundOff: '🔇 Sound: off',
    howto: 'Tap tiles to rotate them and bring light to every lamp',
    allDone: 'All levels complete!',
  },
};
let lang = 'ru';
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

/* ---------- Яндекс SDK (с запасным режимом для локального запуска) ---------- */
const YA = {
  sdk: null, player: null, gameplay: false,
  async init() {
    try {
      await loadScript('/sdk.js', 5000);
      this.sdk = await window.YaGames.init();
      try { this.player = await this.sdk.getPlayer({ scopes: false }); } catch (e) { this.player = null; }
      try {
        this.sdk.on('game_api_pause', () => { Sound.pause(); this.stop(); });
        this.sdk.on('game_api_resume', () => { Sound.resume(); if (screen === 'game' && !game.won) this.start(); });
      } catch (e) { /* старые версии SDK */ }
    } catch (e) {
      console.log('[Spark] Yandex SDK недоступен — локальный режим');
    }
  },
  lang() {
    try { return this.sdk.environment.i18n.lang; } catch (e) { return (navigator.language || 'ru').slice(0, 2); }
  },
  ready() { try { this.sdk && this.sdk.features.LoadingAPI && this.sdk.features.LoadingAPI.ready(); } catch (e) {} },
  start() {
    if (this.gameplay) return; this.gameplay = true;
    try { this.sdk && this.sdk.features.GameplayAPI && this.sdk.features.GameplayAPI.start(); } catch (e) {}
  },
  stop() {
    if (!this.gameplay) return; this.gameplay = false;
    try { this.sdk && this.sdk.features.GameplayAPI && this.sdk.features.GameplayAPI.stop(); } catch (e) {}
  },
  interstitial() {
    return new Promise((resolve) => {
      if (!this.sdk) return resolve();
      try {
        this.sdk.adv.showFullscreenAdv({ callbacks: {
          onOpen: () => Sound.pause(),
          onClose: () => { Sound.resume(); resolve(); },
          onError: () => { Sound.resume(); resolve(); },
          onOffline: () => resolve(),
        } });
      } catch (e) { resolve(); }
    });
  },
  rewarded() {
    return new Promise((resolve) => {
      if (!this.sdk) return resolve(true); // локально — подсказка бесплатно, для теста
      let got = false;
      try {
        this.sdk.adv.showRewardedVideo({ callbacks: {
          onOpen: () => Sound.pause(),
          onRewarded: () => { got = true; },
          onClose: () => { Sound.resume(); resolve(got); },
          onError: () => { Sound.resume(); resolve(false); },
        } });
      } catch (e) { resolve(false); }
    });
  },
  async loadData() {
    if (!this.player) return null;
    try { return await this.player.getData(); } catch (e) { return null; }
  },
  saveData(data) {
    if (!this.player) return;
    try { this.player.setData(data, false); } catch (e) {}
  },
};

function loadScript(src, timeout) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    s.src = src;
    s.onload = () => { clearTimeout(timer); window.YaGames ? resolve() : reject(new Error('no YaGames')); };
    s.onerror = () => { clearTimeout(timer); reject(new Error('load error')); };
    document.head.appendChild(s);
  });
}

/* ---------- Звук (генерируется, без файлов) ---------- */
const Sound = {
  ctx: null, on: true, paused: false,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
  },
  tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
    if (!this.on || this.paused) return;
    this.ensure(); if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    const t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  click() { this.tone(520 + Math.random() * 60, 0.07, 'triangle', 0.08); },
  power() { this.tone(880, 0.12, 'sine', 0.06); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.1, i * 0.1)); },
  pause() { this.paused = true; if (this.ctx) this.ctx.suspend(); },
  resume() { this.paused = false; if (this.ctx && !document.hidden) this.ctx.resume(); },
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Sound.pause(); YA.stop(); }
  else { Sound.resume(); if (screen === 'game' && !game.won) YA.start(); }
});

/* ---------- Сохранение ---------- */
let save = { unlocked: 1, stars: {}, sound: true };
function loadLocal() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d) return d; } catch (e) {}
  return null;
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  YA.saveData(save);
}
function mergeSave(a, b) {
  const r = { unlocked: 1, stars: {}, sound: true };
  for (const d of [a, b]) {
    if (!d) continue;
    r.unlocked = Math.max(r.unlocked, d.unlocked || 1);
    for (const k in d.stars || {}) r.stars[k] = Math.max(r.stars[k] || 0, d.stars[k]);
    if (typeof d.sound === 'boolean') r.sound = d.sound;
  }
  r.unlocked = Math.min(r.unlocked, MAX_LEVEL);
  return r;
}
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);

/* ---------- Генерация уровней ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function levelSize(l) {
  const table = [[2, 3], [6, 4], [12, 5], [22, 6], [40, 7], [75, 8]];
  for (const [upTo, n] of table) if (l <= upTo) return n;
  return 9;
}
function generateLevel(level) {
  const n = levelSize(level), w = n, h = n;
  const rnd = mulberry32(level * 9973 + 1234567);
  const sol = new Array(w * h).fill(0);
  const visited = new Array(w * h).fill(false);
  const src = Math.floor(h / 2) * w + Math.floor(w / 2);
  // Смесь DFS и Прима: длинные провода + ветвления
  const frontier = [];
  const addEdges = (i) => {
    const x = i % w, y = (i / w) | 0;
    for (const d of DIRS) {
      const nx = x + d.dx, ny = y + d.dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && !visited[ny * w + nx]) frontier.push([i, ny * w + nx, d.b]);
    }
  };
  visited[src] = true; addEdges(src);
  const dfsBias = 0.35 + Math.min(level, 60) / 200;
  while (frontier.length) {
    const k = rnd() < dfsBias ? frontier.length - 1 : Math.floor(rnd() * frontier.length);
    const [a, b, bit] = frontier.splice(k, 1)[0];
    if (visited[b]) continue;
    visited[b] = true;
    sol[a] |= bit; sol[b] |= OPP[bit];
    addEdges(b);
  }
  // Перемешивание поворотов
  let tiles, minMoves;
  for (let attempt = 0; attempt < 50; attempt++) {
    minMoves = 0;
    tiles = sol.map((m) => {
      const r = Math.floor(rnd() * 4);
      const base = rotN(m, r);
      const p = period(m);
      minMoves += (p - (r % p)) % p;
      return { sol: m, base, rot: 0, anim: 0, locked: false };
    });
    if (minMoves >= Math.min(3, w * h / 3) && !isSolvedTiles(tiles, w, h, src)) break;
  }
  return { w, h, src, tiles, minMoves };
}
function maskOf(tile) { return rotN(tile.base, tile.rot); }
function poweredSet(tiles, w, h, src) {
  const on = new Array(w * h).fill(false);
  const stack = [src]; on[src] = true;
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0, m = maskOf(tiles[i]);
    for (const d of DIRS) {
      if (!(m & d.b)) continue;
      const nx = x + d.dx, ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (on[j] || !(maskOf(tiles[j]) & OPP[d.b])) continue;
      on[j] = true; stack.push(j);
    }
  }
  return on;
}
function isSolvedTiles(tiles, w, h, src) { return poweredSet(tiles, w, h, src).every(Boolean); }

/* ---------- Состояние игры ---------- */
let screen = 'menu';
const game = { level: 1, data: null, moves: 0, powered: [], won: false, litCount: 0, winGlow: 0 };
let levelsSinceAd = 0;

const $ = (id) => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');

function showScreen(name) {
  screen = name;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  if (name === 'game') { resize(); if (!game.won) YA.start(); } else YA.stop();
  if (name === 'menu') updateMenu();
  if (name === 'levels') buildLevelGrid();
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.title = t('title') + ': ' + t('subtitle');
  updateSoundBtn();
}
function updateSoundBtn() { $('btn-sound').textContent = save.sound ? t('soundOn') : t('soundOff'); }
function updateMenu() {
  $('menu-stars').textContent = totalStars();
  $('btn-play-level').textContent = t('level') + ' ' + save.unlocked;
}
function buildLevelGrid() {
  $('levels-stars').textContent = totalStars();
  const grid = $('level-grid'); grid.innerHTML = '';
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const b = document.createElement('button');
    b.className = 'lvl' + (l > save.unlocked ? ' locked' : '') + (l === save.unlocked ? ' current' : '');
    const s = save.stars[l] || 0;
    b.innerHTML = l > save.unlocked ? '🔒' :
      `${l}<span class="s">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span>`;
    if (l <= save.unlocked) b.onclick = () => startLevel(l);
    grid.appendChild(b);
  }
  const cur = grid.children[save.unlocked - 1];
  if (cur) cur.scrollIntoView({ block: 'center' });
}

function startLevel(l) {
  game.level = l;
  game.data = generateLevel(l);
  game.moves = 0; game.won = false; game.winGlow = 0;
  game.powered = poweredSet(game.data.tiles, game.data.w, game.data.h, game.data.src);
  game.litCount = game.powered.filter(Boolean).length;
  $('level-title').textContent = t('level') + ' ' + l;
  $('moves').textContent = '0';
  $('win-overlay').classList.remove('active');
  showScreen('game');
}

function afterChange(byPlayer) {
  const d = game.data;
  game.powered = poweredSet(d.tiles, d.w, d.h, d.src);
  const lit = game.powered.filter(Boolean).length;
  if (byPlayer && lit > game.litCount) Sound.power();
  game.litCount = lit;
  if (lit === d.w * d.h) onWin();
}

function rotateTile(i) {
  if (game.won) return;
  const tile = game.data.tiles[i];
  if (tile.locked) return;
  tile.rot++;
  game.moves++;
  $('moves').textContent = game.moves;
  Sound.click();
  afterChange(true);
}

function starsFor(moves, min) {
  if (moves <= min) return 3;
  if (moves <= Math.ceil(min * 1.5) + 1) return 2;
  return 1;
}

function onWin() {
  game.won = true;
  YA.stop();
  const s = starsFor(game.moves, game.data.minMoves);
  save.stars[game.level] = Math.max(save.stars[game.level] || 0, s);
  if (game.level === save.unlocked && save.unlocked < MAX_LEVEL) save.unlocked++;
  persist();
  levelsSinceAd++;
  setTimeout(() => {
    Sound.win();
    const starEls = document.querySelectorAll('.win-stars span');
    starEls.forEach((el, i) => el.classList.toggle('on', i < s));
    $('win-moves').textContent = game.moves;
    $('win-min').textContent = game.data.minMoves;
    $('btn-next').textContent = game.level >= MAX_LEVEL ? t('allDone') : t('next');
    $('win-overlay').classList.add('active');
  }, 650);
}

async function useHint() {
  if (game.won) return;
  const d = game.data;
  const wrong = [];
  d.tiles.forEach((tile, i) => { if (!tile.locked && maskOf(tile) !== tile.sol) wrong.push(i); });
  if (!wrong.length) return;
  YA.stop();
  const ok = await YA.rewarded();
  if (screen === 'game') YA.start();
  if (!ok) return;
  // Сначала подсказываем плитки рядом со светом — так полезнее
  const near = wrong.filter((i) => game.powered[i] || neighbors(i).some((j) => game.powered[j]));
  const pool = near.length ? near : wrong;
  const i = pool[Math.floor(Math.random() * pool.length)];
  const tile = d.tiles[i];
  while (maskOf(tile) !== tile.sol) tile.rot++;
  tile.locked = true;
  Sound.power();
  afterChange(false);
}
function neighbors(i) {
  const { w, h } = game.data, x = i % w, y = (i / w) | 0, r = [];
  for (const d of DIRS) {
    const nx = x + d.dx, ny = y + d.dy;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h) r.push(ny * w + nx);
  }
  return r;
}

/* ---------- Отрисовка ---------- */
let boardSize = 300, dpr = 1;
function resize() {
  const wrap = $('board-wrap');
  const avail = Math.min(wrap.clientWidth - 24, wrap.clientHeight - 28);
  boardSize = Math.max(200, Math.floor(avail));
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.style.width = canvas.style.height = boardSize + 'px';
  canvas.width = canvas.height = Math.floor(boardSize * dpr);
}
window.addEventListener('resize', () => { if (screen === 'game') resize(); });

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawTile(i, cell, time) {
  const d = game.data, tile = d.tiles[i];
  const x = (i % d.w) * cell, y = ((i / d.w) | 0) * cell;
  const on = game.powered[i];
  const pad = cell * 0.04;
  roundRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.16);
  ctx.fillStyle = on ? '#232f5e' : '#19214a';
  ctx.fill();
  if (tile.locked) { ctx.lineWidth = Math.max(2, cell * 0.04); ctx.strokeStyle = '#4fd1c5'; ctx.stroke(); }

  const cx = x + cell / 2, cy = y + cell / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tile.anim * Math.PI / 2);
  const lw = cell * 0.2;
  const glow = on ? (0.75 + 0.25 * Math.sin(time / 300 + i)) : 0;
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = on ? '#ffd34d' : '#4a5480';
  if (on) { ctx.shadowColor = 'rgba(255, 200, 40,' + (0.8 * glow + game.winGlow * 0.2) + ')'; ctx.shadowBlur = cell * 0.25; }
  const L = cell / 2 + 1;
  const ends = [[0, -L], [L, 0], [0, L], [-L, 0]];
  ctx.beginPath();
  DIRS.forEach((dir, k) => { if (tile.base & dir.b) { ctx.moveTo(0, 0); ctx.lineTo(ends[k][0], ends[k][1]); } });
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, lw / 2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;

  if (i === d.src) {
    // Источник света
    const r = cell * 0.3;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffd34d'); g.addColorStop(1, '#ff8a1c');
    ctx.shadowColor = 'rgba(255,170,30,.9)'; ctx.shadowBlur = cell * 0.35;
    ctx.beginPath(); ctx.arc(cx, cy, r * (1 + 0.05 * Math.sin(time / 250)), 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
  } else if (bits(tile.base) === 1) {
    // Лампочка
    const r = cell * 0.22;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (on) {
      ctx.shadowColor = 'rgba(255,240,170,1)'; ctx.shadowBlur = cell * 0.4;
      ctx.fillStyle = '#fff6c2'; ctx.fill(); ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#10163a'; ctx.fill();
      ctx.lineWidth = Math.max(2, cell * 0.05); ctx.strokeStyle = '#6a75a8'; ctx.stroke();
    }
  }
}

let lastT = 0;
function frame(time) {
  const dt = Math.min(0.05, (time - lastT) / 1000 || 0); lastT = time;
  if (screen === 'game' && game.data) {
    const d = game.data;
    for (const tile of d.tiles) {
      const diff = tile.rot - tile.anim;
      tile.anim = Math.abs(diff) < 0.01 ? tile.rot : tile.anim + diff * Math.min(1, dt * 20);
    }
    if (game.won) game.winGlow = Math.min(1, game.winGlow + dt * 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, boardSize, boardSize);
    const cell = boardSize / d.w;
    for (let i = 0; i < d.tiles.length; i++) drawTile(i, cell, time);
  }
  requestAnimationFrame(frame);
}

/* ---------- Ввод ---------- */
canvas.addEventListener('pointerdown', (e) => {
  if (!game.data) return;
  e.preventDefault();
  Sound.ensure();
  const rect = canvas.getBoundingClientRect();
  const cell = rect.width / game.data.w;
  const x = Math.floor((e.clientX - rect.left) / cell), y = Math.floor((e.clientY - rect.top) / cell);
  if (x < 0 || y < 0 || x >= game.data.w || y >= game.data.h) return;
  rotateTile(y * game.data.w + x);
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerdown', () => Sound.ensure(), { once: true });

$('btn-play').onclick = () => startLevel(save.unlocked);
$('btn-levels').onclick = () => showScreen('levels');
$('btn-levels-back').onclick = () => showScreen('menu');
$('btn-game-back').onclick = () => showScreen('menu');
$('btn-restart').onclick = () => startLevel(game.level);
$('btn-hint').onclick = () => useHint();
$('btn-replay').onclick = () => startLevel(game.level);
$('btn-sound').onclick = () => { save.sound = Sound.on = !save.sound; updateSoundBtn(); persist(); };
$('btn-next').onclick = async () => {
  $('win-overlay').classList.remove('active');
  const next = Math.min(game.level + 1, MAX_LEVEL);
  if (game.level >= MAX_LEVEL) { showScreen('levels'); return; }
  // Реклама между уровнями: не на первых уровнях и не каждый раз
  if (game.level >= 3 && levelsSinceAd >= 2) { levelsSinceAd = 0; await YA.interstitial(); }
  startLevel(next);
};

/* ---------- Запуск ---------- */
(async function boot() {
  await YA.init();
  const l = YA.lang();
  lang = ['ru', 'be', 'kk', 'uk', 'uz'].includes(l) ? 'ru' : 'en';
  save = mergeSave(loadLocal(), await YA.loadData());
  Sound.on = save.sound;
  applyI18n();
  updateMenu();
  requestAnimationFrame(frame);
  YA.ready();
})();

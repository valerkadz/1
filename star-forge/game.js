'use strict';
/* Звёздная кузница — idle-игра со слиянием космических объектов. */

const COLS = 5, ROWS = 6, CELLS = COLS * ROWS;
const SAVE_KEY = 'star-forge-save-v1';
const METEOR_SEC = 12;          // бесплатный объект раз в N секунд
const BOOST_SEC = 150;          // длительность x2 за рекламу
const OFFLINE_MAX_SEC = 3 * 3600;
const AD_INTERVAL_MS = 180000;  // межстраничная реклама не чаще раза в 3 минуты

/* ---------- Объекты ---------- */
const TIERS = [
  { ru: 'Звёздная пыль', en: 'Stardust', type: 'dust', c1: '#c9ceff', c2: '#7d84c9' },
  { ru: 'Камешек', en: 'Pebble', type: 'rock', c1: '#b8aa95', c2: '#5e5446' },
  { ru: 'Валун', en: 'Boulder', type: 'rock', c1: '#c7b08e', c2: '#6b5638' },
  { ru: 'Астероид', en: 'Asteroid', type: 'asteroid', c1: '#a3998c', c2: '#3f382f' },
  { ru: 'Комета', en: 'Comet', type: 'comet', c1: '#e6f7ff', c2: '#4fa3d9' },
  { ru: 'Луна', en: 'Moon', type: 'moon', c1: '#f1efe8', c2: '#8f8b80' },
  { ru: 'Ледяная планета', en: 'Ice Planet', type: 'ice', c1: '#f2fbff', c2: '#5fb2dc' },
  { ru: 'Пустынная планета', en: 'Desert Planet', type: 'bands', c1: '#f6cf8d', c2: '#b06a2c' },
  { ru: 'Лавовая планета', en: 'Lava Planet', type: 'lava', c1: '#6a2412', c2: '#200805' },
  { ru: 'Планета-океан', en: 'Ocean Planet', type: 'ocean', c1: '#6fd3ff', c2: '#0b3d91' },
  { ru: 'Живая планета', en: 'Living Planet', type: 'living', c1: '#5ab8ff', c2: '#0d4fa8' },
  { ru: 'Газовый гигант', en: 'Gas Giant', type: 'gas', c1: '#f0cfa0', c2: '#9c5a28' },
  { ru: 'Гигант с кольцами', en: 'Ringed Giant', type: 'ring', c1: '#f7e7bd', c2: '#b88a4a' },
  { ru: 'Красный карлик', en: 'Red Dwarf', type: 'star', c1: '#ffb199', c2: '#d32f2f' },
  { ru: 'Жёлтая звезда', en: 'Yellow Star', type: 'star', c1: '#fffbd0', c2: '#ffb300' },
  { ru: 'Голубой гигант', en: 'Blue Giant', type: 'star', c1: '#f0f8ff', c2: '#2f8cff' },
  { ru: 'Нейтронная звезда', en: 'Neutron Star', type: 'neutron', c1: '#ffffff', c2: '#b388ff' },
  { ru: 'Чёрная дыра', en: 'Black Hole', type: 'hole', c1: '#ffb74d', c2: '#7c4dff' },
  { ru: 'Галактика', en: 'Galaxy', type: 'galaxy', c1: '#fff1c4', c2: '#9f7aff' },
];
const MAX_TIER = TIERS.length;
const incomeOf = (t) => Math.pow(2.6, t - 1);

/* ---------- Тексты ---------- */
const I18N = {
  ru: {
    title: 'Звёздная кузница', perSec: '/сек', discovered: 'Открыто', buy: 'Создать', upgrade: 'Улучшить',
    boost: 'x2 доход', gift: '🎁 Подарок', noSpace: 'Нет места — объединяй одинаковые!', noMoney: 'Не хватает монет',
    newFind: 'Новое открытие!', bonus: 'Бонус', great: 'Отлично', welcome: 'С возвращением!',
    offline: 'Пока тебя не было, кузница заработала', take: 'Забрать', takeX3: 'Забрать x3', ad: 'реклама',
    boostOn: 'Доход x2 включён!', giftGot: 'Подарок: +3 объекта!', maxUp: 'макс.', creates: 'создаёт',
    needFind: 'Открой', hint: 'Перетащи два одинаковых объекта друг на друга', win: 'Ты создал Галактику! Продолжай собирать вселенную.',
  },
  en: {
    title: 'Star Forge', perSec: '/sec', discovered: 'Discovered', buy: 'Create', upgrade: 'Upgrade',
    boost: 'x2 income', gift: '🎁 Gift', noSpace: 'No space — merge matching objects!', noMoney: 'Not enough coins',
    newFind: 'New discovery!', bonus: 'Bonus', great: 'Great', welcome: 'Welcome back!',
    offline: 'While you were away, the forge earned', take: 'Collect', takeX3: 'Collect x3', ad: 'ad',
    boostOn: 'x2 income activated!', giftGot: 'Gift: +3 objects!', maxUp: 'max', creates: 'creates',
    needFind: 'Discover', hint: 'Drag two matching objects onto each other', win: 'You created a Galaxy! Keep building the universe.',
  },
};
let lang = 'ru';
const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
const tierName = (tier) => TIERS[tier - 1][lang === 'ru' ? 'ru' : 'en'];

/* ---------- Яндекс SDK (с запасным режимом) ---------- */
const YA = {
  sdk: null, player: null, gameplay: false,
  async init() {
    try {
      await loadScript('/sdk.js', 5000);
      this.sdk = await window.YaGames.init();
      try { this.player = await this.sdk.getPlayer({ scopes: false }); } catch (e) { this.player = null; }
      try {
        this.sdk.on('game_api_pause', () => { Sound.pause(); this.stop(); });
        this.sdk.on('game_api_resume', () => { Sound.resume(); this.start(); });
      } catch (e) {}
    } catch (e) { console.log('[StarForge] Yandex SDK недоступен — локальный режим'); }
  },
  lang() { try { return this.sdk.environment.i18n.lang; } catch (e) { return (navigator.language || 'ru').slice(0, 2); } },
  ready() { try { this.sdk && this.sdk.features.LoadingAPI && this.sdk.features.LoadingAPI.ready(); } catch (e) {} },
  start() {
    if (this.gameplay || document.hidden) return; this.gameplay = true;
    try { this.sdk && this.sdk.features.GameplayAPI && this.sdk.features.GameplayAPI.start(); } catch (e) {}
  },
  stop() {
    if (!this.gameplay) return; this.gameplay = false;
    try { this.sdk && this.sdk.features.GameplayAPI && this.sdk.features.GameplayAPI.stop(); } catch (e) {}
  },
  interstitial() {
    return new Promise((resolve) => {
      if (!this.sdk) return resolve();
      this.stop();
      const done = () => { Sound.resume(); this.start(); resolve(); };
      try {
        this.sdk.adv.showFullscreenAdv({ callbacks: { onOpen: () => Sound.pause(), onClose: done, onError: done, onOffline: done } });
      } catch (e) { done(); }
    });
  },
  rewarded() {
    return new Promise((resolve) => {
      if (!this.sdk) return resolve(true); // локально — награда сразу, для теста
      this.stop();
      let got = false;
      const done = (r) => { Sound.resume(); this.start(); resolve(r); };
      try {
        this.sdk.adv.showRewardedVideo({ callbacks: {
          onOpen: () => Sound.pause(), onRewarded: () => { got = true; },
          onClose: () => done(got), onError: () => done(false),
        } });
      } catch (e) { done(false); }
    });
  },
  async loadData() { if (!this.player) return null; try { return await this.player.getData(); } catch (e) { return null; } },
  saveData(d) { if (!this.player) return; try { this.player.setData(d, false); } catch (e) {} },
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

/* ---------- Звук ---------- */
const Sound = {
  ctx: null, on: true, paused: false,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
  },
  tone(f, dur, type = 'sine', vol = 0.1, delay = 0, slide = 0) {
    if (!this.on || this.paused) return;
    this.ensure(); if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  pick() { this.tone(420, 0.06, 'triangle', 0.06); },
  drop() { this.tone(300, 0.08, 'triangle', 0.06); },
  merge(tier) { const f = 300 * Math.pow(1.06, tier); this.tone(f, 0.18, 'sine', 0.12, 0, 1.5); this.tone(f * 1.5, 0.2, 'sine', 0.06, 0.05, 1.5); },
  spawn() { this.tone(660, 0.1, 'sine', 0.06, 0, 1.3); },
  coin() { this.tone(1200, 0.08, 'square', 0.03); },
  fanfare() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.09, i * 0.09)); },
  error() { this.tone(180, 0.15, 'sawtooth', 0.04); },
  pause() { this.paused = true; if (this.ctx) this.ctx.suspend(); },
  resume() { this.paused = false; if (this.ctx && !document.hidden) this.ctx.resume(); },
};

/* ---------- Состояние ---------- */
const fresh = () => ({
  coins: 0, grid: new Array(CELLS).fill(0), spawnLvl: 1, buys: 0, maxTier: 1,
  meteor: 0, boostUntil: 0, sound: true, t: Date.now(), lifetime: 0,
});
let S = fresh();
let lastAdAt = Date.now();

function loadLocal() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function validSave(d) { return d && Array.isArray(d.grid) && d.grid.length === CELLS; }
function pickSave(a, b) {
  const ok = [a, b].filter(validSave);
  if (!ok.length) return null;
  ok.sort((x, y) => (y.lifetime || 0) - (x.lifetime || 0));
  return ok[0];
}
let lastCloud = 0;
function persist(forceCloud) {
  S.t = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  if (forceCloud || Date.now() - lastCloud > 30000) { lastCloud = Date.now(); YA.saveData(S); }
}

const buyPrice = () => Math.round(5 * incomeOf(S.spawnLvl) * Math.pow(1.07, S.buys));
const upgradeCost = () => Math.round(400 * incomeOf(S.spawnLvl + 1));
const canUpgrade = () => S.spawnLvl < MAX_TIER - 4 && S.spawnLvl + 3 <= S.maxTier;
const boosting = () => Date.now() < S.boostUntil;
function incomePerSec() {
  let s = 0; for (const v of S.grid) if (v) s += incomeOf(v);
  return s * (boosting() ? 2 : 1);
}

function fmt(n) {
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
  const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
  let i = -1; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? Math.floor(n) : n.toFixed(n >= 10 ? 1 : 2)) + u[i];
}

/* ---------- Рисование объектов ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function ball(c, r, c1, c2, ox = -0.35) {
  const g = c.createRadialGradient(r * ox, r * ox, r * 0.05, 0, 0, r);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
}
function shade(c, r) {
  const g = c.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.2, 0, 0, r * 1.05);
  g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
}
function clipBall(c, r, fn) { c.save(); c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip(); fn(); c.restore(); }
function rockPath(c, r, rnd, n = 10) {
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = r * (0.78 + 0.22 * rnd());
    i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
}
function craters(c, r, rnd, k, col = 'rgba(0,0,0,0.2)') {
  for (let i = 0; i < k; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.65, cr = r * (0.08 + rnd() * 0.14);
    c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, cr, 0, Math.PI * 2); c.fillStyle = col; c.fill();
    c.beginPath(); c.arc(Math.cos(a) * d - cr * 0.2, Math.sin(a) * d - cr * 0.2, cr * 0.7, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fill();
  }
}
function blobs(c, r, rnd, k, col, size = 0.25) {
  c.fillStyle = col;
  for (let i = 0; i < k; i++) {
    const cx = (rnd() - 0.5) * r * 1.6, cy = (rnd() - 0.5) * r * 1.6;
    c.beginPath();
    for (let j = 0; j < 3; j++) c.arc(cx + (rnd() - 0.5) * r * 0.3, cy + (rnd() - 0.5) * r * 0.3, r * size * (0.5 + rnd() * 0.6), 0, Math.PI * 2);
    c.fill();
  }
}
function bands(c, r, rnd, colors) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const y = -r + (i / n) * 2 * r, h = (2 * r / n) * (0.6 + rnd() * 0.6);
    c.fillStyle = colors[i % colors.length];
    c.beginPath(); c.moveTo(-r, y);
    c.quadraticCurveTo(0, y + (rnd() - 0.5) * r * 0.2, r, y);
    c.lineTo(r, y + h); c.quadraticCurveTo(0, y + h + (rnd() - 0.5) * r * 0.2, -r, y + h); c.closePath(); c.fill();
  }
}

function drawObject(c, tier, R) {
  const T = TIERS[tier - 1], rnd = mulberry32(tier * 7919 + 17);
  const r = R * Math.min(1, 0.66 + tier * 0.045);
  c.save();
  switch (T.type) {
    case 'dust':
      { const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(160,170,255,0.45)'); g.addColorStop(1, 'rgba(160,170,255,0)');
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill(); }
      c.shadowColor = '#9fa8ff'; c.shadowBlur = R * 0.3;
      for (let i = 0; i < 11; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * r * 0.7;
        c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.1 + rnd() * 0.13), 0, Math.PI * 2);
        c.fillStyle = i % 2 ? T.c1 : '#ffffff'; c.fill();
      }
      break;
    case 'rock': case 'asteroid': {
      rockPath(c, r, rnd, T.type === 'rock' ? 9 : 12);
      const g = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, T.c1); g.addColorStop(1, T.c2); c.fillStyle = g; c.fill();
      c.save(); c.clip();
      if (T.type === 'asteroid') craters(c, r, rnd, 5, 'rgba(0,0,0,0.3)');
      else craters(c, r, rnd, 2, 'rgba(0,0,0,0.12)');
      c.restore();
      break;
    }
    case 'comet': {
      c.rotate(-Math.PI / 4);
      const g = c.createLinearGradient(0, 0, 0, R * 1.2);
      g.addColorStop(0, 'rgba(160,220,255,0.85)'); g.addColorStop(1, 'rgba(160,220,255,0)');
      c.beginPath(); c.moveTo(-r * 0.5, 0); c.lineTo(0, R * 1.15); c.lineTo(r * 0.5, 0); c.closePath(); c.fillStyle = g; c.fill();
      c.translate(0, -r * 0.25);
      c.shadowColor = '#bfe9ff'; c.shadowBlur = R * 0.4;
      ball(c, r * 0.5, T.c1, T.c2);
      break;
    }
    case 'moon':
      ball(c, r, T.c1, T.c2); clipBall(c, r, () => craters(c, r, rnd, 7)); shade(c, r);
      break;
    case 'ice':
      ball(c, r, T.c1, T.c2);
      clipBall(c, r, () => {
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.beginPath(); c.ellipse(0, -r, r * 0.8, r * 0.35, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(0, r, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = r * 0.04;
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo((rnd() - 0.5) * r * 2, -r); c.lineTo((rnd() - 0.5) * r * 2, r); c.stroke(); }
      });
      shade(c, r);
      break;
    case 'bands':
      ball(c, r, T.c1, T.c2);
      clipBall(c, r, () => { bands(c, r, rnd, ['rgba(255,230,180,0.35)', 'rgba(150,80,30,0.25)']); craters(c, r, rnd, 2, 'rgba(120,60,20,0.25)'); });
      shade(c, r);
      break;
    case 'lava':
      ball(c, r, T.c1, T.c2);
      clipBall(c, r, () => {
        c.shadowColor = '#ff6a00'; c.shadowBlur = r * 0.3;
        c.strokeStyle = '#ff8a1c'; c.lineWidth = r * 0.07; c.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          c.beginPath(); let x = (rnd() - 0.5) * r * 1.6, y = (rnd() - 0.5) * r * 1.6; c.moveTo(x, y);
          for (let j = 0; j < 3; j++) { x += (rnd() - 0.5) * r * 0.7; y += (rnd() - 0.5) * r * 0.7; c.lineTo(x, y); }
          c.stroke();
        }
        c.shadowBlur = 0; blobs(c, r, rnd, 3, 'rgba(255,170,40,0.8)', 0.1);
      });
      shade(c, r);
      break;
    case 'ocean':
      ball(c, r, T.c1, T.c2);
      clipBall(c, r, () => {
        blobs(c, r, rnd, 2, 'rgba(240,220,160,0.9)', 0.12);
        c.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse((rnd() - 0.5) * r * 1.4, (rnd() - 0.5) * r * 1.4, r * 0.35, r * 0.08, rnd(), 0, Math.PI * 2); c.fill(); }
      });
      shade(c, r);
      break;
    case 'living':
      c.shadowColor = 'rgba(120,200,255,0.8)'; c.shadowBlur = r * 0.3;
      ball(c, r, T.c1, T.c2); c.shadowBlur = 0;
      clipBall(c, r, () => {
        blobs(c, r, rnd, 4, '#43a047', 0.28); blobs(c, r, rnd, 2, '#8bc34a', 0.14);
        c.fillStyle = 'rgba(255,255,255,0.6)';
        for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse((rnd() - 0.5) * r * 1.6, (rnd() - 0.5) * r * 1.6, r * 0.3, r * 0.07, rnd(), 0, Math.PI * 2); c.fill(); }
      });
      shade(c, r);
      break;
    case 'gas':
      ball(c, r, T.c1, T.c2);
      clipBall(c, r, () => {
        bands(c, r, rnd, ['rgba(255,240,210,0.45)', 'rgba(160,80,30,0.35)', 'rgba(230,170,110,0.4)']);
        c.fillStyle = 'rgba(190,70,40,0.75)'; c.beginPath(); c.ellipse(r * 0.3, r * 0.25, r * 0.22, r * 0.12, 0, 0, Math.PI * 2); c.fill();
      });
      shade(c, r);
      break;
    case 'ring': {
      const pr = r * 0.72;
      c.rotate(-0.35);
      c.strokeStyle = 'rgba(240,220,170,0.85)'; c.lineWidth = r * 0.12;
      c.beginPath(); c.ellipse(0, 0, r * 1.05, r * 0.32, 0, Math.PI, Math.PI * 2); c.stroke();
      ball(c, pr, T.c1, T.c2);
      clipBall(c, pr, () => bands(c, pr, rnd, ['rgba(255,245,220,0.4)', 'rgba(150,100,50,0.3)']));
      shade(c, pr);
      c.strokeStyle = 'rgba(250,230,180,0.95)';
      c.beginPath(); c.ellipse(0, 0, r * 1.05, r * 0.32, 0, 0, Math.PI); c.stroke();
      c.strokeStyle = 'rgba(200,170,110,0.6)'; c.lineWidth = r * 0.04;
      c.beginPath(); c.ellipse(0, 0, r * 0.88, r * 0.25, 0, 0, Math.PI); c.stroke();
      break;
    }
    case 'star': {
      c.shadowColor = T.c2; c.shadowBlur = R * 0.7;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.25);
      g.addColorStop(0, T.c2 + 'aa'); g.addColorStop(1, T.c2 + '00');
      c.beginPath(); c.arc(0, 0, r * 1.25, 0, Math.PI * 2); c.fillStyle = g; c.fill();
      ball(c, r * 0.85, T.c1, T.c2, -0.2);
      c.shadowBlur = 0;
      clipBall(c, r * 0.85, () => blobs(c, r * 0.85, rnd, 5, 'rgba(255,255,255,0.18)', 0.12));
      break;
    }
    case 'neutron': {
      c.rotate(0.4);
      const g = c.createLinearGradient(0, -R * 1.1, 0, R * 1.1);
      g.addColorStop(0, 'rgba(179,136,255,0)'); g.addColorStop(0.5, 'rgba(220,200,255,0.9)'); g.addColorStop(1, 'rgba(179,136,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-r * 0.12, 0); c.lineTo(-r * 0.35, -R * 1.1); c.lineTo(r * 0.35, -R * 1.1); c.lineTo(r * 0.12, 0);
      c.lineTo(r * 0.35, R * 1.1); c.lineTo(-r * 0.35, R * 1.1); c.closePath(); c.fill();
      c.shadowColor = '#d1b3ff'; c.shadowBlur = R * 0.8;
      ball(c, r * 0.38, '#ffffff', '#c5a8ff', 0);
      break;
    }
    case 'hole': {
      c.rotate(-0.3);
      c.shadowColor = '#ff9800'; c.shadowBlur = R * 0.5;
      const g = c.createLinearGradient(-r, 0, r, 0);
      g.addColorStop(0, '#ffcc80'); g.addColorStop(0.5, '#ff6d00'); g.addColorStop(1, '#ffe0b2');
      c.strokeStyle = g; c.lineWidth = r * 0.2;
      c.beginPath(); c.ellipse(0, 0, r * 1.0, r * 0.36, 0, Math.PI, Math.PI * 2); c.stroke();
      c.shadowColor = '#b388ff'; c.shadowBlur = R * 0.4;
      c.beginPath(); c.arc(0, 0, r * 0.5, 0, Math.PI * 2); c.fillStyle = '#000'; c.fill();
      c.strokeStyle = 'rgba(255,200,120,0.9)'; c.lineWidth = r * 0.05; c.stroke();
      c.shadowColor = '#ff9800'; c.shadowBlur = R * 0.5;
      c.strokeStyle = g; c.lineWidth = r * 0.2;
      c.beginPath(); c.ellipse(0, 0, r * 1.0, r * 0.36, 0, 0, Math.PI); c.stroke();
      break;
    }
    case 'galaxy': {
      const core = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
      core.addColorStop(0, '#fffbe6'); core.addColorStop(0.4, 'rgba(255,220,150,0.8)'); core.addColorStop(1, 'rgba(255,200,120,0)');
      for (let arm = 0; arm < 2; arm++) {
        for (let i = 0; i < 70; i++) {
          const k = i / 70, a = arm * Math.PI + k * Math.PI * 2.4, d = k * r * 1.05;
          const x = Math.cos(a) * d + (rnd() - 0.5) * r * 0.18, y = (Math.sin(a) * d + (rnd() - 0.5) * r * 0.18) * 0.75;
          c.beginPath(); c.arc(x, y, r * (0.02 + rnd() * 0.04) * (1.4 - k), 0, Math.PI * 2);
          c.fillStyle = k < 0.5 ? 'rgba(255,240,200,0.9)' : (rnd() < 0.5 ? 'rgba(180,150,255,0.85)' : 'rgba(120,200,255,0.8)');
          c.fill();
        }
      }
      c.beginPath(); c.arc(0, 0, r * 0.5, 0, Math.PI * 2); c.fillStyle = core; c.fill();
      break;
    }
  }
  c.restore();
}

/* ---------- Экран ---------- */
const $ = (id) => document.getElementById(id);
const canvas = $('board'), ctx = canvas.getContext('2d');
let cell = 60, boardW = 300, boardH = 360, dpr = 1;
let sprites = [];

function resize() {
  const wrap = $('board-wrap');
  const aw = wrap.clientWidth - 12, ah = wrap.clientHeight - 8;
  cell = Math.max(36, Math.floor(Math.min(aw / COLS, ah / ROWS)));
  boardW = cell * COLS; boardH = cell * ROWS;
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.style.width = boardW + 'px'; canvas.style.height = boardH + 'px';
  canvas.width = Math.floor(boardW * dpr); canvas.height = Math.floor(boardH * dpr);
  buildSprites();
}
function buildSprites() {
  sprites = [null];
  const size = Math.ceil(cell * 1.6 * dpr);
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.translate(size / 2, size / 2); g.scale(dpr, dpr);
    drawObject(g, tier, cell * 0.36);
    sprites.push(c);
  }
}
window.addEventListener('resize', resize);

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

const fx = { particles: [], floats: [], pops: new Array(CELLS).fill(0) };
let drag = null; // { from, x, y, tier }

function cellCenter(i) { return [(i % COLS + 0.5) * cell, (Math.floor(i / COLS) + 0.5) * cell]; }
function drawSprite(tier, x, y, scale = 1) {
  const s = sprites[tier]; if (!s) return;
  const w = (s.width / dpr) * scale;
  ctx.drawImage(s, x - w / 2, y - w / 2, w, w);
}

function render(time) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, boardW, boardH);
  const hover = drag ? cellAt(drag.x, drag.y) : -1;
  for (let i = 0; i < CELLS; i++) {
    const x = (i % COLS) * cell, y = Math.floor(i / COLS) * cell, p = cell * 0.05;
    roundRect(ctx, x + p, y + p, cell - 2 * p, cell - 2 * p, cell * 0.18);
    let bg = 'rgba(40,50,110,0.55)';
    if (drag && i === hover && i !== drag.from) {
      bg = S.grid[i] === drag.tier && drag.tier < MAX_TIER ? 'rgba(124,77,255,0.65)' : 'rgba(70,90,170,0.7)';
    }
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(140,160,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  }
  for (let i = 0; i < CELLS; i++) {
    const tier = S.grid[i];
    if (!tier || (drag && drag.from === i)) continue;
    const [cx, cy] = cellCenter(i);
    let sc = 1;
    if (fx.pops[i] > 0) sc = 1 + 0.35 * Math.sin(fx.pops[i] * Math.PI);
    const bob = Math.sin(time / 600 + i * 1.7) * cell * 0.02;
    if (TIERS[tier - 1].type === 'star' || TIERS[tier - 1].type === 'neutron') sc *= 1 + 0.03 * Math.sin(time / 300 + i);
    if (TIERS[tier - 1].type === 'galaxy') {
      ctx.save(); ctx.translate(cx, cy + bob); ctx.rotate(time / 4000); drawSprite(tier, 0, 0, sc); ctx.restore();
    } else drawSprite(tier, cx, cy + bob, sc);
    // уровень объекта
    ctx.font = `700 ${Math.round(cell * 0.18)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(tier, (i % COLS) * cell + cell * 0.12, Math.floor(i / COLS) * cell + cell * 0.1);
  }
  for (const pt of fx.particles) {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (drag) drawSprite(drag.tier, drag.x, drag.y, 1.15);
  ctx.font = `800 ${Math.round(cell * 0.22)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of fx.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.fillStyle = f.color; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function burst(i, tier) {
  const [cx, cy] = cellCenter(i);
  const colors = [TIERS[tier - 1].c1, TIERS[tier - 1].c2, '#ffffff', '#ffd54f'];
  for (let k = 0; k < 22; k++) {
    const a = Math.random() * Math.PI * 2, sp = cell * (1.5 + Math.random() * 3);
    fx.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: cell * (0.03 + Math.random() * 0.04), life: 1, color: colors[k % 4] });
  }
}
function floatText(i, text, color = '#ffd54f') {
  const [cx, cy] = cellCenter(i);
  fx.floats.push({ x: cx, y: cy - cell * 0.2, text, color, life: 1 });
}

/* ---------- Логика ---------- */
function emptyCells() { const r = []; S.grid.forEach((v, i) => { if (!v) r.push(i); }); return r; }
function spawn(tier) {
  const e = emptyCells(); if (!e.length) return -1;
  const i = e[Math.floor(Math.random() * e.length)];
  S.grid[i] = tier; fx.pops[i] = 1; return i;
}
function buy() {
  const price = buyPrice();
  if (!emptyCells().length) { toast(t('noSpace')); Sound.error(); return; }
  if (S.coins < price) { toast(t('noMoney')); Sound.error(); return; }
  S.coins -= price; S.buys++;
  spawn(S.spawnLvl); Sound.spawn(); updateUI();
}
function upgrade() {
  if (!canUpgrade()) {
    toast(S.spawnLvl >= MAX_TIER - 4 ? t('maxUp') : `${t('needFind')}: ${tierName(S.spawnLvl + 3)}`); Sound.error(); return;
  }
  const cost = upgradeCost();
  if (S.coins < cost) { toast(t('noMoney')); Sound.error(); return; }
  S.coins -= cost; S.spawnLvl++; S.buys = 0;
  // старые объекты ниже нового уровня улучшаются
  S.grid = S.grid.map((v, i) => { if (v && v < S.spawnLvl) { fx.pops[i] = 1; return S.spawnLvl; } return v; });
  Sound.fanfare(); updateUI(); persist(true);
}
function merge(from, to) {
  const tier = S.grid[to] + 1;
  S.grid[to] = tier; S.grid[from] = 0;
  fx.pops[to] = 1; burst(to, tier); Sound.merge(tier);
  if (tier > S.maxTier) {
    S.maxTier = tier;
    const bonus = Math.round(incomeOf(tier) * 40);
    S.coins += bonus; S.lifetime += bonus;
    setTimeout(() => discovery(tier, bonus), 350);
  }
  updateUI();
}
async function boost() {
  const ok = await YA.rewarded(); if (!ok) return;
  S.boostUntil = Math.max(Date.now(), S.boostUntil) + BOOST_SEC * 1000;
  toast(t('boostOn')); Sound.fanfare(); updateUI(); persist(true);
}
async function gift() {
  if (emptyCells().length < 1) { toast(t('noSpace')); Sound.error(); return; }
  const ok = await YA.rewarded(); if (!ok) return;
  for (let k = 0; k < 3; k++) spawn(Math.min(S.spawnLvl + (k === 0 ? 1 : 0), MAX_TIER));
  toast(t('giftGot')); Sound.spawn(); updateUI(); persist(true);
}

/* ---------- Интерфейс ---------- */
let toastTimer = 0;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}
function popup(title, text, tier, buttons) {
  $('popup-title').textContent = title;
  $('popup-text').textContent = text;
  const ic = $('popup-icon');
  ic.style.display = tier ? 'block' : 'none';
  if (tier) { const g = ic.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 160, 160); g.translate(80, 80); drawObject(g, tier, 50); }
  const box = $('popup-buttons'); box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || '');
    el.innerHTML = b.html;
    el.onclick = () => { $('popup').classList.remove('active'); b.onClick && b.onClick(); };
    box.appendChild(el);
  }
  $('popup').classList.add('active');
}
function discovery(tier, bonus) {
  Sound.fanfare();
  const text = `${tierName(tier)}\n${t('bonus')}: +${fmt(bonus)}` + (tier === MAX_TIER ? `\n\n${t('win')}` : '');
  popup(t('newFind'), text, tier, [{ html: t('great'), cls: 'btn-primary', onClick: maybeInterstitial }]);
  persist(true);
}
async function maybeInterstitial() {
  if (Date.now() - lastAdAt < AD_INTERVAL_MS) return;
  lastAdAt = Date.now();
  await YA.interstitial();
}
function updateUI() {
  $('coins').textContent = fmt(S.coins);
  $('income').textContent = fmt(incomePerSec());
  $('discovered').textContent = `${S.maxTier}/${MAX_TIER}`;
  $('buy-price').textContent = fmt(buyPrice());
  $('btn-buy').classList.toggle('disabled', S.coins < buyPrice() || !emptyCells().length);
  if (canUpgrade()) {
    $('upgrade-info').innerHTML = `<span class="coin small"></span>${fmt(upgradeCost())}`;
    $('btn-upgrade').classList.toggle('disabled', S.coins < upgradeCost());
  } else {
    $('upgrade-info').textContent = S.spawnLvl >= MAX_TIER - 4 ? t('maxUp') : `${t('needFind')}: ${tierName(S.spawnLvl + 3)}`;
    $('btn-upgrade').classList.add('disabled');
  }
  const b = boosting();
  $('boost-badge').classList.toggle('on', b);
  if (b) { const s = Math.ceil((S.boostUntil - Date.now()) / 1000); $('boost-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  $('btn-sound').textContent = S.sound ? '🔊' : '🔇';
}
function applyI18n() {
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

/* ---------- Ввод ---------- */
function cellAt(x, y) {
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  return cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS ? -1 : cy * COLS + cx;
}
function localPos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault(); Sound.ensure();
  const [x, y] = localPos(e), i = cellAt(x, y);
  if (i < 0 || !S.grid[i]) return;
  drag = { from: i, x, y, tier: S.grid[i], id: e.pointerId };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  Sound.pick();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  [drag.x, drag.y] = localPos(e);
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const to = cellAt(drag.x, drag.y), from = drag.from;
  drag = null;
  if (to < 0 || to === from) return;
  if (!S.grid[to]) { S.grid[to] = S.grid[from]; S.grid[from] = 0; Sound.drop(); }
  else if (S.grid[to] === S.grid[from] && S.grid[to] < MAX_TIER) merge(from, to);
  else { const tmp = S.grid[to]; S.grid[to] = S.grid[from]; S.grid[from] = tmp; Sound.drop(); }
  updateUI(); persist();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
document.addEventListener('contextmenu', (e) => e.preventDefault());

$('btn-buy').onclick = buy;
$('btn-upgrade').onclick = upgrade;
$('btn-boost').onclick = boost;
$('btn-gift').onclick = gift;
$('btn-sound').onclick = () => { S.sound = Sound.on = !S.sound; updateUI(); persist(); };

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Sound.pause(); YA.stop(); persist(true); }
  else { Sound.resume(); YA.start(); collectOffline(); }
});

/* ---------- Цикл ---------- */
let lastT = 0, uiTimer = 0, floatTimer = 0, saveTimer = 0;
function frame(time) {
  const dt = Math.min(0.1, (time - lastT) / 1000 || 0); lastT = time;
  if (!document.hidden) {
    const inc = incomePerSec() * dt;
    S.coins += inc; S.lifetime += inc;
    S.meteor += dt;
    if (S.meteor >= METEOR_SEC) {
      if (emptyCells().length) { S.meteor = 0; const i = spawn(S.spawnLvl); if (i >= 0) { burst(i, S.spawnLvl); Sound.spawn(); } }
      else S.meteor = METEOR_SEC;
    }
    $('meteor-fill').style.width = (S.meteor / METEOR_SEC * 100) + '%';
    floatTimer += dt;
    if (floatTimer > 0.9) {
      floatTimer = 0;
      const filled = []; S.grid.forEach((v, i) => { if (v) filled.push(i); });
      if (filled.length) {
        const i = filled[Math.floor(Math.random() * filled.length)];
        floatText(i, '+' + fmt(incomeOf(S.grid[i]) * (boosting() ? 2 : 1)));
      }
    }
    for (const p of fx.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt * 1.6; }
    fx.particles = fx.particles.filter((p) => p.life > 0);
    for (const f of fx.floats) { f.y -= cell * 0.6 * dt; f.life -= dt * 0.8; }
    fx.floats = fx.floats.filter((f) => f.life > 0);
    for (let i = 0; i < CELLS; i++) if (fx.pops[i] > 0) fx.pops[i] = Math.max(0, fx.pops[i] - dt * 3);
    uiTimer += dt; if (uiTimer > 0.2) { uiTimer = 0; updateUI(); }
    saveTimer += dt; if (saveTimer > 5) { saveTimer = 0; persist(); }
    render(time);
  }
  requestAnimationFrame(frame);
}

function collectOffline() {
  const away = Math.min(OFFLINE_MAX_SEC, (Date.now() - (S.t || Date.now())) / 1000);
  S.t = Date.now();
  if (away < 60) return;
  let base = 0; for (const v of S.grid) if (v) base += incomeOf(v);
  const amount = Math.round(base * away * 0.5);
  if (amount < 1) return;
  const give = (k) => { S.coins += amount * k; S.lifetime += amount * k; Sound.coin(); updateUI(); persist(true); };
  popup(t('welcome'), `${t('offline')}\n+${fmt(amount)}`, 0, [
    { html: `${t('takeX3')} <small>(${t('ad')})</small>`, cls: 'btn-primary', onClick: async () => { const ok = await YA.rewarded(); give(ok ? 3 : 1); } },
    { html: t('take'), onClick: () => give(1) },
  ]);
}

(async function boot() {
  await YA.init();
  const l = YA.lang();
  lang = ['ru', 'be', 'kk', 'uk', 'uz'].includes(l) ? 'ru' : 'en';
  const saved = pickSave(loadLocal(), await YA.loadData());
  const isNew = !saved;
  if (saved) S = Object.assign(fresh(), saved);
  Sound.on = S.sound;
  if (isNew) { S.coins = 20; for (let k = 0; k < 4; k++) spawn(1); }
  applyI18n(); resize(); updateUI();
  requestAnimationFrame(frame);
  YA.ready(); YA.start();
  if (isNew) setTimeout(() => toast(t('hint')), 600);
  else collectOffline();
})();

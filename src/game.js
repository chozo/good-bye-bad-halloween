import { CONFIG as C } from './config.js';
import {
  drawHuman, drawCostumeOnly, drawGhost, drawHitodama, drawCursedEyes, drawHarisen,
  drawBubble, GHOST_LIKE, OBVIOUS, LOOKALIKE, monsterLook,
} from './draw.js';
import { project, makeScene, drawScreens, drawLine } from './scene.js';
import { initAudio, play, setMuted, isMuted, startBgm, stopBgm, setBgmLevel, duckBgm } from './audio.js';
import { explainMiss } from './replay.js';

const W = C.width;
const H = C.height;
const UNIT = 120 / C.personHeight; // 描画の1単位あたりのメートル換算

// ---------------------------------------------------------------- 乱数（テスト用に固定できる）

let rand = Math.random;
function seedRandom(seed) {
  let a = seed >>> 0;
  rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- DOM

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const el = (id) => document.getElementById(id);
const ui = {
  hud: el('hud'),
  score: el('score'),
  level: el('level'),
  lives: el('lives'),
  start: el('start'),
  result: el('result'),
  resScore: el('res-score'),
  resTitle: el('res-title'),
  resNext: el('res-next'),
  resMisses: el('res-misses'),
  resBest: el('res-best'),
  mute: el('mute'),
};

// ---------------------------------------------------------------- 状態

let sceneCanvas = null;

const S = {
  mode: 'title', // title | play | over | result
  time: 0,
  score: 0,
  misses: 0,
  missLog: [],
  level: 0,
  entities: [],
  texts: [],
  swings: [],
  spawnT: 0,
  shake: 0,
  flash: null,
  overT: 0,
  nextId: 1,
  frames: [], // リプレイ用の記録（直近 REPLAY.keep 秒）
  replay: null, // 再生中のリプレイ
  replayQueue: [], // これから再生するミス
  missRecords: [], // ミスごとのリプレイ（結果画面から見返す）
  pendingGameOver: false,
};

// リプレイの設定
const REPLAY = {
  keep: 2.6, // 記録しておく秒数
  before: 1.8, // ミスの何秒前から再生するか
  after: 0.4, // ミスのあと何秒ぶん見せるか（ハリセンが当たるところまで）
  restartDelay: 0.8, // 交差点を空にしてから最初の人が現れるまでの秒数
  speed: 0.5, // 再生速度（スロー）
  explain: 2.8, // 止めて目印を説明する秒数
  zoomPlay: 1.35,
  zoomExplain: 1.75,
};

const events = [];
function emit(type, data = {}) {
  events.push({ type, t: S.time, ...data });
  if (events.length > 500) events.shift();
}

let best = 0;
try {
  best = Number(localStorage.getItem('shibuya-halloween-best') || 0);
} catch {
  best = 0;
}

const LV = () => C.levels[S.level];

// ---------------------------------------------------------------- 遠近（3D → 画面）

// 斜めに横断する：奥では x0、規制線では x1 にいる
function worldX(e) {
  const k = (e.z - C.zLine) / (C.zSpawn - C.zLine);
  return e.x1 + (e.x0 - e.x1) * k + e.dx + Math.sin(S.time * 1.3 + e.seed) * 0.08;
}

function placeOnScreen(e) {
  const [sx, sy] = project(worldX(e), e.z);
  e.x = sx;
  e.y = sy;
  e.s = (C.camera.focal / (e.z * UNIT)) * C.personScale;
}

// ---------------------------------------------------------------- 出現

const SKINS = ['#f1c9a5', '#e0ac85', '#c68b62', '#f5d6bd'];
const HAIRS = ['#222', '#4a3020', '#6b4a2a', '#111', '#c9a24a', '#8a3b2a'];
const TOPS = ['#7a8a99', '#9b5d5d', '#5d7f9b', '#6e9b5d', '#555', '#8a6fb0'];
const PANTS = ['#33475e', '#2b2b2b', '#4b5563', '#3b4a6b'];
const SNEAKERS = ['#ffffff', '#e53935', '#43a047', '#1e88e5', '#fdd835', '#ff7ac8'];

const NORMAL_LOOKS = {
  salaryman: { top: '#2c3e66', pants: '#2c3e66', shoes: '#1a1a1a' },
  student: { top: '#1f2a44', pants: '#1f2a44', shoes: '#333' },
  tourist: { top: '#f2c14e', pants: '#a68a64', shoes: '#fff' },
  ol: { top: '#c8b49a', pants: '#333', shoes: '#5b2c2c' },
};

function pickKind(mix) {
  const r = rand() * (mix.costume + mix.ghost + mix.normal);
  if (r < mix.costume) return 'costume';
  if (r < mix.costume + mix.ghost) return 'ghost';
  return 'normal';
}

// 規制線のところで重ならないよう、4本のレーンに分けて歩かせる
const LANES = [-1.65, -0.55, 0.55, 1.65];
function pickLane() {
  // それぞれのレーンで一番後ろを歩く人との距離を測り、いちばん空いているレーンを選ぶ
  let best = [];
  let bestGap = -1;
  for (const lane of LANES) {
    let gap = 99;
    for (const e of S.entities) {
      if (e.state === 'walk' && Math.abs(e.x1 - lane) < 0.3) gap = Math.min(gap, C.zSpawn - e.z);
    }
    if (gap > bestGap + 0.01) {
      bestGap = gap;
      best = [lane];
    } else if (Math.abs(gap - bestGap) <= 0.01) best.push(lane);
  }
  return pick(best) + (rand() - 0.5) * 0.2;
}

function spawn(kind, variant, x1, z) {
  const lv = LV();
  kind = kind || pickKind(lv.mix);
  let monster = false;
  if (!variant) {
    if (kind === 'costume') variant = rand() < lv.ghostLike ? pick(GHOST_LIKE) : pick(OBVIOUS);
    else if (kind === 'ghost') variant = rand() < lv.lookalike ? pick(LOOKALIKE) : S.level === 0 ? pick(['yurei', 'sheet']) : pick(GHOST_LIKE);
    else variant = pick(Object.keys(NORMAL_LOOKS));
  }
  if (kind === 'ghost' && LOOKALIKE.includes(variant)) monster = true;
  const lane = x1 ?? pickLane();
  const e = {
    id: S.nextId++,
    kind,
    variant,
    monster,
    x1: lane,
    // 奥では左右に広がった位置から、少し斜めに歩いてくる
    x0: clamp(lane * 2.5 + (rand() * 2 - 1) * 1.5, -9, 9),
    dx: 0,
    z: z ?? C.zSpawn,
    x: 0,
    y: 0,
    s: 0.3,
    speed: lv.speed * lerp(0.9, 1.1, rand()),
    phase: rand() * 6,
    seed: rand() * 100,
    state: 'walk',
    t: 0,
    alpha: 1,
    crossed: false,
    look: {
      skin: pick(SKINS),
      hair: pick(HAIRS),
      top: pick(TOPS),
      pants: pick(PANTS),
      shoes: kind === 'costume' ? pick(SNEAKERS) : pick(['#1a1a1a', '#5b3a29', '#fff']),
    },
    props: {},
    hemY: lerp(-26, -7, lv.robeCover * (0.85 + rand() * 0.15)),
    ghostAlpha: lv.ghostAlpha,
    glide: monster && rand() < lv.glide,
    eyeGlow: lv.eyeGlow,
    hitodama: kind === 'ghost' && !monster && lv.hitodama,
    talk: null,
    talkAt: rand() < lv.talkChance ? lerp(0.3, 0.65, rand()) : -1,
    bubble: null,
    fly: null,
  };
  if (monster) e.look = monsterLook(variant);
  if (kind === 'normal') {
    Object.assign(e.look, NORMAL_LOOKS[variant]);
    if (rand() < 0.3) e.props.phone = true;
  }
  if (kind === 'costume' && rand() < lv.propChance) {
    const p = pick(['priceTag', 'bag', 'can']);
    e.props[p] = true;
  }
  placeOnScreen(e);
  S.entities.push(e);
  emit('spawn', { id: e.id, kind, variant, monster });
  return e;
}

// 浮いている高さ（描画の単位）
function liftOf(e) {
  if (e.kind !== 'ghost') return 0;
  if (e.monster) return e.glide ? 4 : 0;
  return 14;
}

// ---------------------------------------------------------------- 当たり判定

function entityBox(e) {
  const float = liftOf(e) * e.s;
  return {
    x0: e.x - 24 * e.s,
    x1: e.x + 24 * e.s,
    y0: e.y - 130 * e.s - float,
    y1: e.y + 6 * e.s - float,
  };
}

// 当たり判定は、画面に実際に描かれている形で行う（四角い範囲だと、おばけの頭の横の何もない所を
// 叩いても、すぐ後ろの仮装ではなくおばけに当たってしまうため）
const HIT_R = 7; // 指のずれを許す半径（論理px）
const HIT_N = HIT_R * 2 + 1;
const hitCanvas = document.createElement('canvas');
hitCanvas.width = HIT_N;
hitCanvas.height = HIT_N;
const hitCtx = hitCanvas.getContext('2d', { willReadFrequently: true });

// 歩いている人の体だけを描く（影・吹き出し・人魂は含めない。透ける幽霊も不透明で描く）
function drawBody(g, e) {
  g.save();
  if (e.kind === 'ghost' && !e.monster) {
    const lift = 14 + Math.sin(VT * 2 + e.seed) * 4;
    g.translate(e.x, e.y - lift * e.s);
    g.scale(e.s, e.s);
    drawGhost(g, e, VT);
  } else {
    g.translate(e.x, e.y - liftOf(e) * e.s);
    g.scale(e.s, e.s);
    drawHuman(g, e);
  }
  g.restore();
}

// (x, y) から、その人の描かれた部分までの距離。HIT_R より遠ければ Infinity
function bodyDistance(e, x, y) {
  const g = hitCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, HIT_N, HIT_N);
  g.translate(HIT_R + 0.5 - x, HIT_R + 0.5 - y);
  drawBody(g, e);
  const d = g.getImageData(0, 0, HIT_N, HIT_N).data;
  let best = Infinity;
  for (let py = 0; py < HIT_N; py++) {
    for (let px = 0; px < HIT_N; px++) {
      // 半透明の影（足元）は数えない
      if (d[(py * HIT_N + px) * 4 + 3] < 200) continue;
      const dist = Math.hypot(px - HIT_R, py - HIT_R);
      if (dist < best && dist <= HIT_R) best = dist;
    }
  }
  return best;
}

function hitTest(x, y) {
  // 四角い範囲で候補を絞り、手前から順に調べる
  const cands = S.entities
    .filter((e) => {
      if (e.state !== 'walk') return false;
      const b = entityBox(e);
      return x >= b.x0 - HIT_R && x <= b.x1 + HIT_R && y >= b.y0 - HIT_R && y <= b.y1 + HIT_R;
    })
    .sort((a, b) => b.y - a.y);
  let best = null;
  let bestD = Infinity;
  for (const e of cands) {
    const d = bodyDistance(e, x, y);
    // 指の真下に描かれている人がいれば、その中で一番手前の人（＝画面で見えている人）
    if (d === 0) return e;
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  // 誰の上でもなければ、一番近くに描かれている人（同じ距離なら手前）
  return best;
}

// ---------------------------------------------------------------- 操作

function tapAt(x, y) {
  if (S.mode !== 'play' || S.replayQueue.length) return null;
  S.swings.push({ x, y, t: 0 });
  const e = hitTest(x, y);
  if (!e) {
    play('tap');
    return null;
  }
  play('harisen');
  e.t = 0;
  if (e.kind === 'costume') {
    e.state = 'busted';
    e.fly = { x: 0, y: 0, vx: (rand() < 0.5 ? -1 : 1) * lerp(120, 220, rand()), vy: -380, r: 0, vr: lerp(-8, 8, rand()) };
    e.bubble = pick(C.lines.busted);
    S.score++;
    addText('成敗！', e.x + (e.x < W / 2 ? 70 : -70), e.y - 60 * e.s, '#ffe14d', 34);
    play('bust');
    emit('bust', { id: e.id, variant: e.variant, score: S.score });
    const lv = Math.min(C.levels.length - 1, Math.floor(S.score / C.levelEvery));
    if (lv > S.level) {
      S.level = lv;
      addText(`Lv${lv + 1}  人が増えてきた！`, W / 2, H * 0.42, '#7ff7ff', 30, 1.6);
      play('levelup');
      setBgmLevel(lv);
      emit('levelup', { level: lv });
    }
  } else if (e.kind === 'ghost') {
    e.state = 'cursed';
    e.bubble = pick(C.lines.cursed);
    play('curse');
    miss('本物のお化けを叩いて祟られた', e, '#b46bff', 'hit-ghost');
  } else {
    e.state = 'angry';
    e.bubble = pick(C.lines.angry);
    play('angry');
    miss('普通の人を叩いて苦情が来た', e, '#ff7a3d', 'hit-normal');
  }
  updateHud();
  return e;
}

function miss(reason, e, color, cause) {
  if (S.pendingGameOver) return; // 3回目のミスのあとは数えない
  S.misses++;
  S.missLog.push(reason);
  S.shake = 0.35;
  S.flash = { color, t: 0.35 };
  addText('ミス！', e.x, Math.min(e.y - 150 * e.s, H - 120), color, 38);
  emit('miss', { id: e.id, kind: e.kind, reason, misses: S.misses });
  updateHud();
  S.replayQueue.push({ id: e.id, cause, reason, index: S.misses - 1, time: S.time, startAt: S.time + REPLAY.after });
  if (S.misses >= C.maxMiss) S.pendingGameOver = true;
}

function addText(text, x, y, color, size = 28, dur = 1.0) {
  S.texts.push({ text, x: clamp(x, 80, W - 80), y, color, size, t: 0, dur });
}

// ---------------------------------------------------------------- 進行

function startGame() {
  initAudio();
  Object.assign(S, {
    mode: 'play', time: 0, score: 0, misses: 0, missLog: [], level: 0,
    entities: [], texts: [], swings: [], spawnT: 0.6, shake: 0, flash: null, overT: 0,
    frames: [], replay: null, replayQueue: [], pendingGameOver: false, missRecords: [],
  });
  ui.start.hidden = true;
  ui.result.hidden = true;
  ui.hud.hidden = false;
  updateHud();
  startBgm(0);
  emit('start');
}

function gameOver() {
  S.mode = 'over';
  S.overT = C.gameOverSlowmo;
  stopBgm();
  play('gameover');
  emit('gameover', { score: S.score });
}

function titleFor(score) {
  let t = C.titles[0];
  for (const x of C.titles) if (score >= x.min) t = x;
  return t;
}

function showResult() {
  S.mode = 'result';
  ui.hud.hidden = true;
  const t = titleFor(S.score);
  const next = C.titles.find((x) => x.min > S.score);
  if (S.score > best) {
    best = S.score;
    try {
      localStorage.setItem('shibuya-halloween-best', String(best));
    } catch {
      // 保存できなくても続ける
    }
  }
  ui.resScore.textContent = S.score;
  ui.resTitle.textContent = t.name;
  ui.resNext.textContent = next ? `あと ${next.min - S.score}人で「${next.name}」` : '最高の称号です';
  ui.resBest.textContent = `自己ベスト ${best}人`;
  ui.resMisses.innerHTML = '';
  S.missLog.forEach((r, i) => {
    const li = document.createElement('li');
    if (S.missRecords[i]) {
      // タップでそのミスのリプレイを見返す
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'miss-replay';
      btn.innerHTML = `<span class="play">▶</span><span class="txt"></span><span class="tag">リプレイ</span>`;
      btn.querySelector('.txt').textContent = S.missRecords[i].info.short || r;
      btn.addEventListener('click', () => playReview(i));
      li.appendChild(btn);
    } else {
      li.textContent = r;
    }
    ui.resMisses.appendChild(li);
  });
  ui.result.hidden = false;
  emit('result', { score: S.score, title: t.name });
}

function toTitle() {
  S.mode = 'title';
  stopBgm();
  S.entities = [];
  S.texts = [];
  ui.result.hidden = true;
  ui.hud.hidden = true;
  ui.start.hidden = false;
}

function updateHud() {
  ui.score.textContent = S.score;
  ui.level.textContent = `Lv${S.level + 1}`;
  const dots = ui.lives.children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('used', i < S.misses);
}

function update(dt) {
  if (S.mode === 'over') {
    S.overT -= dt;
    dt *= 0.3;
    if (S.overT <= 0) {
      showResult();
      return;
    }
  }
  if (S.mode === 'replay' || S.mode === 'review') {
    updateReplay(dt);
    return;
  }
  if (S.mode !== 'play' && S.mode !== 'over') return;
  S.time += dt;

  // 出現
  if (S.mode === 'play') {
    S.spawnT -= dt;
    const walking = S.entities.filter((e) => e.state === 'walk' && e.z > C.zLine).length;
    if (S.spawnT <= 0 && walking < LV().maxOnScreen) {
      spawn();
      S.spawnT = LV().interval * lerp(0.75, 1.25, rand());
    }
  }

  for (const e of S.entities) updateEntity(e, dt);
  S.entities = S.entities.filter((e) => e.state !== 'gone');

  for (const t of S.texts) t.t += dt;
  S.texts = S.texts.filter((t) => t.t < t.dur);
  for (const s of S.swings) s.t += dt;
  S.swings = S.swings.filter((s) => s.t < 0.25);
  S.shake = Math.max(0, S.shake - dt);
  if (S.flash) {
    S.flash.t -= dt;
    if (S.flash.t <= 0) S.flash = null;
  }

  if (S.mode === 'play') {
    record();
    const q = S.replayQueue[0];
    if (q && S.time >= q.startAt) startReplay(S.replayQueue.shift());
  }
}

// ---------------------------------------------------------------- リプレイ

function cloneEnt(e) {
  return { ...e, fly: e.fly && { ...e.fly }, talk: e.talk && { ...e.talk } };
}

function record() {
  S.frames.push({
    time: S.time,
    ents: S.entities.map(cloneEnt),
    swings: S.swings.map((x) => ({ ...x })),
    texts: S.texts.map((x) => ({ ...x })),
  });
  while (S.frames.length && S.frames[0].time < S.time - REPLAY.keep) S.frames.shift();
}

function startReplay(item) {
  const frames = S.frames.filter((f) => f.time >= item.time - REPLAY.before && f.time <= item.startAt + 1e-6);
  // 説明に使うのは、ミスの直前の姿（叩かれる前・規制線を越える瞬間）
  let still = null;
  for (const f of frames) {
    if (f.time <= item.time + 1e-6 && f.ents.some((e) => e.id === item.id)) still = f;
  }
  if (!frames.length || !still) {
    afterReplay();
    return;
  }
  const target = still.ents.find((e) => e.id === item.id);
  const rec = {
    item,
    frames,
    still,
    start: frames[0].time,
    end: frames[frames.length - 1].time,
    info: explainMiss(target, item.cause),
  };
  S.missRecords[item.index] = rec;
  S.mode = 'replay';
  S.replay = { ...rec, t: 0, phase: 'play' };
  S.shake = 0;
  S.flash = null;
  ui.hud.hidden = true;
  duckBgm(true);
  play('rewind');
  emit('replay', { id: item.id, cause: item.cause });
}

function updateReplay(dt) {
  const r = S.replay;
  r.t += dt;
  if (r.phase === 'play' && r.start + r.t * REPLAY.speed >= r.end) {
    r.phase = 'explain';
    r.et = 0;
    play('explain');
  } else if (r.phase === 'explain') {
    r.et += dt;
    if (r.et >= REPLAY.explain) endReplay();
  }
}

// 結果画面からミスを見返す
function playReview(i) {
  const rec = S.missRecords[i];
  if (!rec || S.mode !== 'result') return;
  S.mode = 'review';
  S.replay = { ...rec, t: 0, phase: 'play', review: true };
  ui.result.hidden = true;
  play('rewind');
  emit('review', { index: i });
}

function skipReplay() {
  if (S.mode === 'replay' || S.mode === 'review') endReplay();
}

function endReplay() {
  if (S.replay?.review) {
    S.replay = null;
    S.mode = 'result';
    ui.result.hidden = false;
    emit('reviewEnd');
    return;
  }
  S.replay = null;
  S.mode = 'play';
  emit('replayEnd');
  afterReplay();
}

function afterReplay() {
  S.mode = 'play';
  duckBgm(false);
  ui.hud.hidden = false;
  // 続けて起きたミスがあれば、そのリプレイを先に流す（記録はミスの時点までで足りる）
  if (S.replayQueue.length) {
    startReplay(S.replayQueue.shift());
    return;
  }
  if (S.pendingGameOver) {
    gameOver();
    return;
  }
  clearField();
}

// ミスのあとは交差点を空にして、まっさらな状態から再開する
function clearField() {
  S.entities = [];
  S.texts = [];
  S.swings = [];
  S.frames = [];
  S.shake = 0;
  S.flash = null;
  if (S.spawnT < 1e8) S.spawnT = REPLAY.restartDelay; // 確認用に出現を止めているときはそのまま
  addText('再スタート！', W / 2, H * 0.42, '#7ff7ff', 32, 1.2);
  emit('clear');
}

function updateEntity(e, dt) {
  e.t += dt;
  if (e.state === 'walk') {
    e.z -= e.speed * dt;
    const legs = e.kind === 'ghost' && (!e.monster || e.glide) ? 0 : 1;
    e.phase += dt * e.speed * 1.5 * legs;
    placeOnScreen(e);
    const prog = (C.zSpawn - e.z) / (C.zSpawn - C.zLine);
    if (e.talkAt > 0 && prog >= e.talkAt && !e.talk) {
      e.talk = { text: pick(C.lines[e.kind + 'Talk']), t: 0 };
    }
    if (e.talk) e.talk.t += dt;
    if (!e.crossed && e.z <= C.zLine) {
      e.crossed = true;
      if (e.kind === 'costume' && S.mode === 'play') {
        e.talk = { text: pick(C.lines.passed), t: 0 };
        play('pass');
        miss('仮装を見逃した', e, '#ff3d5a', 'pass');
      }
    }
    if (e.z < C.zGone) e.state = 'gone';
  } else if (e.state === 'busted') {
    const f = e.fly;
    f.vy += 900 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.r += f.vr * dt;
    if (e.t > 0.45) {
      // とぼとぼ帰っていく
      e.z += 1.6 * dt;
      e.phase += dt * 5;
      placeOnScreen(e);
    }
    e.alpha = clamp(1 - (e.t - 0.9) / (C.bustDuration - 0.9), 0, 1);
    if (e.t >= C.bustDuration) e.state = 'gone';
  } else if (e.state === 'cursed') {
    e.alpha = clamp(1 - (e.t - 0.9) / (C.cursedDuration - 0.9), 0, 1);
    if (e.t >= C.cursedDuration) e.state = 'gone';
  } else if (e.state === 'angry') {
    e.dx += Math.sign(worldX(e) || 1) * dt * 4;
    e.phase += dt * 14;
    placeOnScreen(e);
    e.alpha = clamp(1 - (e.t - 0.8) / (C.angryDuration - 0.8), 0, 1);
    if (e.t >= C.angryDuration) e.state = 'gone';
  }
}

// ---------------------------------------------------------------- 描画

let scale = 1;
function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  scale = canvas.width / W;
  sceneCanvas = makeScene(scale);
}
window.addEventListener('resize', resize);

let VT = 0; // 描画中の時刻（リプレイ中は記録した時刻）

const easeOut = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;

// リプレイ中に見せる場面とズーム
function replayView() {
  const r = S.replay;
  // 人物が画面の6割くらいに収まるようにズームを抑える
  const st = r.still.ents.find((e) => e.id === r.item.id);
  const fit = clamp((H * 0.6) / (135 * st.s), 1, REPLAY.zoomExplain);
  const zPlay = Math.min(REPLAY.zoomPlay, fit);
  let frame;
  let zoom;
  let follow;
  if (r.phase === 'play') {
    const pt = r.start + r.t * REPLAY.speed;
    frame = r.frames[r.frames.length - 1];
    for (const f of r.frames) {
      if (f.time >= pt) {
        frame = f;
        break;
      }
    }
    const k = easeOut((pt - r.start) / Math.max(0.01, r.end - r.start));
    zoom = lerp(1, zPlay, k);
    follow = k;
  } else {
    frame = r.still;
    const k = easeOut(r.et / 0.45);
    zoom = lerp(zPlay, fit, k);
    follow = 1;
  }
  const target = frame.ents.find((e) => e.id === r.item.id) || r.still.ents.find((e) => e.id === r.item.id);
  const tx = target.x;
  const ty = target.y - (liftOf(target) + 60) * target.s;
  let cx = lerp(W / 2, tx, follow);
  let cy = lerp(H / 2, ty, follow);
  const hw = W / (2 * zoom);
  const hh = H / (2 * zoom);
  cx = clamp(cx, hw, W - hw);
  cy = clamp(cy, hh, H - hh);
  return { frame, zoom, cx, cy, target };
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const rv = S.replay ? replayView() : null;
  const view = rv ? rv.frame : { time: S.time, ents: S.entities, swings: S.swings, texts: S.texts };
  VT = view.time;

  ctx.save();
  if (rv) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(rv.zoom, rv.zoom);
    ctx.translate(-rv.cx, -rv.cy);
  } else if (S.shake > 0) {
    const k = S.shake * 22;
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  }
  const msg = C.screenMessages[Math.floor(VT / 3) % C.screenMessages.length];
  ctx.drawImage(sceneCanvas, 0, 0, W, H);
  drawScreens(ctx, clock, msg);
  drawLine(ctx, VT);

  const sorted = [...view.ents].sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEntity(e);
  if (!(rv && S.replay.phase === 'explain')) {
    for (const e of sorted) drawEntityBubble(e);
    for (const sw of view.swings) drawHarisen(ctx, sw.x, sw.y, sw.t / 0.25);
    for (const t of view.texts) drawFloatText(t);
  }
  ctx.restore();

  if (rv) drawReplayOverlay(rv);

  if (S.flash && !rv) {
    ctx.fillStyle = S.flash.color;
    ctx.globalAlpha = (S.flash.t / 0.35) * 0.35;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (S.mode === 'title') {
    ctx.fillStyle = 'rgba(10,5,25,0.55)';
    ctx.fillRect(0, 0, W, H);
  }
}

// 画面上の位置（ズーム後）
function toScreen(rv, x, y) {
  return [(x - rv.cx) * rv.zoom + W / 2, (y - rv.cy) * rv.zoom + H / 2];
}

function pill(text, x, y, { size = 20, bg = '#fff', fg = '#111', align = 'left' } = {}) {
  ctx.font = `900 ${size}px sans-serif`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.75;
  const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  ctx.beginPath();
  ctx.roundRect(x0, y - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x0 + w / 2, y + 1);
  return { x0, x1: x0 + w, w, h };
}

function drawReplayOverlay(rv) {
  const r = S.replay;
  const info = r.info;
  const t = rv.target;
  const [sx, sy] = toScreen(rv, t.x, t.y - (liftOf(t) + 60) * t.s);

  // 対象以外を暗くするスポットライト
  const rad = 150 * t.s * rv.zoom;
  const g = ctx.createRadialGradient(sx, sy, rad * 0.55, sx, sy, rad * 1.25);
  const dark = r.phase === 'explain' ? 0.62 : 0.35;
  g.addColorStop(0, 'rgba(8,4,20,0)');
  g.addColorStop(1, `rgba(8,4,20,${dark})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 録画っぽい枠とバッジ
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  const blink = Math.floor(clock * 2) % 2 === 0;
  pill(blink ? '● REPLAY' : '○ REPLAY', 22, 38, { size: 18, bg: '#e8203a', fg: '#fff' });
  pill(r.phase === 'play' ? 'スロー再生' : 'ここを見れば分かった！', 150, 38, { size: 16, bg: 'rgba(0,0,0,0.6)', fg: '#fff' });

  // 見出し（スロー再生中は答えを伏せる）
  const hy = 104;
  const headline = r.phase === 'play' ? 'ミス！ 何がダメだった？' : info.headline;
  const sub = r.phase === 'play' ? `ミス ${r.item.index + 1} / ${C.maxMiss}` : info.sub;
  const hcolor = r.phase === 'play' ? '#fff' : info.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 34px sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#140826';
  ctx.strokeText(headline, W / 2, hy);
  ctx.fillStyle = hcolor;
  ctx.fillText(headline, W / 2, hy);
  ctx.font = 'bold 17px sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeText(sub, W / 2, hy + 34);
  ctx.fillStyle = '#fff';
  ctx.fillText(sub, W / 2, hy + 34);

  // 目印（説明の段階で順番に出す）
  if (r.phase === 'explain') {
    const right = sx < W / 2;
    const lift = liftOf(t);
    const items = info.tells.map((tell, i) => {
      const [ax, ay] = toScreen(rv, t.x + tell.at[0] * t.s, t.y + (tell.at[1] - lift) * t.s);
      return { ...tell, ax, ay, i };
    });
    // ラベルの縦位置：目印の高さに合わせつつ重ならないようにずらす
    const sorted = [...items].sort((a, b) => a.ay - b.ay);
    let prev = 170;
    for (const it of sorted) {
      it.ly = Math.max(it.ay, prev + 46);
      prev = it.ly;
    }
    const over = prev - (H - 120);
    if (over > 0) for (const it of sorted) it.ly -= over;
    for (const it of sorted) {
      const appear = clamp((r.et - 0.35 - it.i * 0.35) / 0.2, 0, 1);
      if (appear <= 0) continue;
      ctx.save();
      ctx.globalAlpha = appear;
      const lx = right ? W - 20 : 20;
      ctx.font = '900 19px sans-serif';
      const p = pill(it.text, lx, it.ly, { size: 19, bg: info.color, fg: '#fff', align: right ? 'right' : 'left' });
      const ex = right ? p.x0 : p.x1;
      ctx.beginPath();
      ctx.moveTo(ex, it.ly);
      ctx.lineTo(it.ax, it.ay);
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(it.ax, it.ay, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  // スキップの案内
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 5);
  pill(r.review ? 'タップで結果に戻る' : r.phase === 'play' ? 'タップでスキップ' : 'タップで再開', W / 2, H - 54, { size: 18, bg: 'rgba(0,0,0,0.65)', fg: '#fff', align: 'center' });
  ctx.globalAlpha = 1;
}

function drawEntity(e) {
  ctx.save();
  ctx.globalAlpha = e.alpha;
  if (e.kind === 'ghost' && !e.monster) {
    const lift = 14 + Math.sin(VT * 2 + e.seed) * 4;
    ctx.translate(e.x, e.y - lift * e.s);
    ctx.scale(e.s, e.s);
    let a = e.ghostAlpha * (0.9 + 0.1 * Math.sin(VT * 3 + e.seed));
    if (e.state === 'cursed') {
      a = Math.min(1, a + 0.3);
      const g = 1 + Math.min(e.t, 0.4) * 0.5;
      ctx.scale(g, g);
    }
    ctx.globalAlpha = e.alpha * a;
    drawGhost(ctx, e, VT);
    if (e.state === 'cursed') {
      ctx.globalAlpha = e.alpha;
      drawCursedEyes(ctx);
    }
    ctx.restore();
    if (e.hitodama && e.state === 'walk') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      drawHitodama(ctx, e.x, e.y - lift * e.s, e.s, VT, e.seed);
      ctx.restore();
    }
    return;
  }
  ctx.translate(e.x, e.y - liftOf(e) * e.s);
  ctx.scale(e.s, e.s);
  if (e.state === 'cursed') {
    const g = 1 + Math.min(e.t, 0.4) * 0.4;
    ctx.scale(g, g);
    drawHuman(ctx, e);
    drawCursedEyes(ctx);
  } else if (e.state === 'busted') {
    // 中身（ただの大学生）
    drawHuman(ctx, e, { withCostume: false });
    // 汗
    ctx.fillStyle = '#7fd3ff';
    ctx.beginPath();
    ctx.ellipse(16, -106, 3, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 飛んでいく仮装
    ctx.save();
    ctx.translate(e.fly.x, e.fly.y);
    ctx.translate(0, -80);
    ctx.rotate(e.fly.r);
    ctx.translate(0, 80);
    drawCostumeOnly(ctx, e);
    ctx.restore();
  } else {
    drawHuman(ctx, e);
    if (e.state === 'angry') {
      ctx.fillStyle = '#e53935';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('💢', 10, -112);
    }
  }
  ctx.restore();
}

function drawEntityBubble(e) {
  let text = null;
  let color = '#fff';
  if (e.state === 'walk' && e.talk && e.talk.t < 1.6) text = e.talk.text;
  if (e.state === 'busted') text = e.bubble;
  if (e.state === 'cursed') {
    text = e.bubble;
    color = '#e5d0ff';
  }
  if (e.state === 'angry') {
    text = e.bubble;
    color = '#ffe0d0';
  }
  if (!text) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.2, e.alpha);
  const lift = liftOf(e) * e.s;
  drawBubble(ctx, text, e.x, Math.max(60, e.y - 132 * e.s - lift), color);
  ctx.restore();
}

function drawFloatText(t) {
  const k = t.t / t.dur;
  ctx.save();
  ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
  ctx.font = `900 ${t.size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y = t.y - k * 30;
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1a0b2e';
  ctx.strokeText(t.text, t.x, y);
  ctx.fillStyle = t.color;
  ctx.fillText(t.text, t.x, y);
  ctx.restore();
}

// ---------------------------------------------------------------- ループ

let manual = false;
let clock = 0; // 背景のビジョン用（タイトル画面でも進む）
let timeScale = 1;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  if (!manual) update(dt * timeScale);
  render();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- 入力

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  const r = canvas.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * W;
  const y = ((ev.clientY - r.top) / r.height) * H;
  if (S.mode === 'replay' || S.mode === 'review') {
    skipReplay();
    return;
  }
  tapAt(x, y);
});

el('btn-start').addEventListener('click', startGame);
el('btn-retry').addEventListener('click', startGame);
el('btn-title').addEventListener('click', toTitle);
ui.mute.addEventListener('click', () => {
  setMuted(!isMuted());
  ui.mute.textContent = isMuted() ? '🔇' : '🔊';
});

// ---------------------------------------------------------------- タイトル画面の見本

function drawSample(id, kind, variant) {
  const c = el(id);
  if (!c) return;
  const g = c.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = 90 * dpr;
  c.height = 120 * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 足元の地面
  g.fillStyle = '#2b2836';
  g.fillRect(0, 96, 90, 24);
  const monster = kind === 'ghost' && LOOKALIKE.includes(variant);
  const e = {
    kind, variant, monster, phase: 1, seed: 1, hemY: -26, eyeGlow: 1, props: kind === 'costume' ? { priceTag: true } : {},
    look: monster ? monsterLook(variant) : { skin: '#f1c9a5', hair: '#222', top: '#5d7f9b', pants: '#33475e', shoes: kind === 'costume' ? '#e53935' : '#1a1a1a', ...(kind === 'normal' ? NORMAL_LOOKS[variant] : {}) },
  };
  g.translate(45, monster ? 110 : 112);
  g.scale(0.7, 0.7);
  drawHuman(g, e);
}

// ---------------------------------------------------------------- 起動

resize();
drawSample('sample-costume', 'costume', 'vampire');
drawSample('sample-ghost', 'ghost', 'vampire');
drawSample('sample-normal', 'normal', 'salaryman');
requestAnimationFrame(frame);

// 確認用の入口
window.__game = {
  get state() {
    return {
      mode: S.mode, replay: S.replay ? S.replay.phase : null, score: S.score, misses: S.misses, level: S.level, time: S.time, missLog: [...S.missLog],
      entities: S.entities.map((e) => ({ id: e.id, kind: e.kind, variant: e.variant, monster: e.monster, glide: e.glide, state: e.state, x: e.x, y: e.y, z: e.z, s: e.s, crossed: e.crossed, box: entityBox(e) })),
    };
  },
  config: C,
  start: startGame,
  toTitle,
  tapAt,
  hitTest: (x, y) => hitTest(x, y)?.id ?? null,
  skipReplay,
  playReview,
  tapEntity(id) {
    const e = S.entities.find((x) => x.id === id);
    if (!e) return null;
    const b = entityBox(e);
    return tapAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  },
  spawn: (kind, variant, x, z) => spawn(kind, variant, x, z)?.id,
  seed: seedRandom,
  setManual(v) {
    manual = v;
  },
  step(dt = 1 / 60, n = 1) {
    for (let i = 0; i < n; i++) update(dt);
    render();
  },
  setTimeScale(v) {
    timeScale = v;
  },
  setSpawning(v) {
    S.spawnT = v ? 0 : 1e9;
  },
  drainEvents() {
    return events.splice(0);
  },
};

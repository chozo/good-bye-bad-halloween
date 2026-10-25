// 効果音は Web Audio API で合成する。ユーザー操作のあとで init() する

let ac = null;
let master = null;
let muted = false;

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
  } catch {
    ac = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

function env(g, t0, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function noise(dur) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

function tone(type, f0, f1, dur, peak, delay = 0) {
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(g, t0, 0.005, dur, peak);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  // スパーン！
  harisen() {
    const t0 = ac.currentTime;
    const n = noise(0.18);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.8;
    const g = ac.createGain();
    env(g, t0, 0.002, 0.16, 0.9);
    n.connect(bp).connect(g).connect(master);
    n.start(t0);
    tone('square', 900, 300, 0.06, 0.15);
  },
  // 仮装が脱げた
  bust() {
    tone('triangle', 520, 1040, 0.12, 0.25, 0.05);
    tone('triangle', 780, 1560, 0.12, 0.2, 0.13);
  },
  // 祟り
  curse() {
    const t0 = ac.currentTime;
    const o = ac.createOscillator();
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(440, t0);
    o.frequency.exponentialRampToValueAtTime(110, t0 + 1.0);
    lfo.frequency.value = 7;
    lg.gain.value = 25;
    lfo.connect(lg).connect(o.frequency);
    env(g, t0, 0.05, 1.0, 0.35);
    o.connect(g).connect(master);
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + 1.1);
    lfo.stop(t0 + 1.1);
  },
  // 普通の人を叩いた
  angry() {
    tone('square', 300, 180, 0.12, 0.18);
    tone('square', 300, 180, 0.12, 0.18, 0.15);
  },
  // 仮装を見逃した
  pass() {
    tone('sawtooth', 160, 120, 0.35, 0.22);
  },
  levelup() {
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.1, 0.18, i * 0.07));
  },
  gameover() {
    [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.98, 0.22, 0.22, i * 0.2));
  },
  // リプレイ開始（巻き戻し）
  rewind() {
    tone('sawtooth', 1200, 300, 0.25, 0.08);
    tone('sawtooth', 1000, 250, 0.25, 0.06, 0.08);
  },
  explain() {
    tone('triangle', 880, 880, 0.08, 0.15);
    tone('triangle', 1320, 1320, 0.12, 0.15, 0.08);
  },
  tap() {
    tone('sine', 600, 400, 0.05, 0.08);
  },
};

export function play(name) {
  if (!ac || muted) return;
  try {
    SOUNDS[name]?.();
  } catch {
    // 音が鳴らなくてもゲームは止めない
  }
}

// ---------------------------------------------------------------- BGM
// ポップで明るいループ（8小節）。音源ファイルは使わず、8分音符単位で少し先まで予約して鳴らす

const BGM = {
  volume: 0.5, // BGM 全体の音量（効果音より小さめ）
  duck: 0.35, // リプレイ中の音量の割合
  bpm: 136, // Lv1 のテンポ。レベルごとに bpmPerLevel 速くなる
  bpmPerLevel: 1,
  bpmMax: 156,
  ahead: 0.12, // 何秒先まで予約するか
};

const N = null; // 休符
const H = '-'; // 前の音を伸ばす
// コード（王道進行 IV-V-iii-vi → IV-V-I）。MIDI ノート番号
const CHORDS = [
  { root: 41, notes: [65, 69, 72] }, // F
  { root: 43, notes: [67, 71, 74] }, // G
  { root: 40, notes: [64, 67, 71] }, // Em
  { root: 45, notes: [69, 72, 76] }, // Am
  { root: 41, notes: [65, 69, 72] }, // F
  { root: 43, notes: [67, 71, 74] }, // G
  { root: 48, notes: [64, 67, 72] }, // C
  { root: 48, notes: [64, 67, 72] }, // C
];
// メロディ（1小節＝8分音符8つ）。2周目は終わり方を変える
const MELODY_A = [
  [69, 72, 77, N, 76, 77, 79, N],
  [79, H, 77, 76, 74, H, 71, 74],
  [76, H, 79, H, 76, 74, 72, 71],
  [72, H, H, 76, H, H, N, N],
  [69, 72, 77, N, 76, 77, 79, 81],
  [83, H, 81, 79, 77, H, 79, 81],
  [79, H, 76, H, 72, 74, 76, H],
  [72, H, H, H, N, 79, 81, 83],
];
const MELODY_B = MELODY_A.map((bar, i) => (i === 7 ? [84, H, H, H, N, N, N, N] : bar));

let bgm = null; // { gain, timer, step, next, bpm }
let noiseBuf = null;

const freq = (m) => 440 * 2 ** ((m - 69) / 12);

function getNoise() {
  if (!noiseBuf) {
    const len = Math.floor(ac.sampleRate * 0.3);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function note(out, type, m, t0, dur, peak, cutoff) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq(m);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.setValueAtTime(peak, t0 + Math.max(0.01, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = o;
  if (cutoff) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    node = o.connect(f);
  }
  node.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function drum(out, kind, t0) {
  if (kind === 'kick') {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    g.gain.setValueAtTime(0.9, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.2);
    return;
  }
  const snare = kind === 'snare';
  const src = ac.createBufferSource();
  src.buffer = getNoise();
  const f = ac.createBiquadFilter();
  f.type = snare ? 'bandpass' : 'highpass';
  f.frequency.value = snare ? 1800 : 7000;
  const g = ac.createGain();
  const peak = snare ? 0.45 : 0.12;
  const dur = snare ? 0.14 : 0.04;
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
  if (snare) note(out, 'triangle', 55, t0, 0.08, 0.15); // 胴鳴り
}

function scheduleStep(step, t0, len) {
  const out = bgm.gain;
  const bar = Math.floor(step / 8) % 8;
  const s = step % 8;
  const loop = Math.floor(step / 64) % 2;
  const ch = CHORDS[bar];
  // ドラム：キック 1・3拍と3拍の裏、スネア 2・4拍、ハイハット 8分
  if (s === 0 || s === 4 || s === 5) drum(out, 'kick', t0);
  if (s === 2 || s === 6) drum(out, 'snare', t0);
  drum(out, 'hat', t0 + (s % 2 ? 0 : len * 0.5));
  if (s % 2) drum(out, 'hat', t0);
  // ベース：ルートとオクターブ上を交互に
  note(out, 'square', ch.root + (s % 2 ? 12 : 0), t0, len * 0.85, 0.11, 700);
  // コード：裏拍で短く刻む
  if (s % 2) ch.notes.forEach((m) => note(out, 'triangle', m, t0, len * 0.7, 0.05));
  // メロディ
  const mel = (loop ? MELODY_B : MELODY_A)[bar];
  const m = mel[s];
  if (typeof m === 'number') {
    let n = 1;
    while (s + n < 8 && mel[s + n] === H) n++;
    note(out, 'square', m, t0, len * n * 0.92, 0.07, 3200);
    note(out, 'triangle', m + 12, t0, len * n * 0.6, 0.03); // きらきらした倍音
  }
}

function tick() {
  if (!bgm) return;
  const len = 60 / bgm.bpm / 2; // 8分音符の長さ
  while (bgm.next < ac.currentTime + BGM.ahead) {
    if (bgm.next < ac.currentTime - 0.2) bgm.next = ac.currentTime + 0.02; // 止まっていたら追いつかせない
    try {
      scheduleStep(bgm.step, bgm.next, len);
    } catch {
      // 音が鳴らなくてもゲームは止めない
    }
    bgm.step++;
    bgm.next += len;
  }
}

export function startBgm(level = 0) {
  if (!ac) return;
  stopBgm();
  const gain = ac.createGain();
  gain.gain.value = BGM.volume;
  gain.connect(master);
  bgm = { gain, step: 0, next: ac.currentTime + 0.1, bpm: BGM.bpm, timer: setInterval(tick, 25) };
  setBgmLevel(level);
  tick();
}

export function stopBgm() {
  if (!bgm) return;
  clearInterval(bgm.timer);
  const g = bgm.gain;
  const t = ac.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + 0.3);
  setTimeout(() => g.disconnect(), 600);
  bgm = null;
}

export function setBgmLevel(level) {
  if (bgm) bgm.bpm = Math.min(BGM.bpmMax, BGM.bpm + level * BGM.bpmPerLevel);
}

// リプレイ中は小さくする
export function duckBgm(on) {
  if (!bgm) return;
  const t = ac.currentTime;
  bgm.gain.gain.cancelScheduledValues(t);
  bgm.gain.gain.setValueAtTime(bgm.gain.gain.value, t);
  bgm.gain.gain.linearRampToValueAtTime(BGM.volume * (on ? BGM.duck : 1), t + 0.25);
}

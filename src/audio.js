// 効果音と BGM は Web Audio API で合成する。ユーザー操作のあとで initAudio() する
// どの音も「出力先の AudioContext」と「鳴らす時刻」を受け取る形にしてある。
// 普段はブラウザの AudioContext で今すぐ鳴らし、告知動画の書き出しでは OfflineAudioContext で同じ音を鳴らす

let ac = null;
let master = null;
let muted = false;
const MASTER = 0.5;

export function initAudio() {
  if (capturing) return; // 告知動画の撮影中は鳴らさない（呼び出しを記録するだけ）
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = muted ? 0 : MASTER;
    master.connect(ac.destination);
  } catch {
    ac = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : MASTER;
}
export const isMuted = () => muted;

// ---------------------------------------------------------------- 効果音

// 鳴らす先（X: AudioContext、OUT: つなぐ先、T0: 鳴らし始める時刻）。SOUNDS の中だけで使う
let X = null;
let OUT = null;
let T0 = 0;

function env(g, t0, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function noise(dur) {
  const len = Math.floor(X.sampleRate * dur);
  const buf = X.createBuffer(1, len, X.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = X.createBufferSource();
  src.buffer = buf;
  return src;
}

function tone(type, f0, f1, dur, peak, delay = 0) {
  const t0 = T0 + delay;
  const o = X.createOscillator();
  const g = X.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(g, t0, 0.005, dur, peak);
  o.connect(g).connect(OUT);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  // スパーン！
  harisen() {
    const t0 = T0;
    const n = noise(0.18);
    const bp = X.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.8;
    const g = X.createGain();
    env(g, t0, 0.002, 0.16, 0.9);
    n.connect(bp).connect(g).connect(OUT);
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
    const t0 = T0;
    const o = X.createOscillator();
    const lfo = X.createOscillator();
    const lg = X.createGain();
    const g = X.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(440, t0);
    o.frequency.exponentialRampToValueAtTime(110, t0 + 1.0);
    lfo.frequency.value = 7;
    lg.gain.value = 25;
    lfo.connect(lg).connect(o.frequency);
    env(g, t0, 0.05, 1.0, 0.35);
    o.connect(g).connect(OUT);
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

function renderSfx(ctx, out, name, when) {
  X = ctx;
  OUT = out;
  T0 = when;
  SOUNDS[name]?.();
}

export function play(name) {
  if (capturing) {
    queue.push({ name, args: [] });
    return;
  }
  if (!ac || muted) return;
  try {
    renderSfx(ac, master, name, ac.currentTime);
  } catch {
    // 音が鳴らなくてもゲームは止めない
  }
}

// ---------------------------------------------------------------- BGM
// ポップで明るいループ（8小節）。音源ファイルは使わず、8分音符単位で少し先まで予約して鳴らす

const BGM = {
  volume: 0.5, // BGM 全体の音量（効果音より小さめ）
  promoVolume: 0.62, // 告知動画に書き出すときの音量（プレー中も聞こえるよう少し大きく）
  duck: 0.35, // リプレイ中の音量の割合
  bpm: 136, // Lv1 のテンポ。レベルごとに bpmPerLevel 速くなる
  bpmPerLevel: 1,
  bpmMax: 156,
  ahead: 0.12, // 何秒先まで予約するか
};
const bpmFor = (level) => Math.min(BGM.bpmMax, BGM.bpm + level * BGM.bpmPerLevel);

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

const freq = (m) => 440 * 2 ** ((m - 69) / 12);
const noiseBufs = new WeakMap(); // AudioContext ごとのノイズ

// 予約した音源を集める先（書き出し時、テンポが変わったら先の音を取り消すため）
let REG = null;

function getNoise(ctx) {
  let b = noiseBufs.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 0.3);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(ctx, b);
  }
  return b;
}

function begin(src, t0, t1) {
  src.start(t0);
  src.stop(t1);
  if (REG) REG.push({ src, t0 });
}

function note(ctx, out, type, m, t0, dur, peak, cutoff) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq(m);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.setValueAtTime(peak, t0 + Math.max(0.01, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = o;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    node = o.connect(f);
  }
  node.connect(g).connect(out);
  begin(o, t0, t0 + dur + 0.02);
}

function drum(ctx, out, kind, t0) {
  if (kind === 'kick') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    g.gain.setValueAtTime(0.9, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.connect(g).connect(out);
    begin(o, t0, t0 + 0.2);
    return;
  }
  const snare = kind === 'snare';
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = snare ? 'bandpass' : 'highpass';
  f.frequency.value = snare ? 1800 : 7000;
  const g = ctx.createGain();
  const peak = snare ? 0.45 : 0.12;
  const dur = snare ? 0.14 : 0.04;
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out);
  begin(src, t0, t0 + dur + 0.02);
  if (snare) note(ctx, out, 'triangle', 55, t0, 0.08, 0.15); // 胴鳴り
}

function scheduleStep(ctx, out, step, t0, len) {
  const bar = Math.floor(step / 8) % 8;
  const s = step % 8;
  const loop = Math.floor(step / 64) % 2;
  const ch = CHORDS[bar];
  // ドラム：キック 1・3拍と3拍の裏、スネア 2・4拍、ハイハット 8分
  if (s === 0 || s === 4 || s === 5) drum(ctx, out, 'kick', t0);
  if (s === 2 || s === 6) drum(ctx, out, 'snare', t0);
  drum(ctx, out, 'hat', t0 + (s % 2 ? 0 : len * 0.5));
  if (s % 2) drum(ctx, out, 'hat', t0);
  // ベース：ルートとオクターブ上を交互に
  note(ctx, out, 'square', ch.root + (s % 2 ? 12 : 0), t0, len * 0.85, 0.11, 700);
  // コード：裏拍で短く刻む
  if (s % 2) ch.notes.forEach((m) => note(ctx, out, 'triangle', m, t0, len * 0.7, 0.05));
  // メロディ
  const mel = (loop ? MELODY_B : MELODY_A)[bar];
  const m = mel[s];
  if (typeof m === 'number') {
    let n = 1;
    while (s + n < 8 && mel[s + n] === H) n++;
    note(ctx, out, 'square', m, t0, len * n * 0.92, 0.07, 3200);
    note(ctx, out, 'triangle', m + 12, t0, len * n * 0.6, 0.03); // きらきらした倍音
  }
}

// ---- 普段の再生（ブラウザの AudioContext で、少し先まで予約し続ける）

let bgm = null; // { gain, timer, step, next, bpm }
// いまの BGM の状態（告知動画で、撮らずに進めた区間のあとに合わせ直すのに使う）
const logical = { playing: false, level: 0, ducked: false };

function tick() {
  if (!bgm) return;
  const len = 60 / bgm.bpm / 2; // 8分音符の長さ
  while (bgm.next < ac.currentTime + BGM.ahead) {
    if (bgm.next < ac.currentTime - 0.2) bgm.next = ac.currentTime + 0.02; // 止まっていたら追いつかせない
    try {
      scheduleStep(ac, bgm.gain, bgm.step, bgm.next, len);
    } catch {
      // 音が鳴らなくてもゲームは止めない
    }
    bgm.step++;
    bgm.next += len;
  }
}

export function startBgm(level = 0) {
  Object.assign(logical, { playing: true, level, ducked: false });
  if (capturing) {
    queue.push({ name: 'bgm', args: ['start', level] });
    return;
  }
  if (!ac) return;
  stopLive();
  const gain = ac.createGain();
  gain.gain.value = BGM.volume;
  gain.connect(master);
  bgm = { gain, step: 0, next: ac.currentTime + 0.1, bpm: bpmFor(level), timer: setInterval(tick, 25) };
  tick();
}

function stopLive() {
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

export function stopBgm() {
  logical.playing = false;
  if (capturing) {
    queue.push({ name: 'bgm', args: ['stop'] });
    return;
  }
  stopLive();
}

export function setBgmLevel(level) {
  logical.level = level;
  if (capturing) {
    queue.push({ name: 'bgm', args: ['level', level] });
    return;
  }
  if (bgm) bgm.bpm = bpmFor(level);
}

// リプレイ中は小さくする
export function duckBgm(on) {
  logical.ducked = on;
  if (capturing) {
    queue.push({ name: 'bgm', args: ['duck', on] });
    return;
  }
  if (!bgm) return;
  const t = ac.currentTime;
  bgm.gain.gain.cancelScheduledValues(t);
  bgm.gain.gain.setValueAtTime(bgm.gain.gain.value, t);
  bgm.gain.gain.linearRampToValueAtTime(BGM.volume * (on ? BGM.duck : 1), t + 0.25);
}

// ---------------------------------------------------------------- 告知動画の書き出し用
// 撮影中は音を鳴らさず、呼び出しを記録する。書き出し時に render() で同じ音を OfflineAudioContext に鳴らす

let capturing = false;
let queue = [];
const outs = new WeakMap(); // ctx ごとの { master, bgm }

function outFor(ctx) {
  let o = outs.get(ctx);
  if (!o) {
    const m = ctx.createGain();
    m.gain.value = MASTER;
    m.connect(ctx.destination);
    o = { master: m, bgm: null };
    outs.set(ctx, o);
  }
  return o;
}

// 書き出し用の BGM。テンポが変わったら、その先に予約した音を取り消して新しいテンポで予約し直す
function renderBgm(ctx, o, cmd, arg, when) {
  const end = ctx.length / ctx.sampleRate;
  let b = o.bgm;
  if (!b) {
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(o.master);
    b = o.bgm = { bus, playing: false, level: 0, ducked: false, seg: null };
  }
  const vol = () => BGM.promoVolume * (b.ducked ? BGM.duck : 1);
  // いま流れている区間を時刻 t で打ち切る。続きのコマ番号を返す
  const cut = (t, fade) => {
    const s = b.seg;
    if (!s) return 0;
    const k = Math.max(0, Math.ceil((t - s.t0) / s.len - 1e-6));
    for (const r of s.reg) if (r.t0 >= s.t0 + k * s.len - 1e-6) r.src.stop(r.t0);
    if (fade) {
      s.gain.gain.setValueAtTime(1, t);
      s.gain.gain.linearRampToValueAtTime(0, t + 0.3);
    }
    b.seg = null;
    return { step: s.step0 + k, at: s.t0 + k * s.len };
  };
  const play = (step, t) => {
    const gain = ctx.createGain();
    gain.connect(b.bus);
    const len = 60 / bpmFor(b.level) / 2;
    const seg = { gain, t0: t, len, step0: step, reg: [] };
    REG = seg.reg;
    for (let i = 0, tt = t; tt < end; i++, tt += len) scheduleStep(ctx, gain, step + i, tt, len);
    REG = null;
    b.seg = seg;
  };
  const setVol = () => {
    b.bus.gain.setValueAtTime(b.bus.gain.value, when);
    b.bus.gain.linearRampToValueAtTime(vol(), when + 0.25);
  };
  if (cmd === 'start') {
    cut(when, true);
    Object.assign(b, { playing: true, level: arg ?? 0, ducked: false });
    b.bus.gain.setValueAtTime(vol(), when);
    play(0, when + 0.05);
  } else if (cmd === 'stop') {
    cut(when, true);
    b.playing = false;
  } else if (cmd === 'level') {
    b.level = arg;
    if (b.playing && b.seg) {
      const c = cut(when, false);
      play(c.step, c.at);
    }
  } else if (cmd === 'duck') {
    b.ducked = !!arg;
    setVol();
  } else if (cmd === 'state') {
    // 撮らずに進めた区間のあと：流れているべきなら流し、テンポと音量を合わせる
    const st = arg || {};
    if (!st.playing) {
      if (b.playing) cut(when, true);
      b.playing = false;
      return;
    }
    const tempoChanged = st.level !== b.level;
    b.level = st.level;
    b.ducked = !!st.ducked;
    if (!b.playing || !b.seg) {
      b.playing = true;
      b.bus.gain.setValueAtTime(vol(), when);
      play(0, when);
    } else {
      if (tempoChanged) {
        const c = cut(when, false);
        play(c.step, c.at);
      }
      setVol();
    }
  }
}

export const promoAudio = {
  capture(on) {
    capturing = !!on;
    queue = [];
    if (on && bgm) stopLive();
  },
  drain() {
    const q = queue;
    queue = [];
    return q;
  },
  // いまの BGM の状態をまとめて記録する（撮らずに進めた区間のあとに台本から呼ぶ）
  resync() {
    if (capturing) queue.push({ name: 'bgm', args: ['state', { ...logical }] });
  },
  render(ctx, name, args = [], when = 0) {
    const o = outFor(ctx);
    if (name === 'bgm') renderBgm(ctx, o, args[0], args[1], when);
    else renderSfx(ctx, o.master, name, when);
  },
};

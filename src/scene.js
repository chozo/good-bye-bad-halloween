// 渋谷スクランブル交差点の3D背景（道玄坂側から渋谷駅を向く）。動かない部分は一度だけ描いてキャッシュする
import { CONFIG as C } from './config.js';

const W = C.width;
const H = C.height;
const F = C.camera.focal;
const CAM_H = C.camera.height;
const HZ = C.camera.horizonY;
const CX = W / 2;

// 3D → 画面
export function project(x, z, y = 0) {
  return [CX + (F * x) / z, HZ + (F * (CAM_H - y)) / z];
}

function quad(ctx, pts, fill) {
  ctx.beginPath();
  pts.forEach(([x, z, y], i) => {
    const [sx, sy] = project(x, z, y || 0);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// z 一定の面（カメラ正面を向いた壁）上の長方形
function faceRect(ctx, x0, x1, y0, y1, z, fill) {
  quad(ctx, [[x0, z, y0], [x1, z, y0], [x1, z, y1], [x0, z, y1]], fill);
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function windows(ctx, x0, x1, y0, y1, z, rand, { cw = 1.6, ch = 1.6, on = 0.45 } = {}) {
  for (let y = y0 + 1; y < y1 - 1; y += 3) {
    for (let x = x0 + 0.8; x < x1 - 1; x += 2.4) {
      if (rand() < on) faceRect(ctx, x, x + cw, y, y + ch, z, rand() < 0.25 ? '#ffb347' : '#ffe9a8');
    }
  }
}

function text(ctx, str, x, y, z, sizeM, color, { font = 'sans-serif', weight = '900', align = 'center' } = {}) {
  const [sx, sy] = project(x, z, y);
  const px = (F * sizeM) / z;
  ctx.font = `${weight} ${px}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, sx, sy);
}

// ---------------------------------------------------------------- 建物の配置
// 道玄坂側から渋谷駅（ハチ公口）の方を向いた景色。人は駅から道玄坂へ向かって歩いてくる

const ZF = 55; // 交差点の向こう側のビルの正面
const Z_RAIL = 64; // 山手線の高架
const Z_STA = 72; // 駅舎の正面
const RAIL = { y0: 6.6, y1: 7.8 }; // 高架の床（上面に電車が乗る）
export const SCREENS = {
  // 左のビルの横長ビジョン（文言が流れる）
  message: { x0: -20.5, x1: -11, y0: 13, y1: 20, z: ZF },
  // 右のビルの大型ビジョン
  big: { x0: 11, x1: 19, y0: 7.5, y1: 19, z: ZF },
};

export function makeScene(scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale);
  cv.height = Math.round(H * scale);
  const ctx = cv.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const rand = mulberry(108);

  // 空
  const sky = ctx.createLinearGradient(0, 0, 0, HZ + 40);
  sky.addColorStop(0, '#0b0620');
  sky.addColorStop(1, '#4a2266');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HZ + 40);
  // 月
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(232, 112, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0e33';
  ctx.beginPath();
  ctx.arc(240, 107, 18, 0, Math.PI * 2);
  ctx.fill();

  // 地面（全体）
  const [, gy] = project(0, 200);
  const road = ctx.createLinearGradient(0, gy, 0, H);
  road.addColorStop(0, '#1d1a26');
  road.addColorStop(1, '#3b3946');
  ctx.fillStyle = road;
  ctx.fillRect(0, gy - 2, W, H - gy + 2);

  // 遠くのビル群（z=170）
  for (let x = -80; x < 80; ) {
    const w = 7 + rand() * 12;
    const h = 16 + rand() * 30;
    faceRect(ctx, x, x + w, 0, h, 170, rand() < 0.5 ? '#170f2c' : '#1f1538');
    windows(ctx, x, x + w, 0, h, 170, rand, { on: 0.22 });
    x += w + 0.5;
  }

  // 駅の上にそびえる高層タワー
  drawTower(ctx, rand);

  // 渋谷駅
  drawStation(ctx, rand);

  // 山手線の高架（電車は毎フレーム drawScreens で描く）
  faceRect(ctx, -60, 60, RAIL.y0, RAIL.y1, Z_RAIL, '#4b4658');
  faceRect(ctx, -60, 60, RAIL.y0 - 0.5, RAIL.y0, Z_RAIL, '#2a2636');
  for (let x = -58.5; x < 60; x += 9) faceRect(ctx, x, x + 1.1, 0, RAIL.y0, Z_RAIL, '#3a3548');
  faceRect(ctx, -2.5, 2.5, RAIL.y0 + 0.1, RAIL.y1 - 0.1, Z_RAIL - 0.1, '#2f8f3a');
  text(ctx, 'JR 山手線', 0, (RAIL.y0 + RAIL.y1) / 2, Z_RAIL - 0.1, 0.8, '#ffffff');

  // ハチ公広場（駅前の石畳と木）
  quad(ctx, [[-12, ZF, 0], [12, ZF, 0], [12, Z_STA, 0], [-12, Z_STA, 0]], '#34303f');
  for (let z = ZF + 1; z < Z_STA; z += 2) {
    quad(ctx, [[-12, z, 0], [12, z, 0], [12, z + 0.12, 0], [-12, z + 0.12, 0]], 'rgba(255,255,255,0.05)');
  }
  [[-9.5, 60], [-6.5, 63], [7.5, 61], [10, 64]].forEach(([x, z]) => drawTree(ctx, x, z));
  drawHachiko(ctx, -4, 58);

  // 駅前の人だかり
  crowd(ctx, rand, 40, -10, 10, 59, 70);

  // 正面のビル群
  // 左：横長ビジョンのビル
  faceRect(ctx, -23, -10, 0, 26, ZF, '#2a2044');
  windows(ctx, -23, -10, 0, 12, ZF, rand, { on: 0.55 });
  windows(ctx, -23, -10, 21, 26, ZF, rand, { on: 0.55 });
  faceRect(ctx, -21, -10.5, 12.5, 20.5, ZF, '#0d0d12');
  // 赤いネオンの縦看板
  faceRect(ctx, -9.6, -8.2, 8, 24, ZF - 1, '#5a0d1a');
  ['渋', '谷'].forEach((ch, i) => text(ctx, ch, -8.9, 20.5 - i * 4.5, ZF - 1, 2.6, '#ff4d6d'));

  // 右：大型ビジョンのビル
  faceRect(ctx, 10, 24, 0, 27, ZF, '#271d40');
  windows(ctx, 10, 24, 0, 6.5, ZF, rand, { on: 0.55 });
  faceRect(ctx, 10.5, 19.5, 6.9, 19.6, ZF, '#0a0a0f'); // ビジョンの枠
  faceRect(ctx, 10.6, 19.4, 20.4, 25.6, ZF, '#ff8a1f');
  text(ctx, 'HALLOWEEN', 15, 24.3, ZF, 1.3, '#2a1000');
  text(ctx, '自粛中', 15, 21.8, ZF, 2.0, '#2a1000');

  // 歩道（向こう側）
  quad(ctx, [[-30, 49, 0], [30, 49, 0], [30, ZF, 0], [-30, ZF, 0]], '#4a4656');
  // 信号待ちの群衆（駅から来て道玄坂へ渡る人たち）
  crowd(ctx, rand, 70, -22, 22, 50, 54);

  // 横断歩道：手前から奥へ（縞は左右に長く、奥へ行くほど詰まって見える）
  for (let z = 4.2; z < 30; z += 1.1) {
    const a = Math.min(0.3, 0.1 + z * 0.012); // 手前ほど控えめにして人物を目立たせる
    quad(ctx, [[-6.5, z, 0], [6.5, z, 0], [6.5, z + 0.55, 0], [-6.5, z + 0.55, 0]], `rgba(235,235,245,${a})`);
  }
  // 奥の横断歩道（左右方向）
  for (let x = -24; x < 24; x += 1.2) {
    quad(ctx, [[x, 41, 0], [x + 0.6, 41, 0], [x + 0.6, 46, 0], [x, 46, 0]], 'rgba(235,235,245,0.28)');
  }
  // スクランブルの斜め横断歩道（X字）
  diagonalCrossing(ctx, [-15, 40], [9, 9]);
  diagonalCrossing(ctx, [15, 40], [-9, 9]);

  return cv;
}

function crowd(ctx, rand, n, xa, xb, za, zb) {
  const people = [];
  for (let i = 0; i < n; i++) people.push([xa + rand() * (xb - xa), za + rand() * (zb - za), 1.5 + rand() * 0.3, Math.floor(rand() * 4)]);
  people.sort((a, b) => b[1] - a[1]); // 奥から描く
  for (const [x, z, h, c] of people) {
    const [sx, sy] = project(x, z, 0);
    const [, ty] = project(x, z, h);
    ctx.fillStyle = ['#0e0a18', '#1a1328', '#3a1d2a', '#2a2a44'][c];
    ctx.beginPath();
    ctx.roundRect(sx - (sy - ty) * 0.17, ty, (sy - ty) * 0.34, sy - ty, 2);
    ctx.fill();
  }
}

function diagonalCrossing(ctx, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const nx = -uz;
  const nz = ux;
  for (let d = 0; d < len; d += 1.1) {
    const cx = a[0] + ux * d;
    const cz = a[1] + uz * d;
    const p = (s, t) => [cx + ux * s + nx * t, cz + uz * s + nz * t, 0];
    quad(ctx, [p(0, -2), p(0, 2), p(0.55, 2), p(0.55, -2)], 'rgba(235,235,245,0.16)');
  }
}

// 駅の上の高層タワー（段々の頂部と屋上の展望台の光）
function drawTower(ctx, rand) {
  const z = 150;
  const x0 = 2;
  const x1 = 17;
  faceRect(ctx, x0, x1, 0, 60, z, '#1b2340');
  // 縦のガラスの筋
  for (let x = x0 + 0.7; x < x1; x += 1.4) faceRect(ctx, x, x + 0.25, 0, 60, z, 'rgba(140,180,255,0.16)');
  // 窓の明かり（横の帯）
  for (let y = 4; y < 59; y += 2.2) {
    for (let x = x0 + 0.5; x < x1 - 0.5; x += 1.4) {
      if (rand() < 0.35) faceRect(ctx, x, x + 1.0, y, y + 0.9, z, rand() < 0.3 ? '#ffd88a' : '#cfe3ff');
    }
  }
  // 段々になった頂部
  faceRect(ctx, x0 + 1.5, x1 - 1.5, 60, 64, z, '#222b4c');
  faceRect(ctx, x0 + 3, x1 - 3, 64, 67, z, '#2a3458');
  // 屋上の展望台の光
  faceRect(ctx, x0 + 3, x1 - 3, 66.4, 67, z, '#9ff3ff');
  const [cx, cy] = project((x0 + x1) / 2, z, 67);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
  glow.addColorStop(0, 'rgba(160,240,255,0.35)');
  glow.addColorStop(1, 'rgba(160,240,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 40, cy - 40, 80, 80);
  // 航空障害灯
  ctx.fillStyle = '#ff3d3d';
  ctx.beginPath();
  ctx.arc(cx, project(0, z, 68.5)[1], 2, 0, Math.PI * 2);
  ctx.fill();
}

// 渋谷駅の駅舎（ハチ公口）
function drawStation(ctx, rand) {
  const z = Z_STA;
  faceRect(ctx, -40, 40, 0, 17, z, '#3a3448');
  windows(ctx, -40, 40, 8, 16, z, rand, { on: 0.5 });
  faceRect(ctx, -40, 40, 16.6, 17.2, z, '#5a536c');
  // 駅名の看板（ロゴではなく普通の文字で書く）
  faceRect(ctx, -8, 8, 12, 15.4, z - 0.1, '#f4f4f0');
  faceRect(ctx, -8, -5.4, 12, 15.4, z - 0.1, '#2f8f3a');
  text(ctx, 'JR', -6.7, 13.7, z - 0.1, 1.5, '#ffffff');
  text(ctx, '渋谷駅', 1.3, 14.1, z - 0.1, 2.3, '#1a1a1a');
  text(ctx, 'SHIBUYA STATION', 1.3, 12.6, z - 0.1, 0.6, '#444444', { weight: '700' });
  // 高架の下の明るい改札口
  faceRect(ctx, -9, 9, 0, RAIL.y0 - 0.5, z - 0.1, '#ffe2a6');
  for (let x = -8; x < 9; x += 2) faceRect(ctx, x, x + 0.25, 0, 2.2, z - 0.15, '#6b5a3a');
  faceRect(ctx, -4, 4, 4.6, 5.8, z - 0.2, '#14284a');
  text(ctx, 'ハチ公口', 0, 5.2, z - 0.2, 0.9, '#ffffff');
}

function drawTree(ctx, x, z) {
  const [sx, sy] = project(x, z, 0);
  const k = F / z; // 1m のピクセル数
  ctx.fillStyle = '#2a1f24';
  ctx.fillRect(sx - 0.2 * k, sy - 3.2 * k, 0.4 * k, 3.2 * k);
  ctx.fillStyle = '#1c3a2c';
  [[0, 4.6, 1.9], [-1.1, 3.8, 1.3], [1.1, 3.9, 1.4]].forEach(([dx, dy, r]) => {
    ctx.beginPath();
    ctx.arc(sx + dx * k, sy - dy * k, r * k, 0, Math.PI * 2);
    ctx.fill();
  });
  // 電飾
  ctx.fillStyle = '#ffcf6b';
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    ctx.fillRect(sx + Math.cos(a) * 1.3 * k, sy - (4.2 + Math.sin(a) * 1.2) * k, 1.5, 1.5);
  }
}

// ハチ公像（かぼちゃの帽子付き）。見えるように少し大きめに描く
function drawHachiko(ctx, x, z) {
  const [sx, sy] = project(x, z, 0);
  const k = (F / z) * 1.6;
  // 台座
  ctx.fillStyle = '#6a6474';
  ctx.fillRect(sx - 0.9 * k, sy - 1.3 * k, 1.8 * k, 1.3 * k);
  ctx.fillStyle = '#7d7788';
  ctx.fillRect(sx - 1.0 * k, sy - 1.4 * k, 2.0 * k, 0.15 * k);
  const by = sy - 1.4 * k;
  ctx.fillStyle = '#4f5a4c';
  // 胴（おすわり）
  ctx.beginPath();
  ctx.ellipse(sx + 0.1 * k, by - 0.45 * k, 0.5 * k, 0.45 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  // 前足
  ctx.fillRect(sx - 0.35 * k, by - 0.6 * k, 0.16 * k, 0.6 * k);
  // 頭
  ctx.beginPath();
  ctx.ellipse(sx - 0.3 * k, by - 1.05 * k, 0.3 * k, 0.26 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  // 鼻先
  ctx.beginPath();
  ctx.ellipse(sx - 0.58 * k, by - 0.98 * k, 0.16 * k, 0.11 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  // 耳
  ctx.beginPath();
  ctx.moveTo(sx - 0.2 * k, by - 1.25 * k);
  ctx.lineTo(sx - 0.08 * k, by - 1.5 * k);
  ctx.lineTo(sx - 0.02 * k, by - 1.2 * k);
  ctx.fill();
  // かぼちゃの帽子
  ctx.fillStyle = '#ff8a1f';
  ctx.beginPath();
  ctx.ellipse(sx - 0.32 * k, by - 1.36 * k, 0.2 * k, 0.13 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a7a2a';
  ctx.fillRect(sx - 0.34 * k, by - 1.56 * k, 0.05 * k, 0.12 * k);
}

// ---------------------------------------------------------------- 毎フレーム描く部分（ビジョン）

// 山手線の電車。左右のビル（z=55）より奥なので、ビルの間だけに見せる
function drawTrain(ctx, t) {
  const period = 13;
  const speed = 20; // m/秒
  const head = -30 + (t % period) * speed; // 先頭の x
  const carLen = 19;
  const cars = 5;
  const [clipL] = project(-8.2, ZF, 0);
  const [clipR] = project(10, ZF, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(clipL, 0, clipR - clipL, H);
  ctx.clip();
  const z = Z_RAIL;
  const y0 = RAIL.y1;
  for (let i = 0; i < cars; i++) {
    const x1 = head - i * (carLen + 0.6);
    const x0 = x1 - carLen;
    const [sx0, sy1] = project(x0, z, y0);
    const [sx1, sy0] = project(x1, z, y0 + 3.4);
    if (sx1 < clipL || sx0 > clipR) continue;
    const w = sx1 - sx0;
    const h = sy1 - sy0;
    ctx.fillStyle = '#c9ccd4';
    ctx.beginPath();
    ctx.roundRect(sx0, sy0, w, h, i === 0 ? [0, h * 0.35, 0, 0] : 2);
    ctx.fill();
    // 黄緑の帯
    ctx.fillStyle = '#9acd32';
    ctx.fillRect(sx0, sy0 + h * 0.66, w, h * 0.16);
    // 窓
    ctx.fillStyle = '#ffeebb';
    for (let k = 0; k < 6; k++) ctx.fillRect(sx0 + w * (0.06 + k * 0.155), sy0 + h * 0.18, w * 0.1, h * 0.36);
  }
  // 高架の手すり（電車の足元を隠す）
  const [, py0] = project(0, z - 0.2, y0 + 0.7);
  const [, py1] = project(0, z - 0.2, y0);
  ctx.fillStyle = '#58526a';
  ctx.fillRect(clipL, py0, clipR - clipL, py1 - py0);
  ctx.restore();
}

export function drawScreens(ctx, t, message) {
  drawTrain(ctx, t);
  // 横長ビジョン：文言
  const m = SCREENS.message;
  const [x0, y0] = project(m.x0, m.z, m.y1);
  const [x1, y1] = project(m.x1, m.z, m.y0);
  ctx.save();
  ctx.fillStyle = '#06263a';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  let fs = 22;
  ctx.font = `bold ${fs}px sans-serif`;
  while (ctx.measureText(message).width > (x1 - x0) - 8 && fs > 9) {
    fs--;
    ctx.font = `bold ${fs}px sans-serif`;
  }
  ctx.fillStyle = '#7ff7ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, (x0 + x1) / 2, (y0 + y1) / 2);
  ctx.restore();

  // 右のビルの大型ビジョン：かぼちゃが跳ねる
  const b = SCREENS.big;
  const [bx0, by0] = project(b.x0, b.z, b.y1);
  const [bx1, by1] = project(b.x1, b.z, b.y0);
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  ctx.save();
  const g = ctx.createLinearGradient(0, by0, 0, by1);
  g.addColorStop(0, '#3a0d5c');
  g.addColorStop(1, '#ff6a00');
  ctx.fillStyle = g;
  ctx.fillRect(bx0, by0, bw, bh);
  ctx.beginPath();
  ctx.rect(bx0, by0, bw, bh);
  ctx.clip();
  const px = bx0 + bw / 2;
  const py = by0 + bh * 0.42 - Math.abs(Math.sin(t * 3)) * bh * 0.12;
  const pr = bw * 0.28;
  ctx.fillStyle = '#ff8c1a';
  ctx.beginPath();
  ctx.ellipse(px, py, pr * 1.15, pr, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1300';
  ctx.beginPath();
  ctx.moveTo(px - pr * 0.6, py - pr * 0.25);
  ctx.lineTo(px - pr * 0.2, py - pr * 0.25);
  ctx.lineTo(px - pr * 0.4, py + pr * 0.05);
  ctx.moveTo(px + pr * 0.6, py - pr * 0.25);
  ctx.lineTo(px + pr * 0.2, py - pr * 0.25);
  ctx.lineTo(px + pr * 0.4, py + pr * 0.05);
  ctx.fill();
  ctx.fillRect(px - pr * 0.55, py + pr * 0.3, pr * 1.1, pr * 0.18);
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${Math.round(bw * 0.17)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('渋谷', px, by0 + bh * 0.78);
  ctx.font = `900 ${Math.round(bw * 0.11)}px sans-serif`;
  ctx.fillText(Math.floor(t * 2) % 2 ? 'HALLOWEEN?' : '仮装パトロール中', px, by0 + bh * 0.9);
  ctx.restore();
}

export function drawLine(ctx, t) {
  // 規制線（黄色と黒のテープ）を地面に描く
  const z = C.zLine;
  const [, y] = project(0, z);
  ctx.save();
  ctx.fillStyle = '#f5c400';
  ctx.fillRect(0, y - 7, W, 14);
  ctx.beginPath();
  ctx.rect(0, y - 7, W, 14);
  ctx.clip();
  ctx.fillStyle = '#111';
  const off = (t * 20) % 32;
  for (let x = -32 + off; x < W + 32; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x + 12, y - 7);
    ctx.lineTo(x + 24, y - 7);
    ctx.lineTo(x + 12, y + 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#f5c400';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 86, y - 8, 172, 16, 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('この先 道玄坂　仮装 立入禁止', W / 2, y + 0.5);
}

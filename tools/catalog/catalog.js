// キャラクター一覧（仮装・普通の人・参考の本物のお化け）を描く。tools/catalog.mjs が撮影する
import { drawHuman, drawGhost, monsterLook } from '../../src/draw.js';
import { CONFIG as C } from '../../src/config.js';

const DPR = 2;
const UNIT = 120 / C.personHeight;
// ゲームと同じ、奥行き z での人物の大きさ
const scaleAt = (z) => (C.camera.focal / (z * UNIT)) * C.personScale;

// src/game.js の NORMAL_LOOKS と同じ値
const NORMAL_LOOKS = {
  salaryman: { top: '#2c3e66', pants: '#2c3e66', shoes: '#1a1a1a' },
  student: { top: '#1f2a44', pants: '#1f2a44', shoes: '#333' },
  tourist: { top: '#f2c14e', pants: '#a68a64', shoes: '#fff' },
  ol: { top: '#c8b49a', pants: '#333', shoes: '#5b2c2c' },
};
// 仮装した人の素の服（実際は上着・ズボン・スニーカーの色がランダム）
const COSTUME_BASE = { skin: '#f1c9a5', hair: '#4a3020', top: '#7a8a99', pants: '#33475e', shoes: '#e53935' };

function entity(kind, variant, extra = {}) {
  const monster = kind === 'ghost' && !['sheet', 'yurei', 'ochimusha'].includes(variant);
  const look = monster
    ? monsterLook(variant)
    : kind === 'normal'
      ? { skin: '#f1c9a5', hair: '#222', ...NORMAL_LOOKS[variant] }
      : { ...COSTUME_BASE };
  return { kind, variant, monster, phase: 1, seed: 1, hemY: -22, ghostAlpha: 0.6, eyeGlow: 1, glide: false, props: {}, look, ...extra };
}

function drawOne(g, e, x, y, s) {
  g.save();
  if (e.kind === 'ghost' && !e.monster) {
    g.translate(x, y - 14 * s);
    g.scale(s, s);
    g.globalAlpha = e.ghostAlpha;
    drawGhost(g, e, 0.5);
  } else {
    g.translate(x, y);
    g.scale(s, s);
    drawHuman(g, e);
  }
  g.restore();
}

// 輪郭だけ（半透明の影は除く）
function silhouette(e, s, w, h, baseY) {
  const c = document.createElement('canvas');
  c.width = w * DPR;
  c.height = h * DPR;
  const g = c.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawOne(g, { ...e, ghostAlpha: 1 }, w / 2, baseY, s);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] > 205;
    d[i] = 225; d[i + 1] = 218; d[i + 2] = 255; d[i + 3] = on ? 255 : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const CW = 232;
const CH = 196;
const GROUND = 176;

function cardCanvas(e) {
  const c = document.createElement('canvas');
  c.width = CW * DPR;
  c.height = CH * DPR;
  c.style.aspectRatio = `${CW} / ${CH}`;
  const g = c.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#120a22';
  g.fillRect(0, 0, CW, CH);
  g.fillStyle = '#2b2836';
  g.fillRect(0, GROUND - 6, CW, CH - GROUND + 6);
  // 区切り
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(118, 8, 1, CH - 16);
  // 大
  drawOne(g, e, 60, GROUND, 1.1);
  // 中間（約20m）と出現直後（約34m）：ゲームと同じ大きさ
  drawOne(g, e, 142, GROUND, scaleAt(20));
  drawOne(g, e, 176, GROUND, scaleAt(34));
  // シルエット（約20m）
  const sw = 50;
  const sil = silhouette(e, scaleAt(20), sw, CH, GROUND);
  g.drawImage(sil, 206 - sw / 2, 0, sw, CH);
  return c;
}

function card(kind, variant, name, notes, extra) {
  const e = entity(kind, variant, extra);
  const div = document.createElement('div');
  div.className = `card ${kind}`;
  const tag = { normal: '普通の人', costume: '仮装', ghost: '本物' }[kind];
  div.innerHTML = `<h3><span class="tag">${tag}</span>${name}</h3>`;
  div.appendChild(cardCanvas(e));
  const cap = document.createElement('div');
  cap.className = 'cap';
  cap.innerHTML = '<span>大</span><span>約20m　約34m　輪郭</span>';
  div.appendChild(cap);
  const ul = document.createElement('ul');
  ul.innerHTML = notes.map((n) => (n.startsWith('!') ? `<li class="warn">${n.slice(1)}</li>` : `<li>${n}</li>`)).join('');
  div.appendChild(ul);
  return div;
}

function section(id, title, sub, note, cards) {
  const s = document.createElement('section');
  s.id = id;
  s.innerHTML = `<h2>${title}<small>${sub}</small></h2>${note ? `<p class="note">${note}</p>` : ''}`;
  const grid = document.createElement('div');
  grid.className = 'grid';
  cards.forEach((c) => grid.appendChild(card(...c)));
  s.appendChild(grid);
  document.getElementById('root').appendChild(s);
}

section('normal', '普通の人（4種）', '叩くとミス', '服と靴の色は種類ごとに固定。30%の確率でスマホを持つ。', [
  ['normal', 'salaryman', 'サラリーマン', ['紺のスーツ、白シャツ、赤いネクタイ', '茶色のカバン', '黒い革靴（白い靴底なし）', '!紺一色の体は、遠目には学生・ドラキュラの仮装と似る']],
  ['normal', 'student', '学生', ['紺の学ラン、金ボタン、詰襟', '濃いグレーの靴（白い靴底なし）', '!紺一色で特徴が小さく、遠目にはサラリーマンと区別しにくい']],
  ['normal', 'tourist', '観光客', ['首から下げたカメラ', '緑のリュック（体の両脇と肩の上からはみ出す）', '!赤い帽子（帽子＝仮装に見える）', '!黄色の上着（ハロウィンっぽい鮮やかな色）', '!白いスニーカー（白い靴底あり）。「スニーカーは仮装の証拠」と矛盾']],
  ['normal', 'ol', '会社員', ['ボブカット、口紅', 'ベージュのジャケットと紺のスカート（A ライン）、黒いタイツ', 'えんじ色のバッグと靴（白い靴底なし）', '!ベージュのジャケットは、遠目にはミイラの仮装と色が近い']],
]);

section('costume', '仮装（わかりやすい6種）', '叩くと成敗', '下はジーンズ系のズボンとスニーカー（白い靴底あり）。上着・ズボン・スニーカーの色はランダム。小物は別表。', [
  ['costume', 'pumpkin', 'かぼちゃ', ['かぼちゃの頭（輪郭が変わる）', 'オレンジのTシャツ', '目の穴は暗い（本物は光る）']],
  ['costume', 'witch', '魔女', ['とんがり帽子（輪郭が変わる）', '長い杖を両手で斜めに持つ（先に星）', '紫のローブ、オレンジのリボン']],
  ['costume', 'vampire', 'ドラキュラ', ['黒と赤のマント、立ち襟（輪郭が変わる）', '白塗りの顔、赤い蝶ネクタイ', '!マントを除くと黒い服で、遠目には学生・サラリーマンに近い']],
  ['costume', 'cat', '猫', ['猫耳としっぽ（輪郭が少し変わる）', '白いお腹、肉球手袋、ひげ', '!黒い服なので、遠目には耳としっぽだけが手がかり']],
  ['costume', 'frank', 'フランケン', ['緑の四角い顔、平らな黒髪', '額の縫い目、頭に刺さったボルト（輪郭が少し変わる）', 'つぎはぎの上着', '!体はグレーの普通の服']],
  ['costume', 'mummy', 'ミイラ', ['全身包帯、包帯のすき間に人間の目', '!輪郭は普通の人と同じ', '!ベージュ系で、遠目には会社員のジャケットと近い']],
]);

section('ghostlike', '仮装（幽霊っぽい3種）', 'Lv2 以降。叩くと成敗', '裾の下から足とスニーカーが見える。難易度が上がると裾が長くなり、最後は靴先だけになる（この図は中間の長さ）。', [
  ['costume', 'sheet', 'シーツおばけ', ['白い布、裾がまっすぐ', '裾の下に足とスニーカー']],
  ['costume', 'yurei', '幽霊（白装束）', ['白装束、長い黒髪、上向きの三角巾（本物は下向き）', '裾の下に足とスニーカー']],
  ['costume', 'ochimusha', '落ち武者', ['鎧、ザンバラ髪、矢', '草摺の下に足とスニーカー']],
]);

const props = [
  ['priceTag', '値札（¥980）'],
  ['bag', '激安の袋'],
  ['can', 'お酒の缶'],
];
section('props', '仮装の小物（3種）', '仮装した人だけが持つ', '持つ確率は Lv1 で70%、Lv7 で20%。普通の人はスマホ（右端）だけを持つことがある。', [
  ...props.map(([k, label]) => ['costume', 'vampire', `ドラキュラ＋${label}`, [`${label}を持つ`], { props: { [k]: true } }]),
  ['normal', 'salaryman', 'サラリーマン＋スマホ', ['普通の人もスマホを持つ', '!黒い四角は缶と遠目に似る'], { props: { phone: true } }],
]);

section('ghost', '参考：本物のお化け', '叩くとミス', '本物の証拠は、影がない・目が光る・足を動かさず滑る（一部）。昔ながらの幽霊は足がなく透けて浮く。靴やしっぽなど仮装でも真似できるものは証拠にしない。', [
  ['ghost', 'pumpkin', 'ジャック・オ・ランタン', ['目の穴が光る、ボロボロのマント']],
  ['ghost', 'witch', '魔女', ['わし鼻、白髪、光る目', '杖の先はねじれたこぶ']],
  ['ghost', 'vampire', 'ドラキュラ', ['口元の血、光る目']],
  ['ghost', 'cat', '化け猫', ['黄色く光る目']],
  ['ghost', 'frank', 'フランケン', ['光る目、暗い色のつぎはぎ']],
  ['ghost', 'mummy', 'ミイラ', ['ほどけた包帯、光る目']],
  ['ghost', 'sheet', 'おばけ', ['裾が波打つ、足がない、透ける']],
  ['ghost', 'yurei', '幽霊', ['足がない、透ける']],
  ['ghost', 'ochimusha', '落ち武者', ['足がない、透ける']],
]);

document.body.dataset.ready = '1';

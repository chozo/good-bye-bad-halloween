// キャラクターと背景の描画。座標は「足元が (0,0)、身長およそ 120」のローカル座標

const TAU = Math.PI * 2;

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function rrect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2, w, stroke) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---------------------------------------------------------------- 人間の素体

function drawShadow(ctx) {
  // 街灯の下の濃い影（人間の証拠）
  ellipse(ctx, 0, 0, 26, 7, 'rgba(0,0,0,0.6)');
  ellipse(ctx, 4, 1, 34, 8, 'rgba(0,0,0,0.22)');
}

function drawLegs(ctx, e, monster) {
  const sw = Math.sin(e.phase) * 6;
  line(ctx, -5, -42, -5 + sw, -5, 8, e.look.pants);
  line(ctx, 5, -42, 5 - sw, -5, 8, e.look.pants);
  if (monster) {
    // とがった黒いブーツ（靴底の白がない）
    for (const [fx, d] of [[-5 + sw, -1], [5 - sw, 1]]) {
      poly(ctx, [fx - 5, -1, fx - 5, -7, fx + 2, -7, fx + 5 + d * 4, -1], MONSTER_FEET[e.variant] || '#16121c');
    }
    return;
  }
  for (const fx of [-5 + sw, 5 - sw]) {
    ellipse(ctx, fx, -3.5, 6.5, 4, e.look.shoes);
    // スニーカーの白い靴底
    rrect(ctx, fx - 6.5, -1.8, 13, 2.6, 1.2, e.kind === 'normal' && e.look.shoes !== '#fff' ? 'rgba(0,0,0,0)' : '#fafafa');
  }
}

// 本物のお化けの見た目（肌の色・足元）
const MONSTER_SKIN = { vampire: '#bdb6cc', frank: '#5e8a46', witch: '#8fbf6a', cat: '#c9c9d6', mummy: '#ece6d6', pumpkin: '#2a1d14' };
const MONSTER_FEET = { mummy: '#d8d0bc', cat: '#3a3a48' };
const MONSTER_LOOK = {
  vampire: { pants: '#141018', top: '#2a0f1a' },
  frank: { pants: '#22222a', top: '#3a3a44' },
  witch: { pants: '#1a1022', top: '#3c1a5a' },
  cat: { pants: '#2a2a36', top: '#3a3a48' },
  mummy: { pants: '#d8d0bc', top: '#d8d0bc' },
  pumpkin: { pants: '#1a1210', top: '#2a1d14' },
};
export const LOOKALIKE = Object.keys(MONSTER_LOOK);
export function monsterLook(variant) {
  return { ...MONSTER_LOOK[variant], skin: MONSTER_SKIN[variant], shoes: MONSTER_FEET[variant] || '#16121c', hair: '#0b0b10' };
}

// 光る目（本物のお化けの証拠）。遠くからでも分かるよう、白く飛んだ芯・大きな光の輪・横に伸びる光の筋を重ねる
// strength はレベルで弱くなるが、芯は常に明るく見せる
function glowEyes(ctx, strength, y = -97, dx = 4.5, color = '255,60,40', pulse = 0) {
  if (strength <= 0) return;
  const k = (0.6 + 0.4 * strength) * (0.88 + 0.12 * Math.sin(pulse));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 顔のまわりの淡い光
  const aura = ctx.createRadialGradient(0, y, 0, 0, y, 26 * k);
  aura.addColorStop(0, `rgba(${color},${0.35 * k})`);
  aura.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, y, 26 * k, 0, TAU);
  ctx.fill();
  for (const x of [-dx, dx]) {
    // 光の輪
    const R = 12 * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(${color},1)`);
    g.addColorStop(0.4, `rgba(${color},${0.5 * k})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    // 横に伸びる光の筋
    const L = 20 * k;
    const f = ctx.createLinearGradient(x - L, y, x + L, y);
    f.addColorStop(0, `rgba(${color},0)`);
    f.addColorStop(0.5, `rgba(255,255,235,${0.9 * k})`);
    f.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = f;
    ctx.beginPath();
    ctx.ellipse(x, y, L, 1.4, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // 白く飛んだ芯（ふちは目の色ににじむ）
  for (const x of [-dx, dx]) {
    const c = ctx.createRadialGradient(x, y, 0, x, y, 3.6);
    c.addColorStop(0, '#ffffff');
    c.addColorStop(0.55, '#fffbe8');
    c.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 3.6, 0, TAU);
    ctx.fill();
  }
}

function drawHead(ctx, e, skin) {
  circle(ctx, 0, -98, 13, skin || e.look.skin);
  // 髪
  ctx.beginPath();
  ctx.arc(0, -100, 13.5, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(13, -98);
  ctx.quadraticCurveTo(0, -108, -13, -98);
  ctx.closePath();
  ctx.fillStyle = e.look.hair;
  ctx.fill();
  // 目
  circle(ctx, -4.5, -97, 1.6, '#222');
  circle(ctx, 4.5, -97, 1.6, '#222');
}

// 普通の人の服装
const NORMAL_OUTFITS = {
  salaryman(ctx, e) {
    poly(ctx, [-6, -84, 6, -84, 0, -68], '#f4f4f4');
    poly(ctx, [-2, -82, 2, -82, 3, -66, 0, -62, -3, -66], '#c0392b');
  },
  student(ctx, e) {
    for (let i = 0; i < 4; i++) circle(ctx, 0, -78 + i * 9, 1.8, '#e8c34a');
    rrect(ctx, -15, -86, 30, 6, 3, '#18203a');
  },
  tourist(ctx, e) {
    // カメラ
    line(ctx, -10, -84, 0, -66, 1.5, '#222');
    line(ctx, 10, -84, 0, -66, 1.5, '#222');
    rrect(ctx, -7, -68, 14, 10, 2, '#333');
    circle(ctx, 0, -63, 3, '#8ab');
  },
  ol(ctx, e) {
    // ひざ丈のスカート（A ライン）
    poly(ctx, [-15, -50, 15, -50, 19, -24, -19, -24], '#3b4060');
    line(ctx, -6, -48, -8, -25, 1, 'rgba(0,0,0,0.25)');
    line(ctx, 6, -48, 8, -25, 1, 'rgba(0,0,0,0.25)');
    // ジャケット（腰まで）
    rrect(ctx, -16, -84, 32, 36, 7, e.look.top);
    poly(ctx, [-5, -84, 5, -84, 0, -72], '#f4f4f4');
    line(ctx, 0, -72, 0, -50, 1.5, 'rgba(0,0,0,0.25)');
    circle(ctx, -3, -64, 1.6, '#5a4632');
    circle(ctx, -3, -56, 1.6, '#5a4632');
  },
};

// 普通の人の、体より後ろに描く部分
function drawNormalBack(ctx, e) {
  if (e.variant === 'tourist') {
    // リュック（体の両脇と肩の上からはみ出して見える）
    rrect(ctx, -20, -90, 40, 44, 9, '#2f6b4f');
    rrect(ctx, -20, -62, 40, 4, 2, '#24543e');
  }
}

function drawNormalExtras(ctx, e) {
  if (e.variant === 'ol') {
    // ボブカット（あごの高さでそろえた髪と、まっすぐな前髪）
    ctx.beginPath();
    ctx.moveTo(-15.5, -100);
    ctx.arc(0, -100, 15.5, Math.PI, TAU);
    ctx.lineTo(15.5, -86);
    ctx.quadraticCurveTo(13, -84.5, 10, -86);
    ctx.lineTo(10, -102);
    ctx.lineTo(-10, -102);
    ctx.lineTo(-10, -86);
    ctx.quadraticCurveTo(-13, -84.5, -15.5, -86);
    ctx.closePath();
    ctx.fillStyle = e.look.hair;
    ctx.fill();
    // 口紅
    line(ctx, -2, -90.5, 2, -90.5, 1.6, '#c2405a');
  }
  if (e.variant === 'tourist') {
    // リュックの肩ベルト
    line(ctx, -10, -84, -12, -58, 3.5, '#24543e');
    line(ctx, 10, -84, 12, -58, 3.5, '#24543e');
    // 帽子
    ctx.beginPath();
    ctx.arc(0, -103, 14, Math.PI, TAU);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    rrect(ctx, -2, -105, 20, 4, 2, '#e74c3c');
  }
  if (e.variant === 'salaryman') {
    // カバン
    const sw = Math.sin(e.phase) * 5;
    rrect(ctx, 14 + sw, -50, 16, 12, 2, '#3b2a1e');
  }
  if (e.variant === 'ol') {
    const sw = Math.sin(e.phase) * 5;
    rrect(ctx, -30 - sw, -54, 13, 11, 3, '#7a2f3b');
  }
  if (e.props.phone) {
    rrect(ctx, 14, -62, 7, 11, 1.5, '#111');
  }
}

// ---------------------------------------------------------------- 仮装

// back: 体より後ろに描く部分 / front: 体より前に描く部分
export const COSTUMES = {
  pumpkin: {
    front(ctx, e) {
      circle(ctx, 0, -100, 19, '#f28c28');
      ctx.strokeStyle = '#c96a12';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, -100, 7, 19, 0, 0, TAU);
      ctx.stroke();
      // 本物は中で火が燃えている
      const flick = 0.75 + 0.25 * Math.sin(e.phase * 3 + (e.seed || 0) * 7);
      const inner = e.monster ? `rgba(255,${180 + Math.round(60 * flick)},40,1)` : '#2b1a05';
      poly(ctx, [-10, -106, -3, -106, -6.5, -99], inner);
      poly(ctx, [3, -106, 10, -106, 6.5, -99], inner);
      poly(ctx, [-10, -94, -5, -92, -2, -95, 2, -92, 5, -95, 10, -94, 6, -88, -6, -88], inner);
      if (e.monster) {
        const g = ctx.createRadialGradient(0, -98, 2, 0, -98, 30);
        g.addColorStop(0, `rgba(255,200,60,${0.35 * (e.eyeGlow ?? 1) * flick})`);
        g.addColorStop(1, 'rgba(255,120,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, -98, 30, 0, TAU);
        ctx.fill();
      }
      rrect(ctx, -2, -124, 4, 6, 1, '#3d7a2a');
      // 仮装はオレンジのTシャツに顔のプリント
      if (!e.monster) {
        rrect(ctx, -15, -84, 30, 30, 7, '#ff9f2e');
      } else {
        // 本物はボロボロのマント
        poly(ctx, [-17, -84, 17, -84, 22, -36, 14, -40, 8, -33, 0, -38, -8, -32, -14, -39, -22, -35], '#2a1d14');
      }
    },
  },
  witch: {
    front(ctx, e, opt = {}) {
      poly(ctx, [-13, -84, 13, -84, 23, -28, -23, -28], e.monster ? '#3c1a5a' : '#6a2fa0');
      if (!e.monster) {
        // 仮装：オレンジのリボン
        poly(ctx, [-6, -84, 0, -78, 6, -84, 0, -80], '#ff9f2e');
      } else {
        // 本物：わし鼻
        poly(ctx, [0, -99, 9, -92, 1, -94], '#8fbf6a');
        line(ctx, -12, -106, -16, -80, 3, '#9aa0a6');
        line(ctx, 12, -106, 16, -80, 3, '#9aa0a6');
      }
      ellipse(ctx, 0, -110, 23, 5, '#1d1029');
      poly(ctx, [-12, -111, 12, -111, 4, -142, 11, -148], '#1d1029');
      rrect(ctx, -12, -116, 24, 4, 1, e.monster ? '#5a5a3a' : '#e0b030');
      if (opt.costumeOnly) return;
      // 長い杖を、体の前で斜めに両手で持つ（左下から右上へ）
      const robe = e.monster ? '#3c1a5a' : '#6a2fa0';
      const hand = e.look.skin;
      const sx = Math.sin(e.phase) * 1.5;
      const at = (t) => [-24 + 50 * t + sx, -20 - 104 * t];
      const [ax, ay] = at(0);
      const [bx, by] = at(1);
      line(ctx, ax, ay, bx, by, 3.2, '#6b3f1d');
      // 杖の先の飾り（仮装は星、本物はねじれたこぶ）
      if (e.monster) {
        circle(ctx, bx, by, 4, '#4a2a12');
        circle(ctx, bx + 2, by - 3, 2.4, '#4a2a12');
      } else {
        const st = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 2.4 : 6;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          st.push(bx + Math.cos(a) * r, by + Math.sin(a) * r);
        }
        poly(ctx, st, '#ffd23f');
      }
      // 両腕（袖はローブの色）
      const [lx, ly] = at(0.36);
      const [rx, ry] = at(0.56);
      line(ctx, -14, -78, lx, ly, 7, robe);
      line(ctx, 14, -78, rx, ry, 7, robe);
      circle(ctx, lx, ly, 4, hand);
      circle(ctx, rx, ry, 4, hand);
    },
    ownArms: true,
  },
  vampire: {
    back(ctx, e) {
      const fl = Math.sin(e.phase * 0.5) * 3;
      poly(ctx, [-16, -86, 16, -86, 32 + fl, -14, -32 - fl, -14], '#111');
      poly(ctx, [-13, -84, 13, -84, 26 + fl, -18, -26 - fl, -18], '#9e1b1b');
    },
    front(ctx, e) {
      poly(ctx, [-16, -86, -4, -84, -10, -72, -22, -100], '#111');
      poly(ctx, [16, -86, 4, -84, 10, -72, 22, -100], '#111');
      poly(ctx, [-3, -91, -1, -91, -2, -87], '#fff');
      poly(ctx, [1, -91, 3, -91, 2, -87], '#fff');
      // 前髪（富士額）
      poly(ctx, [-13, -103, 13, -103, 0, -98], '#111');
      if (!e.monster) {
        // 仮装：ちゃちな赤い蝶ネクタイ
        poly(ctx, [-6, -82, 0, -79, -6, -76], '#e01b3b');
        poly(ctx, [6, -82, 0, -79, 6, -76], '#e01b3b');
      } else {
        // 本物：口元の血
        line(ctx, 2, -88, 2.5, -84, 1.2, '#b00010');
      }
    },
    skin: '#ece6ef',
    hair: '#111',
    top: '#1b1b1f',
  },
  cat: {
    back(ctx, e) {
      // 本物（化け猫）はしっぽが二本
      const tails = e.monster ? [[34, 6], [26, -6]] : [[32, 0]];
      for (const [tx, ph] of tails) {
        ctx.beginPath();
        ctx.moveTo(10, -42);
        ctx.quadraticCurveTo(tx + 4, -38, tx + Math.sin(e.phase + ph) * 4, -76);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = e.monster ? '#3a3a48' : '#111';
        ctx.stroke();
      }
    },
    front(ctx, e) {
      const ear = e.monster ? '#3a3a48' : '#111';
      poly(ctx, [-14, -104, -4, -110, -13, -124], ear);
      poly(ctx, [14, -104, 4, -110, 13, -124], ear);
      poly(ctx, [-12, -107, -7, -110, -12, -118], '#f5a3b7');
      poly(ctx, [12, -107, 7, -110, 12, -118], '#f5a3b7');
      circle(ctx, 0, -93, 1.8, '#f57a9a');
      for (const d of [-1, 1]) {
        line(ctx, 4 * d, -93, 16 * d, -96, 1, '#111');
        line(ctx, 4 * d, -92, 16 * d, -90, 1, '#111');
      }
      if (!e.monster) {
        // 仮装：白いお腹と肉球手袋
        ellipse(ctx, 0, -60, 9, 14, '#f4f4f4');
        circle(ctx, -19, -48, 5, '#111');
        circle(ctx, 19, -48, 5, '#111');
        circle(ctx, -19, -47, 2, '#f5a3b7');
        circle(ctx, 19, -47, 2, '#f5a3b7');
      }
    },
    top: '#1c1c1c',
  },
  frank: {
    front(ctx, e) {
      const skin = e.monster ? e.look.skin : '#8fbf6a';
      // 頭に刺さったボルト（左右のこめかみ）
      for (const d of [-1, 1]) {
        rrect(ctx, d > 0 ? 12 : -19, -104, 7, 4, 1, '#9a9a9a');
        rrect(ctx, d > 0 ? 18 : -21, -107, 3, 10, 1, '#6e6e6e');
      }
      // 四角い顔
      rrect(ctx, -13.5, -114, 27, 30, 3, skin);
      // 平らな黒髪（ぎざぎざの前髪）
      poly(ctx, [-14.5, -119, 14.5, -119, 14.5, -109, 10, -106, 5, -109, 0, -106, -5, -109, -10, -106, -14.5, -109], '#1a1a1a');
      // 額の縫い目
      const dark = e.monster ? '#1f2f1a' : '#2d4a26';
      line(ctx, -9, -102.5, 9, -102.5, 1.3, dark);
      for (let i = -7.5; i <= 7.5; i += 3) line(ctx, i, -104.8, i, -100.2, 1.1, dark);
      // 目と口（顔を描き直したので）
      circle(ctx, -4.5, -96, 1.7, '#222');
      circle(ctx, 4.5, -96, 1.7, '#222');
      line(ctx, -5, -89, 5, -89, 1.4, dark);
      // つぎはぎの上着
      rrect(ctx, -9, -74, 9, 9, 1, e.monster ? '#2a2a32' : '#6a5acd');
      line(ctx, -9, -74, 0, -65, 1, '#ddd');
      line(ctx, 0, -74, -9, -65, 1, '#ddd');
    },
    skin: '#8fbf6a',
    top: '#4a4458',
  },
  mummy: {
    front(ctx, e) {
      const sway = Math.sin(e.phase * 0.8) * 4;
      if (e.monster) {
        // 本物はほどけた包帯がなびく
        line(ctx, 14, -80, 28 + sway, -66, 3, '#d8d0bc');
        line(ctx, -14, -56, -27 - sway, -44, 3, '#d8d0bc');
      }
      circle(ctx, 0, -98, 14, '#ece6d6');
      rrect(ctx, -16, -85, 32, 47, 7, '#ece6d6');
      for (let y = -82; y < -40; y += 6) line(ctx, -15, y, 15, y + 3, 1.3, '#b9b09a');
      for (let y = -108; y < -88; y += 5) line(ctx, -13, y, 13, y + 2, 1.3, '#b9b09a');
      rrect(ctx, -8, -100, 16, 5, 2, '#2a2015');
      if (!e.monster) {
        // 仮装：包帯のすき間から肌と人間の目
        circle(ctx, -4, -97.5, 1.6, '#fff');
        circle(ctx, 4, -97.5, 1.6, '#fff');
        circle(ctx, -4, -97.5, 0.8, '#222');
        circle(ctx, 4, -97.5, 0.8, '#222');
        rrect(ctx, -6, -91, 12, 3, 1, '#e8b894');
      }
    },
    hands: '#ece6d6',
  },

  // --- ここから「幽霊っぽい仮装」。裾の下から足と靴が見える ---
  sheet: {
    front(ctx, e) {
      const hem = e.hemY;
      ctx.beginPath();
      ctx.moveTo(-24, hem);
      ctx.lineTo(-20, -96);
      ctx.arc(0, -98, 20, Math.PI, TAU);
      ctx.lineTo(24, hem);
      // 裾はまっすぐ（布を切っただけ）
      ctx.lineTo(8, hem + 2);
      ctx.lineTo(-10, hem - 1);
      ctx.closePath();
      ctx.fillStyle = '#f2f2f2';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      line(ctx, -8, -80, -12, hem, 1, 'rgba(0,0,0,0.1)');
      line(ctx, 9, -78, 13, hem, 1, 'rgba(0,0,0,0.1)');
      ellipse(ctx, -6, -100, 3.2, 4.5, '#111');
      ellipse(ctx, 6, -100, 3.2, 4.5, '#111');
    },
    hideArms: true,
    hideHead: true,
  },
  yurei: {
    front(ctx, e) {
      drawYureiUpper(ctx, e.hemY, false);
    },
    hideArms: true,
    hideHead: true,
  },
  ochimusha: {
    front(ctx, e) {
      drawOchimushaUpper(ctx, e, e.hemY);
    },
    hideHead: true,
  },
};

export const GHOST_LIKE = ['sheet', 'yurei', 'ochimusha'];
export const OBVIOUS = ['pumpkin', 'witch', 'vampire', 'cat', 'frank', 'mummy'];


// 白装束（仮装と本物で共通）
function drawYureiUpper(ctx, hem, real) {
  const body = '#f4f4f0';
  if (!real) {
    poly(ctx, [-15, -86, 15, -86, 20, hem, -20, hem], body);
  }
  // 襟（左前）
  line(ctx, -8, -86, 6, -60, 1.5, '#c9c9c0');
  line(ctx, 8, -86, -2, -70, 1.5, '#c9c9c0');
  // うらめしやの手
  line(ctx, -12, -78, -16, -66, 6, body);
  line(ctx, 12, -78, 16, -66, 6, body);
  line(ctx, -16, -66, -8, -64, 6, body);
  line(ctx, 16, -66, 8, -64, 6, body);
  line(ctx, -8, -64, -7, -58, 3, real ? '#dfe8f0' : '#e9c9a8');
  line(ctx, 8, -64, 7, -58, 3, real ? '#dfe8f0' : '#e9c9a8');
  // 顔と髪
  circle(ctx, 0, -98, 13, real ? '#dfe8f0' : '#f1d2b4');
  ctx.beginPath();
  ctx.moveTo(-14, -98);
  ctx.arc(0, -100, 14, Math.PI, TAU);
  ctx.lineTo(15, -66);
  ctx.lineTo(8, -70);
  ctx.lineTo(7, -96);
  ctx.lineTo(-7, -96);
  ctx.lineTo(-8, -70);
  ctx.lineTo(-15, -66);
  ctx.closePath();
  ctx.fillStyle = '#111';
  ctx.fill();
  // 三角巾
  // 本物は下向き、仮装は上向き（付け方を間違えている）
  if (real) poly(ctx, [-6, -110, 6, -110, 0, -102], '#fff');
  else poly(ctx, [-6, -102, 6, -102, 0, -112], '#fff');
  // 目（閉じ気味）
  line(ctx, -5, -95, -2, -94, 1.2, '#333');
  line(ctx, 2, -94, 5, -95, 1.2, '#333');
}

function drawOchimushaUpper(ctx, e, hem) {
  // 鎧
  poly(ctx, [-16, -86, 16, -86, 18, -40, -18, -40], '#5b3a22');
  for (let y = -80; y < -42; y += 7) line(ctx, -16, y, 16, y, 1.5, '#a0522d');
  // 草摺（腰の板）
  if (hem !== null) {
    poly(ctx, [-18, -42, 18, -42, 22, hem, -22, hem], '#4a2f1c');
    for (let x = -14; x <= 14; x += 7) line(ctx, x, -42, x * 1.2, hem, 1.2, '#2c1b10');
  }
  // 袖
  rrect(ctx, -26, -86, 11, 16, 2, '#6b4429');
  rrect(ctx, 15, -86, 11, 16, 2, '#6b4429');
  // 顔とザンバラ髪
  circle(ctx, 0, -98, 13, e && e.kind === 'ghost' ? '#cfd8c8' : '#e2b993');
  ctx.beginPath();
  ctx.moveTo(-14, -96);
  ctx.lineTo(-17, -82);
  ctx.lineTo(-11, -90);
  ctx.lineTo(-10, -110);
  ctx.lineTo(0, -114);
  ctx.lineTo(10, -110);
  ctx.lineTo(11, -90);
  ctx.lineTo(17, -82);
  ctx.lineTo(14, -96);
  ctx.lineTo(8, -108);
  ctx.lineTo(-8, -108);
  ctx.closePath();
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  circle(ctx, -4.5, -97, 1.6, '#222');
  circle(ctx, 4.5, -97, 1.6, '#222');
  line(ctx, -4, -91, 4, -91, 1.2, '#6b3b2b');
  // 矢
  line(ctx, 6, -70, 26, -92, 1.6, '#c8a165');
  poly(ctx, [26, -92, 30, -98, 32, -92], '#eee');
  line(ctx, -8, -60, -28, -76, 1.6, '#c8a165');
  poly(ctx, [-28, -76, -34, -80, -32, -72], '#eee');
}

// ---------------------------------------------------------------- 小物（仮装した人の「証拠」）

function drawProps(ctx, e) {
  const p = e.props;
  if (p.priceTag) {
    line(ctx, 12, -74, 18, -66, 0.8, '#999');
    rrect(ctx, 14, -66, 14, 8, 1, '#fff');
    ctx.fillStyle = '#d00';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('¥980', 21, -60);
  }
  if (p.bag) {
    const sw = Math.sin(e.phase) * 5;
    line(ctx, -22 - sw, -50, -22 - sw, -44, 1.5, '#a08000');
    rrect(ctx, -30 - sw, -44, 16, 16, 2, '#ffd600');
    ctx.fillStyle = '#d00';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('激安', -22 - sw, -34);
  }
  if (p.can) {
    rrect(ctx, 16, -56, 7, 12, 1.5, '#c0c6cc');
    ctx.fillStyle = '#c00';
    ctx.fillRect(16, -52, 7, 3);
  }
}

// ---------------------------------------------------------------- 人間（普通の人・仮装した人）

// 人間（普通の人・仮装した人）と、仮装そっくりの本物のお化け（e.monster）
export function drawHuman(ctx, e, { withCostume = true } = {}) {
  const monster = !!e.monster;
  const cos = (withCostume && e.kind === 'costume') || monster ? COSTUMES[e.variant] : null;
  const skin = monster ? e.look.skin : (cos && cos.skin) || e.look.skin;
  const top = monster ? e.look.top : (cos && cos.top) || e.look.top;
  if (!monster) drawShadow(ctx);
  if (cos && cos.back) cos.back(ctx, e);
  if (e.kind === 'normal') drawNormalBack(ctx, e);
  drawLegs(ctx, e, monster);
  if (!(cos && cos.hideArms)) {
    drawTorsoWith(ctx, top);
    if (!(cos && cos.ownArms)) drawArmsWith(ctx, e, top, (cos && cos.hands) || skin);
  }
  if (e.kind === 'normal') {
    const f = NORMAL_OUTFITS[e.variant];
    if (f) f(ctx, e);
  }
  if (!(cos && cos.hideHead)) {
    const hair = monster ? e.look.hair : (cos && cos.hair) || e.look.hair;
    drawHead(ctx, { look: { ...e.look, hair } }, skin);
  }
  if (e.kind === 'normal') drawNormalExtras(ctx, e);
  if (cos) cos.front(ctx, e);
  if (monster) {
    const pulse = e.phase * 2 + (e.seed || 0);
    if (e.variant === 'pumpkin') glowEyes(ctx, e.eyeGlow ?? 1, -103, 6.5, '255,170,40', pulse);
    else glowEyes(ctx, e.eyeGlow ?? 1, e.variant === 'mummy' ? -97.5 : -97, 4.5, e.variant === 'cat' ? '255,220,40' : '255,60,40', pulse);
  }
  if (e.kind === 'costume' && withCostume) drawProps(ctx, e);
}

function drawTorsoWith(ctx, top) {
  rrect(ctx, -15, -84, 30, 46, 7, top);
}

function drawArmsWith(ctx, e, top, skin) {
  const sw = Math.sin(e.phase) * 5;
  line(ctx, -14, -76, -19 - sw, -50, 7, top);
  line(ctx, 14, -76, 19 + sw, -50, 7, top);
  circle(ctx, -19 - sw, -48, 4, skin);
  circle(ctx, 19 + sw, -48, 4, skin);
}

// 成敗されて飛んでいく仮装だけを描く
export function drawCostumeOnly(ctx, e) {
  const cos = COSTUMES[e.variant];
  if (!cos) return;
  if (cos.back) cos.back(ctx, e);
  cos.front(ctx, e, { costumeOnly: true });
}

// ---------------------------------------------------------------- 本物の幽霊（足がない・影がない・透ける）

export function drawGhost(ctx, e, t) {
  const sway = Math.sin(t * 2.3 + e.seed) * 6;
  if (e.variant === 'sheet') {
    ctx.beginPath();
    ctx.moveTo(-22, -40);
    ctx.lineTo(-20, -96);
    ctx.arc(0, -98, 20, Math.PI, TAU);
    ctx.lineTo(22, -40);
    // 波打つ裾（足はない）
    const w = Math.sin(t * 5 + e.seed) * 3;
    ctx.quadraticCurveTo(18, -28 + w, 12, -38);
    ctx.quadraticCurveTo(6, -26 - w, 0, -36);
    ctx.quadraticCurveTo(-6, -26 + w, -12, -38);
    ctx.quadraticCurveTo(-18, -28 - w, -22, -40);
    ctx.closePath();
    ctx.fillStyle = '#f6f8ff';
    ctx.fill();
    ellipse(ctx, -6, -100, 3.2, 4.5, '#111');
    ellipse(ctx, 6, -100, 3.2, 4.5, '#111');
    ellipse(ctx, 0, -88, 3, 2 + Math.abs(Math.sin(t * 3)) * 2, '#333');
    return;
  }
  if (e.variant === 'yurei') {
    ctx.beginPath();
    ctx.moveTo(-15, -86);
    ctx.lineTo(15, -86);
    ctx.lineTo(18, -48);
    wispPathReverse(ctx, -48, 18, sway);
    ctx.closePath();
    ctx.fillStyle = '#f4f6f8';
    ctx.fill();
    drawYureiUpper(ctx, -48, true);
    return;
  }
  if (e.variant === 'ochimusha') {
    ctx.beginPath();
    ctx.moveTo(-18, -42);
    ctx.lineTo(18, -42);
    wispPathReverse(ctx, -42, 18, sway);
    ctx.closePath();
    ctx.fillStyle = '#4a2f1c';
    ctx.fill();
    drawOchimushaUpper(ctx, e, null);
  }
}

function wispPathReverse(ctx, topY, halfW, sway) {
  ctx.quadraticCurveTo(halfW * 0.6, topY + 20, sway + 8, -12);
  ctx.quadraticCurveTo(sway + 6, -2, sway - 3, -6);
  ctx.quadraticCurveTo(-halfW * 0.8, topY + 22, -halfW, topY);
}

export function drawHitodama(ctx, x, y, s, t, seed) {
  for (let i = 0; i < 2; i++) {
    const a = t * 2 + seed + i * Math.PI;
    const hx = x + Math.cos(a) * 34 * s;
    const hy = y - 80 * s + Math.sin(a) * 12 * s;
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 10 * s);
    g.addColorStop(0, 'rgba(220,240,255,0.95)');
    g.addColorStop(0.5, 'rgba(90,170,255,0.6)');
    g.addColorStop(1, 'rgba(60,120,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hx, hy, 10 * s, 0, TAU);
    ctx.fill();
  }
}

// 怒った目・祟りの目
export function drawCursedEyes(ctx) {
  circle(ctx, -5, -98, 2.6, '#ff1a1a');
  circle(ctx, 5, -98, 2.6, '#ff1a1a');
}

// ---------------------------------------------------------------- ハリセン

export function drawHarisen(ctx, x, y, k) {
  // k: 0→1 で振り下ろす
  const ang = -1.2 + k * 1.8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.translate(-10, -70);
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.lineTo(-30, -20);
  ctx.lineTo(30, -20);
  ctx.closePath();
  ctx.fillStyle = '#fffdf2';
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = -3; i <= 3; i++) line(ctx, 0, 60, i * 9, -20, 1, '#999');
  rrect(ctx, -6, 50, 12, 26, 3, '#c0392b');
  ctx.restore();
}

// 吹き出し（画面座標）
export function drawBubble(ctx, text, x, y, color = '#fff', textColor = '#111') {
  ctx.font = 'bold 17px sans-serif';
  const w = ctx.measureText(text).width + 18;
  const h = 28;
  const bx = Math.max(6, Math.min(540 - w - 6, x - w / 2));
  const by = y - h - 10;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 10);
  ctx.moveTo(x - 6, by + h);
  ctx.lineTo(x, by + h + 9);
  ctx.lineTo(x + 6, by + h);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 9, by + h / 2 + 1);
}

// 告知動画の台本（GOODBYE BAD HALLOWEEN）。npm run promo で ../video/goodbye-bad-halloween-promo.mp4 を作る
// 使える操作はスキルの references/scenario-api.md。BGM はゲームの合成 BGM（src/audio.js）をそのまま書き出す

export const config = {
  slug: 'goodbye-bad-halloween',
  url: 'game.chozo.net/goodbye-bad-halloween/',
  orientation: 'portrait',
  game: { width: 390, height: 693 }, // ゲームは 9:16
  serveDir: '.',
  gamePath: '/',
  background:
    'radial-gradient(circle at 50% 30%, rgba(255,138,31,0.35), transparent 55%), linear-gradient(170deg, #1a0b33 0%, #3a1466 55%, #ff6a00 140%)',
  music: false, // 合成リズムは使わず、ゲームの BGM を使う
};

const TITLE = 'GOODBYE\nBAD HALLOWEEN';

// 仮装した人を1人叩く（指の下にいるのがその人だと確かめてから叩く）
async function bustOne(p, { zMin = 5.6, zMax = 24 } = {}) {
  const s = await p.state();
  if (s.mode !== 'play') return false;
  const cands = s.entities
    .filter((e) => e.kind === 'costume' && e.state === 'walk' && e.z > zMin && e.z < zMax)
    .sort((a, b) => a.z - b.z);
  for (const e of cands) {
    const x = (e.box.x0 + e.box.x1) / 2;
    const y = (e.box.y0 + e.box.y1) / 2;
    if ((await p.call('hitTest', x, y)) === e.id) {
      await p.call('tapAt', x, y);
      return true;
    }
  }
  return false;
}

// 指定した人数になるまで撮らずに遊ぶ（仮装は全部成敗。ミスのリプレイが始まったら飛ばす）
async function playTo(p, score, { every = 0.06, max = 600 } = {}) {
  for (let t = 0; t < max; t += every) {
    const s = await p.state();
    if (s.mode === 'replay') await p.call('skipReplay');
    if (s.score >= score) return s;
    await bustOne(p, { zMin: 5.05, zMax: 40 });
    await p.skip(every);
  }
  throw new Error(`${score} 人に届きませんでした`);
}

// 撮らずに、画面に残っている仮装を全部成敗する（撮る場面で見せたい人だけを残すため）
async function clearCostumes(p, secs = 0.6) {
  for (let t = 0; t < secs; t += 0.05) {
    await bustOne(p, { zMin: 5.05, zMax: 40 });
    await p.skip(0.05);
  }
}

// 撮りながら、仮装が画面の中ほどに来たら1人ずつ成敗する
async function bustMid(p, n, secs, { zMin = 9, zMax = 15 } = {}) {
  let done = 0;
  for (let t = 0; t < secs; t += 1 / 30) {
    if (done < n && (await bustOne(p, { zMin, zMax }))) done++;
    await p.wait(1 / 30);
  }
  return done;
}

// レベルの出現の割合から仮装を外す（台本で出す仮装だけにして、成敗する数をそろえる）
async function noCostumes(p, levels, on = true) {
  await p.eval(
    ([levels, on], win) => {
      const L = win.__game.config.levels;
      const saved = (win.__promoMix ??= {});
      for (const i of levels) {
        if (on) {
          saved[i] ??= { ...L[i].mix };
          L[i].mix = { costume: 0, ghost: 0.5, normal: 0.5 };
        } else if (saved[i]) L[i].mix = saved[i];
      }
    },
    [levels, on],
  );
}

export default async function scenario(p) {
  await p.seed(5); // 画面の揺れなど
  await p.call('seed', 21); // ゲームの乱数
  await p.call('audio.capture', true);

  // 最後まで1回のプレイで撮る（始め直さないので BGM が途切れない）
  // ---------------------------------------------------------------- 0〜2秒 つかみ：仮装を次々に成敗（スロー）
  await p.call('start');
  await p.call('setSpawning', false);
  await p.eval((_, win) => win.__game.config.levels.forEach((l) => (l.talkChance = 0)));
  for (const [kind, v, x, z] of [
    ['costume', 'pumpkin', -1.5, 13],
    ['ghost', 'sheet', 1.7, 16],
    ['costume', 'witch', 1.2, 11],
    ['normal', 'salaryman', -0.3, 17],
    ['costume', 'vampire', -0.4, 9],
    ['costume', 'cat', 0.6, 14.5],
  ]) await p.call('spawn', kind, v, x, z);
  await p.skip(0.3);
  await p.call('audio.resync');
  p.zoom(1.12, 0.01, { x: 0.5, y: 0.55 });
  p.speed(0.55, { badge: false });
  for (let i = 0; i < 4; i++) {
    await bustOne(p, { zMin: 4 });
    p.shake(10, 0.2);
    await p.wait(0.42);
  }
  p.speed(1);
  p.zoom(1, 0.3);
  p.flash({ dur: 0.25 });

  // ---------------------------------------------------------------- タイトル
  await noCostumes(p, [0]);
  await p.call('setSpawning', true);
  p.title({ title: TITLE, sub: 'ハロウィン目的で\n渋谷に来ないで！', dur: 3 });
  await p.wait(1.2);
  p.cover(); // 表紙はゲーム画面にタイトルが重なったコマ
  await p.call('spawn', 'costume', 'frank', -0.8, 30);
  await p.wait(1.8);

  // ---------------------------------------------------------------- Lv1：ゆっくり
  p.caption('Lv1\n仮装をタップで成敗！', { y: 0.16, dur: 4.0 });
  await bustMid(p, 1, 4.2, { zMin: 9, zMax: 13 });
  await noCostumes(p, [0], false);

  // ---------------------------------------------------------------- Lv7：速く、人が増える
  await playTo(p, 35); // あと1人で Lv7（36人目で Lv7）
  await noCostumes(p, [5, 6]);
  await clearCostumes(p);
  await p.call('spawn', 'costume', 'mummy', 0.9, 30);
  await p.call('spawn', 'costume', 'witch', -1.1, 34);
  await p.skip(0.9);
  await p.call('audio.resync');
  p.flash({ dur: 0.15 });
  p.caption('Lv7\nどんどん速く！', { y: 0.16, dur: 3.8 });
  await bustMid(p, 2, 4.0, { zMin: 8, zMax: 14 });
  await noCostumes(p, [5, 6], false);

  // ---------------------------------------------------------------- Lv15：大混雑
  await playTo(p, 83); // あと1人で Lv15（84人目で Lv15）
  await noCostumes(p, [13, 14]);
  await clearCostumes(p);
  await p.call('spawn', 'costume', 'pumpkin', -0.6, 32);
  await p.call('spawn', 'costume', 'cat', 1.2, 34);
  await p.skip(0.7);
  await p.call('audio.resync');
  p.flash({ dur: 0.15 });
  p.caption('Lv15\nもう大混雑！', { y: 0.16, dur: 3.8 });
  await bustMid(p, 2, 3.0, { zMin: 8, zMax: 14 });
  await p.call('setSpawning', false); // ミスの場面で、叩くおばけのまわりを空かせる
  await bustMid(p, 0, 1.0);

  // ---------------------------------------------------------------- ミスの紹介：本物のおばけを成敗してしまう（アップにしない）
  await p.call('setSpawning', false);
  const ghostId = await p.call('spawn', 'ghost', 'vampire', 0.1, 34);
  p.caption('本物のおばけも\nまぎれてる！', { y: 0.16, dur: 1.8 });
  await p.until((s) => (s.entities.find((e) => e.id === ghostId)?.z ?? 0) < 9.5, { max: 5 });
  p.speed(0.4, { badge: false }); // ハリセンが当たるところをスローで見せる
  await p.call('tapEntity', ghostId);
  p.shake(12, 0.3);
  p.caption('本物を成敗すると\nミス！', { y: 0.66, dur: 1.8, color: '#ff9aa8' });
  await p.wait(0.9);
  p.speed(1);
  await p.wait(1.0); // 字幕を1つずつ出す
  p.caption('リプレイで\n答え合わせ', { y: 0.66, dur: 3 }); // 上はリプレイの見出しがあるので真ん中より下に
  await p.until((s) => s.replay === 'explain', { max: 6 });
  await p.wait(2.4);
  await p.call('skipReplay');
  await p.wait(1.0); // 「再スタート！」

  // ---------------------------------------------------------------- エンドカード
  p.endCard({ title: TITLE, sub: '仮装だけ成敗せよ！', cta: '今すぐ遊べる！', url: config.url, dur: 3.5 });
  await p.wait(3.5);
}

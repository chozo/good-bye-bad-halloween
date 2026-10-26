// ブラウザでの動作確認（playwright-core + インストール済み Chrome、ヘッドレス）
// 使い方: npm run e2e   （スクリーンショットは shots/ に保存）
//         npm run e2e https://game.chozo.net/goodbye-bad-halloween/   （公開URLを確認する）
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 5199;
const URL = process.argv[2] || `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync('shots', { recursive: true });

const server = process.argv[2] ? null : spawn('node', ['tools/serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
if (server) await new Promise((r) => setTimeout(r, 400));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'NG  '} ${name}${detail ? '  ' + detail : ''}`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.screenshot({ path: 'shots/01-title.png' });

  // ---- 開始とHUD
  await page.click('#btn-start');
  await page.evaluate(() => {
    __game.setManual(true);
    __game.seed(42);
  });
  let st = await page.evaluate(() => __game.state);
  check('出動するでプレイ開始', st.mode === 'play' && st.score === 0 && st.misses === 0);

  // ---- 全種類を並べた見本（見た目の確認用）
  await page.evaluate(() => {
    __game.setSpawning(false);
    const vs = [['costume', 'pumpkin'], ['costume', 'witch'], ['costume', 'vampire'], ['costume', 'cat'], ['costume', 'frank'], ['costume', 'mummy']];
    vs.forEach(([k, v], i) => __game.spawn(k, v, -2.6 + i * 1.05, 9));
    vs.forEach(([, v], i) => __game.spawn('ghost', v, -2.6 + i * 1.05, 16));
    __game.step(1 / 60, 2);
  });
  await page.screenshot({ path: 'shots/02-obvious-costumes.png' });
  await page.evaluate(() => {
    __game.start();
    __game.setManual(true);
    __game.setSpawning(false);
    const vs = [['costume', 'sheet'], ['ghost', 'sheet'], ['costume', 'yurei'], ['ghost', 'yurei'], ['costume', 'ochimusha'], ['ghost', 'ochimusha']];
    vs.forEach(([k, v], i) => __game.spawn(k, v, -2.6 + i * 1.05, 9));
    __game.step(1 / 60, 2);
  });
  await page.screenshot({ path: 'shots/03-ghostlike-vs-real.png' });
  await page.evaluate(() => {
    __game.start();
    __game.setManual(true);
    __game.setSpawning(false);
    ['salaryman', 'student', 'tourist', 'ol'].forEach((v, i) => __game.spawn('normal', v, -1.8 + i * 1.2, 8));
    ['salaryman', 'student', 'tourist', 'ol'].forEach((v, i) => __game.spawn('normal', v, -1.8 + i * 1.2, 20));
    __game.step(1 / 60, 2);
  });
  await page.screenshot({ path: 'shots/04-normals.png' });

  // ---- 当たり判定：おばけのすぐ後ろの仮装
  // 仮装の見えている部分を叩けば仮装に、おばけの体を叩けばおばけに当たる
  const overlap = await page.evaluate(() => {
    const out = [];
    for (const gv of ['vampire', 'frank', 'witch', 'pumpkin', 'yurei', 'sheet']) {
      __game.start();
      __game.setManual(true);
      __game.setSpawning(false);
      __game.seed(7);
      const gid = __game.spawn('ghost', gv, 0, 12);
      const cid = __game.spawn('costume', 'cat', 0.45, 13.2);
      __game.step(1 / 60, 1);
      const ents = __game.state.entities;
      const g = ents.find((e) => e.id === gid);
      const c = ents.find((e) => e.id === cid);
      // 仮装がおばけから少し横にずれて、一部が見えている配置にする
      c.dx = c.x - g.x;
      const b = g.box;
      let costumeInGhostBox = 0;
      let ghostHits = 0;
      for (let y = b.y0; y <= b.y1; y += 2) {
        for (let x = b.x0; x <= b.x1; x += 2) {
          const id = __game.hitTest(x, y);
          if (id === cid) costumeInGhostBox++;
          if (id === gid) ghostHits++;
        }
      }
      // おばけの胴体の真ん中
      const torso = __game.hitTest(g.x, (b.y0 + b.y1) / 2);
      out.push({ gv, dx: Math.round(c.dx), costumeInGhostBox, ghostHits, torsoIsGhost: torso === gid });
    }
    return out;
  });
  check(
    '当たり判定：おばけの後ろの仮装の見えている部分は仮装に当たる',
    overlap.every((o) => Math.abs(o.dx) >= 8 && o.costumeInGhostBox > 0 && o.ghostHits > 0 && o.torsoIsGhost),
    overlap.map((o) => `${o.gv}(ずれ${o.dx}px):仮装${o.costumeInGhostBox}/おばけ${o.ghostHits}${o.torsoIsGhost ? '' : '(胴NG)'}`).join(' '),
  );
  await page.evaluate(() => {
    __game.start();
    __game.setManual(true);
    __game.setSpawning(false);
    __game.seed(7);
    __game.spawn('ghost', 'vampire', 0, 12);
    __game.spawn('costume', 'cat', 0.45, 13.2);
    __game.step(1 / 60, 1);
  });
  await page.screenshot({ path: 'shots/04b-overlap.png' });

  // ---- 判定：仮装を叩く → 成敗
  const judge = await page.evaluate(() => {
    const out = {};
    const fresh = () => {
      __game.start();
      __game.setManual(true);
      __game.setSpawning(false);
    };
    fresh();
    let id = __game.spawn('costume', 'pumpkin', 0);
    __game.step(1 / 60, 60);
    __game.tapEntity(id);
    out.costume = __game.state;
    __game.step(1 / 60, 20);
    out.bustFrame = true;

    fresh();
    id = __game.spawn('ghost', 'yurei', 0);
    __game.step(1 / 60, 60);
    __game.tapEntity(id);
    out.ghost = __game.state;

    fresh();
    id = __game.spawn('normal', 'salaryman', 0);
    __game.step(1 / 60, 60);
    __game.tapEntity(id);
    out.normal = __game.state;

    fresh();
    __game.spawn('costume', 'witch', 0);
    __game.step(1 / 60, 60 * 12);
    out.passCostume = __game.state;

    fresh();
    __game.spawn('ghost', 'sheet', 0);
    __game.spawn('normal', 'student', 0.5);
    __game.step(1 / 60, 60 * 12);
    out.passOthers = __game.state;

    fresh();
    __game.tapAt(270, 600);
    out.tapEmpty = __game.state;
    return out;
  });
  check('仮装を叩くと成敗+1', judge.costume.score === 1 && judge.costume.misses === 0);
  check('本物のお化けを叩くとミス', judge.ghost.misses === 1 && judge.ghost.score === 0, judge.ghost.missLog.join());
  check('普通の人を叩くとミス', judge.normal.misses === 1, judge.normal.missLog.join());
  check('仮装を規制線の外へ通すとミス', judge.passCostume.misses === 1, judge.passCostume.missLog.join());
  check('幽霊・普通の人を通してもミスにならない', judge.passOthers.misses === 0);
  check('何もない所を叩いてもミスにならない', judge.tapEmpty.misses === 0);

  // ---- 成敗の瞬間と祟りの瞬間を撮る
  await page.evaluate(() => {
    __game.start();
    __game.setManual(true);
    __game.setSpawning(false);
    const a = __game.spawn('costume', 'vampire', -1, 9);
    const b = __game.spawn('ghost', 'vampire', 1, 9);
    __game.step(1 / 60, 2);
    __game.tapEntity(a);
    __game.step(1 / 60, 9);
  });
  await page.screenshot({ path: 'shots/05-bust.png' });
  await page.evaluate(() => __game.step(1 / 60, 40));
  await page.screenshot({ path: 'shots/06-bust-after.png' });

  // ---- ミスするとリプレイ → タップでスキップ
  const rp = await page.evaluate(() => {
    __game.start();
    __game.setManual(true);
    __game.setSpawning(false);
    __game.spawn('costume', 'witch', 0.8, 22);
    const id = __game.spawn('ghost', 'vampire', -0.6, 12);
    __game.step(1 / 60, 50);
    __game.tapEntity(id);
    const before = __game.state.mode;
    __game.step(1 / 60, 30);
    return { before, after: __game.state.mode, phase: __game.state.replay };
  });
  check('ミスの直後はまだ再生しない（ハリセンが当たるまで）', rp.before === 'play');
  check('ミスするとリプレイが始まる', rp.after === 'replay' && rp.phase === 'play');
  await page.evaluate(() => __game.step(1 / 60, 50));
  await page.screenshot({ path: 'shots/10-replay-play.png' });
  await page.evaluate(() => __game.step(1 / 60, 120));
  st = await page.evaluate(() => __game.state);
  check('スロー再生のあと目印の説明になる', st.replay === 'explain');
  await page.evaluate(() => __game.step(1 / 60, 90));
  await page.screenshot({ path: 'shots/11-replay-explain-ghost.png' });
  await page.mouse.click(195, 400);
  st = await page.evaluate(() => __game.state);
  check('リプレイ中にタップでスキップして再開', st.mode === 'play' && st.misses === 1);
  // 見逃しと普通の人のリプレイも撮る
  for (const [name, setup] of [
    ['pass', "__game.spawn('costume', 'sheet', 0.5, 12); __game.step(1/60, 60*2.2);"],
    ['normal', "const id = __game.spawn('normal', 'salaryman', -0.5, 11); __game.step(1/60, 30); __game.tapEntity(id); __game.step(1/60, 30);"],
  ]) {
    await page.evaluate((code) => {
      __game.start();
      __game.setManual(true);
      __game.setSpawning(false);
      eval(code);
      let g = 0;
      while (__game.state.replay !== 'explain' && g++ < 600) __game.step(1 / 60);
      __game.step(1 / 60, 110);
    }, setup);
    st = await page.evaluate(() => __game.state);
    check(`${name} のミスでも説明が出る`, st.replay === 'explain');
    await page.screenshot({ path: `shots/12-replay-explain-${name}.png` });
  }
  // 放っておくと自動で再開する
  await page.evaluate(() => __game.step(1 / 60, 60 * 4));
  st = await page.evaluate(() => __game.state);
  check('リプレイは放っておくと自動で終わる', st.mode === 'play');

  // ---- ミスのあとは交差点を空にして再開する（通常の出現あり）
  await page.evaluate(() => {
    __game.start();
    __game.setManual(true);
    __game.step(1 / 60, 60 * 4); // 何人か歩いている状態にする
    const id = __game.spawn('normal', 'salaryman', 0, 12);
    __game.step(1 / 60, 30);
    __game.tapEntity(id);
    __game.step(1 / 60, 40);
  });
  const before = (await page.evaluate(() => __game.state)).entities.length;
  st = await page.evaluate(() => { __game.skipReplay(); return __game.state; });
  check('ミスのあとは交差点の人が全員消えて再開する', before > 1 && st.mode === 'play' && st.entities.length === 0, `リプレイ前 ${before}人 → ${st.entities.length}人`);
  st = await page.evaluate(() => { __game.step(1 / 60, 60 * 1.5); return __game.state; });
  check('空にしたあと、また人が現れる', st.entities.length > 0, `${st.entities.length}人`);

  // ---- 3回ミスでゲームオーバー → 結果画面
  await page.evaluate(() => {
    __game.start();
    __game.setManual(true);
    __game.setSpawning(false);
    for (let i = 0; i < 3; i++) {
      const id = __game.spawn('normal', 'salaryman', 0, 12);
      __game.step(1 / 60, 30);
      __game.tapEntity(id);
      __game.step(1 / 60, 40);
      __game.skipReplay();
    }
    __game.step(1 / 60, 60 * 3);
  });
  st = await page.evaluate(() => __game.state);
  check('ミス3回で結果画面', st.mode === 'result' && (await page.isVisible('#result')));
  await page.screenshot({ path: 'shots/07-result.png' });
  // ---- 結果画面からミスのリプレイを見返す
  const nBtn = await page.locator('.miss-replay').count();
  check('結果画面のミスがリプレイボタンになっている', nBtn === 3, `${nBtn}個`);
  await page.locator('.miss-replay').nth(1).click();
  st = await page.evaluate(() => __game.state);
  check('ミスをタップするとリプレイが始まる', st.mode === 'review' && !(await page.isVisible('#result')));
  await page.evaluate(() => __game.step(1 / 60, 60 * 2.6));
  await page.screenshot({ path: 'shots/07b-review.png' });
  await page.mouse.click(195, 400);
  st = await page.evaluate(() => __game.state);
  check('タップで結果画面に戻る', st.mode === 'result' && (await page.isVisible('#result')));
  await page.locator('.miss-replay').nth(2).click();
  await page.evaluate(() => __game.step(1 / 60, 60 * 8));
  st = await page.evaluate(() => __game.state);
  check('見返しは放っておいても結果画面に戻る', st.mode === 'result' && (await page.isVisible('#result')));
  await page.click('#btn-retry');
  st = await page.evaluate(() => __game.state);
  check('もう一度出動でリセット', st.mode === 'play' && st.score === 0 && st.misses === 0);

  // ---- 通常プレイ中の画面（レベル別）
  for (const lv of [0, 6, 13, 19]) {
    await page.evaluate((lv) => {
      __game.start();
      __game.setManual(true);
      __game.seed(100 + lv);
      // 内部レベルを上げるため、正しく成敗し続ける
      const target = lv * __game.config.levelEvery;
      let guard = 0;
      while (__game.state.score < target && guard++ < 60 * 600) {
        __game.step(1 / 60);
        for (const e of __game.state.entities) {
          if (e.state === 'walk' && e.kind === 'costume' && e.z < 16) __game.tapEntity(e.id);
        }
      }
      __game.step(1 / 60, 120);
    }, lv);
    await page.screenshot({ path: `shots/08-play-lv${lv + 1}.png` });
  }

  // ---- 単純な攻略で勝てないか（ボット）
  const bots = await page.evaluate(() => {
    // 他の人に隠れていない、見えている部分を叩く
    function tapVisible(e) {
      const b = e.box;
      for (let fy = 0.15; fy < 1; fy += 0.15) {
        for (const fx of [0.5, 0.3, 0.7]) {
          const x = b.x0 + (b.x1 - b.x0) * fx;
          const y = b.y0 + (b.y1 - b.y0) * fy;
          if (__game.hitTest(x, y) === e.id) return __game.tapAt(x, y);
        }
      }
      return null; // 完全に隠れている
    }
    function run(policy, seed, cap = 600) {
      __game.start();
      __game.setManual(true);
      __game.seed(seed);
      __game.drainEvents();
      const seen = new Map();
      let cool = 0;
      let t = 0;
      while (['play', 'replay'].includes(__game.state.mode) && t < cap) {
        if (__game.state.mode === 'replay') __game.skipReplay();
        __game.step(1 / 60);
        t += 1 / 60;
        cool -= 1 / 60;
        for (const e of __game.state.entities) {
          // 人間は、ある程度大きく見えてから判断し始める
          if (!seen.has(e.id) && e.z < 20) seen.set(e.id, t);
          if (!seen.has(e.id)) continue;
          if (e.state !== 'walk') continue;
          if (policy === 'all' && e.z < 25) __game.tapEntity(e.id);
          if (policy === 'perfect' && e.kind === 'costume' && e.z < 14) tapVisible(e);
          if (policy === 'human' && cool <= 0 && t - seen.get(e.id) > 0.9) {
            // 反応0.9秒・1タップ0.4秒・幽霊っぽいものは8%で見間違える
            const confusing = ['sheet', 'yurei', 'ochimusha'].includes(e.variant) || e.monster || e.kind === 'costume';
            const wrong = confusing && Math.random() < 0.08;
            const isCostume = e.kind === 'costume';
            if (isCostume !== wrong) {
              if (!tapVisible(e)) continue;
              cool = 0.4;
              seen.set(e.id, Infinity);
            } else seen.set(e.id, Infinity);
          }
        }
      }
      const s = __game.state;
      return { score: s.score, time: Math.round(t), level: s.level + 1, misses: s.missLog };
    }
    const out = {};
    for (const p of ['none', 'all', 'perfect', 'human']) {
      out[p] = [1, 2, 3, 4, 5].map((seed) => run(p, seed, p === 'perfect' ? 240 : 600));
    }
    return out;
  });
  for (const [p, rs] of Object.entries(bots)) {
    console.log(`  bot:${p.padEnd(8)} ` + rs.map((r) => `${r.score}人/${r.time}s/Lv${r.level}`).join('  '));
  }
  check('何もしないと0人で終わる', bots.none.every((r) => r.score === 0));
  check('全部叩くと早く終わる', bots.all.every((r) => r.score < 10));
  const avg = bots.perfect.reduce((a, r) => a + r.time, 0) / bots.perfect.length;
  console.log('  perfect のミス理由: ' + bots.perfect.flatMap((r) => r.misses).join(', '));
  check('正しく叩けば平均2分半以上続く', avg >= 150, `平均${Math.round(avg)}秒`);

  // ---- 小さいスマホ・PC
  for (const [w, h, name] of [[360, 640, 'small'], [1280, 800, 'pc']]) {
    const p2 = await browser.newPage({ viewport: { width: w, height: h } });
    await p2.goto(URL);
    await p2.waitForFunction(() => window.__game);
    const box = await p2.locator('#stage').boundingBox();
    const btn = await p2.locator('#btn-start').boundingBox();
    check(`${name} ${w}x${h} で画面が収まる`, box.height <= h + 1 && box.width <= w + 1 && btn.y + btn.height <= box.y + box.height);
    await p2.screenshot({ path: `shots/09-${name}.png` });
    // 結果画面（ミス3つ）が収まるか
    await p2.evaluate(() => {
      __game.start();
      __game.setManual(true);
      __game.setSpawning(false);
      for (let i = 0; i < 3; i++) {
        const id = __game.spawn(i === 1 ? 'ghost' : 'normal', i === 1 ? 'pumpkin' : 'tourist', 0, 12);
        __game.step(1 / 60, 30);
        __game.tapEntity(id);
        __game.step(1 / 60, 40);
        __game.skipReplay();
      }
      __game.step(1 / 60, 60 * 3);
    });
    const rb = await p2.locator('#btn-title').boundingBox();
    check(`${name} の結果画面が収まる`, rb && rb.y + rb.height <= box.y + box.height);
    await p2.screenshot({ path: `shots/09-${name}-result.png` });
    await p2.close();
  }

  check('コンソールエラーなし', errors.length === 0, errors.slice(0, 3).join(' / '));
} finally {
  await browser.close();
  server?.kill();
}

const ng = results.filter((r) => !r.ok);
console.log(`\n${results.length - ng.length}/${results.length} OK`);
process.exit(ng.length ? 1 : 0);

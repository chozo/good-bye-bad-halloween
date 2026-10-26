// OGP 画像（public/ogp.png、1200×630）を作る。dev サーバー（http://localhost:5173/）を起動してから実行する
// 1. ゲームを固定の乱数で進め、仮装・本物のおばけ・普通の人が並んだ場面を撮る
// 2. tools/ogp/ogp.html でその画面に文字とキャラクターを重ねて撮る
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = process.env.BASE || 'http://localhost:5173/';
const tmp = path.join(root, 'tools/ogp/scene.png');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  // ---- 1. ゲーム画面
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await page.goto(BASE);
  await page.evaluate(() => {
    const g = window.__game;
    g.seed(3);
    g.start();
    g.setManual(true);
    g.setSpawning(false);
    // 奥から手前へ、仮装・本物・普通の人を並べる
    g.config.levels.forEach((l) => (l.talkChance = 0)); // 吹き出しは成敗の一言だけ
    g.spawn('costume', 'pumpkin', -1.8, 25);
    g.spawn('ghost', 'sheet', 0.4, 22);
    g.spawn('normal', 'tourist', -0.9, 16);
    g.spawn('costume', 'witch', 1.4, 13);
    g.spawn('ghost', 'vampire', -1.5, 10.5);
    const id = g.spawn('costume', 'cat', 0.6, 8.2);
    g.step(1 / 60, 20);
    g.tapEntity(id); // 成敗の瞬間
    g.step(1 / 60, 4);
  });
  await page.evaluate(() => {
    for (const id of ['hud', 'mute']) document.getElementById(id).style.visibility = 'hidden';
  });
  await page.locator('#game').screenshot({ path: tmp });
  await page.close();

  // ---- 2. 文字とキャラクターを重ねる
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const url = process.env.OGP_URL || 'game.chozo.net/goodbye-bad-halloween/'; // 画像に載せる公開URL
  await og.goto(new URL('tools/ogp/ogp.html', BASE).href + (url ? `?url=${encodeURIComponent(url)}` : ''));
  await og.waitForFunction(() => document.body.dataset.ready === '1');
  await og.screenshot({ path: path.join(root, 'public/ogp.png') });
  console.log('public/ogp.png を書き出しました');
} finally {
  await browser.close();
  await fs.rm(tmp, { force: true });
}

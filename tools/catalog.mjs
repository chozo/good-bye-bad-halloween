// キャラクター一覧を画像に書き出す。npm run dev を起動した状態で: npm run catalog
// 出力: docs/patterns/
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base = process.env.URL || 'http://localhost:5173';
const out = 'docs/patterns';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1148, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`${base}/tools/catalog/`);
await page.waitForSelector('body[data-ready="1"]');
await page.screenshot({ path: `${out}/00-all.png`, fullPage: true });
const parts = { normal: '01-normal', costume: '02-costume', ghostlike: '03-costume-ghostlike', props: '04-props', ghost: '05-ref-real-ghost' };
for (const [id, name] of Object.entries(parts)) {
  await page.locator(`#${id}`).screenshot({ path: `${out}/${name}.png` });
}
await browser.close();
console.log(`書き出し: ${out}/`);

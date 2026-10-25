// 公開用ファイルを dist/good-bye-bad-halloween/ に書き出す（ビルド工程はなく、コピーするだけ）
// index.html と src/ をそのまま、public/ の中身を直下に置く
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SLUG = 'good-bye-bad-halloween';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', SLUG);

await fs.rm(path.join(root, 'dist'), { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
await fs.copyFile(path.join(root, 'index.html'), path.join(out, 'index.html'));
await fs.cp(path.join(root, 'src'), path.join(out, 'src'), { recursive: true });
await fs.cp(path.join(root, 'public'), out, { recursive: true });

const files = await fs.readdir(out, { recursive: true });
console.log(`dist/${SLUG}/ に ${files.length} 個を書き出しました`);

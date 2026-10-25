// 開発用の静的サーバー。public/ の中身はルートのパスでも返す
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = url.endsWith('/') ? url + 'index.html' : url;
  for (const base of [root, path.join(root, 'public')]) {
    const file = path.join(base, rel);
    if (!file.startsWith(base)) break;
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
      return;
    } catch {}
  }
  res.writeHead(404);
  res.end('not found');
}).listen(port, () => console.log(`http://localhost:${port}/`));

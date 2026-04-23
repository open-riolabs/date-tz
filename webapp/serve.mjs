import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 5173;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = normalize(join(root, urlPath === '/' ? '/index.html' : urlPath));
    if (!filePath.startsWith(resolve(root))) { res.writeHead(403).end('Forbidden'); return; }
    try { const s = await stat(filePath); if (s.isDirectory()) filePath = join(filePath, 'index.html'); }
    catch { res.writeHead(404).end('Not found'); return; }
    const buf = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  } catch (err) { res.writeHead(500).end(String(err)); }
});

server.listen(port, () => {
  console.log(`DateTz Playground running → http://localhost:${port}/`);
});

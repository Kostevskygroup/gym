// node tools/serve.mjs [port] — отдаёт папку приложения без кэша (для e2e, снимков и предпросмотра). По умолчанию 8767.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, extname, normalize} from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname, PORT = +(process.argv[2] || 8767);
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain'};
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
  if (!file.startsWith(ROOT)) {res.writeHead(403).end(); return;}
  try {
    const body = await readFile(file);
    res.writeHead(200, {'content-type': (TYPES[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store'}).end(body);
  } catch (e) {res.writeHead(404).end('not found');}
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}/`));

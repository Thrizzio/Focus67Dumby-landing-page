import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../web/', import.meta.url)));
const port = Number(process.env.PORT || process.argv[2] || 4173);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function safePath(urlPath) {
  const pathname = decodeURIComponent((urlPath || '/').split('?')[0]);
  const relative = (pathname === '/' || pathname === '') ? 'index.html' : pathname.replace(/^[/\\]+/, '');
  const candidate = normalize(join(root, relative));
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

const server = createServer((request, response) => {
  const filePath = safePath(request.url);
  if (!filePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  try {
    let stat = statSync(filePath);
    let target = filePath;
    if (stat.isDirectory()) {
      target = join(filePath, 'index.html');
      stat = statSync(target);
    }
    if (!stat.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Content-Type': contentTypes[extname(target)] || 'application/octet-stream'
    });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    process.stderr.write(`Port ${port} is already in use. Stop the existing process or run with another port (e.g. npm start -- ${port + 1}).\n`);
  } else {
    process.stderr.write(`Server error: ${err.message}\n`);
  }
  process.exit(1);
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Focus67Dumby web preview listening on http://localhost:${port}\n`);
});


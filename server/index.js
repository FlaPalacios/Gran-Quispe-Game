// Servidor del modo online: sirve el juego compilado (dist/) y lleva las salas por WebSockets.
// Se arranca con `npm run online` (compila y levanta todo en el puerto 3000). En Render,
// el puerto llega en PORT (ver render.yaml).
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Server } from 'socket.io';
import { RoomError, createRooms } from './rooms.js';

const PORT = Number(process.env.PORT) || 3000;
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const DIST_ROOT = DIST.endsWith(sep) ? DIST : DIST + sep;
const ASSETS_ROOT = join(DIST_ROOT, 'assets') + sep;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
// Texto que vale la pena comprimir: Phaser pasa de 1,2 MB a ~320 KB. Imágenes y audio ya
// vienen comprimidos. Se comprime una vez por archivo y se guarda: dist/ no cambia mientras
// el servidor corre (cada despliegue lo reinicia).
const COMPRESSIBLE = new Set(['.js', '.css', '.json', '.svg']);
const gzipped = new Map();

// La dirección pública, para la vista previa al compartir. El Host viene del cliente: solo se
// usa si es un nombre de host normal, para no poder meter nada raro en el HTML.
function siteUrl(req) {
  const host = req.headers.host ?? '';
  if (!/^[\w.-]+(:\d+)?$/.test(host)) return '';
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${host}`;
}

// Archivos estáticos de dist/, sin salir de esa carpeta. Cualquier petición rara (una URL mal
// codificada, un archivo que desaparece a media lectura) responde con error y nada más.
const http = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(DIST, path === '/' ? 'index.html' : path));
    if (!file.startsWith(DIST_ROOT)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404).end('No encontrado. ¿Corriste npm run build?');
      return;
    }
    const ext = extname(file);
    const headers = {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      // Lo de assets/ lleva el hash en el nombre: si cambia, cambia el nombre, así que el
      // navegador lo guarda para siempre. Lo demás (index.html) se revisa en cada visita.
      'Cache-Control': file.startsWith(ASSETS_ROOT) ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');

    if (ext === '.html') {
      const html = (await readFile(file, 'utf8')).replaceAll('__SITE_URL__', siteUrl(req));
      res.writeHead(200, headers).end(html);
      return;
    }
    if (COMPRESSIBLE.has(ext) && acceptsGzip) {
      if (!gzipped.has(file)) gzipped.set(file, gzipSync(await readFile(file)));
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }).end(gzipped.get(file));
      return;
    }
    // Pedazos de un archivo: Safari los pide para la música y sin ellos no la reproduce
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
        return;
      }
      res.writeHead(206, {
        ...headers,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${info.size}`,
        'Content-Length': end - start + 1,
      });
      createReadStream(file, { start, end })
        .on('error', () => res.destroy())
        .pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Length': info.size });
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(400);
    res.end();
  }
});

// Solo se aceptan conexiones desde el propio juego: otra página web no puede abrir un socket
const io = new Server(http, {
  allowRequest: (req, callback) => {
    const { origin, host } = req.headers;
    let sameSite = !origin; // sin Origin no es un navegador (por ejemplo, un test)
    try {
      sameSite ||= new URL(origin).host === host;
    } catch {
      sameSite = false;
    }
    callback(null, sameSite);
  },
});
const rooms = createRooms({ send: (socketId, event, data) => io.to(socketId).emit(event, data) });

io.on('connection', (socket) => {
  // Cada pedido responde { ok } o { error } con el código del problema
  const handle = (event, fn) =>
    socket.on(event, (payload, reply) => {
      try {
        const result = fn(socket.id, payload ?? {});
        if (typeof reply === 'function') reply({ ok: true, ...result });
      } catch (error) {
        // Lo que no es un error de sala o de reglas es un fallo nuestro: se anota
        if (!(error instanceof RoomError) && error?.name !== 'GameRuleError') console.error(error);
        if (typeof reply === 'function') reply({ error: error?.code ?? 'ERROR' });
      }
    });

  handle('create', rooms.create);
  handle('join', rooms.join);
  handle('rejoin', rooms.rejoin);
  handle('configure', rooms.configure);
  handle('addBot', rooms.addBot);
  handle('removeSeat', rooms.removeSeat);
  handle('start', rooms.start);
  handle('action', rooms.action);
  handle('shake', rooms.shake);
  handle('react', rooms.react);
  handle('leave', rooms.quit);
  socket.on('disconnect', () => rooms.disconnect(socket.id));
});

// Último resguardo: un error que se escape no tumba el servidor con todas las salas
process.on('uncaughtException', (error) => console.error(error));

http.listen(PORT, () => console.log(`Gran Quispe online en http://localhost:${PORT} (en la red local, con la IP de esta PC)`));

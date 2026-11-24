// Servidor del modo online: sirve el juego compilado (dist/) y lleva las salas por WebSockets.
// Se arranca con `npm run online` (compila y levanta todo en el puerto 3000).
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomError, createRooms } from './rooms.js';

const PORT = Number(process.env.PORT) || 3000;
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const DIST_ROOT = DIST.endsWith(sep) ? DIST : DIST + sep;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

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
    if (!(await stat(file).catch(() => null))?.isFile()) {
      res.writeHead(404).end('No encontrado. ¿Corriste npm run build?');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
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

// Conexión con el servidor del modo online (server/index.js). Mientras dura, el store manda
// las acciones al servidor y recibe de él el estado de la partida, solo con lo que este
// celular puede ver.
import { io } from 'socket.io-client';
import { clearOnlineSeat, loadOnlineSeat, saveOnlineSeat } from '../storage/localSave.js';

// Si el servidor no contesta en este tiempo, no está corriendo o no se llega a él
const REPLY_TIMEOUT_MS = 6000;

// onLobby(lobby): llegó cómo está la sala. onLost(código): se perdió la sala (o el servidor).
export function createOnline(store, { onLobby, onLost }) {
  let socket = null;
  let seat = null; // { code, playerId, token }

  function connect() {
    if (socket) return socket;
    socket = io();
    socket.on('lobby', onLobby);
    socket.on('state', ({ game, you, elapsed }) => store.receive(game, { you, elapsed }));
    socket.on('signal', (name) => store.receiveSignal(name));
    // Este asiento se abrió en otro celular o pestaña
    socket.on('lost', (code) => lose(code));
    // Tras un corte (pantalla bloqueada, wifi) se vuelve al mismo asiento
    socket.on('connect', () => {
      if (seat) request('rejoin', seat).catch((error) => lose(error.message));
    });
    store.useRemote({
      // Una acción que el servidor rechaza (un TIMEOUT que llegó tarde, un doble toque) no
      // cambia nada: el estado bueno es el que el servidor vuelve a mandar
      dispatch: (action) => request('action', action).catch(() => {}),
      shake: () => socket.emit('shake'),
    });
    return socket;
  }

  function request(event, payload) {
    return new Promise((resolve, reject) => {
      connect()
        .timeout(REPLY_TIMEOUT_MS)
        .emit(event, payload, (timeout, reply) => {
          if (timeout) reject(new Error('ERROR'));
          else if (reply.error) reject(new Error(reply.error));
          else resolve(reply);
        });
    });
  }

  function remember({ code, playerId, token }) {
    seat = { code, playerId, token };
    saveOnlineSeat(seat);
    return seat;
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
    seat = null;
    clearOnlineSeat();
    store.useRemote(null);
  }

  function lose(code) {
    disconnect();
    onLost(code);
  }

  return {
    create: (setup, name) => request('create', { setup, name }).then(remember),
    join: (code, name) => request('join', { code, name }).then(remember),
    // Empezar, o volver a jugar cuando terminó la partida (solo quien creó la sala)
    start: () => request('start'),

    leave() {
      socket?.emit('leave');
      disconnect();
    },

    // Al abrir el juego: si había un asiento guardado, se intenta volver a esa sala
    resume() {
      seat = loadOnlineSeat();
      if (seat) connect();
      return Boolean(seat);
    },

    get playerId() {
      return seat?.playerId ?? null;
    },
  };
}

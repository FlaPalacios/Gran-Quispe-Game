// Conexión con el servidor del modo online (server/index.js). Mientras dura, el store manda
// las acciones al servidor y recibe de él el estado de la partida, solo con lo que este
// celular puede ver.
import { io } from 'socket.io-client';
import { t } from '../i18n/index.js';
import { clearOnlineSeat, loadOnlineSeat, saveOnlineSeat } from '../storage/localSave.js';

// Si el servidor no contesta en este tiempo, no está corriendo o no se llega a él
const REPLY_TIMEOUT_MS = 6000;

// onLobby(lobby): llegó cómo está la sala. onLost(código): se perdió la sala (o el servidor).
// onReaction({ playerId, reaction }): alguien mandó un sticker.
export function createOnline(store, { onLobby, onLost, onReaction }) {
  let socket = null;
  let seat = null; // { code, playerId, token }

  function connect() {
    if (socket) return socket;
    socket = io();
    socket.on('lobby', onLobby);
    socket.on('state', ({ game, you, elapsed, presence = [] }) => store.receive(withBotNames(game, presence), { you, elapsed, presence }));
    socket.on('signal', (name) => store.receiveSignal(name));
    socket.on('reaction', onReaction);
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

  // Por quien se desconectó juega un bot: se nota en su nombre, en las tarjetas y en los paneles
  function withBotNames(game, presence) {
    const auto = new Set(presence.filter((p) => p.autopilot).map((p) => p.id));
    if (!auto.size) return game;
    return { ...game, players: game.players.map((p) => (auto.has(p.id) ? { ...p, name: t('online.botName', { name: p.name }) } : p)) };
  }

  function remember({ code, playerId, token }) {
    seat = { code, playerId, token };
    saveOnlineSeat(seat);
    return seat;
  }

  // `keepSeat`: salió a propósito y puede volver con el código; el asiento se guarda marcado
  // para no reentrar solo al abrir el juego
  function disconnect({ keepSeat = false } = {}) {
    socket?.disconnect();
    socket = null;
    if (keepSeat && seat) saveOnlineSeat({ ...seat, left: true });
    else clearOnlineSeat();
    seat = null;
    store.useRemote(null);
  }

  function lose(code) {
    disconnect();
    onLost(code);
  }

  return {
    // Crear la sala con su nombre y las reglas de partida; los bots y lo demás se ajustan dentro
    create: (name, config) => request('create', { name, config }).then(remember),
    // Si es la sala de la que salió este mismo celular, vuelve a su asiento con el token; si
    // no, entra como nuevo (o, con la partida empezada, recupera el asiento con su nombre)
    join(code, name) {
      const saved = loadOnlineSeat();
      if (saved?.code === code.toUpperCase()) {
        seat = saved;
        return request('rejoin', saved)
          .then(remember)
          .catch(() => request('join', { code, name }).then(remember));
      }
      return request('join', { code, name }).then(remember);
    },
    react: (reaction) => socket?.emit('react', { reaction }),
    // Solo quien creó la sala, antes de empezar
    configure: (config) => request('configure', { config }),
    addBot: (personality, name) => request('addBot', { personality, name }),
    removeSeat: (seatId) => request('removeSeat', { seatId }),
    // Empezar, o volver a jugar cuando terminó la partida (solo quien creó la sala)
    start: () => request('start'),

    leave() {
      socket?.emit('leave');
      disconnect({ keepSeat: true });
    },

    // Al abrir el juego: si había un asiento guardado, se intenta volver a esa sala
    resume() {
      const saved = loadOnlineSeat();
      if (!saved || saved.left) return false;
      seat = saved;
      connect();
      return true;
    },

    get playerId() {
      return seat?.playerId ?? null;
    },
  };
}

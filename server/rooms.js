// Salas del modo online. Cada sala juega su partida con el mismo store y los mismos bots que
// el modo de un solo celular, y a cada jugador le manda solo lo que puede ver (viewFor).
// No sabe nada de sockets: recibe `send(socketId, evento, datos)` para poder probarlo.
// Todo lo que llega de un celular se trata como no confiable.
import { randomBytes } from 'node:crypto';
import { connectBots } from '../src/app/botPlayer.js';
import { createGameStore } from '../src/app/gameStore.js';
import { PERSONALITIES, botAction } from '../src/engine/bots.js';
import { MAX_PLAYERS, PHASES, createGame, viewFor } from '../src/engine/rules.js';

// Sin I ni O, para que no se confundan con 1 y 0 al dictar el código
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const NAME_MAX = 16;
const PENALTY_MAX = 80;
// Tope de salas a la vez: lo que llega de afuera no puede llenar la memoria
const MAX_ROOMS = 500;
// Lo que se le guarda el asiento a quien se desconecta antes de que juegue un bot por él
export const RECONNECT_GRACE_MS = 60_000;
// Pausa del bot suplente, como la de los bots de verdad
const AUTOPILOT_MS = 1500;
// Una sala sin ninguna persona conectada se borra pasado este tiempo
const EMPTY_ROOM_MS = 10 * 60_000;
// Las sacudidas se reparten a todos: más seguidas que esto no se reenvían
const SHAKE_MIN_MS = 150;

// En el servidor los dados salen de un azar que no se puede predecir mirando tiradas
// (48 bits al azar llevados a [0, 1), como Math.random)
const secureRandom = () => randomBytes(6).readUIntBE(0, 6) / 2 ** 48;

export class RoomError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const cleanName = (name) => (typeof name === 'string' ? name.trim().slice(0, NAME_MAX) : '');
const newToken = () => randomBytes(12).toString('hex');

// Un error dentro de un temporizador tumbaría el proceso y con él todas las salas
const safe = (fn) => () => {
  try {
    fn();
  } catch (error) {
    console.error(error);
  }
};

export function createRooms({ send, rng = secureRandom }) {
  const rooms = new Map();
  const roomOfSocket = new Map();

  function newCode() {
    if (rooms.size >= MAX_ROOMS) throw new RoomError('BUSY');
    for (let tries = 0; tries < 100; tries++) {
      const code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)]).join('');
      if (!rooms.has(code)) return code;
    }
    throw new RoomError('BUSY');
  }

  // Lo que todos ven en la sala de espera (los tokens nunca salen de aquí)
  const lobbyOf = (room) => ({
    code: room.code,
    started: Boolean(room.store.get().game),
    seats: room.seats.map(({ id, name, isBot, personality, socketId, connected }) => ({
      id,
      name,
      isBot,
      personality,
      taken: isBot || Boolean(socketId),
      connected: isBot || connected,
      host: id === room.hostId,
    })),
  });

  function broadcastLobby(room) {
    for (const seat of room.seats) if (seat.socketId) send(seat.socketId, 'lobby', { ...lobbyOf(room), you: seat.id });
  }

  function broadcastState(room) {
    const { game, turnStartedAt } = room.store.get();
    if (!game) return;
    const elapsed = turnStartedAt == null ? null : Date.now() - turnStartedAt;
    for (const seat of room.seats) {
      if (seat.socketId) send(seat.socketId, 'state', { game: viewFor(game, seat.id), you: seat.id, elapsed });
    }
  }

  const seatOf = (room, socketId) => room.seats.find((s) => s.socketId === socketId);

  function roomOf(socketId) {
    const room = rooms.get(roomOfSocket.get(socketId));
    if (!room) throw new RoomError('NO_ROOM');
    return room;
  }

  function sit(room, seat, socketId) {
    seat.socketId = socketId;
    seat.connected = true;
    seat.autopilot = false;
    clearTimeout(seat.graceTimer);
    clearTimeout(room.emptyTimer);
    roomOfSocket.set(socketId, room.code);
    autopilot(room); // si el suplente estaba por jugar por este asiento, ya no
    return { code: room.code, playerId: seat.id, token: seat.token };
  }

  // Suelta el asiento de un socket. `quit`: salió a propósito, así que el suplente entra ya.
  function release(socketId, { quit = false } = {}) {
    const room = rooms.get(roomOfSocket.get(socketId));
    roomOfSocket.delete(socketId);
    const seat = room && seatOf(room, socketId);
    if (!seat) return;
    seat.socketId = null;
    seat.connected = false;
    if (room.store.get().game) {
      // Se le guarda el asiento un rato; si no vuelve, juega un bot por él
      const takeOver = () => {
        seat.autopilot = true;
        autopilot(room);
      };
      if (quit) takeOver();
      else seat.graceTimer = setTimeout(safe(takeOver), RECONNECT_GRACE_MS);
    }
    if (!room.seats.some((s) => s.socketId)) room.emptyTimer = setTimeout(safe(() => destroy(room)), EMPTY_ROOM_MS);
    broadcastLobby(room);
  }

  // Juega por quien se desconectó, cuando le toca y ya se le acabó el tiempo de espera
  function autopilot(room) {
    clearTimeout(room.autopilotTimer);
    const { game, revealing } = room.store.get();
    const seat = room.seats.find((s) => s.id === game?.currentPlayerId);
    if (!seat?.autopilot || revealing) return;
    room.autopilotTimer = setTimeout(
      safe(() => {
        // Si volvió mientras el suplente pensaba, juega él
        if (room.store.get().game !== game || !seat.autopilot) return;
        const action = botAction(game, { rng, personality: 'honest' });
        if (action) room.store.dispatch(action);
      }),
      AUTOPILOT_MS,
    );
  }

  // Reloj de presión: lo lleva el servidor, que es quien manda. El TIMEOUT que mande un
  // celular llega tarde o repetido y el motor lo rechaza sin más.
  function pressureClock(room) {
    clearTimeout(room.clockTimer);
    const { game, turnStartedAt } = room.store.get();
    const clock = game?.config.variants.pressureClock;
    if (!clock?.enabled || turnStartedAt == null) return;
    if (game.phase !== PHASES.CALL && game.phase !== PHASES.DECIDE) return;
    const playerId = game.currentPlayerId;
    room.clockTimer = setTimeout(
      safe(() => {
        if (room.store.get().game !== game) return;
        room.store.dispatch({ type: 'TIMEOUT', playerId });
      }),
      clock.seconds * 1000 - (Date.now() - turnStartedAt),
    );
  }

  function destroy(room) {
    for (const timer of ['autopilotTimer', 'clockTimer', 'emptyTimer']) clearTimeout(room[timer]);
    for (const seat of room.seats) {
      clearTimeout(seat.graceTimer);
      if (seat.socketId) roomOfSocket.delete(seat.socketId);
    }
    room.stopBots();
    room.store.leave();
    rooms.delete(room.code);
  }

  function validSetup(setup) {
    const players = setup?.players;
    if (!Array.isArray(players) || players.length > MAX_PLAYERS) return false;
    if (typeof setup.config?.penaltyText === 'string' && setup.config.penaltyText.length > PENALTY_MAX) return false;
    if (players.some((p) => p?.isBot && !Object.hasOwn(PERSONALITIES, p.personality))) return false;
    if (!players.some((p) => !p?.isBot)) return false;
    // Lo demás lo valida el motor; mejor descubrirlo ahora que al empezar
    try {
      createGame(setup, { rng });
      return true;
    } catch {
      return false;
    }
  }

  return {
    // `setup` es lo que arma el panel de configuración. El primer asiento de persona es
    // de quien crea la sala; los demás de persona quedan libres para quien entre con el código.
    create(socketId, { setup, name } = {}) {
      if (!validSetup(setup)) throw new RoomError('BAD_SETUP');
      release(socketId); // un socket ocupa un solo asiento: si ya tenía uno, lo suelta
      const { players } = setup;
      const host = players.find((p) => !p.isBot);

      const store = createGameStore({ rng, save: () => {}, clear: () => {}, autoViewer: true });
      const room = {
        code: newCode(),
        config: setup.config,
        hostId: `p${players.indexOf(host) + 1}`,
        store,
        lastShakeAt: 0,
        seats: players.map((p, i) => ({
          id: `p${i + 1}`,
          name: p.isBot ? cleanName(p.name) : '',
          isBot: Boolean(p.isBot),
          personality: p.isBot ? p.personality : null,
          token: newToken(),
          socketId: null,
          connected: false,
        })),
      };
      room.stopBots = connectBots(store, { rng });
      store.subscribe(() => {
        broadcastState(room);
        pressureClock(room);
        autopilot(room);
      });
      // Las sacudidas y la partida nueva se reparten a todos, para que suenen y se animen
      store.onSignal((signal) => {
        for (const seat of room.seats) if (seat.socketId) send(seat.socketId, 'signal', signal);
      });
      rooms.set(room.code, room);

      const seat = room.seats.find((s) => s.id === room.hostId);
      seat.name = cleanName(name) || cleanName(host.name) || 'Anfitrión';
      const result = sit(room, seat, socketId);
      broadcastLobby(room);
      return result;
    },

    join(socketId, { code, name } = {}) {
      const room = rooms.get(String(code ?? '').toUpperCase());
      if (!room) throw new RoomError('NO_ROOM');
      if (room.store.get().game) throw new RoomError('STARTED');
      // El asiento de quien creó la sala es suyo aunque se le corte un momento la conexión
      const seat = room.seats.find((s) => !s.isBot && !s.socketId && s.id !== room.hostId);
      if (!seat) throw new RoomError('FULL');
      release(socketId);
      seat.name = cleanName(name) || `Jugador ${seat.id.slice(1)}`;
      // Token nuevo: quien ocupó antes este asiento ya no puede volver a él
      seat.token = newToken();
      const result = sit(room, seat, socketId);
      broadcastLobby(room);
      return result;
    },

    // Volver al asiento tras una desconexión (pantalla bloqueada, se cortó el wifi, recarga)
    rejoin(socketId, { code, playerId, token } = {}) {
      const room = rooms.get(code);
      const seat = room?.seats.find((s) => !s.isBot && s.id === playerId && s.token === token);
      if (!seat) throw new RoomError('NO_ROOM');
      if (seat.socketId !== socketId) {
        release(socketId);
        // Otra pestaña con el mismo asiento: se le avisa en vez de dejarla congelada
        if (seat.socketId) {
          roomOfSocket.delete(seat.socketId);
          send(seat.socketId, 'lost', 'SEAT_TAKEN');
        }
      }
      const result = sit(room, seat, socketId);
      broadcastLobby(room);
      broadcastState(room);
      return result;
    },

    // Solo quien creó la sala, y la primera vez con todos los asientos de persona ocupados.
    // Terminada la partida sirve para jugar otra vez; quien ya no esté lo juega el suplente.
    start(socketId) {
      const room = roomOf(socketId);
      if (seatOf(room, socketId)?.id !== room.hostId) throw new RoomError('NOT_HOST');
      const { game } = room.store.get();
      if (game && game.phase !== PHASES.GAME_OVER) throw new RoomError('STARTED');
      if (!game && room.seats.some((s) => !s.isBot && !s.socketId)) throw new RoomError('SEATS_EMPTY');
      room.store.start({
        config: room.config,
        players: room.seats.map(({ id, name, isBot, personality }) => ({ id, name: name || id, isBot, personality })),
      });
      broadcastLobby(room);
    },

    action(socketId, action) {
      const room = roomOf(socketId);
      const seat = seatOf(room, socketId);
      if (typeof action?.type !== 'string') throw new RoomError('BAD_ACTION');
      // Mientras sube el cubilete nadie se adelanta: todos tienen que ver el resultado
      if (room.store.get().revealing) throw new RoomError('REVEALING');
      // Cada uno juega solo por su asiento. "Siguiente ronda" la puede apretar cualquiera.
      if (action.type !== 'NEXT_ROUND' && action.playerId !== seat.id) throw new RoomError('NOT_YOUR_SEAT');
      const { type, playerId, value, asNumber } = action;
      room.store.dispatch({ type, playerId, value, asNumber });
    },

    shake(socketId) {
      const room = roomOf(socketId);
      const { game } = room.store.get();
      if (game?.phase !== PHASES.ROLL || game.currentPlayerId !== seatOf(room, socketId).id) return;
      if (Date.now() - room.lastShakeAt < SHAKE_MIN_MS) return;
      room.lastShakeAt = Date.now();
      room.store.signal('cupShake');
    },

    // Salir de la sala a propósito: en partida, el suplente juega por ese asiento desde ya
    quit: (socketId) => release(socketId, { quit: true }),

    // Se cortó la conexión: se le guarda el asiento
    disconnect: (socketId) => release(socketId),

    // Solo para los tests
    get: (code) => rooms.get(code),
  };
}

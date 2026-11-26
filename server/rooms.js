// Salas del modo online. Cada sala juega su partida con el mismo store y los mismos bots que
// el modo de un solo celular, y a cada jugador le manda solo lo que puede ver (viewFor).
// No sabe nada de sockets: recibe `send(socketId, evento, datos)` para poder probarlo.
// Todo lo que llega de un celular se trata como no confiable.
import { randomBytes } from 'node:crypto';
import { connectBots } from '../src/app/botPlayer.js';
import { createGameStore } from '../src/app/gameStore.js';
import { PERSONALITIES, botAction } from '../src/engine/bots.js';
import { MAX_PLAYERS, MIN_PLAYERS, PHASES, createGame, viewFor } from '../src/engine/rules.js';

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
// Reacciones rápidas: las que existen (los stickers de src/assets/images/shared/reaccion-*.webp)
// y cada cuánto puede mandar una cada asiento, para que nadie llene la pantalla de los demás
export const REACTIONS = Object.freeze(['risa', 'mentiroso', 'salud', 'sorpresa']);
const REACT_MIN_MS = 2000;

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
// Dos asientos no pueden llamarse igual (sin mirar mayúsculas): en la mesa se confundirían
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
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
    config: room.config,
    maxPlayers: MAX_PLAYERS,
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
    // Quién de las personas está conectado, y por quién juega el suplente
    const presence = room.seats
      .filter((s) => !s.isBot)
      .map(({ id, name, connected, autopilot }) => ({ id, name, connected, autopilot: Boolean(autopilot) }));
    for (const seat of room.seats) {
      if (seat.socketId) send(seat.socketId, 'state', { game: viewFor(game, seat.id), you: seat.id, elapsed, presence });
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
  // En la sala de espera, quien sale a propósito deja libre su lugar (salvo quien la creó).
  function release(socketId, { quit = false } = {}) {
    const room = rooms.get(roomOfSocket.get(socketId));
    roomOfSocket.delete(socketId);
    const seat = room && seatOf(room, socketId);
    if (!seat) return;
    seat.socketId = null;
    seat.connected = false;
    if (quit && !room.store.get().game) {
      // Salió de la sala de espera: libera su lugar. Si era quien la creó, la sala pasa a la
      // siguiente persona (para que nadie quede atrapado); si no queda nadie, se cierra.
      room.seats.splice(room.seats.indexOf(seat), 1);
      if (seat.id === room.hostId) {
        const heir = room.seats.find((s) => !s.isBot && s.socketId) ?? room.seats.find((s) => !s.isBot);
        if (!heir) return destroy(room);
        room.hostId = heir.id;
      }
    }
    if (room.store.get().game) {
      // Se le guarda el asiento un rato; si no vuelve, juega un bot por él
      const takeOver = () => {
        seat.autopilot = true;
        broadcastState(room);
        autopilot(room);
      };
      if (quit) takeOver();
      else seat.graceTimer = setTimeout(safe(takeOver), RECONNECT_GRACE_MS);
    }
    if (!room.seats.some((s) => s.socketId)) room.emptyTimer = setTimeout(safe(() => destroy(room)), EMPTY_ROOM_MS);
    broadcastLobby(room);
    broadcastState(room); // para que los demás vean que se desconectó
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

  // La configuración de reglas que manda quien creó la sala, ya limpia (solo los campos que
  // conoce el motor) o null si no sirve. La valida el motor con dos jugadores de prueba:
  // mejor descubrir ahora que algo no sirve que al empezar.
  function cleanConfig(config) {
    if (typeof config !== 'object' || config === null) return null;
    if (typeof config.penaltyText === 'string' && config.penaltyText.length > PENALTY_MAX) return null;
    try {
      return createGame({ config, players: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }] }, { rng }).config;
    } catch {
      return null;
    }
  }

  const nameTaken = (room, name) => room.seats.some((s) => sameName(s.name, name));

  // Acciones de la sala de espera: solo quien la creó y antes de empezar
  function hostLobby(socketId) {
    const room = roomOf(socketId);
    if (seatOf(room, socketId)?.id !== room.hostId) throw new RoomError('NOT_HOST');
    if (room.store.get().game) throw new RoomError('STARTED');
    return room;
  }

  function addSeat(room, fields) {
    if (room.seats.length >= MAX_PLAYERS) throw new RoomError('FULL');
    const seat = { id: `p${room.nextSeat++}`, token: newToken(), socketId: null, connected: false, isBot: false, personality: null, ...fields };
    room.seats.push(seat);
    return seat;
  }

  return {
    // Se crea la sala solo con quien la crea. La configuración (`config`: modo, escenario,
    // variantes) se cambia dentro, igual que los bots; las personas entran con el código.
    create(socketId, { name, config: rawConfig } = {}) {
      const config = cleanConfig(rawConfig);
      if (!config) throw new RoomError('BAD_SETUP');
      release(socketId, { quit: true }); // un socket ocupa un solo asiento: si ya tenía uno, sale de él

      const store = createGameStore({ rng, save: () => {}, clear: () => {}, autoViewer: true });
      const room = { code: newCode(), config, hostId: 'p1', nextSeat: 1, store, lastShakeAt: 0, seats: [] };
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

      const result = sit(room, addSeat(room, { name: cleanName(name) || 'Anfitrión' }), socketId);
      broadcastLobby(room);
      return result;
    },

    join(socketId, { code, name } = {}) {
      const room = rooms.get(String(code ?? '').toUpperCase());
      if (!room) throw new RoomError('NO_ROOM');
      // Un doble toque en Unirse: ya está sentado aquí
      const already = seatOf(room, socketId);
      if (already) return { code: room.code, playerId: already.id, token: already.token };
      const wanted = cleanName(name);
      if (room.store.get().game) {
        // Empezada la partida, solo vuelve quien ya jugaba en ella y salió: con su mismo nombre.
        // shortcut: entre amigos basta el nombre; para una sala pública haría falta algo más.
        const back = room.seats.find((s) => !s.isBot && !s.socketId && wanted && sameName(s.name, wanted));
        if (!back) throw new RoomError('STARTED');
        release(socketId);
        back.token = newToken();
        const result = sit(room, back, socketId);
        broadcastLobby(room);
        broadcastState(room);
        return result;
      }
      if (room.seats.length >= MAX_PLAYERS) throw new RoomError('FULL');
      // Sin nombre, el primer "Jugador N" libre: no se le rechaza por un nombre que no eligió
      let seatName = wanted;
      for (let n = room.seats.length + 1; !seatName; n++) if (!nameTaken(room, `Jugador ${n}`)) seatName = `Jugador ${n}`;
      if (nameTaken(room, seatName)) throw new RoomError('NAME_TAKEN');
      release(socketId, { quit: true });
      const result = sit(room, addSeat(room, { name: seatName }), socketId);
      broadcastLobby(room);
      return result;
    },

    // Quien creó la sala cambia las reglas desde dentro
    configure(socketId, { config } = {}) {
      const room = hostLobby(socketId);
      const clean = cleanConfig(config);
      if (!clean) throw new RoomError('BAD_SETUP');
      room.config = clean;
      broadcastLobby(room);
    },

    addBot(socketId, { personality, name } = {}) {
      const room = hostLobby(socketId);
      const botName = cleanName(name);
      if (!Object.hasOwn(PERSONALITIES, personality) || !botName) throw new RoomError('BAD_SETUP');
      if (nameTaken(room, botName)) throw new RoomError('NAME_TAKEN');
      addSeat(room, { name: botName, isBot: true, personality });
      broadcastLobby(room);
    },

    // Quitar un bot, o a una persona (que se entera); el asiento de quien creó la sala, no
    removeSeat(socketId, { seatId } = {}) {
      const room = hostLobby(socketId);
      const seat = room.seats.find((s) => s.id === seatId && s.id !== room.hostId);
      if (!seat) throw new RoomError('NO_SEAT');
      room.seats.splice(room.seats.indexOf(seat), 1);
      if (seat.socketId) {
        roomOfSocket.delete(seat.socketId);
        send(seat.socketId, 'lost', 'REMOVED');
      }
      broadcastLobby(room);
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

    // Solo quien creó la sala, con al menos dos en la mesa y, la primera vez, nadie desconectado.
    // Terminada la partida sirve para jugar otra vez; quien ya no esté lo juega el suplente.
    start(socketId) {
      const room = roomOf(socketId);
      if (seatOf(room, socketId)?.id !== room.hostId) throw new RoomError('NOT_HOST');
      const { game } = room.store.get();
      if (game && game.phase !== PHASES.GAME_OVER) throw new RoomError('STARTED');
      if (room.seats.length < MIN_PLAYERS) throw new RoomError('NOT_ENOUGH');
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

    // Un sticker para toda la sala, también para quien lo mandó (así sabe que llegó)
    react(socketId, { reaction }) {
      if (!REACTIONS.includes(reaction)) throw new RoomError('BAD_REACTION');
      const room = roomOf(socketId);
      const seat = seatOf(room, socketId);
      if (!seat || Date.now() - (seat.lastReactAt ?? 0) < REACT_MIN_MS) return;
      seat.lastReactAt = Date.now();
      for (const { socketId: to } of room.seats) if (to) send(to, 'reaction', { playerId: seat.id, reaction });
    },

    // Salir de la sala a propósito: en partida, el suplente juega por ese asiento desde ya
    quit: (socketId) => release(socketId, { quit: true }),

    // Se cortó la conexión: se le guarda el asiento
    disconnect: (socketId) => release(socketId),

    // Solo para los tests
    get: (code) => rooms.get(code),
  };
}

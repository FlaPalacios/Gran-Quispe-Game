// Puente entre el motor de reglas y las capas visuales (UI HTML y escenas de Phaser).
// Guarda el estado de la partida, aplica acciones con el azar real y avisa a quien esté suscrito.
// También lleva estado que es de la interfaz y no del juego, por eso no vive en el motor:
// quién confirmó la pantalla "pásale el celular" (viewerId), desde cuándo corre el reloj de
// presión (turnStartedAt) y si el cubilete todavía se está levantando (revealing).
import { PHASES, applyAction, canSeeDice, createGame } from '../engine/rules.js';
import { clearSave, saveGame } from '../storage/localSave.js';

// Lo que tarda el destape si nadie dice otra cosa con `revealMs`. Ya no suena nada mientras
// sube el cubilete (Flavio quitó sfx-destapar), así que el plazo es fijo: el que tenía aquel
// sonido, que daba buen suspenso. El tope existe para que, si algún día se reexporta el
// sonido más largo, la pantalla no se quede sin botones una eternidad.
const REVEAL_FALLBACK_MS = 2200;
const MAX_REVEAL_MS = 2600;

export function createGameStore({
  rng = Math.random,
  save = saveGame,
  clear = clearSave,
  now = Date.now,
  revealMs = () => null,
  // autoViewer: el turno se confirma solo, sin pantalla de pase (la partida del servidor)
  autoViewer = false,
  // remote: modo online en el celular. Las acciones y las sacudidas se mandan al servidor,
  // y el estado llega por receive(), ya filtrado para este jugador.
  remote = null,
} = {}) {
  let game = null;
  let viewerId = null;
  let turnStartedAt = null;
  let revealing = false;
  let revealTimer = null;
  // Cómo estaban los jugadores antes de la ronda: mientras se destapa, las tarjetas se
  // dibujan con esto, para que una letra encendida no cante el resultado antes de tiempo
  let playersBefore = null;
  const listeners = new Set();
  const signalListeners = new Set();

  // presence (solo en línea): quién de las personas está conectado y por quién juega un bot
  let presence = null;
  const snapshot = () => ({ game, viewerId, turnStartedAt, revealing, playersBefore, presence, online: Boolean(remote) });
  const notify = () => {
    skipLonePass();
    listeners.forEach((fn) => fn(snapshot()));
  };

  // Con una sola persona en pie (los demás son bots) no hay a quién pasarle el celular:
  // su turno se confirma solo, y su reloj de presión arranca en ese momento
  function skipLonePass() {
    const current = game?.players.find((p) => p.id === game.currentPlayerId);
    if (remote || !current || current.isBot || viewerId === current.id) return;
    if (!autoViewer && game.players.filter((p) => !p.isBot && !p.eliminated).length !== 1) return;
    viewerId = current.id;
    turnStartedAt = now();
  }
  const emit = (name) => signalListeners.forEach((fn) => fn(name));
  // En línea la sacudida va al servidor, que la reparte a todos (también a quien sacude)
  const signal = (name) => (remote && name === 'cupShake' ? remote.shake() : emit(name));
  const persist = () => (remote ? null : game.phase === PHASES.GAME_OVER ? clear() : save(game));

  // Acaba de terminar la ronda y hay que destapar: suspenso hasta que el cubilete suba
  function followReveal(before) {
    if (before && !before.round.result && game.round.result?.revealed) startReveal(before.players);
    else if (!game.round.result) stopReveal();
  }

  // Al destapar, el cubilete tarda en levantarse y hasta que termina no se muestra nada del
  // resultado: ni los dados, ni el panel, ni la cara de quien ganó o perdió.
  function startReveal(players) {
    clearTimeout(revealTimer);
    revealing = true;
    playersBefore = players;
    revealTimer = setTimeout(() => {
      stopReveal();
      notify();
    }, Math.min(revealMs() ?? REVEAL_FALLBACK_MS, MAX_REVEAL_MS));
  }

  function stopReveal() {
    clearTimeout(revealTimer);
    revealTimer = null;
    revealing = false;
    playersBefore = null;
  }

  return {
    get: snapshot,

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    start(setup) {
      game = createGame(setup, { rng });
      viewerId = null;
      turnStartedAt = null;
      stopReveal();
      persist();
      notify();
      emit('gameStart');
    },

    resume(savedGame) {
      game = savedGame;
      viewerId = null;
      turnStartedAt = null;
      stopReveal();
      notify();
    },

    dispatch(action) {
      if (remote) return remote.dispatch(action);
      const before = game;
      game = applyAction(game, action, { rng });
      if (game.currentPlayerId !== before.currentPlayerId) {
        // Cambió el jugador en turno: hay que volver a pasar el celular
        viewerId = null;
        turnStartedAt = null;
      } else if (game.phase === PHASES.CALL && before.phase !== PHASES.CALL) {
        // El plazo para cantar empieza cuando los dados ya cayeron
        turnStartedAt = now();
      }
      followReveal(before);
      persist();
      notify();
    },

    // En línea: el estado que manda el servidor, ya sin lo que este jugador no puede ver.
    // `you` es su asiento; `elapsed`, cuánto lleva su turno (para el reloj de presión), en
    // vez de una hora, porque los relojes del servidor y del celular no coinciden.
    receive(next, { you, elapsed = null, presence: seats = null } = {}) {
      const before = game;
      game = next;
      viewerId = you;
      presence = seats;
      turnStartedAt = elapsed == null ? null : now() - elapsed;
      followReveal(before);
      notify();
    },

    // En línea: un aviso que reparte el servidor ('cupShake', 'gameStart')
    receiveSignal: emit,

    // Entra (con la conexión al servidor) o sale (con null) del modo online
    useRemote(next) {
      remote = next;
      presence = null;
      game = null;
      viewerId = null;
      turnStartedAt = null;
      stopReveal();
      notify();
    },

    // El turno (y el reloj de presión) empieza cuando el jugador confirma que tiene el celular
    confirmViewer(playerId) {
      viewerId = playerId;
      turnStartedAt = now();
      notify();
    },

    // Avisos puntuales que no son estado y no se guardan: 'cupShake' (cada sacudida del
    // cubilete, antes de tirar) y 'gameStart' (empezó una partida nueva). Los escuchan la
    // escena y los sonidos, que necesitan el momento exacto y no les basta con el estado.
    signal,

    onSignal(fn) {
      signalListeners.add(fn);
      return () => signalListeners.delete(fn);
    },

    // Sale al menú sin borrar la partida guardada
    leave() {
      game = null;
      viewerId = null;
      turnStartedAt = null;
      stopReveal();
      notify();
    },

    abandon() {
      clear();
      this.leave();
    },
  };
}

// La pantalla de pase se muestra cuando le toca a alguien que aún no confirmó que tiene el celular
// Los bots no miran la pantalla: su turno se juega a la vista de todos sin mostrar sus dados
// En línea tampoco: cada uno juega desde su celular.
export function needsPassScreen({ game, viewerId, online }) {
  if (online || !game || !game.currentPlayerId) return false;
  const current = game.players.find((p) => p.id === game.currentPlayerId);
  return !current?.isBot && viewerId !== game.currentPlayerId;
}

// Los dados se muestran solo si el motor lo permite a quien tiene el celular, nunca detrás
// de la pantalla de pase y nunca antes de que el cubilete termine de levantarse
export function viewerCanSeeDice(snapshot) {
  if (!snapshot.game || snapshot.revealing) return false;
  return canSeeDice(snapshot.game, snapshot.viewerId) && !needsPassScreen(snapshot);
}

// Puente entre el motor de reglas y las capas visuales (UI HTML y escenas de Phaser).
// Guarda el estado de la partida, aplica acciones con el azar real y avisa a quien esté suscrito.
// También lleva quién confirmó la pantalla "pásale el celular" (viewerId) y desde cuándo
// (turnStartedAt, para el reloj de presión): eso es estado de la interfaz, no del juego,
// por eso no vive en el motor.
import { PHASES, applyAction, canSeeDice, createGame } from '../engine/rules.js';
import { clearSave, saveGame } from '../storage/localSave.js';

export function createGameStore({ rng = Math.random, save = saveGame, clear = clearSave, now = Date.now } = {}) {
  let game = null;
  let viewerId = null;
  let turnStartedAt = null;
  const listeners = new Set();
  const signalListeners = new Set();

  const snapshot = () => ({ game, viewerId, turnStartedAt });
  const notify = () => listeners.forEach((fn) => fn(snapshot()));
  const signal = (name) => signalListeners.forEach((fn) => fn(name));
  const persist = () => (game.phase === PHASES.GAME_OVER ? clear() : save(game));

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
      persist();
      notify();
      signal('gameStart');
    },

    resume(savedGame) {
      game = savedGame;
      viewerId = null;
      turnStartedAt = null;
      notify();
    },

    dispatch(action) {
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
      persist();
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
      notify();
    },

    abandon() {
      clear();
      this.leave();
    },
  };
}

// La pantalla de pase se muestra cuando le toca a alguien que aún no confirmó que tiene el celular
export function needsPassScreen({ game, viewerId }) {
  if (!game || !game.currentPlayerId) return false;
  return viewerId !== game.currentPlayerId;
}

// Los dados se muestran solo si el motor lo permite a quien tiene el celular,
// y nunca detrás de la pantalla de pase
export function viewerCanSeeDice(snapshot) {
  return Boolean(snapshot.game) && canSeeDice(snapshot.game, snapshot.viewerId) && !needsPassScreen(snapshot);
}

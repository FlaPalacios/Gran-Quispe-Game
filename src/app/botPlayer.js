// Juega el turno de los bots: cuando le toca a uno, espera un poco (para que se lea qué pasa),
// pide su acción al motor (engine/bots.js) y la envía al store como lo haría un jugador.
import { botAction } from '../engine/bots.js';
import { PHASES } from '../engine/rules.js';

// Pausas para que el turno de un bot se vea y no pase de golpe
const THINK_MS = { [PHASES.ROLL]: 600, [PHASES.CALL]: 1300, [PHASES.DECIDE]: 1500 };
const SHAKES = 4;
const SHAKE_EVERY_MS = 280;
// Si ya no queda ningún humano en pie, la siguiente ronda empieza sola
const NEXT_ROUND_MS = 2500;
// Lo que dura la entrada en túnel: si abre un bot, su primera jugada espera a que termine
const INTRO_MS = 1300;

// Sin ninguna persona en pie, nadie aprieta "Siguiente ronda": la partida sigue sola
export const onlyBotsLeft = (game) => !game.players.some((p) => !p.isBot && !p.eliminated);

export function connectBots(store, { rng = Math.random } = {}) {
  let timer = null;
  let introUntil = 0;

  const later = (ms, fn) => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };

  // El aviso de partida nueva llega después del estado: se vuelve a programar con la espera
  const unsubscribeSignals = store.onSignal((name) => {
    if (name !== 'gameStart') return;
    introUntil = Date.now() + INTRO_MS;
    onState(store.get());
  });

  const unsubscribe = store.subscribe(onState);

  function onState({ game, revealing }) {
    clearTimeout(timer);
    if (!game || revealing) return;

    const current = game.players.find((p) => p.id === game.currentPlayerId);
    if (current?.isBot) {
      // Antes de tirar sacude el cubilete, igual que un jugador con el botón Tirar
      const shakes = game.phase === PHASES.ROLL ? SHAKES : 0;
      const wait = THINK_MS[game.phase] + Math.max(0, introUntil - Date.now());
      later(wait, () => shake(shakes, () => play(game)));
      return;
    }
    if (game.phase === PHASES.ROUND_OVER && onlyBotsLeft(game)) later(NEXT_ROUND_MS, () => play(game));
  }

  function shake(times, then) {
    if (!times) return then();
    store.signal('cupShake');
    later(SHAKE_EVERY_MS, () => shake(times - 1, then));
  }

  // Solo si la partida sigue donde estaba al programar la jugada
  function play(expected) {
    const { game } = store.get();
    if (game !== expected) return;
    const action = game.phase === PHASES.ROUND_OVER ? { type: 'NEXT_ROUND' } : botAction(game, { rng });
    if (!action) return;
    try {
      store.dispatch(action);
    } catch (error) {
      // Una jugada que el motor rechaza dejaría la partida trabada sin que nadie se entere
      console.error('El bot intentó una jugada inválida', action, error);
    }
  }

  return () => {
    clearTimeout(timer);
    unsubscribe();
    unsubscribeSignals();
  };
}

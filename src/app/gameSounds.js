// Traduce los cambios de estado del juego en efectos de sonido.
// Está aquí y no en los componentes para tener en un solo lugar qué suena y cuándo.
import { PHASES, RESULTS } from '../engine/rules.js';
import { playSfx } from './audio.js';

// El sonido de sacudir dura más que una sacudida: no se reinicia antes de este tiempo
const SHAKE_SOUND_EVERY_MS = 550;

export function connectGameSounds(store) {
  let previous = null;
  let lastShakeAt = 0;

  const unsubscribeSignals = store.onSignal((name) => {
    if (name !== 'cupShake' || Date.now() - lastShakeAt < SHAKE_SOUND_EVERY_MS) return;
    lastShakeAt = Date.now();
    playSfx('shake');
  });

  const unsubscribe = store.subscribe(({ game }) => {
    const before = previous;
    previous = game;
    if (!game || !before || before.phase === game.phase) return;

    // Se soltó el botón Tirar: el cubilete golpea la mesa (la sacudida ya sonó mientras tanto)
    if (before.phase === PHASES.ROLL && game.phase === PHASES.CALL) {
      playSfx('thud');
      return;
    }

    if (game.phase === PHASES.ROUND_OVER || game.phase === PHASES.GAME_OVER) {
      playSfx(game.round.result.type === RESULTS.DOUBT ? 'reveal' : 'cholada');
    }
  });

  return () => {
    unsubscribeSignals();
    unsubscribe();
  };
}

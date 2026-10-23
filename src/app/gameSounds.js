// Traduce los cambios de estado del juego en efectos de sonido.
// Está aquí y no en los componentes para tener en un solo lugar qué suena y cuándo.
import { PHASES, RESULTS } from '../engine/rules.js';
import { playSfx } from './audio.js';
import { roundReaction } from './reaction.js';

// El sonido de sacudir dura más que una sacudida: no se reinicia antes de este tiempo
const SHAKE_SOUND_EVERY_MS = 550;
// El remate del final de ronda entra cuando el cubilete ya se destapó, no encima del golpe
const STING_DELAY_MS = 420;

export function connectGameSounds(store) {
  let previous = null;
  let lastShakeAt = 0;
  let pendingSting = null;

  const unsubscribeSignals = store.onSignal((name) => {
    if (name !== 'cupShake' || Date.now() - lastShakeAt < SHAKE_SOUND_EVERY_MS) return;
    lastShakeAt = Date.now();
    playSfx('shake');
  });

  const unsubscribe = store.subscribe(({ game }) => {
    const before = previous;
    previous = game;
    // Si la partida siguió (o se salió al menú), el remate pendiente ya no corresponde
    if (!game || before?.phase !== game.phase) clearTimeout(pendingSting);
    if (!game || !before || before.phase === game.phase) return;

    // Se soltó el botón Tirar: el cubilete golpea la mesa (la sacudida ya sonó mientras tanto)
    if (before.phase === PHASES.ROLL && game.phase === PHASES.CALL) {
      playSfx('thud');
      return;
    }

    // Creyó y le pasan el cubilete para que tire: brindis
    if (before.phase === PHASES.DECIDE && game.phase === PHASES.ROLL) {
      playSfx('believe');
      return;
    }

    if (game.phase !== PHASES.ROUND_OVER && game.phase !== PHASES.GAME_OVER) return;
    // Primero se abre el cubilete y después entra el remate de lo que pasó
    playSfx(game.round.result.type === RESULTS.DOUBT ? 'reveal' : 'cholada');
    const { sound } = roundReaction(game);
    if (sound) pendingSting = setTimeout(() => playSfx(sound), STING_DELAY_MS);
  });

  return () => {
    clearTimeout(pendingSting);
    unsubscribeSignals();
    unsubscribe();
  };
}

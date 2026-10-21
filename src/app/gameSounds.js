// Traduce los cambios de estado del juego en efectos de sonido.
// Está aquí y no en los componentes para tener en un solo lugar qué suena y cuándo.
import { PHASES, RESULTS } from '../engine/rules.js';
import { playSfx } from './audio.js';

const SHAKE_TO_THUD_MS = 650;

export function connectGameSounds(store) {
  let previous = null;
  let pendingThud = null;

  const unsubscribe = store.subscribe(({ game }) => {
    const before = previous;
    previous = game;
    // Si la partida cambió de fase (o se salió al menú), el golpe pendiente ya no corresponde
    clearTimeout(pendingThud);
    if (!game || !before || before.phase === game.phase) return;

    // Agitar el cubilete y apoyarlo en la mesa
    if (before.phase === PHASES.ROLL && game.phase === PHASES.CALL) {
      playSfx('shake');
      pendingThud = setTimeout(() => playSfx('thud'), SHAKE_TO_THUD_MS);
      return;
    }

    if (game.phase === PHASES.ROUND_OVER || game.phase === PHASES.GAME_OVER) {
      playSfx(game.round.result.type === RESULTS.DOUBT ? 'reveal' : 'cholada');
    }
  });

  return () => {
    clearTimeout(pendingThud);
    unsubscribe();
  };
}

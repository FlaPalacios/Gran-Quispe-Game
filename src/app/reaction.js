// Qué pasó al terminar la ronda, leído en un solo sitio.
// La escena lo usa para saber quién se queda en pantalla y con qué cara, y los sonidos para
// saber qué remate suena: así la cara y el sonido no pueden contar cosas distintas.
import { PHASES, RESULTS } from '../engine/rules.js';

/**
 * @returns {{playerId: string, pose: 'caught'|'gloating', sound: string|null}|null}
 *   null mientras la ronda sigue en juego.
 */
export function roundReaction(game) {
  const result = game?.round?.result;
  if (!result) return null;

  const won = game.phase === PHASES.GAME_OVER;
  const doubted = result.type === RESULTS.DOUBT;
  // Al que cantó lo pillaron mintiendo; al que desconfió, el otro decía la verdad
  const caughtLying = doubted && result.loserId === result.callerId;
  const wrongDoubt = doubted && result.loserId === result.doubterId;
  const eliminated = game.players.find((p) => p.id === result.loserId)?.eliminated;

  return {
    // Se queda quien se llevó la reacción: el perdedor avergonzado, o quien cantó riéndose
    // si el que desconfió se equivocó. Al terminar la partida, el ganador.
    playerId: won ? game.winnerId : wrongDoubt ? result.callerId : result.loserId,
    pose: won || wrongDoubt ? 'gloating' : 'caught',
    // El remate entra después del destape. Ganar la partida manda sobre quedar eliminado, y
    // eso sobre cómo terminó la ronda. La Cholada ya sonó con lo suyo al destapar.
    sound: won ? 'win' : eliminated ? 'eliminated' : caughtLying ? 'caught' : wrongDoubt ? 'loss' : null,
  };
}

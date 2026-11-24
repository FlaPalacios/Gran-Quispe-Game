// Qué pasó al terminar la ronda, leído en un solo sitio.
// La escena lo usa para saber quién se queda en pantalla y con qué cara, y los sonidos para
// saber qué remate suena: así la cara y el sonido no pueden contar cosas distintas.
import { PHASES, RESULTS } from '../engine/rules.js';

/**
 * @param {{revealing?: boolean}} [options] si el cubilete todavía se está levantando
 * @returns {{playerId: string, pose: 'neutral'|'caught'|'gloating', sound: string|null}|null}
 *   null mientras la ronda sigue en juego.
 */
export function roundReaction(game, { revealing = false } = {}) {
  const result = game?.round?.result;
  if (!result) return null;

  // Mientras sube el cubilete nadie ha reaccionado todavía: se queda a la vista quien
  // desconfió, con cara de nada, mirando cómo se destapa.
  if (revealing) return { playerId: result.doubterId ?? result.loserId, pose: 'neutral', sound: null };

  const won = game.phase === PHASES.GAME_OVER;
  const doubted = result.type === RESULTS.DOUBT;
  // La Cholada ya trae su propio sonido; las demás derrotas se rematan con una risa
  const cholada = result.type === RESULTS.CHOLADA;
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
    sound: won ? 'win' : eliminated ? 'eliminated' : caughtLying ? 'caught' : cholada ? null : 'loss',
  };
}

/**
 * Quién dice algo al terminar la ronda, y qué frase (las claves de las voces de audio.js).
 * Va junto a roundReaction para que la frase cuente lo mismo que el remate. No siempre habla
 * quien está en pantalla: al pillar a un mentiroso, en la mesa queda el pillado y quien lo
 * pilló le habla desde fuera del cuadro ("¡Te descubrí!"); al desconfiar mal, se ríe quien
 * cantó y el que perdió se lamenta.
 * @returns {{playerId: string, key: string}|null} null mientras la ronda sigue en juego, o si
 *   la ronda dejó a alguien fuera o terminó la partida.
 */
export function roundVoice(game) {
  const result = game?.round?.result;
  if (!result) return null;
  // Ganar la partida y quedar fuera se quedan con su sonido, sin voces (pedido de Flavio)
  if (game.phase === PHASES.GAME_OVER || game.players.find((p) => p.id === result.loserId)?.eliminated) return null;
  // Pilló al mentiroso: habla quien desconfió
  if (result.type === RESULTS.DOUBT && result.loserId === result.callerId) return { playerId: result.doubterId, key: 'pille' };
  return { playerId: result.loserId, key: result.type === RESULTS.CHOLADA ? 'cholada' : 'pierdo' };
}

// Qué pasó al terminar la ronda, leído en un solo sitio.
// La escena lo usa para saber quién se queda en pantalla y con qué cara, y los sonidos para
// saber qué suena con cada mensaje: así la cara, el texto y el sonido no pueden contar cosas
// distintas.
import { PHASES, RESULTS } from '../engine/rules.js';

/**
 * @param {{revealing?: boolean}} [options] si el cubilete todavía se está levantando
 * @returns {{playerId: string, pose: 'neutral'|'caught'|'gloating'}|null}
 *   null mientras la ronda sigue en juego.
 */
export function roundReaction(game, { revealing = false } = {}) {
  const result = game?.round?.result;
  if (!result) return null;

  // Mientras sube el cubilete nadie ha reaccionado todavía: se queda a la vista quien
  // desconfió, con cara de nada, mirando cómo se destapa.
  if (revealing) return { playerId: result.doubterId ?? result.loserId, pose: 'neutral' };

  const won = game.phase === PHASES.GAME_OVER;
  // Al que desconfió se le pilló equivocado: el otro decía la verdad
  const wrongDoubt = result.type === RESULTS.DOUBT && result.loserId === result.doubterId;

  return {
    // Se queda quien se llevó la reacción: el perdedor avergonzado, o quien cantó riéndose
    // si el que desconfió se equivocó. Al terminar la partida, el ganador.
    playerId: won ? game.winnerId : wrongDoubt ? result.callerId : result.loserId,
    pose: won || wrongDoubt ? 'gloating' : 'caught',
  };
}

/**
 * Quién dice algo al terminar la ronda, y qué frase (las claves de las voces de audio.js).
 * Va junto a roundReaction para que la frase cuente lo mismo que el remate. No siempre habla
 * quien está en pantalla: al pillar a un mentiroso, en la mesa queda el pillado y quien lo
 * pilló le habla desde fuera del cuadro ("¡Te descubrí!"); al desconfiar mal, se ríe quien
 * cantó y el que perdió se lamenta.
 * @returns {{playerId: string, key: string}|null} null mientras la ronda sigue en juego, si
 *   la ronda dejó a alguien fuera o terminó la partida, y en el modo castigo (ahí suena
 *   "¡Tomaaas!" y los personajes solo cantan sus jugadas).
 */
export function roundVoice(game) {
  const result = game?.round?.result;
  if (!result || game.config.mode === 'penalty') return null;
  // Ganar la partida y quedar fuera se quedan con su sonido, sin voces (pedido de Flavio)
  if (game.phase === PHASES.GAME_OVER || game.players.find((p) => p.id === result.loserId)?.eliminated) return null;
  // Pilló al mentiroso: habla quien desconfió
  if (result.type === RESULTS.DOUBT && result.loserId === result.callerId) return { playerId: result.doubterId, key: 'pille' };
  return { playerId: result.loserId, key: result.type === RESULTS.CHOLADA ? 'cholada' : 'pierdo' };
}

/**
 * Qué efecto suena con cada mensaje del momento de fin de ronda (src/ui/RoundMoment.js), con
 * las claves de SFX de audio.js. `headline` entra con el título; `hit`, cuando a quien perdió se
 * le rompe el corazón o se le marca la letra. Equivocarse al desconfiar da 'wrongDoubt', que
 * gameSounds.js reparte entre sus dos grabaciones.
 * @returns {{headline: string|null, hit: string}|null} null mientras la ronda sigue en juego.
 */
export function roundSounds(game) {
  const result = game?.round?.result;
  if (!result) return null;
  const doubted = result.type === RESULTS.DOUBT;
  const headline = doubted
    ? result.loserId === result.callerId
      ? 'caught'
      : 'wrongDoubt'
    : result.type === RESULTS.CHOLADA
      ? 'cholada'
      : null; // creer un Quispe no tiene efecto propio: lo dice la voz
  const eliminated = game.players.find((p) => p.id === result.loserId)?.eliminated;
  // Quedar fuera manda sobre el castigo
  const hit = eliminated ? 'eliminated' : game.config.mode === 'penalty' ? 'penalty' : 'lossHit';
  return { headline, hit };
}

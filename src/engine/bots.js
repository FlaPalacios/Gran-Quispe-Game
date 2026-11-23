// Personalidades de bots: deciden qué hacer en su turno. Código puro como el resto del motor:
// leen el estado y devuelven una acción, nunca lo modifican, y el azar llega inyectado (rng).
import { PHASES } from './constants.js';
import { CALL_SCALE, QUISPE, compareCalls, readDice } from './dice.js';
import { getLastCall } from './rules.js';

// lie: probabilidad de mentir aunque lo que sacó ya alcance para cantar.
// doubt: cuánto más (o menos) desconfía que el promedio.
// reach: cuántos escalones sube como mucho cuando miente.
export const PERSONALITIES = Object.freeze({
  honest: Object.freeze({ lie: 0.1, doubt: 0, reach: 1 }),
  bluffer: Object.freeze({ lie: 0.45, doubt: -0.1, reach: 4 }),
  suspicious: Object.freeze({ lie: 0.2, doubt: 0.25, reach: 2 }),
});

const TOP = CALL_SCALE.length - 1;

// La acción del bot al que le toca, o null si no le toca hacer nada (ronda terminada)
export function botAction(state, { rng }) {
  const playerId = state.currentPlayerId;
  const bot = state.players.find((p) => p.id === playerId);
  if (!bot?.isBot) return null;
  const traits = PERSONALITIES[bot.personality] ?? PERSONALITIES.honest;
  switch (state.phase) {
    case PHASES.ROLL:
      return { type: 'ROLL', playerId };
    case PHASES.CALL:
      return { type: 'CALL', playerId, value: chooseCall(state, traits, rng) };
    case PHASES.DECIDE:
      return { type: rng() < doubtChance(state, traits) ? 'DOUBT' : 'BELIEVE', playerId };
    default:
      return null;
  }
}

// Canta lo que sacó si alcanza y no le da por mentir. Si miente, sube unos escalones por
// encima de lo que hay que superar (o de lo que sacó, si eso ya alcanzaba).
function chooseCall(state, traits, rng) {
  const actual = readDice(state.round.dice);
  const last = getLastCall(state);
  const truthWorks = !last || compareCalls(actual, last.value) > 0;
  if (truthWorks && rng() >= traits.lie) return actual;
  const floor = Math.max(last ? CALL_SCALE.indexOf(last.value) : -1, truthWorks ? CALL_SCALE.indexOf(actual) : -1);
  const step = 1 + Math.floor(rng() * traits.reach);
  return CALL_SCALE[Math.min(floor + step, TOP)];
}

// Cuanto más alta la jugada, menos probable que sea justo lo que salió: más desconfianza.
// Creer un Quispe es perder seguro, así que casi siempre se desconfía.
function doubtChance(state, traits) {
  const { value } = getLastCall(state);
  if (value === QUISPE) return 0.95;
  const height = CALL_SCALE.indexOf(value) / TOP;
  return Math.min(0.95, Math.max(0.05, 0.15 + height * 0.6 + traits.doubt));
}

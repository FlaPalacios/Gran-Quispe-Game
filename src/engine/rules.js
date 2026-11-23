// Motor de reglas: máquina de estados pura.
// Sin Phaser, sin DOM, sin localStorage, sin Math.random directo:
// el azar se inyecta (ctx.rng) para poder testear y, a futuro, correrlo en el servidor.
import { CHOLADA_REASONS, PHASES, RESULTS } from './constants.js';
import { QUISPE, compareCalls, isValidCall, isWrittenCall, readDice, rollDice } from './dice.js';
import { DEFAULT_LIVES, MAX_LIVES, MIN_LIVES, getMode } from './modes.js';
import { lossCost, resolveVariants, revealsDice } from './variants.js';

export { CHOLADA_REASONS, PHASES, RESULTS };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export class GameRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
  }
}

export function createGame({ config, players }, { rng } = {}) {
  if (typeof rng !== 'function') throw new TypeError('createGame necesita ctx.rng');
  const mode = getMode(config.mode);
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new RangeError(`Se necesitan entre ${MIN_PLAYERS} y ${MAX_PLAYERS} jugadores`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new RangeError('Los ids de jugador deben ser únicos');
  }
  // El estado debe ser JSON plano: la personalidad de un bot es solo su id
  for (const p of players) {
    if (typeof p.name !== 'string') throw new TypeError(`Nombre inválido para ${p.id}`);
    if (p.personality != null && typeof p.personality !== 'string') {
      throw new TypeError(`La personalidad de ${p.id} debe ser un id de texto`);
    }
  }
  const lives = config.lives ?? DEFAULT_LIVES;
  if (config.mode === 'lives' && (!Number.isInteger(lives) || lives < MIN_LIVES || lives > MAX_LIVES)) {
    throw new RangeError(`Las vidas deben estar entre ${MIN_LIVES} y ${MAX_LIVES}`);
  }
  const penaltyText = config.penaltyText ?? '';
  if (typeof penaltyText !== 'string') throw new TypeError('El texto de castigo debe ser texto');

  const fullConfig = { mode: config.mode, lives, penaltyText, variants: resolveVariants(config.variants) };
  const openerIndex = Math.floor(rng() * players.length);
  if (!(openerIndex >= 0 && openerIndex < players.length)) throw new RangeError('rng debe devolver un valor en [0, 1)');
  const openerId = players[openerIndex].id;

  return {
    config: fullConfig,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot ?? false,
      personality: p.personality ?? null,
      eliminated: false,
      spyUsed: false,
      ...mode.initPlayer(fullConfig),
    })),
    phase: PHASES.ROLL,
    currentPlayerId: openerId,
    round: newRound(1, openerId),
    winnerId: null,
  };
}

export function applyAction(state, action, ctx = {}) {
  switch (action.type) {
    case 'ROLL':
      return roll(state, action, ctx);
    case 'CALL':
      return call(state, action);
    case 'BELIEVE':
      return believe(state, action);
    case 'DOUBT':
      return doubt(state, action);
    case 'TIMEOUT':
      return timeout(state, action);
    case 'SPY':
      return spy(state, action);
    case 'NEXT_ROUND':
      return nextRound(state);
    default:
      throw new GameRuleError('UNKNOWN_ACTION', `Acción desconocida: ${action.type}`);
  }
}

// --- Consultas para UI, escenas y bots ---

export function getLastCall(state) {
  const { calls } = state.round;
  return calls.length ? calls[calls.length - 1] : null;
}

export function getActivePlayers(state) {
  return state.players.filter((p) => !p.eliminated);
}

// Solo quien acaba de tirar ve los dados, y únicamente antes de cantar.
// Al terminar la ronda se destapan para todos si alguien desconfió,
// o en una Cholada si la variante "Destapar en Cholada" está activa.
// Comodín de espía: el dado que espió quien decide, o null. Solo él lo ve, y solo mientras decide.
export function getSpiedDie(state, playerId) {
  const spied = state.phase === PHASES.DECIDE && playerId === state.currentPlayerId && state.round.spiedBy === playerId;
  return spied ? state.round.dice[0] : null;
}

// Si quien decide puede usar ahora su comodín de espía (lo que la UI ofrece como botón)
export function canSpy(state, playerId) {
  if (state.phase !== PHASES.DECIDE || playerId !== state.currentPlayerId) return false;
  return Boolean(state.config.variants.spyWildcard?.enabled) && !state.players.find((p) => p.id === playerId).spyUsed;
}

// Duelo final: con dos jugadores en pie, la próxima ronda perdida elimina
export function isFinalDuel(state) {
  return Boolean(state.config.variants.finalDuel?.enabled) && getActivePlayers(state).length === 2;
}

export function canSeeDice(state, playerId) {
  if (state.phase === PHASES.ROUND_OVER || state.phase === PHASES.GAME_OVER) return state.round.result.revealed;
  return state.phase === PHASES.CALL && playerId === state.currentPlayerId;
}

// --- Acciones ---

function roll(state, action, { rng } = {}) {
  assertPhase(state, PHASES.ROLL);
  assertTurn(state, action.playerId);
  if (typeof rng !== 'function') throw new TypeError('ROLL necesita ctx.rng');
  // Dados nuevos: lo que alguien espió de la tirada anterior ya no vale
  return { ...state, phase: PHASES.CALL, round: { ...state.round, dice: rollDice(rng), spiedBy: null } };
}

function call(state, action) {
  assertPhase(state, PHASES.CALL);
  assertTurn(state, action.playerId);
  // Lo que no es ni un número entero no viene de un jugador, sino de un error de programación
  if (!Number.isInteger(action.value)) {
    throw new GameRuleError('INVALID_CALL', `Jugada inválida: ${action.value}`);
  }
  // Cantar un número que no existe en la escala es equivocarse, y equivocarse es Cholada.
  // `asNumber` lo manda el teclado, donde el jugador escribe la jugada dígito a dígito:
  // escrito así, el 21 tampoco vale, porque el Quispe se canta por su nombre.
  const valid = action.asNumber ? isWrittenCall(action.value) : isValidCall(action.value);
  if (!valid) {
    return endRound(state, {
      type: RESULTS.CHOLADA,
      reason: CHOLADA_REASONS.INVALID_NUMBER,
      loserId: action.playerId,
      call: action.value,
    });
  }
  const last = getLastCall(state);
  if (last && compareCalls(action.value, last.value) <= 0) {
    return endRound(state, {
      type: RESULTS.CHOLADA,
      reason: CHOLADA_REASONS.LOWER_CALL,
      loserId: action.playerId,
      call: action.value,
    });
  }
  return {
    ...state,
    phase: PHASES.DECIDE,
    currentPlayerId: nextActivePlayerId(state.players, action.playerId),
    round: { ...state.round, calls: [...state.round.calls, { playerId: action.playerId, value: action.value }] },
  };
}

function believe(state, action) {
  assertPhase(state, PHASES.DECIDE);
  assertTurn(state, action.playerId);
  // Creer un Quispe es perder la ronda: no hay nada más alto que cantar después. No es una
  // equivocación, así que tampoco es Cholada.
  if (getLastCall(state).value === QUISPE) {
    return endRound(state, { type: RESULTS.BELIEVED_QUISPE, loserId: action.playerId });
  }
  // Recibe el cubilete, vuelve a tirar y le toca cantar más alto que la jugada anterior
  return { ...state, phase: PHASES.ROLL };
}

function doubt(state, action) {
  assertPhase(state, PHASES.DECIDE);
  assertTurn(state, action.playerId);
  const last = getLastCall(state);
  const actual = readDice(state.round.dice);
  // Solo se salva quien cantó exactamente lo que tenía: haber sacado más también es mentir
  const callerToldTruth = actual === last.value;
  return endRound(state, {
    type: RESULTS.DOUBT,
    loserId: callerToldTruth ? action.playerId : last.playerId,
    doubterId: action.playerId,
    callerId: last.playerId,
    call: last.value,
  });
}

// Reloj de presión: quien no canta o no decide a tiempo hace Cholada.
// El reloj lo lleva quien hospeda la partida (UI o servidor), que envía esta acción.
function timeout(state, action) {
  if (state.phase !== PHASES.CALL && state.phase !== PHASES.DECIDE) {
    throw new GameRuleError('WRONG_PHASE', `El reloj solo corre al cantar o al decidir, y la fase es ${state.phase}`);
  }
  assertTurn(state, action.playerId);
  if (!state.config.variants.pressureClock.enabled) {
    throw new GameRuleError('VARIANT_DISABLED', 'El reloj de presión no está activo');
  }
  return endRound(state, { type: RESULTS.CHOLADA, reason: CHOLADA_REASONS.TIMEOUT, loserId: action.playerId });
}

// Comodín de espía: una vez por partida, antes de decidir, se mira uno de los dos dados.
// Se muestra el primero: el orden de los dos ya es azar de la tirada.
function spy(state, action) {
  assertPhase(state, PHASES.DECIDE);
  assertTurn(state, action.playerId);
  if (!state.config.variants.spyWildcard?.enabled) {
    throw new GameRuleError('VARIANT_DISABLED', 'El comodín de espía no está activo');
  }
  if (state.players.find((p) => p.id === action.playerId).spyUsed) {
    throw new GameRuleError('SPY_USED', `${action.playerId} ya usó su comodín de espía`);
  }
  return {
    ...state,
    players: state.players.map((p) => (p.id === action.playerId ? { ...p, spyUsed: true } : p)),
    round: { ...state.round, spiedBy: action.playerId },
  };
}

function nextRound(state) {
  assertPhase(state, PHASES.ROUND_OVER);
  const { loserId } = state.round.result;
  const loser = state.players.find((p) => p.id === loserId);
  // Abre quien perdió; si quedó eliminado, el siguiente activo en el orden de giro
  const openerId = loser.eliminated ? nextActivePlayerId(state.players, loserId) : loserId;
  return {
    ...state,
    phase: PHASES.ROLL,
    currentPlayerId: openerId,
    round: newRound(state.round.number + 1, openerId),
  };
}

// --- Internas ---

function newRound(number, openerId) {
  return { number, openerId, dice: null, calls: [], result: null, spiedBy: null };
}

function endRound(state, result) {
  const mode = getMode(state.config.mode);
  const { variants } = state.config;
  const cost = lossCost(variants, result);
  const duel = isFinalDuel(state);
  const players = state.players.map((p) => {
    if (p.id !== result.loserId) return p;
    const updated = mode.applyLoss(p, cost);
    return { ...updated, eliminated: duel || mode.isOut(updated) };
  });

  const revealed = revealsDice(variants, result);
  const fullResult = {
    ...result,
    cost,
    revealed,
    duel,
    // Sin destape, los dados no se publican en el resultado (siguen en round.dice)
    dice: revealed ? state.round.dice : null,
    actual: revealed ? readDice(state.round.dice) : null,
    penaltyText: state.config.mode === 'penalty' ? state.config.penaltyText : null,
  };
  const active = players.filter((p) => !p.eliminated);
  const gameOver = active.length === 1;

  return {
    ...state,
    players,
    phase: gameOver ? PHASES.GAME_OVER : PHASES.ROUND_OVER,
    currentPlayerId: null,
    round: { ...state.round, result: fullResult },
    winnerId: gameOver ? active[0].id : null,
  };
}

function nextActivePlayerId(players, fromId) {
  const start = players.findIndex((p) => p.id === fromId);
  for (let i = 1; i <= players.length; i++) {
    const candidate = players[(start + i) % players.length];
    if (!candidate.eliminated) return candidate.id;
  }
  // Inalcanzable: la partida termina cuando queda un solo jugador activo
  throw new Error('Error interno: no quedan jugadores activos');
}

function assertPhase(state, phase) {
  if (state.phase !== phase) {
    throw new GameRuleError('WRONG_PHASE', `Se esperaba la fase ${phase} y la actual es ${state.phase}`);
  }
}

function assertTurn(state, playerId) {
  if (state.currentPlayerId !== playerId) {
    throw new GameRuleError('NOT_YOUR_TURN', `No es el turno de ${playerId}`);
  }
}

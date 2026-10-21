// Motor de reglas: máquina de estados pura.
// Sin Phaser, sin DOM, sin localStorage, sin Math.random directo:
// el azar se inyecta (ctx.rng) para poder testear y, a futuro, correrlo en el servidor.
import { CHOLADA_REASONS, PHASES, RESULTS } from './constants.js';
import { QUISPE, compareCalls, isValidCall, readDice, rollDice } from './dice.js';
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

// Solo quien abrió la ronda ve los dados, y únicamente antes de su primer canto.
// Al terminar la ronda se destapan para todos si alguien desconfió,
// o en una Cholada si la variante "Destapar en Cholada" está activa.
export function canSeeDice(state, playerId) {
  if (state.phase === PHASES.ROUND_OVER || state.phase === PHASES.GAME_OVER) return state.round.result.revealed;
  return state.phase === PHASES.CALL && state.round.calls.length === 0 && playerId === state.round.openerId;
}

// --- Acciones ---

function roll(state, action, { rng } = {}) {
  assertPhase(state, PHASES.ROLL);
  assertTurn(state, action.playerId);
  if (typeof rng !== 'function') throw new TypeError('ROLL necesita ctx.rng');
  return { ...state, phase: PHASES.CALL, round: { ...state.round, dice: rollDice(rng) } };
}

function call(state, action) {
  assertPhase(state, PHASES.CALL);
  assertTurn(state, action.playerId);
  if (!isValidCall(action.value)) {
    throw new GameRuleError('INVALID_CALL', `Jugada inválida: ${action.value}`);
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
  if (getLastCall(state).value === QUISPE) {
    return endRound(state, { type: RESULTS.CHOLADA, reason: CHOLADA_REASONS.BELIEVED_QUISPE, loserId: action.playerId });
  }
  // Recibe el cubilete a ciegas y le toca cantar más alto
  return { ...state, phase: PHASES.CALL };
}

function doubt(state, action) {
  assertPhase(state, PHASES.DECIDE);
  assertTurn(state, action.playerId);
  const last = getLastCall(state);
  const actual = readDice(state.round.dice);
  // Si la jugada real es igual o mayor a la cantada, quien cantó tenía razón
  const callerWasRight = compareCalls(actual, last.value) >= 0;
  return endRound(state, {
    type: RESULTS.DOUBT,
    loserId: callerWasRight ? action.playerId : last.playerId,
    doubterId: action.playerId,
    callerId: last.playerId,
    call: last.value,
  });
}

// Reloj de presión: quien no decide a tiempo hace Cholada.
// El reloj lo lleva quien hospeda la partida (UI o servidor), que envía esta acción.
function timeout(state, action) {
  assertPhase(state, PHASES.DECIDE);
  assertTurn(state, action.playerId);
  if (!state.config.variants.pressureClock.enabled) {
    throw new GameRuleError('VARIANT_DISABLED', 'El reloj de presión no está activo');
  }
  return endRound(state, { type: RESULTS.CHOLADA, reason: CHOLADA_REASONS.TIMEOUT, loserId: action.playerId });
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
  return { number, openerId, dice: null, calls: [], result: null };
}

function endRound(state, result) {
  const mode = getMode(state.config.mode);
  const { variants } = state.config;
  const cost = lossCost(variants, result);
  const players = state.players.map((p) => {
    if (p.id !== result.loserId) return p;
    const updated = mode.applyLoss(p, cost);
    return { ...updated, eliminated: mode.isOut(updated) };
  });

  const revealed = revealsDice(variants, result);
  const fullResult = {
    ...result,
    cost,
    revealed,
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

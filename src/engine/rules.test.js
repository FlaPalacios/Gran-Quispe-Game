import { describe, expect, it } from 'vitest';
import { QUISPE } from './dice.js';
import {
  CHOLADA_REASONS,
  GameRuleError,
  PHASES,
  RESULTS,
  applyAction,
  canSeeDice,
  createGame,
  getLastCall,
} from './rules.js';

// rng que devuelve los valores en orden; para un dado d se usa (d - 1) / 6
const dieValue = (d) => (d - 1) / 6;
const rngFrom = (...values) => () => {
  if (!values.length) throw new Error('rng sin valores');
  return values.shift();
};
// El primer valor elige a quien abre (índice en la lista de jugadores)
const openerValue = (index, total) => index / total;

const PLAYERS = [
  { id: 'ana', name: 'Ana' },
  { id: 'beto', name: 'Beto' },
  { id: 'cata', name: 'Cata' },
];

function newGame({ mode = 'classic', players = PLAYERS, opener = 0, ...config } = {}) {
  return createGame({ config: { mode, ...config }, players }, { rng: rngFrom(openerValue(opener, players.length)) });
}

function rollAs(state, playerId, dice) {
  return applyAction(state, { type: 'ROLL', playerId }, { rng: rngFrom(dieValue(dice[0]), dieValue(dice[1])) });
}

const act = (state, type, playerId, value) => applyAction(state, { type, playerId, value });
const believeAndRoll = (state, playerId, dice) => rollAs(act(state, 'BELIEVE', playerId), playerId, dice);

// Congela en profundidad para detectar mutaciones
function deepFreeze(obj) {
  Object.values(obj).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(obj);
}

describe('createGame', () => {
  it('crea jugadores con marcador según el modo', () => {
    const classic = newGame();
    expect(classic.players.every((p) => p.letters === 0 && !p.eliminated)).toBe(true);
    const lives = newGame({ mode: 'lives', lives: 4 });
    expect(lives.players.every((p) => p.lives === 4)).toBe(true);
  });

  it('usa 3 vidas por defecto', () => {
    expect(newGame({ mode: 'lives' }).players[0].lives).toBe(3);
  });

  it('elige al azar quién abre la primera ronda', () => {
    const state = newGame({ opener: 2 });
    expect(state.currentPlayerId).toBe('cata');
    expect(state.round.openerId).toBe('cata');
    expect(state.phase).toBe(PHASES.ROLL);
  });

  it('valida número de jugadores, modo, vidas e ids', () => {
    expect(() => newGame({ players: [PLAYERS[0]] })).toThrow(RangeError);
    const nine = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    expect(() => newGame({ players: nine })).toThrow(RangeError);
    expect(() => newGame({ mode: 'torneo' })).toThrow(RangeError);
    expect(() => newGame({ mode: 'lives', lives: 0 })).toThrow(RangeError);
    expect(() => newGame({ mode: 'lives', lives: 11 })).toThrow(RangeError);
    expect(() => newGame({ players: [PLAYERS[0], PLAYERS[0]] })).toThrow(RangeError);
  });

  it('exige rng inyectado y dentro de [0, 1)', () => {
    expect(() => createGame({ config: { mode: 'classic' }, players: PLAYERS })).toThrow(TypeError);
    expect(() => createGame({ config: { mode: 'classic' }, players: PLAYERS }, { rng: () => 1 })).toThrow(RangeError);
  });

  it('solo acepta datos serializables en jugadores y configuración', () => {
    const withBot = (personality) => [PLAYERS[0], { id: 'bot', name: 'Bot', isBot: true, personality }];
    expect(() => newGame({ players: withBot({ decide: () => {} }) })).toThrow(TypeError);
    expect(newGame({ players: withBot('tramposo') }).players[1].personality).toBe('tramposo');
    expect(() => newGame({ players: [PLAYERS[0], { id: 'x', name: 42 }] })).toThrow(TypeError);
    expect(() => newGame({ mode: 'penalty', penaltyText: { texto: 'shot' } })).toThrow(TypeError);
  });
});

describe('flujo de una ronda', () => {
  it('quien abre agita, canta y le toca decidir al siguiente', () => {
    let s = rollAs(newGame(), 'ana', [4, 2]);
    expect(s.phase).toBe(PHASES.CALL);
    expect(s.round.dice).toEqual([4, 2]);
    s = act(s, 'CALL', 'ana', 42);
    expect(s.phase).toBe(PHASES.DECIDE);
    expect(s.currentPlayerId).toBe('beto');
    expect(getLastCall(s)).toEqual({ playerId: 'ana', value: 42 });
  });

  it('al abrir se puede cantar cualquier jugada, incluso mentir', () => {
    let s = rollAs(newGame(), 'ana', [3, 1]);
    s = act(s, 'CALL', 'ana', 160);
    expect(s.phase).toBe(PHASES.DECIDE);
  });

  it('quien cree vuelve a tirar y debe cantar más alto', () => {
    let s = act(rollAs(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 42);
    s = act(s, 'BELIEVE', 'beto');
    expect(s.phase).toBe(PHASES.ROLL);
    expect(s.currentPlayerId).toBe('beto');
    s = rollAs(s, 'beto', [5, 1]);
    expect(s.phase).toBe(PHASES.CALL);
    expect(s.round.dice).toEqual([5, 1]); // los dados son los de su tirada
    expect(getLastCall(s)).toEqual({ playerId: 'ana', value: 42 }); // la jugada a superar se mantiene
    s = act(s, 'CALL', 'beto', 51);
    expect(s.phase).toBe(PHASES.DECIDE);
    expect(s.currentPlayerId).toBe('cata');
  });

  it('rechaza jugadas inválidas', () => {
    const s = rollAs(newGame(), 'ana', [4, 2]);
    expect(() => act(s, 'CALL', 'ana', 24)).toThrow(GameRuleError);
  });

  it('rechaza acciones fuera de turno o de fase', () => {
    const s = newGame();
    expect(() => rollAs(s, 'beto', [1, 1])).toThrow(expect.objectContaining({ code: 'NOT_YOUR_TURN' }));
    expect(() => act(s, 'CALL', 'ana', 42)).toThrow(expect.objectContaining({ code: 'WRONG_PHASE' }));
    expect(() => act(s, 'DOUBT', 'ana')).toThrow(expect.objectContaining({ code: 'WRONG_PHASE' }));
    expect(() => act(s, 'BAILAR', 'ana')).toThrow(expect.objectContaining({ code: 'UNKNOWN_ACTION' }));
  });

  it('rechaza acciones fuera de turno o de fase a mitad de ronda', () => {
    const decide = act(rollAs(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 42);
    expect(() => act(decide, 'BELIEVE', 'cata')).toThrow(expect.objectContaining({ code: 'NOT_YOUR_TURN' }));
    expect(() => act(decide, 'DOUBT', 'ana')).toThrow(expect.objectContaining({ code: 'NOT_YOUR_TURN' }));
    expect(() => act(decide, 'CALL', 'beto', 51)).toThrow(expect.objectContaining({ code: 'WRONG_PHASE' }));
    expect(() => rollAs(decide, 'beto', [1, 1])).toThrow(expect.objectContaining({ code: 'WRONG_PHASE' }));
    expect(() => act(decide, 'NEXT_ROUND')).toThrow(expect.objectContaining({ code: 'WRONG_PHASE' }));
    const believed = act(decide, 'BELIEVE', 'beto');
    expect(() => rollAs(believed, 'ana', [1, 1])).toThrow(expect.objectContaining({ code: 'NOT_YOUR_TURN' }));
    expect(() => act(believed, 'CALL', 'beto', 51)).toThrow(expect.objectContaining({ code: 'WRONG_PHASE' }));
    expect(() => act(believed, 'DOUBT', 'beto')).toThrow(expect.objectContaining({ code: 'WRONG_PHASE' }));
  });

  it('ROLL exige rng inyectado', () => {
    expect(() => applyAction(newGame(), { type: 'ROLL', playerId: 'ana' })).toThrow(TypeError);
  });

  it('no muta el estado recibido en ninguna acción', () => {
    const decide = deepFreeze(act(rollAs(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 42));
    expect(() => act(decide, 'DOUBT', 'beto')).not.toThrow();
    const believed = deepFreeze(act(decide, 'BELIEVE', 'beto'));
    const rolled = deepFreeze(rollAs(believed, 'beto', [3, 1]));
    expect(() => act(rolled, 'CALL', 'beto', 31)).not.toThrow(); // Cholada
    const roundOver = deepFreeze(act(decide, 'DOUBT', 'beto'));
    expect(() => act(roundOver, 'NEXT_ROUND')).not.toThrow();
  });

  it('el estado sobrevive a JSON en todas las fases', () => {
    const decide = act(rollAs(newGame(), 'ana', [6, 6]), 'CALL', 'ana', 160);
    const roundOver = act(decide, 'DOUBT', 'beto');
    let gameOver = newGame({ players: PLAYERS.slice(0, 2) });
    gameOver = { ...gameOver, players: gameOver.players.map((p) => (p.id === 'ana' ? { ...p, letters: 5 } : p)) };
    gameOver = act(act(rollAs(gameOver, 'ana', [3, 1]), 'CALL', 'ana', 65), 'DOUBT', 'beto');
    expect(gameOver.phase).toBe(PHASES.GAME_OVER);
    for (const s of [decide, roundOver, gameOver]) {
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });
});

describe('desconfiar', () => {
  it('si la jugada real es mayor, pierde quien desconfió', () => {
    let s = act(rollAs(newGame(), 'ana', [5, 5]), 'CALL', 'ana', 42);
    s = act(s, 'DOUBT', 'beto');
    expect(s.phase).toBe(PHASES.ROUND_OVER);
    expect(s.round.result).toMatchObject({ type: RESULTS.DOUBT, loserId: 'beto', actual: 150, dice: [5, 5] });
    expect(s.players.find((p) => p.id === 'beto').letters).toBe(1);
  });

  it('si la jugada real es igual, gana quien cantó', () => {
    let s = act(rollAs(newGame(), 'ana', [2, 4]), 'CALL', 'ana', 42);
    s = act(s, 'DOUBT', 'beto');
    expect(s.round.result.loserId).toBe('beto');
  });

  it('si la jugada real es menor, pierde quien cantó', () => {
    let s = act(rollAs(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 42);
    s = act(s, 'DOUBT', 'beto');
    expect(s.round.result.loserId).toBe('ana');
    expect(s.players.find((p) => p.id === 'ana').letters).toBe(1);
  });

  it('desconfiar de un Quispe cierto: pierde quien desconfió', () => {
    let s = act(rollAs(newGame(), 'ana', [1, 2]), 'CALL', 'ana', QUISPE);
    s = act(s, 'DOUBT', 'beto');
    expect(s.round.result).toMatchObject({ loserId: 'beto', actual: QUISPE });
  });

  it('desconfiar de un Quispe falso: pierde quien cantó', () => {
    let s = act(rollAs(newGame(), 'ana', [6, 6]), 'CALL', 'ana', QUISPE);
    s = act(s, 'DOUBT', 'beto');
    expect(s.round.result).toMatchObject({ loserId: 'ana', actual: 160 });
  });

  it('se compara contra el último que cantó, no contra quien abrió', () => {
    let s = act(rollAs(newGame(), 'ana', [5, 4]), 'CALL', 'ana', 42);
    s = act(believeAndRoll(s, 'beto', [5, 4]), 'CALL', 'beto', 110);
    s = act(s, 'DOUBT', 'cata');
    expect(s.round.result).toMatchObject({ loserId: 'beto', callerId: 'beto', doubterId: 'cata', actual: 54 });
  });

  it('al desconfiar se destapan los dados de la última tirada, no los de quien abrió', () => {
    let s = act(rollAs(newGame(), 'ana', [6, 6]), 'CALL', 'ana', 42);
    s = act(believeAndRoll(s, 'beto', [3, 1]), 'CALL', 'beto', 43);
    s = act(s, 'DOUBT', 'cata');
    expect(s.round.result).toMatchObject({ loserId: 'beto', dice: [3, 1], actual: 31 });
  });
});

describe('Cholada', () => {
  it('cantar más bajo que la jugada anterior pierde la ronda sin destapar', () => {
    let s = act(rollAs(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 62);
    s = act(believeAndRoll(s, 'beto', [3, 1]), 'CALL', 'beto', 54);
    expect(s.round.result).toMatchObject({ type: RESULTS.CHOLADA, reason: CHOLADA_REASONS.LOWER_CALL, loserId: 'beto', call: 54 });
    expect(s.round.calls).toHaveLength(1);
    // Sin destape: nadie ve los dados
    expect(s.round.result).toMatchObject({ revealed: false, dice: null, actual: null });
    expect(canSeeDice(s, 'cata')).toBe(false);
  });

  it('cantar la misma jugada también es Cholada', () => {
    let s = act(rollAs(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 62);
    s = act(believeAndRoll(s, 'beto', [3, 1]), 'CALL', 'beto', 62);
    expect(s.round.result).toMatchObject({ type: RESULTS.CHOLADA, loserId: 'beto' });
  });
});

describe('creer un Quispe', () => {
  it('quien cree un Quispe pierde, aunque no fuera cierto', () => {
    let s = act(rollAs(newGame(), 'ana', [3, 1]), 'CALL', 'ana', QUISPE);
    s = act(s, 'BELIEVE', 'beto');
    expect(s.round.result).toMatchObject({
      type: RESULTS.CHOLADA,
      reason: CHOLADA_REASONS.BELIEVED_QUISPE,
      loserId: 'beto',
      cost: 1,
      revealed: false,
    });
    expect(canSeeDice(s, 'beto')).toBe(false);
  });
});

describe('siguiente ronda', () => {
  it('la abre quien perdió y la jugada cantada vuelve a cero', () => {
    let s = act(rollAs(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 42);
    s = act(act(s, 'DOUBT', 'beto'), 'NEXT_ROUND');
    expect(s).toMatchObject({ phase: PHASES.ROLL, currentPlayerId: 'ana' });
    expect(s.round).toEqual({ number: 2, openerId: 'ana', dice: null, calls: [], result: null });
  });

  it('si el perdedor quedó eliminado, abre el siguiente activo', () => {
    let s = newGame();
    s = { ...s, players: s.players.map((p) => (p.id === 'beto' ? { ...p, letters: 5 } : p)) };
    s = act(rollAs(s, 'ana', [6, 6]), 'CALL', 'ana', 42);
    s = act(s, 'DOUBT', 'beto');
    expect(s.players.find((p) => p.id === 'beto').eliminated).toBe(true);
    s = act(s, 'NEXT_ROUND');
    expect(s.currentPlayerId).toBe('cata');
  });

  it('el orden de giro vuelve del último al primero', () => {
    let s = act(rollAs(newGame({ opener: 2 }), 'cata', [4, 2]), 'CALL', 'cata', 42);
    expect(s.currentPlayerId).toBe('ana');
  });

  it('si el perdedor eliminado es el último de la lista, abre el primero', () => {
    let s = newGame({ opener: 1 });
    s = { ...s, players: s.players.map((p) => (p.id === 'cata' ? { ...p, letters: 5 } : p)) };
    s = act(rollAs(s, 'beto', [6, 6]), 'CALL', 'beto', 42);
    s = act(act(s, 'DOUBT', 'cata'), 'NEXT_ROUND');
    expect(s.currentPlayerId).toBe('ana');
  });

  it('el orden de giro salta a los eliminados', () => {
    let s = newGame();
    s = { ...s, players: s.players.map((p) => (p.id === 'beto' ? { ...p, eliminated: true } : p)) };
    s = act(rollAs(s, 'ana', [4, 2]), 'CALL', 'ana', 42);
    expect(s.currentPlayerId).toBe('cata');
  });
});

describe('modos y fin de partida', () => {
  // Hace que playerId pierda una ronda que él mismo abre (canta 65 con 3 y 1 y lo descubren)
  function loseOwnRound(s, playerId) {
    s = act(rollAs(s, playerId, [3, 1]), 'CALL', playerId, 65);
    return act(s, 'DOUBT', s.currentPlayerId);
  }

  it('Clásico: completar QUISPE elimina y el último en pie gana', () => {
    let s = newGame({ players: PLAYERS.slice(0, 2) });
    for (let i = 0; i < 5; i++) s = act(loseOwnRound(s, 'ana'), 'NEXT_ROUND');
    expect(s.players[0]).toMatchObject({ letters: 5, eliminated: false });
    s = loseOwnRound(s, 'ana');
    expect(s.players[0]).toMatchObject({ letters: 6, eliminated: true });
    expect(s).toMatchObject({ phase: PHASES.GAME_OVER, winnerId: 'beto', currentPlayerId: null });
    expect(() => act(s, 'NEXT_ROUND')).toThrow(GameRuleError);
  });

  it('Por vidas: quedarse sin vidas elimina', () => {
    let s = newGame({ mode: 'lives', lives: 2, players: PLAYERS.slice(0, 2) });
    s = act(loseOwnRound(s, 'ana'), 'NEXT_ROUND');
    expect(s.players[0].lives).toBe(1);
    s = loseOwnRound(s, 'ana');
    expect(s.players[0]).toMatchObject({ lives: 0, eliminated: true });
    expect(s.winnerId).toBe('beto');
  });

  it('Castigo personalizado: el resultado lleva el texto del castigo', () => {
    const s = loseOwnRound(newGame({ mode: 'penalty', penaltyText: 'Cuenta un secreto' }), 'ana');
    expect(s.round.result.penaltyText).toBe('Cuenta un secreto');
    expect(s.players[0].letters).toBe(1);
  });

  it('la partida también puede terminar por Cholada o por creer un Quispe', () => {
    const lastLetter = () => {
      const s = newGame({ players: PLAYERS.slice(0, 2) });
      return { ...s, players: s.players.map((p) => (p.id === 'beto' ? { ...p, letters: 5 } : p)) };
    };
    let cholada = act(rollAs(lastLetter(), 'ana', [4, 2]), 'CALL', 'ana', 42);
    cholada = act(believeAndRoll(cholada, 'beto', [4, 2]), 'CALL', 'beto', 31);
    expect(cholada).toMatchObject({ phase: PHASES.GAME_OVER, winnerId: 'ana' });

    let quispe = act(rollAs(lastLetter(), 'ana', [4, 2]), 'CALL', 'ana', QUISPE);
    quispe = act(quispe, 'BELIEVE', 'beto');
    expect(quispe).toMatchObject({ phase: PHASES.GAME_OVER, winnerId: 'ana' });
  });

  it('en los otros modos no hay texto de castigo', () => {
    expect(loseOwnRound(newGame(), 'ana').round.result.penaltyText).toBeNull();
  });
});

describe('canSeeDice', () => {
  it('solo quien acaba de tirar ve los dados, antes de cantar', () => {
    let s = rollAs(newGame(), 'ana', [4, 2]);
    expect(canSeeDice(s, 'ana')).toBe(true);
    expect(canSeeDice(s, 'beto')).toBe(false);
    s = act(s, 'CALL', 'ana', 42);
    expect(canSeeDice(s, 'ana')).toBe(false);
    s = act(s, 'BELIEVE', 'beto');
    expect(canSeeDice(s, 'beto')).toBe(false); // todavía no tira
    s = rollAs(s, 'beto', [5, 1]);
    expect(canSeeDice(s, 'beto')).toBe(true);
    expect(canSeeDice(s, 'ana')).toBe(false);
  });

  it('al terminar la ronda se destapan para todos', () => {
    let s = act(rollAs(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 42);
    s = act(s, 'DOUBT', 'beto');
    expect(canSeeDice(s, 'cata')).toBe(true);
  });
});

describe('variantes', () => {
  const doubtQuispe = (dice, variants) => {
    let s = act(rollAs(newGame({ variants }), 'ana', dice), 'CALL', 'ana', QUISPE);
    return act(s, 'DOUBT', 'beto');
  };
  const letters = (s, id) => s.players.find((p) => p.id === id).letters;

  it('Quispe vale más (activa por defecto): desconfiar de un Quispe cierto cuesta 2', () => {
    const s = doubtQuispe([2, 1]);
    expect(s.round.result).toMatchObject({ loserId: 'beto', cost: 2 });
    expect(letters(s, 'beto')).toBe(2);
  });

  it('Quispe vale más: cantar un Quispe falso y que te descubran cuesta 3', () => {
    const s = doubtQuispe([6, 6]);
    expect(s.round.result).toMatchObject({ loserId: 'ana', cost: 3 });
    expect(letters(s, 'ana')).toBe(3);
  });

  it('Quispe vale más: no aplica si no se cantó Quispe, aunque los dados lo sean', () => {
    let s = act(rollAs(newGame(), 'ana', [2, 1]), 'CALL', 'ana', 65);
    s = act(s, 'DOUBT', 'beto');
    expect(s.round.result).toMatchObject({ loserId: 'beto', cost: 1 });
  });

  it('Quispe vale más desactivada: todo cuesta 1', () => {
    expect(doubtQuispe([2, 1], { quispeBonus: { enabled: false } }).round.result.cost).toBe(1);
    expect(doubtQuispe([6, 6], { quispeBonus: { enabled: false } }).round.result.cost).toBe(1);
  });

  it('en modo Por vidas, el costo se descuenta de las vidas', () => {
    let s = act(rollAs(newGame({ mode: 'lives', lives: 5 }), 'ana', [6, 6]), 'CALL', 'ana', QUISPE);
    s = act(s, 'DOUBT', 'beto');
    expect(s.players.find((p) => p.id === 'ana').lives).toBe(2);
  });

  it('Destapar en Cholada: muestra los dados al hacer Cholada', () => {
    let s = act(rollAs(newGame({ variants: { revealOnCholada: { enabled: true } } }), 'ana', [3, 1]), 'CALL', 'ana', 62);
    s = act(believeAndRoll(s, 'beto', [3, 1]), 'CALL', 'beto', 54);
    expect(s.round.result).toMatchObject({ type: RESULTS.CHOLADA, revealed: true, dice: [3, 1], actual: 31 });
    expect(canSeeDice(s, 'cata')).toBe(true);
  });

  it('Reloj de presión: si se acaba el tiempo es Cholada', () => {
    const variants = { pressureClock: { enabled: true, seconds: 10 } };
    let s = act(rollAs(newGame({ variants }), 'ana', [4, 2]), 'CALL', 'ana', 42);
    expect(s.config.variants.pressureClock.seconds).toBe(10);
    s = act(s, 'TIMEOUT', 'beto');
    expect(s.round.result).toMatchObject({ type: RESULTS.CHOLADA, reason: CHOLADA_REASONS.TIMEOUT, loserId: 'beto' });
  });

  it('Reloj de presión: TIMEOUT fuera de la fase de decidir o del turno se rechaza', () => {
    const variants = { pressureClock: { enabled: true } };
    const decide = act(rollAs(newGame({ variants }), 'ana', [4, 2]), 'CALL', 'ana', 42);
    expect(() => act(decide, 'TIMEOUT', 'cata')).toThrow(expect.objectContaining({ code: 'NOT_YOUR_TURN' }));
    const believed = act(decide, 'BELIEVE', 'beto');
    expect(() => act(believed, 'TIMEOUT', 'beto')).toThrow(expect.objectContaining({ code: 'WRONG_PHASE' }));
  });

  it('Reloj de presión desactivado: TIMEOUT se rechaza', () => {
    const s = act(rollAs(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 42);
    expect(() => act(s, 'TIMEOUT', 'beto')).toThrow(expect.objectContaining({ code: 'VARIANT_DISABLED' }));
  });
});

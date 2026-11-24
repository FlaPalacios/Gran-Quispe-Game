import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../engine/rules.js';
import { connectGameSounds } from './gameSounds.js';
import { hasVoice, playSfx, playVoice } from './audio.js';

// El audio de verdad necesita navegador: aquí solo interesa qué se pide y cuándo.
// Por defecto nadie tiene voz grabada; las pruebas de voces la encienden.
vi.mock('./audio.js', () => ({
  playSfx: vi.fn(),
  playVoice: vi.fn(),
  hasVoice: vi.fn(() => false),
  preloadVoices: vi.fn(),
  sfxDuration: vi.fn(() => null),
}));

const LAUGHS = ['laughMan', 'laughMan2', 'laughGranny'];
const dieValue = (d) => (d - 1) / 6;
const rngFrom = (...values) => () => values.shift() ?? 0;

const PLAYERS = [
  { id: 'ana', name: 'Ana' },
  { id: 'beto', name: 'Beto' },
  { id: 'cata', name: 'Cata' },
];

// Abre siempre 'ana'
const newGame = (config = {}) => createGame({ config: { mode: 'classic', ...config }, players: PLAYERS }, { rng: rngFrom(0) });
const roll = (state, playerId, dice) =>
  applyAction(state, { type: 'ROLL', playerId }, { rng: rngFrom(dieValue(dice[0]), dieValue(dice[1])) });
const act = (state, type, playerId, value) => applyAction(state, { type, playerId, value });

// Store de mentira: solo hace falta que avise a quien escucha
function fakeStore() {
  const listeners = new Set();
  const signalListeners = new Set();
  let snapshot = { game: null, revealing: false };
  return {
    get: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onSignal(fn) {
      signalListeners.add(fn);
      return () => signalListeners.delete(fn);
    },
    signal: (name) => signalListeners.forEach((fn) => fn(name)),
    emit(next) {
      snapshot = { revealing: false, ...next };
      listeners.forEach((fn) => fn(snapshot));
    },
  };
}

const sounds = () => playSfx.mock.calls.map(([key]) => key);
// Las voces: [personaje, clave]. Ana, Beto y Cata son los personajes 0, 1 y 2
const voices = () => playVoice.mock.calls;

describe('connectGameSounds', () => {
  let store;
  let disconnect;

  beforeEach(() => {
    playSfx.mockClear();
    playVoice.mockClear();
    hasVoice.mockImplementation(() => false);
    store = fakeStore();
    disconnect = connectGameSounds(store);
  });

  afterEach(() => disconnect());

  it('la cerveza suena al empezar una partida, no al continuar una guardada', () => {
    store.signal('gameStart');
    expect(sounds()).toEqual(['start']);
  });

  it('mientras se destapa solo suena el cubilete levantándose', () => {
    const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
    store.emit({ game: called });
    playSfx.mockClear();
    store.emit({ game: act(called, 'DOUBT', 'beto'), revealing: true });
    expect(sounds()).toEqual(['reveal']);
  });

  it('el remate entra recién cuando termina el destape', () => {
    const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
    const over = act(called, 'DOUBT', 'beto');
    store.emit({ game: called });
    store.emit({ game: over, revealing: true });
    playSfx.mockClear();
    store.emit({ game: over, revealing: false });
    // Pillaron mintiendo a ana: una risa al azar, y nada más
    expect(sounds()).toHaveLength(1);
    expect(LAUGHS).toContain(sounds()[0]);
  });

  it('una Cholada sin destape suena al momento, sin esperar', () => {
    vi.useFakeTimers();
    try {
      let s = act(roll(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 62);
      store.emit({ game: s });
      playSfx.mockClear();
      s = act(roll(act(s, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 31); // más bajo
      store.emit({ game: s });
      // La Cholada es su propio remate: no espera nada ni suma otro sonido
      expect(sounds()).toEqual(['cholada']);
      vi.advanceTimersByTime(1000);
      expect(sounds()).toEqual(['cholada']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('si la Cholada deja a alguien fuera, el remate entra después del golpe', () => {
    vi.useFakeTimers();
    try {
      const start = createGame(
        { config: { mode: 'lives', lives: 1 }, players: PLAYERS },
        { rng: rngFrom(0) },
      );
      let s = act(roll(start, 'ana', [4, 2]), 'CALL', 'ana', 62);
      store.emit({ game: s });
      playSfx.mockClear();
      s = act(roll(act(s, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 31);
      store.emit({ game: s });
      expect(sounds()).toEqual(['cholada']);
      vi.advanceTimersByTime(500);
      expect(sounds()).toEqual(['cholada', 'eliminated']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('creer un Quispe no suena a Cholada: solo la risa', () => {
    vi.useFakeTimers();
    try {
      const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 21);
      store.emit({ game: called });
      playSfx.mockClear();
      store.emit({ game: act(called, 'BELIEVE', 'beto') });
      expect(sounds()).toEqual([]);
      vi.advanceTimersByTime(500);
      expect(sounds()).toHaveLength(1);
      expect(LAUGHS).toContain(sounds()[0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('las risas se van turnando: dos derrotas seguidas no repiten', () => {
    const perder = (dice, call) => {
      const called = act(roll(newGame(), 'ana', dice), 'CALL', 'ana', call);
      const over = act(called, 'DOUBT', 'beto');
      store.emit({ game: called });
      store.emit({ game: over, revealing: true });
      store.emit({ game: over, revealing: false });
    };
    playSfx.mockClear();
    perder([3, 1], 65); // pillan a ana mintiendo
    perder([6, 5], 65); // ana cantó lo que tenía: pierde beto
    // Entre medias suena el destape: aquí solo interesan las risas
    const risas = sounds().filter((key) => LAUGHS.includes(key));
    expect(risas).toHaveLength(2);
    expect(risas[1]).not.toBe(risas[0]);
  });

  it('al ganar la partida suenan el remate y el brindis a la vez', () => {
    const start = createGame(
      { config: { mode: 'lives', lives: 1 }, players: PLAYERS.slice(0, 2) },
      { rng: rngFrom(0) },
    );
    const called = act(roll(start, 'ana', [3, 1]), 'CALL', 'ana', 65);
    const over = act(called, 'DOUBT', 'beto');
    store.emit({ game: called });
    store.emit({ game: over, revealing: true });
    playSfx.mockClear();
    store.emit({ game: over, revealing: false });
    expect(sounds()).toEqual(['win', 'cheer']);
  });

  it('cada sacudida suena, pero no más rápido que el propio sonido', () => {
    vi.useFakeTimers();
    try {
      store.signal('cupShake');
      store.signal('cupShake'); // encima de la anterior: no se reinicia
      expect(sounds()).toEqual(['shake']);
      vi.advanceTimersByTime(600);
      store.signal('cupShake');
      expect(sounds()).toEqual(['shake', 'shake']);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('voces de los personajes', () => {
    beforeEach(() => hasVoice.mockImplementation(() => true));

    it('al cantar, el personaje dice la jugada; el Quispe, con su nombre', () => {
      const rolled = roll(newGame(), 'ana', [4, 2]);
      store.emit({ game: rolled });
      store.emit({ game: act(rolled, 'CALL', 'ana', 42) });
      const quispe = roll(newGame(), 'ana', [2, 1]);
      store.emit({ game: quispe });
      store.emit({ game: act(quispe, 'CALL', 'ana', 21) });
      expect(voices()).toEqual([
        [0, '42'],
        [0, 'quispe'],
      ]);
    });

    it('quien cree y quien desconfía lo dicen', () => {
      const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
      store.emit({ game: called });
      playVoice.mockClear();
      store.emit({ game: act(called, 'BELIEVE', 'beto') });
      store.emit({ game: called });
      store.emit({ game: act(called, 'DOUBT', 'beto'), revealing: true });
      expect(voices()).toEqual([
        [1, 'creo'],
        [1, 'desconfio'],
      ]);
    });

    it('al pillar al mentiroso habla quien desconfió, y su frase reemplaza la risa', () => {
      const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
      const over = act(called, 'DOUBT', 'beto');
      store.emit({ game: called });
      store.emit({ game: over, revealing: true });
      playSfx.mockClear();
      playVoice.mockClear();
      store.emit({ game: over, revealing: false });
      expect(sounds()).toEqual([]);
      expect(voices()).toEqual([[1, 'pille']]);
    });

    it('sin la frase grabada, queda la risa de siempre', () => {
      hasVoice.mockImplementation((character, key) => key !== 'pille');
      const called = act(roll(newGame(), 'ana', [3, 1]), 'CALL', 'ana', 65);
      const over = act(called, 'DOUBT', 'beto');
      store.emit({ game: called });
      store.emit({ game: over, revealing: true });
      playSfx.mockClear();
      store.emit({ game: over, revealing: false });
      expect(LAUGHS).toContain(sounds()[0]);
    });

    it('la frase de la Cholada espera a la risa de la Cholada, y se cancela si la partida sigue', () => {
      vi.useFakeTimers();
      try {
        let s = act(roll(newGame(), 'ana', [4, 2]), 'CALL', 'ana', 62);
        store.emit({ game: s });
        s = act(roll(act(s, 'BELIEVE', 'beto'), 'beto', [4, 2]), 'CALL', 'beto', 31);
        // El mock no sabe cuánto dura la risa: se espera el tope
        playVoice.mockClear();
        store.emit({ game: s });
        expect(voices()).toEqual([]);
        store.emit({ game: act(s, 'NEXT_ROUND') });
        vi.advanceTimersByTime(3000);
        expect(voices()).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

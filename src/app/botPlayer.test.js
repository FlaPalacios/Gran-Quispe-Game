import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectBots } from './botPlayer.js';
import { createGameStore, needsPassScreen } from './gameStore.js';

// rng con semilla (mulberry32), para que la partida sea siempre la misma
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bot = (id, personality) => ({ id, name: id, isBot: true, personality });
const newStore = (rng) => createGameStore({ rng, save: vi.fn(), clear: vi.fn() });

describe('connectBots', () => {
  afterEach(() => vi.useRealTimers());

  it('una partida solo de bots se juega sola hasta el final', () => {
    vi.useFakeTimers();
    const store = newStore(seeded(7));
    const stop = connectBots(store, { rng: seeded(8) });
    store.start({ config: { mode: 'lives', lives: 1 }, players: [bot('a', 'honest'), bot('b', 'bluffer'), bot('c', 'suspicious')] });
    for (let i = 0; i < 400 && store.get().game.phase !== 'GAME_OVER'; i++) vi.advanceTimersByTime(1000);
    expect(store.get().game.phase).toBe('GAME_OVER');
    stop();
  });

  it('el turno de un bot no pide pasar el celular, y espera a que juegue la persona', () => {
    vi.useFakeTimers();
    // rng 0: abre el primero de la lista, la persona
    const store = newStore(() => 0);
    connectBots(store, { rng: () => 0 });
    // Dos personas: con una sola no hay pantalla de pase
    store.start({ config: { mode: 'classic' }, players: [{ id: 'ana', name: 'Ana' }, bot('b', 'honest'), { id: 'cata', name: 'Cata' }] });
    vi.advanceTimersByTime(10000);
    expect(store.get().game).toMatchObject({ phase: 'ROLL', currentPlayerId: 'ana' });
    expect(needsPassScreen(store.get())).toBe(true);
    store.confirmViewer('ana');
    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    store.dispatch({ type: 'CALL', playerId: 'ana', value: 42 });
    expect(needsPassScreen(store.get())).toBe(false); // le toca al bot
    vi.advanceTimersByTime(10000);
    expect(store.get().game.currentPlayerId).not.toBe('b'); // ya decidió
  });

  it('después del turno de un bot, a la persona siguiente se le vuelve a pedir el pase', () => {
    vi.useFakeTimers();
    const store = newStore(() => 0); // abre el bot, primero de la lista
    connectBots(store, { rng: () => 0.99 }); // canta la verdad y luego cree
    store.start({ config: { mode: 'classic' }, players: [bot('b', 'honest'), { id: 'ana', name: 'Ana' }, { id: 'cata', name: 'Cata' }] });
    vi.advanceTimersByTime(10000);
    expect(store.get().game).toMatchObject({ phase: 'DECIDE', currentPlayerId: 'ana' });
    expect(needsPassScreen(store.get())).toBe(true);
  });

  it('salir al menú con una jugada de bot pendiente no la despacha', () => {
    vi.useFakeTimers();
    const store = newStore(() => 0);
    connectBots(store);
    store.start({ config: { mode: 'classic' }, players: [bot('b', 'honest'), { id: 'ana', name: 'Ana' }] });
    store.leave();
    vi.advanceTimersByTime(10000);
    expect(store.get().game).toBeNull();
  });
});

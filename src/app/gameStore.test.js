import { describe, expect, it, vi } from 'vitest';
import { createGameStore, needsPassScreen, viewerCanSeeDice } from './gameStore.js';

const SETUP = {
  config: { mode: 'classic' },
  players: [
    { id: 'ana', name: 'Ana' },
    { id: 'beto', name: 'Beto' },
  ],
};

// Primer valor: abre 'ana'; luego los dados. Agotada la lista, devuelve 0
const sequence = (...values) => () => values.shift() ?? 0;

function newStore(...rngValues) {
  const save = vi.fn();
  const clear = vi.fn();
  const store = createGameStore({ rng: sequence(0, ...rngValues), save, clear });
  return { store, save, clear };
}

describe('gameStore', () => {
  it('crea la partida, la guarda y avisa a los suscritos', () => {
    const { store, save } = newStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.start(SETUP);
    expect(store.get().game.currentPlayerId).toBe('ana');
    expect(save).toHaveBeenCalledWith(store.get().game);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('pide pasar el celular cada vez que cambia el jugador en turno', () => {
    const { store } = newStore(0.5, 0.2);
    store.start(SETUP);
    expect(needsPassScreen(store.get())).toBe(true);
    store.confirmViewer('ana');
    expect(needsPassScreen(store.get())).toBe(false);

    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    expect(store.get().game.round.dice).toEqual([4, 2]);
    expect(needsPassScreen(store.get())).toBe(false); // sigue siendo el turno de Ana

    store.dispatch({ type: 'CALL', playerId: 'ana', value: 42 });
    expect(store.get().viewerId).toBeNull();
    expect(needsPassScreen(store.get())).toBe(true);

    store.confirmViewer('beto');
    store.dispatch({ type: 'BELIEVE', playerId: 'beto' });
    expect(needsPassScreen(store.get())).toBe(false); // vuelve a tirar sin pasar el celular
  });

  it('los dados se ven solo con el celular en manos de quien acaba de tirar', () => {
    const { store } = newStore(0.5, 0.2);
    store.start(SETUP);
    store.confirmViewer('ana');
    expect(viewerCanSeeDice(store.get())).toBe(false); // todavía no tira
    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    expect(viewerCanSeeDice(store.get())).toBe(true);
    store.leave();
    expect(viewerCanSeeDice(store.get())).toBe(false);
  });

  it('las señales de la interfaz llegan a quien escucha y no tocan el estado', () => {
    const { store } = newStore();
    store.start(SETUP);
    const before = store.get();
    const heard = vi.fn();
    const stop = store.onSignal(heard);
    store.signal('cupShake');
    expect(heard).toHaveBeenCalledWith('cupShake');
    expect(store.get()).toEqual(before);
    stop();
    store.signal('cupShake');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('el turno empieza al confirmar el pase y se reinicia al cambiar de jugador o de partida', () => {
    let clock = 1000;
    const store = createGameStore({ rng: sequence(0, 0.5, 0.2), save: vi.fn(), clear: vi.fn(), now: () => clock });
    store.start(SETUP);
    expect(store.get().turnStartedAt).toBeNull();
    store.confirmViewer('ana');
    expect(store.get().turnStartedAt).toBe(1000);
    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    store.dispatch({ type: 'CALL', playerId: 'ana', value: 42 });
    expect(store.get().turnStartedAt).toBeNull();
    clock = 5000;
    store.confirmViewer('beto');
    expect(store.get().turnStartedAt).toBe(5000);
    store.leave();
    expect(store.get().turnStartedAt).toBeNull();
  });

  it('no pide pase al terminar la ronda y borra el guardado al terminar la partida', () => {
    const { store, clear } = newStore(0.5, 0.2);
    store.start({ ...SETUP, config: { mode: 'lives', lives: 1 } });
    store.dispatch({ type: 'ROLL', playerId: 'ana' });
    store.dispatch({ type: 'CALL', playerId: 'ana', value: 65 });
    store.dispatch({ type: 'DOUBT', playerId: 'beto' });
    expect(store.get().game.phase).toBe('GAME_OVER');
    expect(needsPassScreen(store.get())).toBe(false);
    expect(clear).toHaveBeenCalled();
  });

  it('salir al menú conserva el guardado; abandonar lo borra', () => {
    const { store, clear } = newStore();
    store.start(SETUP);
    store.leave();
    expect(store.get().game).toBeNull();
    expect(clear).not.toHaveBeenCalled();
    store.start(SETUP);
    store.abandon();
    expect(clear).toHaveBeenCalled();
  });
});

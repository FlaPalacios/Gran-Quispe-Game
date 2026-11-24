import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECONNECT_GRACE_MS, createRooms } from './rooms.js';

// Guarda lo último que le llegó a cada socket, por evento
function fakeSockets() {
  const inbox = {};
  const send = (socketId, event, data) => {
    inbox[socketId] ??= {};
    inbox[socketId][event] = data;
  };
  return { inbox, send };
}

const SETUP = {
  config: { mode: 'classic' },
  players: [
    { id: 'p1', name: 'Ana' },
    { id: 'p2', name: '' },
    { id: 'p3', name: 'Bot', isBot: true, personality: 'honest' },
  ],
};

describe('salas online', () => {
  afterEach(() => vi.useRealTimers());

  function openRoom() {
    vi.useFakeTimers();
    const { inbox, send } = fakeSockets();
    const rooms = createRooms({ send, rng: () => 0 }); // abre el primer asiento: Ana
    const host = rooms.create('s-ana', { setup: SETUP, name: 'Ana' });
    const guest = rooms.join('s-beto', { code: host.code.toLowerCase(), name: '  Beto  ' });
    return { inbox, rooms, host, guest };
  }

  it('se crea con un código de 4 letras, se entra con él y el anfitrión la empieza', () => {
    const { inbox, rooms, host, guest } = openRoom();
    expect(host.code).toMatch(/^[A-Z]{4}$/);
    expect(guest.playerId).toBe('p2');
    expect(inbox['s-ana'].lobby.seats.map((s) => [s.name, s.taken])).toEqual([['Ana', true], ['Beto', true], ['Bot', true]]);
    expect(() => rooms.join('s-x', { code: host.code })).toThrow(expect.objectContaining({ code: 'FULL' }));
    expect(() => rooms.start('s-beto')).toThrow(expect.objectContaining({ code: 'NOT_HOST' }));
    rooms.start('s-ana');
    expect(inbox['s-beto'].state.game.currentPlayerId).toBe('p1');
    expect(() => rooms.join('s-x', { code: host.code })).toThrow(expect.objectContaining({ code: 'STARTED' }));
  });

  it('a cada uno le llegan solo sus dados, y nadie juega por otro asiento', () => {
    const { inbox, rooms } = openRoom();
    rooms.start('s-ana');
    rooms.action('s-ana', { type: 'ROLL', playerId: 'p1' });
    expect(inbox['s-ana'].state.game.round.dice).toEqual([1, 1]);
    expect(inbox['s-beto'].state.game.round.dice).toBeNull();
    expect(() => rooms.action('s-beto', { type: 'CALL', playerId: 'p1', value: 110 })).toThrow(expect.objectContaining({ code: 'NOT_YOUR_SEAT' }));
  });

  it('si alguien se desconecta, se le guarda el asiento y después juega un bot por él', () => {
    const { inbox, rooms, host } = openRoom();
    rooms.start('s-ana');
    rooms.disconnect('s-ana');
    vi.advanceTimersByTime(RECONNECT_GRACE_MS - 1000);
    expect(inbox['s-beto'].state.game.phase).toBe('ROLL'); // todavía espera a Ana
    vi.advanceTimersByTime(3000);
    expect(inbox['s-beto'].state.game.phase).toBe('CALL'); // tiró el bot suplente

    // Ana vuelve con su token y recupera el asiento
    const back = rooms.rejoin('s-ana-2', { code: host.code, playerId: 'p1', token: host.token });
    expect(back.playerId).toBe('p1');
    expect(rooms.get(host.code).seats[0]).toMatchObject({ socketId: 's-ana-2', autopilot: false });
    expect(() => rooms.rejoin('s-x', { code: host.code, playerId: 'p1', token: 'otro' })).toThrow(expect.objectContaining({ code: 'NO_ROOM' }));
  });

  it('con el azar de verdad del servidor la sala se crea y empieza', () => {
    const rooms = createRooms({ send: () => {} });
    const host = rooms.create('s-ana', { setup: SETUP });
    rooms.join('s-beto', { code: host.code });
    expect(() => rooms.start('s-ana')).not.toThrow();
    expect(rooms.get(host.code).store.get().game.phase).toBe('ROLL');
  });

  it('rechaza una configuración inválida', () => {
    const rooms = createRooms({ send: () => {} });
    expect(() => rooms.create('s', { setup: { config: { mode: 'nada' }, players: SETUP.players } })).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
    const onlyBots = { ...SETUP, players: [SETUP.players[2], { ...SETUP.players[2], id: 'p2' }] };
    expect(() => rooms.create('s', { setup: onlyBots })).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
  });

  it('un doble toque en Unirse no ocupa dos asientos', () => {
    vi.useFakeTimers();
    const { send } = fakeSockets();
    const rooms = createRooms({ send, rng: () => 0 });
    const setup = { ...SETUP, players: [SETUP.players[0], { id: 'p2', name: '' }, { id: 'p3', name: '' }] };
    const host = rooms.create('s-ana', { setup });
    rooms.join('s-beto', { code: host.code });
    rooms.join('s-beto', { code: host.code });
    const taken = rooms.get(host.code).seats.filter((s) => s.socketId === 's-beto');
    expect(taken).toHaveLength(1);
  });

  it('quien soltó un asiento en la espera no puede volver a él si ya lo ocupó otro', () => {
    const { inbox, rooms, host, guest } = openRoom();
    rooms.disconnect('s-beto');
    const other = rooms.join('s-cata', { code: host.code, name: 'Cata' });
    expect(other.playerId).toBe(guest.playerId);
    expect(other.token).not.toBe(guest.token); // token nuevo
    expect(() => rooms.rejoin('s-beto-2', { code: host.code, playerId: guest.playerId, token: guest.token })).toThrow(
      expect.objectContaining({ code: 'NO_ROOM' }),
    );
    // El asiento del anfitrión no se lo lleva nadie aunque se le corte la conexión
    rooms.disconnect('s-ana');
    expect(() => rooms.join('s-dani', { code: host.code })).toThrow(expect.objectContaining({ code: 'FULL' }));
    // Si el mismo asiento se abre en otro lado, al de antes se le avisa
    rooms.rejoin('s-ana-2', { code: host.code, playerId: 'p1', token: host.token });
    rooms.rejoin('s-ana-3', { code: host.code, playerId: 'p1', token: host.token });
    expect(inbox['s-ana-2'].lost).toBe('SEAT_TAKEN');
  });

  it('si vuelve mientras el suplente piensa, el suplente no juega', () => {
    const { inbox, rooms, host } = openRoom();
    rooms.start('s-ana');
    rooms.disconnect('s-ana');
    vi.advanceTimersByTime(RECONNECT_GRACE_MS + 500); // suplente a mitad de pensar
    rooms.rejoin('s-ana-2', { code: host.code, playerId: 'p1', token: host.token });
    vi.advanceTimersByTime(5000);
    expect(inbox['s-ana-2'].state.game.phase).toBe('ROLL');
  });

  it('salir a propósito deja jugar al suplente sin esperar', () => {
    const { inbox, rooms } = openRoom();
    rooms.start('s-ana');
    rooms.quit('s-ana');
    vi.advanceTimersByTime(2000);
    expect(inbox['s-beto'].state.game.phase).toBe('CALL');
  });

  it('el reloj de presión lo cumple el servidor', () => {
    vi.useFakeTimers();
    const { inbox, send } = fakeSockets();
    const rooms = createRooms({ send, rng: () => 0 });
    const setup = { config: { mode: 'classic', variants: { pressureClock: { enabled: true, seconds: 5 } } }, players: SETUP.players.slice(0, 2) };
    const host = rooms.create('s-ana', { setup });
    rooms.join('s-beto', { code: host.code });
    rooms.start('s-ana');
    rooms.action('s-ana', { type: 'ROLL', playerId: 'p1' });
    vi.advanceTimersByTime(5100);
    expect(inbox['s-beto'].state.game.round.result).toMatchObject({ type: 'CHOLADA', reason: 'TIMEOUT', loserId: 'p1' });
  });

  it('mientras se destapa nadie pasa a la ronda siguiente', () => {
    const { rooms } = openRoom();
    rooms.start('s-ana');
    rooms.action('s-ana', { type: 'ROLL', playerId: 'p1' });
    rooms.action('s-ana', { type: 'CALL', playerId: 'p1', value: 42 });
    rooms.action('s-beto', { type: 'DOUBT', playerId: 'p2' });
    expect(() => rooms.action('s-beto', { type: 'NEXT_ROUND' })).toThrow(expect.objectContaining({ code: 'REVEALING' }));
    vi.advanceTimersByTime(3000);
    expect(() => rooms.action('s-beto', { type: 'NEXT_ROUND' })).not.toThrow();
  });

  it('rechaza personalidades inventadas y textos de castigo enormes', () => {
    const rooms = createRooms({ send: () => {} });
    const weird = { ...SETUP, players: [SETUP.players[0], { ...SETUP.players[2], personality: 'toString' }] };
    expect(() => rooms.create('s', { setup: weird })).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
    const long = { ...SETUP, config: { mode: 'penalty', penaltyText: 'x'.repeat(5000) } };
    expect(() => rooms.create('s', { setup: long })).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
    expect(() => rooms.create('s', {})).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
  });

  it('las reacciones llegan a toda la sala, sin inventadas ni ráfagas', () => {
    const { inbox, rooms } = openRoom();
    rooms.start('s-ana');
    rooms.react('s-beto', { reaction: 'salud' });
    expect(inbox['s-ana'].reaction).toEqual({ playerId: 'p2', reaction: 'salud' });
    expect(inbox['s-beto'].reaction).toEqual({ playerId: 'p2', reaction: 'salud' });
    rooms.react('s-beto', { reaction: 'risa' }); // muy seguida: no se reenvía
    expect(inbox['s-ana'].reaction.reaction).toBe('salud');
    vi.advanceTimersByTime(2000);
    rooms.react('s-beto', { reaction: 'risa' });
    expect(inbox['s-ana'].reaction.reaction).toBe('risa');
    expect(() => rooms.react('s-beto', { reaction: 'toString' })).toThrow(expect.objectContaining({ code: 'BAD_REACTION' }));
  });

  it('quien salió de una partida vuelve con el código y su nombre; alguien nuevo no entra', () => {
    const { inbox, rooms, host } = openRoom();
    rooms.start('s-ana');
    rooms.quit('s-beto');
    expect(inbox['s-ana'].state.presence).toContainEqual({ id: 'p2', name: 'Beto', connected: false, autopilot: true });
    expect(() => rooms.join('s-x', { code: host.code, name: 'Cata' })).toThrow(expect.objectContaining({ code: 'STARTED' }));
    const back = rooms.join('s-beto-2', { code: host.code, name: 'beto' });
    expect(back.playerId).toBe('p2');
    expect(inbox['s-ana'].state.presence).toContainEqual({ id: 'p2', name: 'Beto', connected: true, autopilot: false });
  });
});

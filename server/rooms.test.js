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

const CONFIG = { mode: 'classic' };

describe('salas online', () => {
  afterEach(() => vi.useRealTimers());

  // Ana crea la sala, Beto entra con el código y Ana suma un bot: p1, p2 y p3
  function openRoom(config = CONFIG) {
    vi.useFakeTimers();
    const { inbox, send } = fakeSockets();
    const rooms = createRooms({ send, rng: () => 0 }); // abre el primer asiento: Ana
    const host = rooms.create('s-ana', { name: 'Ana', config });
    const guest = rooms.join('s-beto', { code: host.code.toLowerCase(), name: '  Beto  ' });
    rooms.addBot('s-ana', { personality: 'honest', name: 'Bot' });
    return { inbox, rooms, host, guest };
  }

  it('se crea con un código de 4 letras, se entra con él y el anfitrión la empieza', () => {
    const { inbox, rooms, host, guest } = openRoom();
    expect(host.code).toMatch(/^[A-Z]{4}$/);
    expect(guest.playerId).toBe('p2');
    expect(inbox['s-ana'].lobby.seats.map((s) => [s.name, s.taken, s.isBot])).toEqual([
      ['Ana', true, false],
      ['Beto', true, false],
      ['Bot', true, true],
    ]);
    // La configuración llega limpia: con lo que completa el motor y sin campos de más
    expect(inbox['s-beto'].lobby.config).toMatchObject({ mode: 'classic', scenario: 'cantina' });
    expect(() => rooms.start('s-beto')).toThrow(expect.objectContaining({ code: 'NOT_HOST' }));
    rooms.start('s-ana');
    expect(inbox['s-beto'].state.game.currentPlayerId).toBe('p1');
    expect(() => rooms.join('s-x', { code: host.code, name: 'Cata' })).toThrow(expect.objectContaining({ code: 'STARTED' }));
  });

  it('entran hasta 8, sin nombres repetidos', () => {
    const { rooms, host } = openRoom();
    expect(() => rooms.join('s-x', { code: host.code, name: 'beto' })).toThrow(expect.objectContaining({ code: 'NAME_TAKEN' }));
    expect(() => rooms.addBot('s-ana', { personality: 'bluffer', name: 'BOT' })).toThrow(expect.objectContaining({ code: 'NAME_TAKEN' }));
    for (let i = 4; i <= 8; i++) rooms.join(`s-${i}`, { code: host.code, name: `J${i}` });
    expect(rooms.get(host.code).seats).toHaveLength(8);
    expect(() => rooms.join('s-9', { code: host.code, name: 'J9' })).toThrow(expect.objectContaining({ code: 'FULL' }));
    expect(() => rooms.addBot('s-ana', { personality: 'honest', name: 'Otro' })).toThrow(expect.objectContaining({ code: 'FULL' }));
  });

  it('dentro de la sala, solo quien la creó cambia reglas, suma o quita asientos', () => {
    const { inbox, rooms, host } = openRoom();
    expect(() => rooms.configure('s-beto', { config: { mode: 'lives' } })).toThrow(expect.objectContaining({ code: 'NOT_HOST' }));
    expect(() => rooms.configure('s-ana', { config: { mode: 'nada' } })).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
    rooms.configure('s-ana', { config: { mode: 'lives', lives: 2, scenario: 'bar' } });
    expect(inbox['s-beto'].lobby.config).toMatchObject({ mode: 'lives', scenario: 'bar' });
    expect(() => rooms.addBot('s-ana', { personality: 'toString', name: 'X' })).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
    // Al quitar a una persona, se le avisa
    rooms.removeSeat('s-ana', { seatId: 'p2' });
    expect(inbox['s-beto'].lost).toBe('REMOVED');
    expect(() => rooms.removeSeat('s-ana', { seatId: 'p1' })).toThrow(expect.objectContaining({ code: 'NO_SEAT' }));
    rooms.removeSeat('s-ana', { seatId: 'p3' });
    // Sola no se puede empezar
    expect(() => rooms.start('s-ana')).toThrow(expect.objectContaining({ code: 'NOT_ENOUGH' }));
    expect(rooms.get(host.code).seats.map((s) => s.id)).toEqual(['p1']);
  });

  it('quien sale de la sala de espera libera su lugar; si solo se corta, se lo guardan', () => {
    const { rooms, host, guest } = openRoom();
    rooms.disconnect('s-beto');
    expect(rooms.get(host.code).seats).toHaveLength(3);
    expect(() => rooms.start('s-ana')).toThrow(expect.objectContaining({ code: 'SEATS_EMPTY' }));
    rooms.rejoin('s-beto-2', { code: host.code, playerId: guest.playerId, token: guest.token });
    rooms.quit('s-beto-2');
    expect(rooms.get(host.code).seats.map((s) => s.name)).toEqual(['Ana', 'Bot']);
  });

  it('si quien creó la sala sale antes de empezar, la sala pasa a la siguiente persona', () => {
    const { inbox, rooms, host } = openRoom();
    rooms.quit('s-ana');
    expect(rooms.get(host.code).hostId).toBe('p2');
    expect(inbox['s-beto'].lobby.seats.find((s) => s.host).name).toBe('Beto');
    expect(() => rooms.addBot('s-beto', { personality: 'honest', name: 'Otro' })).not.toThrow();
    // Si no queda ninguna persona, la sala se cierra
    rooms.quit('s-beto');
    expect(rooms.get(host.code)).toBeUndefined();
  });

  it('quien entra sin nombre recibe el primer "Jugador N" libre', () => {
    const { rooms, host } = openRoom();
    rooms.join('s-x', { code: host.code, name: 'Jugador 4' });
    expect(() => rooms.join('s-y', { code: host.code, name: '' })).not.toThrow();
    expect(rooms.get(host.code).seats.at(-1).name).toBe('Jugador 5');
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
    const host = rooms.create('s-ana', { name: 'Ana', config: CONFIG });
    rooms.join('s-beto', { code: host.code, name: 'Beto' });
    expect(() => rooms.start('s-ana')).not.toThrow();
    expect(rooms.get(host.code).store.get().game.phase).toBe('ROLL');
  });

  it('rechaza una configuración inválida', () => {
    const rooms = createRooms({ send: () => {} });
    expect(() => rooms.create('s', { config: { mode: 'nada' } })).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
    expect(() => rooms.create('s', { config: { mode: 'penalty', penaltyText: 'x'.repeat(5000) } })).toThrow(
      expect.objectContaining({ code: 'BAD_SETUP' }),
    );
    expect(() => rooms.create('s', {})).toThrow(expect.objectContaining({ code: 'BAD_SETUP' }));
  });

  it('un doble toque en Unirse no ocupa dos asientos', () => {
    const { rooms, host } = openRoom();
    rooms.join('s-cata', { code: host.code, name: 'Cata' });
    rooms.join('s-cata', { code: host.code, name: 'Cata' });
    expect(rooms.get(host.code).seats.filter((s) => s.socketId === 's-cata')).toHaveLength(1);
  });

  it('si el mismo asiento se abre en otro lado, al de antes se le avisa', () => {
    const { inbox, rooms, host } = openRoom();
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
    const { inbox, rooms } = openRoom({ mode: 'classic', variants: { pressureClock: { enabled: true, seconds: 5 } } });
    rooms.removeSeat('s-ana', { seatId: 'p3' });
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

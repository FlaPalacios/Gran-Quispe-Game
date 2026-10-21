import { describe, expect, it } from 'vitest';
import { CALL_SCALE, QUISPE, compareCalls, isValidCall, rankOf, readDice, rollDice } from './dice.js';

describe('readDice', () => {
  it('lee primero el dado mayor', () => {
    expect(readDice([4, 2])).toBe(42);
    expect(readDice([2, 4])).toBe(42);
    expect(readDice([3, 1])).toBe(31);
    expect(readDice([5, 6])).toBe(65);
  });

  it('lee los pares como 110 a 160', () => {
    expect(readDice([1, 1])).toBe(110);
    expect(readDice([3, 3])).toBe(130);
    expect(readDice([6, 6])).toBe(160);
  });

  it('lee 2 y 1 como Quispe', () => {
    expect(readDice([2, 1])).toBe(QUISPE);
    expect(readDice([1, 2])).toBe(QUISPE);
  });

  it('rechaza dados fuera de 1 a 6', () => {
    expect(() => readDice([0, 3])).toThrow(RangeError);
    expect(() => readDice([7, 3])).toThrow(RangeError);
    expect(() => readDice([2.5, 3])).toThrow(RangeError);
  });

  it('cada combinación posible da una jugada válida y cubre toda la escala', () => {
    const seen = new Set();
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const value = readDice([a, b]);
        expect(isValidCall(value)).toBe(true);
        seen.add(value);
      }
    }
    expect(seen.size).toBe(CALL_SCALE.length);
  });
});

describe('escala de jugadas', () => {
  it('31 es la más baja y Quispe la más alta', () => {
    expect(CALL_SCALE[0]).toBe(31);
    expect(CALL_SCALE.at(-1)).toBe(QUISPE);
  });

  it('cualquier par supera a 65 y Quispe supera a 160', () => {
    expect(compareCalls(110, 65)).toBeGreaterThan(0);
    expect(compareCalls(QUISPE, 160)).toBeGreaterThan(0);
    expect(compareCalls(42, 43)).toBeLessThan(0);
    expect(compareCalls(54, 54)).toBe(0);
  });

  it('rechaza números que no son jugadas', () => {
    expect(isValidCall(24)).toBe(false);
    expect(isValidCall(33)).toBe(false);
    expect(isValidCall(170)).toBe(false);
    expect(() => rankOf(24)).toThrow(RangeError);
  });
});

describe('rollDice', () => {
  it('usa el rng inyectado', () => {
    expect(rollDice(() => 0)).toEqual([1, 1]);
    expect(rollDice(() => 0.9999)).toEqual([6, 6]);
    const values = [0.5, 0.2];
    expect(rollDice(() => values.shift())).toEqual([4, 2]);
  });

  it('falla de inmediato si el rng devuelve algo fuera de [0, 1)', () => {
    expect(() => rollDice(() => 1)).toThrow(RangeError);
    expect(() => rollDice(() => -0.1)).toThrow(RangeError);
  });
});

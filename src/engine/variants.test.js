import { describe, expect, it } from 'vitest';
import { VARIANTS, resolveVariants } from './variants.js';

describe('resolveVariants', () => {
  it('completa con los valores por defecto', () => {
    expect(resolveVariants()).toEqual({
      quispeBonus: { enabled: true },
      revealOnCholada: { enabled: false },
      pressureClock: { enabled: false, seconds: 15 },
    });
  });

  it('cubre todas las variantes registradas', () => {
    expect(Object.keys(resolveVariants())).toEqual(VARIANTS.map((v) => v.id));
  });

  it('respeta lo configurado', () => {
    const v = resolveVariants({ quispeBonus: { enabled: false }, pressureClock: { enabled: true, seconds: 30 } });
    expect(v.quispeBonus.enabled).toBe(false);
    expect(v.pressureClock).toEqual({ enabled: true, seconds: 30 });
  });

  it('rechaza variantes desconocidas y valores fuera de rango', () => {
    expect(() => resolveVariants({ ases: { enabled: true } })).toThrow(RangeError);
    expect(() => resolveVariants({ pressureClock: { seconds: 2 } })).toThrow(RangeError);
    expect(() => resolveVariants({ pressureClock: { seconds: 61 } })).toThrow(RangeError);
    expect(() => resolveVariants({ quispeBonus: { enabled: 'sí' } })).toThrow(TypeError);
  });
});

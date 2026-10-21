// Registro de variantes del panel de reglas.
// El panel de configuración se genera leyendo VARIANTS; agregar una variante no toca la vista.
// Pendientes (Fase 3): comodín de espía y duelo final.
import { QUISPE } from './dice.js';
import { RESULTS } from './constants.js';

export const VARIANTS = Object.freeze([
  { id: 'quispeBonus', defaultEnabled: true },
  { id: 'revealOnCholada', defaultEnabled: false },
  { id: 'pressureClock', defaultEnabled: false, params: { seconds: { default: 15, min: 5, max: 60 } } },
]);

// Completa con valores por defecto y valida lo que llega de la configuración
export function resolveVariants(input = {}) {
  const known = new Set(VARIANTS.map((v) => v.id));
  for (const id of Object.keys(input)) {
    if (!known.has(id)) throw new RangeError(`Variante desconocida: ${id}`);
  }

  const resolved = {};
  for (const variant of VARIANTS) {
    const given = input[variant.id] ?? {};
    const entry = { enabled: given.enabled ?? variant.defaultEnabled };
    if (typeof entry.enabled !== 'boolean') throw new TypeError(`${variant.id}.enabled debe ser booleano`);
    for (const [name, spec] of Object.entries(variant.params ?? {})) {
      const value = given[name] ?? spec.default;
      if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
        throw new RangeError(`${variant.id}.${name} debe estar entre ${spec.min} y ${spec.max}`);
      }
      entry[name] = value;
    }
    resolved[variant.id] = entry;
  }
  return resolved;
}

// Cuántas letras o vidas cuesta perder la ronda
export function lossCost(variants, result) {
  // Quispe vale más: si desconfían de un Quispe, pierde 2 quien desconfió (era cierto) o 3 quien cantó (mentía)
  if (variants.quispeBonus.enabled && result.type === RESULTS.DOUBT && result.call === QUISPE) {
    return result.loserId === result.doubterId ? 2 : 3;
  }
  return 1;
}

export function revealsDice(variants, result) {
  return result.type === RESULTS.DOUBT || variants.revealOnCholada.enabled;
}

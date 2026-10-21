// Lectura y escala de jugadas del Quispe.

export const QUISPE = 21;

// De menor a mayor: la posición en la lista es la fuerza de la jugada
export const CALL_SCALE = Object.freeze([
  31, 32, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65,
  110, 120, 130, 140, 150, 160,
  QUISPE,
]);

export function isValidCall(value) {
  return CALL_SCALE.includes(value);
}

export function rankOf(value) {
  const rank = CALL_SCALE.indexOf(value);
  if (rank === -1) throw new RangeError(`Jugada inválida: ${value}`);
  return rank;
}

// Negativo si a es menor, 0 si son iguales, positivo si a es mayor
export function compareCalls(a, b) {
  return rankOf(a) - rankOf(b);
}

// El dado mayor va primero (4 y 2 es 42); los pares se leen 110..160; 2 y 1 es Quispe
export function readDice([a, b]) {
  for (const die of [a, b]) {
    if (!Number.isInteger(die) || die < 1 || die > 6) throw new RangeError(`Dado inválido: ${die}`);
  }
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (high === low) return 100 + high * 10;
  return high * 10 + low;
}

// rng devuelve un número en [0, 1), como Math.random; se inyecta para poder testear
export function rollDice(rng) {
  const die = () => Math.floor(rng() * 6) + 1;
  const dice = [die(), die()];
  readDice(dice); // falla aquí, y no al destapar, si el rng devuelve algo fuera de [0, 1)
  return dice;
}

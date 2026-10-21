// Modos de juego: Clásico QUISPE, Por vidas, Castigo personalizado.
// Cada modo define cómo arranca el marcador de un jugador, cómo le afecta perder y cuándo queda eliminado.

export const LETTERS = 'QUISPE';

export const DEFAULT_LIVES = 3;
export const MIN_LIVES = 1;
export const MAX_LIVES = 10;

const letterMode = {
  initPlayer: () => ({ letters: 0 }),
  applyLoss: (player, cost) => ({ ...player, letters: Math.min(player.letters + cost, LETTERS.length) }),
  isOut: (player) => player.letters >= LETTERS.length,
};

const livesMode = {
  initPlayer: (config) => ({ lives: config.lives }),
  applyLoss: (player, cost) => ({ ...player, lives: Math.max(player.lives - cost, 0) }),
  isOut: (player) => player.lives <= 0,
};

export const MODES = Object.freeze({
  classic: letterMode,
  lives: livesMode,
  // Igual al clásico; además cada ronda perdida muestra config.penaltyText
  penalty: letterMode,
});

export function getMode(id) {
  const mode = MODES[id];
  if (!mode) throw new RangeError(`Modo desconocido: ${id}`);
  return mode;
}

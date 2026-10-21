// Tokens de identidad visual para Phaser.
// Deben coincidir con las variables de src/ui/styles.css (skill identidad-visual).

export const FONTS = Object.freeze({
  display: 'Fraunces', // --font-display, peso 900
  ui: 'Fredoka', // --font-ui
  displayStack: 'Fraunces, Georgia, serif',
  uiStack: 'Fredoka, system-ui, sans-serif',
});

export const COLORS = Object.freeze({
  fondo: 0x120d0a,
  madera: 0x6b3f24,
  foco: 0xffc46e,
  acento: 0xf2a33a,
  texto: 0xf4ead7,
  borde: 0x000000,
  retabloRojo: 0xc23a2b,
  retabloAzul: 0x2f5d9e,
  retabloDorado: 0xf2c230,
  letraPendiente: 0x4a3a2f,
});

// Contorno de ilustraciones (3-4 px según el skill); los títulos grandes llevan uno más grueso, como el logo
export const OUTLINE_WIDTH = 4;
export const TITLE_STROKE_WIDTH = 8;

// Phaser pide colores de texto como '#rrggbb'
export const toCss = (color) => `#${color.toString(16).padStart(6, '0')}`;

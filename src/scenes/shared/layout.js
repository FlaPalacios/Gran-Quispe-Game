// Geometría de la pantalla de partida: única fuente de verdad de dónde va cada zona.
// La consumen la escena de Phaser (dibuja dentro de su rectángulo) y la capa HTML
// (a través de las variables CSS que publica src/app/stage.js). Función pura y testeable.
//
// Zonas:
//   frame   marco del juego; fuera de él no hay nada interactivo
//   topBar  ronda y modo, sonido y salir
//   scene   fondo de la cantina, mesa, cubilete y personaje
//   players tarjetas de jugador
//   play    panel de turno, botones y hoja para elegir la jugada

export const DESKTOP_MIN_WIDTH = 1024;
export const MAX_FRAME_WIDTH = 1440;
export const FRAME_RATIO = 16 / 10;

const MAX_PLAYERS_PER_ROW = 4;
const TOP_BAR_MIN = 48;
const TOP_BAR_MAX = 60;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rect = (x, y, width, height) => ({
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
});
const bottomOf = (r) => r.y + r.height;

/**
 * @param {number} width  ancho de la ventana
 * @param {number} height alto de la ventana
 * @param {{insets?: {top?: number, right?: number, bottom?: number, left?: number},
 *          playerCount?: number}} [options]
 */
export function getLayout(width, height, options = {}) {
  const insets = { top: 0, right: 0, bottom: 0, left: 0, ...options.insets };
  const playerCount = clamp(options.playerCount ?? MAX_PLAYERS_PER_ROW, 1, 8);
  const rows = Math.ceil(playerCount / MAX_PLAYERS_PER_ROW);
  const isDesktop = width >= DESKTOP_MIN_WIDTH && width >= height;

  return isDesktop ? desktopLayout(width, height, insets, rows) : mobileLayout(width, height, insets, rows);
}

// Celular: una columna. Escena arriba con las tarjetas superpuestas, zona de juego abajo.
function mobileLayout(width, height, insets, rows) {
  const frame = rect(
    insets.left,
    insets.top,
    width - insets.left - insets.right,
    height - insets.top - insets.bottom,
  );
  const gutter = Math.round(clamp(frame.width * 0.04, 12, 24));
  const inner = frame.width - gutter * 2;

  const topBar = rect(frame.x + gutter, frame.y + 8, inner, clamp(frame.height * 0.07, TOP_BAR_MIN, TOP_BAR_MAX));

  // Las tarjetas van superpuestas sobre la escena, justo debajo de la barra.
  // Estas alturas son las que la tarjeta necesita de verdad (ver .player en styles.css);
  // con dos filas se usa la versión compacta.
  // El alto incluye el borde de 3 px de la tarjeta, que cuenta dentro de la caja
  const rowHeight = rows > 1 ? clamp(frame.width * 0.21, 76, 88) : clamp(frame.width * 0.24, 84, 98);
  const players = rect(frame.x + gutter, bottomOf(topBar) + 6, inner, rows * rowHeight + (rows - 1) * 6);

  // Primero se reserva lo que necesita la zona de juego y la escena se queda con el resto
  const playHeight = clamp(frame.height * 0.33, 190, 300);
  const scene = rect(frame.x, frame.y, frame.width, frame.height - playHeight);
  scene.contentTop = bottomOf(players) + 8;

  // A todo el ancho: lleva su propio panel de madera, donde el fondo de la cantina ya no sigue
  const play = rect(frame.x, bottomOf(scene), frame.width, bottomOf(frame) - bottomOf(scene));

  return { isDesktop: false, frame, topBar, scene, players, play };
}

// PC: marco centrado de proporción 16:10. Escena a la izquierda, jugadores y zona de juego a la derecha.
function desktopLayout(width, height, insets, rows) {
  const availableWidth = width - insets.left - insets.right;
  const availableHeight = height - insets.top - insets.bottom;

  let frameWidth = Math.min(availableWidth, MAX_FRAME_WIDTH);
  const frameHeight = Math.min(availableHeight, frameWidth / FRAME_RATIO);
  frameWidth = Math.min(frameWidth, frameHeight * FRAME_RATIO);

  const frame = rect(
    insets.left + (availableWidth - frameWidth) / 2,
    insets.top + (availableHeight - frameHeight) / 2,
    frameWidth,
    frameHeight,
  );

  const pad = Math.round(clamp(frame.width * 0.022, 16, 32));
  const gap = pad;
  const inner = frame.width - pad * 2;

  const topBar = rect(frame.x + pad, frame.y + pad, inner, TOP_BAR_MAX);
  const contentY = bottomOf(topBar) + gap;
  const contentHeight = bottomOf(frame) - pad - contentY;

  const sceneWidth = Math.round((inner - gap) * 0.62);
  const scene = rect(frame.x + pad, contentY, sceneWidth, contentHeight);
  scene.contentTop = scene.y;

  const columnX = scene.x + scene.width + gap;
  const columnWidth = inner - sceneWidth - gap;

  const rowHeight = clamp(columnWidth * 0.26, 86, 104);
  const players = rect(columnX, contentY, columnWidth, rows * rowHeight + (rows - 1) * 8);
  const play = rect(columnX, bottomOf(players) + gap, columnWidth, contentY + contentHeight - bottomOf(players) - gap);

  return { isDesktop: true, frame, topBar, scene, players, play };
}

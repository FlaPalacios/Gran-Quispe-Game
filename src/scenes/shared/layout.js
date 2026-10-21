// Geometría de la pantalla de partida: única fuente de verdad de dónde va cada zona.
// La consumen la escena de Phaser (dibuja dentro de su rectángulo) y la capa HTML
// (a través de las variables CSS que publica src/app/stage.js). Función pura y testeable.
//
// Zonas:
//   frame   marco del juego; fuera de él no hay nada interactivo
//   topBar  ronda y modo, sonido y salir
//   scene   fondo de la cantina, mesa, cubilete y personaje
//   players tarjetas de jugador (lleva además columns y gap para la cuadrícula)
//   play    panel de turno, botones y hoja para elegir la jugada
// Incluye además viewport, el tamaño de la ventana, que la escena necesita para la zona muerta.

export const DESKTOP_MIN_WIDTH = 1024;
export const MAX_FRAME_WIDTH = 1440;
export const FRAME_RATIO = 16 / 10;

// Un teléfono en horizontal es ancho y bajo: le sienta mejor la distribución de dos columnas
const LANDSCAPE_RATIO = 1.4;

// Mínimos para que el contenido siga siendo legible. Si no caben, la zona de tarjetas
// se desplaza en vez de encogerse hasta cortar el texto.
const CARD_MIN_WIDTH = { mobile: 78, desktop: 96 };
const CARD_HEIGHT = { compact: 76, roomy: 98, desktop: 104 };
const ROW_GAP = 8;
// Lo que ocupan el panel de turno y un botón grande: si baja de aquí, el botón se va de la vista
const MIN_PLAY_HEIGHT = 172;
const MIN_SCENE_HEIGHT = 140;
// Lo que debe quedar libre bajo las tarjetas para que se vea la mesa
const MIN_TABLE_GAP = 90;

const clamp = (value, min, max) => Math.min(Math.max(max, min), Math.max(min, value));
const rect = (x, y, width, height) => ({
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
});
const bottomOf = (r) => r.y + r.height;

// Las columnas salen del ancho disponible, no de un número fijo: así ocho jugadores
// caben en una sola fila cuando la pantalla es ancha.
function playersGrid(availableWidth, playerCount, minCardWidth) {
  const columns = clamp(Math.floor(availableWidth / minCardWidth), 1, playerCount);
  return { columns, rows: Math.ceil(playerCount / columns) };
}

// Alto de la franja de tarjetas: el que necesitan, recortado a lo que haya sitio
function playersHeight(rows, rowHeight, available) {
  const wanted = rows * rowHeight + (rows - 1) * ROW_GAP;
  return Math.max(rowHeight, Math.min(wanted, available));
}

/**
 * @param {number} width  ancho de la ventana
 * @param {number} height alto de la ventana
 * @param {{insets?: {top?: number, right?: number, bottom?: number, left?: number},
 *          playerCount?: number}} [options]
 */
export function getLayout(width, height, options = {}) {
  const insets = { top: 0, right: 0, bottom: 0, left: 0, ...options.insets };
  const playerCount = clamp(options.playerCount ?? 4, 1, 8);
  const isDesktop =
    (width >= DESKTOP_MIN_WIDTH && width >= height) || width >= height * LANDSCAPE_RATIO;

  return isDesktop
    ? desktopLayout(width, height, insets, playerCount)
    : mobileLayout(width, height, insets, playerCount);
}

// Celular en vertical: una columna. Escena arriba con las tarjetas superpuestas,
// zona de juego abajo con su propio panel.
function mobileLayout(width, height, insets, playerCount) {
  const frame = rect(
    insets.left,
    insets.top,
    width - insets.left - insets.right,
    height - insets.top - insets.bottom,
  );
  const gutter = Math.round(clamp(frame.width * 0.04, 12, 24));
  const inner = frame.width - gutter * 2;

  const topBar = rect(frame.x + gutter, frame.y + 8, inner, clamp(frame.height * 0.07, 48, 60));

  // La zona de juego se reserva primero, pero sin dejar a la escena por debajo de su mínimo
  const playHeight = clamp(frame.height * 0.33, MIN_PLAY_HEIGHT, Math.max(frame.height - MIN_SCENE_HEIGHT, 0));
  const scene = rect(frame.x, frame.y, frame.width, frame.height - playHeight);

  const { columns, rows } = playersGrid(inner, playerCount, CARD_MIN_WIDTH.mobile);
  const rowHeight = rows > 1 ? CARD_HEIGHT.compact : Math.round(clamp(frame.width * 0.24, CARD_HEIGHT.compact, CARD_HEIGHT.roomy));
  const playersTop = bottomOf(topBar) + 6;
  const players = rect(
    frame.x + gutter,
    playersTop,
    inner,
    // Nunca pasan del borde bajo de la escena: debajo va el panel de juego, que las taparía
    playersHeight(rows, rowHeight, bottomOf(scene) - playersTop - MIN_TABLE_GAP),
  );
  players.columns = columns;
  players.gap = ROW_GAP;
  players.rowHeight = Math.round(rowHeight);

  scene.contentTop = Math.min(bottomOf(players) + 8, bottomOf(scene));

  // A todo el ancho: lleva su propio panel de madera, donde el fondo de la cantina ya no sigue
  const play = rect(frame.x, bottomOf(scene), frame.width, bottomOf(frame) - bottomOf(scene));

  return { isDesktop: false, viewport: { width, height }, frame, topBar, scene, players, play };
}

// PC y teléfono en horizontal: marco centrado de proporción 16:10.
// Escena a la izquierda, tarjetas y zona de juego a la derecha.
function desktopLayout(width, height, insets, playerCount) {
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

  const topBar = rect(frame.x + pad, frame.y + pad, inner, clamp(frame.height * 0.09, 44, 60));
  const contentY = bottomOf(topBar) + gap;
  const contentHeight = Math.max(bottomOf(frame) - pad - contentY, MIN_SCENE_HEIGHT);

  // En marcos bajos (teléfono en horizontal) la columna derecha necesita algo más de ancho
  const sceneWidth = Math.round((inner - gap) * (frame.height < 480 ? 0.55 : 0.62));
  const scene = rect(frame.x + pad, contentY, sceneWidth, contentHeight);
  scene.contentTop = scene.y;

  const columnX = scene.x + scene.width + gap;
  const columnWidth = inner - sceneWidth - gap;

  const { columns, rows } = playersGrid(columnWidth, playerCount, CARD_MIN_WIDTH.desktop);
  const rowHeight = Math.round(clamp(columnWidth * 0.26, CARD_HEIGHT.compact, CARD_HEIGHT.desktop));
  const players = rect(
    columnX,
    contentY,
    columnWidth,
    // Se reserva antes el mínimo de la zona de juego, para que no colapse
    playersHeight(rows, rowHeight, contentHeight - MIN_PLAY_HEIGHT - gap),
  );
  players.columns = columns;
  players.gap = ROW_GAP;
  players.rowHeight = Math.round(rowHeight);

  const play = rect(columnX, bottomOf(players) + gap, columnWidth, contentY + contentHeight - bottomOf(players) - gap);

  return { isDesktop: true, viewport: { width, height }, frame, topBar, scene, players, play };
}

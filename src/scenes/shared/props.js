// Dibujo vectorial de los elementos comunes a las tres escenas: fondo, mesa, cubilete y dados.
// Estilo plano con contorno negro grueso y sin degradados (skill identidad-visual).
import { COLORS, OUTLINE_WIDTH } from './theme.js';

export function drawSunburst(g, width, height) {
  g.fillStyle(COLORS.acento).fillRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height * 0.4;
  const radius = Math.hypot(width, height);
  const rays = 24;
  g.fillStyle(COLORS.foco, 0.35);
  for (let i = 0; i < rays; i += 2) {
    const a1 = (i / rays) * Math.PI * 2;
    const a2 = ((i + 1) / rays) * Math.PI * 2;
    g.fillTriangle(cx, cy, cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius);
  }
}

// Sombra difusa: varias elipses concéntricas, porque Graphics no tiene desenfoque.
// Sirve para asentar la mesa y los personajes en el piso en vez de dejarlos flotando.
export function drawSoftShadow(g, x, y, width, height, { alpha = 0.45, steps = 7 } = {}) {
  for (let i = steps; i >= 1; i--) {
    const spread = 0.6 + (i / steps) * 0.65;
    g.fillStyle(COLORS.borde, alpha / steps);
    g.fillEllipse(x, y, width * spread, height * spread);
  }
}

// Escala una imagen para cubrir un rectángulo sin deformarla (como `background-size: cover`).
// `anchorY: 1` la ancla abajo: útil cuando el piso del cuadro debe caer donde se apoya la mesa.
export function coverImage(image, area, { anchorX = 0.5, anchorY = 0.5 } = {}) {
  const scale = Math.max(area.width / image.width, area.height / image.height);
  return image
    .setOrigin(anchorX, anchorY)
    .setScale(scale)
    .setPosition(area.x + area.width * anchorX, area.y + area.height * anchorY);
}

// Medidas de la mesa redonda apoyada en la parte baja de un área, centrada en ella.
// Cálculo puro y aparte del dibujo para que la escena coloque personaje, cubilete y dados
// en proporción a la mesa sin repetir estos números.
function roundTableGeometry(area) {
  const width = area.width * 0.9;
  const height = Math.min(area.height * 0.42, width * 0.46);
  const x = area.x + area.width / 2;
  const y = area.y + area.height - height * 0.52;
  return {
    x,
    y,
    width,
    height,
    // Borde lejano del canto: por encima de esta línea asoma quien está sentado detrás
    top: y - height / 2,
    felt: { x, y, width: width * 0.84, height: height * 0.72 },
  };
}

// Mesa redonda y todo lo que se apoya en ella, medido solo con el área que recibe.
// Al salir todo del paño, el cubilete y los dados no pueden quedar fuera de la mesa
// en ninguna pantalla (lo comprueba props.test.js).
export function tableProps(area) {
  const table = roundTableGeometry(area);
  const { felt } = table;

  // Tapado al centro del paño; destapado se corre a un lado, siempre sobre el paño
  const rest = { x: felt.x, y: felt.y + felt.height * 0.14 };
  const aside = { x: felt.x + felt.width * 0.27, y: felt.y + felt.height * 0.05 };

  // El último tope del alto es el canto lejano de la mesa: así el cubilete no asoma por
  // detrás ni se le cruza por delante a quien está sentado al otro lado
  const height = Math.min(felt.height * 0.95, felt.width * 0.26, (rest.y - table.top) * 0.95);
  const width = height * 0.85;

  // Destapado a medias para mirar los dados sin que los demás los vean: el cubilete gira
  // sobre la esquina izquierda de su base y se levanta por la derecha (como en la vida real)
  const tilt = (PEEK_ANGLE * Math.PI) / 180;
  const half = width / 2;
  const peek = { x: rest.x - half + half * Math.cos(tilt), y: rest.y + half * Math.sin(tilt), angle: PEEK_ANGLE };
  const diceSize = height * 0.42;
  const peekSize = height * 0.32;

  return {
    ...table,
    cup: { width, height, rest, aside, peek },
    // Los dados caen al lado opuesto, donde el cubilete ya no los tapa
    dice: { size: diceSize, gap: diceSize * 0.75, x: felt.x - felt.width * 0.16, y: felt.y + felt.height * 0.18 },
    // Al destapar a medias se asoman por la abertura, delante del cubilete
    peekDice: { size: peekSize, gap: peekSize * 0.6, x: rest.x + width * 0.14, y: rest.y - peekSize * 0.4 },
  };
}

// Grados que se inclina el cubilete al mirar los dados
const PEEK_ANGLE = -26;

// Mesa redonda de madera con paño azul, apoyada en la parte baja del área de juego.
// Se usa cuando hay fondo ilustrado: el escenario ya pone el ambiente y la mesa solo necesita ser mesa.
// Devuelve las medidas de tableProps: el paño, el canto lejano y dónde van cubilete y dados.
export function drawRoundTable(g, area) {
  const table = tableProps(area);
  const { x: cx, y: cy, width, height, felt } = table;

  // Sombra en el piso, corrida hacia abajo: es lo que impide que la mesa parezca flotar
  drawSoftShadow(g, cx, cy + height * 0.3, width * 0.95, height * 0.55);

  // Canto de madera
  g.fillStyle(COLORS.madera).fillEllipse(cx, cy, width, height);
  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeEllipse(cx, cy, width, height);

  // Paño
  g.fillStyle(COLORS.retabloAzul).fillEllipse(felt.x, felt.y, felt.width, felt.height);
  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeEllipse(felt.x, felt.y, felt.width, felt.height);

  // Hilo dorado del borde del paño; crece con la mesa para no desaparecer en pantallas grandes
  const thread = Math.max(2, Math.round(felt.width / 220));
  g.lineStyle(thread, COLORS.retabloDorado, 0.7).strokeEllipse(felt.x, felt.y, felt.width * 0.9, felt.height * 0.86);
  return table;
}

// Marco de madera tipo retablo con remaches dorados y paño azul. Devuelve el centro del paño.
export function drawTable(g, table) {
  const radius = Math.min(28, table.width * 0.06);
  g.fillStyle(COLORS.madera).fillRoundedRect(table.x, table.y, table.width, table.height, radius);
  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeRoundedRect(table.x, table.y, table.width, table.height, radius);

  // Remaches dorados a lo largo del marco
  const inset = Math.max(10, table.width * 0.025);
  const step = Math.max(22, table.width / 18);
  g.fillStyle(COLORS.retabloDorado);
  for (let x = table.x + inset * 2; x <= table.x + table.width - inset * 2; x += step) {
    g.fillCircle(x, table.y + inset, 3);
    g.fillCircle(x, table.y + table.height - inset, 3);
  }

  const felt = {
    x: table.x + table.width / 2,
    y: table.y + table.height * 0.58,
    width: table.width * 0.78,
    height: table.height * 0.5,
  };
  g.fillStyle(COLORS.retabloAzul).fillEllipse(felt.x, felt.y, felt.width, felt.height);
  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeEllipse(felt.x, felt.y, felt.width, felt.height);
  return felt;
}

// Cubilete boca abajo, con el origen en el centro de su base
export function drawCup(g, width, height) {
  const top = width * 0.36;
  const bottom = width / 2;
  const body = [
    { x: -top, y: -height },
    { x: top, y: -height },
    { x: bottom, y: 0 },
    { x: -bottom, y: 0 },
  ];
  g.fillStyle(COLORS.madera).fillPoints(body, true);

  // Franja roja arriba y dorada abajo, recortadas al contorno del cubilete
  const band = (y1, y2, color) => {
    const at = (y) => top + (bottom - top) * ((y + height) / height);
    g.fillStyle(color).fillPoints(
      [
        { x: -at(y1), y: y1 },
        { x: at(y1), y: y1 },
        { x: at(y2), y: y2 },
        { x: -at(y2), y: y2 },
      ],
      true,
    );
  };
  band(-height * 0.86, -height * 0.76, COLORS.retabloRojo);
  band(-height * 0.2, -height * 0.08, COLORS.retabloDorado);

  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokePoints(body, true);
}

const PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

// Dado centrado en el origen
export function drawDie(g, size, value) {
  const half = size / 2;
  g.fillStyle(COLORS.texto).fillRoundedRect(-half, -half, size, size, size * 0.18);
  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeRoundedRect(-half, -half, size, size, size * 0.18);
  // El as se pinta en rojo y más grande, como en los dados tradicionales
  g.fillStyle(value === 1 ? COLORS.retabloRojo : COLORS.borde);
  for (const [px, py] of PIPS[value]) {
    g.fillCircle(px * size * 0.26, py * size * 0.26, size * (value === 1 ? 0.12 : 0.08));
  }
}

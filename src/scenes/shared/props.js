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

// Mesa redonda de madera con paño azul, apoyada en la parte baja del área de juego.
// Se usa cuando hay fondo ilustrado: el escenario ya pone el ambiente y la mesa solo necesita ser mesa.
// Devuelve el centro y tamaño del paño, donde van el cubilete y los dados.
export function drawRoundTable(g, area) {
  const width = area.width * 0.9;
  const height = Math.min(area.height * 0.42, width * 0.46);
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height - height * 0.52;

  // Canto de madera
  g.fillStyle(COLORS.madera).fillEllipse(cx, cy, width, height);
  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeEllipse(cx, cy, width, height);

  // Paño
  const felt = { x: cx, y: cy, width: width * 0.84, height: height * 0.72 };
  g.fillStyle(COLORS.retabloAzul).fillEllipse(felt.x, felt.y, felt.width, felt.height);
  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeEllipse(felt.x, felt.y, felt.width, felt.height);

  // Hilo dorado del borde del paño; crece con la mesa para no desaparecer en pantallas grandes
  const thread = Math.max(2, Math.round(felt.width / 220));
  g.lineStyle(thread, COLORS.retabloDorado, 0.7).strokeEllipse(felt.x, felt.y, felt.width * 0.9, felt.height * 0.86);
  return felt;
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

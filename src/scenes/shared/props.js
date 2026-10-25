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

// Medidas del recorte de los objetos ilustrados; las imprime recursos-fv/scripts/recortar-objetos.py
// al recortarlos. La mesa guarda su proporción para no deformarse, y el paño sale de dónde
// cae de verdad el fieltro verde dentro del dibujo.
const TABLE_RATIO = 1654 / 932;
const FELT = { x: 0.5067, y: 0.5188, width: 0.7975, height: 0.4957 };
// El lienzo del cubilete es más ancho y un poco más alto que el cubilete en sí: guarda sitio
// para las poses inclinadas. Su borde de abajo al centro es el punto donde se apoya en la mesa.
const CUP_CANVAS = { ratio: 804 / 545, bodyWidth: 381 / 804, bodyHeight: 531 / 545 };
const DIE_RATIO = 361 / 404;

// Medidas de la mesa redonda apoyada en la parte baja de un área, centrada en ella.
// Cálculo puro y aparte del dibujo para que la escena coloque personaje, cubilete y dados
// en proporción a la mesa sin repetir estos números.
function roundTableGeometry(area) {
  const height = Math.min(area.height * 0.42, (area.width * 0.9) / TABLE_RATIO);
  const width = height * TABLE_RATIO;
  const x = area.x + area.width / 2;
  const y = area.y + area.height - height * 0.52;
  return {
    x,
    y,
    width,
    height,
    // Borde lejano del canto: por encima de esta línea asoma quien está sentado detrás
    top: y - height / 2,
    felt: {
      x: x + (FELT.x - 0.5) * width,
      y: y + (FELT.y - 0.5) * height,
      width: width * FELT.width,
      height: height * FELT.height,
    },
  };
}

// Mesa redonda y todo lo que se apoya en ella, medido solo con el área que recibe.
// Al salir todo del paño, el cubilete y los dados no pueden quedar fuera de la mesa
// en ninguna pantalla (lo comprueba props.test.js).
export function tableProps(area) {
  const table = roundTableGeometry(area);
  const { felt } = table;

  // Tapado al centro del paño; volcado se corre a un lado, siempre sobre el paño
  const rest = { x: felt.x, y: felt.y + felt.height * 0.14 };
  // Volcado ocupa mucho más ancho que de pie: va bien a la derecha para no tapar los dados
  const aside = { x: felt.x + felt.width * 0.3, y: felt.y + felt.height * 0.06 };

  // El último tope del alto es el canto lejano de la mesa: así el cubilete no asoma por
  // detrás ni se le cruza por delante a quien está sentado al otro lado
  const body = Math.min(felt.height * 0.95, felt.width * 0.26, (rest.y - table.top) * 0.95);
  const height = body / CUP_CANVAS.bodyHeight;
  const width = height * CUP_CANVAS.ratio;

  // Grandes a propósito: en celular, con dados chicos no se leen los puntos. El paño es
  // bastante achatado, así que el tope de cuánto pueden crecer es el alto, no el ancho.
  const diceSize = body * 0.68;
  const peekSize = body * 0.42;

  return {
    ...table,
    cup: {
      // Lienzo de la imagen, con el origen abajo al centro (donde se apoya)
      width,
      height,
      // El cubilete en sí, para el respaldo vectorial y para medir que quepa en el paño
      body: { width: width * CUP_CANVAS.bodyWidth, height: body },
      rest,
      aside,
    },
    // Los dados caen al lado opuesto, donde el cubilete ya no los tapa
    dice: diceSpot(diceSize, felt.x - felt.width * 0.12, felt.y + felt.height * 0.08),
    // Al destapar a medias se asoman por la abertura, delante del cubilete
    peekDice: diceSpot(peekSize, rest.x + width * 0.06, rest.y - body * 0.22),
  };
}

// Dónde y de qué tamaño va cada dado. El dibujo es más alto que ancho, así que el alto sale
// de la proporción del recorte y no del ancho.
function diceSpot(size, x, y) {
  // Quedan juntos, casi tocándose: así caben grandes sin salirse del paño
  return { size, height: size / DIE_RATIO, gap: size * 0.58, x, y };
}


// Sombra en el piso bajo la mesa: es lo que impide que parezca flotar sobre el fondo.
// La usan tanto la mesa ilustrada como la vectorial, para que no queden dos sombras distintas.
export function drawTableShadow(g, table) {
  drawSoftShadow(g, table.x, table.y + table.height * 0.3, table.width * 0.95, table.height * 0.55);
}

// Mesa redonda de madera con paño verde, apoyada en la parte baja del área de juego.
// Se usa cuando hay fondo ilustrado: el escenario ya pone el ambiente y la mesa solo necesita ser mesa.
// Devuelve las medidas de tableProps: el paño, el canto lejano y dónde van cubilete y dados.
export function drawRoundTable(g, area) {
  const table = tableProps(area);
  const { x: cx, y: cy, width, height, felt } = table;

  drawTableShadow(g, table);

  // Canto de madera
  g.fillStyle(COLORS.madera).fillEllipse(cx, cy, width, height);
  g.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeEllipse(cx, cy, width, height);

  // Paño, del mismo verde que el de la mesa ilustrada
  g.fillStyle(COLORS.pano).fillEllipse(felt.x, felt.y, felt.width, felt.height);
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

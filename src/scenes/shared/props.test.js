// Comprueba las medidas de la mesa sin dibujar nada: que la mesa quepa en la zona de la
// escena y que el cubilete y los dados queden siempre sobre el paño, en todas las pantallas.
import { describe, expect, it } from 'vitest';
import { getLayout } from './layout.js';
import { coverImage, tableProps } from './props.js';

const SIZES = [
  [360, 640],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1366, 768],
  [1920, 1080],
  [2560, 1080],
];
const PLAYER_COUNTS = [2, 8];

// 1 es justo el borde de la elipse: por debajo, el punto está sobre el paño
const insideFelt = ({ x, y, width, height }, px, py) =>
  ((px - x) / (width / 2)) ** 2 + ((py - y) / (height / 2)) ** 2;

// Las cuatro esquinas de los dos dados de una tirada
const corners = ({ size, height, gap, x, y }) =>
  [-1, 1].flatMap((side) =>
    [-size / 2, size / 2].flatMap((dx) =>
      [-height / 2, height / 2].map((dy) => [x + side * gap + dx, y + dy]),
    ),
  );

describe('tableProps', () => {
  for (const [width, height] of SIZES) {
    for (const playerCount of PLAYER_COUNTS) {
      describe(`${width}x${height} con ${playerCount} jugadores`, () => {
        const area = getLayout(width, height, { playerCount }).scene;
        const table = tableProps(area);
        const { felt, cup, dice } = table;

        it('la mesa se apoya abajo y su paño cabe entero en la zona de la escena', () => {
          expect(table.x).toBeCloseTo(area.x + area.width / 2, 5);
          // El canto de madera puede cortarse por los costados; el paño, no
          expect(felt.x - felt.width / 2).toBeGreaterThanOrEqual(area.x);
          expect(felt.x + felt.width / 2).toBeLessThanOrEqual(area.x + area.width);
          expect(table.y + table.height / 2).toBeLessThanOrEqual(area.y + area.height);
          expect(table.top).toBeGreaterThanOrEqual(area.y);
        });

        it('el cubilete se apoya en el paño, tapado y volcado', () => {
          const half = cup.body.width / 2;
          expect(cup.body.height).toBeGreaterThan(0);
          for (const place of [cup.rest, cup.aside]) {
            expect(insideFelt(felt, place.x - half, place.y)).toBeLessThan(1);
            expect(insideFelt(felt, place.x + half, place.y)).toBeLessThan(1);
          }
        });

        it('el lienzo del cubilete es más ancho que el cubilete, para las poses inclinadas', () => {
          expect(cup.width).toBeGreaterThan(cup.body.width);
          expect(cup.height).toBeGreaterThanOrEqual(cup.body.height);
        });

        it('el cubilete no pasa el canto lejano de la mesa', () => {
          expect(cup.rest.y - cup.body.height).toBeGreaterThan(table.top);
        });

        it('los dados caen enteros sobre el paño, al lado opuesto del cubilete', () => {
          corners(dice).forEach((point) => expect(insideFelt(felt, ...point)).toBeLessThan(1));
          expect(dice.x).toBeLessThan(cup.aside.x);
        });

        it('los dados se ven bien grandes', () => {
          // Dos dados y su hueco ocupan buena parte del ancho del paño
          expect((dice.size * 2 + dice.gap * 2) / felt.width).toBeGreaterThan(0.3);
          expect(dice.size).toBeGreaterThan(cup.body.width * 0.45);
        });

        it('al destapar a medias, los dados asoman delante del cubilete y sobre el paño', () => {
          const { peekDice } = table;
          corners(peekDice).forEach((point) => expect(insideFelt(felt, ...point)).toBeLessThan(1));
          // Asoman junto al cubilete, no al otro lado de la mesa
          expect(Math.abs(peekDice.x - cup.rest.x)).toBeLessThan(cup.body.width);
          expect(peekDice.size).toBeLessThan(dice.size);
        });
      });
    }
  }
});

// Imagen de mentira: solo necesita medidas y los métodos encadenables que usa coverImage
const fakeImage = (width, height) => ({
  width,
  height,
  setOrigin(x, y) {
    this.origin = { x, y };
    return this;
  },
  setScale(scale) {
    this.scale = scale;
    return this;
  },
  setPosition(x, y) {
    this.position = { x, y };
    return this;
  },
});

describe('coverImage', () => {
  const area = { x: 100, y: 50, width: 400, height: 300 };

  it('cubre el área completa sin deformar la imagen', () => {
    const image = coverImage(fakeImage(800, 1200), area);
    expect(image.scale).toBeCloseTo(0.5); // manda el ancho: 400/800 ya cubre el alto
    expect(image.width * image.scale).toBeGreaterThanOrEqual(area.width);
    expect(image.height * image.scale).toBeGreaterThanOrEqual(area.height);
    expect(image.position).toEqual({ x: 300, y: 200 });
  });

  it('anclada abajo, el borde inferior de la imagen cae al pie del área', () => {
    const image = coverImage(fakeImage(1600, 900), area, { anchorY: 1 });
    expect(image.origin).toEqual({ x: 0.5, y: 1 });
    expect(image.position).toEqual({ x: 300, y: 350 });
    expect(image.height * image.scale).toBeGreaterThanOrEqual(area.height);
  });
});

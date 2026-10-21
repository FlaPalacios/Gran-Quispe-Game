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

describe('tableProps', () => {
  for (const [width, height] of SIZES) {
    for (const playerCount of PLAYER_COUNTS) {
      describe(`${width}x${height} con ${playerCount} jugadores`, () => {
        const area = getLayout(width, height, { playerCount }).scene;
        const table = tableProps(area);
        const { felt, cup, dice } = table;

        it('la mesa se apoya abajo y cabe en la zona de la escena', () => {
          expect(table.x).toBeCloseTo(area.x + area.width / 2, 5);
          expect(table.x - table.width / 2).toBeGreaterThanOrEqual(area.x);
          expect(table.x + table.width / 2).toBeLessThanOrEqual(area.x + area.width);
          expect(table.y + table.height / 2).toBeLessThanOrEqual(area.y + area.height);
          expect(table.top).toBeGreaterThanOrEqual(area.y);
        });

        it('el cubilete se apoya en el paño, tapado y destapado', () => {
          const half = cup.width / 2;
          expect(cup.height).toBeGreaterThan(0);
          for (const place of [cup.rest, cup.aside]) {
            expect(insideFelt(felt, place.x - half, place.y)).toBeLessThan(1);
            expect(insideFelt(felt, place.x + half, place.y)).toBeLessThan(1);
          }
        });

        it('el cubilete no pasa el canto lejano de la mesa', () => {
          expect(cup.rest.y - cup.height).toBeGreaterThan(table.top);
        });

        it('los dados caen sobre el paño, al lado opuesto del cubilete', () => {
          const gap = dice.size * 0.75;
          const half = dice.size / 2;
          for (const sign of [-1, 1]) {
            for (const corner of [-half, half]) {
              expect(insideFelt(felt, dice.x + sign * gap + corner, dice.y + half)).toBeLessThan(1);
              expect(insideFelt(felt, dice.x + sign * gap + corner, dice.y - half)).toBeLessThan(1);
            }
          }
          expect(dice.x).toBeLessThan(cup.aside.x);
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

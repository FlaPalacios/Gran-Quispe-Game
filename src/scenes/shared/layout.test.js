import { describe, expect, it } from 'vitest';
import { DESKTOP_MIN_WIDTH, FRAME_RATIO, MAX_FRAME_WIDTH, getLayout } from './layout.js';

const SIZES = [
  [360, 640],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1366, 768],
  [1536, 864],
  [1920, 1080],
  [2560, 1080],
];
const PLAYER_COUNTS = [2, 4, 8];

const bottom = (r) => r.y + r.height;
const right = (r) => r.x + r.width;
const contains = (outer, inner) =>
  inner.x >= outer.x - 1 &&
  inner.y >= outer.y - 1 &&
  right(inner) <= right(outer) + 1 &&
  bottom(inner) <= bottom(outer) + 1;

describe('getLayout', () => {
  for (const [width, height] of SIZES) {
    for (const playerCount of PLAYER_COUNTS) {
      describe(`${width}x${height} con ${playerCount} jugadores`, () => {
        const layout = getLayout(width, height, { playerCount });
        const { frame, topBar, scene, players, play } = layout;

        it('todas las zonas tienen tamaño y caben en el marco', () => {
          for (const [name, zone] of Object.entries({ topBar, scene, players, play })) {
            expect(zone.width, name).toBeGreaterThan(0);
            expect(zone.height, name).toBeGreaterThan(0);
            expect(contains(frame, zone), `${name} fuera del marco`).toBe(true);
          }
        });

        it('el marco cabe en la ventana', () => {
          expect(contains({ x: 0, y: 0, width, height }, frame)).toBe(true);
        });

        it('la barra superior va arriba del todo y nada la tapa', () => {
          expect(topBar.y).toBeGreaterThanOrEqual(frame.y);
          expect(players.y).toBeGreaterThanOrEqual(bottom(topBar));
          expect(play.y).toBeGreaterThanOrEqual(bottom(topBar));
        });

        it('la zona de juego no se superpone con las tarjetas ni con la barra', () => {
          expect(play.y).toBeGreaterThanOrEqual(bottom(players));
        });

        it('el personaje tiene alto útil dentro de la escena', () => {
          expect(scene.contentTop).toBeGreaterThanOrEqual(scene.y);
          expect(bottom(scene) - scene.contentTop).toBeGreaterThan(80);
        });
      });
    }
  }

  describe('celular', () => {
    const layout = getLayout(390, 844, { playerCount: 8 });

    it('la escena ocupa el ancho completo y la zona de juego va debajo', () => {
      expect(layout.isDesktop).toBe(false);
      expect(layout.scene.width).toBe(layout.frame.width);
      expect(layout.play.y).toBeGreaterThanOrEqual(bottom(layout.scene));
    });

    it('las tarjetas se superponen a la escena, debajo de la barra', () => {
      expect(layout.players.y).toBeLessThan(bottom(layout.scene));
      expect(layout.scene.contentTop).toBeGreaterThan(bottom(layout.players) - 1);
    });

    it('con más de 4 jugadores la franja de tarjetas crece a dos filas', () => {
      const four = getLayout(390, 844, { playerCount: 4 });
      expect(layout.players.height).toBeGreaterThan(four.players.height * 1.5);
    });
  });

  describe('PC', () => {
    const layout = getLayout(1920, 1080, { playerCount: 4 });

    it('el marco va centrado, con ancho máximo y proporción 16:10', () => {
      expect(layout.isDesktop).toBe(true);
      expect(layout.frame.width).toBeLessThanOrEqual(MAX_FRAME_WIDTH);
      expect(layout.frame.width / layout.frame.height).toBeCloseTo(FRAME_RATIO, 1);
      expect(layout.frame.x).toBeCloseTo(1920 - right(layout.frame), 0);
    });

    it('la escena va a la izquierda y la columna de jugadores a la derecha', () => {
      expect(right(layout.scene)).toBeLessThanOrEqual(layout.players.x);
      expect(layout.players.x).toBe(layout.play.x);
      expect(layout.players.width).toBe(layout.play.width);
    });

    it('en una pantalla muy ancha y baja el marco se limita por el alto', () => {
      const wide = getLayout(2560, 1080, { playerCount: 4 });
      expect(wide.frame.width).toBeLessThanOrEqual(MAX_FRAME_WIDTH);
      expect(wide.frame.x).toBeGreaterThan(100);
    });
  });

  describe('zonas seguras del teléfono', () => {
    it('el marco respeta la muesca y la barra inferior', () => {
      const insets = { top: 47, bottom: 34, left: 0, right: 0 };
      const layout = getLayout(390, 844, { insets, playerCount: 4 });
      expect(layout.frame.y).toBe(47);
      expect(bottom(layout.frame)).toBe(844 - 34);
      expect(layout.topBar.y).toBeGreaterThanOrEqual(47);
      expect(bottom(layout.play)).toBeLessThanOrEqual(844 - 34);
    });
  });

  describe('el breakpoint', () => {
    it('una ventana cuadrada de 1024 ya cuenta como PC', () => {
      expect(getLayout(DESKTOP_MIN_WIDTH, DESKTOP_MIN_WIDTH).isDesktop).toBe(true);
      expect(getLayout(DESKTOP_MIN_WIDTH - 1, 800).isDesktop).toBe(false);
      expect(getLayout(1200, 1300).isDesktop).toBe(false); // vertical, aunque sea ancha
    });
  });
});

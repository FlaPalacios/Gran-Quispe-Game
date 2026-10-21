// Calcula las zonas de la pantalla y las reparte a las dos capas:
//  - las publica como variables CSS, que es lo que usa el HUD en HTML;
//  - avisa a quien se suscriba (la escena de Phaser).
// Así la geometría vive en un solo sitio (scenes/shared/layout.js) y no hay dos copias
// de las medidas que mantener sincronizadas.
import { getLayout } from '../scenes/shared/layout.js';
import { getSafeAreaInsets } from './safeArea.js';

const ZONES = ['frame', 'topBar', 'scene', 'players', 'play'];
// topBar → --zona-top-bar-x
const cssName = (zone) => zone.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function createStage(store, { root = document.documentElement } = {}) {
  const listeners = new Set();
  let layout = null;

  function compute() {
    const { game } = store.get();
    return getLayout(window.innerWidth, window.innerHeight, {
      insets: getSafeAreaInsets(),
      playerCount: game?.players.length,
    });
  }

  function publish(next) {
    for (const zone of ZONES) {
      const { x, y, width, height } = next[zone];
      root.style.setProperty(`--zona-${cssName(zone)}-x`, `${x}px`);
      root.style.setProperty(`--zona-${cssName(zone)}-y`, `${y}px`);
      root.style.setProperty(`--zona-${cssName(zone)}-w`, `${width}px`);
      root.style.setProperty(`--zona-${cssName(zone)}-h`, `${height}px`);
    }
    root.dataset.modo = next.isDesktop ? 'pc' : 'celular';
  }

  function refresh() {
    const next = compute();
    // Solo se avisa si algo cambió de verdad: el resize se dispara muy seguido
    if (layout && JSON.stringify(next) === JSON.stringify(layout)) return;
    layout = next;
    publish(layout);
    listeners.forEach((fn) => fn(layout));
  }

  // El número de jugadores cambia el alto de la franja de tarjetas
  store.subscribe(refresh);
  window.addEventListener('resize', refresh);
  window.visualViewport?.addEventListener('resize', refresh);
  refresh();

  return {
    get: () => layout,
    subscribe(fn) {
      listeners.add(fn);
      fn(layout);
      return () => listeners.delete(fn);
    },
  };
}

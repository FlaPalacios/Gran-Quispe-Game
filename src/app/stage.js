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
  // Las zonas seguras solo cambian al girar el teléfono, y medirlas obliga al navegador
  // a recalcular estilos: se guardan y se refrescan solo cuando hace falta
  let insets = getSafeAreaInsets();

  function compute() {
    const { game } = store.get();
    return getLayout(window.innerWidth, window.innerHeight, {
      insets,
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
    // La cuadrícula de tarjetas también sale de aquí, para no repetir el número de columnas en el CSS
    root.style.setProperty('--zona-players-columnas', String(next.players.columns));
    root.style.setProperty('--zona-players-gap', `${next.players.gap}px`);
    root.style.setProperty('--zona-players-fila', `${next.players.rowHeight}px`);
    root.dataset.modo = next.isDesktop ? 'pc' : 'celular';
    // La versión grande de la tarjeta solo cabe si la fila reservada da de sí
    root.dataset.tarjetas = next.players.rowHeight >= 92 ? 'amplia' : 'compacta';
    // Y si el panel de turno cabe con el texto grande
    root.dataset.juego = next.play.height >= 220 ? 'amplia' : 'compacta';
  }

  function refresh() {
    const next = compute();
    // Solo se avisa si algo cambió de verdad: el resize se dispara muy seguido
    if (layout && JSON.stringify(next) === JSON.stringify(layout)) return;
    layout = next;
    publish(layout);
    listeners.forEach((fn) => fn(layout));
  }

  function remeasure() {
    insets = getSafeAreaInsets();
    refresh();
  }

  // El número de jugadores cambia el alto de la franja de tarjetas
  const unsubscribeStore = store.subscribe(refresh);
  window.addEventListener('resize', remeasure);
  window.addEventListener('orientationchange', remeasure);
  refresh();

  return {
    get: () => layout,
    subscribe(fn) {
      listeners.add(fn);
      fn(layout);
      return () => listeners.delete(fn);
    },
    destroy() {
      unsubscribeStore();
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('orientationchange', remeasure);
      listeners.clear();
    },
  };
}

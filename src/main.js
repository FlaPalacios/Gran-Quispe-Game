import Phaser from 'phaser';
import { createGameStore } from './app/gameStore.js';
import { CantinaScene } from './scenes/CantinaScene.js';
import { BarScene } from './scenes/BarScene.js';
import { AndinoScene } from './scenes/AndinoScene.js';
import { COLORS, FONTS, toCss } from './scenes/shared/theme.js';
import { mountApp } from './ui/app.js';

const store = createGameStore();
mountApp(document.getElementById('ui'), store);

// El canvas ocupa toda la ventana; cada escena reacomoda su contenido
// según el ancho (celular angosto, PC más ancho) con scenes/shared/layout.js
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: toCss(COLORS.fondo),
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [CantinaScene, BarScene, AndinoScene],
  callbacks: {
    // Las escenas leen el estado del juego desde el registro
    preBoot: (game) => game.registry.set('store', store),
  },
};

// Phaser dibuja el texto una sola vez: se espera a las fuentes para no quedarse con la de respaldo
Promise.all([document.fonts.load(`900 64px ${FONTS.display}`), document.fonts.load(`400 16px ${FONTS.ui}`)])
  .catch(() => {})
  .finally(() => {
    const game = new Phaser.Game(config);
    // Solo en desarrollo: para inspeccionar desde la consola del navegador
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __store: store });
  });

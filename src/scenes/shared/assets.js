// Carga de imágenes para Phaser.
// Vite devuelve la URL final (con hash), así que no se escriben rutas a mano.
import { CHARACTER_COUNT, portraitKey, portraitUrl } from '../../app/characters.js';

const backgrounds = import.meta.glob('../../assets/images/*/*-fondo.{webp,png,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const KEYS = Object.freeze({
  cantinaBackground: 'cantina-fondo',
});

// Si falta un archivo simplemente no se carga: la escena dibuja su versión vectorial de respaldo
export function preloadCantina(scene) {
  const background = backgrounds['../../assets/images/cantina/cantina-fondo.webp'];
  if (background) scene.load.image(KEYS.cantinaBackground, background);

  for (let i = 0; i < CHARACTER_COUNT; i++) {
    const url = portraitUrl(i);
    if (url) scene.load.image(portraitKey(i), url);
  }
}

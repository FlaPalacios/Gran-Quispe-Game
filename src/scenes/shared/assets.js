// Carga de imágenes para Phaser.
// Vite devuelve la URL final (con hash), así que no se escriben rutas a mano.
import { CHARACTER_COUNT, POSES, portraitKey, portraitUrl } from '../../app/characters.js';

const backgrounds = import.meta.glob('../../assets/images/*/*-fondo.{webp,png,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const KEYS = Object.freeze({
  cantinaBackground: 'cantina-fondo',
});

// Pone en la cola del cargador los retratos pedidos y devuelve cuántos quedaron en ella.
// Si falta un archivo simplemente no se carga: la escena cae en la pose neutral, y si tampoco
// está, dibuja su versión vectorial de respaldo. `asked` evita volver a pedir lo mismo.
function queuePortraits(scene, characters, poses, asked) {
  let queued = 0;
  for (const character of new Set(characters)) {
    for (const pose of poses) {
      const key = portraitKey(character, pose);
      const url = portraitUrl(character, pose);
      if (!url || asked?.has(key) || scene.textures.exists(key)) continue;
      asked?.add(key);
      scene.load.image(key, url);
      queued++;
    }
  }
  return queued;
}

export function preloadCantina(scene) {
  const background = backgrounds['../../assets/images/cantina/cantina-fondo.webp'];
  if (background) scene.load.image(KEYS.cantinaBackground, background);

  const everyone = Array.from({ length: CHARACTER_COUNT }, (_, i) => i);
  queuePortraits(scene, everyone, ['neutral'], null);
}

// Las caras de reacción solo salen al terminar una ronda: no entran en la carga inicial,
// sino que se piden aparte cuando ya se sabe qué personajes están jugando.
export function queuePortraitPoses(scene, characters, asked) {
  const poses = Object.keys(POSES).filter((pose) => pose !== 'neutral');
  return queuePortraits(scene, characters, poses, asked);
}

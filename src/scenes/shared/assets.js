// Carga de imágenes para Phaser.
// Vite devuelve la URL final (con hash), así que no se escriben rutas a mano.
import { CHARACTER_COUNT, POSES, portraitKey, portraitUrl } from '../../app/characters.js';
import { SCENARIOS } from '../../engine/rules.js';

const backgrounds = import.meta.glob('../../assets/images/*/*-fondo.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const objects = import.meta.glob('../../assets/images/shared/*.{webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const KEYS = Object.freeze({
  table: 'mesa',
  // Las tres poses del cubilete, recortadas a la misma escala y sobre su punto de apoyo
  cupPoses: Object.freeze({ closed: 'cubilete-tapado', peek: 'cubilete-inclinado', open: 'cubilete-volcado' }),
});

// Fondo de cada escenario: src/assets/images/<escenario>/<escenario>-fondo.webp
export const backgroundKey = (scenario) => `${scenario}-fondo`;
export const backgroundUrl = (scenario) => backgrounds[`../../assets/images/${scenario}/${backgroundKey(scenario)}.webp`];

export const DIE_VALUES = Object.freeze([1, 2, 3, 4, 5, 6]);
export const dieKey = (value) => `dado-${value}`;

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
  // Solo el fondo del menú (la cantina); el de otro escenario se pide al empezar su partida
  const menu = backgroundUrl(SCENARIOS[0]);
  if (menu) scene.load.image(backgroundKey(SCENARIOS[0]), menu);

  // Mesa, cubilete y dados. Lo que falte lo dibuja la escena en vectorial.
  for (const name of [KEYS.table, ...Object.values(KEYS.cupPoses), ...DIE_VALUES.map(dieKey)]) {
    const url = objects[`../../assets/images/shared/${name}.webp`];
    if (url) scene.load.image(name, url);
  }

  const everyone = Array.from({ length: CHARACTER_COUNT }, (_, i) => i);
  queuePortraits(scene, everyone, ['neutral'], null);
}

// Las caras de reacción solo salen al terminar una ronda: no entran en la carga inicial,
// sino que se piden aparte cuando ya se sabe qué personajes están jugando.
export function queuePortraitPoses(scene, characters, asked) {
  const poses = Object.keys(POSES).filter((pose) => pose !== 'neutral');
  return queuePortraits(scene, characters, poses, asked);
}

// Reparto de personajes entre los jugadores.
// Única fuente de verdad: la tarjeta HTML (avatar) y la escena de Phaser (personaje grande)
// piden aquí el mismo índice, así siempre muestran a la misma persona.

// Vite exige que las opciones vayan escritas aquí mismo, no en una variable
const avatarFiles = import.meta.glob('../assets/images/cantina/cantina-avatar-*.{webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const portraitFiles = import.meta.glob('../assets/images/cantina/cantina-personaje-*.{webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byNumber = (a, b) => Number(a.match(/-(\d+)\.\w+$/)[1]) - Number(b.match(/-(\d+)\.\w+$/)[1]);
const sortedUrls = (files) => Object.keys(files).sort(byNumber).map((path) => files[path]);

const avatars = sortedUrls(avatarFiles);
const portraits = sortedUrls(portraitFiles);

// Un personaje solo cuenta si tiene sus dos piezas: avatar para la tarjeta e ilustración para la mesa
export const CHARACTER_COUNT = Math.min(avatars.length, portraits.length);

if (import.meta.env?.DEV && avatars.length !== portraits.length) {
  console.warn(
    `[Gran Quispe] Hay ${avatars.length} avatares y ${portraits.length} personajes en src/assets/images/cantina/. ` +
      `Se usan ${CHARACTER_COUNT}: cada personaje necesita su avatar y su ilustración.`,
  );
}

// Si hay más jugadores que personajes, los personajes se repiten
export function characterIndexFor(playerIndex) {
  return CHARACTER_COUNT ? playerIndex % CHARACTER_COUNT : -1;
}

export const avatarFor = (playerIndex) => avatars[characterIndexFor(playerIndex)] ?? null;

// Para el cargador de Phaser: una clave estable y su URL
export const portraitKey = (characterIndex) => `cantina-personaje-${characterIndex + 1}`;
export const portraitUrl = (characterIndex) => portraits[characterIndex] ?? null;

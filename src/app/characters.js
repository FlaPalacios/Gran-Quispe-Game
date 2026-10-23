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

// Cómo reacciona el personaje. Claves en inglés (código), sufijo del archivo en español.
// La neutral es obligatoria; las otras pueden faltar y se cae de vuelta a ella.
export const POSES = Object.freeze({
  neutral: '',
  caught: '-descubierto', // lo pillaron mintiendo (o se quinceó)
  gloating: '-descubre', // pilló al mentiroso, o ganó la partida
});

// cantina-personaje-3-descubierto.webp → personaje 3, pose '-descubierto'.
// Los dos tipos de archivo se ordenan por su número, no por el orden del glob: así el avatar
// 3 y el personaje 3 son siempre la misma persona aunque falte alguno por el camino.
const FILE_NUMBER = /-(\d+)(-[a-z]+)?\.\w+$/;

const avatars = [];
for (const [path, url] of Object.entries(avatarFiles)) {
  const parts = path.match(FILE_NUMBER);
  if (parts) avatars[Number(parts[1]) - 1] = url;
}

const portraits = [];
for (const [path, url] of Object.entries(portraitFiles)) {
  const parts = path.match(FILE_NUMBER);
  if (!parts) continue;
  portraits[Number(parts[1]) - 1] = { ...portraits[Number(parts[1]) - 1], [parts[2] ?? '']: url };
}

// Un personaje solo cuenta si tiene sus dos piezas: avatar para la tarjeta e ilustración para
// la mesa. Se cuentan desde el 1 y sin saltos: el personaje 3 no sirve si falta el 2.
let complete = 0;
while (avatars[complete] && portraits[complete]?.[POSES.neutral]) complete++;

export const CHARACTER_COUNT = complete;

if (import.meta.env?.DEV && (avatars.length > CHARACTER_COUNT || portraits.length > CHARACTER_COUNT)) {
  console.warn(
    `[Gran Quispe] Hay archivos hasta el avatar ${avatars.length} y el personaje ${portraits.length} ` +
      `en src/assets/images/cantina/, pero se usan ${CHARACTER_COUNT}: cada personaje necesita su ` +
      'avatar y su ilustración, numerados desde el 1 y sin saltos.',
  );
}

// Si hay más jugadores que personajes, los personajes se repiten
export function characterIndexFor(playerIndex) {
  return CHARACTER_COUNT ? playerIndex % CHARACTER_COUNT : -1;
}

export const avatarFor = (playerIndex) => avatars[characterIndexFor(playerIndex)] ?? null;

// Para el cargador de Phaser: una clave estable y su URL
// Una pose que no existe cae en la neutral, que siempre está
const suffix = (pose) => (Object.hasOwn(POSES, pose) ? POSES[pose] : POSES.neutral);

export const portraitKey = (characterIndex, pose = 'neutral') =>
  `cantina-personaje-${characterIndex + 1}${suffix(pose)}`;

export const portraitUrl = (characterIndex, pose = 'neutral') =>
  portraits[characterIndex]?.[suffix(pose)] ?? null;

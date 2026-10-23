// Assets esperados para la Fase 2 (cantina). Fuente de la galería de desarrollo (galeria.html)
// y de recursos-fv/Fase 2 — Assets.md. Las medidas siguen el skill identidad-visual.

export const EXPECTED_ASSETS = [
  {
    group: 'Logo',
    items: [
      {
        path: 'images/shared/logo.webp',
        size: '1100 x 733 px',
        note: 'Con transparencia, generado desde el original (script en recursos-fv/Fase 2 — Assets.md)',
      },
    ],
  },
  {
    group: 'Cantina',
    items: [
      { path: 'images/cantina/cantina-fondo.webp', size: '2560 x 2560 px', note: 'Interior sin personajes ni mesa; lo importante al centro' },
      // Cada personaje necesita sus dos piezas: si falta una, ese personaje no se usa
      ...Array.from({ length: 8 }, (_, i) => ({
        path: `images/cantina/cantina-personaje-${i + 1}.webp`,
        size: '512 x 768 px',
        note: i < 4 ? 'Personaje plano con contorno, fondo transparente' : 'Opcional (para partidas de 5 a 8)',
        optional: i >= 4,
      })),
      // Caras de reacción: se cargan en segundo plano y si faltan se usa la neutral
      ...['descubierto', 'descubre'].flatMap((pose) =>
        Array.from({ length: 4 }, (_, i) => ({
          path: `images/cantina/cantina-personaje-${i + 1}-${pose}.webp`,
          size: '512 x 768 px',
          note: pose === 'descubierto' ? 'Lo pillaron mintiendo' : 'Pilló al mentiroso',
          optional: true,
        })),
      ),
      ...Array.from({ length: 8 }, (_, i) => ({
        path: `images/cantina/cantina-avatar-${i + 1}.webp`,
        size: '192 x 192 px',
        note: 'Cara del personaje para la tarjeta de jugador (Claude la recorta)',
        optional: i >= 4,
      })),
    ],
  },
  {
    group: 'Comunes (opcionales: hoy se dibujan en código)',
    items: [
      { path: 'images/shared/cubilete.png', size: '320 x 400 px', note: 'Boca abajo, fondo transparente', optional: true },
      { path: 'images/shared/mesa-marco.png', size: '1440 x 1100 px', note: 'Marco de retablo, centro transparente', optional: true },
    ],
  },
  {
    group: 'Audio',
    items: [
      { path: 'audio/sfx-agitar-cubilete.ogg', size: '1 a 2 s', note: 'Dados sonando dentro del cubilete' },
      { path: 'audio/sfx-golpe-cubilete.ogg', size: 'menos de 1 s', note: 'Cubilete contra la mesa' },
      { path: 'audio/sfx-destapar.ogg', size: 'menos de 1 s', note: 'Levantar el cubilete' },
      { path: 'audio/sfx-cholada.ogg', size: '1 a 2 s', note: 'Sonido cómico de error' },
      { path: 'audio/sfx-boton.ogg', size: 'menos de 0,3 s', note: 'Clic suave de madera' },
      { path: 'audio/sfx-creo.ogg', size: 'menos de 0,5 s', note: 'Choque de vasos al creer' },
      { path: 'audio/sfx-descubierto.ogg', size: 'menos de 1 s', note: 'Golpe dramático: pillaron al mentiroso' },
      { path: 'audio/sfx-pierde-ronda.ogg', size: '1 s', note: 'Remate que baja al perder la ronda' },
      { path: 'audio/sfx-eliminado.ogg', size: '1 a 2 s', note: 'Remate largo al quedar eliminado' },
      { path: 'audio/sfx-gana-partida.ogg', size: '1 s', note: 'Remate que sube al ganar la partida' },
      { path: 'audio/musica-cantina.ogg', size: 'bucle de 1 a 3 min', note: 'Instrumental andino tranquilo', optional: true },
    ],
  },
];

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
    group: 'Otros escenarios (sin personajes)',
    items: [
      { path: 'images/bar/bar-fondo.webp', size: '2560 x 2560 px', note: 'Bar de noche, sin personas ni mesa' },
      { path: 'images/andino/andino-fondo.webp', size: '2560 x 2560 px', note: 'Valle andino al atardecer, sin personas ni mesa' },
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
    group: 'Mesa, cubilete y dados',
    items: [
      { path: 'images/shared/mesa.webp', size: '1654 x 932 px', note: 'Mesa redonda de paño verde, fondo transparente' },
      { path: 'images/shared/cubilete-tapado.webp', size: '804 x 545 px', note: 'De pie, boca abajo (reposo y sacudida)' },
      { path: 'images/shared/cubilete-inclinado.webp', size: '804 x 545 px', note: 'Inclinado, para mirar los dados a escondidas' },
      { path: 'images/shared/cubilete-volcado.webp', size: '804 x 545 px', note: 'De lado, destape completo al desconfiar' },
      ...Array.from({ length: 6 }, (_, i) => ({
        path: `images/shared/dado-${i + 1}.webp`,
        size: '361 x 404 px',
        note: `Cara ${i + 1} arriba`,
      })),
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
      { path: 'audio/sfx-empezar.ogg', size: '5 s', note: 'Cerveza al empezar la partida' },
      { path: 'audio/sfx-cerveza-ganar.ogg', size: '3 s', note: 'Brindis: suena con la risa y al ganar' },
      { path: 'audio/sfx-risa-hombre.ogg', size: '2 s', note: 'Risa al perder la ronda (las tres se van turnando)' },
      { path: 'audio/sfx-risa-hombre-2.ogg', size: '2 s', note: 'Risa al perder la ronda' },
      { path: 'audio/sfx-risa-abuela.ogg', size: '2 s', note: 'Risa al perder la ronda' },
      { path: 'audio/sfx-eliminado.ogg', size: '3 s', note: 'Al quedar eliminado' },
      { path: 'audio/sfx-gana-partida.ogg', size: '3 s', note: 'Al ganar la partida, junto con el brindis' },
      { path: 'audio/musica-cantina.ogg', size: 'bucle de 1 a 3 min', note: 'Instrumental andino tranquilo', optional: true },
    ],
  },
];

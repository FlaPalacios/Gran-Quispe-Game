// Assets esperados para la Fase 2 (cantina). Fuente de la galería de desarrollo (galeria.html)
// y de recursos-fv/Fase 2 — Assets.md. Las medidas siguen el skill identidad-visual.

export const EXPECTED_ASSETS = [
  {
    group: 'Logo',
    items: [{ path: 'images/shared/logo.png', size: '1600 x 1000 px aprox.', note: 'Logo actual con fondo transparente' }],
  },
  {
    group: 'Cantina',
    items: [
      { path: 'images/cantina/cantina-fondo.webp', size: '2560 x 2560 px', note: 'Interior sin personajes ni mesa; lo importante al centro' },
      ...Array.from({ length: 8 }, (_, i) => ({
        path: `images/cantina/cantina-personaje-${i + 1}.png`,
        size: '512 x 768 px',
        note: i < 4 ? 'Muñeco de madera pintado, fondo transparente' : 'Opcional (para partidas de 5 a 8)',
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
      { path: 'audio/musica-cantina.ogg', size: 'bucle de 1 a 3 min', note: 'Instrumental andino tranquilo', optional: true },
    ],
  },
];

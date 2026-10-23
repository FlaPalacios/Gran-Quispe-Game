# Fase 2 — Assets de la cantina

Lista de gráficos y sonidos para la Fase 2, con medidas, nombres de archivo y prompts listos para copiar en una IA de imágenes (o como guía para Claude Design o quien ilustre).

## Cómo ir viéndolos

1. Crea o descarga el archivo y guárdalo **con el nombre exacto** en la carpeta indicada.
2. Corre `npm run dev` y abre **http://localhost:5173/galeria.html**. Ahí ves qué falta y qué ya está, cada imagen sobre los colores del juego (rayos, crema o noche) y su tamaño real comparado con el esperado. La página se actualiza sola al guardar archivos.
3. Avísale a Claude qué subiste y lo integra al juego. Lo ves en **http://localhost:5173**.

## Estilo

Decidido el 2026-10-21 (opción A): **fondo pintado y personajes planos encima**.

- **Fondos:** ilustración pintada, con luz cálida, sombras y textura. Pueden llevar letreros y marcas locales, que le dan el toque cusqueño.
- **Personajes, cubilete y elementos sueltos:** planos, con contorno negro grueso, sin degradados, con la paleta del juego y luz ámbar para que combinen con el fondo.

Prefijo de estilo para personajes y elementos sueltos:

```
Flat 2D cartoon illustration, bold uniform black outlines, flat colors, no gradients, no texture,
warm amber lighting, limited palette: warm black #120d0a, dark wood brown #6b3f24, amber #ffc46e,
toasted orange #f2a33a, cream #f4ead7, burnt red #c23a2b, colonial blue #2f5d9e, dull gold #f2c230.
No text, no letters, no logos.
```

## 1. Logo

- [x] `src/assets/images/shared/logo.webp` · 1100 x 733 px · fondo transparente · 220 KB

Hecho el 2026-10-21 a partir de `recursos-fv/Gran_Quispe_logo.png`. No se recortó a mano: la opacidad de cada píxel sale de su brillo, así el halo dorado se conserva en vez de quedar un borde duro. Para regenerarlo (si cambia el logo original) se corre este script desde la raíz del proyecto, con `pip install pillow numpy`:

```python
from PIL import Image
import numpy as np

src = Image.open('recursos-fv/Gran_Quispe_logo.png').convert('RGB')
w, h = src.size
target = 1100
src = src.resize((target, round(h * target / w)), Image.LANCZOS)

rgb = np.asarray(src).astype(np.float32)
luma = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
alpha = np.clip((luma - 5.0) * (255.0 / 72.0), 0, 255)

# Devuelve el brillo que se pierde al separar el alfa
out_rgb = np.clip(rgb * 255.0 / np.maximum(alpha, 1.0)[..., None], 0, 255)
# Donde casi no hay opacidad el color no se ve, pero sí pesa: se aplana al dorado del halo
out_rgb[alpha < 10] = np.array([242, 194, 48], dtype=np.float32)

out = np.dstack([out_rgb, alpha]).astype(np.uint8)
Image.fromarray(out, 'RGBA').save('src/assets/images/shared/logo.webp', 'WEBP', quality=84, method=6)
```

No se usa `mix-blend-mode: screen` en el CSS: el canvas de Phaser es una capa de composición aparte y el navegador no puede fundir el logo con él.

## 2. Fondo de la cantina

- [x] `src/assets/images/cantina/cantina-fondo.webp` · 2560 x 2560 px (cuadrado)

Hecho con ChatGPT (original de 1254 px en `recursos-fv/graficos/Fondo1_Cantina_andina.png`), escalado a 2560 px y pasado a WebP. El prompt de abajo queda como referencia para los otros escenarios.

Es cuadrado para que sirva en celular (vertical) y en PC (horizontal): el juego recorta los bordes, así que lo importante debe ir al centro. Sin mesa ni personajes, porque esos se dibujan encima.

```
[prefijo de estilo] Interior of a cozy night cantina in Cusco, Peru. Adobe and wooden walls,
an arched window showing a deep blue night sky, colorful triangular paper bunting across the top
(red, blue, gold), a wooden shelf with a few bottles, warm amber lamp light. The center of the
image is an empty wooden wall area (no table, no people). Square composition, important details
near the center.
```

## 3. Personajes

- [x] `cantina-personaje-1.png` a `cantina-personaje-4.png` (obligatorios), con sus avatares `cantina-avatar-1.png` a `-4.png` de 192 x 192
- [ ] `cantina-personaje-5.png` a `cantina-personaje-8.png` (opcionales, para partidas de 5 a 8)

Carpeta: `src/assets/images/cantina/` · 512 x 768 px · **fondo transparente** · de la cintura para arriba, mirando al frente. Son gente cotidiana del Cusco con personalidad.

Los 4 se generan en **una sola imagen vertical (2:3) con una cuadrícula de 2 x 2**, para que salgan con el mismo estilo y la misma escala. Así cada celda mide casi 512 x 768. Guarda la imagen completa en `recursos-fv/graficos/` y Claude los recorta, quita el fondo si hace falta, los centra en su lienzo y les pone el nombre.

```
Character sheet, vertical 2:3 image, 2x2 grid, 4 separate characters with the same art style
and scale. Each one waist-up, facing the viewer, centered in its cell with empty space around.
Flat 2D cartoon, bold black outlines, flat colors, no gradients, warm amber lighting,
slightly exaggerated proportions, very expressive faces. Regulars of a night cantina in Cusco,
Peru, playing a dice bluffing game. Transparent background. No text, no logos.

1. Top left: cheeky kid around 12, red football jersey with white trim (Cienciano fan),
   messy hair, mischievous grin.
2. Top right: sharp grandmother around 60, round glasses on the tip of her nose, knitted
   cardigan, gray bun, one eyebrow raised, suspicious smile.
3. Bottom left: young office worker around 30 just off work, white shirt, loosened tie,
   rolled-up sleeves, tired eyes but a confident smirk.
4. Bottom right: scruffy old-school bus driver around 50, thick mustache, stubble, belly,
   half-unbuttoned shirt, cap tilted back, toothpick in his mouth, sly look.
```

**Consejos:**

- Si uno sale mal, pide rehacer solo ese: "redo only the bottom-right character, keep the other three exactly the same".
- Para los personajes 5 a 8, adjunta la hoja anterior y pide "same style and scale as the attached characters".
- Si no sale transparente, pide "plain white background": con el contorno negro se quita fácil.

### Variantes de expresión

- [ ] `cantina-personaje-1-descubierto.png` a `-4-descubierto.png`: lo pillaron mintiendo
- [ ] `cantina-personaje-1-descubre.png` a `-4-descubre.png`: pilló al mentiroso

Mismo tamaño y formato que los personajes. **Adjunta la hoja original** (`recursos-fv/graficos/Personajes_Caricaturescos_en_Cuadrícula.png`) en el mismo chat y genera una hoja por expresión, con los personajes en el mismo orden.

Descubierto:

```
Same 4 characters, same art style, scale, outfits and 2x2 grid positions as the attached
image. Waist-up, facing the viewer. Transparent background. No text, no logos.
New expression: just CAUGHT LYING at a dice bluffing game, embarrassed and panicking.
1. Kid: nervous guilty grin, hand scratching the back of his head, a sweat drop.
2. Grandmother: glasses slipping down her nose, hand on her chest, fake innocent "who, me?" face.
3. Office worker: pulling his loosened tie, sweating, awkward forced smile.
4. Bus driver: toothpick falling from his open mouth, eyes wide, eyebrows up.
```

Descubre al mentiroso:

```
Same 4 characters, same art style, scale, outfits and 2x2 grid positions as the attached
image. Waist-up, facing the viewer. Transparent background. No text, no logos.
New expression: just CAUGHT SOMEONE ELSE LYING at a dice bluffing game, triumphant and mocking.
1. Kid: pointing at the viewer and laughing out loud.
2. Grandmother: glasses gleaming, wagging her index finger, smug "I knew it" smile.
3. Office worker: confident fist pump, satisfied smirk.
4. Bus driver: big belly laugh, one fist raised, toothpick pointing up.
```

## 4. Cubilete y marco (opcionales)

Hoy se dibujan en código y ya se ven bien. Si quieres que se parezcan más al logo (cuero con greca), puedes hacerlos:

- [ ] `src/assets/images/shared/cubilete.png` · 320 x 400 px · boca abajo, fondo transparente
- [ ] `src/assets/images/shared/mesa-marco.png` · 1440 x 1100 px · marco de retablo con el centro transparente

## 5. Sonidos

Carpeta `src/assets/audio/`, formato OGG (si solo consigues MP3 o WAV, Claude lo convierte).

- [x] `sfx-agitar-cubilete.ogg` · dados sonando dentro del cubilete (1 a 2 s)
- [x] `sfx-golpe-cubilete.ogg` · cubilete contra la mesa
- [x] `sfx-destapar.ogg` · levantar el cubilete
- [x] `sfx-cholada.ogg` · sonido cómico de error
- [x] `sfx-boton.ogg` · clic suave de madera
- [ ] `musica-cantina.ogg` · bucle instrumental andino tranquilo (opcional)

Dónde conseguirlos gratis y con licencia libre:

- **Kenney.nl → "Casino Audio"**: tiene sonidos de dados y cubilete. Licencia CC0 (se puede usar sin dar crédito).
- **freesound.org**: filtra por licencia "Creative Commons 0". Busca "dice cup shake", "wood click", "cartoon fail".
- **pixabay.com/music**: busca "andean" o "huayno". Licencia de Pixabay, gratis para juegos.

Guarda en `recursos-fv/creditos.md` de dónde salió cada archivo, por si alguna licencia pide dar crédito.

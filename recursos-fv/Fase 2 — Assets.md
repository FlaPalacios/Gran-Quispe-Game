# Fase 2 — Assets de la cantina

Lista de gráficos y sonidos para la Fase 2, con medidas, nombres de archivo y prompts listos para copiar en una IA de imágenes (o como guía para Claude Design o quien ilustre).

## Cómo ir viéndolos

1. Crea o descarga el archivo y guárdalo **con el nombre exacto** en la carpeta indicada.
2. Corre `npm run dev` y abre **http://localhost:5173/galeria.html**. Ahí ves qué falta y qué ya está, cada imagen sobre los colores del juego (rayos, crema o noche) y su tamaño real comparado con el esperado. La página se actualiza sola al guardar archivos.
3. Avísale a Claude qué subiste y lo integra al juego. Lo ves en **http://localhost:5173**.

## Estilo (igual para todo)

El wireframe manda: ilustración plana, contorno negro grueso, sin degradados ni texturas, con la paleta del juego. El logo puede mantener su textura actual, pero personajes y fondos van planos para que todo combine.

Prefijo de estilo para pegar al inicio de cada prompt:

```
Flat 2D cartoon illustration, bold uniform black outlines, no gradients, no texture, no shading,
limited palette: warm black #120d0a, dark wood brown #6b3f24, amber #ffc46e, toasted orange #f2a33a,
cream #f4ead7, burnt red #c23a2b, colonial blue #2f5d9e, dull gold #f2c230.
Inspired by Ayacucho retablo folk art and a Cusco night cantina. No text, no letters.
```

## 1. Logo

- [ ] `src/assets/images/shared/logo.png` · unos 1600 x 1000 px · **fondo transparente**

Es el logo que ya tienes (`recursos-fv/Gran_Quispe_logo.png`), sin el fondo negro. Puedes quitarlo con remove.bg, Photopea o el removedor de fondo de Canva. Revisa que no quede un halo oscuro alrededor de las letras.

## 2. Fondo de la cantina

- [ ] `src/assets/images/cantina/cantina-fondo.webp` · 2560 x 2560 px (cuadrado)

Es cuadrado para que sirva en celular (vertical) y en PC (horizontal): el juego recorta los bordes, así que lo importante debe ir al centro. Sin mesa ni personajes, porque esos se dibujan encima.

```
[prefijo de estilo] Interior of a cozy night cantina in Cusco, Peru. Adobe and wooden walls,
an arched window showing a deep blue night sky, colorful triangular paper bunting across the top
(red, blue, gold), a wooden shelf with a few bottles, warm amber lamp light. The center of the
image is an empty wooden wall area (no table, no people). Square composition, important details
near the center.
```

## 3. Personajes (muñecos de madera pintados)

- [ ] `cantina-personaje-1.png` a `cantina-personaje-4.png` (obligatorios)
- [ ] `cantina-personaje-5.png` a `cantina-personaje-8.png` (opcionales, para partidas de 5 a 8)

Carpeta: `src/assets/images/cantina/` · 512 x 768 px · **fondo transparente** · de la cintura para arriba, mirando al frente.

Prompt base (cambia solo la parte entre corchetes):

```
[prefijo de estilo] A painted wooden doll character in Andean folk-toy style, simple rounded
shapes, visible wood-carved look, waist-up, facing the viewer, friendly expression,
[DESCRIPCIÓN], centered, transparent background.
```

Ideas para la descripción:

1. young man wearing a red and gold chullo knitted hat with ear flaps and a burnt-red poncho
2. woman with two long braids, a flat montera hat and a colorful lliclla shawl
3. older man with a moustache, a felt hat and a dark brown poncho with gold trim
4. young woman with a bowler hat, a pollera skirt and a blue embroidered jacket
5. man playing a charango, wearing a chullo and a striped poncho
6. grandmother with a shawl and a basket, kind smile
7. university student with a modern jacket over a small woven scarf
8. musician with a quena flute and a colonial-blue poncho

**Consejo:** genera los 8 en la misma sesión y pide "same style as the previous character", así salen parejos. Si alguno sale con degradados o sombras, pide "flat colors only".

## 4. Cubilete y marco (opcionales)

Hoy se dibujan en código y ya se ven bien. Si quieres que se parezcan más al logo (cuero con greca), puedes hacerlos:

- [ ] `src/assets/images/shared/cubilete.png` · 320 x 400 px · boca abajo, fondo transparente
- [ ] `src/assets/images/shared/mesa-marco.png` · 1440 x 1100 px · marco de retablo con el centro transparente

## 5. Sonidos

Carpeta `src/assets/audio/`, formato OGG (si solo consigues MP3 o WAV, Claude lo convierte).

- [ ] `sfx-agitar-cubilete.ogg` · dados sonando dentro del cubilete (1 a 2 s)
- [ ] `sfx-golpe-cubilete.ogg` · cubilete contra la mesa
- [ ] `sfx-destapar.ogg` · levantar el cubilete
- [ ] `sfx-cholada.ogg` · sonido cómico de error
- [ ] `sfx-boton.ogg` · clic suave de madera
- [ ] `musica-cantina.ogg` · bucle instrumental andino tranquilo (opcional)

Dónde conseguirlos gratis y con licencia libre:

- **Kenney.nl → "Casino Audio"**: tiene sonidos de dados y cubilete. Licencia CC0 (se puede usar sin dar crédito).
- **freesound.org**: filtra por licencia "Creative Commons 0". Busca "dice cup shake", "wood click", "cartoon fail".
- **pixabay.com/music**: busca "andean" o "huayno". Licencia de Pixabay, gratis para juegos.

Guarda en `recursos-fv/creditos.md` de dónde salió cada archivo, por si alguna licencia pide dar crédito.

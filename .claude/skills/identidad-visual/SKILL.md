---
name: identidad-visual
description: Paleta de colores, tipografía, estilo gráfico, tamaños de sprite y convención de nombres de assets de Gran Quispe. Usar siempre que se cree, integre o modifique cualquier gráfico, color, fuente, sprite, fondo o archivo en src/assets/.
---

# Identidad visual de Gran Quispe

La referencia visual es el wireframe hecho en Claude Design: `recursos-fv/referencias/Gran Quispe-wiireframe.png` (menú principal, mesa de juego, configuración). Es una referencia de estilo, no una especificación exacta: se toma su dirección de arte, pero modos, variantes y textos salen de `CLAUDE.md`. Inspiración: retablo ayacuchano y cantina nocturna cusqueña.

## Lo que se toma del wireframe

- Mesa de paño azul colonial, cubilete de madera con franjas roja y dorada, dados blancos.
- Tarjetas y paneles color crema con contorno negro grueso y sombra sólida desplazada hacia abajo (sin desenfoque).
- Botón principal rojo quemado, botón secundario azul colonial, texto crema.
- Tarjetas de jugador con avatar redondo y las 6 letras QUISPE en casillas: perdidas en rojo quemado, pendientes en gris oscuro.

## Lo que cambió al llegar el arte definitivo (2026-10-21)

- **El fondo de rayos de sol ya no se usa.** Cada escenario tiene su fondo ilustrado; el de rayos (`drawSunburst`) queda solo como respaldo si la imagen no carga.
- **La mesa ya no lleva marco de retablo.** El fondo ya pone el ambiente, así que la mesa es una elipse de madera con paño azul en la parte baja (`drawRoundTable`). El marco antiguo (`drawTable`) sigue disponible por si un escenario lo necesita.
- **El menú ya no dibuja el título con tipografía**, sino el logo: `src/assets/images/shared/logo.webp`.
- El escenario se oscurece con una capa de `--color-fondo`: al 72 % en el menú (para que resalte el logo) y al 35 % en la mesa (para que se lea el HUD).

## El escenario tiene un ancho máximo

En monitores anchos el escenario no se estira de lado a lado: queda en una caja centrada y los costados van en negro (`--color-fondo`). El límite es doble: 1500 px, y como mucho 1,8 veces el alto, para no recortar de más el fondo, que es cuadrado. Vive en `MAX_STAGE_WIDTH` y `MAX_STAGE_RATIO` de `src/scenes/shared/layout.js` y en `--escenario-ancho` de `src/ui/styles.css`; hay que mantenerlos sincronizados.

El fondo se recorta tipo "cover" dentro de esa caja y **se ancla abajo**, no al centro: así el piso queda siempre a la misma altura que la mesa en vez de subir y bajar según la pantalla.

## Composición de la mesa

De atrás hacia adelante: fondo del escenario → capa de oscurecido → personaje del jugador en turno → mesa → dados → cubilete.

- El personaje se ve de la cintura para arriba, sentado al otro lado de la mesa y corrido hacia un lado, para que el cubilete nunca le tape la cara. Al terminar la ronda se queda quien perdió, y al terminar la partida quien ganó.
- Al destapar, el cubilete **no se levanta en alto**: se corre a un costado de la mesa y se inclina. Así no invade el resto de la escena.
- La mesa y el personaje llevan **sombra difusa** a sus pies (`drawSoftShadow`). Sin ella parecen flotar sobre el fondo, que es lo primero que delata que son dos piezas distintas.

## Responsivo

Cada pantalla tiene dos distribuciones: celular (una columna, como el wireframe) y PC desde 1024 px en horizontal (mesa a la izquierda, HUD a la derecha; menú y configuración en dos columnas con ancho máximo). Los assets deben verse bien en ambos: fondos que se puedan recortar o extender sin perder el centro, y nada de texto de interfaz dentro de las imágenes (los letreros que forman parte del fondo sí se permiten).

## Paleta (usar solo estos colores)

| Rol | Variable CSS | Hex | Phaser |
| --- | --- | --- | --- |
| Fondo principal (negro cálido) | `--color-fondo` | #120d0a | `0x120d0a` |
| Madera / mesa (marrón oscuro) | `--color-madera` | #6b3f24 | `0x6b3f24` |
| Luz de foco (ámbar dorado) | `--color-foco` | #ffc46e | `0xffc46e` |
| Acento principal (naranja tostado) | `--color-acento` | #f2a33a | `0xf2a33a` |
| Texto / UI (crema) | `--color-texto` | #f4ead7 | `0xf4ead7` |
| Bordes / contornos (negro) | `--color-borde` | #000000 | `0x000000` |
| Marco retablo, franja 1 (rojo quemado) | `--color-retablo-rojo` | #c23a2b | `0xc23a2b` |
| Marco retablo, franja 2 (azul colonial) | `--color-retablo-azul` | #2f5d9e | `0x2f5d9e` |
| Marco retablo, detalle (dorado opaco) | `--color-retablo-dorado` | #f2c230 | `0xf2c230` |
| Letras QUISPE pendientes (gris oscuro) | `--color-letra-pendiente` | #4a3a2f | `0x4a3a2f` |
| Campos sobre tarjetas crema del HUD (blanco) | `--color-papel` | #ffffff | — |

**Maderas de cantina** (desde el 2026-10-21). Las pantallas fuera de la mesa (configuración, y más adelante el menú) van oscuras y sobrias, a tono con el escenario, en vez del crema claro:

| Rol | Variable CSS | Hex |
| --- | --- | --- |
| Fondo de pantalla, tablones oscuros | `--color-tabla` | #1d1410 |
| Veta de los tablones | `--color-tabla-veta` | #2a1d16 |
| Tarjetas | `--color-panel` | #35241a |
| Campos y controles dentro de una tarjeta | `--color-campo` | #4a3326 |
| Texto secundario sobre madera | `--color-texto-suave` | #c7ab8c |

Sobre madera, el texto principal va en crema (`--color-texto`) y la opción elegida en ámbar (`--color-foco`) con texto oscuro.

Las variables CSS están definidas en `src/ui/styles.css`. En la capa HTML se usan siempre las variables, nunca el hex directo.

## Tipografía

- **Títulos (display):** Fraunces en peso 900 con el eje SOFT al máximo (serif gruesa y redondeada, la más cercana al logo del wireframe). Variable `--font-display`; en Phaser, `FONTS.display` de `src/scenes/shared/theme.js`.
- **Interfaz (botones, listas, párrafos):** Fredoka, variable `--font-ui`; en Phaser, `FONTS.ui`.
- Ambas se cargan desde Google Fonts en `index.html`. `src/main.js` espera a que carguen antes de crear el juego.
- Para cambiar la fuente de títulos (por ejemplo, volver a Luckiest Guy o usar Morelia con licencia): cambiar el enlace de `index.html` (o colocar el archivo en `src/assets/fonts/` con `@font-face`), `--font-display` y `FONTS.display`. Nada más debe tocarse.
- Colores para Phaser: usar `COLORS` de `src/scenes/shared/theme.js`, nunca hex sueltos.

## Estilo gráfico

Decidido el 2026-10-21 (opción A): **fondo pintado y personajes planos encima**.

- Fondos de escenario: ilustración pintada, con luz cálida, sombras y textura. Pueden llevar letreros y marcas locales (le dan el toque cusqueño).
- Personajes, UI, cubilete y elementos sueltos: planos, sin degradados, con luz ámbar para combinar con el fondo.
- Contornos negros gruesos de 3-4 px (en Phaser, `setStrokeStyle(4, 0x000000)`; en CSS, `var(--borde-grueso)`).
- Personajes: gente cotidiana del Cusco con personalidad (el chibolo hincha del Cienciano, la abuela con lentes, el oficinista, el chofer de bus), **solo en el escenario de cantina**. Prompt en `recursos-fv/Fase 2 — Assets.md`.
- Bar universitario y paisaje andino: solo ambientación, sin personajes.

## Tamaños de sprite (propuesta inicial)

Los assets se exportan al doble de su tamaño en pantalla para verse nítidos en celulares de alta densidad.

| Asset | Tamaño del archivo |
| --- | --- |
| Fondo de escenario | 2560 x 2560 px (cuadrado, sirve para vertical y horizontal) |
| Logo | 1100 x 733 px, con transparencia |
| Mesa | 1440 x 1100 px |
| Cubilete | 320 x 400 px |
| Cara de dado | 160 x 160 px |
| Personaje de cantina | 512 x 768 px |
| Avatar de jugador | 192 x 192 px |
| Icono de UI | 96 x 96 px |

## Convención de nombres en `src/assets/`

- Todo en minúsculas, kebab-case, sin tildes ni ñ: `cantina-fondo.png`, `dado-cara-6.png`.
- Imágenes por escenario en `src/assets/images/<escenario>/` con prefijo del escenario: `cantina-`, `bar-`, `andino-`.
- Lo común a los tres escenarios (dados, cubilete, iconos) en `src/assets/images/shared/`.
- Audio en `src/assets/audio/` con prefijo de tipo: `sfx-agitar-cubilete.ogg`, `musica-cantina.ogg`.
- Formatos: PNG para sprites, WebP para fondos grandes y para el logo, OGG + MP3 para audio (el audio va en los dos formatos: Safari no reproduce OGG).
- La clave de carga en Phaser es el nombre del archivo sin extensión.

## El logo

El original (`recursos-fv/Gran_Quispe_logo.png`) viene sobre fondo negro con halo. La versión del juego se genera con transparencia real a partir del brillo de cada píxel, no con `mix-blend-mode`: el canvas de Phaser es una capa de composición aparte y el navegador no puede fundirse con él. El script está en `recursos-fv/Fase 2 — Assets.md`.

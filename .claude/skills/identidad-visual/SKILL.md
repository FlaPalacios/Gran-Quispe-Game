---
name: identidad-visual
description: Paleta de colores, tipografía, estilo gráfico, tamaños de sprite y convención de nombres de assets de Gran Quispe. Usar siempre que se cree, integre o modifique cualquier gráfico, color, fuente, sprite, fondo o archivo en src/assets/.
---

# Identidad visual de Gran Quispe

La referencia visual es el wireframe hecho en Claude Design: `recursos-fv/referencias/Gran Quispe-wiireframe.png` (menú principal, mesa de juego, configuración). Es una referencia de estilo, no una especificación exacta: se toma su dirección de arte, pero modos, variantes y textos salen de `CLAUDE.md`. Inspiración: retablo ayacuchano y cantina nocturna cusqueña.

## Lo que se toma del wireframe

- Fondo de rayos de sol en naranja tostado y ámbar dorado detrás de cada pantalla.
- Mesa dentro de un marco de madera tipo retablo con remaches dorados; arco con ventana, banderines de colores y botellas en la cantina.
- Mesa de paño azul colonial, cubilete de madera con franjas roja y dorada, dados blancos.
- Tarjetas y paneles color crema con contorno negro grueso y sombra sólida desplazada hacia abajo (sin desenfoque).
- Botón principal rojo quemado, botón secundario azul colonial, texto crema.
- Tarjetas de jugador con avatar redondo y las 6 letras QUISPE en casillas: perdidas en rojo quemado, pendientes en gris oscuro.

## Responsivo

Cada pantalla tiene dos distribuciones: celular (una columna, como el wireframe) y PC desde 1024 px en horizontal (mesa a la izquierda, HUD a la derecha; menú y configuración en dos columnas con ancho máximo). Los assets deben verse bien en ambos: fondos que se puedan recortar o extender sin perder el centro, y nada de texto dentro de las imágenes.

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
| Campos y controles sobre tarjetas crema (blanco) | `--color-papel` | #ffffff | — |

Las variables CSS están definidas en `src/ui/styles.css`. En la capa HTML se usan siempre las variables, nunca el hex directo.

## Tipografía

- **Títulos (display):** Fraunces en peso 900 con el eje SOFT al máximo (serif gruesa y redondeada, la más cercana al logo del wireframe). Variable `--font-display`; en Phaser, `FONTS.display` de `src/scenes/shared/theme.js`.
- **Interfaz (botones, listas, párrafos):** Fredoka, variable `--font-ui`; en Phaser, `FONTS.ui`.
- Ambas se cargan desde Google Fonts en `index.html`. `src/main.js` espera a que carguen antes de crear el juego.
- Para cambiar la fuente de títulos (por ejemplo, volver a Luckiest Guy o usar Morelia con licencia): cambiar el enlace de `index.html` (o colocar el archivo en `src/assets/fonts/` con `@font-face`), `--font-display` y `FONTS.display`. Nada más debe tocarse.
- Colores para Phaser: usar `COLORS` de `src/scenes/shared/theme.js`, nunca hex sueltos.

## Estilo gráfico

- Ilustración plana, sin degradados.
- Contornos negros gruesos de 3-4 px (en Phaser, `setStrokeStyle(4, 0x000000)`; en CSS, `var(--borde-grueso)`).
- Personajes tipo muñeco de madera pintado con ropa regional cusqueña, **solo en el escenario de cantina**.
- Bar universitario y paisaje andino: solo ambientación, sin personajes.

## Tamaños de sprite (propuesta inicial)

Los assets se exportan al doble de su tamaño en pantalla para verse nítidos en celulares de alta densidad.

| Asset | Tamaño del archivo |
| --- | --- |
| Fondo de escenario | 2560 x 2560 px (cuadrado, sirve para vertical y horizontal) |
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
- Formatos: PNG para sprites, WebP para fondos grandes, OGG + MP3 para audio.
- La clave de carga en Phaser es el nombre del archivo sin extensión.

# Créditos de assets

## Gráficos

| Archivo | Origen | Licencia |
| --- | --- | --- |
| `images/shared/logo.webp` | Logo de Flavio (`recursos-fv/graficos/Gran_Quispe_logo.png`), recortado con contorno sólido y escalado a 1100 px (`scripts/recortar-logo.py`) | Propio |
| `images/cantina/cantina-fondo.webp` | Generado con ChatGPT por Flavio (`recursos-fv/graficos/escenarios/Fondo1_Cantina_andina.png`), escalado a 2560 px | Propio |
| `images/bar/bar-fondo.webp` | Generado por Flavio (`recursos-fv/graficos/escenarios/Bar Andino Bajo las Estrellas.png`), escalado a 2560 px | Propio |
| `images/andino/andino-fondo.webp` | Generado por Flavio (`recursos-fv/graficos/escenarios/Valle andino al atardecer.png`), escalado a 2560 px | Propio |
| `images/cantina/cantina-personaje-1..4.webp` y `cantina-avatar-1..4.webp` | Generados con ChatGPT por Flavio (`recursos-fv/graficos/personajes/Personajes_Caricaturescos_en_Cuadrícula.png`), recortados | Propio |
| `images/cantina/cantina-personaje-1..4-descubierto.webp` | Hoja de caras de vergüenza (`recursos-fv/graficos/personajes/Cuatro retratos cómicos de vergüenza.png`), recortada y alineada con la neutral | Propio |
| `images/cantina/cantina-personaje-1..4-descubre.webp` | Hoja de caras triunfales (`recursos-fv/graficos/personajes/Personajes_Cuando lo pillan mintiendo.png`), recortada y alineada con la neutral | Propio |

| `images/shared/menu-fondo-vertical.webp`, `menu-fondo-horizontal.webp` | Generados por Flavio (`recursos-fv/graficos/escenarios/menu-*.png`), pasados a WebP | Propio |
| `images/shared/reaccion-*.webp` | Hoja de stickers generada por Flavio (`recursos-fv/graficos/reacciones/reacciones-hoja.png`), recortada con `recortar-reacciones.py` | Propio |
| `images/shared/banner.webp` | Generado por Flavio (`recursos-fv/graficos/escenarios/banner - Dados andina bajo luz de cantina.png`), escalado a 1600 px | Propio |
| `images/shared/icono.png`, `icono-apple.png` | El cubilete del logo, con `recortar-logo.py` | Propio |
| `images/shared/mesa.webp` | Generada con ChatGPT por Flavio (`recursos-fv/graficos/objetos/Mesa de póker rústica de fieltro verde.png`), recortada | Propio |
| `images/shared/cubilete-tapado/-inclinado/-volcado.webp` | Hoja de tres poses (`Tres vasos de cuero ilustrados.png`), recortadas a la misma escala y sobre su punto de apoyo | Propio |
| `images/shared/dado-1..6.webp` | Cuadrícula de seis caras (`Colección de dados ilustrados 3D.png`), recortadas al mismo tamaño | Propio |

Los PNG originales de los personajes, avatares y objetos están en `recursos-fv/graficos/png-originales/`. En `src/assets/` se usan en WebP: pesan 307 KB en vez de 2 MB, sin diferencia visible.

## Sonidos

Quitados del juego por pedido de Flavio (los archivos están en `recursos-fv/papelera/sonidos-quitados/`): `sfx-destapar`, `sfx-gana-partida`, la risa de la Cholada (el nombre `sfx-cholada` ahora lo lleva el pedo) y las tres risas. Sus filas siguen abajo como registro.

Todos en `src/assets/audio/`, en OGG y MP3, normalizados de volumen.

| Archivo | Origen | Licencia |
| --- | --- | --- |
| `sfx-agitar-cubilete` | Kenney, "Casino Audio" 1.1: `dice-shake-1` | CC0 |
| `sfx-golpe-cubilete` | Kenney, "Impact Sounds": `impactWood_heavy_000` | CC0 |
| `sfx-destapar` | Kenney, "Casino Audio" 1.1: `dice-grab-1` | CC0 |
| `sfx-cholada` | Sintetizado por Claude (trombón triste de 4 notas) | Propio |
| `sfx-boton` | Kenney, "Impact Sounds": `impactWood_light_001` | CC0 |
| `sfx-creo` | BigSoundBank 1323 (choque de vasos) | CC0 |
| `sfx-empezar` | Grabado por Flavio: "sonido cerveza empezar juego" | Propio |
| `sfx-destapar` | Grabado por Flavio: "Sonido revelar dadoss" | Propio |
| `sfx-cholada` | Grabado por Flavio: "Risa Cholada" | Propio |
| `sfx-risa-hombre`, `sfx-risa-hombre-2`, `sfx-risa-abuela` | Grabadas por Flavio: las tres risas de "Descubierto" | Propio |
| `sfx-cerveza-ganar` | Grabado por Flavio: "Sonido Cerveza ganar" | Propio |
| `sfx-gana-partida` | Grabado por Flavio: "Sonido de Ganar" | Propio |
| `sfx-eliminado` | Grabado por Flavio: "Sonido de Perder" | Propio |
| `sfx-mentiste-mal`, `sfx-te-equivocaste`, `sfx-te-equivocaste-golpe`, `sfx-cholada` (el pedo), `sfx-perder-vida`, `sfx-tomaaas` | Conseguidos por Flavio (2026-11-26); varios son audios de memes sacados de videos | Sin confirmar: revisar antes de publicar o aceptar donaciones |

Kenney (www.kenney.nl) no exige crédito, pero lo agradece: se puede nombrar en la pantalla de créditos.

Los de Kenney y BigSoundBank conservan su OGG original (no se recodifica para no perder
calidad) y su MP3 se sacó de ahí. Los de Flavio salen de `recursos-fv/sonidos/efectos-grabados/` con
`recursos-fv/scripts/convertir-sonidos.py`, que los normaliza y genera el OGG (Opus) y el MP3.
Cuál suena más fuerte que cuál se ajusta en la tabla `SFX` de `src/app/audio.js`, no en el archivo.
Los del final de ronda (desde "mentiste mal" hasta "tomaaas") salen de la misma carpeta con
`recursos-fv/scripts/convertir-momentos.py`, que los recorta y los nivela en sonoridad (LUFS).

Los que fueron reemplazados quedan en `recursos-fv/papelera/sonidos-alternativos/` (destapar, cholada,
descubierto, pierde-ronda, eliminado y gana-partida, todos con sufijo `-A`), y las otras opciones que no
llegaron a entrar (`sonidos-candidatos/`) se borraron; siguen en el historial de git.

## Voces

En `src/assets/audio/voces/`, en OGG (Opus) y MP3, una por jugada o frase. Hechas por Flavio
con ElevenLabs (una voz diseñada por personaje) y cortadas con `recursos-fv/scripts/cortar-voces.py`
desde `recursos-fv/sonidos/voces/`. Licencia según el plan de ElevenLabs: revisar antes de
publicar o aceptar donaciones.

| Personaje | Archivos |
| --- | --- |
| 1 Alancito | `voz-1-*`: las 21 jugadas y las 7 frases |
| 2 Doña Buricia | `voz-2-*`: las 21 jugadas y las 7 frases |
| 3 Don Cucho | `voz-3-*`: las 21 jugadas y 6 frases (sin la de quedar fuera) |
| 4 Don Dago | `voz-4-*`: las 21 jugadas y las 7 frases |

## Música

En `src/assets/audio/`, en OGG (Opus) y MP3. Salen de `recursos-fv/sonidos/musica/` con
`recursos-fv/scripts/convertir-musica.sh`, que les recorta el silencio del principio y del final
para que el bucle no tenga hueco. El volumen de cada pista va en la tabla `MUSIC` de `src/app/audio.js`.

| Archivo | Origen | Licencia |
| --- | --- | --- |
| `musica-menu` | "Cantina de Noche", hecha por Flavio con Suno (70 bpm) | Según el plan de Suno con que se generó: revisar antes de publicar o aceptar donaciones |
| `musica-partida` | Hecha por Flavio con ElevenLabs Music (70 bpm) | Según el plan de ElevenLabs: revisar antes de publicar o aceptar donaciones |
| `musica-ganador` | "Cumbia del ganador Gran Quispe", conseguida por Flavio | Según la herramienta con que se generó: revisar antes de publicar o aceptar donaciones |

## Íconos de contacto

`images/shared/icono-gmail.webp` e `icono-instagram.webp`: los íconos blancos que pasó Flavio (`recursos-fv/graficos/iconos/`), recortados y reducidos a 96 px.

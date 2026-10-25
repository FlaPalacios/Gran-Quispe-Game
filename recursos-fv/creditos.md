# Créditos de assets

## Gráficos

| Archivo | Origen | Licencia |
| --- | --- | --- |
| `images/shared/logo.webp` | Logo de Flavio (`recursos-fv/Gran_Quispe_logo.png`), recortado con transparencia y escalado a 1100 px (script en `Fase 2 — Assets.md`) | Propio |
| `images/cantina/cantina-fondo.webp` | Generado con ChatGPT por Flavio (`recursos-fv/graficos/Fondo1_Cantina_andina.png`), escalado a 2560 px | Propio |
| `images/cantina/cantina-personaje-1..4.webp` y `cantina-avatar-1..4.webp` | Generados con ChatGPT por Flavio (`recursos-fv/graficos/personajes/Personajes_Caricaturescos_en_Cuadrícula.png`), recortados | Propio |
| `images/cantina/cantina-personaje-1..4-descubierto.webp` | Hoja de caras de vergüenza (`recursos-fv/graficos/personajes/Cuatro retratos cómicos de vergüenza.png`), recortada y alineada con la neutral | Propio |
| `images/cantina/cantina-personaje-1..4-descubre.webp` | Hoja de caras triunfales (`recursos-fv/graficos/personajes/Personajes_Cuando lo pillan mintiendo.png`), recortada y alineada con la neutral | Propio |

| `images/shared/mesa.webp` | Generada con ChatGPT por Flavio (`recursos-fv/graficos/fondos y objetos/Mesa de póker rústica de fieltro verde.png`), recortada | Propio |
| `images/shared/cubilete-tapado/-inclinado/-volcado.webp` | Hoja de tres poses (`Tres vasos de cuero ilustrados.png`), recortadas a la misma escala y sobre su punto de apoyo | Propio |
| `images/shared/dado-1..6.webp` | Cuadrícula de seis caras (`Colección de dados ilustrados 3D.png`), recortadas al mismo tamaño | Propio |

Los PNG originales de los personajes, avatares y objetos están en `recursos-fv/graficos/png-originales/`. En `src/assets/` se usan en WebP: pesan 307 KB en vez de 2 MB, sin diferencia visible.

## Sonidos

Todos en `src/assets/audio/`, en OGG y MP3, normalizados de volumen.

| Archivo | Origen | Licencia |
| --- | --- | --- |
| `sfx-agitar-cubilete` | Kenney, "Casino Audio" 1.1: `dice-shake-1` | CC0 |
| `sfx-golpe-cubilete` | Kenney, "Impact Sounds": `impactWood_heavy_000` | CC0 |
| `sfx-destapar` | Kenney, "Casino Audio" 1.1: `dice-grab-1` | CC0 |
| `sfx-cholada` | Sintetizado por Claude (trombón triste de 4 notas) | Propio |
| `sfx-boton` | Kenney, "Impact Sounds": `impactWood_light_001` | CC0 |
| `sfx-creo` | BigSoundBank 1323 (choque de vasos) | CC0 |
| `sfx-pierde-ronda` | Kenney, "Music Jingles": `PIZZI01` | CC0 |
| `sfx-empezar` | Grabado por Flavio: "sonido cerveza empezar juego" | Propio |
| `sfx-destapar` | Grabado por Flavio: "Sonido revelar dadoss" | Propio |
| `sfx-cholada` | Grabado por Flavio: "Risa Cholada" | Propio |
| `sfx-risa-hombre`, `sfx-risa-hombre-2`, `sfx-risa-abuela` | Grabadas por Flavio: las tres risas de "Descubierto" | Propio |
| `sfx-cerveza-ganar` | Grabado por Flavio: "Sonido Cerveza ganar" | Propio |
| `sfx-gana-partida` | Grabado por Flavio: "Sonido de Ganar" | Propio |
| `sfx-eliminado` | Grabado por Flavio: "Sonido de Perder" | Propio |

Kenney (www.kenney.nl) no exige crédito, pero lo agradece: se puede nombrar en la pantalla de créditos.

Los de Kenney y BigSoundBank conservan su OGG original (no se recodifica para no perder
calidad) y su MP3 se sacó de ahí. Los de Flavio salen de `recursos-fv/Sonidos Fla MP3/` con
`recursos-fv/scripts/convertir-sonidos.py`, que los normaliza y genera el OGG (Opus) y el MP3.
Cuál suena más fuerte que cuál se ajusta en la tabla `SFX` de `src/app/audio.js`, no en el archivo.

Los que fueron reemplazados quedan en `recursos-fv/sonidos-alternativos/` (destapar, cholada,
descubierto, eliminado y gana-partida, todos con sufijo `-A`), y las otras opciones que no
llegaron a entrar, en `recursos-fv/sonidos-candidatos/`.

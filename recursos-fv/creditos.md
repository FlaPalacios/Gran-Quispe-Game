# Créditos de assets

## Gráficos

| Archivo | Origen | Licencia |
| --- | --- | --- |
| `images/shared/logo.webp` | Logo de Flavio (`recursos-fv/Gran_Quispe_logo.png`), recortado con transparencia y escalado a 1100 px (script en `Fase 2 — Assets.md`) | Propio |
| `images/cantina/cantina-fondo.webp` | Generado con ChatGPT por Flavio (`recursos-fv/graficos/Fondo1_Cantina_andina.png`), escalado a 2560 px | Propio |
| `images/cantina/cantina-personaje-1..4.webp` y `cantina-avatar-1..4.webp` | Generados con ChatGPT por Flavio (`recursos-fv/graficos/personajes/Personajes_Caricaturescos_en_Cuadrícula.png`), recortados | Propio |
| `images/cantina/cantina-personaje-1..4-descubierto.webp` | Hoja de caras de vergüenza (`recursos-fv/graficos/personajes/Cuatro retratos cómicos de vergüenza.png`), recortada y alineada con la neutral | Propio |
| `images/cantina/cantina-personaje-1..4-descubre.webp` | Hoja de caras triunfales (`recursos-fv/graficos/personajes/Personajes_Cuando lo pillan mintiendo.png`), recortada y alineada con la neutral | Propio |

Los PNG originales de los personajes y avatares están en `recursos-fv/graficos/png-originales/`. En `src/assets/` se usan en WebP: pesan 307 KB en vez de 2 MB, sin diferencia visible.

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
| `sfx-descubierto` | Kenney, "Music Jingles": `HIT09` | CC0 |
| `sfx-pierde-ronda` | Kenney, "Music Jingles": `PIZZI01` | CC0 |
| `sfx-eliminado` | Kenney, "Music Jingles": `SAX07` | CC0 |
| `sfx-gana-partida` | Kenney, "Music Jingles": `SAX02` | CC0 |

Kenney (www.kenney.nl) no exige crédito, pero lo agradece: se puede nombrar en la pantalla de créditos.

Los cinco últimos conservan su OGG original (no se recodifica para no perder calidad) y su MP3 se sacó de ahí con PyAV; el volumen de cada uno se empareja en el mapa `VOLUME` de `src/app/audio.js`, no en el archivo.

Las alternativas para cambiar alguno están en `recursos-fv/sonidos-alternativos/` y `recursos-fv/sonidos-candidatos/` (mismas fuentes y licencia).

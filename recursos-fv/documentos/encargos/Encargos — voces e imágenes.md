# Encargos: voces e imágenes

> **Estado (2026-11-24):** hechos las voces de Alancito, Doña Buricia y Don Cucho (los pares se
> cantan "ciento diez", "ciento veinte"…), el fondo del menú y las reacciones. Falta Don Dago:
> sus dos grabaciones van en `recursos-fv/sonidos/voces/` como `4 Don Dago - jugadas.mp3` y
> `4 Don Dago - frases.mp3`, y se suman en `scripts/cortar-voces.py`. Falta también el ícono y
> la imagen para compartir.

Lo que falta crear para la siguiente tanda. Cuando lo tengas, déjalo en las carpetas indicadas y
Claude lo convierte y lo conecta (no hace falta renombrar a mano si sigues los nombres de abajo).

## 1. Los personajes

Ordenados por letra, igual que los avatares 1 a 4:

| # | Nombre | Quién es | Cómo habla |
| --- | --- | --- | --- |
| 1 | **Alancito** | Niño con la camiseta roja de fútbol | Pícaro, rápido, se ríe de todo, dice "causa" y "chato" |
| 2 | **Doña Buricia** | La abuelita | Dulce pero filuda, dice "hijito" y "mamita", te regaña con cariño |
| 3 | **Don Cucho** | Señor que sale de la chamba, todavía con su ropa de oficina | Cansado, sarcástico y medio dramático: "compadre" y "ya pues" |
| 4 | **Don Dago** (Dagoberto) | El camionero | Voz grave y fuerte, bonachón, habla como en la carretera |

## 2. Voces en ElevenLabs (Voice Design)

Una voz por personaje. Prompts para la descripción de la voz:

- **Alancito:** `Peruvian boy around 10 years old from Cusco, Andean Spanish accent, playful and cheeky, fast speech, bright and slightly nasal voice, laughs easily.`
- **Doña Buricia:** `Elderly Peruvian woman around 75 from Cusco, warm Andean Spanish accent with a soft Quechua lilt, sweet but teasing, slightly shaky voice, speaks slowly and with affection.`
- **Don Cucho:** `Peruvian man around 45 from Cusco, tired office worker after a long day, Andean Spanish accent, dry sarcastic tone, a bit dramatic, medium-low voice.`
- **Don Dago:** `Peruvian truck driver around 55 from Cusco, deep loud gravelly voice, Andean Spanish accent, jovial and booming, speaks like he's calling across a busy market.`

**Cómo grabar:** cada frase en un archivo aparte, con **2 tomas distintas** (a y b) para que no
suenen siempre igual. Exporta en WAV o MP3, como salga, y déjalos en `recursos-fv/Voces/`.

Nombre del archivo: `voz-<número del personaje>-<clave>-<toma>`. Ejemplos: `voz-1-51-a.wav`,
`voz-3-creo-b.wav`, `voz-2-quispe-a.wav`.

## 3. Qué dice cada personaje

Los cuatro graban todo, porque cualquier jugador puede tocarle cualquier personaje.

### Las jugadas (21 por personaje)

| Clave | Lo que dice |
| --- | --- |
| `31` `32` | "Treinta y uno", "Treinta y dos" |
| `41` `42` `43` | "Cuarenta y uno", "Cuarenta y dos", "Cuarenta y tres" |
| `51` `52` `53` `54` | "Cincuenta y uno" … "Cincuenta y cuatro" |
| `61` `62` `63` `64` `65` | "Sesenta y uno" … "Sesenta y cinco" |
| `110` … `160` | Los pares: **falta decidir cómo se dicen** (ver la pregunta abajo) |
| `quispe` | "¡Quispe!" (con ganas: es la jugada más alta) |

**Pregunta antes de grabar:** en la mesa de verdad, ¿cómo cantan los pares? ¿"Par de cincos",
"Ciento cincuenta" o de otra forma? Graba como se dice en Cusco y dime cuál es.

### Creer y desconfiar (por personaje, 2 tomas)

| Clave | Alancito | Doña Buricia | Don Cucho | Don Dago |
| --- | --- | --- | --- | --- |
| `creo` | "Ya, te creo, causa." | "Ya pues hijito, te creo." | "Ya, te creo… por esta vez." | "¡Te creo, compadre!" |
| `desconfio` | "¡Mentira! ¡Destapa!" | "Ay mamita… a ver, destapa." | "No te creo ni el saludo." | "¡Destapa nomás, oe!" |

### Remates de la ronda (por personaje, 2 tomas)

| Clave | Cuándo suena | Alancito | Doña Buricia | Don Cucho | Don Dago |
| --- | --- | --- | --- | --- | --- |
| `pille` | Pilló a un mentiroso | "¡Te descubrí, chato!" | "¡Atatau, mentiroso! A tu abuelita no la engañas." | "Compadre, se te nota en la cara." | "¡Te has quinceado, chato!" |
| `pierdo` | Perdió la ronda | "¡Nooo, causa!" | "¡Achachau! Me pillaron." | "Ya pues, como en la chamba." | "¡Me quinceé, carajo!" (o sin la lisura) |
| `cholada` | Hizo Cholada | "Uy, me equivoqué." | "Ay, estos ojos ya no ven, hijito." | "Necesito vacaciones." | "Me bajé en otro paradero." |
| `gano` | Ganó la partida | "¡Gané, gané, gané!" | "Así se juega, hijitos." | "Por fin algo me sale bien." | "¡Salud por el campeón!" |
| `fuera` | Quedó eliminado | "Ya fui, causa…" | "Me voy a mi cuartito." | "Me voy a dormir." | "Me voy a la carretera." |

Son ideas para arrancar: cámbialas a como se diga en tu mesa. Si una no te gusta, la sacamos.
Las risas que ya hay no se tocan hasta que tengas las nuevas.

## 4. Reacciones rápidas en línea

Una sola imagen con 4 stickers, que después se recortan:

> Sticker sheet, 2x2 grid on a plain flat light background, four separate round stickers with
> generous empty space between them. Style: Peruvian Ayacucho retablo folk art meets cartoon,
> thick black outlines (4 px), flat colors, cream base #F4EAD7 with burnt red #C23A2B, colonial
> blue #2F5D9E and gold #F2C230 accents, solid offset shadow, no gradients. 1) a face crying with
> laughter; 2) a hand pointing an accusing finger with the word "¡MENTIROSO!" in bold slab serif;
> 3) two glass beer mugs clinking with foam splashing; 4) a shocked face with huge eyes and open
> mouth. No other text, no watermark, each sticker centered in its quadrant, 2048x2048.

## 5. Fondo nuevo del menú

Simple, oscuro y con aire en el medio, para que los botones se lean:

> Calm night background for a game menu, an empty Cusco cantina wall seen head-on: dark warm adobe
> wall, a small wooden retablo-style shelf with a few clay cups, soft warm lamp glow from the top,
> papel picado bunting in red, blue and gold along the top edge, everything else dark and quiet.
> Large empty dark area in the center and lower half for buttons. Painterly cartoon style with thick
> black outlines, flat colors, low detail, low contrast, no people, no text, no logos, no brands.
> 16:9, 2560x1440.

Pide también la versión vertical (9:16, 1440x2560) con el mismo prompt: el celular usa esa.

## 6. Ícono y la imagen para compartir

No hace falta generarlos: Claude los puede armar con el logo y el fondo que ya hay (ícono de
512 px y la imagen de 1200x630 que sale al mandar el enlace por WhatsApp). Si prefieres uno a
medida, que sea el cubilete con los dos dados del logo, sin texto, sobre fondo transparente.

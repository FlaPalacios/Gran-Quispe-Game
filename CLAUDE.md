# Gran Quispe

Juego de dados y faroleo cusqueño (el Quispe tradicional) recreado como aplicación web. Proyecto personal de Fernando Cárdenas (Flavio): práctica de desarrollo, portafolio, jugar con amigos y, más adelante, donaciones. Se diferencia de la app "Quispe" existente por su identidad visual cusqueña (retablo ayacuchano, cantina nocturna), tres escenarios y un panel de reglas con variantes y bots.

## Reglas de trabajo

- **Nunca leer, abrir, analizar ni modificar nada dentro de `recursos-fv/ignorar/`.** Ignorarla por completo aunque parezca relevante. Está bloqueada en `.claude/settings.json` y en `.gitignore`.
- El documento fuente del plan es `recursos-fv/documentos/Gran Quispe — Plan de desarrollo.md` (su PDF tiene además los diagramas de arquitectura y de fases). Las respuestas del usuario registradas en este archivo tienen prioridad sobre el plan original. Si algo no está claro, preguntar.
- Responder y comentar en español. El código (nombres de variables, funciones, archivos) va en inglés.
- No inventar reglas del juego que no estén definidas aquí: preguntar (ver "Decisiones pendientes").
- Seguir el skill `codigo-limpio-quispe` al escribir o revisar código y el skill `identidad-visual` al tocar gráficos, colores o fuentes.

## Git

- Repositorio: https://github.com/FlaPalacios/Gran-Quispe-Game (rama `main`).
- Mensaje de commit: `GranQuispe-v0.<número de fase> <descripción corta en español>`. Ejemplo: `GranQuispe-v0.2 arte y sonido de la cantina`. Commits intermedios de una misma fase usan el mismo número.
- Antes de commitear: `npm test` y `npm run build` sin errores. Nunca se sube `recursos-fv/ignorar/` (está en `.gitignore`).

## Comandos

```bash
npm run dev        # servidor local de Vite (con --host para probar en el celular por la red local)
npm test           # tests del motor de reglas (Vitest)
npm run test:watch # tests en modo observación
npm run build      # build de producción en dist/
npm run preview    # sirve el build
npm run online     # modo online: compila y levanta el servidor en el puerto 3000 (juego + salas)
npm run server     # solo el servidor online, para desarrollar con npm run dev al lado (Vite le pasa las conexiones)
```

Con `npm run dev`, `http://localhost:5173/galeria.html` muestra qué assets faltan y cómo se ven (solo desarrollo, no entra al build). La lista vive en `src/dev/assetList.js` y la guía para crearlos en `recursos-fv/documentos/encargos/Fase 2 — Assets.md`.

Requiere Node 22.12 o superior.

## Stack

| Capa | Elección |
| --- | --- |
| Motor del juego | Vite 8 + Phaser 3.90 (JavaScript, módulos ES) |
| Capa de UI | HTML y CSS sobre el canvas: menú, configuración, "pásale el celular" y el HUD de la partida (panel de turno, tarjetas de jugadores, botones Creo / Desconfío) |
| Tests | Vitest, solo para `src/engine/` y `src/storage/` |
| Guardado | localStorage con marca de tiempo, expira a la hora |
| Backend | Solo para el modo online: `server/` (Node + Socket.IO), sin base de datos ni cuentas; las salas viven en memoria |
| Hosting | Render, plan gratis: https://gran-quispe.onrender.com (Blueprint `Gran-Quispe`, `render.yaml`); se publica solo en cada push a `main` |
| Modo online | Node.js + Socket.IO reutilizando `src/engine/`, `gameStore` y los bots sin reescribirlos. Corre en Render junto con el juego; en local, con `npm run online` |

## Arquitectura

El motor de reglas es la única fuente de verdad.

```
Capa de UI ──acciones y estado──▶ Motor de reglas ◀──jugadas── Gestor de bots
                                       │
                    ┌──── estado ──────┴──── guarda y carga ───┐
                    ▼                                          ▼
           Motor visual (Phaser) ◀── assets ── Gestor de assets     Guardado local
```

- `src/engine/` es código puro: sin Phaser, sin DOM, sin `localStorage`, sin `setTimeout`, sin `Math.random`. El azar (`rng`) y el tiempo (`now`) se inyectan.
- Transiciones `(estado, acción) => nuevoEstado`, estado en JSON plano serializable.
- UI, escenas y bots solo leen el estado o envían acciones.
- Phaser dibuja solo la escena (fondo, mesa, cubilete, dados, personajes). Todo lo que es texto, botón o tarjeta va en HTML, porque se adapta mejor al ancho de pantalla y es más accesible.

**API del motor (`src/engine/rules.js`):**

- `createGame({ config, players }, { rng })` crea el estado inicial. `config`: `mode` (`classic` | `lives` | `penalty`), `lives`, `penaltyText`, `variants` (se completa con `resolveVariants` de `variants.js`).
- `applyAction(state, action, { rng })` devuelve el nuevo estado. Acciones: `ROLL`, `CALL` (con `value`, y `asNumber: true` si el jugador escribió el número en el teclado: es el único campo de una acción que cambia una regla, así que en el modo online de la Fase 5 el servidor tendrá que decidir si se fía de él o guarda el modo de entrada en la configuración de la partida), `BELIEVE`, `DOUBT`, `TIMEOUT`, `SPY` (todas con `playerId`; `TIMEOUT` vale en las fases `CALL` y `DECIDE`, `SPY` solo en `DECIDE`) y `NEXT_ROUND`. Una acción inválida lanza `GameRuleError` con `code` (`NOT_YOUR_TURN`, `WRONG_PHASE`, `INVALID_CALL`, `UNKNOWN_ACTION`, `VARIANT_DISABLED`, `SPY_USED`).
- Fases: `ROLL` → `CALL` → `DECIDE` → (`ROLL` y luego `CALL` si cree) → `ROUND_OVER` → `NEXT_ROUND` → `ROLL`. Termina en `GAME_OVER` con `winnerId`.
- Resultados de ronda (`state.round.result`): `type` es `DOUBT`, `CHOLADA` o `BELIEVED_QUISPE`. Una Cholada trae `reason`: `LOWER_CALL`, `INVALID_NUMBER` o `TIMEOUT`. Todos traen `loserId`, `cost`, `revealed`, `dice`, `actual` y `penaltyText`. Si `revealed` es falso, `dice` y `actual` vienen en `null`.
- Consultas: `getLastCall`, `getActivePlayers`, `canSeeDice(state, playerId)`, `canSpy(state, playerId)`, `getSpiedDie(state, playerId)` (el dado del comodín de espía, o `null`) e `isFinalDuel(state)`. Si la ronda se perdió en duelo, el resultado trae `duel: true`. La UI muestra los dados solo si `canSeeDice` lo permite.

**Capa de aplicación (`src/app/gameStore.js`):** une el motor con la vista. Guarda el estado, aplica acciones con `Math.random`, guarda en localStorage y avisa a los suscritos (UI y escena). También lleva estado propio de la interfaz: `viewerId` (quién confirmó el pase), `turnStartedAt` (desde cuándo corre el reloj de presión) y `revealing` (el cubilete todavía se está levantando).

**El suspenso del destape (`revealing`):** al desconfiar no se muestra nada del resultado hasta que el cubilete termina de subir. Mientras dura: los dados no se dibujan (`viewerCanSeeDice` devuelve falso), el panel dice "Destapando…", no hay botones, la tarjeta de quien perdió se dibuja todavía sin el castigo y en la mesa se queda quien desconfió, con cara de nada. Al terminar aparecen a la vez los dados, el resultado, la cara de reacción y el sonido. El plazo es fijo, 2,2 s (`REVEAL_FALLBACK_MS` del store; `revealMs` permite cambiarlo). Textos visibles: `t('clave', params)` de `src/i18n/index.js`.

**Sonido (`src/app/audio.js` y `src/app/gameSounds.js`):** suena por **Web Audio**, porque un elemento `<audio>` tarda hasta medio segundo en arrancar en el celular y el golpe del cubilete tiene que caer a tiempo; los archivos se decodifican una vez y cada toque es un nodo nuevo. Si el navegador no trae Web Audio se usan elementos `<audio>`. `playSfx(clave)` con las claves de la tabla `SFX` (`shake`, `thud`, `click`, `start`, `believe`, `eliminated` y `cheer`), y silencio recordado en localStorage. Cada efecto se declara una sola vez en la tabla `SFX` de `audio.js`, con su archivo y su volumen: el volumen se empareja ahí, no en el archivo de audio. `connectGameSounds(store)` escucha los cambios de fase y la señal `gameStart` (solo al empezar una partida; continuar una guardada entra en silencio) y decide qué suena: es el único lugar donde se define eso, salvo el clic de los botones, que `src/ui/app.js` resuelve por delegación. Su tabla `STINGS` traduce el desenlace que da `reaction.js` en el único efecto que cierra una ronda: quedar fuera (`eliminated`) o ganar la partida (el brindis, `cheer`). Perder una ronda o hacer Cholada no tiene efecto: lo dice la voz del personaje. Flavio quitó las risas (también la de la Cholada) y los sonidos de destapar y de ganar; los archivos están en `recursos-fv/papelera/sonidos-quitados/`. No usa Phaser, porque el sonido también lo dispara la UI en HTML.

**Voces de los personajes (`playVoice` en `audio.js`):** cada personaje dice lo que canta su jugador (`'31'` … `'160'`, `'quispe'`), "creo" al creer, "desconfío" al desconfiar (mientras se levanta el cubilete) y una frase al terminar la ronda: `roundVoice()` de `reaction.js` dice quién habla y cuál (`pille` quien pilló al mentiroso, `pierdo`, `cholada`). Al quedar alguien fuera o terminar la partida no habla nadie (las frases `fuera` y `gano` están grabadas pero no se usan). Se apagan con la preferencia `voices` de Configuración, y entonces la partida no tiene ninguna voz. La frase entra cuando el cubilete ya se destapó. Archivos en `src/assets/audio/voces/voz-<personaje>-<clave>`, cortados con `recursos-fv/scripts/cortar-voces.py`; las voces de quienes juegan se cargan al empezar la partida. Hablan los cuatro: Alancito, Doña Buricia, Don Cucho y Don Dago.

**Música (`src/app/audio.js`):** dos pistas en bucle de la tabla `MUSIC` (`menu` en el menú, la configuración y la sala de espera; `game` en la partida), que `src/ui/app.js` elige con `setMusic` en cada redibujo. Va por un solo elemento `<audio>` y no por Web Audio, para no decodificar minutos de música en memoria. Se calla con el silencio general, con la preferencia `music` y con la pestaña en segundo plano; arranca en el primer toque, porque antes el navegador no deja sonar nada.

**Reacciones en línea (`src/ui/Reactions.js`):** un botón de la barra superior abre cuatro stickers (`reaccion-*.webp`). El servidor los reparte a toda la sala (`react` en `rooms.js`, uno cada 2 s por asiento, solo los de su lista `REACTIONS`) y cada celular los muestra un momento sobre la escena con el nombre de quien lo mandó.

**Acerca del juego (`src/ui/AboutScreen.js`):** desde el enlace bajo los botones del menú. El banner (`banner.webp`) con el logo encima, quién lo hizo, su contacto (`CONTACT_LINKS`: el Gmail, que sirve también para avisar de errores, y el Instagram, con sus íconos blancos) y los créditos en pantalla; el detalle archivo por archivo sigue en `recursos-fv/creditos.md`.

**Fundidos (`src/ui/FadeIn.js`):** un velo del color del fondo que se desvanece. Al empezar la partida (señal `gameStart`) dura 1 s; al aparecer la pantalla de pase, cambiar de jugador en ella o volver a la mesa, 0,3 s. `app.js` lo decide con una clave de "qué se ve" (`pase:<jugador>` o `mesa`), así que con bots o en línea, donde no hay pase, la mesa no parpadea en cada turno.

**Despliegue (`render.yaml`):** un solo servicio web gratis en Render que compila (`npm ci --include=dev && npm run build`) y arranca `node server/index.js`, con despliegue automático en cada push a `main`. El servidor está preparado para eso: comprime en gzip el JS y el CSS (una vez por archivo; Phaser baja de 1,2 MB a ~320 KB), guarda en caché del navegador para siempre lo de `assets/` (lleva hash) y nunca `index.html`, responde por rangos (Safari los pide para la música) y cambia `__SITE_URL__` de `index.html` por la dirección real, para la vista previa al compartir (`public/compartir.jpg`, 1200x630, armada por `recortar-logo.py`). En el plan gratis el servicio se apaga tras 15 min sin uso y tarda cerca de un minuto en despertar; las partidas en curso lo mantienen despierto.

**Menú, nueva partida y Configuración:** el menú tiene su propio fondo en CSS (`menu-fondo-vertical` en celular y `-horizontal` en PC), con la lámpara y la repisa arriba y el logo y los botones apoyados abajo. el botón Jugar abre un panel corto (jugadores, modo y escenario). Las variantes de reglas y las preferencias de pantalla y sonido van aparte, en Configuración desde el menú: lo elegido se guarda (`preferences.js`, clave `variants`) y vale para las partidas siguientes, también al crear una sala online. La nueva partida nombra al pie qué reglas extra están puestas. "Cómo se juega" (`src/ui/HowToPlay.js`) explica lo esencial en cuatro tarjetas. En la partida, el HUD muestra lo cantado en la ronda (desde la segunda jugada) en una tira encima del panel de turno.

**Personajes (`src/app/characters.js`):** reparte un personaje por jugador según su posición en la lista. Lo usan la tarjeta HTML (avatar) y la escena (personaje grande), para que siempre muestren a la misma persona. Si hay más jugadores que personajes, se repiten.

Cada personaje tiene tres caras (`POSES`): `neutral`, `caught` (`-descubierto`: la cara de haber perdido la ronda, lo hayan pillado mintiendo o no) y `gloating` (`-descubre`: pilló al mentiroso, o ganó la partida). Las tres están recortadas con la misma escala y el mismo encuadre (`recursos-fv/scripts/recortar-personajes.py`), así que cambiar de cara no mueve al personaje. Las dos de reacción no entran en la carga inicial: se piden al empezar la partida y solo para los personajes que juegan; si todavía no llegaron, se usa la neutral.

**Mesa, cubilete y dados (`src/scenes/shared/props.js`):** son imágenes, no dibujo por código: la mesa de paño verde, las tres poses del cubilete (`cubilete-tapado`, `-inclinado` para mirar los dados a escondidas y `-volcado` para el destape) y los seis dados. Si alguna falta, la escena dibuja su versión vectorial de respaldo y se sigue jugando. `tableProps(area)` da las medidas: dónde cae el paño dentro de la mesa, dónde se apoya el cubilete y dónde quedan los dados. Esas fracciones salen del recorte, así que si cambia el dibujo de la mesa hay que correr `recursos-fv/scripts/recortar-objetos.py` y copiar los números que imprime. Las tres poses del cubilete comparten lienzo y punto de apoyo (el borde de abajo al centro), por eso cambiar de pose es cambiar de imagen y el cubilete no se mueve de sitio.

**Bots (`src/engine/bots.js` y `src/app/botPlayer.js`):** el motor decide, la app pone el ritmo. `botAction(state, { rng })` es puro y devuelve la acción del bot en turno según su personalidad (`PERSONALITIES`: `honest` miente poco, `bluffer` miente mucho y sube más al mentir, `suspicious` desconfía más). Canta lo que sacó si alcanza y no le toca mentir; desconfía más cuanto más alta es la jugada, y casi siempre de un Quispe. No usa el comodín de espía. `connectBots(store)` espera un poco en cada turno de bot (sacude el cubilete con la señal `cupShake` antes de tirar) y despacha su acción; si no queda ningún humano en pie, también pasa a la ronda siguiente. El turno de un bot no pide pasar el celular (`needsPassScreen` es falso) y el HUD no muestra botones, solo qué está haciendo. Sus dados nunca se ven: `canSeeDice` exige que el que mira sea quien tiró.

**Reacción al terminar la ronda (`src/app/reaction.js`):** `roundReaction(game)` devuelve quién se queda en pantalla, con qué cara y qué remate suena. Lo usan la escena y los sonidos, para que la cara y el sonido no puedan contar cosas distintas.

**Modo online (`server/` y `src/app/online.js`):** el servidor es quien manda. `server/rooms.js` lleva las salas (código de 4 letras sin I ni O): quien la crea la configura con el mismo panel, y los asientos de "Persona" que no son el suyo los ocupa quien entra con el código. Cada sala juega con un `createGameStore({ autoViewer: true })` y `connectBots`, igual que el celular, y a cada asiento le manda solo `viewFor(estado, asiento)`: los dados viajan únicamente a quien puede verlos. Valida que cada uno juegue solo por su asiento, lleva el reloj de presión y, si alguien se desconecta, le guarda el asiento 60 s y después juega por él un bot honesto hasta que vuelva (con el token guardado en `localSave`, también tras recargar). Si sale a propósito con "Salir", el bot entra de inmediato. A todos les llega quién está desconectado (`presence`): el HUD lo avisa arriba del panel de turno y a su nombre se le suma "(bot)" mientras juega el suplente. Una partida empezada no admite gente nueva: solo vuelve quien ya jugaba, entrando con el código (desde el mismo celular, con su token; desde otro, con su mismo nombre). En el celular, `createOnline(store)` conecta y pone el store en modo remoto (`useRemote`): las acciones van al servidor, el estado llega por `receive` (con el destape, sonidos y escena de siempre) y no hay pantalla de pase; mientras juega otro, el HUD solo muestra qué está haciendo. `server/index.js` sirve además `dist/`, así que con `npm run online` se juega desde `http://<IP de la laptop>:3000`.

**Depurar en el navegador:** en `npm run dev`, `window.__game` (Phaser) y `window.__store` están disponibles en la consola.

## Referencia visual y diseño responsivo

- **Wireframe de referencia:** `recursos-fv/referencias/Gran Quispe-wiireframe.png` (menú principal, mesa de juego, configuración). Es una **referencia de estilo, no una especificación exacta**: se toma la dirección de arte (fondo de rayos de sol ámbar y naranja, mesa con marco de madera tipo retablo, banderines, tarjetas crema con contorno negro, botones grandes rojo y azul, letras QUISPE en las tarjetas de jugador), pero los modos, variantes y textos del juego son los de este archivo.
- Lo que en el wireframe **no aplica** porque viene de otro juego de dados: modos "Rápido / Torneo", variantes "Ases comodín / Calzar / Apuesta ciega" y la jugada cantada "3 cuatros" (en Quispe se canta un número, por ejemplo "42").
- **Responsivo obligatorio:** debe verse bien tanto en celular (angosto, vertical) como en PC (más ancho, horizontal). No basta con escalar la versión de celular con franjas a los costados.
  - **Una columna** (pantalla vertical): escena arriba con las tarjetas de jugador superpuestas debajo de la barra, y la zona de juego abajo con su propio panel de madera. **Por debajo de 780 px de alto las tarjetas se pliegan** en una barra que se abre al tocarla, y ese sitio se lo queda la zona de juego (pasa del 33 % al 42 % del alto): en un celular bajo pesa más poder cantar cómodo que ver las letras de todos a la vez. `getLayout` lo marca en `players.folded` y `stage.js` lo publica como `data-jugadores`.
  - **Dos columnas** (1024 px o más en horizontal, y también el teléfono en horizontal, que es ancho y bajo): marco centrado de 1440 px como máximo y proporción 16:10, con los costados mostrando el fondo desenfocado. Escena a la izquierda y columna derecha con tarjetas arriba y zona de juego debajo.
  - El tamaño del contenido no depende del modo sino del sitio que haya: `stage.js` publica `data-tarjetas` y `data-juego` (`amplia` o `compacta`) y el CSS encoge tipografías y controles cuando la fila o el panel vienen justos. Si aun así no cabe, la zona se desplaza en vez de recortar el texto.
  - Phaser corre en modo `RESIZE`: el canvas ocupa toda la ventana, pero **cada escena dibuja dentro del rectángulo de su zona**, no contra la ventana.

**Zonas de la pantalla de partida.** `getLayout(width, height, { insets, playerCount })` de `src/scenes/shared/layout.js` es la única fuente de verdad de la geometría. Devuelve `frame` (el marco; fuera no hay nada interactivo), `topBar`, `scene` (fondo, mesa, cubilete y personaje), `players` y `play`, cada una `{x, y, width, height}` en píxeles de ventana. `scene.contentTop` marca el borde superior útil dentro de la escena: en celular queda por debajo de las tarjetas superpuestas.

`src/app/stage.js` la llama y reparte el resultado a las dos capas: la escena se suscribe con `stage.subscribe(fn)` y el HUD en HTML lee las variables CSS que publica (`--zona-<zona>-x/y/w/h`, más `--zona-players-columnas`, `--zona-players-fila` y `--zona-players-gap`) y los atributos `data-modo`, `data-tarjetas` y `data-juego` de `:root`. **El CSS no recalcula geometría ni duplica el breakpoint**: todo sale de `layout.js`. Las zonas respetan `env(safe-area-inset-*)`, medidas en `src/app/safeArea.js`; dentro de las zonas el relleno es fijo, porque el marco ya descontó esos márgenes.

El alto de fila de las tarjetas que reserva `getLayout` tiene que seguir alcanzando para el contenido real de `.player` en `src/ui/styles.css` (avatar, nombre y las 6 letras), incluido su borde de 3 px. Si se cambia una, hay que comprobar la otra en el navegador.

## Estructura de carpetas

La raíz del repositorio equivale a la carpeta `gran-quispe/` del plan.

```
src/
  main.js              # arranque: crea el store, monta la UI, espera las fuentes y crea Phaser
  engine/              # motor de reglas + tests
    constants.js       # fases, tipos de resultado y motivos de Cholada
    dice.js            # lectura de dados y escala de jugadas
    rules.js           # máquina de estados: createGame, applyAction, consultas
    modes.js           # Clásico, Por vidas, Castigo personalizado
    variants.js        # registro de variantes, costo de perder y destape
    bots.js            # personalidades de bots y su decisión en cada turno
  app/                 # puente motor ↔ vista
    gameStore.js       # estado, azar real, guardado, suscripciones
    stage.js           # zonas de la pantalla: las publica como variables CSS y avisa a la escena
    safeArea.js        # mide las zonas seguras del teléfono
    audio.js           # efectos de sonido y silencio
    gameSounds.js      # qué suena en cada cambio de fase
    characters.js      # qué personaje le toca a cada jugador, y sus caras
    reaction.js        # quién reacciona al terminar la ronda, con qué cara y qué sonido
    botPlayer.js       # juega solo el turno de los bots, con pausas para que se vea
    online.js          # conexión con el servidor del modo online
    preferences.js     # silencio y siluetas, guardados entre partidas
  scenes/              # CantinaScene: la mesa en los tres escenarios (cambia el fondo según config.scenario; personajes solo en la cantina)
    shared/            # layout.js (responsivo), theme.js (colores y fuentes), props.js (mesa, cubilete, dados), assets.js (carga)
  dev/                 # galería de assets (solo desarrollo)
  ui/                  # app.js (enrutador), MainMenu, RulesPanel, PassDeviceScreen, GameHud, styles.css
    CallKeypad.js      # teclado para cantar (por defecto); CallSheet es la lista completa
    PressureClock.js   # el reloj, compartido por el panel de turno y el teclado
    FadeIn.js          # fundido desde negro: lento al empezar la partida, rápido al pasar el celular
    HowToPlay.js       # "Cómo se juega": lo esencial en pocas líneas
    AboutScreen.js     # "Acerca del juego": banner, autor, redes y créditos
    Reactions.js       # stickers del modo online
    OnlineScreens.js   # unirse o crear una sala, y la sala de espera
  assets/
    images/{cantina,bar,andino,shared}/
    audio/
    fonts/
  storage/localSave.js # único punto que toca localStorage (partida, ajustes y asiento online)
server/
  index.js             # servidor HTTP (sirve dist/) + Socket.IO
  rooms.js             # salas online: asientos, estado filtrado por jugador, reloj y desconexiones
  i18n/                # index.js con t(); es.json (en.json y qu.json para la Fase 5)
.claude/
  agents/              # game-logic, phaser-scenes, code-reviewer
  skills/              # identidad-visual, codigo-limpio-quispe
recursos-fv/           # material de origen (la subcarpeta ignorar/ no se toca)
  creditos.md          # origen y licencia de cada asset
  documentos/          # el plan original (md y pdf) y, en encargos/, las guías y pedidos de assets
  graficos/            # originales: logo, escenarios (y fondos del menú), objetos, personajes, reacciones, png-originales
  sonidos/             # originales: efectos-grabados, musica y voces de los personajes
  referencias/         # wireframe, plantillas de escenario y bocetos de pantalla
  scripts/             # convertir sonidos y música, cortar voces, recortar personajes, objetos y reacciones
  papelera/            # lo que ya no se usa (sonidos reemplazados, capturas viejas)
```

## Subagentes y skills

| Nombre | Tipo | Cuándo usarlo |
| --- | --- | --- |
| `game-logic` | Subagente, solo `src/engine/` | Al tocar reglas, modos, variantes o bots |
| `phaser-scenes` | Subagente, solo `src/scenes/` | Al crear o ajustar escenas, animaciones, cubilete y dados |
| `code-reviewer` | Subagente, solo lectura | Antes de dar por cerrada cualquier tarea de código |

Para cambios simples no hace falta pasar por los subagentes (pedido de Flavio, 2026-11-23): se usan cuando el cambio es grande o delicado.
| `identidad-visual` | Skill | Al crear o integrar gráficos, colores o fuentes |
| `codigo-limpio-quispe` | Skill | Al escribir o revisar cualquier código |

## Reglas del juego

Se juega con un cubilete y dos dados.

**Lectura de la jugada:** el dado mayor va primero (un 4 y un 2 es 42, nunca 24).

**Escala de menor a mayor:**

1. Jugadas comunes: 31, 32, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65.
2. Pares: 11 = 110, 22 = 120, 33 = 130, 44 = 140, 55 = 150, 66 = 160.
3. **Quispe** (2 y 1): supera todo, incluido el 160.

**Desarrollo de una ronda:**

1. La primera ronda la abre un jugador elegido al azar. Quien abre sacude el cubilete (botón Tirar: se mantiene presionado o se toca varias veces y al soltar caen los dados), lo levanta a medias para mirar sus dados en secreto y canta una jugada (puede mentir). Al abrir, la jugada cantada parte de cero: cualquier jugada es válida.
2. El siguiente jugador en el orden de giro decide:
   - **Cree:** recibe el cubilete, **vuelve a tirar**, mira sus dados en secreto y debe cantar una jugada **estrictamente más alta** que la anterior (puede mentir). Luego lo pasa al siguiente, que vuelve a decidir. (Decidido el 2026-10-21; antes recibía el cubilete a ciegas sin tirar.)
   - **Desconfía:** se destapa el cubilete y se compara la jugada real (los dados de la última tirada) con la última cantada. Si son **exactamente la misma**, pierde quien desconfió. Si no, pierde quien cantó: haber sacado más también es mentir. (Decidido el 2026-10-24; antes se salvaba quien cantaba si sacaba igual o más.)
3. **Cholada** (una equivocación; en pantalla: "¡Cholada!", con un subtítulo cuando el motivo lo tiene). Pierde la ronda sin destapar, costando 1, quien:
   - cree y canta una jugada igual o más baja que la anterior (sin subtítulo);
   - canta un número que no existe en la escala, por ejemplo 66, 161 o 24 ("Esa jugada no existe"). Escrito en el teclado, el 21 tampoco existe: el Quispe se canta con su botón, no diciendo "veintiuno";
   - con el reloj de presión activo, no canta o no decide a tiempo ("Se acabó tu tiempo").
4. **Creer un Quispe** cuesta 1 y pierde la ronda sin destapar, porque después no hay nada más alto que cantar, aunque el Quispe fuera mentira. **No es Cholada**: no es una equivocación, así que en pantalla sale "Creíste el Quispe" y no el cartel de Cholada (y no se dice si era cierto, porque nadie lo vio) (decidido el 2026-10-25). Es su propio resultado, `BELIEVED_QUISPE`, y la variante "Destapar en Cholada" no lo destapa.
5. Quien pierde recibe el castigo del modo y **abre la ronda siguiente**, con la jugada cantada otra vez en cero. Si quedó eliminado, abre el siguiente jugador activo en el orden de giro.

**Modos:**

- Clásico QUISPE: cada ronda perdida suma una letra de Q-U-I-S-P-E. Quien completa la palabra queda eliminado.
- Por vidas: cada jugador empieza con un número configurable de vidas (por defecto 3, de 1 a 10).
- Castigo personalizado: como el clásico, pero cada ronda perdida muestra un texto libre definido al configurar la partida.

**Variantes (activables en el panel):**

- Quispe vale más (activa por defecto; antes "vale doble" en el plan): cuando alguien canta Quispe y el siguiente desconfía, si de verdad era Quispe pierde **2** quien desconfió; si era mentira pierde **3** quien cantó. Creer un Quispe sigue costando 1.
- Destapar en Cholada (desactivada por defecto): en una Cholada se muestran los dados a todos.
- Reloj de presión (desactivado por defecto): tiempo límite para cantar y para decidir si se cree o se desconfía (15 segundos por defecto, de 5 a 60). Si se acaba, es Cholada. El plazo para decidir empieza cuando el jugador confirma la pantalla de pase; el de cantar, cuando los dados ya cayeron. Mientras se sacude el cubilete no corre.
- Comodín de espía (desactivado por defecto): una vez por partida, cada jugador puede ver uno de los dos dados del cubilete que recibe antes de decidir. Se muestra el primero de la tirada (el orden ya es azar) y deja de valer en cuanto alguien vuelve a tirar.
- Duelo final (opcional, desactivado por defecto): con dos jugadores restantes, la partida pasa a muerte súbita y la siguiente ronda perdida elimina, sin importar letras o vidas restantes. La barra superior lo avisa en lugar del nombre del modo.
- Bots: personalidades que mienten y desconfían con distinto criterio, sumables a cualquier partida.

## Entidades de datos

| Entidad | Campos clave |
| --- | --- |
| Jugador | nombre, avatar o inicial, letras QUISPE acumuladas o vidas restantes, esBot, personalidad (si es bot), comodín de espía usado |
| Partida | modo, variantes activas, escenario, lista de jugadores, turno actual, orden de giro, quién abre la ronda |
| Ronda | dados reales, jugada cantada, historial de lo dicho, quién tiró, resultado (creyó / desconfió / cholada, perdedor) |
| Configuración de reglas | modo elegido, variantes on/off con sus parámetros, número de jugadores, texto de castigo, idioma |

## Alcance del MVP

**Funcional:** modo "un solo celular" con pantalla "pásale el celular"; panel de configuración (modo, variantes, 2 a 8 jugadores, escenario, texto de castigo) y preferencias de pantalla que no son reglas y valen para todas las partidas (`src/app/preferences.js`: silencio, personajes en sombra y teclado simple para cantar); bots con personalidad configurable; guardado local de la partida en curso que expira a la hora.

**Idioma:** por ahora solo español. Todo texto visible sale de `src/i18n/es.json` desde el inicio, para sumar inglés y términos en quechua más adelante sin tocar código. El selector de idioma del wireframe queda oculto hasta entonces.

**No funcional:** responsivo para celular y PC (ver "Referencia visual y diseño responsivo"); sin cuentas, backend ni base de datos; contraste legible y áreas táctiles de al menos 44 px; motor de reglas separado de la vista desde el día uno.

## Plan de desarrollo

Cada fase deja algo jugable o probable antes de pasar a la siguiente. Marcar las casillas al completar.

### Fase -1: Entorno (completada el 2026-10-20)

- [x] Proyecto Vite + Phaser 3 + Vitest, estructura de carpetas, escena placeholder
- [x] Tokens de color y tipografía en `src/ui/styles.css`
- [x] Subagentes y skills de Claude Code
- [x] Bloqueo de `recursos-fv/ignorar/`
- [x] Canvas en modo `RESIZE` con layout responsivo base (`src/scenes/shared/layout.js`)
- [x] Fuente de títulos Fraunces (Black, eje soft) en lugar de Luckiest Guy

### Fase 0: Motor de reglas (completada el 2026-10-20, 46 tests, revisada por `code-reviewer`)

Máquina de estados en código puro, probada sin interfaz.

- [x] Lectura y comparación de jugadas (escala completa y Quispe) con tests
- [x] Estado de partida y ronda; acciones tirar, cantar, creer, desconfiar
- [x] Resolución al desconfiar (solo se salva quien cantó exactamente lo que sacó), Cholada y creer un Quispe
- [x] Castigo al perdedor y nueva ronda abierta por el perdedor con la jugada en cero
- [x] Modos Clásico QUISPE, Por vidas y Castigo personalizado
- [x] Eliminación de jugadores, orden de giro y fin de partida

### Fase 1: Mesa jugable mínima (completada el 2026-10-20, 71 tests, probada en navegador a 390 px y 1536 px, revisada por `code-reviewer`)

Un escenario placeholder, local en un solo celular, con pantalla de pase.

- [x] Conectar escena y UI al motor (`src/app/gameStore.js`)
- [x] Pantalla "pásale el celular" obligatoria entre turnos
- [x] HUD en HTML: panel de turno, tarjetas de jugadores, Creo / Desconfío, hoja para elegir la jugada
- [x] Mesa, cubilete y dados vectoriales con animación de agitar y levantar
- [x] Distribución responsiva celular y PC probada en ambos anchos
- [x] Guardado local con expiración de 1 hora y "Continuar partida" en el menú
- [x] Textos desde `src/i18n/es.json`
- [x] Adelantado de la Fase 3: variantes Quispe vale más, Destapar en Cholada y Reloj de presión, con sus interruptores en el panel

Pendientes menores detectados:
- [x] Texto crema sobre rojo (letras perdidas) quedaba en 4,47:1 de contraste: las letras usan un rojo un punto más oscuro (4,68:1).

### Fase 2: Arte y sonido de la cantina (completada el 2026-10-21, 73 tests, probada en navegador a 390 px y 1536 px, revisada por `code-reviewer`)

Assets creados por Flavio (ChatGPT para los gráficos, Kenney para los sonidos); origen y licencias en `recursos-fv/creditos.md`.

- [x] Menú principal con el logo sobre la cantina (celular y PC)
- [x] Fondo ilustrado de la cantina
- [x] Mesa de paño verde, cubilete con tres poses y dados ilustrados, con respaldo vectorial
- [x] Personajes: gente cotidiana del Cusco sobre el fondo pintado (estilo A)
- [x] Mesa en primera persona: solo se ve al jugador en turno, sentado al otro lado; los demás van con su avatar en las tarjetas. Ilustrado a color por defecto, o en silueta con la opción "Personajes en sombra" del panel
- [x] Avatares reales en las tarjetas de jugador
- [x] Efectos de sonido (agitar, golpe, destapar, cholada, botón) con botón de silencio
- [x] Sonidos de cada desenlace: creer, pillar a un mentiroso, perder la ronda, quedar eliminado y ganar la partida
- [x] Voces y ambiente grabados por Flavio: empezar la partida, destapar, la risa de la Cholada, tres risas al pillar a un mentiroso, el brindis, ganar y quedar eliminado
- [x] Caras de reacción de los personajes al terminar la ronda (descubierto y descubre)
- [x] Teclado para cantar, con el Quispe aparte (late cuando de verdad lo tienes) y "cantar lo que salió"
- [x] Suspenso al destapar: el resultado espera a que el cubilete termine de subir
- [x] Entrada en túnel al empezar la partida, con el sonido de la cerveza
- [x] Imágenes en WebP: 2 MB menos de descarga (los PNG quedan en `recursos-fv/graficos/png-originales/`)
- [x] Música de menú y de partida en bucle, con su interruptor en Configuración (hechas por Flavio con Suno y ElevenLabs)

### Fase 3: Escenarios y panel de reglas completos

- [x] Bar y valle andino (sin personajes), con selector de escenario en la configuración (`config.scenario`: `cantina`, `bar` o `andino`)
- [x] Registro de variantes y panel de configuración generado desde él (celular y PC)
- [x] Variantes que faltan, con tests: Comodín de espía y Duelo final

### Fase 4: Bots

- [x] Personalidades que mienten y desconfían con distinto criterio (honesto, farolero, desconfiado)
- [x] Bots sumables a cualquier partida, con turno automático (en la configuración, cada asiento elige Persona o un bot)

### Fase 5: Después del MVP

- [x] Pantalla "Cómo se juega", historial de lo cantado en la ronda y Configuración aparte del panel de nueva partida
- [x] Voces de Alancito, Doña Buricia y Don Cucho: jugadas, creer, desconfiar y frases de fin de ronda (ElevenLabs)
- [x] Voces de Don Dago
- [x] Pantalla "Acerca del juego" con el banner y los créditos (faltan las redes de Flavio)
- [x] Fondo nuevo del menú y reacciones rápidas en línea
- [x] Favicon (el cubilete del logo) y logo sólido bajo la lámpara del menú
- [x] Imagen para compartir el enlace, fundidos al pasar el celular, mesa y dados más grandes, contacto en Acerca del juego
- [x] Publicado en Render (2026-11-24) y enlace "Dejar una reseña" al pie del menú, hacia un formulario de Google (`REVIEW_FORM_URL` en `MainMenu.js`)
- [ ] Inglés y términos en quechua, con selector de idioma
- [x] Modo online: servidor Node + WebSockets reutilizando `src/engine/`, cada jugador desde su celular (en Render)

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Nombre "Quispe" ya usado en Play Store | Se usa "Gran Quispe" |
| Ver los dados del anterior al pasar el celular | Pantalla "pásale el celular" obligatoria |
| Contenido de alcohol en el modo castigo | El castigo es texto libre editable, no identidad fija del juego |
| Mezclar lógica y vista | Motor aislado en `src/engine/`, revisado por `code-reviewer` |
| Diseño pensado solo para celular | Layout con breakpoint de escritorio desde la Fase 1 |
| Marcas reales dentro del arte | El fondo de la cantina muestra "Cusqueña" (cerveza de Backus) y el personaje 1 lleva la camiseta del Cienciano. Para portafolio privado no hay problema, pero antes de publicarlo o de aceptar donaciones conviene reemplazarlos por nombres inventados con el mismo aire (por ejemplo "Cusqueñita", o una camiseta roja sin escudo) |

## Decisiones pendientes

Preguntar al usuario antes de implementar lo que dependa de estos puntos. Al resolverse, moverlos a la sección de reglas correspondiente.

Ninguna por ahora. Resuelto el 2026-11-23: el Duelo final vale también en una partida de 2 jugadores desde la primera ronda (toda la partida es a muerte súbita). Resueltas el 2026-10-20: "Quispe vale más" queda como variante apagable, encendida por defecto; en el Duelo final cualquier derrota elimina y el costo extra del Quispe no cambia nada.

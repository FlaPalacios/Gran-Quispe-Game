# Gran Quispe

Juego de dados y faroleo cusqueño (el Quispe tradicional) recreado como aplicación web. Proyecto personal de Fernando Cárdenas (Flavio): práctica de desarrollo, portafolio, jugar con amigos y, más adelante, donaciones. Se diferencia de la app "Quispe" existente por su identidad visual cusqueña (retablo ayacuchano, cantina nocturna), tres escenarios y un panel de reglas con variantes y bots.

## Reglas de trabajo

- **Nunca leer, abrir, analizar ni modificar nada dentro de `recursos-fv/ignorar/`.** Ignorarla por completo aunque parezca relevante. Está bloqueada en `.claude/settings.json` y en `.gitignore`.
- El documento fuente del plan es `recursos-fv/Gran Quispe — Plan de desarrollo.md` (su PDF tiene además los diagramas de arquitectura y de fases). Las respuestas del usuario registradas en este archivo tienen prioridad sobre el plan original. Si algo no está claro, preguntar.
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
```

Con `npm run dev`, `http://localhost:5173/galeria.html` muestra qué assets faltan y cómo se ven (solo desarrollo, no entra al build). La lista vive en `src/dev/assetList.js` y la guía para crearlos en `recursos-fv/Fase 2 — Assets.md`.

Requiere Node 22.12 o superior.

## Stack

| Capa | Elección |
| --- | --- |
| Motor del juego | Vite 8 + Phaser 3.90 (JavaScript, módulos ES) |
| Capa de UI | HTML y CSS sobre el canvas: menú, configuración, "pásale el celular" y el HUD de la partida (panel de turno, tarjetas de jugadores, botones Creo / Desconfío) |
| Tests | Vitest, solo para `src/engine/` y `src/storage/` |
| Guardado | localStorage con marca de tiempo, expira a la hora |
| Backend, base de datos, autenticación | Ninguno en el MVP |
| Hosting | Diferido (primero funcional en local). Luego un hosting estático gratuito |
| A futuro (modo online) | Node.js + WebSockets (Socket.IO) reutilizando `src/engine/` sin reescribirlo |

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
- `applyAction(state, action, { rng })` devuelve el nuevo estado. Acciones: `ROLL`, `CALL` (con `value`), `BELIEVE`, `DOUBT`, `TIMEOUT` (todas con `playerId`) y `NEXT_ROUND`. Una acción inválida lanza `GameRuleError` con `code` (`NOT_YOUR_TURN`, `WRONG_PHASE`, `INVALID_CALL`, `UNKNOWN_ACTION`, `VARIANT_DISABLED`).
- Fases: `ROLL` → `CALL` → `DECIDE` → (`CALL` si cree) → `ROUND_OVER` → `NEXT_ROUND` → `ROLL`. Termina en `GAME_OVER` con `winnerId`.
- Resultados de ronda (`state.round.result`): `type` es `DOUBT` o `CHOLADA`. Una Cholada trae `reason`: `LOWER_CALL`, `BELIEVED_QUISPE` o `TIMEOUT`. Todos traen `loserId`, `cost`, `revealed`, `dice`, `actual` y `penaltyText`. Si `revealed` es falso, `dice` y `actual` vienen en `null`.
- Consultas: `getLastCall`, `getActivePlayers`, `canSeeDice(state, playerId)`. La UI muestra los dados solo si `canSeeDice` lo permite.

**Capa de aplicación (`src/app/gameStore.js`):** une el motor con la vista. Guarda el estado, aplica acciones con `Math.random`, guarda en localStorage y avisa a los suscritos (UI y escena). También lleva estado propio de la interfaz: `viewerId` (quién confirmó el pase) y `turnStartedAt` (desde cuándo corre el reloj de presión). Textos visibles: `t('clave', params)` de `src/i18n/index.js`.

**Sonido (`src/app/audio.js` y `src/app/gameSounds.js`):** `playSfx('shake' | 'thud' | 'reveal' | 'cholada' | 'click')`, con silencio recordado en localStorage. `connectGameSounds(store)` escucha los cambios de fase y decide qué suena: es el único lugar donde se define eso, salvo el clic de los botones, que `src/ui/app.js` resuelve por delegación. No usa Phaser, porque el sonido también lo dispara la UI en HTML.

**Personajes (`src/app/characters.js`):** reparte un personaje por jugador según su posición en la lista. Lo usan la tarjeta HTML (avatar) y la escena (personaje grande), para que siempre muestren a la misma persona. Si hay más jugadores que personajes, se repiten.

**Depurar en el navegador:** en `npm run dev`, `window.__game` (Phaser) y `window.__store` están disponibles en la consola.

## Referencia visual y diseño responsivo

- **Wireframe de referencia:** `recursos-fv/referencias/Gran Quispe-wiireframe.png` (menú principal, mesa de juego, configuración). Es una **referencia de estilo, no una especificación exacta**: se toma la dirección de arte (fondo de rayos de sol ámbar y naranja, mesa con marco de madera tipo retablo, banderines, tarjetas crema con contorno negro, botones grandes rojo y azul, letras QUISPE en las tarjetas de jugador), pero los modos, variantes y textos del juego son los de este archivo.
- Lo que en el wireframe **no aplica** porque viene de otro juego de dados: modos "Rápido / Torneo", variantes "Ases comodín / Calzar / Apuesta ciega" y la jugada cantada "3 cuatros" (en Quispe se canta un número, por ejemplo "42").
- **Responsivo obligatorio:** debe verse bien tanto en celular (angosto, vertical) como en PC (más ancho, horizontal). No basta con escalar la versión de celular con franjas a los costados.
  - **Celular** (menos de 1024 px de ancho o pantalla vertical): una columna como en el wireframe. Mesa arriba, panel "Tu turno", tarjetas de jugadores (hasta 8, en dos filas de 4) y botones abajo.
  - **PC** (1024 px o más, en horizontal): mesa grande a la izquierda y una columna derecha con panel de turno, jugadores y botones. Menú y configuración en dos columnas, con ancho máximo para que no se estiren de más.
  - El breakpoint vive en `src/scenes/shared/layout.js` (`DESKTOP_MIN_WIDTH`) y en la media query de `src/ui/styles.css`. Mantener ambos sincronizados.
  - Phaser corre en modo `RESIZE`: el canvas ocupa toda la ventana y cada escena se redibuja en el evento `resize`.

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
    bots.js            # personalidades de bots (Fase 4)
  app/                 # puente motor ↔ vista
    gameStore.js       # estado, azar real, guardado, suscripciones
    audio.js           # efectos de sonido y silencio
    gameSounds.js      # qué suena en cada cambio de fase
    characters.js      # qué personaje le toca a cada jugador
  scenes/              # CantinaScene, BarScene, AndinoScene
    shared/            # layout.js (responsivo), theme.js (colores y fuentes), props.js (mesa, cubilete, dados), assets.js (carga)
  dev/                 # galería de assets (solo desarrollo)
  ui/                  # app.js (enrutador), MainMenu, RulesPanel, PassDeviceScreen, GameHud, styles.css
  assets/
    images/{cantina,bar,andino,shared}/
    audio/
    fonts/
  storage/localSave.js # único punto que toca localStorage
  i18n/                # index.js con t(); es.json (en.json y qu.json para la Fase 5)
.claude/
  agents/              # game-logic, phaser-scenes, code-reviewer
  skills/              # identidad-visual, codigo-limpio-quispe
recursos-fv/           # plan y referencias (la subcarpeta ignorar/ no se toca)
```

## Subagentes y skills

| Nombre | Tipo | Cuándo usarlo |
| --- | --- | --- |
| `game-logic` | Subagente, solo `src/engine/` | Al tocar reglas, modos, variantes o bots |
| `phaser-scenes` | Subagente, solo `src/scenes/` | Al crear o ajustar escenas, animaciones, cubilete y dados |
| `code-reviewer` | Subagente, solo lectura | Antes de dar por cerrada cualquier tarea de código |
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

1. La primera ronda la abre un jugador elegido al azar. Quien abre agita el cubilete, mira sus dados en secreto y canta una jugada (puede mentir). Al abrir, la jugada cantada parte de cero: cualquier jugada es válida.
2. El siguiente jugador en el orden de giro decide:
   - **Cree:** recibe el cubilete **a ciegas** (no ve los dados, no vuelve a tirar) y debe cantar una jugada **estrictamente más alta** que la anterior. Luego lo pasa al siguiente, que vuelve a decidir. Los dados no cambian durante toda la ronda.
   - **Desconfía:** se destapa el cubilete y se compara la jugada real con la última cantada. Si la real es **igual o mayor**, pierde quien desconfió. Si es menor, pierde quien cantó.
3. **Cholada** (una equivocación; en pantalla: "¡Cholada!" con un subtítulo según el motivo). Pierde la ronda sin destapar, costando 1, quien:
   - cree y canta una jugada igual o más baja que la anterior ("Te has quinceao");
   - cree un Quispe, porque no hay nada más alto que cantar, aunque no fuera cierto ("Nada le gana al Quispe");
   - con el reloj de presión activo, no decide a tiempo ("Se acabó tu tiempo").
4. Si alguien canta 65, desconfían y los dados eran 2 y 1, aplica la regla normal: pierde quien desconfió y cuesta 1 (el costo extra va ligado a cantar Quispe).
5. Quien pierde recibe el castigo del modo y **abre la ronda siguiente**, con la jugada cantada otra vez en cero. Si quedó eliminado, abre el siguiente jugador activo en el orden de giro.

**Modos:**

- Clásico QUISPE: cada ronda perdida suma una letra de Q-U-I-S-P-E. Quien completa la palabra queda eliminado.
- Por vidas: cada jugador empieza con un número configurable de vidas (por defecto 3, de 1 a 10).
- Castigo personalizado: como el clásico, pero cada ronda perdida muestra un texto libre definido al configurar la partida.

**Variantes (activables en el panel):**

- Quispe vale más (activa por defecto; antes "vale doble" en el plan): cuando alguien canta Quispe y el siguiente desconfía, si de verdad era Quispe pierde **2** quien desconfió; si era mentira pierde **3** quien cantó. Creer un Quispe sigue costando 1.
- Destapar en Cholada (desactivada por defecto): en una Cholada se muestran los dados a todos.
- Reloj de presión (desactivado por defecto): tiempo límite para decidir si se cree o se desconfía (15 segundos por defecto, de 5 a 60). Si se acaba, es Cholada. El plazo empieza cuando el jugador confirma la pantalla de pase.
- Comodín de espía: una vez por partida, cada jugador puede ver uno de los dos dados del cubilete que recibe antes de decidir.
- Duelo final (opcional, desactivado por defecto): con dos jugadores restantes, la partida pasa a muerte súbita y la siguiente ronda perdida elimina, sin importar letras o vidas restantes.
- Bots: personalidades que mienten y desconfían con distinto criterio, sumables a cualquier partida.

## Entidades de datos

| Entidad | Campos clave |
| --- | --- |
| Jugador | nombre, avatar o inicial, letras QUISPE acumuladas o vidas restantes, esBot, personalidad (si es bot), comodín de espía usado |
| Partida | modo, variantes activas, escenario, lista de jugadores, turno actual, orden de giro, quién abre la ronda |
| Ronda | dados reales, jugada cantada, historial de lo dicho, quién tiró, resultado (creyó / desconfió / cholada, perdedor) |
| Configuración de reglas | modo elegido, variantes on/off con sus parámetros, número de jugadores, texto de castigo, idioma |

## Alcance del MVP

**Funcional:** modo "un solo celular" con pantalla "pásale el celular"; panel de configuración (modo, variantes, 2 a 8 jugadores, escenario, texto de castigo); bots con personalidad configurable; guardado local de la partida en curso que expira a la hora.

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
- [x] Resolución al desconfiar (igual o mayor gana quien cantó), Cholada y creer un Quispe
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
- Con 8 jugadores en celulares bajos, la segunda fila de tarjetas necesita desplazarse.
- En iPhone con muesca, la barra superior no reserva la zona segura en el cálculo de la mesa.
- Texto crema sobre rojo (etiqueta "Juego de dados", letras perdidas) queda en 4,48:1 de contraste, apenas bajo 4,5.

### Fase 2: Arte y sonido de la cantina (completada el 2026-10-21, 73 tests, probada en navegador a 390 px y 1536 px, revisada por `code-reviewer`)

Assets creados por Flavio (ChatGPT para los gráficos, Kenney para los sonidos); origen y licencias en `recursos-fv/creditos.md`.

- [x] Menú principal con el logo sobre la cantina (celular y PC)
- [x] Fondo ilustrado de la cantina, mesa redonda, cubilete y dados
- [x] Personajes: gente cotidiana del Cusco sobre el fondo pintado (estilo A)
- [x] Mesa en primera persona: solo se ve al jugador en turno, sentado al otro lado; los demás van con su avatar en las tarjetas. Ilustrado a color por defecto, o en silueta con la opción "Personajes en sombra" del panel
- [x] Avatares reales en las tarjetas de jugador
- [x] Efectos de sonido (agitar, golpe, destapar, cholada, botón) con botón de silencio
- [x] Imágenes en WebP: 2 MB menos de descarga (los PNG quedan en `recursos-fv/graficos/png-originales/`)
- [ ] Música: la compone Flavio en FL Studio (`musica-cantina.ogg`)

### Fase 3: Escenarios y panel de reglas completos

- [ ] Bar universitario y paisaje andino (sin personajes), con selector de escenario
- [x] Registro de variantes y panel de configuración generado desde él (celular y PC)
- [ ] Variantes que faltan, con tests: Comodín de espía y Duelo final

### Fase 4: Bots

- [ ] Personalidades que mienten y desconfían con distinto criterio
- [ ] Bots sumables a cualquier partida, con turno automático

### Fase 5: Después del MVP

- [ ] Inglés y términos en quechua, con selector de idioma
- [ ] Modo online: servidor Node + WebSockets reutilizando `src/engine/`, cada jugador desde su celular

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

Ninguna por ahora. Resueltas el 2026-10-20: "Quispe vale más" queda como variante apagable, encendida por defecto; en el Duelo final cualquier derrota elimina y el costo extra del Quispe no cambia nada.

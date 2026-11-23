// Enrutador de la capa HTML: menú → configuración → partida.
import { playSfx } from '../app/audio.js';
import { needsPassScreen } from '../app/gameStore.js';
import { getPreference } from '../app/preferences.js';
import { loadGame } from '../storage/localSave.js';
import { CallKeypad } from './CallKeypad.js';
import { CallSheet, GameHud } from './GameHud.js';
import { PlayIntro } from './PlayIntro.js';
import { stopClock } from './PressureClock.js';
import { MainMenu } from './MainMenu.js';
import { PassDeviceScreen } from './PassDeviceScreen.js';
import { RulesPanel, defaultDraft } from './RulesPanel.js';

export function mountApp(root, store, stage) {
  let screen = 'menu';
  let draft = defaultDraft();
  let callSheetOpen = false;
  let foldPlayers = Boolean(stage?.get()?.players.folded);
  // La lista plegada vive aquí y no en el HUD: si no, cada aviso del store la cerraría
  let playersOpen = false;

  store.subscribe(() => {
    callSheetOpen = false;
    render();
  });

  // Entrada al empezar una partida: la pantalla se abre como un túnel mientras suena la
  // cerveza. Va fuera de root porque redibujar lo borraría a media animación.
  store.onSignal((name) => name === 'gameStart' && document.body.append(PlayIntro()));

  // Que las tarjetas se plieguen o no cambia el HTML, no solo su tamaño. Se redibuja solo
  // cuando eso cambia: en cada resize sería tirar el número a medio escribir en el teclado.
  stage?.subscribe((layout) => {
    if (!layout || layout.players.folded === foldPlayers) return;
    foldPlayers = layout.players.folded;
    // Con el teclado abierto no se redibuja: se perdería el número a medio escribir. En el
    // celular basta con que se esconda la barra de direcciones para cruzar el umbral.
    if (!callSheetOpen) render();
  });

  // Un solo punto para el clic de todos los botones, en vez de repetirlo en cada componente.
  // El botón Tirar no: ya suena el cubilete al sacudir
  root.addEventListener('click', (e) => {
    if (e.target.closest('button:not(.btn--hold)')) playSfx('click');
  });

  function render() {
    stopClock();
    const snapshot = store.get();
    if (snapshot.game) {
      root.replaceChildren(...gameView(snapshot));
    } else if (screen === 'setup') {
      root.replaceChildren(
        RulesPanel({
          draft,
          onBack: () => go('menu'),
          onStart: (setup) => store.start(setup),
        }),
      );
    } else {
      const saved = loadGame();
      root.replaceChildren(
        MainMenu({
          canContinue: Boolean(saved),
          onContinue: () => store.resume(saved),
          onPlay: () => go('setup'),
          onRefresh: render,
        }),
      );
    }
    // Redibujar borra el foco: se lleva al elemento principal de la pantalla nueva
    root.querySelector('[data-autofocus]')?.focus();
  }

  function gameView(snapshot) {
    const { game } = snapshot;
    // Mientras se pasa el celular no se dibuja el HUD: ni el reloj corre ni se ve nada del turno
    if (needsPassScreen(snapshot)) {
      const current = game.players.find((p) => p.id === game.currentPlayerId);
      return [PassDeviceScreen({ name: current.name, onReady: () => store.confirmViewer(current.id) })];
    }
    const hud = GameHud({
      snapshot,
      store,
      callSheetOpen,
      foldPlayers,
      playersOpen,
      onTogglePlayers: (open) => (playersOpen = open),
      onExit: () => go('menu', () => store.leave()),
      onOpenCalls: () => {
        callSheetOpen = true;
        render();
      },
      onPlayAgain: () =>
        store.start({
          config: game.config,
          players: game.players.map(({ id, name, isBot, personality }) => ({ id, name, isBot, personality })),
        }),
      onMenu: () => go('menu', () => store.abandon()),
      onRefresh: render,
    });
    if (!callSheetOpen) return [hud];
    // Por defecto se canta con el teclado; quien prefiera la lista completa la activa en la
    // configuración. Las dos avisan igual: el valor cantado y cómo se cantó.
    const CallInput = getPreference('simpleKeypad') ? CallKeypad : CallSheet;
    return [
      hud,
      CallInput({
        snapshot,
        store,
        onPick: (value, options) =>
          store.dispatch({ type: 'CALL', playerId: game.currentPlayerId, value, ...options }),
        onCancel: () => {
          callSheetOpen = false;
          render();
        },
      }),
    ];
  }

  function go(next, action) {
    screen = next;
    if (action) action(); // notifica al store, que vuelve a dibujar
    else render();
  }

  render();
}

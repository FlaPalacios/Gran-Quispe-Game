// Enrutador de la capa HTML: menú → configuración → partida.
import { playSfx } from '../app/audio.js';
import { needsPassScreen } from '../app/gameStore.js';
import { loadGame } from '../storage/localSave.js';
import { CallSheet, GameHud, stopClock } from './GameHud.js';
import { MainMenu } from './MainMenu.js';
import { PassDeviceScreen } from './PassDeviceScreen.js';
import { RulesPanel, defaultDraft } from './RulesPanel.js';

export function mountApp(root, store) {
  let screen = 'menu';
  let draft = defaultDraft();
  let callSheetOpen = false;

  store.subscribe(() => {
    callSheetOpen = false;
    render();
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
    return [
      hud,
      CallSheet({
        onPick: (value) => store.dispatch({ type: 'CALL', playerId: game.currentPlayerId, value }),
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

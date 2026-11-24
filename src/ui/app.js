// Enrutador de la capa HTML: menú → configuración → partida.
import { playSfx, setMusic } from '../app/audio.js';
import { needsPassScreen } from '../app/gameStore.js';
import { createOnline } from '../app/online.js';
import { getPreference } from '../app/preferences.js';
import { t } from '../i18n/index.js';
import { loadGame } from '../storage/localSave.js';
import { CallKeypad } from './CallKeypad.js';
import { CallSheet, GameHud } from './GameHud.js';
import { AboutScreen } from './AboutScreen.js';
import { HowToPlay } from './HowToPlay.js';
import { PlayIntro } from './PlayIntro.js';
import { stopClock } from './PressureClock.js';
import { MainMenu } from './MainMenu.js';
import { Lobby, OnlineMenu } from './OnlineScreens.js';
import { PassDeviceScreen } from './PassDeviceScreen.js';
import { showReaction } from './Reactions.js';
import { RulesPanel, defaultDraft } from './RulesPanel.js';

export function mountApp(root, store, stage) {
  let screen = 'menu';
  let draft = defaultDraft();
  let callSheetOpen = false;
  let foldPlayers = Boolean(stage?.get()?.players.folded);
  // La lista plegada y el selector de stickers viven aquí y no en el HUD: si no, cada aviso
  // del store los cerraría
  let playersOpen = false;
  let reactionsOpen = false;

  // Modo online: lo escrito en la pantalla de entrar, si la configuración crea una sala y
  // cómo está la sala de espera
  const onlineForm = { name: '', code: '', error: null, busy: false };
  let creatingRoom = false;
  let lobby = null;
  const online = createOnline(store, {
    onLobby: (next) => {
      lobby = next;
      if (!next.started) screen = 'lobby';
      if (!store.get().game) render();
    },
    onReaction: ({ playerId, reaction }) => {
      const name = store.get().game?.players.find((p) => p.id === playerId)?.name;
      if (name) showReaction({ name, reaction });
    },
    onLost: (code) => {
      lobby = null;
      onlineForm.error = code;
      screen = 'online';
      render();
    },
  });
  // Si ya está en una sala (por ejemplo, falló Empezar), el error se muestra ahí mismo
  const failOnline = (error) => {
    onlineForm.error = error.message;
    if (!lobby) screen = 'online';
    render();
  };
  // Un pedido a la vez: un doble toque no crea dos salas ni ocupa dos asientos
  const request = (fn) => {
    if (onlineForm.busy) return;
    onlineForm.busy = true;
    onlineForm.error = null;
    render();
    fn()
      .catch(failOnline)
      .finally(() => {
        onlineForm.busy = false;
        render();
      });
  };
  const isHost = () => Boolean(lobby?.seats.some((s) => s.host && s.id === lobby.you));
  const leaveRoom = (next = 'menu') => {
    online.leave();
    lobby = null;
    go(next);
  };

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
    setMusic(snapshot.game ? 'game' : 'menu');
    if (snapshot.game) {
      root.replaceChildren(...gameView(snapshot));
    } else if (screen === 'lobby' && lobby) {
      root.replaceChildren(
        Lobby({ lobby, error: onlineForm.error, onLeave: () => leaveRoom('online'), onStart: () => request(online.start) }),
      );
    } else if (screen === 'online') {
      root.replaceChildren(
        OnlineMenu({
          form: onlineForm,
          onBack: () => go('menu'),
          onCreate: () => {
            creatingRoom = true;
            go('setup');
          },
          onJoin: () => request(() => online.join(onlineForm.code.trim(), onlineForm.name.trim())),
        }),
      );
    } else if (screen === 'howto') {
      root.replaceChildren(HowToPlay({ onBack: () => go('menu'), onPlay: startSetup }));
    } else if (screen === 'about') {
      root.replaceChildren(AboutScreen({ onBack: () => go('menu') }));
    } else if (screen === 'settings') {
      root.replaceChildren(RulesPanel({ draft, settings: true, onBack: () => go('menu') }));
    } else if (screen === 'setup') {
      root.replaceChildren(
        RulesPanel({
          draft,
          onBack: () => go(creatingRoom ? 'online' : 'menu'),
          startLabel: creatingRoom ? t('online.create') : undefined,
          // En línea, los asientos de persona que no son el tuyo los ocupa quien entre con el código
          onStart: (setup) =>
            creatingRoom
              ? request(() => online.create(setup, setup.players.find((p) => !p.isBot)?.name))
              : store.start(setup),
        }),
      );
    } else {
      const saved = loadGame();
      root.replaceChildren(
        MainMenu({
          canContinue: Boolean(saved),
          onContinue: () => store.resume(saved),
          onPlay: startSetup,
          onOnline: () => go('online'),
          onHowTo: () => go('howto'),
          onSettings: () => go('settings'),
          onAbout: () => go('about'),
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
      reactions: snapshot.online && {
        open: reactionsOpen,
        onToggle: (open) => (reactionsOpen = open),
        onPick: (reaction) => {
          online.react(reaction);
          reactionsOpen = false;
          render();
        },
      },
      // En línea, salir deja la sala: el asiento se guarda un minuto y luego juega un bot
      onExit: () => (snapshot.online ? leaveRoom() : go('menu', () => store.leave())),
      onOpenCalls: () => {
        callSheetOpen = true;
        render();
      },
      onPlayAgain: snapshot.online
        ? isHost() && (() => online.start().catch(() => {}))
        : () =>
            store.start({
              config: game.config,
              players: game.players.map(({ id, name, isBot, personality }) => ({ id, name, isBot, personality })),
            }),
      onMenu: () => (snapshot.online ? leaveRoom() : go('menu', () => store.abandon())),
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

  function startSetup() {
    creatingRoom = false;
    go('setup');
  }

  function go(next, action) {
    screen = next;
    if (action) action(); // notifica al store, que vuelve a dibujar
    else render();
  }

  render();
  // Si se cerró o recargó la página en medio de una partida online, se vuelve a esa sala
  online.resume();
}

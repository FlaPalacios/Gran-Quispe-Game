// Enrutador de la capa HTML: menú → configuración → partida.
import { playSfx, setMusic } from '../app/audio.js';
import { needsPassScreen } from '../app/gameStore.js';
import { momentSounds } from '../app/gameSounds.js';
import { momentViewer, roundMoment } from '../app/moment.js';
import { createOnline } from '../app/online.js';
import { getPreference } from '../app/preferences.js';
import { loadGame } from '../storage/localSave.js';
import { CallKeypad } from './CallKeypad.js';
import { CallSheet, GameHud } from './GameHud.js';
import { AboutScreen } from './AboutScreen.js';
import { HowToPlay } from './HowToPlay.js';
import { FadeIn } from './FadeIn.js';
import { showRoundMoment } from './RoundMoment.js';
import { stopClock } from './PressureClock.js';
import { MainMenu } from './MainMenu.js';
import { Lobby, OnlineMenu } from './OnlineScreens.js';
import { PassDeviceScreen } from './PassDeviceScreen.js';
import { showReaction } from './Reactions.js';
import { RulesPanel, defaultDraft, draftToSetup } from './RulesPanel.js';

export function mountApp(root, store, stage) {
  let screen = 'menu';
  let draft = defaultDraft();
  let callSheetOpen = false;
  let foldPlayers = Boolean(stage?.get()?.players.folded);
  // La lista plegada y el selector de stickers viven aquí y no en el HUD: si no, cada aviso
  // del store los cerraría
  let playersOpen = false;
  let reactionsOpen = false;

  // Modo online: lo escrito en la pantalla de entrar y cómo está la sala de espera
  const onlineForm = { name: '', code: '', error: null, busy: false };
  let lobby = null;
  // El castigo que escribe quien creó la sala: vive aquí para que un aviso de la sala (alguien
  // que entra) no lo borre a medio escribir. Se manda al servidor al tocar Empezar.
  const lobbyDraft = { penaltyText: null };
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
      lobbyDraft.penaltyText = null;
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
    lobbyDraft.penaltyText = null;
    go(next);
  };

  store.subscribe((snapshot) => {
    callSheetOpen = false;
    followMoment(snapshot);
    render();
  });

  // El momento del final de ronda sale cuando el resultado se hace visible: al terminar de
  // subir el cubilete o, sin destape, al instante. No al retomar una partida ya terminada en
  // esa ronda, y se cierra solo si la partida sigue antes de que termine.
  let lastSnapshot = null;
  let moment = null;
  const resultShown = (s) => Boolean(s?.game?.round.result) && !s.revealing;
  function followMoment(snapshot) {
    const before = lastSnapshot;
    lastSnapshot = snapshot;
    if (!resultShown(snapshot)) {
      moment?.close();
      moment = null;
      return;
    }
    if (!before?.game || resultShown(before)) return;
    moment?.close();
    const { game } = snapshot;
    moment = showRoundMoment(roundMoment(game, momentViewer(snapshot)), game.config.mode, momentSounds(game));
  }

  // Fundidos desde negro. Van fuera de root porque redibujar los borraría a media animación.
  // Al empezar la partida, lento, mientras suena la cerveza; al pasar el celular (y al volver
  // a la mesa tras la pantalla de pase), rápido. Con bots o en línea no hay pase, así que la
  // mesa no parpadea en cada turno.
  store.onSignal((name) => name === 'gameStart' && document.body.append(FadeIn({ slow: true })));
  let passKey = null;
  const fadeOnPass = (key) => {
    if (passKey !== null && key !== passKey) document.body.append(FadeIn());
    passKey = key;
  };

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
    if (!snapshot.game) passKey = null;
    if (snapshot.game) {
      root.replaceChildren(...gameView(snapshot));
    } else if (screen === 'lobby' && lobby) {
      root.replaceChildren(
        Lobby({
          lobby,
          busy: onlineForm.busy,
          error: onlineForm.error,
          onLeave: () => leaveRoom('online'),
          draft: lobbyDraft,
          onStart: () =>
            request(async () => {
              const text = lobbyDraft.penaltyText?.trim();
              if (text != null && text !== (lobby.config.penaltyText ?? '')) {
                await online.configure({ ...lobby.config, penaltyText: text });
              }
              return online.start();
            }),
          onConfigure: (config) => request(() => online.configure(config)),
          onAddBot: (personality, name) => request(() => online.addBot(personality, name)),
          onRemove: (seatId) => request(() => online.removeSeat(seatId)),
        }),
      );
    } else if (screen === 'online') {
      root.replaceChildren(
        OnlineMenu({
          form: onlineForm,
          onBack: () => go('menu'),
          // La sala se crea al toque con tus reglas de siempre (modo, escenario y las variantes
          // de Configuración); dentro se cambian y se suman los bots
          onCreate: () => request(() => online.create(onlineForm.name.trim(), draftToSetup(draft).config)),
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
        RulesPanel({ draft, onBack: () => go('menu'), onStart: (setup) => store.start(setup) }),
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
    const passing = needsPassScreen(snapshot);
    fadeOnPass(passing ? `pase:${game.currentPlayerId}` : 'mesa');
    // Mientras se pasa el celular no se dibuja el HUD: ni el reloj corre ni se ve nada del turno
    if (passing) {
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

  const startSetup = () => go('setup');

  function go(next, action) {
    screen = next;
    if (action) action(); // notifica al store, que vuelve a dibujar
    else render();
  }

  render();
  // Si se cerró o recargó la página en medio de una partida online, se vuelve a esa sala
  online.resume();
}

import Phaser from 'phaser';
import { characterIndexFor, portraitKey } from '../app/characters.js';
import { needsPassScreen } from '../app/gameStore.js';
import { getPreference } from '../app/preferences.js';
import { PHASES, canSeeDice } from '../engine/rules.js';
import { KEYS, preloadCantina } from './shared/assets.js';
import { getLayout } from './shared/layout.js';
import { drawCup, drawDie, drawRoundTable, drawSoftShadow, drawSunburst } from './shared/props.js';
import { COLORS } from './shared/theme.js';

const DEPTHS = { background: -30, dim: -20, shadow: -12, character: -10, table: 0, dice: 10, cup: 20 };

// Escenario principal: cantina nocturna cusqueña
export class CantinaScene extends Phaser.Scene {
  constructor() {
    super('CantinaScene');
  }

  preload() {
    preloadCantina(this);
  }

  create() {
    this.store = this.registry.get('store');

    // Respaldo vectorial por si el fondo ilustrado no está disponible
    this.fallback = this.add.graphics().setDepth(DEPTHS.background);
    this.background = this.textures.exists(KEYS.cantinaBackground)
      ? this.add.image(0, 0, KEYS.cantinaBackground).setOrigin(0.5).setDepth(DEPTHS.background)
      : null;
    // Oscurece el fondo para que la interfaz y la mesa se lean bien
    this.dim = this.add.rectangle(0, 0, 10, 10, COLORS.fondo).setOrigin(0).setDepth(DEPTHS.dim);
    // Penumbra de los costados cuando la ventana es más ancha que el escenario
    this.letterbox = this.add.graphics().setDepth(DEPTHS.dim);

    this.characterShadow = this.add.graphics().setDepth(DEPTHS.shadow);
    this.character = this.add.image(0, 0).setOrigin(0.5, 1).setVisible(false).setDepth(DEPTHS.character);
    this.table = this.add.graphics().setDepth(DEPTHS.table);
    this.cup = this.add.container().setDepth(DEPTHS.cup);
    this.cupGraphics = this.add.graphics();
    this.cup.add(this.cupGraphics);
    this.dice = [this.add.graphics().setDepth(DEPTHS.dice), this.add.graphics().setDepth(DEPTHS.dice)];
    this.lastPhase = null;

    this.layoutScene();
    this.scale.on('resize', this.layoutScene, this);
    const unsubscribe = this.store.subscribe((snapshot) => this.sync(snapshot));
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layoutScene, this);
      unsubscribe();
    });
  }

  // Recalcula todo con las medidas actuales (al iniciar y en cada resize)
  layoutScene() {
    const { width, height } = this.scale.gameSize;
    const { table, stage } = getLayout(width, height);
    this.area = table;

    if (this.background) {
      // Recorte tipo "cover" dentro del escenario, anclado abajo: el piso queda siempre
      // a la misma altura que la mesa, en vez de subir y bajar según la pantalla
      const texture = this.textures.get(KEYS.cantinaBackground).getSourceImage();
      const scale = Math.max(stage.width / texture.width, stage.height / texture.height);
      this.background.setOrigin(0.5, 1).setPosition(stage.x + stage.width / 2, stage.height).setScale(scale);
    } else {
      drawSunburst(this.fallback.clear(), width, height);
    }
    this.dim.setPosition(stage.x, 0).setSize(stage.width, height);

    // Costados fuera del escenario
    const bars = this.letterbox.clear();
    if (stage.x > 0) {
      bars.fillStyle(COLORS.fondo, 1);
      bars.fillRect(0, 0, stage.x, height);
      bars.fillRect(stage.x + stage.width, 0, stage.x + 1, height);
    }

    this.felt = drawRoundTable(this.table.clear(), table);

    const cupHeight = Math.min(this.felt.height * 1.05, this.felt.width * 0.26);
    drawCup(this.cupGraphics.clear(), cupHeight * 0.85, cupHeight);
    this.cupHeight = cupHeight;
    this.dieSize = cupHeight * 0.45;
    // Tapado al centro de la mesa; destapado se corre a un lado, sin taparle la cara a nadie
    this.cupRest = { x: this.felt.x, y: this.felt.y + this.felt.height * 0.12 };
    this.cupAside = { x: this.felt.x + this.felt.width * 0.26, y: this.cupRest.y - this.felt.height * 0.08 };

    this.sync(this.store.get(), { animate: false });
  }

  sync(snapshot, { animate = true } = {}) {
    const { game, viewerId } = snapshot;
    const inGame = Boolean(game);
    // Cortar animaciones antes que nada: una animación viva podría volver a mostrar los dados
    this.tweens.killTweensOf(this.cup);
    this.table.setVisible(inGame);
    this.cup.setVisible(inGame);
    this.dice.forEach((d) => d.setVisible(false));
    // El menú se ve más oscuro que la mesa, para que el logo resalte
    this.dim.setFillStyle(COLORS.fondo, inGame ? 0.35 : 0.72);
    this.showCharacter(game);

    if (!inGame) {
      this.lastPhase = null;
      return;
    }

    const showDice = canSeeDice(game, viewerId) && !needsPassScreen(snapshot);
    const justRolled = this.lastPhase === PHASES.ROLL && game.phase === PHASES.CALL;
    this.lastPhase = game.phase;

    this.cup.setPosition(this.cupRest.x, this.cupRest.y).setAngle(0);
    this.drawDice(game.round.dice);

    if (animate && justRolled) {
      this.tweens.chain({
        targets: this.cup,
        tweens: [
          { angle: { from: -10, to: 10 }, duration: 90, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' },
          { angle: 0, duration: 60 },
          {
            ...this.cupAside,
            angle: -14,
            duration: 320,
            ease: 'Back.easeOut',
            onStart: () => this.revealDice(),
          },
        ],
      });
      return;
    }

    this.dice.forEach((d) => d.setVisible(showDice));
    if (!showDice) return;
    if (animate) {
      this.tweens.add({ targets: this.cup, ...this.cupAside, angle: -14, duration: 320, ease: 'Back.easeOut' });
    } else {
      this.cup.setPosition(this.cupAside.x, this.cupAside.y).setAngle(-14);
    }
  }

  // Los dados se redibujan siempre que haya tirada, nunca solo se ocultan:
  // así no puede quedar dibujada la jugada de una ronda anterior.
  drawDice(dice) {
    if (!dice) {
      this.dice.forEach((d) => d.clear());
      return;
    }
    const gap = this.dieSize * 0.75;
    dice.forEach((value, i) => {
      const die = this.dice[i];
      drawDie(die.clear(), this.dieSize, value);
      die
        .setPosition(this.felt.x - this.felt.width * 0.1 + (i === 0 ? -gap : gap), this.cupRest.y + this.dieSize * 0.1)
        .setAngle(i === 0 ? -8 : 10);
    });
  }

  // Se consulta de nuevo al destapar, por si el estado cambió durante el agitado
  revealDice() {
    const snapshot = this.store.get();
    const visible = Boolean(snapshot.game) && canSeeDice(snapshot.game, snapshot.viewerId) && !needsPassScreen(snapshot);
    if (visible) this.drawDice(snapshot.game.round.dice);
    this.dice.forEach((d) => d.setVisible(visible));
  }

  // Muestra al jugador en turno sentado al otro lado de la mesa.
  // Al terminar la ronda se queda quien perdió, y al terminar la partida quien ganó.
  showCharacter(game) {
    const index = this.characterSlot(game);
    const key = index >= 0 ? portraitKey(characterIndexFor(index)) : null;
    if (!key || !this.textures.exists(key)) {
      this.hideCharacter();
      return;
    }

    const texture = this.textures.get(key).getSourceImage();
    // Cabe entre el techo del área de juego y el borde lejano de la mesa
    const feet = this.felt.y - this.felt.height * 0.1;
    const scale = Math.min((feet - this.area.y) / texture.height, (this.area.width * 0.45) / texture.width);
    // A un costado, para que el cubilete nunca le tape la cara
    const x = this.felt.x - this.felt.width * 0.24;
    this.character.setTexture(key).setScale(scale).setPosition(x, feet).setVisible(true);

    // Sombra a sus pies, para que se apoye en el piso en vez de flotar
    const shadowWidth = texture.width * scale * 0.7;
    drawSoftShadow(this.characterShadow.clear(), x, feet, shadowWidth, shadowWidth * 0.26, { alpha: 0.5 });

    // Preferencia del jugador: en sombra se ve solo la silueta, sin revelar el detalle del personaje
    if (getPreference('silhouettes')) this.character.setTintFill(COLORS.borde);
    else this.character.clearTint();
  }

  hideCharacter() {
    this.character.setVisible(false);
    this.characterShadow.clear();
  }

  characterSlot(game) {
    if (!game) return -1;
    if (game.currentPlayerId) return game.players.findIndex((p) => p.id === game.currentPlayerId);
    if (game.winnerId) return game.players.findIndex((p) => p.id === game.winnerId);
    const loserId = game.round.result?.loserId;
    return loserId ? game.players.findIndex((p) => p.id === loserId) : -1;
  }
}

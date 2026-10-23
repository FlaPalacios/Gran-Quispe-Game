import Phaser from 'phaser';
import { characterIndexFor, portraitKey } from '../app/characters.js';
import { needsPassScreen, viewerCanSeeDice } from '../app/gameStore.js';
import { getPreference } from '../app/preferences.js';
import { roundReaction } from '../app/reaction.js';
import { PHASES } from '../engine/rules.js';
import { KEYS, preloadCantina, queuePortraitPoses } from './shared/assets.js';
import { coverImage, drawCup, drawDie, drawRoundTable, drawSoftShadow, drawSunburst } from './shared/props.js';
import { COLORS, OUTLINE_WIDTH } from './shared/theme.js';

// Escenario principal: cantina nocturna cusqueña.
// Dibuja únicamente dentro de la zona `scene` que publica src/app/stage.js; lo que queda
// fuera del marco es zona muerta (el mismo fondo, desenfocado y apagado).

const DEPTHS = {
  backdrop: -60, // fondo de la ventana completa
  backdropDim: -50,
  background: -40, // fondo recortado a la zona de la escena
  sceneDim: -30,
  shadow: -20,
  character: -10, // detrás de la mesa: ella le tapa la cintura
  table: 0,
  cup: 20,
  dice: 25, // delante del cubilete: al levantarlo a medias asoman por la abertura
  edge: 30,
};

// Destapado del todo al terminar la ronda: el cubilete se corre a un lado e inclinado
const ASIDE_ANGLE = -14;

// Fuera del marco no pasa nada, así que el fondo se apaga casi por completo
const BACKDROP_DIM = 0.8;
// Oscurecido del escenario: suave en partida (para leer el HUD), fuerte en el menú (para el logo)
const DIM = { game: 0.32, menu: 0.66 };
// Parte del personaje que asoma por encima del borde lejano de la mesa
const CHARACTER_ABOVE_TABLE = 0.56;
// Ancho del personaje respecto al ancho de la mesa: queda siempre a escala con ella
const CHARACTER_WIDTH = 0.52;
// Si no cabe ni esto (pantalla baja con ocho tarjetas), es mejor no dibujarlo que dejar un muñequito
const CHARACTER_MIN_HEIGHT = 96;

// Rectángulo agrandado un porcentaje por cada lado
const bleed = (area, ratio) => ({
  x: area.x - area.width * ratio,
  y: area.y - area.height * ratio,
  width: area.width * (1 + ratio * 2),
  height: area.height * (1 + ratio * 2),
});

export class CantinaScene extends Phaser.Scene {
  constructor() {
    super('CantinaScene');
  }

  preload() {
    preloadCantina(this);
  }

  create() {
    this.store = this.registry.get('store');
    this.stage = this.registry.get('stage');
    const hasBackground = this.textures.exists(KEYS.cantinaBackground);

    // Respaldo vectorial por si el fondo ilustrado no está disponible
    this.fallback = this.add.graphics().setDepth(DEPTHS.backdrop);

    // Zona muerta: el mismo fondo cubriendo toda la ventana, desenfocado y oscurecido
    this.backdrop = hasBackground
      ? this.add.image(0, 0, KEYS.cantinaBackground).setDepth(DEPTHS.backdrop)
      : null;
    this.blurBackdrop();
    this.backdropDim = this.add.graphics().setDepth(DEPTHS.backdropDim);

    // Todo lo del escenario se recorta a su zona: nada se derrama sobre el HUD
    this.maskShape = this.make.graphics({ add: false });
    const mask = this.maskShape.createGeometryMask();

    this.background = hasBackground
      ? this.add.image(0, 0, KEYS.cantinaBackground).setDepth(DEPTHS.background).setMask(mask)
      : null;
    this.sceneDim = this.add.graphics().setDepth(DEPTHS.sceneDim);
    this.edge = this.add.graphics().setDepth(DEPTHS.edge);

    this.characterShadow = this.add.graphics().setDepth(DEPTHS.shadow).setMask(mask);
    this.character = this.add
      .image(0, 0)
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setDepth(DEPTHS.character)
      .setMask(mask);
    this.table = this.add.graphics().setDepth(DEPTHS.table).setMask(mask);
    this.cupGraphics = this.add.graphics();
    this.cup = this.add.container(0, 0, [this.cupGraphics]).setDepth(DEPTHS.cup);
    this.dice = [this.add.graphics().setDepth(DEPTHS.dice), this.add.graphics().setDepth(DEPTHS.dice)];
    this.lastPhase = null;
    this.posesAsked = new Set();

    // Las medidas salen del stage, nunca de la ventana: él avisa al suscribirse y en cada cambio
    const unsubscribeStage = this.stage.subscribe((layout) => this.useLayout(layout));
    const unsubscribe = this.store.subscribe((snapshot) => this.sync(snapshot));
    const unsubscribeSignals = this.store.onSignal((name) => name === 'cupShake' && this.shakeCup());
    this.events.once('shutdown', () => {
      unsubscribeStage();
      unsubscribe();
      unsubscribeSignals();
      // La forma de la máscara no está en la lista de dibujo: hay que soltarla a mano
      mask.destroy();
      this.maskShape.destroy();
    });
  }

  // El desenfoque de la zona muerta solo existe en WebGL; en Canvas queda solo oscurecida
  blurBackdrop() {
    if (!this.backdrop) return;
    try {
      this.backdrop.postFX.addBlur(0, 2, 2, 2);
    } catch {
      /* sin WebGL no hay postFX: basta con el oscurecido */
    }
  }

  useLayout(layout) {
    if (!layout) return;
    this.layout = layout;
    this.redraw();
  }

  // Recalcula todo con las zonas actuales (al iniciar, en cada resize y al cambiar de layout)
  redraw() {
    // El stage manda: nunca está más atrasado que la última copia guardada
    const layout = this.stage?.get() ?? this.layout;
    if (!layout) return;
    this.layout = layout;
    this.area = layout.scene;

    const { width, height } = layout.viewport;
    // Un poco más grande que la ventana: el desenfoque difumina los bordes y así no se ven
    if (this.backdrop) coverImage(this.backdrop, bleed({ x: 0, y: 0, width, height }, 0.04));
    else drawSunburst(this.fallback.clear(), width, height);

    // Recorte "cover" dentro de la zona, anclado abajo: el piso del cuadro cae donde se apoya la mesa
    this.maskShape.clear().fillStyle(0xffffff).fillRect(this.area.x, this.area.y, this.area.width, this.area.height);
    if (this.background) coverImage(this.background, this.area, { anchorY: 1 });

    this.measureProps(this.area);
    this.sync(this.store.get(), { animate: false });
  }

  // Mesa, cubilete y dados: todas las medidas salen de la zona de la escena (shared/props.js),
  // así el cubilete nunca se sale del paño por mucho que cambie la pantalla.
  measureProps(area) {
    this.props = drawRoundTable(this.table.clear(), area);
    drawCup(this.cupGraphics.clear(), this.props.cup.width, this.props.cup.height);
  }

  // Las caras de reacción solo salen al terminar una ronda: se piden al empezar la partida,
  // y solo las de los personajes que juegan, para no gastar datos de más. Cuando llegan se
  // vuelve a dibujar el personaje, por si ya tocaba usarlas.
  requestPoses(game) {
    const characters = game.players.map((_, seat) => characterIndexFor(seat));
    if (!queuePortraitPoses(this, characters, this.posesAsked)) return;
    this.load.once('complete', () => this.showCharacter(this.store.get().game));
    this.load.start();
  }

  sync(snapshot, { animate = true } = {}) {
    if (!this.area) return;
    const { game } = snapshot;
    const inGame = Boolean(game);
    if (inGame) this.requestPoses(game);
    // Cortar animaciones antes que nada: una animación viva podría volver a mostrar los dados
    this.tweens.killTweensOf(this.cup);
    this.paintOverlays(inGame);
    this.table.setVisible(inGame);
    this.cup.setVisible(inGame);
    this.dice.forEach((d) => d.setVisible(false));
    this.showCharacter(game);

    if (!inGame) {
      this.lastPhase = null;
      return;
    }

    const showDice = viewerCanSeeDice(snapshot);
    const justRolled = this.lastPhase === PHASES.ROLL && game.phase === PHASES.CALL;
    this.lastPhase = game.phase;

    const { rest, height } = this.props.cup;
    const pose = this.cupPose(game);
    this.cup.setPosition(rest.x, rest.y).setAngle(0);
    // Los valores solo se dibujan si este jugador puede verlos: así la jugada real
    // no queda pintada en el canvas durante la pantalla de pase ni mientras otro decide
    this.drawDice(showDice ? game.round.dice : null, this.diceSpot(game));

    if (animate && justRolled) {
      // Al soltar Tirar: golpe contra la mesa y, tras una pausa, se levanta a medias para mirar
      const slam = [
        { y: rest.y - height * 0.12, duration: 70, ease: 'Quad.easeOut' },
        { y: rest.y, duration: 90, ease: 'Quad.easeIn' },
      ];
      const lift = { ...pose, delay: 220, duration: 380, ease: 'Back.easeOut', onComplete: () => this.revealDice() };
      this.tweens.chain({ targets: this.cup, tweens: showDice ? [...slam, lift] : slam });
      return;
    }

    if (!showDice) return;
    if (animate) {
      this.tweens.add({ targets: this.cup, ...pose, duration: 320, ease: 'Back.easeOut', onComplete: () => this.revealDice() });
    } else {
      this.cup.setPosition(pose.x, pose.y).setAngle(pose.angle);
      this.dice.forEach((d) => d.setVisible(true));
    }
  }

  // Mientras se canta, quien tiró levanta el cubilete solo a medias para que nadie más vea;
  // al terminar la ronda se destapa del todo
  cupPose(game) {
    const { peek, aside } = this.props.cup;
    return game.phase === PHASES.CALL ? peek : { ...aside, angle: ASIDE_ANGLE };
  }

  diceSpot(game) {
    return game.phase === PHASES.CALL ? this.props.peekDice : this.props.dice;
  }

  // Cada sacudida del botón Tirar. Solo mientras se espera la tirada y con el celular
  // en manos de quien tira (nunca detrás de la pantalla de pase)
  shakeCup() {
    const snapshot = this.store.get();
    if (!this.props || snapshot.game?.phase !== PHASES.ROLL || needsPassScreen(snapshot)) return;
    const { rest, height } = this.props.cup;
    this.tweens.killTweensOf(this.cup);
    this.cup.setPosition(rest.x, rest.y).setAngle(0);
    this.tweens.chain({
      targets: this.cup,
      tweens: [
        { angle: { from: -12, to: 12 }, y: rest.y - height * 0.1, duration: 55, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' },
        { angle: 0, y: rest.y, duration: 50 },
      ],
    });
  }

  // Oscurecido de las dos capas. En partida se apaga lo que rodea al escenario y el escenario
  // solo un poco; en el menú se apaga toda la ventana, que es el telón del logo.
  paintOverlays(inGame) {
    const { width, height } = this.layout.viewport;
    const { x, y, width: w, height: h } = this.area;
    const dim = this.backdropDim.clear();
    this.sceneDim.clear();
    this.edge.clear();
    this.background?.setVisible(inGame);

    if (!inGame) {
      dim.fillStyle(COLORS.fondo, DIM.menu).fillRect(0, 0, width, height);
      return;
    }

    // Cuatro bandas alrededor de la zona: dentro va la copia nítida del fondo
    dim.fillStyle(COLORS.fondo, BACKDROP_DIM);
    dim.fillRect(0, 0, width, y);
    dim.fillRect(0, y + h, width, height - y - h);
    dim.fillRect(0, y, x, h);
    dim.fillRect(x + w, y, width - x - w, h);

    this.sceneDim.fillStyle(COLORS.fondo, DIM.game).fillRect(x, y, w, h);
    this.edge.lineStyle(OUTLINE_WIDTH, COLORS.borde).strokeRect(x, y, w, h);
  }

  // Los dados se redibujan siempre que haya tirada, nunca solo se ocultan:
  // así no puede quedar dibujada la jugada de una ronda anterior.
  drawDice(dice, spot) {
    if (!dice) {
      this.dice.forEach((d) => d.clear());
      return;
    }
    const { size, gap, x, y } = spot;
    dice.forEach((value, i) => {
      const die = this.dice[i];
      drawDie(die.clear(), size, value);
      die.setPosition(x + (i === 0 ? -gap : gap), y).setAngle(i === 0 ? -8 : 10);
    });
  }

  // Se consulta de nuevo al destapar, por si el estado cambió durante el agitado
  revealDice() {
    const snapshot = this.store.get();
    const visible = viewerCanSeeDice(snapshot);
    if (visible) this.drawDice(snapshot.game.round.dice, this.diceSpot(snapshot.game));
    this.dice.forEach((d) => d.setVisible(visible));
  }

  // Muestra al jugador en turno sentado al otro lado de la mesa, centrado sobre ella.
  showCharacter(game) {
    const who = this.characterOnScreen(game);
    const seat = who ? game.players.findIndex((p) => p.id === who.playerId) : -1;
    if (seat < 0 || !this.props) {
      this.hideCharacter();
      return;
    }

    // Si la cara de reacción todavía no terminó de cargar, se queda la neutral
    const character = characterIndexFor(seat);
    const key = [portraitKey(character, who.pose), portraitKey(character)].find((name) =>
      this.textures.exists(name),
    );
    if (!key) {
      this.hideCharacter();
      return;
    }

    const table = this.props;
    const texture = this.textures.get(key).getSourceImage();
    // Cabe entre el borde útil de la escena (debajo de las tarjetas en celular) y la mesa,
    // y no es más ancho que ella: la cabeza nunca sube más de lo permitido
    const headroom = Math.max(table.top - this.area.contentTop, 0);
    const scale = Math.min(
      (table.width * CHARACTER_WIDTH) / texture.width,
      headroom / CHARACTER_ABOVE_TABLE / texture.height,
    );
    const height = texture.height * scale;
    if (height < CHARACTER_MIN_HEIGHT) {
      this.hideCharacter();
      return;
    }

    // Los pies quedan debajo del canto de la mesa: solo asoma de la cintura hacia arriba
    const feet = table.top + height * (1 - CHARACTER_ABOVE_TABLE);
    this.character.setTexture(key).setScale(scale).setPosition(table.x, feet).setVisible(true);

    // Sombra a sus pies, para que se apoye en el piso en vez de flotar
    const shadowWidth = texture.width * scale * 0.7;
    drawSoftShadow(this.characterShadow.clear(), table.x, feet, shadowWidth, shadowWidth * 0.26, { alpha: 0.5 });

    // Preferencia del jugador: en sombra se ve solo la silueta, sin revelar el detalle del personaje
    if (getPreference('silhouettes')) this.character.setTintFill(COLORS.borde);
    else this.character.clearTint();
  }

  hideCharacter() {
    this.character.setVisible(false);
    this.characterShadow.clear();
  }

  // Quién se queda en pantalla y con qué cara: durante la ronda, el jugador en turno;
  // al terminarla, quien se llevó la reacción (lo decide src/app/reaction.js).
  characterOnScreen(game) {
    if (!game) return null;
    if (game.currentPlayerId) return { playerId: game.currentPlayerId, pose: 'neutral' };
    return roundReaction(game);
  }
}

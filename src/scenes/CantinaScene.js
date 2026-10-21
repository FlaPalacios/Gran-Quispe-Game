import Phaser from 'phaser';
import { needsPassScreen } from '../app/gameStore.js';
import { PHASES, canSeeDice } from '../engine/rules.js';
import { getLayout } from './shared/layout.js';
import { drawCup, drawDie, drawSunburst, drawTable } from './shared/props.js';

// Escenario principal: cantina nocturna cusqueña (único con personajes).
// Placeholder vectorial hasta la Fase 2 (arte y sonido de la cantina).
export class CantinaScene extends Phaser.Scene {
  constructor() {
    super('CantinaScene');
  }

  create() {
    this.store = this.registry.get('store');
    this.background = this.add.graphics();
    this.table = this.add.graphics(); // aparte del fondo para ocultarla en el menú
    this.cup = this.add.container();
    this.cupGraphics = this.add.graphics();
    this.cup.add(this.cupGraphics);
    this.dice = [this.add.graphics(), this.add.graphics()];
    this.lastPhase = null;

    this.layoutScene();
    this.scale.on('resize', this.layoutScene, this);
    const unsubscribe = this.store.subscribe((snapshot) => this.sync(snapshot));
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layoutScene, this);
      unsubscribe();
    });
  }

  // Redibuja todo con las medidas actuales (al iniciar y en cada resize)
  layoutScene() {
    const { width, height } = this.scale.gameSize;
    const { table } = getLayout(width, height);
    drawSunburst(this.background.clear(), width, height);
    this.felt = drawTable(this.table.clear(), table);

    const cupHeight = Math.min(table.height * 0.34, table.width * 0.3);
    this.cupSize = { width: cupHeight * 0.85, height: cupHeight };
    drawCup(this.cupGraphics.clear(), this.cupSize.width, this.cupSize.height);
    this.dieSize = cupHeight * 0.42;
    this.tableTop = table.y;

    this.sync(this.store.get(), { animate: false });
  }

  sync({ game, viewerId }, { animate = true } = {}) {
    const inGame = Boolean(game);
    // Cortar cualquier animación en curso antes que nada: una animación viva podría volver a mostrar los dados
    this.tweens.killTweensOf(this.cup);
    this.table.setVisible(inGame);
    this.cup.setVisible(inGame);
    this.dice.forEach((d) => d.setVisible(false));
    if (!inGame) {
      this.lastPhase = null;
      return;
    }

    const baseY = this.felt.y + this.felt.height * 0.25;
    const showDice = canSeeDice(game, viewerId) && !needsPassScreen({ game, viewerId });
    const justRolled = this.lastPhase === PHASES.ROLL && game.phase === PHASES.CALL;
    this.lastPhase = game.phase;

    this.cup.setPosition(this.felt.x, baseY).setAngle(0);

    if (showDice) {
      const [a, b] = game.round.dice;
      const gap = this.dieSize * 0.7;
      [a, b].forEach((value, i) => {
        const die = this.dice[i];
        drawDie(die.clear(), this.dieSize, value);
        die.setPosition(this.felt.x + (i === 0 ? -gap : gap), baseY - this.dieSize * 0.3).setAngle(i === 0 ? -8 : 10);
      });
    }

    // Se levanta lo suficiente para dejar ver los dados, sin salirse del marco de la mesa
    const liftedY = Math.max(baseY - this.cupSize.height * 0.9, this.tableTop + this.cupSize.height + 16);
    if (animate && justRolled) {
      // Agitar y luego levantar el cubilete para mirar
      this.tweens.chain({
        targets: this.cup,
        tweens: [
          { angle: { from: -10, to: 10 }, duration: 90, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' },
          { angle: 0, duration: 60 },
          {
            y: liftedY,
            duration: 280,
            ease: 'Back.easeOut',
            // Se vuelve a consultar al momento de mostrar, por si el estado cambió durante el agitado
            onStart: () => {
              const latest = this.store.get();
              const visible = Boolean(latest.game) && canSeeDice(latest.game, latest.viewerId) && !needsPassScreen(latest);
              this.dice.forEach((d) => d.setVisible(visible));
            },
          },
        ],
      });
      return;
    }

    this.dice.forEach((d) => d.setVisible(showDice));
    if (showDice) {
      if (animate) this.tweens.add({ targets: this.cup, y: liftedY, duration: 280, ease: 'Back.easeOut' });
      else this.cup.y = liftedY;
    }
  }
}

/* Sistema de una máquina: demo (attract), título, partida, pausa, fin de partida y récord.
   Dibuja en su propio canvas de 224×288, que la máquina 3D usa como textura de pantalla.
   Estados: ATTRACT → TITLE → PLAYING ⇄ PAUSED → GAME_OVER | NEW_RECORD → TITLE. */
import { makeRng } from '../core/rng.js';
import { text } from '../gfx/text.js';

const RESULT_FRAMES = 60 * 8;      // tiempo en la pantalla de resultado antes de volver al título
const RESULT_LOCK = 60;            // sin aceptar ENTER al principio (evita saltársela sin querer)
const DIRS = ['up', 'left', 'down', 'right'];
const NO_SFX = () => {};

// Entrada sintética para la demo: piloto automático sencillo y reproducible.
function makeAutopilot(kind, rng) {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  const input = { down: flags(), pressed: flags(), lastDir: null };
  let timer = 0;
  let hold = null;
  return function next() {
    for (const k in input.pressed) input.pressed[k] = false;
    if (--timer > 0) return input;
    if (kind === 'maze') {
      // Pide un giro al azar de vez en cuando; el juego lo hace en el siguiente cruce posible.
      const d = DIRS[Math.floor(rng() * 4)];
      input.pressed[d] = true;
      input.lastDir = d;
      timer = 20 + Math.floor(rng() * 40);
      return input;
    }
    // Plataformas: anda a un lado, a veces sube y a veces salta.
    if (hold) input.down[hold] = false;
    input.down.up = false;
    input.down.jump = false;
    const r = rng();
    hold = r < 0.45 ? 'right' : r < 0.9 ? 'left' : null;
    if (hold) { input.down[hold] = true; input.pressed[hold] = true; }
    if (rng() < 0.4) input.down.up = true;
    if (rng() < 0.25) { input.down.jump = true; input.pressed.jump = true; }
    timer = 30 + Math.floor(rng() * 90);
    return input;
  };
}

export class ArcadeMachine {
  // opts: { id, name, Game, render, renderTitle, audio, scores, users, seed }
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.Game = opts.Game;
    this.renderGame = opts.render;
    this.renderTitle = opts.renderTitle;
    this.audio = opts.audio;
    this.scores = opts.scores;
    this.users = opts.users;
    this.seed = opts.seed || 0;          // 0 = semilla por tiempo
    this.canvas = document.createElement('canvas');
    this.canvas.width = 224;
    this.canvas.height = 288;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.state = 'ATTRACT';
    this.game = null;
    this.demo = null;
    this.frame = 0;
    this.resultTimer = 0;
    this.result = null;
    this.dirty = true;
    this.view = { best: 0, userName: '', frame: 0 };
    this.sfx = (n) => this.audio.play(n);
    this.startDemo();
  }

  nextSeed() { return this.seed ? (this.seed = (this.seed * 1103515245 + 12345) >>> 0) : (Date.now() & 0xffffffff) >>> 0; }

  startDemo() {
    const rng = makeRng(this.nextSeed() || 1);
    this.demo = new this.Game({ rng, sfx: NO_SFX });
    this.demo.test.startPlaying();
    this.autopilot = makeAutopilot(this.id, rng);
  }

  // El jugador se sienta: la máquina pasa a la pantalla de título.
  insert() {
    this.game = null;
    this.state = 'TITLE';
    this.frame = 0;
    this.audio.music('title');
    this.dirty = true;
  }

  // El jugador se levanta: la partida en curso se abandona sin guardar (como al salir al menú en la v1).
  leave() {
    this.game = null;
    this.result = null;
    this.state = 'ATTRACT';
    this.audio.stopMusic();
    this.startDemo();
    this.dirty = true;
  }

  start() {
    this.audio.stopMusic();
    this.game = new this.Game({ rng: makeRng(this.nextSeed()), sfx: this.sfx });
    this.state = 'PLAYING';
    this.audio.play('start');
    this.dirty = true;
  }

  restart() {
    if (this.state === 'ATTRACT') return;
    this.start();
  }

  pause() {
    if (this.state !== 'PLAYING') return false;
    this.state = 'PAUSED';
    this.audio.stopMusic();
    this.dirty = true;
    return true;
  }

  resume() {
    if (this.state !== 'PAUSED') return false;
    this.state = 'PLAYING';
    this.dirty = true;
    return true;
  }

  finish() {
    const g = this.game;
    const user = this.users.active();
    const res = user ? this.scores.submit(user.id, this.id, g.score, g.level) : { isRecord: false, best: 0, previous: 0 };
    this.result = { score: g.score, level: g.level, best: res.best, previous: res.previous, isRecord: res.isRecord };
    this.state = res.isRecord ? 'NEW_RECORD' : 'GAME_OVER';
    this.resultTimer = 0;
    if (res.isRecord) this.audio.play('record');
    this.dirty = true;
  }

  // Un paso fijo. input: la entrada del jugador si está sentado aquí, o null.
  update(input) {
    this.frame++;
    switch (this.state) {
      case 'ATTRACT':
        // La demo va a 30 Hz: basta para el ambiente y ahorra trabajo con dos máquinas.
        if (this.frame % 2) return;
        this.demo.update(this.autopilot());
        this.demo.update(this.autopilot());
        if (this.demo.gameOver) this.startDemo();
        this.dirty = true;
        return;
      case 'TITLE':
        if (input && (input.pressed.start || input.pressed.jump)) this.start();
        if (this.frame % 6 === 0) this.dirty = true;
        return;
      case 'PLAYING':
        this.game.update(input);
        if (this.game.gameOver) this.finish();
        this.dirty = true;
        return;
      case 'PAUSED':
        return;
      case 'GAME_OVER':
      case 'NEW_RECORD':
        this.resultTimer++;
        if (this.resultTimer > RESULT_LOCK && input && (input.pressed.start || input.pressed.jump)) this.start();
        else if (this.resultTimer >= RESULT_FRAMES) this.insert();
        if (this.resultTimer % 6 === 0) this.dirty = true;
        return;
    }
  }

  // Dibuja en el canvas si algo ha cambiado. Devuelve true si hay que subir la textura.
  render() {
    if (!this.dirty) return false;
    this.dirty = false;
    const g = this.ctx;
    const user = this.users.active();
    const v = this.view;
    v.userName = user ? user.name : '';
    v.best = user ? user.records[this.id].best : 0;
    v.frame = this.frame;
    switch (this.state) {
      case 'ATTRACT':
        v.userName = '';
        v.best = this.scores.globalBest(this.id);
        this.renderGame(g, this.demo, v);
        this.banner(g, Math.floor(this.frame / 40) % 2 ? 'DEMO' : 'PULSA E', '#ffd23f');
        break;
      case 'TITLE':
        this.renderTitle(g, v);
        break;
      case 'PLAYING':
        this.renderGame(g, this.game, v);
        break;
      case 'PAUSED':
        this.renderGame(g, this.game, v);
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillRect(0, 0, 224, 288);
        text.draw(g, 'PAUSA', 112, 136, '#ffd23f', 'center', 2);
        break;
      default:
        this.renderResult(g, v);
    }
    return true;
  }

  banner(g, msg, color) {
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(0, 130, 224, 24);
    text.draw(g, msg, 112, 138, color, 'center');
  }

  renderResult(g, v) {
    const r = this.result;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 224, 288);
    text.draw(g, 'FIN DE PARTIDA', 112, 40, '#ff3b3b', 'center');
    text.draw(g, this.name, 112, 60, '#7a86c8', 'center');
    text.draw(g, 'PUNTOS', 112, 100, '#ffffff', 'center');
    text.draw(g, String(r.score), 112, 114, '#ffffff', 'center', 2);
    text.draw(g, 'NIVEL ' + r.level, 112, 140, '#33e6ff', 'center');
    if (r.isRecord) {
      if (Math.floor(this.resultTimer / 15) % 2 === 0) text.draw(g, '¡NUEVO RÉCORD!', 112, 172, '#ffd23f', 'center');
      if (r.previous) text.draw(g, 'ANTERIOR ' + r.previous, 112, 190, '#7a86c8', 'center');
    } else {
      text.draw(g, 'RÉCORD ' + r.best, 112, 172, '#ffffff', 'center');
    }
    text.draw(g, v.userName, 112, 214, '#33e6ff', 'center');
    if (this.resultTimer > RESULT_LOCK && Math.floor(this.resultTimer / 30) % 2 === 0) text.draw(g, 'ENTER: OTRA PARTIDA', 112, 244, '#33e6ff', 'center');
    text.draw(g, 'Q: LEVANTARSE', 112, 262, '#7a86c8', 'center');
  }
}

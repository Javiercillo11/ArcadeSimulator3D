/* Sistema de una máquina: demo (attract), título, partida, pausa, fin de partida y récord.
   Dibuja en su propio canvas (224×288 en las recreativas; más alto en la mesa de hockey y la pista de skee),
   que la máquina 3D usa como textura. Las pantallas comunes se dibujan en 224×288, centradas en vertical.
   Cada partida cuesta una moneda del jugador. Si la puntuación entra en el TOP 10 de la máquina,
   antes del resultado se piden tres iniciales con la palanca.
   Estados: ATTRACT → TITLE → PLAYING ⇄ PAUSED → [ENTER_INITIALS] → GAME_OVER | NEW_RECORD → TITLE. */
import { makeRng } from '../core/rng.js';
import { text } from '../gfx/text.js';
import { InitialsEntry, ALPHABET } from './initials.js';

const RESULT_FRAMES = 60 * 8;      // tiempo en la pantalla de resultado antes de volver al título
const RESULT_LOCK = 60;            // sin aceptar ENTER al principio (evita saltársela sin querer)
const ATTRACT_DEMO = 60 * 12;      // en la demo, 12 s de juego…
const ATTRACT_TABLE = 60 * 5;      // …y 5 s con la tabla TOP 10
const NO_COIN_FRAMES = 90;
const DIRS = ['up', 'left', 'down', 'right'];
const NO_SFX = () => {};

// Entrada sintética para la demo: piloto automático sencillo y reproducible. demo() da la partida de la demo.
function makeAutopilot(kind, rng, demo) {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  const input = { down: flags(), pressed: flags(), lastDir: null, move: { x: 0, y: 0 } };
  let timer = 0;
  let hold = null;
  return function next() {
    for (const k in input.pressed) input.pressed[k] = false;
    const g = demo();
    if (kind === 'brick') {
      // Sigue la bola con algo de retraso y la lanza en cuanto puede.
      const target = g.ball.x + Math.sin(g.frame / 40) * 10;
      input.down.left = target < g.paddle.x - 4;
      input.down.right = target > g.paddle.x + 4;
      if (g.ball.stuck && --timer <= 0) { input.pressed.jump = true; timer = 40; }
      return input;
    }
    if (kind === 'hockey') {
      // Va a por el disco cuando está en su campo; si no, vuelve a la portería.
      const p = g.puck, m = g.player;
      const tx = p.y > 200 ? p.x : 112, ty = p.y > 200 ? p.y + 10 : 350;
      input.down.left = tx < m.x - 3;
      input.down.right = tx > m.x + 3;
      input.down.up = ty < m.y - 3;
      input.down.down = ty > m.y + 3;
      return input;
    }
    if (kind === 'skee') {
      // Apunta a un sitio al azar y mantiene la fuerza un tiempo al azar.
      if (g.phase !== 'AIM') { input.down.jump = false; return input; }
      if (--timer > 0) return input;
      if (!input.down.jump) {
        input.down.jump = true;
        input.pressed.jump = true;
        timer = 10 + Math.floor(rng() * 30);
      } else {
        input.down.jump = false;
        timer = 30;
      }
      return input;
    }
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
  // opts: { id, name, Game, render, renderTitle, audio, scores, users, seed, width, height, coinBannerY,
  //         tickets(game) → nº de tickets, onEvent(machine, nombre), onFinish(machine, result), onRank(machine, puesto) }
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
    this.W = opts.width || 224;
    this.H = opts.height || 288;
    this.oy = Math.round((this.H - 288) / 2);   // desplazamiento de las pantallas comunes
    this.coinBannerY = opts.coinBannerY || 236;
    this.ticketsFor = opts.tickets || ((g) => Math.max(1, Math.min(50, Math.floor(g.score / 1000))));
    this.onEvent = opts.onEvent || NO_SFX;
    this.onFinish = opts.onFinish || NO_SFX;
    this.onRank = opts.onRank || NO_SFX;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.state = 'ATTRACT';
    this.game = null;
    this.demo = null;
    this.frame = 0;
    this.resultTimer = 0;
    this.result = null;
    this.entry = null;            // iniciales en curso
    this.noCoin = 0;              // aviso «SIN MONEDAS» tras intentar jugar sin ellas
    this.dirty = true;
    this.view = { best: 0, userName: '', frame: 0 };
    this.sfx = (n) => { this.audio.play(n); this.onEvent(this, n); };
    this.startDemo();
  }

  nextSeed() { return this.seed ? (this.seed = (this.seed * 1103515245 + 12345) >>> 0) : (Date.now() & 0xffffffff) >>> 0; }

  startDemo() {
    const rng = makeRng(this.nextSeed() || 1);
    this.demo = new this.Game({ rng, sfx: NO_SFX });
    this.demo.test.startPlaying();
    this.autopilot = makeAutopilot(this.id, rng, () => this.demo);
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
  // Si estaba poniendo las iniciales, se guardan las que haya.
  leave() {
    if (this.state === 'ENTER_INITIALS') this.commitInitials();
    this.game = null;
    this.entry = null;
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

  // Echa una moneda del jugador y empieza. Devuelve false si no le quedan.
  tryStart() {
    const user = this.users.active();
    if (!user || !this.users.spendCoin(user.id)) {
      this.audio.play('error');
      this.noCoin = NO_COIN_FRAMES;
      this.dirty = true;
      return false;
    }
    this.audio.play('coin');
    this.start();
    return true;
  }

  coins() {
    const user = this.users.active();
    return user ? user.coins : 0;
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
    const tickets = user ? this.users.addTickets(user.id, this.ticketsFor(g)) : 0;
    this.result = { score: g.score, level: g.level, best: res.best, previous: res.previous, isRecord: res.isRecord, rank: -1, tickets, won: !!g.won };
    this.dirty = true;
    this.onFinish(this, this.result);
    if (this.scores.qualifies(this.id, g.score)) {
      this.entry = new InitialsEntry(user ? user.initials : 'AAA', this.sfx);
      this.state = 'ENTER_INITIALS';
      this.audio.play('extra');
      return;
    }
    this.showResult();
  }

  // Guarda las iniciales en el TOP 10 y pasa al resultado.
  commitInitials(value) {
    const user = this.users.active();
    const initials = value || this.entry.value;
    this.result.initials = initials;
    this.result.rank = this.scores.addHighScore(this.id, { initials, score: this.result.score, level: this.result.level, userId: user ? user.id : null });
    if (user) this.users.setInitials(user.id, initials);
    this.entry = null;
    this.onRank(this, this.result.rank);
    this.showResult();
  }

  showResult() {
    this.state = this.result.isRecord ? 'NEW_RECORD' : 'GAME_OVER';
    this.resultTimer = 0;
    if (this.result.isRecord) this.audio.play('record');
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
        if (this.noCoin > 0) this.noCoin--;
        if (input && (input.pressed.start || input.pressed.jump)) this.tryStart();
        if (this.frame % 6 === 0) this.dirty = true;
        return;
      case 'ENTER_INITIALS':
        if (this.entry.update(input)) this.commitInitials();
        this.dirty = true;
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
        if (this.noCoin > 0) this.noCoin--;
        if (this.resultTimer > RESULT_LOCK && input && (input.pressed.start || input.pressed.jump)) this.tryStart();
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
    // Las pantallas comunes (pausa, iniciales, resultado, tabla) se dibujan en 224×288 centradas.
    const common = (fn) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, this.W, this.H);
      g.save();
      g.translate(0, this.oy);
      fn();
      g.restore();
    };
    const user = this.users.active();
    const v = this.view;
    v.userName = user ? user.name : '';
    v.best = user ? user.records[this.id].best : 0;
    v.frame = this.frame;
    switch (this.state) {
      case 'ATTRACT':
        v.userName = '';
        v.best = this.scores.hallOfFame(this.id)[0].score;
        // La demo alterna partida automática y tabla TOP 10, como las recreativas en espera.
        if (this.frame % (ATTRACT_DEMO + ATTRACT_TABLE) >= ATTRACT_DEMO) {
          common(() => this.renderTable(g));
        } else {
          this.renderGame(g, this.demo, v);
          this.banner(g, Math.floor(this.frame / 40) % 2 ? 'DEMO' : 'PULSA E', '#ffd23f');
        }
        break;
      case 'TITLE':
        this.renderTitle(g, v);
        this.renderCoins(g);
        break;
      case 'ENTER_INITIALS':
        common(() => this.renderInitials(g));
        break;
      case 'PLAYING':
        this.renderGame(g, this.game, v);
        break;
      case 'PAUSED':
        this.renderGame(g, this.game, v);
        g.fillStyle = 'rgba(0,0,0,0.6)';
        g.fillRect(0, 0, this.W, this.H);
        text.draw(g, 'PAUSA', 112, this.H / 2 - 8, '#ffd23f', 'center', 2);
        break;
      default:
        common(() => this.renderResult(g, v));
    }
    return true;
  }

  banner(g, msg, color) {
    const y = Math.round(this.H / 2 - 14);
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(0, y, this.W, 24);
    text.draw(g, msg, 112, y + 8, color, 'center');
  }

  // Franja inferior del título: monedas del jugador, y aviso si no le quedan.
  renderCoins(g) {
    const n = this.coins();
    g.fillStyle = '#000';
    g.fillRect(0, this.H - 12, this.W, 12);
    text.draw(g, 'MONEDAS ' + (n < 10 ? '0' : '') + n, 112, this.H - 10, n ? '#ffd23f' : '#ff3b3b', 'center');
    if (n === 0 || this.noCoin > 0) {
      const y = this.coinBannerY;
      g.fillStyle = '#000';
      g.fillRect(0, y, 224, 24);
      if (Math.floor(this.frame / 20) % 2 === 0) text.draw(g, 'INSERTE MONEDA', 112, y + 2, '#ff3b3b', 'center');
      text.draw(g, 'VE A LA MÁQUINA DE CAMBIO', 112, y + 14, '#7a86c8', 'center');
    }
  }

  renderTable(g) {
    const list = this.scores.hallOfFame(this.id);
    g.fillStyle = '#000';
    g.fillRect(0, 0, 224, 288);
    text.draw(g, this.name, 112, 16, '#7a86c8', 'center');
    text.draw(g, 'TOP 10', 112, 34, '#ffd23f', 'center', 2);
    text.draw(g, 'PUESTO  PUNTOS  NOMBRE', 112, 64, '#33e6ff', 'center');
    const colors = ['#ff3b3b', '#ff8ad8', '#ffd23f', '#33e6ff', '#ffffff'];
    list.forEach((e, i) => {
      const y = 84 + i * 18;
      const c = colors[Math.min(i, colors.length - 1)];
      text.draw(g, ['1º', '2º', '3º'][i] || (i + 1) + 'º', 40, y, c, 'center');
      text.draw(g, String(e.score), 128, y, c, 'right');
      text.draw(g, e.initials, 170, y, c, 'center');
    });
    if (Math.floor(this.frame / 30) % 2 === 0) text.draw(g, 'PULSA E', 112, 272, '#ffd23f', 'center');
  }

  renderInitials(g) {
    const e = this.entry;
    const r = this.result;
    const rank = this.scores.hallOfFame(this.id).filter((x) => x.score >= r.score).length + 1;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 224, 288);
    text.draw(g, '¡ENHORABUENA!', 112, 30, '#ffd23f', 'center');
    text.draw(g, 'ENTRAS EN EL TOP 10', 112, 48, '#ffffff', 'center');
    text.draw(g, 'PUESTO ' + rank + 'º', 112, 72, '#33e6ff', 'center', 2);
    text.draw(g, String(r.score), 112, 96, '#ffffff', 'center');
    text.draw(g, 'PON TUS INICIALES', 112, 124, '#ff8ad8', 'center');
    for (let i = 0; i < 3; i++) {
      const x = 64 + i * 48;
      const on = i === e.cursor;
      const ch = ALPHABET[e.letters[i]];
      text.draw(g, ch === ' ' ? '_' : ch, x, 148, on ? '#ffd23f' : '#ffffff', 'center', 3);
      if (on && Math.floor(this.frame / 12) % 2 === 0) {
        g.fillStyle = '#ffd23f';
        g.fillRect(x - 12, 176, 24, 3);
        g.beginPath();
        g.moveTo(x, 136); g.lineTo(x + 5, 142); g.lineTo(x - 5, 142);
        g.fill();
      }
    }
    text.draw(g, 'ARRIBA/ABAJO: LETRA', 112, 204, '#7a86c8', 'center');
    text.draw(g, 'IZQ./DCHA.: MOVER', 112, 218, '#7a86c8', 'center');
    text.draw(g, 'ESPACIO/ENTER: VALE', 112, 232, '#7a86c8', 'center');
    const left = Math.max(0, Math.ceil((30 * 60 - e.frames) / 60));
    text.draw(g, String(left), 112, 260, left <= 5 ? '#ff3b3b' : '#ffffff', 'center');
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
    if (r.rank >= 0) text.draw(g, r.initials + ' · TOP 10 Nº ' + (r.rank + 1), 112, 204, '#ffd23f', 'center');
    else text.draw(g, v.userName, 112, 204, '#33e6ff', 'center');
    text.draw(g, '+' + r.tickets + ' TICKETS', 112, 220, '#3dff8b', 'center');
    const n = this.coins();
    if (this.resultTimer > RESULT_LOCK && Math.floor(this.resultTimer / 30) % 2 === 0) {
      if (n > 0) text.draw(g, 'ENTER: OTRA (1 MONEDA)', 112, 238, '#33e6ff', 'center');
      else text.draw(g, 'SIN MONEDAS', 112, 238, '#ff3b3b', 'center');
    }
    text.draw(g, 'MONEDAS ' + n, 112, 250, n ? '#ffd23f' : '#ff3b3b', 'center');
    text.draw(g, 'Q: LEVANTARSE', 112, 262, '#7a86c8', 'center');
  }
}

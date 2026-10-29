/* AIR HOCKEY: mesa vista desde arriba (224×400). El jugador defiende la portería de abajo contra la máquina.
   Gana quien llega antes a 7 goles. Física de disco y mazos con subpasos (sin dibujo).
   Contrato v2: new HockeyGame({ level, rng, sfx }); update(input) a 60 Hz; score, lives, level, state, gameOver. */
import { makeRng } from '../../core/rng.js';

export const TABLE = { w: 224, h: 400, rail: 8, goalL: 72, goalR: 152 };
export const PUCK_R = 8;
export const MALLET_R = 13;
export const WIN_GOALS = 7;
const SUB = 4;
const FRICTION = 0.996;
const PUCK_MAX = 9;
const PLAYER_SPEED = 4.6;
const CPU_SPEED = 2.9;
const RESTITUTION = 0.9;
const NO_SFX = () => {};

export class HockeyGame {
  constructor(opts = {}) {
    this.rand = opts.rng || makeRng(opts.seed || Date.now());
    this.sfx = opts.sfx || NO_SFX;
    this.level = opts.level || 1;
    this.cpuSpeed = CPU_SPEED + 0.25 * (this.level - 1);
    this.puck = { x: 112, y: 200, vx: 0, vy: 0 };
    this.player = { x: 112, y: 350, vx: 0, vy: 0 };
    this.cpu = { x: 112, y: 50, vx: 0, vy: 0 };
    this.goals = { player: 0, cpu: 0 };
    this.frame = 0;
    this.finished = false;
    this.won = false;
    this.lastGoal = null;
    this.score = 0;
    this.scoreText = '0';
    this.serve('player');
    this.setPhase('READY', 90);
    this.test = this.makeTestApi();
  }

  get state() { return this.phase; }
  get gameOver() { return this.finished; }
  // «Vidas»: goles que le faltan a la máquina para ganar.
  get lives() { return WIN_GOALS - this.goals.cpu; }

  setPhase(name, frames) {
    this.phase = name;
    this.timer = frames;
  }

  // Coloca el disco parado en el campo de quien saca (el que encajó el último gol).
  serve(side) {
    const p = this.puck;
    p.x = 112;
    p.y = side === 'player' ? 260 : 140;
    p.vx = p.vy = 0;
    Object.assign(this.player, { x: 112, y: 350, vx: 0, vy: 0 });
    Object.assign(this.cpu, { x: 112, y: 50, vx: 0, vy: 0 });
  }

  update(input) {
    if (this.finished) return;
    this.frame++;
    switch (this.phase) {
      case 'READY':
        this.movePlayer(input);
        if (--this.timer <= 0) this.setPhase('PLAYING', 0);
        break;
      case 'PLAYING':
        this.tick(input);
        break;
      case 'GOAL':
        if (--this.timer <= 0) {
          if (this.goals.player >= WIN_GOALS || this.goals.cpu >= WIN_GOALS) this.end();
          else { this.serve(this.lastGoal === 'player' ? 'cpu' : 'player'); this.setPhase('READY', 60); }
        }
        break;
      case 'GAME_OVER':
        if (--this.timer <= 0) this.finished = true;
        break;
    }
  }

  end() {
    this.won = this.goals.player >= WIN_GOALS;
    // Puntos: 500 por gol y, si se gana, 3000 más 500 por cada gol de diferencia que no encajaste.
    this.score = this.goals.player * 500 + (this.won ? 3000 + (WIN_GOALS - this.goals.cpu) * 500 : 0);
    this.scoreText = String(this.score);
    this.setPhase('GAME_OVER', 180);
    this.sfx(this.won ? 'levelClear' : 'gameOver');
  }

  movePlayer(input) {
    const m = this.player;
    const d = input && input.down;
    let dx = d ? (d.right ? 1 : 0) - (d.left ? 1 : 0) : 0;
    let dy = d ? (d.down ? 1 : 0) - (d.up ? 1 : 0) : 0;
    if (input && input.move && (input.move.x || input.move.y)) { dx = input.move.x; dy = input.move.y; }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    m.vx = dx * PLAYER_SPEED;
    m.vy = dy * PLAYER_SPEED;
    m.x += m.vx;
    m.y += m.vy;
    this.clampMallet(m, TABLE.h / 2 + MALLET_R, TABLE.h - TABLE.rail - MALLET_R);
  }

  clampMallet(m, minY, maxY) {
    const minX = TABLE.rail + MALLET_R, maxX = TABLE.w - TABLE.rail - MALLET_R;
    if (m.x < minX) m.x = minX;
    if (m.x > maxX) m.x = maxX;
    if (m.y < minY) m.y = minY;
    if (m.y > maxY) m.y = maxY;
  }

  // La máquina defiende su portería y ataca cuando el disco entra en su campo.
  moveCpu() {
    const m = this.cpu, p = this.puck;
    let tx, ty;
    if (p.y < TABLE.h / 2 + 20 && p.vy < 3) {
      // Ataque: se pone detrás del disco (más cerca de su portería) y empuja hacia abajo.
      tx = p.x + (p.x - 112) * 0.15;
      ty = p.y - MALLET_R - 2;
      if (m.y < p.y - 4) ty = p.y + 2;
    } else {
      // Defensa: entre el disco y el centro de su portería.
      tx = 112 + (p.x - 112) * 0.5;
      ty = 46;
    }
    const dx = tx - m.x, dy = ty - m.y;
    const len = Math.hypot(dx, dy);
    const s = Math.min(this.cpuSpeed, len);
    m.vx = len ? dx / len * s : 0;
    m.vy = len ? dy / len * s : 0;
    m.x += m.vx;
    m.y += m.vy;
    this.clampMallet(m, TABLE.rail + MALLET_R, TABLE.h / 2 - MALLET_R);
  }

  tick(input) {
    this.movePlayer(input);
    this.moveCpu();
    const p = this.puck;
    for (let i = 0; i < SUB; i++) {
      p.x += p.vx / SUB;
      p.y += p.vy / SUB;
      this.collide(this.player);
      this.collide(this.cpu);
      if (this.walls()) return;
    }
    p.vx *= FRICTION;
    p.vy *= FRICTION;
  }

  collide(m) {
    const p = this.puck;
    const dx = p.x - m.x, dy = p.y - m.y;
    const dist = Math.hypot(dx, dy);
    const min = PUCK_R + MALLET_R;
    if (dist >= min || dist === 0) return;
    const nx = dx / dist, ny = dy / dist;
    p.x = m.x + nx * min;
    p.y = m.y + ny * min;
    // El mazo es mucho más pesado: el disco rebota con la velocidad relativa.
    const rvx = p.vx - m.vx, rvy = p.vy - m.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      p.vx -= (1 + RESTITUTION) * vn * nx;
      p.vy -= (1 + RESTITUTION) * vn * ny;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > PUCK_MAX) { p.vx = p.vx / sp * PUCK_MAX; p.vy = p.vy / sp * PUCK_MAX; }
      this.sfx('puck');
    }
  }

  // Bandas y porterías. Devuelve true si ha habido gol.
  walls() {
    const p = this.puck;
    const minX = TABLE.rail + PUCK_R, maxX = TABLE.w - TABLE.rail - PUCK_R;
    if (p.x < minX) { p.x = minX; p.vx = Math.abs(p.vx) * RESTITUTION; this.sfx('bounce'); }
    if (p.x > maxX) { p.x = maxX; p.vx = -Math.abs(p.vx) * RESTITUTION; this.sfx('bounce'); }
    const inMouth = p.x > TABLE.goalL + PUCK_R * 0.5 && p.x < TABLE.goalR - PUCK_R * 0.5;
    if (p.y < TABLE.rail + PUCK_R) {
      if (inMouth) { if (p.y < 0) return this.goal('player'); }
      else { p.y = TABLE.rail + PUCK_R; p.vy = Math.abs(p.vy) * RESTITUTION; this.sfx('bounce'); }
    }
    if (p.y > TABLE.h - TABLE.rail - PUCK_R) {
      if (inMouth) { if (p.y > TABLE.h) return this.goal('cpu'); }
      else { p.y = TABLE.h - TABLE.rail - PUCK_R; p.vy = -Math.abs(p.vy) * RESTITUTION; this.sfx('bounce'); }
    }
    return false;
  }

  goal(who) {
    this.goals[who]++;
    this.lastGoal = who;
    if (who === 'player') {
      this.score = this.goals.player * 500;
      this.scoreText = String(this.score);
    }
    this.setPhase('GOAL', 90);
    this.sfx(who === 'player' ? 'goal' : 'death');
    return true;
  }

  makeTestApi() {
    const self = this;
    return {
      state() {
        return {
          phase: self.phase, score: self.score, goals: { ...self.goals }, won: self.won,
          puck: { ...self.puck }, player: { ...self.player }, cpu: { ...self.cpu }
        };
      },
      startPlaying() { self.setPhase('PLAYING', 0); },
      setPuck(x, y, vx, vy) { Object.assign(self.puck, { x, y, vx, vy }); },
      setPlayer(x, y) { Object.assign(self.player, { x, y }); },
      setCpu(x, y) { Object.assign(self.cpu, { x, y }); },
      setGoals(player, cpu) { self.goals.player = player; self.goals.cpu = cpu; }
    };
  }
}

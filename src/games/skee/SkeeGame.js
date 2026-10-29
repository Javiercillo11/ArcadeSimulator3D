/* SKEE-BALL: pista vista desde arriba (224×560, el fondo arriba). 9 bolas por partida.
   ←/→ apunta, mantener ESPACIO carga la fuerza (sube y baja) y soltar lanza. La bola rueda pista arriba,
   salta en la rampa y cae en un anillo (10-50) o en los agujeros de 100 de las esquinas (sin dibujo).
   Contrato v2: new SkeeGame({ level, rng, sfx }); update(input) a 60 Hz; score, lives, level, state, gameOver. */
import { makeRng } from '../../core/rng.js';

export const LANE = { w: 224, h: 560, left: 30, right: 194, startY: 520, rampY: 236 };
export const TARGET = { x: 112, y: 112 };
export const RINGS = [[14, 50], [30, 40], [46, 30], [62, 20]];     // [radio, puntos]; fuera = 10
export const HUNDREDS = [{ x: 30, y: 32 }, { x: 194, y: 32 }];
export const HUNDRED_R = 13;
export const BALLS = 9;
const AIM_SPEED = 1.6;
const POWER_RATE = 0.022;
const DECEL = 0.035;
const FLIGHT_K = 30;             // px de vuelo por cada px/paso de velocidad al llegar a la rampa
const FLY_FRAMES = 24;
const SCORE_FRAMES = 45;
const NO_SFX = () => {};

// Puntos del hoyo donde cae la bola (x, y en la pista).
export function holeAt(x, y) {
  for (const h of HUNDREDS) if (Math.hypot(x - h.x, y - h.y) <= HUNDRED_R) return 100;
  const r = Math.hypot(x - TARGET.x, y - TARGET.y);
  for (const [radius, pts] of RINGS) if (r <= radius) return pts;
  return 10;
}

export class SkeeGame {
  constructor(opts = {}) {
    this.rand = opts.rng || makeRng(opts.seed || Date.now());
    this.sfx = opts.sfx || NO_SFX;
    this.level = opts.level || 1;
    this.score = 0;
    this.scoreText = '0';
    this.ballsLeft = BALLS;
    this.aim = 112;
    this.power = 0;
    this.powerDir = 1;
    this.charging = false;
    this.ball = { x: 112, y: LANE.startY, v: 0, drift: 0, scale: 1 };
    this.landing = { x: 0, y: 0, pts: 0 };
    this.history = [];
    this.frame = 0;
    this.finished = false;
    this.setPhase('AIM', 0);
    this.test = this.makeTestApi();
  }

  get state() { return this.phase; }
  get gameOver() { return this.finished; }
  get lives() { return this.ballsLeft; }

  setPhase(name, frames) {
    this.phase = name;
    this.timer = frames;
  }

  update(input) {
    if (this.finished) return;
    this.frame++;
    switch (this.phase) {
      case 'AIM': this.aiming(input); break;
      case 'ROLL': this.roll(); break;
      case 'FLY': this.fly(); break;
      case 'SCORED':
        if (--this.timer <= 0) this.nextBall();
        break;
      case 'GAME_OVER':
        if (--this.timer <= 0) this.finished = true;
        break;
    }
  }

  aiming(input) {
    const d = input && input.down, pr = input && input.pressed;
    const dir = d ? (d.right ? 1 : 0) - (d.left ? 1 : 0) : 0;
    this.aim = Math.max(LANE.left + 10, Math.min(LANE.right - 10, this.aim + dir * AIM_SPEED));
    this.ball.x = this.aim;
    if (!this.charging && pr && (pr.jump || pr.start)) {
      this.charging = true;
      this.power = 0;
      this.powerDir = 1;
    }
    if (!this.charging) return;
    if (d && (d.jump || d.start)) {
      // La barra de fuerza sube y baja mientras se mantiene: hay que soltar en el momento justo.
      this.power += POWER_RATE * this.powerDir;
      if (this.power >= 1) { this.power = 1; this.powerDir = -1; }
      if (this.power <= 0) { this.power = 0; this.powerDir = 1; }
    } else {
      this.throwBall(this.power);
    }
  }

  // power 0..1 → velocidad inicial. Con poca fuerza la bola no llega a la rampa (10 puntos).
  throwBall(power) {
    this.charging = false;
    const b = this.ball;
    b.x = this.aim;
    b.y = LANE.startY;
    b.v = 4.5 + power * 5.5;
    b.drift = (this.rand() - 0.5) * 0.05;   // pequeño efecto aleatorio: unos ±7 px al llegar
    b.scale = 1;
    this.setPhase('ROLL', 0);
    this.sfx('jump');
  }

  roll() {
    const b = this.ball;
    b.y -= b.v;
    b.x += b.drift * b.v;
    b.x = Math.max(LANE.left + 6, Math.min(LANE.right - 6, b.x));
    b.v -= DECEL;
    if (b.y <= LANE.rampY) {
      // Salta en la rampa: cuanto más rápida, más lejos cae.
      const dist = Math.max(0, b.v * FLIGHT_K - 20);
      const lx = b.x + b.drift * dist;
      const ly = LANE.rampY - 24 - dist;
      this.landing.x = lx;
      this.landing.y = Math.max(8, ly);
      this.landing.pts = holeAt(lx, Math.max(8, ly));
      this.from = { x: b.x, y: b.y };
      this.setPhase('FLY', FLY_FRAMES);
      this.sfx('land');
      return;
    }
    if (b.v <= 0.4) {
      // No llegó: rueda de vuelta hasta el canal (10 puntos, como en las pistas reales).
      this.landing.x = b.x;
      this.landing.y = b.y;
      this.landing.pts = 10;
      this.score10();
    }
  }

  fly() {
    const b = this.ball;
    const t = 1 - this.timer / FLY_FRAMES;
    b.x = this.from.x + (this.landing.x - this.from.x) * t;
    b.y = this.from.y + (this.landing.y - this.from.y) * t;
    b.scale = 1 + Math.sin(t * Math.PI) * 0.6;
    if (--this.timer <= 0) {
      b.scale = 1;
      this.award(this.landing.pts);
    }
  }

  score10() { this.award(10); }

  award(pts) {
    this.score += pts;
    this.scoreText = String(this.score);
    this.history.push(pts);
    this.lastPts = pts;
    this.sfx(pts === 100 ? 'skee100' : 'score');
    if (pts === 100) this.sfx('extra');
    this.setPhase('SCORED', SCORE_FRAMES);
  }

  nextBall() {
    this.ballsLeft--;
    if (this.ballsLeft <= 0) {
      this.setPhase('GAME_OVER', 120);
      this.sfx('gameOver');
      return;
    }
    this.ball.y = LANE.startY;
    this.ball.x = this.aim;
    this.ball.v = 0;
    this.setPhase('AIM', 0);
  }

  makeTestApi() {
    const self = this;
    return {
      state() {
        return {
          phase: self.phase, score: self.score, ballsLeft: self.ballsLeft, aim: self.aim, power: self.power,
          charging: self.charging, ball: { ...self.ball }, landing: { ...self.landing }, history: self.history.slice()
        };
      },
      startPlaying() { self.setPhase('AIM', 0); },
      throwAt(aim, power) { self.aim = aim; self.throwBall(power); },
      setBalls(n) { self.ballsLeft = n; },
      setScore(n) { self.score = n; self.scoreText = String(n); }
    };
  }
}

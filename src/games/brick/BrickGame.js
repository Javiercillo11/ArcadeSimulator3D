/* BRICK BLAST: rompe ladrillos con una pala y una bola. Reglas, rebotes, cápsulas, niveles y estados (sin dibujo).
   Contrato v2: new BrickGame({ level, rng, sfx }); update(input) a 60 Hz; score, lives, level, state, gameOver. */
import { makeRng } from '../../core/rng.js';

export const FIELD = { left: 8, right: 216, top: 24, bottom: 288 };
export const BRICK = { w: 16, h: 8, cols: 13, rows: 10, top: 44 };
const PADDLE_Y = 262;
const PADDLE_H = 6;
const PADDLE_W = 32;
const WIDE_W = 48;
const PADDLE_SPEED = 3.2;
const BALL_R = 2;
const MAX_ANGLE = Math.PI / 3;          // 60° al dar en el borde de la pala
const SPEED_MAX = 4.4;
const SERVE_AUTO = 150;                 // si no se lanza, sale sola a los 2,5 s
const EXTRA_LIFE_AT = 10000;
const POWER_FRAMES = 60 * 15;
export const ROW_POINTS = [70, 60, 50, 40, 30, 20, 10, 10, 10, 10];
const CAPSULE_CHANCE = 0.1;
const NO_SFX = () => {};

// Niveles: una fila de texto por fila de ladrillos. '.' vacío, 'x' normal, 'S' plateado (dos golpes).
const LEVELS = [
  ['.............', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx'],
  ['......S......', '.....xxx.....', '....xxxxx....', '...xxxxxxx...', '..xxxxxxxxx..', '.xxxxxxxxxxx.', 'SSSSSSSSSSSSS', 'xxxxxxxxxxxxx'],
  ['x.x.x.x.x.x.x', '.x.x.x.x.x.x.', 'x.x.x.x.x.x.x', '.S.S.S.S.S.S.', 'x.x.x.x.x.x.x', '.x.x.x.x.x.x.', 'x.x.x.x.x.x.x'],
  ['xx..xx.xx..xx', 'xx..xx.xx..xx', 'SS..SS.SS..SS', 'xx..xx.xx..xx', 'xx..xx.xx..xx', 'xx..xx.xx..xx', 'xxxxxxxxxxxxx', 'SSSSSSSSSSSSS']
];

export class BrickGame {
  constructor(opts = {}) {
    this.rand = opts.rng || makeRng(opts.seed || Date.now());
    this.sfx = opts.sfx || NO_SFX;
    this.bricks = new Uint8Array(BRICK.cols * BRICK.rows);   // 0 vacío, 1 normal, 2-3 plateado (golpes restantes + 1)
    this.paddle = { x: 112, w: PADDLE_W, wideTimer: 0 };
    this.ball = { x: 112, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, speed: 2, stuck: true, slowTimer: 0 };
    this.capsule = { active: false, x: 0, y: 0, type: 'W' };
    this.popups = [];
    for (let i = 0; i < 4; i++) this.popups.push({ timer: 0, x: 0, y: 0, text: '', color: '#fff' });
    this.frame = 0;
    this.finished = false;
    this.invulnerable = false;
    this.startGame(opts.level || 1);
    this.test = this.makeTestApi();
  }

  get state() { return this.phase; }
  get gameOver() { return this.finished; }

  setPhase(name, frames) {
    this.phase = name;
    this.timer = frames;
  }

  startGame(level) {
    this.score = 0;
    this.scoreText = '0';
    this.lives = 3;
    this.level = level;
    this.extraGiven = false;
    this.startLevel();
    this.setPhase('READY', 120);
  }

  startLevel() {
    this.levelText = 'NIVEL ' + this.level;
    const rows = LEVELS[(this.level - 1) % LEVELS.length];
    this.bricks.fill(0);
    rows.forEach((row, r) => {
      for (let c = 0; c < BRICK.cols; c++) {
        const ch = row[c];
        this.bricks[r * BRICK.cols + c] = ch === 'x' ? 1 : ch === 'S' ? 3 : 0;
      }
    });
    this.bricksLeft = this.countBricks();
    this.baseSpeed = Math.min(3.2, 2.0 + 0.2 * (this.level - 1));
    this.resetServe();
  }

  countBricks() {
    let n = 0;
    for (let i = 0; i < this.bricks.length; i++) if (this.bricks[i]) n++;
    return n;
  }

  resetServe() {
    const p = this.paddle;
    p.x = 112;
    p.w = PADDLE_W;
    p.wideTimer = 0;
    const b = this.ball;
    b.stuck = true;
    b.speed = this.baseSpeed;
    b.slowTimer = 0;
    b.vx = b.vy = 0;
    b.x = p.x;
    b.y = PADDLE_Y - BALL_R - 1;
    this.serveTimer = SERVE_AUTO;
    this.capsule.active = false;
  }

  addScore(n) {
    this.score += n;
    this.scoreText = String(this.score);
    if (!this.extraGiven && this.score >= EXTRA_LIFE_AT) {
      this.extraGiven = true;
      this.lives++;
      this.sfx('extra');
    }
  }

  popup(text, x, y, color) {
    for (const p of this.popups) {
      if (p.timer <= 0) { Object.assign(p, { text, x, y, color, timer: 40 }); return; }
    }
  }

  launch() {
    const b = this.ball;
    if (!b.stuck) return;
    b.stuck = false;
    // Sale un poco inclinada hacia el lado al que se mueve la pala (o al azar).
    const a = (this.rand() - 0.5) * 0.6;
    b.vx = Math.sin(a) * b.speed;
    b.vy = -Math.cos(a) * b.speed;
    this.sfx('bounce');
  }

  update(input) {
    if (this.finished) return;
    this.frame++;
    for (const p of this.popups) if (p.timer > 0) p.timer--;
    switch (this.phase) {
      case 'READY':
        this.movePaddle(input);
        if (--this.timer <= 0) this.setPhase('PLAYING', 0);
        break;
      case 'PLAYING':
        this.tick(input);
        break;
      case 'LIFE_LOST':
        if (--this.timer <= 0) {
          if (this.lives > 0) { this.resetServe(); this.setPhase('READY', 90); }
          else { this.setPhase('GAME_OVER', 180); this.sfx('gameOver'); }
        }
        break;
      case 'LEVEL_CLEAR':
        if (--this.timer <= 0) {
          this.level++;
          this.startLevel();
          this.setPhase('READY', 120);
        }
        break;
      case 'GAME_OVER':
        if (--this.timer <= 0) this.finished = true;
        break;
    }
  }

  movePaddle(input) {
    const p = this.paddle;
    const d = input && input.down;
    const dir = d ? (d.right ? 1 : 0) - (d.left ? 1 : 0) : 0;
    p.x += dir * PADDLE_SPEED;
    const half = p.w / 2;
    if (p.x < FIELD.left + half) p.x = FIELD.left + half;
    if (p.x > FIELD.right - half) p.x = FIELD.right - half;
    if (this.ball.stuck) this.ball.x = p.x;
  }

  tick(input) {
    this.movePaddle(input);
    const p = this.paddle;
    if (p.wideTimer > 0 && --p.wideTimer === 0) p.w = PADDLE_W;
    const b = this.ball;
    if (b.slowTimer > 0 && --b.slowTimer === 0) this.setSpeed(Math.max(b.speed, this.baseSpeed));
    if (b.stuck) {
      const pr = input && input.pressed;
      if ((pr && (pr.jump || pr.start)) || --this.serveTimer <= 0) this.launch();
      return;
    }
    this.moveCapsule();
    // Subpasos de como mucho 1 px para no atravesar ladrillos.
    const steps = Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)));
    for (let i = 0; i < steps; i++) {
      if (this.stepBall(b.vx / steps, b.vy / steps)) return;
      if (this.phase !== 'PLAYING') return;
    }
  }

  setSpeed(s) {
    const b = this.ball;
    const len = Math.hypot(b.vx, b.vy) || 1;
    b.speed = s;
    b.vx = b.vx / len * s;
    b.vy = b.vy / len * s;
  }

  // Devuelve true si la bola se ha perdido.
  stepBall(dx, dy) {
    const b = this.ball;
    const px = b.x, py = b.y;
    b.x += dx;
    b.y += dy;
    if (b.x < FIELD.left + BALL_R) { b.x = FIELD.left + BALL_R; b.vx = Math.abs(b.vx); this.sfx('bounce'); }
    else if (b.x > FIELD.right - BALL_R) { b.x = FIELD.right - BALL_R; b.vx = -Math.abs(b.vx); this.sfx('bounce'); }
    if (b.y < FIELD.top + BALL_R) { b.y = FIELD.top + BALL_R; b.vy = Math.abs(b.vy); this.sfx('bounce'); }

    // Pala: el ángulo de salida depende de dónde golpea.
    const p = this.paddle;
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && py + BALL_R <= PADDLE_Y + 1 && Math.abs(b.x - p.x) <= p.w / 2 + BALL_R) {
      const off = Math.max(-1, Math.min(1, (b.x - p.x) / (p.w / 2)));
      const speed = b.slowTimer > 0 ? b.speed : Math.min(SPEED_MAX, b.speed + 0.04);
      b.speed = speed;
      b.vx = Math.sin(off * MAX_ANGLE) * speed;
      b.vy = -Math.cos(off * MAX_ANGLE) * speed;
      b.y = PADDLE_Y - BALL_R;
      this.sfx('bounce');
    }

    this.hitBricks(px, py);
    if (this.bricksLeft === 0) {
      this.capsule.active = false;
      this.setPhase('LEVEL_CLEAR', 150);
      this.sfx('levelClear');
      return false;
    }
    if (b.y - BALL_R > FIELD.bottom) {
      if (this.invulnerable) { b.y = PADDLE_Y - BALL_R; b.vy = -Math.abs(b.vy); return false; }
      this.lives--;
      this.setPhase('LIFE_LOST', 90);
      this.sfx('death');
      return true;
    }
    return false;
  }

  hitBricks(px, py) {
    const b = this.ball;
    const c0 = Math.floor((b.x - BALL_R - FIELD.left) / BRICK.w);
    const c1 = Math.floor((b.x + BALL_R - FIELD.left) / BRICK.w);
    const r0 = Math.floor((b.y - BALL_R - BRICK.top) / BRICK.h);
    const r1 = Math.floor((b.y + BALL_R - BRICK.top) / BRICK.h);
    for (let r = r0; r <= r1; r++) {
      if (r < 0 || r >= BRICK.rows) continue;
      for (let c = c0; c <= c1; c++) {
        if (c < 0 || c >= BRICK.cols) continue;
        const i = r * BRICK.cols + c;
        if (!this.bricks[i]) continue;
        // Rebota en el eje por el que entró: si antes ya solapaba en x, venía por arriba o por abajo.
        const bx = FIELD.left + c * BRICK.w, by = BRICK.top + r * BRICK.h;
        const wasInX = px + BALL_R > bx && px - BALL_R < bx + BRICK.w;
        if (wasInX) { b.vy = -b.vy; b.y = py; } else { b.vx = -b.vx; b.x = px; }
        this.breakBrick(i, bx + BRICK.w / 2, by + BRICK.h / 2, r);
        return;
      }
    }
  }

  breakBrick(i, x, y, row) {
    const v = this.bricks[i];
    if (v === 3) {
      this.bricks[i] = 2;
      this.sfx('bounce');
      return;
    }
    this.bricks[i] = 0;
    this.bricksLeft--;
    const pts = v === 2 ? 50 * this.level : ROW_POINTS[row];
    this.addScore(pts);
    this.sfx('brick');
    if (!this.capsule.active && this.bricksLeft > 0 && this.rand() < CAPSULE_CHANCE) {
      const r = this.rand();
      Object.assign(this.capsule, { active: true, x, y, type: r < 0.45 ? 'W' : r < 0.9 ? 'S' : 'L' });
    }
  }

  moveCapsule() {
    const c = this.capsule;
    if (!c.active) return;
    c.y += 1;
    const p = this.paddle;
    if (c.y + 4 >= PADDLE_Y && c.y - 4 <= PADDLE_Y + PADDLE_H && Math.abs(c.x - p.x) <= p.w / 2 + 8) {
      c.active = false;
      this.addScore(100);
      this.sfx('score');
      if (c.type === 'W') { p.w = WIDE_W; p.wideTimer = POWER_FRAMES; this.popup('PALA ANCHA', p.x, PADDLE_Y - 12, '#33e6ff'); }
      else if (c.type === 'S') { this.ball.slowTimer = POWER_FRAMES; this.setSpeed(Math.max(1.6, this.baseSpeed * 0.75)); this.popup('LENTA', p.x, PADDLE_Y - 12, '#3dff8b'); }
      else { this.lives++; this.sfx('extra'); this.popup('+1 VIDA', p.x, PADDLE_Y - 12, '#ff8ad8'); }
    } else if (c.y > FIELD.bottom + 8) c.active = false;
  }

  makeTestApi() {
    const self = this;
    return {
      state() {
        const b = self.ball, p = self.paddle;
        return {
          phase: self.phase, level: self.level, score: self.score, lives: self.lives, bricksLeft: self.bricksLeft,
          ball: { x: b.x, y: b.y, vx: b.vx, vy: b.vy, speed: b.speed, stuck: b.stuck },
          paddle: { x: p.x, w: p.w }, capsule: { ...self.capsule }
        };
      },
      startPlaying() { self.setPhase('PLAYING', 0); },
      setBall(x, y, vx, vy) { Object.assign(self.ball, { x, y, vx, vy, stuck: false, speed: Math.hypot(vx, vy) }); },
      setPaddle(x) { self.paddle.x = x; },
      launch() { self.launch(); },
      brickAt(c, r) { return self.bricks[r * BRICK.cols + c]; },
      setBrick(c, r, v) { self.bricks[r * BRICK.cols + c] = v; self.bricksLeft = self.countBricks(); },
      clearBricks() { self.bricks.fill(0); self.bricksLeft = 0; },
      spawnCapsule(type, x, y) { Object.assign(self.capsule, { active: true, type, x, y }); },
      setInvulnerable(v) { self.invulnerable = !!v; },
      setLives(n) { self.lives = n; },
      setScore(n) { self.score = n; self.scoreText = String(n); },
      setLevel(n) { self.level = n; self.startLevel(); self.setPhase('PLAYING', 0); }
    };
  }
}

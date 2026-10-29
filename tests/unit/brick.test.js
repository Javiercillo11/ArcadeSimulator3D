import { describe, it, expect } from 'vitest';
import { BrickGame, FIELD, BRICK, ROW_POINTS } from '../../src/games/brick/BrickGame.js';
import { makeRng } from '../../src/core/rng.js';

function makeInput() {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  return { down: flags(), pressed: flags(), lastDir: null };
}

function playing() {
  const sounds = [];
  const game = new BrickGame({ rng: makeRng(12345), sfx: (n) => sounds.push(n) });
  game.test.startPlaying();
  const input = makeInput();
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      game.update(input);
      for (const k in input.pressed) input.pressed[k] = false;
    }
  };
  const press = (k) => { input.pressed[k] = true; };
  return { game, t: game.test, input, step, press, sounds };
}

describe('BRICK BLAST', () => {
  it('contrato: estado legible, arranca en READY con la bola en la pala', () => {
    const g = new BrickGame({ rng: makeRng(1) });
    expect([g.score, g.lives, g.level, g.state, g.gameOver]).toEqual([0, 3, 1, 'READY', false]);
    expect(g.test.state()).toMatchObject({ bricksLeft: 78, ball: { stuck: true } });
  });

  it('la pala se mueve con las flechas sin salirse del campo, y la bola va pegada', () => {
    const { t, step, input } = playing();
    input.down.left = true;
    step(100);                     // antes de que la bola salga sola (150 pasos)
    const s = t.state();
    expect(s.paddle.x).toBe(FIELD.left + 16);
    expect(s.ball).toMatchObject({ stuck: true, x: s.paddle.x });
    input.down.left = false;
    input.down.right = true;
    step(100);
    expect(t.state().paddle.x).toBe(FIELD.right - 16);
  });

  it('ESPACIO lanza la bola hacia arriba; si no, sale sola', () => {
    const a = playing();
    a.press('jump');
    a.step(1);
    expect(a.t.state().ball).toMatchObject({ stuck: false });
    expect(a.t.state().ball.vy).toBeLessThan(0);
    const b = playing();
    b.step(149);
    expect(b.t.state().ball.stuck).toBe(true);
    b.step(1);
    expect(b.t.state().ball.stuck).toBe(false);
  });

  it('rebota en las paredes laterales y en el techo', () => {
    const { t, step } = playing();
    t.clearBricks();
    t.setBrick(0, 9, 1);   // un ladrillo lejos para que no se acabe el nivel
    t.setBall(FIELD.left + 5, 100, -2, 0);
    step(5);
    expect(t.state().ball.vx).toBeGreaterThan(0);
    t.setBall(100, FIELD.top + 5, 0, -2);
    step(5);
    expect(t.state().ball.vy).toBeGreaterThan(0);
  });

  it('el ángulo de salida de la pala depende del punto de impacto', () => {
    const { t, step } = playing();
    t.clearBricks();
    t.setBrick(0, 9, 1);
    t.setPaddle(112);
    t.setBall(112, 250, 0, 2);
    step(8);
    const center = t.state().ball;
    expect(center.vy).toBeLessThan(0);
    expect(Math.abs(center.vx)).toBeLessThan(0.01);
    t.setPaddle(112);
    t.setBall(126, 250, 0, 2);
    step(8);
    const edge = t.state().ball;
    expect(edge.vx).toBeGreaterThan(1);
    expect(edge.vy).toBeLessThan(0);
  });

  it('romper un ladrillo suma los puntos de su fila y lo quita', () => {
    const { t, step, sounds } = playing();
    expect(t.brickAt(5, 1)).toBe(1);
    t.clearBricks();
    t.setBrick(5, 1, 1);
    t.setBrick(0, 9, 1);
    const x = FIELD.left + 5 * BRICK.w + 8, y = BRICK.top + 2 * BRICK.h + 6;
    t.setBall(x, y, 0, -2);
    step(3);
    expect(t.brickAt(5, 1)).toBe(0);
    expect(t.state().score).toBe(ROW_POINTS[1]);
    expect(t.state().ball.vy).toBeGreaterThan(0);
    expect(sounds).toContain('brick');
  });

  it('los ladrillos plateados necesitan dos golpes', () => {
    const { t, step } = playing();
    t.clearBricks();
    t.setBrick(6, 5, 3);
    t.setBrick(0, 0, 1);
    const x = FIELD.left + 6 * BRICK.w + 8, y = BRICK.top + 6 * BRICK.h + 4;
    t.setBall(x, y, 0, -2);
    step(3);
    expect(t.brickAt(6, 5)).toBe(2);
    t.setBall(x, y, 0, -2);
    step(3);
    expect(t.brickAt(6, 5)).toBe(0);
    expect(t.state().score).toBe(50);
  });

  it('perder la bola quita una vida y vuelve a sacar; sin vidas, GAME_OVER', () => {
    const { game, t, step } = playing();
    t.setBall(30, 280, 0, 3);
    step(5);
    expect([t.state().phase, t.state().lives]).toEqual(['LIFE_LOST', 2]);
    step(90);
    expect(t.state()).toMatchObject({ phase: 'READY', ball: { stuck: true } });
    t.setLives(1);
    step(120);
    t.setBall(30, 280, 0, 3);
    step(5);
    step(90);
    expect(game.state).toBe('GAME_OVER');
    step(180);
    expect(game.gameOver).toBe(true);
  });

  it('sin ladrillos se supera el nivel y el siguiente tiene otro diseño y más velocidad', () => {
    const { game, t, step, sounds } = playing();
    t.clearBricks();
    t.setBrick(3, 2, 1);
    const x = FIELD.left + 3 * BRICK.w + 8, y = BRICK.top + 3 * BRICK.h + 6;
    t.setBall(x, y, 0, -2);
    step(3);
    expect(t.state().phase).toBe('LEVEL_CLEAR');
    expect(sounds).toContain('levelClear');
    step(150);
    expect([game.level, t.state().phase]).toEqual([2, 'READY']);
    expect(t.brickAt(6, 0)).toBe(3);
    expect(t.state().ball.speed).toBeGreaterThan(2);
  });

  it('cápsulas: W ensancha la pala, S frena la bola y L da una vida', () => {
    const { t, step } = playing();
    t.clearBricks();
    t.setBrick(0, 0, 1);
    t.launch();
    const p = t.state().paddle;
    t.spawnCapsule('W', p.x, 250);
    step(15);
    expect(t.state().paddle.w).toBe(48);
    t.spawnCapsule('L', t.state().paddle.x, 250);
    step(15);
    expect(t.state().lives).toBe(4);
    expect(t.state().score).toBe(200);
  });

  it('con la misma semilla y la misma entrada, la partida es idéntica', () => {
    const a = playing(), b = playing();
    for (const r of [a, b]) {
      r.press('jump');
      r.input.down.right = true;
      r.step(300);
      r.input.down.right = false;
      r.input.down.left = true;
      r.step(300);
    }
    expect(a.t.state()).toEqual(b.t.state());
  });
});

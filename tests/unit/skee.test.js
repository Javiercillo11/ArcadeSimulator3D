import { describe, it, expect } from 'vitest';
import { SkeeGame, holeAt, LANE, TARGET, HUNDREDS, BALLS } from '../../src/games/skee/SkeeGame.js';
import { makeRng } from '../../src/core/rng.js';

function makeInput() {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  return { down: flags(), pressed: flags() };
}

function playing(seed = 3) {
  const sounds = [];
  const game = new SkeeGame({ rng: makeRng(seed), sfx: (n) => sounds.push(n) });
  const input = makeInput();
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      game.update(input);
      for (const k in input.pressed) input.pressed[k] = false;
    }
  };
  // Lanza y espera a que se cuente la bola.
  const resolve = () => { let n = 0; while (game.state !== 'AIM' && game.state !== 'GAME_OVER' && n++ < 2000) step(1); };
  return { game, t: game.test, input, step, sounds, resolve };
}

describe('SKEE-BALL', () => {
  it('contrato: 9 bolas, arranca apuntando', () => {
    const g = new SkeeGame({ rng: makeRng(1) });
    expect([g.score, g.lives, g.level, g.state, g.gameOver]).toEqual([0, BALLS, 1, 'AIM', false]);
  });

  it('los hoyos dan 50 en el centro, 10 fuera y 100 en las esquinas', () => {
    expect(holeAt(TARGET.x, TARGET.y)).toBe(50);
    expect(holeAt(TARGET.x + 20, TARGET.y)).toBe(40);
    expect(holeAt(TARGET.x, TARGET.y + 40)).toBe(30);
    expect(holeAt(TARGET.x - 55, TARGET.y)).toBe(20);
    expect(holeAt(TARGET.x, TARGET.y + 100)).toBe(10);
    expect(holeAt(HUNDREDS[0].x, HUNDREDS[0].y)).toBe(100);
    expect(holeAt(HUNDREDS[1].x + 5, HUNDREDS[1].y - 5)).toBe(100);
  });

  it('←/→ mueven la puntería dentro de la pista', () => {
    const { t, step, input } = playing();
    input.down.left = true;
    step(200);
    expect(t.state().aim).toBe(LANE.left + 10);
    input.down.left = false;
    input.down.right = true;
    step(200);
    expect(t.state().aim).toBe(LANE.right - 10);
  });

  it('mantener ESPACIO carga la fuerza, que sube y baja; soltar lanza', () => {
    const { t, step, input, sounds } = playing();
    input.down.jump = input.pressed.jump = true;
    step(20);
    const p1 = t.state().power;
    expect(p1).toBeGreaterThan(0.3);
    const seen = [];
    for (let i = 0; i < 40; i++) { step(1); seen.push(t.state().power); }
    expect(Math.max(...seen)).toBe(1);
    expect(seen.at(-1)).toBeLessThan(1);
    input.down.jump = false;
    step(1);
    expect(t.state().phase).toBe('ROLL');
    expect(sounds).toContain('jump');
  });

  it('poca fuerza: la bola no llega a la rampa y cuenta 10', () => {
    const { t, resolve } = playing();
    t.throwAt(112, 0);
    resolve();
    expect(t.state()).toMatchObject({ score: 10, ballsLeft: BALLS - 1, history: [10] });
  });

  it('con la fuerza justa y al centro, la bola cae en el 50', () => {
    const { t, resolve } = playing();
    t.throwAt(112, 0.28);
    resolve();
    expect(t.state().history).toEqual([50]);
  });

  it('más fuerza la lleva más lejos; arrimada a un lado entra en el 100', () => {
    const near = playing(), far = playing();
    near.t.throwAt(112, 0.2);
    far.t.throwAt(112, 0.5);
    let n = 0;
    while (near.t.state().phase !== 'FLY' && n++ < 500) near.step(1);
    n = 0;
    while (far.t.state().phase !== 'FLY' && n++ < 500) far.step(1);
    expect(far.t.state().landing.y).toBeLessThan(near.t.state().landing.y);
    const corner = playing();
    corner.t.throwAt(HUNDREDS[0].x + 2, 0.64);
    corner.resolve();
    expect(corner.t.state().history).toEqual([100]);
    expect(corner.sounds).toContain('skee100');
  });

  it('tras 9 bolas la partida termina con la suma de los hoyos', () => {
    const { game, t, resolve, step } = playing();
    for (let i = 0; i < BALLS; i++) { t.throwAt(112, 0.28); resolve(); }
    expect(game.state).toBe('GAME_OVER');
    expect(t.state().history).toHaveLength(BALLS);
    expect(game.score).toBe(t.state().history.reduce((a, b) => a + b, 0));
    expect(game.score).toBeGreaterThanOrEqual(BALLS * 30);
    step(120);
    expect(game.gameOver).toBe(true);
  });
});

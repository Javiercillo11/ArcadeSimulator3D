import { describe, it, expect } from 'vitest';
import { HockeyGame, TABLE, PUCK_R, MALLET_R, WIN_GOALS } from '../../src/games/hockey/HockeyGame.js';
import { makeRng } from '../../src/core/rng.js';

function makeInput() {
  const flags = () => ({ up: false, down: false, left: false, right: false, jump: false, start: false });
  return { down: flags(), pressed: flags(), move: { x: 0, y: 0 } };
}

function playing() {
  const sounds = [];
  const game = new HockeyGame({ rng: makeRng(7), sfx: (n) => sounds.push(n) });
  game.test.startPlaying();
  const input = makeInput();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.update(input); };
  return { game, t: game.test, input, step, sounds };
}

describe('AIR HOCKEY', () => {
  it('contrato: estado legible y arranca en READY con el disco en el campo del jugador', () => {
    const g = new HockeyGame({ rng: makeRng(1) });
    expect([g.score, g.level, g.state, g.gameOver, g.lives]).toEqual([0, 1, 'READY', false, WIN_GOALS]);
    expect(g.test.state().puck.y).toBeGreaterThan(TABLE.h / 2);
  });

  it('el mazo del jugador se mueve con las flechas y no pasa del centro ni de las bandas', () => {
    const { t, step, input } = playing();
    input.down.up = true;
    step(120);
    expect(t.state().player.y).toBe(TABLE.h / 2 + MALLET_R);
    input.down.up = false;
    input.down.left = true;
    step(120);
    expect(t.state().player.x).toBe(TABLE.rail + MALLET_R);
  });

  it('el disco rebota en las bandas y pierde velocidad por rozamiento', () => {
    const { t, step } = playing();
    t.setCpu(200, 30);
    t.setPlayer(200, 380);
    t.setPuck(30, 200, -6, 0);
    step(10);
    const s = t.state().puck;
    expect(s.vx).toBeGreaterThan(0);
    expect(Math.abs(s.vx)).toBeLessThan(6);
  });

  it('golpear el disco con el mazo lo lanza hacia la portería contraria', () => {
    const { t, step, input, sounds } = playing();
    t.setCpu(20, 30);
    t.setPuck(112, 300, 0, 0);
    t.setPlayer(112, 330);
    input.down.up = true;
    step(4);
    expect(t.state().puck.vy).toBeLessThan(-3);
    expect(sounds).toContain('puck');
  });

  it('meter el disco en la portería de arriba es gol del jugador (+500)', () => {
    const { t, step, sounds } = playing();
    t.setCpu(20, 200 - MALLET_R - 1);
    t.setPuck(112, 30, 0, -6);
    step(10);
    expect(t.state()).toMatchObject({ phase: 'GOAL', goals: { player: 1, cpu: 0 }, score: 500 });
    expect(sounds).toContain('goal');
    step(90);
    // Saca quien encajó: el disco vuelve parado al campo de la máquina.
    expect(t.state().phase).toBe('READY');
    expect(t.state().puck.y).toBeLessThan(TABLE.h / 2);
  });

  it('fuera de la boca de gol, el disco rebota en la banda de fondo', () => {
    const { t, step } = playing();
    t.setCpu(112, 150);
    t.setPuck(30, 30, 0, -5);
    step(10);
    expect(t.state().phase).toBe('PLAYING');
    expect(t.state().puck.vy).toBeGreaterThan(0);
    expect(t.state().puck.y).toBeGreaterThanOrEqual(TABLE.rail + PUCK_R);
  });

  it('la máquina defiende: sigue al disco y se interpone ante la portería', () => {
    const { t, step } = playing();
    t.setPuck(60, 300, 0, 0);
    step(90);
    const s = t.state();
    expect(s.cpu.x).toBeLessThan(112);
    expect(s.cpu.y).toBeLessThan(80);
  });

  it('la máquina ataca cuando el disco está en su campo', () => {
    const { t, step } = playing();
    t.setPuck(112, 120, 0, 0);
    let hit = false;
    for (let i = 0; i < 200 && !hit; i++) { step(1); if (t.state().puck.vy > 1) hit = true; }
    expect(hit).toBe(true);
  });

  it('a 7 goles termina: ganar da 3000 más 500 por gol no encajado', () => {
    const { game, t, step } = playing();
    t.setGoals(6, 2);
    t.setCpu(20, 200 - MALLET_R - 1);
    t.setPuck(112, 30, 0, -6);
    step(10);
    step(90);
    expect(game.state).toBe('GAME_OVER');
    expect(game.won).toBe(true);
    expect(game.score).toBe(7 * 500 + 3000 + 5 * 500);
    step(180);
    expect(game.gameOver).toBe(true);
  });

  it('perder 7-x da solo 500 por gol marcado', () => {
    const { game, t, step } = playing();
    t.setGoals(3, 6);
    t.setPlayer(20, 380);
    t.setPuck(112, 370, 0, 6);
    step(10);
    step(90);
    expect([game.won, game.score, game.lives]).toEqual([false, 1500, 0]);
  });

  it('con la misma semilla y la misma entrada, la partida es idéntica', () => {
    const a = playing(), b = playing();
    for (const r of [a, b]) { r.input.down.up = true; r.step(200); r.input.down.up = false; r.input.down.left = true; r.step(300); }
    expect(a.t.state()).toEqual(b.t.state());
  });
});

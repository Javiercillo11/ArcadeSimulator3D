import { describe, it, expect, beforeEach } from 'vitest';
import { storage, load, save, KEY, BACKUP_KEY, SCHEMA_VERSION, MAX_HISTORY, validate, importJSON } from '../../src/data/storage.js';
import * as users from '../../src/data/users.js';
import * as scores from '../../src/data/scores.js';

// localStorage en memoria, con opción de fallar como un navegador que lo bloquea.
function memoryLS(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

let ls;
function boot(initial) {
  ls = memoryLS(initial);
  storage.backend = ls;
  load();
}

beforeEach(() => boot());

describe('usuarios', () => {
  it('crea el primer usuario y queda activo', () => {
    const r = users.create('javi');
    expect(r.ok).toBe(true);
    expect(r.user.name).toBe('JAVI');
    expect(users.active().id).toBe(r.user.id);
  });

  it('sobrevive a una recarga', () => {
    users.create('ANA');
    load();
    expect(users.list().map((u) => u.name)).toEqual(['ANA']);
    expect(users.active().name).toBe('ANA');
  });

  it('crea exactamente 5 y bloquea el sexto', () => {
    for (const n of ['A', 'B', 'C', 'D', 'E']) expect(users.create(n).ok).toBe(true);
    expect(users.isFull()).toBe(true);
    expect(users.create('F')).toEqual({ ok: false, error: 'LIMIT' });
    expect(users.list()).toHaveLength(5);
  });

  it('rechaza nombres vacíos o de solo espacios', () => {
    expect(users.create('').error).toBe('EMPTY');
    expect(users.create('    ').error).toBe('EMPTY');
    expect(users.list()).toHaveLength(0);
  });

  it('recorta, pasa a mayúsculas y limita a 10 caracteres', () => {
    expect(users.create('  luisa ').user.name).toBe('LUISA');
    expect(users.create('abcdefghijk').error).toBe('TOO_LONG');
    expect(users.create('a<b>').error).toBe('INVALID');
    expect(users.create('ñandú_1').user.name).toBe('ÑANDÚ_1');
  });

  it('un duplicado con otras mayúsculas no crea otro perfil', () => {
    const a = users.create('JAVI');
    const b = users.create('javi');
    expect(b.ok).toBe(false);
    expect(b.error).toBe('DUPLICATE');
    expect(b.user.id).toBe(a.user.id);
    expect(users.list()).toHaveLength(1);
  });

  it('se borra y deja de estar activo', () => {
    const a = users.create('X').user;
    expect(users.remove(a.id)).toBe(true);
    expect(users.active()).toBe(null);
  });
});

describe('récords', () => {
  it('son independientes por usuario y por juego', () => {
    const a = users.create('A').user;
    const b = users.create('B').user;
    scores.submit(a.id, 'maze', 1200, 2);
    scores.submit(b.id, 'climb', 900, 1);
    expect(scores.record(a.id, 'maze').best).toBe(1200);
    expect(scores.record(a.id, 'climb').best).toBe(0);
    expect(scores.record(b.id, 'maze').best).toBe(0);
    expect(scores.record(b.id, 'climb').best).toBe(900);
    expect(scores.globalBest('maze')).toBe(1200);
  });

  it('una puntuación inferior no modifica el récord', () => {
    const a = users.create('A').user;
    expect(scores.submit(a.id, 'maze', 500, 1).isRecord).toBe(true);
    const r = scores.submit(a.id, 'maze', 300, 1);
    expect(r).toEqual({ isRecord: false, best: 500, previous: 500 });
  });

  it('el historial guarda solo las últimas 20 partidas por juego', () => {
    const a = users.create('A').user;
    for (let i = 0; i < 25; i++) scores.submit(a.id, 'maze', i, 1);
    scores.submit(a.id, 'climb', 7, 1);
    const maze = users.get(a.id).history.filter((h) => h.game === 'maze');
    expect(maze).toHaveLength(MAX_HISTORY);
    expect(maze[0].score).toBe(5);
    expect(users.get(a.id).history.filter((h) => h.game === 'climb')).toHaveLength(1);
  });

  it('la tabla ordena de mayor a menor y avisa a los oyentes', () => {
    const a = users.create('A').user;
    const b = users.create('B').user;
    let seen = null;
    scores.onChange((g) => { seen = g; });
    scores.submit(a.id, 'climb', 100, 1);
    scores.submit(b.id, 'climb', 400, 2);
    expect(seen).toBe('climb');
    expect(scores.table('climb').map((r) => r.name)).toEqual(['B', 'A']);
  });

  it('persiste tras recargar', () => {
    const a = users.create('A').user;
    scores.submit(a.id, 'maze', 4321, 3);
    load();
    expect(scores.record(a.id, 'maze')).toMatchObject({ best: 4321, level: 3 });
  });
});

describe('datos dañados y migración', () => {
  const v1 = {
    schemaVersion: 1,
    activeUserId: 'u_1',
    users: [{
      id: 'u_1', name: 'JAVI', createdAt: '2026-10-01T10:00:00.000Z',
      records: { maze: { best: 3000, date: '2026-10-02T10:00:00.000Z', level: 2 }, climb: { best: 0, date: null, level: 0 } },
      history: [{ game: 'maze', score: 3000, level: 2, date: '2026-10-02T10:00:00.000Z' }]
    }],
    settings: { muted: true, crt: false }
  };

  it('migra v1 → v2 conservando usuarios, récords y ajustes', () => {
    boot({ [KEY]: JSON.stringify(v1) });
    expect(storage.migrated).toBe(true);
    expect(storage.repaired).toBe(false);
    expect(ls.getItem(BACKUP_KEY)).toBe(null);
    expect(storage.data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(scores.record('u_1', 'maze').best).toBe(3000);
    expect(storage.data.settings).toEqual({ muted: true, crt: false, quality: 'high', mouseSens: 1 });
    expect(JSON.parse(ls.getItem(KEY)).schemaVersion).toBe(2);
  });

  it('repara campos dañados, guarda copia y recupera lo válido', () => {
    const bad = JSON.parse(JSON.stringify(v1));
    bad.schemaVersion = 2;
    bad.settings = { muted: false, crt: true, quality: 'high', mouseSens: 1 };
    bad.users.push({ id: 'u_2', name: 'javi', records: {} });            // duplicado
    bad.users.push({ id: 7, name: 'ROTO' });                            // id inválido
    bad.users[0].records.maze.best = -50;                               // récord negativo
    bad.users[0].history.push({ game: 'pong', score: 1, date: 'x' });   // juego desconocido
    const text = JSON.stringify(bad);
    boot({ [KEY]: text });
    expect(storage.repaired).toBe(true);
    expect(ls.getItem(BACKUP_KEY)).toBe(text);
    expect(users.list().map((u) => u.name)).toEqual(['JAVI']);
    expect(scores.record('u_1', 'maze').best).toBe(0);
    expect(users.get('u_1').history).toHaveLength(1);
  });

  it('JSON ilegible: copia de seguridad y arranque limpio', () => {
    boot({ [KEY]: '{esto no es json' });
    expect(storage.repaired).toBe(true);
    expect(ls.getItem(BACKUP_KEY)).toBe('{esto no es json');
    expect(users.list()).toEqual([]);
    expect(JSON.parse(ls.getItem(KEY)).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('una versión de esquema desconocida se trata como dañada', () => {
    expect(validate({ schemaVersion: 99, users: [] }).ok).toBe(false);
  });

  it('ajustes fuera de rango vuelven a su valor por defecto', () => {
    const r = validate({ schemaVersion: 2, users: [], settings: { muted: false, crt: true, quality: 'ultra', mouseSens: 40 } });
    expect(r.ok).toBe(false);
    expect(r.data.settings).toMatchObject({ quality: 'high', mouseSens: 1 });
  });

  it('sin localStorage se juega en modo memoria', () => {
    storage.backend = { getItem() { throw new Error('x'); }, setItem() { throw new Error('bloqueado'); }, removeItem() {} };
    load();
    expect(storage.mode).toBe('memory');
    expect(users.create('A').ok).toBe(true);
    expect(save()).toBe(false);
  });

  it('importa un JSON exportado', () => {
    expect(importJSON(JSON.stringify(v1))).toBe(true);
    expect(users.get('u_1').name).toBe('JAVI');
    expect(importJSON('nada')).toBe(false);
  });
});

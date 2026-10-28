// Pruebas de usuarios y persistencia (sección 5: Usuarios).
const { test, expect, open, createUser, state, storage } = require('./helpers');

test.describe('Usuarios', () => {
  test('se crea el primer usuario y se puede jugar al momento', async ({ page }) => {
    await open(page);
    await expect(page.locator('#panel-users')).toBeVisible();
    await createUser(page, 'Javi');
    await expect(page.locator('[data-testid=active-user]')).toHaveText('JAVI');
    await expect(page.locator('#panel-menu')).toBeVisible();
    await page.click('[data-testid=play-maze]');
    expect((await state(page)).app).toBe('TITLE');
  });

  test('el usuario sigue ahí tras recargar', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    await expect(page.locator('[data-testid=active-user]')).toHaveText('JAVI');
    expect((await state(page)).app).toBe('MENU');
    const data = await storage(page);
    expect(data.users.map((u) => u.name)).toEqual(['JAVI']);
  });

  test('se crea y se selecciona un segundo usuario', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    await createUser(page, 'ANA');
    await expect(page.locator('[data-testid=active-user]')).toHaveText('ANA');
    await page.click('[data-testid=btn-switch]');
    await expect(page.locator('[data-testid=user-JAVI]')).toBeVisible();
    await expect(page.locator('[data-testid=user-ANA]')).toBeVisible();
    await page.click('[data-testid=user-JAVI]');
    await expect(page.locator('[data-testid=active-user]')).toHaveText('JAVI');
    const data = await storage(page);
    expect(data.users).toHaveLength(2);
    expect(data.users.find((u) => u.id === data.activeUserId).name).toBe('JAVI');
  });

  test('se crean exactamente 5 usuarios y el sexto se bloquea con aviso', async ({ page }) => {
    await open(page);
    for (const n of ['UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO']) await createUser(page, n);
    await page.click('[data-testid=btn-switch]');
    await expect(page.locator('[data-testid=user-limit]')).toBeVisible();
    await expect(page.locator('[data-testid=user-limit]')).toHaveText('LÍMITE DE 5 JUGADORES');
    await expect(page.locator('[data-testid=user-name-input]')).toBeDisabled();
    await expect(page.locator('[data-testid=user-create]')).toBeDisabled();
    // Aunque se salte la interfaz, la capa de datos también lo impide.
    const res = await page.evaluate(() => window.Arcade.data.users.create('SEIS'));
    expect(res).toEqual({ ok: false, error: 'LIMIT' });
    expect((await storage(page)).users).toHaveLength(5);
  });

  test('se rechaza un nombre vacío o de solo espacios', async ({ page }) => {
    await open(page);
    await page.click('[data-testid=user-create]');
    await expect(page.locator('[data-testid=user-msg]')).toHaveText('ESCRIBE UN NOMBRE');
    await page.fill('[data-testid=user-name-input]', '     ');
    await page.click('[data-testid=user-create]');
    await expect(page.locator('[data-testid=user-msg]')).toHaveText('ESCRIBE UN NOMBRE');
    expect((await storage(page)).users).toHaveLength(0);
    expect((await state(page)).app).toBe('USER_SELECT');
  });

  test('los nombres se recortan, pasan a mayúsculas y se limitan a 10 caracteres', async ({ page }) => {
    await open(page);
    const r = await page.evaluate(() => [
      window.Arcade.data.users.validateName('  pepe  '),
      window.Arcade.data.users.validateName('ABCDEFGHIJK'),
      window.Arcade.data.users.normalize('  pepe ')
    ]);
    expect(r).toEqual([null, 'TOO_LONG', 'PEPE']);
    await expect(page.locator('[data-testid=user-name-input]')).toHaveAttribute('maxlength', '10');
  });

  test('un duplicado ("javi" frente a "JAVI") no crea otro perfil', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    await createUser(page, 'ANA');
    await createUser(page, 'javi');
    await expect(page.locator('[data-testid=user-msg]')).toContainText('YA EXISTE');
    await expect(page.locator('[data-testid=user-dup-select]')).toHaveText('SELECCIONAR JAVI');
    expect((await storage(page)).users).toHaveLength(2);
    await page.click('[data-testid=user-dup-select]');
    await expect(page.locator('[data-testid=active-user]')).toHaveText('JAVI');
    expect((await storage(page)).users).toHaveLength(2);
  });

  test('los récords son independientes por usuario y por juego', async ({ page }) => {
    await open(page);
    await createUser(page, 'JAVI');
    await page.evaluate(() => window.__arcadeTest.startGame('maze'));
    await page.evaluate(() => window.__arcadeTest.finishWith(1200, 2));
    await page.click('[data-testid=over-menu]');
    await createUser(page, 'ANA');
    await page.evaluate(() => window.__arcadeTest.startGame('climb'));
    await page.evaluate(() => window.__arcadeTest.finishWith(800, 1));
    await page.click('[data-testid=over-menu]');

    const data = await storage(page);
    const byName = Object.fromEntries(data.users.map((u) => [u.name, u.records]));
    expect(byName.JAVI.maze.best).toBe(1200);
    expect(byName.JAVI.maze.level).toBe(2);
    expect(byName.JAVI.climb.best).toBe(0);
    expect(byName.ANA.maze.best).toBe(0);
    expect(byName.ANA.climb.best).toBe(800);

    await expect(page.locator('[data-testid=best-maze]')).toHaveText('0');
    await expect(page.locator('[data-testid=best-climb]')).toHaveText('800');
    await page.click('[data-testid=btn-records]');
    await expect(page.locator('[data-testid=rec-row-JAVI]')).toContainText('1200');
    await expect(page.locator('[data-testid=rec-row-ANA]')).toContainText('800');
  });

  test('los datos dañados se recuperan con copia de seguridad', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.setItem('arcade.v1', JSON.stringify({
        schemaVersion: 1, activeUserId: 'u_ok',
        users: [
          { id: 'u_ok', name: 'BUENO', createdAt: '2026-01-01T00:00:00.000Z', records: { maze: { best: 500, date: '2026-01-01T00:00:00.000Z', level: 2 } }, history: [] },
          { name: 42 },
          'basura'
        ],
        settings: { muted: 'no' }
      }));
    });
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    const data = await storage(page);
    expect(data.users.map((u) => u.name)).toEqual(['BUENO']);
    expect(data.users[0].records.maze.best).toBe(500);
    expect(data.users[0].records.climb.best).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('arcade.backup'))).toContain('basura');
    await expect(page.locator('[data-testid=toast]')).toContainText('RECUPERADOS');
  });

  test('JSON ilegible: copia de seguridad y arranque limpio sin perder la copia', async ({ page }) => {
    await open(page);
    await page.evaluate(() => localStorage.setItem('arcade.v1', '{no es json'));
    await page.reload();
    await page.waitForSelector('html[data-ready]');
    expect(await page.evaluate(() => localStorage.getItem('arcade.backup'))).toBe('{no es json');
    expect((await state(page)).app).toBe('USER_SELECT');
  });
});

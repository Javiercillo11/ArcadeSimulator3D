/* Máquina de estados y navegación:
   USER_SELECT → MENU → TITLE → READY → PLAYING ⇄ PAUSED → LIFE_LOST → LEVEL_CLEAR → GAME_OVER → NEW_RECORD → MENU */
(function (A) {
  'use strict';

  var core = A.core;
  var data = A.data;
  var ui = A.ui;
  var loop = core.loop;
  var input = core.input;
  var audio = core.audio;
  var renderer = A.gfx.renderer;

  var IN_GAME = { TITLE: 1, READY: 1, PLAYING: 1, LIFE_LOST: 1, LEVEL_CLEAR: 1 };
  var TEST = /[?&]test=1\b/.test(location.search);

  var app = {
    state: 'BOOT',
    game: null,
    gameId: null,
    lastGame: null,
    paused: false,
    over: false,
    returnTo: 'MENU',
    seed: 0
  };

  var dom = {};

  // ---------------------------------------------------------------- arranque

  function boot() {
    data.storage.load();
    var settings = data.storage.data.settings;
    audio.setMuted(settings.muted);
    setCrt(settings.crt);

    renderer.init(document.getElementById('game'), document.getElementById('screen'), document.getElementById('screen-slot'), document.getElementById('bezel'));
    fitLater();
    A.gfx.text.init();

    dom.user = document.getElementById('active-user');
    dom.btnRecords = document.getElementById('btn-records');
    dom.btnSwitch = document.getElementById('btn-switch');
    dom.btnCrt = document.getElementById('btn-crt');
    dom.btnMute = document.getElementById('btn-mute');
    dom.canvas = document.getElementById('game');

    ui.overlays.init(app);
    ui.userSelect.init(app);
    ui.menu.init(app);
    ui.records.init(app);

    dom.btnRecords.addEventListener('click', function () { app.showRecords(); });
    dom.btnSwitch.addEventListener('click', function () { app.toUserSelect(); });
    dom.btnCrt.addEventListener('click', function () { setCrt(!data.storage.data.settings.crt, true); });
    dom.btnMute.addEventListener('click', toggleMute);
    var virtual = document.querySelectorAll('[data-action]');
    for (var i = 0; i < virtual.length; i++) input.bindVirtual(virtual[i]);

    input.on(onAction);
    audio.onUnlock(updateMuteButton);
    updateMuteButton();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && app.game && IN_GAME[app.state]) app.pause();
    });

    loop.setHandlers(update, render);
    if (TEST) installTestHooks();

    if (data.storage.mode === 'memory') ui.toast('SIN ALMACENAMIENTO: SE JUEGA EN MODO MEMORIA', 5000);
    else if (data.storage.repaired) ui.toast('DATOS DAÑADOS RECUPERADOS (COPIA EN arcade.backup)', 5000);

    app.refreshUser();
    if (data.users.active()) app.toMenu();
    else app.toUserSelect();
    document.documentElement.setAttribute('data-ready', '1');
  }

  // Recalcula la escala cuando cambia el diseño (fuentes cargadas, barra móvil, etc.).
  function fitLater() {
    requestAnimationFrame(function () { renderer.fit(); });
    if (window.ResizeObserver) new ResizeObserver(function () { renderer.fit(); }).observe(document.getElementById('screen-slot'));
  }

  // ---------------------------------------------------------------- ajustes

  function setCrt(on, save) {
    document.body.classList.toggle('crt-on', !!on);
    var b = document.getElementById('btn-crt');
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (save) {
      data.storage.data.settings.crt = !!on;
      data.storage.save();
    }
  }

  function toggleMute() {
    var m = !audio.isMuted();
    audio.setMuted(m);
    data.storage.data.settings.muted = m;
    data.storage.save();
    updateMuteButton();
    if (!m) audio.play('menuMove');
  }

  function updateMuteButton() {
    var m = audio.isMuted();
    dom.btnMute.setAttribute('aria-pressed', m ? 'true' : 'false');
    dom.btnMute.setAttribute('aria-label', m ? 'Activar sonido (M)' : 'Silenciar sonido (M)');
    var locked = !audio.unlocked();
    dom.btnMute.classList.toggle('is-locked', locked && !m);
    dom.btnMute.title = locked && !m ? 'El sonido se activa con la primera tecla o toque' : (m ? 'Activar sonido (M)' : 'Silenciar (M)');
  }

  // ---------------------------------------------------------------- navegación

  function hidePanels() {
    ui.userSelect.hide();
    ui.menu.hide();
    ui.records.hide();
  }

  function setState(s) {
    app.state = s;
    document.documentElement.setAttribute('data-state', s);
    var inGame = !!app.game && !app.over;
    dom.btnRecords.disabled = inGame;
    dom.btnSwitch.disabled = inGame;
  }

  app.refreshUser = function () {
    var u = data.users.active();
    dom.user.textContent = u ? u.name : '—';
  };

  app.selectUser = function (id) {
    if (!data.users.select(id)) return;
    app.refreshUser();
    app.toMenu();
  };

  app.toUserSelect = function () {
    endGame();
    ui.overlays.hide();
    hidePanels();
    setState('USER_SELECT');
    ui.userSelect.show();
  };

  app.toMenu = function () {
    endGame();
    ui.overlays.hide();
    hidePanels();
    if (!data.users.active()) { app.toUserSelect(); return; }
    setState('MENU');
    ui.menu.show();
  };

  app.showRecords = function () {
    if (app.game && !app.over) return;
    app.returnTo = app.state === 'USER_SELECT' ? 'USER_SELECT' : 'MENU';
    endGame();
    ui.overlays.hide();
    hidePanels();
    setState('RECORDS');
    ui.records.show();
  };

  app.showControls = function () {
    ui.overlays.showControls(function () {
      ui.overlays.hide();
      ui.focusFirst(ui.menu.panel());
    });
  };

  app.back = function () {
    if (app.returnTo === 'USER_SELECT' || !data.users.active()) app.toUserSelect();
    else app.toMenu();
  };

  // ---------------------------------------------------------------- partida

  app.startGame = function (id) {
    var factory = A.games[id];
    var user = data.users.active();
    if (!factory || !factory.create || !user) return;
    endGame();
    ui.overlays.hide();
    hidePanels();
    app.gameId = id;
    app.lastGame = id;
    app.paused = false;
    app.over = false;
    var game = factory.create();
    game.init({
      g: renderer.g,
      input: input,
      audio: audio,
      text: A.gfx.text,
      sprites: A.gfx.sprites,
      best: user.records[id].best,
      seed: app.seed || (Date.now() & 0xffffffff)
    }, user);
    app.game = game;
    input.clear();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    setState(game.getPhase());
    loop.start();
    render();
  };

  function endGame() {
    if (app.game) {
      app.game.destroy();
      app.game = null;
    }
    app.paused = false;
    app.over = false;
    loop.stop();
    audio.stopMusic();
    renderer.clear('#000');
  }

  app.pause = function () {
    if (!app.game || app.paused || app.over) return;
    app.paused = true;
    app.game.pause();
    setState('PAUSED');
    ui.overlays.showPause({ resume: app.resume, restart: app.restart, menu: app.toMenu });
  };

  app.resume = function () {
    if (!app.game || !app.paused) return;
    app.paused = false;
    ui.overlays.hide();
    input.clear();
    app.game.resume();
    setState(app.game.getPhase());
  };

  app.restart = function () {
    if (app.gameId) app.startGame(app.gameId);
  };

  function finishGame() {
    var game = app.game;
    var user = data.users.active();
    var score = game.getScore();
    var level = game.getLevel();
    var res = data.scores.submit(user.id, app.gameId, score, level);
    app.over = true;
    loop.stop();
    setState(res.isRecord ? 'NEW_RECORD' : 'GAME_OVER');
    if (res.isRecord) audio.play('record');
    ui.overlays.showGameOver({
      gameName: A.games[app.gameId].name,
      score: score,
      level: level,
      best: res.best,
      previous: res.previous,
      isRecord: res.isRecord
    }, { retry: app.restart, menu: app.toMenu });
  }

  function update(dt) {
    var game = app.game;
    if (game && !app.paused && !app.over) {
      game.update(dt);
      if (game.isFinished()) finishGame();
      else if (app.state !== game.getPhase()) setState(game.getPhase());
    }
    input.endStep();
  }

  function render() {
    if (app.game) app.game.render();
  }

  // ---------------------------------------------------------------- teclas globales

  function visibleNavContainer() {
    if (ui.overlays.isOpen()) return ui.overlays.root();
    if (app.state === 'USER_SELECT') return ui.userSelect.panel();
    if (app.state === 'MENU') return ui.menu.panel();
    if (app.state === 'RECORDS') return ui.records.panel();
    return null;
  }

  function onAction(action, source) {
    if (action === 'mute') { toggleMute(); return; }

    if (action === 'pause') {
      if (app.paused) { app.resume(); return; }
      if (app.game && !app.over && IN_GAME[app.state]) { app.pause(); return; }
      if (ui.overlays.current === 'controls') { ui.overlays.hide(); ui.focusFirst(ui.menu.panel()); return; }
      if (app.over || app.state === 'RECORDS') { app.back(); return; }
      if (app.state === 'USER_SELECT' && data.users.active()) app.toMenu();
      return;
    }

    var nav = visibleNavContainer();
    if (!nav) return;
    if (action === 'up' || action === 'left') ui.navigate(nav, -1);
    else if (action === 'down' || action === 'right') ui.navigate(nav, 1);
    else if (action === 'start' || action === 'jump') {
      var focused = document.activeElement;
      var inside = focused && nav.contains(focused) && focused.tagName === 'BUTTON';
      // El teclado activa el botón enfocado por sí solo; los mandos táctiles necesitan ayuda.
      if (source === 'virtual' && inside) focused.click();
      else if (!inside) ui.focusFirst(nav);
    }
  }

  // ---------------------------------------------------------------- ganchos de prueba (?test=1)

  function installTestHooks() {
    loop.manual = true;
    window.__arcadeTest = {
      state: function () {
        return {
          app: app.state, gameId: app.gameId, phase: app.game ? app.game.getPhase() : null,
          activeLoops: loop.activeLoops, pending: loop.pending, maxPending: loop.maxPending,
          running: loop.running, storageMode: data.storage.mode, paused: app.paused
        };
      },
      game: function () { return app.game ? app.game.test : null; },
      step: function (n) { loop.step(n || 1); return window.__arcadeTest.state(); },
      setManual: function (v) { loop.manual = !!v; },
      loopCount: function () { return loop.activeLoops; },
      startGame: function (id) { app.startGame(id); },
      goTo: function (s) {
        if (s === 'MENU') app.toMenu();
        else if (s === 'USER_SELECT') app.toUserSelect();
        else if (s === 'RECORDS') app.showRecords();
      },
      setSeed: function (n) { app.seed = n; },
      simulateSteps: function (frameMs, totalMs) { return loop.simulate(frameMs, totalMs); },
      // Termina la partida actual con la puntuación dada (para probar récords).
      finishWith: function (score, level) {
        var g = app.game;
        if (!g) return;
        g.score = score;
        if (level) g.level = level;
        g.finished = true;
        loop.step(1);
      },
      storage: function () { return JSON.parse(JSON.stringify(data.storage.data)); }
    };
  }

  // La fuente incrustada debe estar lista antes de generar el atlas de texto.
  var booted = false;
  function safeBoot() {
    if (booted) return;
    booted = true;
    boot();
  }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('8px ArcadeFont').then(safeBoot, safeBoot);
    setTimeout(safeBoot, 1500);
  } else {
    safeBoot();
  }

  A.app = app;
})(window.Arcade = window.Arcade || {});

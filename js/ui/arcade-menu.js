/* Menú de la máquina: dos botones de juego, acceso a récords y controles. */
(function (A) {
  'use strict';

  var ui = A.ui;
  var app;
  var panel;
  var artDrawn = false;

  var menu = {};

  menu.init = function (theApp) {
    app = theApp;
    panel = document.getElementById('panel-menu');
    var cards = panel.querySelectorAll('.game-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function (e) {
        A.core.audio.play('menuSelect');
        app.startGame(e.currentTarget.getAttribute('data-game'));
      });
    }
    document.getElementById('menu-records').addEventListener('click', function () { app.showRecords(); });
    document.getElementById('menu-controls').addEventListener('click', function () { app.showControls(); });
    menu.drawMascots();
  };

  // Miniaturas pixeladas con los sprites de cada juego.
  function drawArt() {
    if (artDrawn) return;
    artDrawn = true;
    var S = A.gfx.sprites;
    A.games.mazeSprites.build();
    A.games.climbSprites.build();

    var g = document.getElementById('art-maze').getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 96, 40);
    g.fillStyle = '#3d5cff';
    g.fillRect(0, 4, 96, 1); g.fillRect(0, 35, 96, 1);
    g.fillRect(0, 4, 1, 32); g.fillRect(95, 4, 1, 32);
    g.fillStyle = '#ffd6a8';
    for (var x = 28; x < 92; x += 8) g.fillRect(x, 19, 2, 2);
    g.drawImage(S.get('munch2'), 8, 14);
    g.drawImage(S.get('spook0_0'), 52, 13);
    g.drawImage(S.get('spook2_1'), 72, 13);

    var c = document.getElementById('art-climb').getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#000';
    c.fillRect(0, 0, 96, 40);
    c.fillStyle = '#c41e5a';
    for (var gx = 0; gx < 96; gx++) {
      c.fillRect(gx, 34 - Math.floor(gx / 24), 1, 4);
      if (gx < 70) c.fillRect(gx, 16 + Math.floor(gx / 24), 1, 3);
    }
    c.fillStyle = '#33e6ff';
    for (var ly = 19; ly < 33; ly++) { c.fillRect(56, ly, 1, 1); c.fillRect(63, ly, 1, 1); if (ly % 3 === 0) c.fillRect(57, ly, 6, 1); }
    c.drawImage(S.get('pipStand'), 14, 17);
    c.drawImage(S.get('barrel1'), 40, 23);
    c.drawImage(S.get('barrel3'), 74, 21);
    c.drawImage(S.get('grogIdle'), 4, -8);
  }

  // Mascotas de la marquesina: dinosaurios originales (de perfil, con cresta, barriga y cola),
  // generados por geometría en una rejilla de 32×30 y contorneados en azul marino.
  function dinoRows() {
    var W = 32;
    var H = 30;
    function ell(x, y, cx, cy, rx, ry) { var dx = (x - cx) / rx; var dy = (y - cy) / ry; return dx * dx + dy * dy <= 1; }
    function tri(x, y, a, b, c) {
      function sg(p, q, r) { return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]); }
      var p = [x, y];
      var d1 = sg(p, a, b), d2 = sg(p, b, c), d3 = sg(p, c, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    }
    var SPIKES = [[[12, 7], [16, 5], [11, 2]], [[8, 11], [12, 8], [6, 6]], [[4, 16], [8, 12], [1, 11]]];
    function fill(x, y) {
      var px = x + 0.5;
      var py = y + 0.5;
      if (ell(px, py, 22, 6.2, 1.6, 1.8)) return (px > 22 && py > 6) ? 'p' : 'e';            // ojo
      if (py > 10.4 && py < 11.6 && px > 23 && px < 29) return 'm';                          // boca
      var head = ell(px, py, 21, 8, 6.5, 5.8) || ell(px, py, 26, 10, 4.2, 3.2);
      var neck = ell(px, py, 16, 13, 4.6, 5);
      var body = ell(px, py, 12, 19.5, 8.5, 7.5);
      var tail = tri(px, py, [5, 15], [6, 24], [0, 26]);
      var leg = (px > 7 && px < 11 && py >= 25 && py < 29) || (px > 14 && px < 18 && py >= 25 && py < 29);
      var arm = px > 19 && px < 22.5 && py > 17 && py < 19.5;
      if (ell(px, py, 14, 21, 5, 5) && body) return 'w';                                    // barriga
      if (head || neck || body || tail || leg || arm) {
        if (ell(px, py, 19, 4.6, 3, 1.6)) return 'h';                                       // brillo
        if (leg && py >= 27) return 'f';
        return 'b';
      }
      for (var i = 0; i < SPIKES.length; i++) if (tri(px, py, SPIKES[i][0], SPIKES[i][1], SPIKES[i][2])) return 's';
      return '.';
    }
    var grid = [];
    for (var y = 0; y < H; y++) { var r = ''; for (var x = 0; x < W; x++) r += fill(x, y); grid.push(r); }
    // Contorno: píxel vacío con un vecino lleno.
    var out = [];
    for (var y2 = 0; y2 < H; y2++) {
      var row = '';
      for (var x2 = 0; x2 < W; x2++) {
        var c = grid[y2].charAt(x2);
        if (c === '.') {
          var n = (grid[y2].charAt(x2 - 1) || '.') + (grid[y2].charAt(x2 + 1) || '.') +
                  (y2 > 0 ? grid[y2 - 1].charAt(x2) : '.') + (y2 < H - 1 ? grid[y2 + 1].charAt(x2) : '.');
          c = n.replace(/\./g, '') ? 'k' : '.';
        }
        row += c;
      }
      out.push(row);
    }
    return out;
  }

  var DINOS = [
    { id: 'mascot-left', name: 'dinoBlue', pal: { b: '#3d8ff0', h: '#9fd0ff', w: '#fff3c4', s: '#ffd92f', f: '#ff4c92' } },
    { id: 'mascot-right', name: 'dinoGreen', pal: { b: '#3fc24a', h: '#a6f29a', w: '#fff3c4', s: '#ffd92f', f: '#ff4c92' } }
  ];

  menu.drawMascots = function () {
    var S = A.gfx.sprites;
    var rows = dinoRows();
    for (var i = 0; i < DINOS.length; i++) {
      var d = DINOS[i];
      var pal = { k: '#0d2f57', e: '#ffffff', p: '#0d2f57', m: '#ff4c92' };
      for (var k in d.pal) pal[k] = d.pal[k];
      if (!S.has(d.name)) S.define(d.name, rows, pal);
      var c = document.getElementById(d.id);
      if (!c) continue;
      var g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      // El de la derecha mira hacia el título.
      g.drawImage(S.get(d.name, i === 1), 0, 0);
    }
  };

  menu.show = function () {
    var u = A.data.users.active();
    document.getElementById('best-maze').textContent = u ? u.records.maze.best : 0;
    document.getElementById('best-climb').textContent = u ? u.records.climb.best : 0;
    drawArt();
    panel.hidden = false;
    var last = app.lastGame ? panel.querySelector('[data-game="' + app.lastGame + '"]') : null;
    (last || panel.querySelector('.game-card')).focus();
  };

  menu.hide = function () { panel.hidden = true; };
  menu.panel = function () { return panel; };

  ui.menu = menu;
})(window.Arcade = window.Arcade || {});

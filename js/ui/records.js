/* Pantalla de récords: tabla jugadores × juegos con fecha, exportar e importar JSON. */
(function (A) {
  'use strict';

  var ui = A.ui;
  var el = ui.el;
  var S = A.data.storage;
  var scores = A.data.scores;

  var app;
  var panel, body, note, fileInput;

  var records = {};

  records.init = function (theApp) {
    app = theApp;
    panel = document.getElementById('panel-records');
    body = document.getElementById('records-body');
    note = document.getElementById('records-note');
    fileInput = document.getElementById('records-file');

    document.getElementById('records-back').addEventListener('click', function () { app.back(); });
    document.getElementById('records-export').addEventListener('click', exportJSON);
    document.getElementById('records-import').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        if (S.importJSON(String(reader.result))) {
          ui.toast('RÉCORDS IMPORTADOS');
          app.refreshUser();
          records.render();
        } else {
          ui.toast('ARCHIVO NO VÁLIDO');
        }
        fileInput.value = '';
      };
      reader.readAsText(f);
    });
  };

  function exportJSON() {
    var blob = new Blob([S.exportJSON()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'arcade-records.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    ui.toast('RÉCORDS EXPORTADOS');
  }

  function cell(rec) {
    return el('td', null, [
      el('span', { class: 'rec-score', text: String(rec.best) }),
      el('span', { class: 'rec-date', text: scores.formatDate(rec.date) })
    ]);
  }

  records.render = function () {
    var all = A.data.users.list();
    var active = A.data.users.active();
    body.textContent = '';
    for (var i = 0; i < all.length; i++) {
      var u = all[i];
      body.appendChild(el('tr', { class: active && active.id === u.id ? 'is-active' : '', 'data-testid': 'rec-row-' + u.name }, [
        el('td', { text: u.name }),
        cell(u.records.maze),
        cell(u.records.climb)
      ]));
    }
    for (var k = all.length; k < S.MAX_USERS; k++) {
      body.appendChild(el('tr', null, [el('td', { class: 'rec-empty', colspan: '3', text: '— LIBRE —' })]));
    }
    note.textContent = S.mode === 'memory' ? 'MODO MEMORIA: NO SE GUARDA' : 'GUARDADO EN ESTE NAVEGADOR';
  };

  records.show = function () {
    records.render();
    panel.hidden = false;
    ui.focusFirst(panel);
  };

  records.hide = function () { panel.hidden = true; };
  records.panel = function () { return panel; };

  ui.records = records;
})(window.Arcade = window.Arcade || {});

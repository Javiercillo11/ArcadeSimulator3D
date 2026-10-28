/* Pantalla de selección y alta de jugadores. */
(function (A) {
  'use strict';

  var ui = A.ui;
  var users = A.data.users;
  var el = ui.el;

  var ERRORS = {
    EMPTY: 'ESCRIBE UN NOMBRE',
    TOO_LONG: 'MÁXIMO 10 CARACTERES',
    INVALID: 'SOLO LETRAS, NÚMEROS, ESPACIO . - _',
    LIMIT: 'LÍMITE DE 5 JUGADORES'
  };

  var app;
  var panel, list, empty, form, input, createBtn, msg, dupBtn, limit;
  var confirmId = null;
  var confirmTimer = 0;

  var userSelect = {};

  userSelect.init = function (theApp) {
    app = theApp;
    panel = document.getElementById('panel-users');
    list = document.getElementById('user-list');
    empty = document.getElementById('user-empty');
    form = document.getElementById('user-form');
    input = document.getElementById('user-name');
    createBtn = document.getElementById('user-create');
    msg = document.getElementById('user-msg');
    dupBtn = document.getElementById('user-dup-select');
    limit = document.getElementById('user-limit');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
    input.addEventListener('input', function () {
      var start = input.selectionStart;
      var end = input.selectionEnd;
      input.value = input.value.toUpperCase();
      try { input.setSelectionRange(start, end); } catch (err) { /* sin cursor */ }
      setMessage('');
    });
    input.addEventListener('keydown', function (e) {
      // Desde el campo, flecha arriba vuelve a la lista de jugadores.
      if (e.key === 'ArrowUp' && list.lastElementChild) {
        e.preventDefault();
        var btns = list.querySelectorAll('.user-btn');
        if (btns.length) btns[btns.length - 1].focus();
      }
    });
  };

  function setMessage(text, dupUser) {
    msg.textContent = text;
    if (dupUser) {
      dupBtn.hidden = false;
      dupBtn.textContent = 'SELECCIONAR ' + dupUser.name;
      dupBtn.onclick = function () { app.selectUser(dupUser.id); };
    } else {
      dupBtn.hidden = true;
      dupBtn.onclick = null;
    }
  }

  function submit() {
    var res = users.create(input.value);
    if (res.ok) {
      input.value = '';
      setMessage('');
      A.core.audio.play('menuSelect');
      app.selectUser(res.user.id);
      return;
    }
    A.core.audio.play('error');
    if (res.error === 'DUPLICATE') {
      setMessage('«' + res.user.name + '» YA EXISTE', res.user);
      dupBtn.focus();
    } else {
      setMessage(ERRORS[res.error] || 'NOMBRE NO VÁLIDO');
      input.focus();
    }
    userSelect.render();
  }

  function onDelete(user, btn) {
    if (confirmId !== user.id) {
      confirmId = user.id;
      btn.textContent = '¿BORRAR?';
      btn.classList.add('is-confirm');
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(function () { confirmId = null; userSelect.render(); }, 3000);
      return;
    }
    confirmId = null;
    clearTimeout(confirmTimer);
    users.remove(user.id);
    app.refreshUser();
    userSelect.render();
    ui.focusFirst(panel);
  }

  userSelect.render = function () {
    var all = users.list();
    var active = users.active();
    list.textContent = '';
    for (var i = 0; i < all.length; i++) {
      (function (u) {
        var del = el('button', {
          type: 'button', class: 'user-del', 'aria-label': 'Borrar a ' + u.name, title: 'Borrar jugador',
          'data-testid': 'user-del-' + u.name, text: '×'
        });
        del.addEventListener('click', function () { onDelete(u, del); });
        var btn = el('button', {
          type: 'button', class: 'user-btn' + (active && active.id === u.id ? ' is-active' : ''),
          'data-nav': true, 'data-testid': 'user-' + u.name, 'data-id': u.id,
          onclick: function () { A.core.audio.play('menuSelect'); app.selectUser(u.id); }
        }, [
          el('span', { class: 'user-name', text: u.name }),
          el('span', { class: 'user-stats', text: 'MZ ' + u.records.maze.best + ' · BC ' + u.records.climb.best })
        ]);
        list.appendChild(el('li', { class: 'user-item' }, [btn, del]));
      })(all[i]);
    }
    empty.hidden = all.length > 0;
    var full = users.isFull();
    input.disabled = full;
    createBtn.disabled = full;
    limit.hidden = !full;
    if (!full && msg.textContent === ERRORS.LIMIT) setMessage('');
  };

  userSelect.show = function () {
    setMessage('');
    input.value = '';
    userSelect.render();
    panel.hidden = false;
    var activeBtn = list.querySelector('.user-btn.is-active') || list.querySelector('.user-btn');
    if (activeBtn) activeBtn.focus();
    else if (!input.disabled) input.focus();
  };

  userSelect.hide = function () { panel.hidden = true; };
  userSelect.panel = function () { return panel; };

  ui.userSelect = userSelect;
})(window.Arcade = window.Arcade || {});

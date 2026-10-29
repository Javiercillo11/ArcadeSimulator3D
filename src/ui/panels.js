/* Paneles HTML: selección de usuario, menú de la sala, pausa de la máquina, récords y controles.
   Solo muestran y recogen datos; las decisiones las toma App mediante los callbacks de `app`. */
import { $, el, focusFirst, toast } from './dom.js';
import * as users from '../data/users.js';
import * as scores from '../data/scores.js';
import { storage, MAX_USERS, GAMES as GAME_IDS, exportJSON, importJSON } from '../data/storage.js';
import { audio, TRACK_NAMES } from '../core/audio.js';
import { PRIZES } from '../data/prizes.js';
import { ACHIEVEMENTS } from '../data/achievements.js';

const PANELS = ['panel-users', 'panel-menu', 'panel-pause', 'panel-records', 'panel-controls', 'panel-reception', 'panel-jukebox', 'panel-achievements'];

export function hideAll() {
  for (const id of PANELS) $(id).hidden = true;
}

export function openPanel() {
  return PANELS.find((id) => !$(id).hidden) || null;
}

function show(id) {
  hideAll();
  const p = $(id);
  p.hidden = false;
  focusFirst(p);
  return p;
}

// ------------------------------------------------------------ usuarios

export function initUsers(app) {
  const input = $('user-name');
  const msg = $('user-msg');
  const dup = $('user-dup-select');
  let confirmId = null;
  let confirmTimer = 0;

  const setMessage = (t, dupUser) => {
    msg.textContent = t;
    dup.hidden = !dupUser;
    dup.onclick = dupUser ? () => { app.selectUser(dupUser.id); renderUsers(); } : null;
    if (dupUser) dup.textContent = 'SELECCIONAR ' + dupUser.name;
  };

  $('user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = users.create(input.value);
    if (res.ok) {
      input.value = '';
      setMessage('');
      audio.play('menuSelect');
      app.selectUser(res.user.id);
      renderUsers();
      $('user-enter').focus();
      return;
    }
    audio.play('error');
    if (res.error === 'DUPLICATE') {
      setMessage('«' + res.user.name + '» YA EXISTE', res.user);
      dup.focus();
    } else {
      setMessage(users.ERROR_TEXT[res.error] || 'NOMBRE NO VÁLIDO');
      input.focus();
    }
    renderUsers();
  });
  input.addEventListener('input', () => {
    const s = input.selectionStart, e = input.selectionEnd;
    input.value = input.value.toUpperCase();
    try { input.setSelectionRange(s, e); } catch (err) { /* sin cursor */ }
    setMessage('');
  });
  $('user-enter').addEventListener('click', () => app.enterRoom());

  function onDelete(u, btn) {
    if (confirmId !== u.id) {
      confirmId = u.id;
      btn.textContent = '¿BORRAR?';
      btn.classList.add('is-confirm');
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { confirmId = null; renderUsers(); }, 3000);
      return;
    }
    confirmId = null;
    clearTimeout(confirmTimer);
    users.remove(u.id);
    app.usersChanged();
    renderUsers();
    focusFirst($('panel-users'));
  }

  function renderUsers() {
    const list = $('user-list');
    const all = users.list();
    const active = users.active();
    list.textContent = '';
    for (const u of all) {
      const del = el('button', { type: 'button', class: 'btn user-del', 'aria-label': 'Borrar a ' + u.name, 'data-testid': 'user-del-' + u.name, text: '×' });
      del.addEventListener('click', () => onDelete(u, del));
      const btn = el('button', {
        type: 'button', class: 'btn user-btn' + (active && active.id === u.id ? ' is-active' : ''),
        'data-testid': 'user-' + u.name, 'aria-pressed': active && active.id === u.id ? 'true' : 'false',
        onclick: () => { audio.play('menuSelect'); app.selectUser(u.id); renderUsers(); $('user-enter').focus(); }
      }, [
        el('span', { class: 'user-name', text: u.name }),
        el('span', { class: 'user-stats', text: 'MZ ' + u.records.maze.best + ' · BC ' + u.records.climb.best + ' · ' + u.coins + ' MON. · ' + u.tickets + ' TIC.' })
      ]);
      list.appendChild(el('li', { class: 'user-item' }, [btn, del]));
    }
    $('user-empty').hidden = all.length > 0;
    const full = users.isFull();
    input.disabled = full;
    $('user-create').disabled = full;
    $('user-limit').hidden = !full;
    const enter = $('user-enter');
    enter.disabled = !active;
    enter.textContent = active ? 'ENTRAR AL SALÓN COMO ' + active.name : 'ENTRAR AL SALÓN';
  }

  return {
    show() {
      setMessage('');
      input.value = '';
      renderUsers();
      show('panel-users');
      const active = $('user-list').querySelector('.is-active');
      if (active) $('user-enter').focus();
      else if (!input.disabled) input.focus();
    },
    render: renderUsers
  };
}

// ------------------------------------------------------------ menú de la sala y pausa

export function initMenu(app) {
  $('menu-resume').addEventListener('click', () => app.resume());
  $('menu-records').addEventListener('click', () => app.showRecords());
  $('menu-switch').addEventListener('click', () => app.toUserSelect());
  $('menu-controls').addEventListener('click', () => app.showControls());
  $('menu-achievements').addEventListener('click', () => app.showAchievements());
  $('menu-fullscreen').addEventListener('click', () => app.toggleFullscreen());
  $('pause-big').addEventListener('click', () => { app.resume(); app.toggleBig(); });
  $('menu-sound').addEventListener('click', () => { app.toggleMute(); renderMenu(); });
  $('menu-crt').addEventListener('click', () => { app.setCrt(!storage.data.settings.crt); renderMenu(); });
  $('menu-quality').addEventListener('click', () => { app.setQuality(storage.data.settings.quality === 'low' ? 'high' : 'low'); renderMenu(); });
  $('menu-sens').addEventListener('input', (e) => app.setSensitivity(Number(e.target.value)));
  $('pause-resume').addEventListener('click', () => app.resume());
  $('pause-restart').addEventListener('click', () => app.restartGame());
  $('pause-stand').addEventListener('click', () => app.standUp());

  function renderMenu() {
    const s = storage.data.settings;
    const u = users.active();
    $('menu-user').textContent = u ? 'JUGADOR: ' + u.name : '';
    $('menu-sound').textContent = 'SONIDO: ' + (audio.isMuted() ? 'NO' : 'SÍ');
    $('menu-sound').setAttribute('aria-pressed', audio.isMuted() ? 'false' : 'true');
    $('menu-crt').textContent = 'PANTALLA CRT: ' + (s.crt ? 'SÍ' : 'NO');
    $('menu-crt').setAttribute('aria-pressed', s.crt ? 'true' : 'false');
    $('menu-quality').textContent = 'CALIDAD: ' + (s.quality === 'low' ? 'BAJA' : 'ALTA');
    $('menu-sens').value = String(s.mouseSens);
    $('menu-fullscreen').textContent = 'PANTALLA COMPLETA: ' + (document.fullscreenElement ? 'SÍ' : 'NO');
  }

  return {
    showMenu() { renderMenu(); show('panel-menu'); },
    showPause(gameName, coins, hasScreen) {
      $('pause-game').textContent = gameName + ' · MONEDAS ' + coins;
      $('pause-big').hidden = !hasScreen;
      $('pause-restart').textContent = coins > 0 ? 'REINICIAR (1 MONEDA)' : 'REINICIAR (SIN MONEDAS)';
      $('pause-restart').disabled = coins <= 0;
      show('panel-pause');
    },
    render: renderMenu
  };
}

// ------------------------------------------------------------ récords y controles

export function initRecords(app) {
  const fileInput = $('records-file');
  $('records-back').addEventListener('click', () => app.back());
  $('controls-back').addEventListener('click', () => app.back());
  $('records-export').addEventListener('click', () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'arcade-records.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('RÉCORDS EXPORTADOS');
  });
  $('records-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (importJSON(String(reader.result))) {
        toast('RÉCORDS IMPORTADOS');
        app.usersChanged();
        render();
      } else {
        toast('ARCHIVO NO VÁLIDO');
      }
      fileInput.value = '';
    };
    reader.readAsText(f);
  });

  const cell = (rec, game, name) => el('td', { 'data-testid': 'best-' + game + '-' + name }, [
    el('span', { class: 'rec-score', text: String(rec.best) }),
    el('span', { class: 'rec-date', text: rec.best ? 'NV ' + rec.level + ' · ' + scores.formatDate(rec.date) : '—' })
  ]);

  function render() {
    const body = $('records-body');
    const all = users.list();
    const active = users.active();
    body.textContent = '';
    for (const u of all) {
      body.appendChild(el('tr', { class: active && active.id === u.id ? 'is-active' : '', 'data-testid': 'rec-row-' + u.name }, [
        el('td', { text: u.name }),
        ...GAME_IDS.map((g) => cell(u.records[g], g, u.name))
      ]));
    }
    for (let k = all.length; k < MAX_USERS; k++) {
      body.appendChild(el('tr', null, [el('td', { class: 'rec-empty', colspan: String(GAME_IDS.length + 1), text: '— LIBRE —' })]));
    }
    // TOP 10 de cada máquina, con iniciales.
    for (const game of GAME_IDS) {
      const ol = $('hof-' + game);
      ol.textContent = '';
      scores.hallOfFame(game).forEach((e) => {
        ol.appendChild(el('li', { class: active && e.userId === active.id ? 'is-active' : '', 'data-testid': 'hof-' + game + '-row' }, [
          el('span', { class: 'hof-initials', text: e.initials }),
          el('span', { class: 'hof-score', text: String(e.score) })
        ]));
      });
    }
    $('records-note').textContent = storage.mode === 'memory' ? 'MODO MEMORIA: NO SE GUARDA' : 'GUARDADO EN ESTE NAVEGADOR';
  }

  return {
    showRecords() { render(); show('panel-records'); },
    showControls() { show('panel-controls'); }
  };
}

// ------------------------------------------------------------ recepción

export function initReception(app) {
  $('reception-coins').addEventListener('click', () => app.askCoins());
  $('reception-bye').addEventListener('click', () => app.resume());

  function render() {
    const u = users.active();
    if (!u) return;
    $('reception-wallet').textContent = 'TIENES ' + u.coins + ' MONEDAS Y ' + u.tickets + ' TICKETS';
    const list = $('prize-list');
    list.textContent = '';
    for (const p of PRIZES) {
      const btn = el('button', { type: 'button', class: 'btn', 'data-testid': 'redeem-' + p.id, text: p.cost + ' TIC.' });
      btn.disabled = u.tickets < p.cost;
      btn.addEventListener('click', () => app.redeem(p.id));
      list.appendChild(el('li', null, [el('span', { text: p.name }), btn]));
    }
  }

  return {
    show() { render(); show('panel-reception'); },
    render
  };
}

// ------------------------------------------------------------ gramola

export function initJukebox(app) {
  for (const b of document.querySelectorAll('#jukebox-tracks [data-track]')) {
    b.addEventListener('click', () => app.playTrack(b.dataset.track || null));
  }
  $('jukebox-close').addEventListener('click', () => app.resume());
  return {
    show(current) {
      $('jukebox-now').textContent = current ? 'SUENA: ' + TRACK_NAMES[current] : 'LA GRAMOLA ESTÁ APAGADA';
      for (const b of document.querySelectorAll('#jukebox-tracks [data-track]')) b.setAttribute('aria-pressed', String((b.dataset.track || null) === current));
      if (openPanel() !== 'panel-jukebox') show('panel-jukebox');
    }
  };
}

// ------------------------------------------------------------ logros

export function initAchievements(app) {
  $('achievements-back').addEventListener('click', () => app.back());
  return {
    show() {
      const u = users.active();
      const list = $('achievement-list');
      list.textContent = '';
      let done = 0;
      for (const a of ACHIEVEMENTS) {
        const when = u && u.achievements[a.id];
        if (when) done++;
        list.appendChild(el('li', { class: when ? 'is-done' : '', 'data-testid': 'ach-' + a.id }, [
          el('strong', { text: (when ? '★ ' : '☆ ') + a.name }),
          el('span', { text: a.desc + (when ? ' · ' + scores.formatDate(when) : '') })
        ]));
      }
      $('achievements-count').textContent = done + ' DE ' + ACHIEVEMENTS.length;
      show('panel-achievements');
    }
  };
}

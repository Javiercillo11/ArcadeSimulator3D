/* Máquina de estados de la aplicación y bucle único.
   USER_SELECT → ROOM ⇄ ROOM_MENU
                ROOM → SITTING → CABINET ⇄ CABINET_PAUSE → STANDING → ROOM */
import { WebGLRenderer, Scene, PerspectiveCamera, Color, SRGBColorSpace, ACESFilmicToneMapping, Vector3 } from 'three';
import { Room } from '../world/Room.js';
import { Cabinet } from '../world/Cabinet.js';
import { Hands } from '../world/Hands.js';
import { FirstPerson } from '../world/FirstPerson.js';
import { ArcadeMachine } from '../arcade/ArcadeMachine.js';
import { MazeGame } from '../games/maze/MazeGame.js';
import { renderMaze, renderMazeTitle } from '../games/maze/mazeRender.js';
import { ClimbGame } from '../games/climb/ClimbGame.js';
import { renderClimb, renderClimbTitle } from '../games/climb/climbRender.js';
import { input, on as onInput, endStep, clear as clearInput, takeLook } from '../core/input.js';
import { audio } from '../core/audio.js';
import { storage, save } from '../data/storage.js';
import * as users from '../data/users.js';
import * as scores from '../data/scores.js';
import { $, navigate, toast } from '../ui/dom.js';
import { hideAll, openPanel, initUsers, initMenu, initRecords } from '../ui/panels.js';
import { initTouch, setTouchMode, isTouch } from '../ui/touch.js';

const STEP = 1 / 60;
const MAX_STEPS = 5;
const MAX_FRAME = 0.25;

const GAMES = [
  {
    id: 'maze', name: scores.GAME_NAMES.maze, Game: MazeGame, render: renderMaze, renderTitle: renderMazeTitle, x: -0.95,
    colors: { body: 0x1d2bb8, stripe: 0x111a6e, accent: '#ffd23f', marqueeTop: '#2b3cff', marqueeBottom: '#0b1030', buttons: [0xffd23f, 0xff3d8b] }
  },
  {
    id: 'climb', name: scores.GAME_NAMES.climb, Game: ClimbGame, render: renderClimb, renderTitle: renderClimbTitle, x: 0.95,
    colors: { body: 0xb81d2e, stripe: 0x5a0d18, accent: '#2fd8ff', marqueeTop: '#ff3d3d', marqueeBottom: '#3a0612', buttons: [0x2fd8ff, 0xffd23f] }
  }
];

export class App {
  constructor({ test }) {
    this.test = !!test;
    this.state = 'BOOT';
    this.panel = null;          // subpanel abierto dentro de ROOM_MENU (records | controls)
    this.manual = this.test;    // en pruebas el tiempo solo avanza con step()
    this.acc = 0;
    this.last = -1;
    this.time = 0;
    this.steps = 0;
    this.frames = 0;           // llamadas al bucle (una por fotograma del navegador)
    this.loopStarts = 0;
    this.locked = false;
    this.pauseGuard = 0;        // ignora el ESC que llega justo después de perder el ratón
    this.orbit = 0;
    this.lookTmp = { x: 0, y: 0 };
    this.settings = storage.data.settings;
  }

  // ---------------------------------------------------------------- arranque

  init() {
    const s = this.settings;
    const renderer = new WebGLRenderer({ antialias: s.quality !== 'low', powerPreference: 'high-performance' });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(this.pixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    $('scene').appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new Scene();
    scene.background = new Color(0x0a0716);
    const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 40);
    scene.add(camera);
    this.scene = scene;
    this.camera = camera;

    this.room = new Room(s.quality);
    scene.add(this.room.group);
    scene.fog = this.room.fog;

    this.machines = {};
    this.cabinets = [];
    for (const def of GAMES) {
      const machine = new ArcadeMachine({ id: def.id, name: def.name, Game: def.Game, render: def.render, renderTitle: def.renderTitle, audio, scores, users });
      const cab = new Cabinet({ id: def.id, title: def.name, screenCanvas: machine.canvas, colors: def.colors });
      cab.place(def.x, -3.45, 0);
      cab.setCrt(s.crt);
      scene.add(cab.group);
      this.machines[def.id] = machine;
      this.cabinets.push(cab);
    }
    const colliders = this.room.colliders.concat(this.cabinets.map((c) => c.collider()));
    this.fp = new FirstPerson(camera, colliders, this.cabinets);
    this.fp.sensitivity = s.mouseSens;
    this.fp.onStep = () => audio.play('step');
    this.hands = new Hands(camera);

    this.ui = {
      users: initUsers(this),
      menu: initMenu(this),
      records: initRecords(this)
    };
    initTouch();
    this.drawBoard();
    scores.onChange(() => this.drawBoard());

    onInput((action, source) => this.onAction(action, source));
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    document.addEventListener('pointerlockerror', () => { this.locked = false; this.updateHud(); });
    document.addEventListener('visibilitychange', () => {
      this.last = -1;
      if (document.hidden && this.state === 'CABINET') this.pauseCabinet();
    });
    renderer.domElement.addEventListener('click', () => {
      if ((this.state === 'ROOM' || this.state === 'CABINET') && !this.locked) this.lock();
    });

    if (storage.mode === 'memory') toast('SIN ALMACENAMIENTO: SE JUEGA EN MODO MEMORIA', 5000);
    else if (storage.repaired) toast('DATOS DAÑADOS RECUPERADOS (COPIA EN arcade.backup)', 5000);

    this.toUserSelect();
    this.start();
  }

  // El único bucle de la aplicación.
  start() {
    this.loopStarts++;
    this.renderer.setAnimationLoop((ts) => this.frame(ts));
  }

  pixelRatio() {
    return this.settings.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.fp.refit();
  }

  // ---------------------------------------------------------------- bucle

  frame(ts) {
    this.frames++;
    const t = ts / 1000;
    let dt = this.last < 0 ? 0 : t - this.last;
    this.last = t;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    // En modo manual (pruebas) el tiempo y el dibujo solo avanzan con step(): así el render por
    // software del navegador de pruebas no consume la CPU entre una orden y la siguiente.
    if (this.manual) return;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < MAX_STEPS) {
      this.step();
      this.acc -= STEP;
      n++;
    }
    if (n >= MAX_STEPS) this.acc = 0;
    this.draw();
  }

  step() {
    this.steps++;
    this.time += STEP;
    const st = this.state;
    if (st === 'USER_SELECT') {
      // Fondo: la cámara gira despacio alrededor de la sala.
      this.orbit += STEP * 0.12;
      this.camera.position.set(Math.sin(this.orbit) * 2.6, 1.9, 0.4 + Math.cos(this.orbit) * 2.2);
      this.camera.lookAt(0, 1.25, -2.6);
    } else {
      const walking = st === 'ROOM';
      const look = walking ? takeLook(this.lookTmp) : null;
      if (!walking) takeLook(this.lookTmp);
      this.fp.update(STEP, walking ? input : null, look);
      this.hands.sit = this.fp.sitAmount;
      const seatedCab = this.fp.cabinet;
      this.hands.update(STEP, this.fp.speed, seatedCab, st === 'CABINET' ? input : null);
      for (const cab of this.cabinets) cab.animateControls(st === 'CABINET' && cab === seatedCab ? input : null, STEP);
      this.updatePrompt();
    }
    const active = st === 'CABINET' && this.fp.cabinet ? this.machines[this.fp.cabinet.id] : null;
    for (const id in this.machines) {
      const m = this.machines[id];
      m.update(m === active ? input : null);
    }
    endStep();
  }

  draw() {
    for (const cab of this.cabinets) {
      if (this.machines[cab.id].render()) cab.texture.needsUpdate = true;
      cab.tick(this.time);
    }
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- estados

  setState(s) {
    this.state = s;
    document.documentElement.setAttribute('data-state', s);
    this.updateHud();
  }

  updateHud() {
    const s = this.state;
    const inWorld = s === 'ROOM' || s === 'SITTING' || s === 'CABINET' || s === 'STANDING';
    $('hud').hidden = !inWorld;
    $('crosshair').hidden = s !== 'ROOM';
    $('cabinet-hint').hidden = s !== 'CABINET';
    const u = users.active();
    $('hud-user').textContent = u ? u.name : '';
    const needLock = (s === 'ROOM' || s === 'CABINET') && !this.locked && !this.test && !isTouch();
    $('lock-hint').hidden = !needLock;
    this.hands.setVisible(s !== 'USER_SELECT');
    setTouchMode(s === 'ROOM' ? 'room' : s === 'CABINET' ? 'cabinet' : null);
    if (s !== 'ROOM') $('prompt').hidden = true;
  }

  updatePrompt() {
    const cab = this.state === 'ROOM' ? this.fp.prompt : null;
    if (cab === this.promptCab) return;
    this.promptCab = cab;
    $('prompt').hidden = !cab;
    if (cab) $('prompt-text').textContent = 'JUGAR A ' + cab.title;
  }

  toUserSelect() {
    this.leaveCabinet(true);
    this.unlock();
    this.setState('USER_SELECT');
    this.ui.users.show();
  }

  selectUser(id) {
    users.select(id);
    this.usersChanged();
  }

  usersChanged() {
    this.drawBoard();
    this.updateHud();
    for (const id in this.machines) this.machines[id].dirty = true;
  }

  enterRoom() {
    if (!users.active()) return;
    hideAll();
    clearInput();
    this.fp.teleport(0, 2.6, 0);
    this.setState('ROOM');
    audio.play('coin');
    this.lock();
  }

  openMenu() {
    if (this.state !== 'ROOM') return;
    this.unlock();
    this.setState('ROOM_MENU');
    this.panel = null;
    this.ui.menu.showMenu();
  }

  pauseCabinet() {
    if (this.state !== 'CABINET') return;
    const m = this.machines[this.fp.cabinet.id];
    m.pause();
    this.unlock();
    this.setState('CABINET_PAUSE');
    this.ui.menu.showPause(m.name);
  }

  // CONTINUAR desde cualquier menú.
  resume() {
    if (this.state === 'ROOM_MENU') {
      hideAll();
      clearInput();
      this.setState('ROOM');
      this.lock();
    } else if (this.state === 'CABINET_PAUSE') {
      hideAll();
      clearInput();
      this.machines[this.fp.cabinet.id].resume();
      this.setState('CABINET');
      this.lock();
    }
  }

  restartGame() {
    if (this.state !== 'CABINET_PAUSE') return;
    hideAll();
    clearInput();
    this.machines[this.fp.cabinet.id].start();
    this.setState('CABINET');
    this.lock();
  }

  showRecords() { this.panel = 'records'; this.ui.records.showRecords(); }
  showControls() { this.panel = 'controls'; this.ui.records.showControls(); }

  // VOLVER desde récords o controles.
  back() {
    this.panel = null;
    if (this.state === 'ROOM_MENU') this.ui.menu.showMenu();
  }

  sitDown(cab) {
    if (this.state !== 'ROOM' || !cab) return;
    clearInput();
    this.setState('SITTING');
    audio.play('sit');
    this.fp.sit(cab, () => {
      this.setState('CABINET');
      this.machines[cab.id].insert();
    });
  }

  standUp() {
    if (this.state !== 'CABINET' && this.state !== 'CABINET_PAUSE') return;
    hideAll();
    const cab = this.fp.cabinet;
    this.machines[cab.id].leave();
    clearInput();
    this.setState('STANDING');
    audio.play('stand');
    this.fp.stand(() => {
      this.setState('ROOM');
      this.lock();
    });
  }

  // Sale de la máquina al instante (al cambiar de usuario).
  leaveCabinet() {
    if (!this.fp || !this.fp.cabinet) return;
    this.machines[this.fp.cabinet.id].leave();
    const spot = this.fp.cabinet.frontPoint(new Vector3(), 0.75);
    this.fp.teleport(spot.x, spot.z, 0);
  }

  // ---------------------------------------------------------------- ajustes

  toggleMute() {
    const m = !audio.isMuted();
    audio.setMuted(m);
    this.settings.muted = m;
    save();
    toast(m ? 'SONIDO DESACTIVADO' : 'SONIDO ACTIVADO', 1500);
    if (this.state === 'ROOM_MENU') this.ui.menu.render();
  }

  setCrt(on) {
    this.settings.crt = !!on;
    save();
    for (const c of this.cabinets) c.setCrt(on);
  }

  setQuality(q) {
    this.settings.quality = q;
    save();
    this.renderer.setPixelRatio(this.pixelRatio());
    this.room.setQuality(q);
  }

  setSensitivity(v) {
    this.settings.mouseSens = v;
    this.fp.sensitivity = v;
    save();
  }

  drawBoard() {
    const u = users.active();
    this.room.drawBoard({ maze: scores.table('maze'), climb: scores.table('climb') }, u ? u.name : null, scores.GAME_NAMES);
  }

  // ---------------------------------------------------------------- ratón capturado

  lock() {
    if (this.test || isTouch()) return;
    const el = this.renderer.domElement;
    if (!el.requestPointerLock || document.pointerLockElement === el) return;
    try {
      const p = el.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.locked = false; this.updateHud(); });
    } catch (e) { /* el navegador no lo permite ahora: se pide clic */ }
  }

  unlock() {
    if (document.pointerLockElement && document.exitPointerLock) {
      this.unlocking = true;
      document.exitPointerLock();
    }
  }

  onLockChange() {
    const was = this.locked;
    this.locked = document.pointerLockElement === this.renderer.domElement;
    if (was && !this.locked && !this.unlocking) {
      // El navegador soltó el ratón (normalmente por ESC): se abre el menú que toque.
      this.pauseGuard = performance.now() + 400;
      if (this.state === 'ROOM') this.openMenu();
      else if (this.state === 'CABINET') this.pauseCabinet();
    }
    this.unlocking = false;
    this.updateHud();
  }

  // ---------------------------------------------------------------- teclas inmediatas

  onAction(action, source) {
    const s = this.state;
    if (action === 'mute') { this.toggleMute(); return; }

    if (action === 'pause') {
      if (performance.now() < this.pauseGuard) return;
      if (s === 'ROOM') this.openMenu();
      else if (s === 'CABINET') this.pauseCabinet();
      else if (s === 'ROOM_MENU' && this.panel) this.back();
      else if (s === 'ROOM_MENU' || s === 'CABINET_PAUSE') this.resume();
      return;
    }

    if (s === 'ROOM') {
      if (action === 'use' && this.fp.prompt) this.sitDown(this.fp.prompt);
      return;
    }
    if (s === 'CABINET') {
      if (action === 'stand') this.standUp();
      else if (action === 'zoom') this.fp.toggleZoom();
      return;
    }

    // Menús: flechas mueven el foco; los botones táctiles activan el enfocado.
    const id = openPanel();
    if (!id) return;
    const panel = $(id);
    const typing = document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'range';
    if (typing) return;
    if (action === 'up' || action === 'left') navigate(panel, -1);
    else if (action === 'down' || action === 'right') navigate(panel, 1);
    else if ((action === 'start' || action === 'jump') && source === 'virtual') {
      const f = document.activeElement;
      if (f && panel.contains(f) && f.tagName === 'BUTTON') f.click();
    } else if (action === 'stand' && s === 'CABINET_PAUSE') this.standUp();
  }

  // ---------------------------------------------------------------- ganchos de prueba (?test=1)

  testApi() {
    const app = this;
    const snap = () => {
      const fp = app.fp;
      const machines = {};
      for (const id in app.machines) machines[id] = app.machines[id].state;
      return {
        app: app.state, panel: openPanel(), cabinet: fp.cabinet ? fp.cabinet.id : null,
        prompt: fp.prompt ? fp.prompt.id : null, promptVisible: !$('prompt').hidden,
        player: { x: fp.pos.x, z: fp.pos.z, yaw: fp.yaw, pitch: fp.pitch, mode: fp.mode, zoomed: fp.zoomed },
        camera: { x: app.camera.position.x, y: app.camera.position.y, z: app.camera.position.z },
        hands: { visible: app.hands.visible, sit: app.hands.sit },
        machines, loopStarts: app.loopStarts, steps: app.steps, frames: app.frames, storageMode: storage.mode,
        settings: Object.assign({}, storage.data.settings), user: users.active() ? users.active().name : null
      };
    };
    return {
      state: snap,
      step(n) { for (let i = 0; i < (n || 1); i++) app.step(); app.draw(); return snap(); },
      setManual(v) { app.manual = !!v; app.last = -1; app.acc = 0; },
      teleport(x, z, yaw) { app.fp.teleport(x, z, yaw || 0); app.step(); return snap(); },
      look(dx, dy) { input.look.x += dx; input.look.y += dy; },
      cabinets() { return app.cabinets.map((c) => Object.assign(c.collider(), { front: c.frontPoint(new Vector3(), 0) })); },
      machine(id) { const m = app.machines[id]; return { state: m.state, result: m.result, game: m.game ? m.game.test.state() : null }; },
      game(id) { const m = app.machines[id || (app.fp.cabinet && app.fp.cabinet.id)]; return m && m.game ? m.game.test : null; },
      // Termina la partida activa con la puntuación dada (para probar récords).
      finishWith(score, level) {
        const m = app.machines[app.fp.cabinet.id];
        const g = m.game;
        g.score = score;
        if (level) g.level = level;
        g.finished = true;
        app.step();
        app.draw();
        return snap();
      },
      setSeed(n) { for (const id in app.machines) app.machines[id].seed = n; },
      storage() { return JSON.parse(JSON.stringify(storage.data)); },
      boardRows() { return JSON.parse(JSON.stringify(app.room.lastRows)); },
      renderInfo() { const r = app.renderer.info.render; return { calls: r.calls, triangles: r.triangles }; },
      screenPixel(id) {
        const m = app.machines[id];
        m.render();
        const d = m.ctx.getImageData(0, 0, 224, 288).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
        return lit;
      }
    };
  }
}

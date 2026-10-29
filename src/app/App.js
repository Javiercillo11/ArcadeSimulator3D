/* Máquina de estados de la aplicación y bucle único.
   USER_SELECT → ROOM ⇄ ROOM_MENU | RECEPTION | JUKEBOX
                ROOM → SITTING → CABINET ⇄ CABINET_PAUSE → STANDING → ROOM */
import { WebGLRenderer, Scene, PerspectiveCamera, Color, SRGBColorSpace, ACESFilmicToneMapping, Vector3 } from 'three';
import { Room, ROOM } from '../world/Room.js';
import { Cabinet } from '../world/Cabinet.js';
import { HockeyTable, SkeeLane } from '../world/Tables.js';
import { ClawMachine } from '../world/ClawMachine.js';
import { Reception, PrizeCase } from '../world/Reception.js';
import { Jukebox, Vending, stool, glowPool, StaticScreen } from '../world/Decor.js';
import { Hands } from '../world/Hands.js';
import { FirstPerson } from '../world/FirstPerson.js';
import { ArcadeMachine } from '../arcade/ArcadeMachine.js';
import { MazeGame } from '../games/maze/MazeGame.js';
import { renderMaze, renderMazeTitle } from '../games/maze/mazeRender.js';
import { ClimbGame } from '../games/climb/ClimbGame.js';
import { renderClimb, renderClimbTitle } from '../games/climb/climbRender.js';
import { BrickGame } from '../games/brick/BrickGame.js';
import { renderBrick, renderBrickTitle } from '../games/brick/brickRender.js';
import { HockeyGame } from '../games/hockey/HockeyGame.js';
import { renderHockey, renderHockeyTitle } from '../games/hockey/hockeyRender.js';
import { SkeeGame } from '../games/skee/SkeeGame.js';
import { renderSkee, renderSkeeTitle } from '../games/skee/skeeRender.js';
import { input, on as onInput, endStep, clear as clearInput, takeLook } from '../core/input.js';
import { audio, TRACK_NAMES } from '../core/audio.js';
import { makeRng } from '../core/rng.js';
import { storage, save, GAMES as GAME_IDS, MAX_COINS } from '../data/storage.js';
import * as users from '../data/users.js';
import * as scores from '../data/scores.js';
import * as achievements from '../data/achievements.js';
import { prizeById } from '../data/prizes.js';
import { $, navigate, toast } from '../ui/dom.js';
import { hideAll, openPanel, initUsers, initMenu, initRecords, initReception, initJukebox, initAchievements } from '../ui/panels.js';
import { initTouch, setTouchMode, isTouch } from '../ui/touch.js';

const STEP = 1 / 60;
const MAX_STEPS = 5;
const MAX_FRAME = 0.25;
const START = { x: 0, z: 3.8 };
const CAB_Z = -4.45;
const SODA_COLORS = [0xc4122e, 0x2a7fff, 0x3dff8b, 0xffd23f, 0xff8c1a];
const DEFAULT_HINT = ['ENTER', 'EMPEZAR', 'ESC', 'PAUSA', 'F', 'ACERCAR', 'G', 'GRANDE', 'Q', 'LEVANTARSE'];

// Recreativas de la pared del fondo (la última está averiada).
const CABINETS = [
  {
    id: 'maze', Game: MazeGame, render: renderMaze, renderTitle: renderMazeTitle, x: -2.0, coinBannerY: 236,
    colors: { body: 0x1d2bb8, stripe: 0x111a6e, accent: '#ffd23f', marqueeTop: '#2b3cff', marqueeBottom: '#0b1030', buttons: [0xffd23f, 0xff3d8b] }
  },
  {
    id: 'climb', Game: ClimbGame, render: renderClimb, renderTitle: renderClimbTitle, x: 0, coinBannerY: 226,
    colors: { body: 0xb81d2e, stripe: 0x5a0d18, accent: '#2fd8ff', marqueeTop: '#ff3d3d', marqueeBottom: '#3a0612', buttons: [0x2fd8ff, 0xffd23f] }
  },
  {
    id: 'brick', Game: BrickGame, render: renderBrick, renderTitle: renderBrickTitle, x: 2.0, coinBannerY: 232,
    colors: { body: 0x0f6a5a, stripe: 0x063a32, accent: '#3dff8b', marqueeTop: '#0f8a6a', marqueeBottom: '#04201a', buttons: [0x3dff8b, 0xff3d8b] }
  }
];

export class App {
  constructor({ test }) {
    this.test = !!test;
    this.state = 'BOOT';
    this.panel = null;          // subpanel abierto dentro de ROOM_MENU (records | controls | achievements)
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
    this.big = false;           // modo pantalla grande (el juego a toda la ventana, en 2D)
    this.lookTmp = { x: 0, y: 0 };
    this.settings = storage.data.settings;
    this.rnd = makeRng(4242);
    this.canTimer = 0;
    this._v = new Vector3();
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
    this.buildWorld();

    this.fp = new FirstPerson(camera, this.colliders, this.interactables);
    this.fp.sensitivity = s.mouseSens;
    this.fp.onStep = () => audio.play('step');
    this.hands = new Hands(camera);

    this.ui = {
      users: initUsers(this),
      menu: initMenu(this),
      records: initRecords(this),
      reception: initReception(this),
      jukebox: initJukebox(this),
      achievements: initAchievements(this)
    };
    initTouch();
    this.drawBoard();
    scores.onChange(() => this.drawBoard());
    achievements.onUnlock((a) => {
      audio.play('record');
      toast('LOGRO DESBLOQUEADO: ' + a.name, 3500);
    });
    if (s.jukebox) audio.jukebox(s.jukebox);

    onInput((action, source) => this.onAction(action, source));
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    document.addEventListener('pointerlockerror', () => { this.locked = false; this.updateHud(); });
    document.addEventListener('fullscreenchange', () => this.ui.menu.render());
    document.addEventListener('visibilitychange', () => {
      this.last = -1;
      if (document.hidden && this.state === 'CABINET') this.pauseCabinet();
    });
    renderer.domElement.addEventListener('click', () => {
      if ((this.state === 'ROOM' || this.state === 'CABINET') && !this.locked) this.lock();
    });
    $('bigscreen').addEventListener('click', () => { if (this.state === 'CABINET' && !this.locked) this.lock(); });

    if (storage.mode === 'memory') toast('SIN ALMACENAMIENTO: SE JUEGA EN MODO MEMORIA', 5000);
    else if (storage.repaired) toast('DATOS DAÑADOS RECUPERADOS (COPIA EN arcade.backup)', 5000);

    this.toUserSelect();
    this.start();
  }

  // Monta el salón: recreativas, mesas, grúa, recepción, vitrina, gramola, refrescos, taburetes y luces.
  buildWorld() {
    const scene = this.scene;
    const s = this.settings;
    this.machines = {};
    this.stations = [];
    const add = (obj) => { scene.add(obj.group); return obj; };
    const glow = (color, w, d, x, z) => { const m = glowPool(color, w, d); m.position.set(x, 0.004, z); scene.add(m); };
    const machineOpts = (id, extra) => Object.assign({
      id, name: scores.GAME_NAMES[id], audio, scores, users,
      onEvent: (m, n) => this.onGameEvent(m, n),
      onFinish: (m, r) => this.onGameFinish(m, r),
      onRank: (m, rank) => this.onRank(rank)
    }, extra);

    CABINETS.forEach((def, i) => {
      const machine = new ArcadeMachine(machineOpts(def.id, { Game: def.Game, render: def.render, renderTitle: def.renderTitle, coinBannerY: def.coinBannerY }));
      const cab = new Cabinet({ id: def.id, title: machine.name, number: '0' + (i + 1), screenCanvas: machine.canvas, colors: def.colors });
      cab.place(def.x, CAB_Z, 0);
      cab.setCrt(s.crt);
      add(cab);
      this.machines[def.id] = machine;
      this.stations.push(cab);
      const st = stool();
      st.position.set(def.x, 0, CAB_Z + 0.9);
      scene.add(st);
      glow(def.colors.buttons[0], 1.4, 1.8, def.x, CAB_Z + 1.0);
    });
    // Máquina averiada, con la pantalla sin señal.
    this.staticScreen = new StaticScreen();
    this.broken = new Cabinet({
      id: 'broken', title: 'STAR PATROL', number: '04', screenCanvas: this.staticScreen.canvas, broken: true, promptText: 'FUERA DE SERVICIO',
      colors: { body: 0x2a2a33, stripe: 0x16161c, accent: '#55596a', marqueeTop: '#2a2a33', marqueeBottom: '#0a0a10', buttons: [0x555555, 0x444444] }
    });
    this.broken.place(-4.0, CAB_Z, 0);
    this.broken.setCrt(s.crt);
    add(this.broken);

    // Mesa de air hockey y pista de skee-ball.
    const hockey = new ArcadeMachine(machineOpts('hockey', {
      Game: HockeyGame, render: renderHockey, renderTitle: renderHockeyTitle, width: 224, height: 400, coinBannerY: 300,
      tickets: (g) => (g.won ? 10 : 2) + g.goals.player
    }));
    this.hockeyTable = add(new HockeyTable(hockey.canvas));
    this.hockeyTable.place(-3.2, 0.7, 0);
    this.hockeyTable.machine = hockey;
    this.machines.hockey = hockey;
    const skee = new ArcadeMachine(machineOpts('skee', {
      Game: SkeeGame, render: renderSkee, renderTitle: renderSkeeTitle, width: 224, height: 560, coinBannerY: 440,
      tickets: (g) => Math.floor(g.score / 10)
    }));
    this.skeeLane = add(new SkeeLane(skee.canvas));
    this.skeeLane.place(2.6, 0.6, 0);
    this.skeeLane.machine = skee;
    this.machines.skee = skee;
    this.stations.push(this.hockeyTable, this.skeeLane);
    glow(0x2fd8ff, 2.0, 3.0, -3.2, 0.7);
    glow(0xff3d8b, 1.6, 3.0, 2.6, 0.6);

    // Grúa de peluches.
    this.claw = new ClawMachine({ audio, users, seed: 77, onWin: (p) => this.onClawWin(p) });
    this.claw.place(4.7, -3.9, 0);
    add(this.claw);
    this.machines.claw = this.claw;
    this.stations.push(this.claw);
    glow(0xff3d8b, 1.4, 1.6, 4.7, -3.2);

    // Recepción con Mari, vitrina de premios, gramola y refrescos.
    this.reception = add(new Reception());
    this.reception.place(6.0, 0.6, -Math.PI / 2);
    this.prizeCase = add(new PrizeCase());
    this.prizeCase.place(6.77, 3.1, -Math.PI / 2);
    this.jukebox = add(new Jukebox());
    this.jukebox.place(-6.73, 1.9, Math.PI / 2);
    this.vending = add(new Vending());
    this.vending.place(-6.6, 3.5, Math.PI / 2);
    glow(0xff8c1a, 1.4, 1.4, -6.2, 1.9);
    glow(0xc4122e, 1.4, 1.4, -6.0, 3.5);

    this.interactables = this.stations.concat([this.broken, this.reception, this.jukebox, this.vending]);
    const stoolColliders = CABINETS.map((d) => ({ minX: d.x - 0.18, maxX: d.x + 0.18, minZ: CAB_Z + 0.72, maxZ: CAB_Z + 1.08, id: 'stool-' + d.id }));
    this.colliders = this.room.colliders.concat(
      this.interactables.map((o) => o.collider()),
      [this.prizeCase.collider()],
      stoolColliders
    );
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
      // Fondo: la cámara gira despacio alrededor del salón.
      this.orbit += STEP * 0.1;
      this.camera.position.set(Math.sin(this.orbit) * 4.2, 2.1, 0.6 + Math.cos(this.orbit) * 3.0);
      this.camera.lookAt(0, 1.2, -2.0);
    } else {
      const walking = st === 'ROOM';
      const look = walking ? takeLook(this.lookTmp) : null;
      if (!walking) takeLook(this.lookTmp);
      this.fp.update(STEP, walking ? input : null, look);
      this.hands.sit = this.fp.sitAmount;
      const seated = this.fp.cabinet;
      this.hands.update(STEP, this.fp.speed, seated, st === 'CABINET' ? input : null);
      for (const cab of this.stations) cab.animateControls(st === 'CABINET' && cab === seated ? input : null, STEP);
      this.updatePrompt();
      if (this.canTimer > 0 && (this.canTimer -= STEP) <= 0) this.hands.holdCan(false);
    }
    const active = st === 'CABINET' && this.fp.cabinet ? this.machines[this.fp.cabinet.id] : null;
    for (const id in this.machines) {
      const m = this.machines[id];
      m.update(m === active ? input : null);
    }
    if (st !== 'USER_SELECT') this.syncCounters();
    this.reception.update(STEP, this.camera.position);
    this.vending.tick(STEP);
    this.jukebox.tick(STEP, !!audio.jukeboxTrack());
    this.room.tick(STEP, this.rnd);
    if (this.steps % 10 === 0) this.ambience();
    endStep();
  }

  draw() {
    for (const st of this.stations) {
      const m = this.machines[st.id];
      if (m && m.render() && st.texture) st.texture.needsUpdate = true;
      st.tick(this.time);
    }
    if (this.staticScreen.update()) this.broken.texture.needsUpdate = true;
    this.broken.tick(this.time);
    // En pantalla grande solo se ve el juego: no hace falta dibujar el salón.
    if (!this.big) this.renderer.render(this.scene, this.camera);
  }

  // Sonidos del salón: la gramola se oye menos de lejos y mientras se juega; las demos suenan de vez en cuando.
  ambience() {
    const eye = this.camera.position;
    const dj = eye.distanceTo(this.jukebox.group.position);
    const seated = this.state === 'CABINET' || this.state === 'CABINET_PAUSE';
    audio.setJukeboxVolume(0.6 * Math.max(0.2, Math.min(1, 1.3 - dj / 10)) * (seated ? 0.4 : 1));
    if (this.state === 'USER_SELECT') return;
    for (const st of this.stations) {
      const m = this.machines[st.id];
      if (!m || m.state !== 'ATTRACT' || this.rnd() > 1 / 120) continue;
      const d = eye.distanceTo(st.group.position);
      if (d < 9) audio.playVol(['fruit', 'start', 'score', 'bounce'][Math.floor(this.rnd() * 4)], (1 - d / 9) * 0.35);
    }
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
    if (s === 'CABINET') this.renderHint();
    const u = users.active();
    $('hud-user').textContent = u ? u.name : '';
    this.syncCounters(true);
    const needLock = (s === 'ROOM' || s === 'CABINET') && !this.locked && !this.test && !isTouch();
    $('lock-hint').hidden = !needLock;
    this.hands.setVisible(s !== 'USER_SELECT');
    setTouchMode(s === 'ROOM' ? 'room' : s === 'CABINET' ? 'cabinet' : null);
    if (s !== 'ROOM') $('prompt').hidden = true;
    if (s !== 'CABINET' && s !== 'CABINET_PAUSE') this.setBig(false);
  }

  // Barra de ayuda de la máquina en la que se está sentado.
  renderHint() {
    const st = this.fp.cabinet;
    const h = (st && st.hint) || DEFAULT_HINT;
    const bar = $('cabinet-hint');
    bar.textContent = '';
    for (let i = 0; i < h.length; i += 2) {
      const span = document.createElement('span');
      const k = document.createElement('kbd');
      k.textContent = h[i];
      span.append(k, ' ' + h[i + 1]);
      bar.appendChild(span);
    }
  }

  updatePrompt() {
    const cab = this.state === 'ROOM' ? this.fp.prompt : null;
    if (cab === this.promptCab) return;
    this.promptCab = cab;
    $('prompt').hidden = !cab;
    if (cab) $('prompt-text').textContent = cab.promptText || 'JUGAR A ' + cab.title;
  }

  // Contadores de monedas y tickets del HUD (solo tocan el DOM si cambian).
  syncCounters(force) {
    const u = users.active();
    const c = u ? u.coins : 0, t = u ? u.tickets : 0;
    if (!force && c === this.shownCoins && t === this.shownTickets) return;
    this.shownCoins = c;
    this.shownTickets = t;
    $('hud-coins-n').textContent = String(c);
    $('hud-coins').classList.toggle('is-empty', c === 0);
    $('hud-tickets-n').textContent = String(t);
    this.prizeCase.setPrizes(u ? u.prizes : []);
  }

  toUserSelect() {
    this.leaveCabinet();
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
    this.fp.teleport(START.x, START.z, 0);
    this.setState('ROOM');
    audio.play('coin');
    this.lock();
    if (users.active().coins === 0) toast('SIN MONEDAS: PÍDESELAS A MARI EN RECEPCIÓN (A LA DERECHA)', 4000);
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
    this.ui.menu.showPause(m.name, users.active().coins, !!m.canvas);
  }

  // CONTINUAR desde cualquier menú.
  resume() {
    if (this.state === 'ROOM_MENU' || this.state === 'RECEPTION' || this.state === 'JUKEBOX') {
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

  // REINICIAR cuesta una moneda, como empezar otra partida.
  restartGame() {
    if (this.state !== 'CABINET_PAUSE') return;
    if (!this.machines[this.fp.cabinet.id].tryStart()) {
      toast('SIN MONEDAS: PÍDESELAS A MARI EN RECEPCIÓN', 2500);
      return;
    }
    hideAll();
    clearInput();
    this.setState('CABINET');
    this.lock();
  }

  showRecords() { this.panel = 'records'; this.ui.records.showRecords(); }
  showControls() { this.panel = 'controls'; this.ui.records.showControls(); }
  showAchievements() { this.panel = 'achievements'; this.ui.achievements.show(); }

  // VOLVER desde récords, controles o logros.
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
    this.setBig(false);
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

  // ---------------------------------------------------------------- pantalla grande y completa

  // G: el canvas del juego pasa a ocupar la ventana (nítido, sin perspectiva). Otra G vuelve al 3D.
  toggleBig() {
    const m = this.fp.cabinet && this.machines[this.fp.cabinet.id];
    if (!m || !m.canvas) { toast('ESTA MÁQUINA NO TIENE PANTALLA GRANDE', 1800); return; }
    this.setBig(!this.big);
  }

  setBig(on) {
    if (on === this.big) return;
    const box = $('bigscreen');
    const slot = $('bigscreen-slot');
    if (on) {
      const m = this.machines[this.fp.cabinet.id];
      slot.appendChild(m.canvas);
      box.dataset.shape = m.H > m.W * 1.5 ? 'tall' : 'arcade';
      box.hidden = false;
      this.big = true;
    } else {
      slot.textContent = '';
      box.hidden = true;
      this.big = false;
    }
  }

  toggleFullscreen() {
    const doc = document;
    if (doc.fullscreenElement) { doc.exitFullscreen && doc.exitFullscreen().catch(() => {}); return; }
    const el = doc.documentElement;
    if (!el.requestFullscreen) { toast('ESTE NAVEGADOR NO PERMITE PANTALLA COMPLETA', 2500); return; }
    el.requestFullscreen().catch(() => toast('NO SE PUDO PONER LA PANTALLA COMPLETA', 2500));
  }

  // ---------------------------------------------------------------- recepción, gramola y refrescos

  openReception() {
    const u = users.active();
    this.unlock();
    this.setState('RECEPTION');
    this.reception.ringBell();
    audio.play('bell');
    this.reception.say('¡HOLA, ' + u.name + '!\n¿QUÉ NECESITAS?');
    this.ui.reception.show();
  }

  // Mari da 5 monedas (hasta el máximo).
  askCoins() {
    const u = users.active();
    const added = users.addCoins(u.id, 5);
    if (!added) {
      audio.play('error');
      this.reception.say('¡YA TIENES ' + MAX_COINS + '!\nVE A JUGAR UN RATO');
      toast('YA TIENES EL MÁXIMO: ' + MAX_COINS + ' MONEDAS', 2000);
    } else {
      this.reception.giveCoins(added);
      for (let i = 0; i < added; i++) setTimeout(() => audio.play('coin'), 350 + 100 * i);
      this.reception.say('AQUÍ TIENES ' + added + ' MONEDAS.\n¡SUERTE!');
      toast('+' + added + ' MONEDAS · TIENES ' + u.coins, 2000);
    }
    this.syncCounters(true);
    this.ui.reception.render();
  }

  redeem(prizeId) {
    const u = users.active();
    const p = prizeById(prizeId);
    const err = users.redeem(u.id, p.id, p.cost);
    if (err === 'TICKETS') {
      audio.play('error');
      this.reception.say('TE FALTAN ' + (p.cost - u.tickets) + '\nTICKETS PARA ESO');
    } else if (err === 'FULL') {
      audio.play('error');
      this.reception.say('¡TU VITRINA\nESTÁ LLENA!');
    } else {
      audio.play('win');
      this.reception.giveCoins(0);
      this.reception.say('¡' + p.name + '!\nYA ESTÁ EN TU VITRINA');
      toast('PREMIO: ' + p.name, 2500);
      achievements.award('prize');
    }
    this.syncCounters(true);
    this.ui.reception.render();
  }

  openJukebox() {
    this.unlock();
    this.setState('JUKEBOX');
    this.ui.jukebox.show(audio.jukeboxTrack());
  }

  playTrack(name) {
    audio.jukebox(name);
    this.settings.jukebox = name || null;
    save();
    toast(name ? 'SUENA: ' + TRACK_NAMES[name] : 'GRAMOLA APAGADA', 2000);
    if (name) achievements.award('jukebox');
    this.ui.jukebox.show(audio.jukeboxTrack());
  }

  buySoda() {
    const u = users.active();
    if (this.vending.drop > 0) return;
    if (!users.spendCoin(u.id)) {
      audio.play('error');
      toast('LOS REFRESCOS CUESTAN 1 MONEDA', 2000);
      return;
    }
    const color = SODA_COLORS[Math.floor(this.rnd() * SODA_COLORS.length)];
    this.vending.dispense(color);
    audio.play('coin');
    setTimeout(() => audio.play('soda'), 900);
    this.hands.holdCan(true, color);
    this.canTimer = 12;
    toast('¡REFRESCO! · TE QUEDAN ' + u.coins + ' MONEDAS', 2000);
    achievements.award('soda');
    this.syncCounters(true);
  }

  // ---------------------------------------------------------------- logros y premios

  onGameEvent(m, name) {
    const g = m.game;
    if (!g) return;
    if (m.id === 'maze' && name === 'eatGhost' && g.chain >= 4) achievements.award('chain4');
    else if (m.id === 'climb' && name === 'smash') achievements.award('hammer');
    else if (m.id === 'climb' && name === 'levelClear') achievements.award('rescue');
    else if (m.id === 'brick' && name === 'levelClear') achievements.award('brickLevel');
    else if (m.id === 'skee' && name === 'skee100') achievements.award('skee100');
  }

  onGameFinish(m, result) {
    achievements.award('first');
    if (m.id === 'hockey' && result.won) achievements.award('hockeyWin');
    const u = users.active();
    if (u && GAME_IDS.every((g) => u.history.some((h) => h.game === g))) achievements.award('allGames');
    if (result.tickets) toast('+' + result.tickets + ' TICKETS', 2000);
  }

  onRank(rank) {
    if (rank >= 0) achievements.award('top10');
    if (rank === 0) achievements.award('champion');
  }

  onClawWin(p) {
    const u = users.active();
    const def = prizeById(p.id);
    if (u && users.givePrize(u.id, p.id)) {
      toast('¡HAS GANADO UN ' + def.name + '! ESTÁ EN TU VITRINA', 3000);
      achievements.award('claw');
    }
    this.syncCounters(true);
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
    for (const c of this.stations.concat([this.broken])) c.setCrt(on);
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
    const rows = {};
    for (const id of GAME_IDS) rows[id] = scores.hallOfFame(id);
    this.room.drawBoard(rows, u ? u.id : null, scores.GAME_NAMES);
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
      else if (s === 'ROOM_MENU' || s === 'CABINET_PAUSE' || s === 'RECEPTION' || s === 'JUKEBOX') this.resume();
      return;
    }

    if (s === 'ROOM') {
      const target = this.fp.prompt;
      if (action !== 'use' || !target) return;
      if (target === this.reception) this.openReception();
      else if (target === this.jukebox) this.openJukebox();
      else if (target === this.vending) this.buySoda();
      else if (target === this.broken) { audio.play('error'); toast('ESTA MÁQUINA NO FUNCIONA… VUELVE MAÑANA', 2200); }
      else this.sitDown(target);
      return;
    }
    if (s === 'CABINET') {
      if (action === 'stand') this.standUp();
      else if (action === 'zoom' && !this.big) this.fp.toggleZoom();
      else if (action === 'big') this.toggleBig();
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
      const u = users.active();
      return {
        app: app.state, panel: openPanel(), cabinet: fp.cabinet ? fp.cabinet.id : null,
        prompt: fp.prompt ? fp.prompt.id : null, promptVisible: !$('prompt').hidden,
        player: { x: fp.pos.x, z: fp.pos.z, yaw: fp.yaw, pitch: fp.pitch, mode: fp.mode, zoomed: fp.zoomed },
        camera: { x: app.camera.position.x, y: app.camera.position.y, z: app.camera.position.z },
        hands: { visible: app.hands.visible, sit: app.hands.sit, can: app.hands.can.visible },
        machines, loopStarts: app.loopStarts, steps: app.steps, frames: app.frames, storageMode: storage.mode,
        settings: Object.assign({}, storage.data.settings), user: u ? u.name : null,
        coins: u ? u.coins : null, tickets: u ? u.tickets : null, prizes: u ? u.prizes.slice() : null,
        achievements: u ? Object.keys(u.achievements) : null,
        hudCoins: $('hud-coins-n').textContent, hudTickets: $('hud-tickets-n').textContent,
        big: app.big, jukebox: audio.jukeboxTrack(), said: app.reception.lastSaid || null
      };
    };
    return {
      state: snap,
      step(n) { for (let i = 0; i < (n || 1); i++) app.step(); app.draw(); return snap(); },
      setManual(v) { app.manual = !!v; app.last = -1; app.acc = 0; },
      teleport(x, z, yaw) { app.fp.teleport(x, z, yaw || 0); app.step(); return snap(); },
      look(dx, dy) { input.look.x += dx; input.look.y += dy; },
      room() { return Object.assign({}, ROOM); },
      cabinets() { return app.interactables.map((c) => Object.assign(c.collider(), { front: c.frontPoint(new Vector3(), 0) })); },
      machine(id) {
        const m = app.machines[id];
        return {
          state: m.state, result: m.result || null, game: m.game ? m.game.test.state() : null,
          initials: m.entry ? { value: m.entry.value, cursor: m.entry.cursor } : null,
          claw: m.logic ? { state: m.logic.state, x: m.logic.x, z: m.logic.z, won: m.logic.won ? m.logic.won.id : null } : null
        };
      },
      setCoins(n) { users.active().coins = n; save(); app.syncCounters(true); },
      setTickets(n) { users.active().tickets = n; save(); app.syncCounters(true); },
      hallOfFame(id) { return JSON.parse(JSON.stringify(scores.hallOfFame(id))); },
      coinsVisible() { return app.reception.coins.filter((c) => c.mesh.visible).length; },
      prizeCaseCount() { return app.prizeCase.items.children.length; },
      game(id) { const m = app.machines[id || (app.fp.cabinet && app.fp.cabinet.id)]; return m && m.game ? m.game.test : null; },
      // Coloca la pinza sobre un peluche y fija el azar: agarra (< 0,75) y no se escurre (≥ 0,3).
      clawCheat() {
        const L = app.claw.logic;
        const p = L.plush.find((q) => !q.taken);
        L.x = p.x; L.z = p.z;
        L.rand = () => 0.5;
        return p.id;
      },
      // Termina la partida activa con la puntuación dada (para probar récords). Si entra en el TOP 10,
      // guarda las iniciales indicadas (o las del jugador); con initials === false se queda pidiéndolas.
      finishWith(score, level, initials, extra) {
        const m = app.machines[app.fp.cabinet.id];
        const g = m.game;
        g.score = score;
        if (level) g.level = level;
        if (extra) Object.assign(g, extra);
        g.finished = true;
        app.step();
        if (m.state === 'ENTER_INITIALS' && initials !== false) m.commitInitials(initials || undefined);
        app.draw();
        return snap();
      },
      setSeed(n) { for (const id in app.machines) app.machines[id].seed = n; },
      storage() { return JSON.parse(JSON.stringify(storage.data)); },
      boardRows() { return JSON.parse(JSON.stringify(app.room.lastRows)); },
      renderInfo() { const r = app.renderer.info.render; return { calls: r.calls, triangles: r.triangles }; },
      screenPixel(id) {
        const m = app.machines[id];
        m.dirty = true;
        m.render();
        const d = m.ctx.getImageData(0, 0, m.W, m.H).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
        return lit;
      }
    };
  }
}

/* Decorado interactivo y ambiente: gramola, máquina de refrescos, taburetes, charcos de luz en el suelo
   y la pantalla sin señal de la máquina averiada. Coordenadas locales: el frente mira hacia +z. */
import {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, TorusGeometry, MeshStandardMaterial, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, AdditiveBlending, Color, Vector3
} from 'three';
import { FONT_FAMILY } from '../core/font.js';

const font = (px) => px + 'px ' + FONT_FAMILY + ', monospace';
const mat = (color, rough = 0.5, extra = {}) => new MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Base común: colocar, caja de colisión y punto delantero.
class Prop {
  constructor(id, w, d) {
    this.id = id;
    this.group = new Group();
    this.group.name = id;
    this.w = w;
    this.d = d;
    this._v = new Vector3();
  }

  place(x, z, rotY) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotY;
    this.group.updateMatrixWorld(true);
  }

  collider() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of [[-this.w / 2, -this.d / 2], [this.w / 2, -this.d / 2], [-this.w / 2, this.d / 2], [this.w / 2, this.d / 2]]) {
      const v = this.group.localToWorld(this._v.set(x, 0, z));
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    return { minX, maxX, minZ, maxZ, id: this.id };
  }

  frontPoint(out, dist = 0.75) {
    return this.group.localToWorld(out.set(0, 0, this.d / 2 + 0.1 + dist));
  }
}

// ------------------------------------------------------------ gramola

export class Jukebox extends Prop {
  constructor() {
    super('jukebox', 0.76, 0.5);
    this.title = 'GRAMOLA';
    this.promptText = 'ELEGIR CANCIÓN';
    const g = this.group;
    const wood = mat(0x6a2a10, 0.45);
    const chrome = mat(0xe8e8f0, 0.15, { metalness: 0.9 });
    const body = new Mesh(new BoxGeometry(0.76, 1.05, 0.5), wood);
    body.position.y = 0.525;
    g.add(body);
    const top = new Mesh(new CylinderGeometry(0.38, 0.38, 0.5, 32, 1, false, 0, Math.PI), wood);
    top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    top.position.y = 1.05;
    g.add(top);
    // Arcos de neón que cambian de color mientras suena.
    this.tubes = [];
    for (let i = 0; i < 3; i++) {
      const m = new MeshBasicMaterial({ color: 0xff3d8b });
      const tube = new Mesh(new TorusGeometry(0.33 - i * 0.05, 0.012, 8, 40, Math.PI), m);
      tube.position.set(0, 1.05, 0.255);
      g.add(tube);
      this.tubes.push(m);
    }
    for (const sx of [-1, 1]) {
      const m = new MeshBasicMaterial({ color: 0x2fd8ff });
      const bar = new Mesh(new BoxGeometry(0.03, 0.95, 0.03), m);
      bar.position.set(sx * 0.34, 0.55, 0.255);
      g.add(bar);
      this.tubes.push(m);
    }
    // Ventana con los discos y la lista de canciones.
    const window_ = new Mesh(new PlaneGeometry(0.5, 0.3), new MeshBasicMaterial({
      map: canvasTex(512, 300, (c, w, h) => {
        c.fillStyle = '#1a0f05'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) {
          c.fillStyle = '#111'; c.beginPath(); c.arc(60 + i * 78, 110, 34, 0, Math.PI * 2); c.fill();
          c.fillStyle = ['#ff3d8b', '#ffd23f', '#2fd8ff'][i % 3]; c.beginPath(); c.arc(60 + i * 78, 110, 11, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#f4f0e0'; c.fillRect(30, 180, 452, 100);
        c.fillStyle = '#1a1a2a'; c.font = font(18); c.textAlign = 'center';
        c.fillText('1 NEÓN NOCTURNO', w / 2, 212);
        c.fillText('2 PÍXEL FUNK', w / 2, 240);
        c.fillText('3 AUTOPISTA 8 BITS', w / 2, 268);
      })
    }));
    window_.position.set(0, 0.88, 0.252);
    g.add(window_);
    // Rejilla del altavoz.
    const grille = new Mesh(new PlaneGeometry(0.56, 0.42), new MeshStandardMaterial({
      map: canvasTex(256, 192, (c, w, h) => {
        c.fillStyle = '#2a1a10'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#c8a060';
        for (let y = 8; y < h; y += 12) for (let x = 8 + (y % 24 ? 6 : 0); x < w; x += 12) { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
      }), roughness: 0.6
    }));
    grille.position.set(0, 0.38, 0.252);
    g.add(grille);
    const trim = new Mesh(new BoxGeometry(0.78, 0.04, 0.52), chrome);
    trim.position.y = 0.04;
    g.add(trim);
    this.playing = false;
    this.t = 0;
  }

  tick(dt, playing) {
    this.t += dt;
    const c = new Color();
    this.tubes.forEach((m, i) => {
      if (playing) c.setHSL((this.t * 0.15 + i * 0.12) % 1, 0.9, 0.55);
      else c.set(i < 3 ? 0x6a1838 : 0x10505e);
      m.color.copy(c);
    });
  }
}

// ------------------------------------------------------------ máquina de refrescos

export class Vending extends Prop {
  constructor() {
    super('vending', 0.9, 0.75);
    this.title = 'REFRESCOS';
    this.promptText = 'COMPRAR REFRESCO (1 MONEDA)';
    const g = this.group;
    const shell = mat(0xc4122e, 0.4);
    const body = new Mesh(new BoxGeometry(0.9, 1.9, 0.75), shell);
    body.position.y = 0.95;
    g.add(body);
    // Escaparate con latas en filas, iluminado.
    const inside = new Mesh(new BoxGeometry(0.56, 1.2, 0.02), new MeshBasicMaterial({ color: 0xf4f8ff }));
    inside.position.set(-0.1, 1.15, 0.3);
    g.add(inside);
    const colors = [0xc4122e, 0x2a7fff, 0x3dff8b, 0xffd23f, 0xff8c1a];
    const canGeo = new CylinderGeometry(0.032, 0.032, 0.12, 14);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const can = new Mesh(canGeo, mat(colors[(r + c) % colors.length], 0.3, { metalness: 0.5 }));
        can.position.set(-0.32 + c * 0.11, 0.66 + r * 0.24, 0.34);
        g.add(can);
      }
    }
    const glass = new Mesh(new PlaneGeometry(0.6, 1.25), new MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false }));
    glass.position.set(-0.1, 1.15, 0.38);
    glass.renderOrder = 3;
    g.add(glass);
    // Panel derecho: cartel, ranura y botones.
    const panel = new Mesh(new PlaneGeometry(0.22, 1.25), new MeshStandardMaterial({
      map: canvasTex(176, 1000, (c, w, h) => {
        c.fillStyle = '#1a1a2a'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#ffffff'; c.font = font(20); c.textAlign = 'center';
        c.save(); c.translate(w / 2, 300); c.rotate(-Math.PI / 2); c.font = font(46); c.fillStyle = '#ff3d8b'; c.fillText('REFRESCOS', 0, 16); c.restore();
        c.fillStyle = '#ffd23f'; c.font = font(18); c.fillText('1 MONEDA', w / 2, 600);
        c.fillStyle = '#c8ccd6'; c.fillRect(60, 640, 56, 90);
        c.fillStyle = '#111'; c.fillRect(84, 650, 8, 70);
        for (let i = 0; i < 5; i++) { c.fillStyle = '#' + colors[i].toString(16).padStart(6, '0'); c.fillRect(48, 770 + i * 40, 80, 26); }
      }), roughness: 0.5
    }));
    panel.position.set(0.32, 1.15, 0.38);
    g.add(panel);
    const sign = new Mesh(new BoxGeometry(0.88, 0.2, 0.04), new MeshBasicMaterial({ color: 0xff3d8b }));
    sign.position.set(0, 1.92, 0.36);
    g.add(sign);
    // Bandeja de salida.
    const tray = new Mesh(new BoxGeometry(0.5, 0.14, 0.06), mat(0x05050a));
    tray.position.set(-0.1, 0.25, 0.37);
    g.add(tray);
    this.can = new Mesh(canGeo, mat(0x2a7fff, 0.3, { metalness: 0.5 }));
    this.can.visible = false;
    g.add(this.can);
    this.drop = 0;
  }

  // Cae una lata a la bandeja.
  dispense(color) {
    this.can.material.color.set(color);
    this.can.position.set(-0.1, 0.9, 0.34);
    this.can.rotation.set(0, 0, Math.PI / 2);
    this.can.visible = true;
    this.drop = 1.2;
    this.vy = 0;
  }

  tick(dt) {
    if (this.drop <= 0) return;
    this.drop -= dt;
    this.vy -= 9.8 * dt;
    this.can.position.y = Math.max(0.24, this.can.position.y + this.vy * dt);
    if (this.drop <= 0) this.can.visible = false;
  }
}

// ------------------------------------------------------------ taburete

export function stool(color = 0xc4122e) {
  const g = new Group();
  const seat = new Mesh(new CylinderGeometry(0.17, 0.16, 0.08, 20), mat(color, 0.35));
  seat.position.y = 0.66;
  const ring = new Mesh(new TorusGeometry(0.15, 0.012, 8, 24), mat(0xd8dce6, 0.2, { metalness: 0.9 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  const pole = new Mesh(new CylinderGeometry(0.025, 0.025, 0.62, 10), mat(0xd8dce6, 0.2, { metalness: 0.9 }));
  pole.position.y = 0.31;
  const base = new Mesh(new CylinderGeometry(0.16, 0.18, 0.03, 20), mat(0x222222, 0.4, { metalness: 0.6 }));
  base.position.y = 0.015;
  g.add(seat, ring, pole, base);
  return g;
}

// ------------------------------------------------------------ charco de luz en el suelo (suma de color)

let glowTexture = null;
export function glowPool(color, w, d) {
  if (!glowTexture) {
    glowTexture = canvasTex(128, 128, (c, w2, h2) => {
      const grad = c.createRadialGradient(w2 / 2, h2 / 2, 0, w2 / 2, h2 / 2, w2 / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.55)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.18)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, w2, h2);
    });
  }
  const m = new Mesh(new PlaneGeometry(w, d), new MeshBasicMaterial({ map: glowTexture, color, transparent: true, blending: AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = 1;
  return m;
}

// ------------------------------------------------------------ pantalla sin señal

export class StaticScreen {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 112;     // ruido a media resolución: se amplía en la textura
    this.canvas.height = 144;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(112, 144);
    this.frame = 0;
    this.seed = 99;
  }

  rnd() { return (this.seed = (this.seed * 16807) % 2147483647) / 2147483647; }

  // Devuelve true si ha redibujado (cada 3 pasos).
  update() {
    if (++this.frame % 3) return false;
    const d = this.img.data;
    const bar = (this.frame * 2) % 160 - 8;
    for (let y = 0; y < 144; y++) {
      const boost = Math.abs(y - bar) < 6 ? 60 : 0;
      for (let x = 0; x < 112; x++) {
        const v = Math.min(255, this.rnd() * 140 + boost);
        const i = (y * 112 + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    if (Math.floor(this.frame / 90) % 2 === 0) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(16, 62, 80, 20);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '8px ' + FONT_FAMILY + ', monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('SIN SEÑAL', 56, 76);
    }
    return true;
  }
}


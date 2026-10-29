/* Arranque: comprueba WebGL, carga la fuente y los datos, y pone en marcha la aplicación. */
import './style.css';
import { loadFont } from './core/font.js';
import { text } from './gfx/text.js';
import { load } from './data/storage.js';
import { audio } from './core/audio.js';
import { App } from './app/App.js';

const TEST = /[?&]test=1\b/.test(location.search);

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

function noWebGL() {
  document.getElementById('no-webgl').hidden = false;
  document.documentElement.setAttribute('data-state', 'NO_WEBGL');
  document.documentElement.setAttribute('data-ready', '1');
}

async function boot() {
  await loadFont();
  text.init();
  const data = load();
  audio.setMuted(data.settings.muted);
  if (!hasWebGL()) { noWebGL(); return; }
  const app = new App({ test: TEST });
  try {
    app.init();
  } catch (e) {
    // El contexto WebGL puede fallar al crearse aunque la comprobación pase (drivers bloqueados).
    if (app.renderer) app.renderer.setAnimationLoop(null);
    noWebGL();
    return;
  }
  if (TEST) window.__arcadeTest = app.testApi();
  document.documentElement.setAttribute('data-ready', '1');
}

boot();

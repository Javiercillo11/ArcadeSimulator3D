/* Registra la fuente incrustada (Press Start 2P) como 'ArcadeFont' y espera a que esté lista. */
import b64 from './fontData.js';

export const FONT_FAMILY = 'ArcadeFont';

export function loadFont() {
  const css = "@font-face{font-family:'" + FONT_FAMILY + "';src:url(data:font/ttf;base64," + b64 + ") format('truetype');font-display:block;}";
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  // Si el navegador tarda o falla, se arranca igual con la fuente de reserva.
  const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
  return Promise.race([document.fonts.load('8px ' + FONT_FAMILY).catch(() => {}), timeout]);
}

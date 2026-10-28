#!/usr/bin/env node
// Genera arcade-standalone.html: un único archivo con todo el CSS y JS incrustado.
// Uso: node tools/bundle.js [salida]
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const out = path.resolve(ROOT, process.argv[2] || 'arcade-standalone.html');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Evita que un "</script>" o "</style>" dentro del código cierre la etiqueta antes de tiempo.
const safe = (code, tag) => code.replace(new RegExp('</' + tag, 'gi'), '<\\/' + tag);

let styles = 0;
let scripts = 0;

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
let assets = 0;

// Las imágenes referenciadas con url(...) en el CSS pasan a data URI (rutas relativas a la hoja).
function inlineUrls(css, href) {
  return css.replace(/url\((['"]?)(?!data:)([^'")]+)\1\)/g, (_, q, ref) => {
    const file = path.join(ROOT, path.dirname(href), ref);
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!mime || !fs.existsSync(file)) return _;
    assets++;
    return 'url("data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64') + '")';
  });
}

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  styles++;
  return '<style>/* ' + href + ' */\n' + safe(inlineUrls(read(href), href), 'style') + '\n</style>';
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  scripts++;
  return '<script>/* ' + src + ' */\n' + safe(read(src), 'script') + '\n</script>';
});

if (/<(link|script)[^>]+(href|src)="(?!data:)[^"]+"/.test(html)) {
  console.error('Quedan recursos externos sin incrustar.');
  process.exit(1);
}

fs.writeFileSync(out, html);
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`${path.relative(ROOT, out)}: ${styles} hojas de estilo, ${scripts} scripts y ${assets} imágenes incrustados (${kb} KB)`);

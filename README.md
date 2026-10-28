# Arcade Retro

Máquina arcade local con dos juegos originales en pixel art y chiptune:

- **MAZE MUNCHER**: laberinto. Come los 240 puntos, usa las 4 superpíldoras para cazar a los enemigos y pasa de nivel.
- **BARREL CLIMB**: plataformas. Sube por las vigas esquivando o saltando los barriles de GROG y rescata a LUNA en la cima.

Hasta 5 jugadores, cada uno con su récord por juego, guardado en el navegador.

## Cómo jugar

1. Abre `index.html` con doble clic. No hace falta servidor, internet ni instalar nada.
2. Crea tu jugador (de 1 a 10 caracteres) o elige uno existente.
3. Elige juego en el menú y pulsa **Enter** en la pantalla de título.

Si prefieres un solo archivo, `npm run bundle` genera `arcade-standalone.html`, que lo lleva todo dentro.

## Controles

| Acción | Teclado | Táctil |
|---|---|---|
| Mover / subir / bajar | Flechas (también WASD) | Joystick (pulsa o mantén hacia un lado) |
| Saltar (BARREL CLIMB) | Espacio | Botón rojo |
| Pausa / menú | Esc o P | Botón ❚❚ |
| Confirmar | Enter | Tocar (o START) |
| Silenciar | M | Botón del altavoz |

La interfaz se usa entera con teclado: las flechas mueven el foco entre botones y Enter confirma. El joystick, el botón rojo y los botones ❚❚ y START del panel inferior funcionan con ratón y táctil; en móvil se agrandan y los dos botones amarillos (decorativos) se ocultan.

El sonido empieza con la primera tecla o el primer toque, porque los navegadores lo exigen. Hasta entonces el botón del altavoz aparece con borde discontinuo.

## Reglas

**MAZE MUNCHER**
- Punto: 10. Superpíldora: 50. Enemigos encadenados durante una superpíldora: 200 / 400 / 800 / 1600.
- La fruta aparece al comer 70 y 170 puntos, y vale más en cada nivel (de 100 a 5000).
- Empiezas con 3 vidas y ganas una más a los 10 000 puntos.
- En cada nivel suben las velocidades y bajan la duración del modo vulnerable y la de la dispersión.
- Los enemigos: RUSTY va a tu casilla, PETAL apunta 4 casillas por delante de ti, FROST usa un vector entre RUSTY y tú, y AMBER te persigue de lejos pero se retira cuando está cerca.

**BARREL CLIMB**
- Saltar un barril o una llama: 100. Romperlo con el martillo: 300, 500 u 800.
- La bonificación empieza en 5000 (+1000 por nivel, hasta 8000), baja 100 cada 2 s y se suma al rescatar. Si llega a 0, pierdes una vida.
- 3 vidas y una extra a los 7000 puntos.
- Caerse desde más de 20 px es mortal. Con el martillo no puedes saltar ni subir escaleras.
- Los barriles azules encienden el bidón y generan una llama que recorre las vigas y sube escaleras.
- En cada nivel GROG lanza más rápido, los barriles ruedan más deprisa y bajan escaleras más a menudo, y hay más llamas.

## Estructura

```
index.html            página única; carga los scripts en orden
css/                  arcade.css (mueble «burbujas» y tokens), crt.css (efectos), screens.css (pantallas)
fonts/font.js         Press Start 2P incrustada en base64 + OFL.txt
js/core/              app.js (estados), loop.js (paso fijo), input.js, audio.js, rng.js
js/data/              storage.js (esquema y validación), users.js, scores.js
js/gfx/               renderer.js (224×288), sprites.js (matrices → canvas), text.js (texto bitmap)
js/ui/                user-select.js, arcade-menu.js, records.js, overlays.js
js/games/maze/        maze-map.js, maze-game.js, ghost-ai.js, maze-sprites.js
js/games/climb/       climb-level.js, climb-game.js, physics.js, hazards.js, climb-sprites.js
tests/                pruebas Playwright
tools/bundle.js       genera arcade-standalone.html
```

**Decisiones técnicas**
- Scripts clásicos con el espacio de nombres global `Arcade.*`, porque los módulos ES no funcionan desde `file://`.
- Cada juego cumple el mismo contrato: `init(ctx, user)`, `update(dt)`, `render()`, `pause()`, `resume()`, `getScore()`, `destroy()`. `app.js` solo habla con esa interfaz.
- Un único `requestAnimationFrame` con paso fijo de 60 Hz y un acumulador limitado a 250 ms. El juego va igual de rápido a 60, 144 o 30 Hz, y no da un salto al volver de otra pestaña.
- El canvas dibuja a 224×288 nativos y se escala sin suavizado. Usa escala entera (×2, ×3…) cuando así se pierde como mucho un 10 % del hueco del monitor; si no, una escala fraccionaria para llenarlo. El grosor del bisel y del marco naranja se mide en el DOM, no está fijado en el código.
- **Mueble imagen (pantallas apaisadas de 900 px o más):** el mueble es la ilustración `assets/cabinet.png` (1194×642), escalada para cubrir la ventana. Encima se colocan los elementos reales en coordenadas de la imagen: la barra de jugador, el monitor (menús a todo el ancho y el juego vertical centrado), y zonas de pulsación invisibles sobre el joystick, el botón rojo, la pausa y START, que brillan al pulsarlas. Las posiciones están en el bloque «mueble imagen» de `css/arcade.css`; si cambias la imagen, hay que ajustar esas coordenadas.
- **Mueble CSS (pantallas verticales o estrechas):** el mueble (marquesina, cuerpo con laterales menta, monitor con bisel y marco naranja, panel de mandos) se construye solo con CSS y SVG incrustado, con volumen real: luz fija desde arriba a la izquierda, cubierta de mandos inclinada con `perspective` y `rotateX` (el joystick se contrarrota para quedar vertical), paredes interiores hundidas, monitor en un hueco y sombras proyectadas. Toda su geometría y su paleta están en variables de `:root` en `css/arcade.css`. Los dinosaurios de la marquesina son originales y se generan por geometría en `js/ui/arcade-menu.js`.
- El bucle principal no crea objetos, arrays, cadenas ni closures. Los barriles, llamas y textos emergentes salen de pools fijos. Solo quedan los números temporales que V8 crea al operar con decimales (unos 0,4–0,7 KB por fotograma), que el recolector menor elimina sin pausas apreciables.

## Persistencia

Los datos se guardan en `localStorage`, bajo la clave `arcade.v1`, con este esquema:

```json
{
  "schemaVersion": 1,
  "activeUserId": "u_…",
  "users": [{ "id": "u_…", "name": "JAVI", "createdAt": "ISO",
              "records": { "maze": { "best": 0, "date": null, "level": 0 },
                           "climb": { "best": 0, "date": null, "level": 0 } },
              "history": [{ "game": "maze", "score": 0, "level": 1, "date": "ISO" }] }],
  "settings": { "muted": false, "crt": true }
}
```

- Al cargar se valida todo. Si algo está dañado, el contenido original se copia en `arcade.backup` y se recupera lo que sea válido. Nunca se borra todo.
- El récord solo cambia si la puntuación lo supera. El historial guarda las últimas 20 partidas de cada juego.
- Si `localStorage` no está disponible (por ejemplo, porque el navegador lo bloquea), se juega en **modo memoria** y aparece un aviso.

**Límites**
- Los datos viven en el navegador y el perfil donde juegas. Otro navegador u otro perfil empieza de cero.
- Borrar los datos de navegación o jugar en una ventana privada elimina los récords. Para conservarlos, usa **RÉCORDS → EXPORTAR**, que descarga un JSON, e **IMPORTAR** para recuperarlo.
- Con `file://`, Chrome comparte el mismo almacenamiento entre todas las páginas locales. Otros navegadores pueden separarlo por archivo, así que `index.html` y `arcade-standalone.html` pueden no compartir récords.

## Diferencias con los clásicos

Los juegos reproducen las mecánicas del género, pero no copian ni el código, ni los mapas, ni los sprites, ni la música originales. Su comportamiento es equivalente, no idéntico.

**MAZE MUNCHER**
- Laberinto propio (simétrico, 28×31) con otra distribución de pasillos.
- Los enemigos deciden al llegar al centro de cada casilla, no una casilla antes. Desempatan en el orden arriba, izquierda, abajo, derecha, sin dar media vuelta salvo al cambiar de modo.
- Sin «Cruise Elroy» (el aumento de velocidad del primer enemigo al quedar pocos puntos), sin zonas prohibidas para girar hacia arriba y sin frenazo al comer puntos.
- Ciclos de dispersión y persecución simplificados en tres tramos de niveles. Más allá del nivel 16, el modo vulnerable dura 1 s.
- La salida de la casa usa contadores de puntos por enemigo (o uno global tras perder una vida) más un temporizador de 4 s sin comer.
- El giro anticipado admite hasta 3 px antes y después del centro de la casilla.

**BARREL CLIMB**
- Un único tipo de fase (vigas). No hay fases de remaches, ascensores ni cintas.
- Las vigas son rectas inclinadas continuas, en lugar de tramos escalonados.
- Los barriles bajan escaleras con una probabilidad fija por nivel, mayor si estás debajo. No te «apuntan».
- Las escaleras rotas no las puede usar nadie (ni el jugador, ni los barriles, ni las llamas).
- El salto tiene un arco fijo de unos 16 px de altura y 36 fotogramas en el aire, sin control en el aire. Está ajustado para que saltar un barril que viene hacia ti funcione en una ventana amplia (comprobado en las pruebas).

## Licencias

- **Código, sprites, mapas, niveles, música y efectos**: creación propia de este proyecto.
- **Ilustración del mueble** (`assets/cabinet.png`): aportada por el usuario. Sus dos dinosaurios recuerdan mucho a los personajes de *Bubble Bobble* (Taito); para uso personal no hay problema, pero si el proyecto se va a publicar o distribuir conviene sustituirla. Los dinosaurios del mueble CSS sí son originales.
- **Fuente**: Press Start 2P, © 2012 The Press Start 2P Project Authors, con licencia SIL Open Font License 1.1 (`fonts/OFL.txt`). Va incrustada en `fonts/font.js` sin modificar. Nota: a 8×8 píxeles, la fuente dibuja las mayúsculas acentuadas (Á, É, Í, Ó, Ú) con un tamaño reducido para que el acento quepa en la celda.

## Desarrollo

Para jugar no hace falta nada. Para las pruebas:

```bash
npm install
npx playwright install chromium
npm test              # batería completa (Playwright, Chromium)
npm run bundle        # genera arcade-standalone.html
```

- Las pruebas abren `index.html?test=1`, que activa los ganchos `window.__arcadeTest`: avanzar fotogramas, colocar al jugador, consultar el estado o forzar un nivel. Sin `?test=1`, los ganchos no existen.
- En WSL sin las dependencias de sistema de Chromium, falta `libasound.so.2`. Puedes instalarla con `sudo npx playwright install-deps chromium` o extraerla sin instalar (`apt-get download libasound2t64` y `dpkg -x` en `~/.cache/arcade-libs/root`). La configuración de Playwright la usa automáticamente si existe.
- Detalle de las pruebas y sus resultados: [TESTS.md](TESTS.md).

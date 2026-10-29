# Salón Recreativo 3D

Un salón recreativo en primera persona con dos máquinas que se pueden jugar en su propia pantalla:

- **MAZE MUNCHER**: laberinto. Come los 240 puntos, usa las 4 superpíldoras para cazar a los enemigos y pasa de nivel.
- **BARREL CLIMB**: plataformas. Sube por las vigas esquivando o saltando los barriles de GROG y rescata a LUNA en la cima.

Hasta 5 jugadores, cada uno con su récord por juego, guardado en el navegador y visible en el tablero luminoso de la pared.

## Cómo jugar

1. Genera el archivo con `npm install` y `npm run build` (ver *Desarrollo*), y abre **`dist/arcade.html`** con doble clic. No hace falta servidor ni internet: lleva dentro el código, la fuente y todas las texturas.
2. En **¿QUÉ USUARIO VA A JUGAR?** crea tu jugador (de 1 a 10 caracteres) o elige uno, y pulsa **ENTRAR AL SALÓN**.
3. Camina hasta una máquina. Cuando estés cerca y mirándola aparecerá **[E] JUGAR A …**: pulsa **E** y te colocarás frente a la pantalla.
4. En la pantalla de título pulsa **Enter**. Al terminar verás tu puntuación y, si lo es, **¡NUEVO RÉCORD!**. Pulsa **Q** para levantarte.

El navegador captura el ratón al entrar en la sala, para que puedas mirar alrededor. **Esc** lo suelta y abre el menú; para volver, pulsa **CONTINUAR** o haz clic en la escena (el navegador exige un clic para volver a capturarlo, y así se indica en pantalla).

## Controles

| Dónde | Acción | Teclado | Táctil |
|---|---|---|---|
| Sala | Andar / mirar | WASD o flechas / ratón | Palanca virtual / arrastrar en la mitad derecha |
| Sala | Correr | Shift | — |
| Sala | Usar máquina | E | Botón E |
| Sala | Menú | Esc | Botón ☰ |
| Máquina | Mover / escalar | Flechas o WASD | Cruceta |
| Máquina | Saltar | Espacio | A |
| Máquina | Empezar | Enter | START |
| Máquina | Pausa (Continuar / Reiniciar / Levantarse) | Esc | ❚❚ |
| Máquina | Acercar o alejar la pantalla / levantarse | F / Q | — / SALIR |
| Siempre | Silencio | M | — |

Los menús se usan también con el teclado: las flechas mueven el foco y Enter confirma. En pantallas táctiles (`pointer: coarse`) aparecen los controles táctiles y no se captura el ratón.

**Menú de la sala:** Continuar, Récords (con exportar e importar JSON), Cambiar usuario, Controles, Sonido, Pantalla CRT, Calidad (alta o baja) y Sensibilidad del ratón. Todos los ajustes se guardan.

## Qué hay en el salón

- **Manos en primera persona** que se balancean al andar. Al sentarte, la izquierda agarra la palanca y la derecha se apoya en los botones; el índice baja al pulsar.
- **Máquinas 3D** con marquesina luminosa. La palanca se inclina y los botones se hunden con lo que pulsas.
- **Pantalla CRT**: cada juego dibuja en un canvas de 224×288 que se usa como textura, con un *shader* de curvatura, scanlines, máscara de fósforo, viñeta y halo. Se puede desactivar en el menú.
- **Demo**: las máquinas que no se usan juegan solas con un piloto automático y muestran **PULSA E**.
- **Tablero de récords** en la pared izquierda, con los 5 mejores de cada juego en directo.

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
index.html                 overlays HTML (usuario, menús, récords, controles, HUD, táctil, sin WebGL)
vite.config.js             build de un solo archivo → dist/arcade.html
src/
  main.js                  arranque: WebGL, fuente, datos
  app/App.js               estados USER_SELECT → ROOM ⇄ ROOM_MENU / SITTING → CABINET ⇄ CABINET_PAUSE → STANDING, y el bucle único
  data/                    storage.js (esquema v2, validación, migración), users.js, scores.js
  core/                    input.js, audio.js (Web Audio), font.js + fontData.js (Press Start 2P), rng.js
  gfx/                     sprites.js (matrices → canvas), text.js (texto bitmap)
  world/                   Room.js, Cabinet.js, CrtMaterial.js, Hands.js, FirstPerson.js
  arcade/ArcadeMachine.js  demo, título, partida, pausa, fin y récord de cada máquina
  games/maze/              MazeGame.js (lógica), mazeMap.js, ghostAI.js, mazeRender.js, mazeSprites.js
  games/climb/             ClimbGame.js (lógica), climbLevel.js, climbPhysics.js, climbHazards.js, climbRender.js, climbSprites.js
  ui/                      panels.js, touch.js, dom.js
tests/unit/                Vitest: datos, laberinto y plataformas
tests/e2e/                 Playwright sobre dist/arcade.html
```

**Decisiones técnicas**
- **Contrato de juego:** `new Game({ level, rng, sfx })`, `update(input)` a 60 Hz fijos y estado legible en `score`, `lives`, `level`, `state` y `gameOver`. La lógica no toca el DOM ni el canvas, y el dibujo está en `*Render.js`. Por eso las mecánicas se prueban con Vitest, sin navegador.
- **Bucle único:** solo existe `renderer.setAnimationLoop`, con paso fijo de 1/60 s y un máximo de 5 pasos por fotograma (si el equipo va lento, el juego se ralentiza en lugar de saltar). Sentarse, levantarse, reiniciar o cambiar de máquina nunca crea otro bucle. La demo de las máquinas inactivas avanza a 30 Hz.
- **Movimiento:** colisión de círculo (0,28 m) contra cajas alineadas a los ejes (máquinas y banco), resuelta eje a eje para deslizar por las paredes. Velocidad de 1,6 m/s, o 3 m/s corriendo.
- **Al sentarse:** la cámara va en 0,8 s hasta una pose que se calcula según la proporción de la ventana. La pantalla ocupa el 40 % de la vista y se mira un poco hacia abajo para ver los mandos. Con **F**, la vista se pone de frente y la pantalla ocupa el 92 %.
- **Rendimiento:** geometría sencilla (unas 70 llamadas de dibujo y 7000 triángulos), sin sombras dinámicas y con `pixelRatio` limitado a 2. En calidad baja, `pixelRatio` queda en 1 y solo hay una luz puntual.
- **Sin WebGL:** se muestra un mensaje que lo explica, en lugar de una página en blanco.
- Sin React ni otras librerías de interfaz: los overlays son HTML y CSS. La única dependencia de ejecución es three.js.

## Persistencia

Los datos se guardan en `localStorage`, con la clave `arcade.v1` (la misma que en la versión anterior) y este esquema:

```json
{
  "schemaVersion": 2,
  "activeUserId": "u_…",
  "users": [{ "id": "u_…", "name": "JAVI", "createdAt": "ISO",
              "records": { "maze": { "best": 0, "date": null, "level": 0 },
                           "climb": { "best": 0, "date": null, "level": 0 } },
              "history": [{ "game": "maze", "score": 0, "level": 1, "date": "ISO" }] }],
  "settings": { "muted": false, "crt": true, "quality": "high", "mouseSens": 1 }
}
```

- Los datos de la versión anterior (`schemaVersion` 1) se migran solos al abrir: se conservan usuarios, récords e historial y se añaden `quality` y `mouseSens`.
- Al cargar se valida todo. Si algo está dañado, el contenido original se copia en `arcade.backup` y se recupera lo que sea válido. Nunca se borra todo.
- El récord solo cambia si la puntuación lo supera. El historial guarda las últimas 20 partidas de cada juego.
- Si te levantas, pulsas REINICIAR o cambias de usuario a mitad de partida, esa partida no se guarda (igual que al salir al menú en la versión anterior).
- Si `localStorage` no está disponible, se juega en **modo memoria** y aparece un aviso.

## Limitaciones

- Los datos viven en el navegador y en el perfil donde juegas. Borrar los datos de navegación o jugar en una ventana privada elimina los récords. Para conservarlos, usa **RÉCORDS → EXPORTAR** y luego **IMPORTAR**.
- Con `file://`, Chrome comparte el almacenamiento entre todas las páginas locales. Otros navegadores pueden separarlo por archivo.
- Hace falta WebGL. En equipos sin aceleración gráfica funciona por software, pero va lento; en ese caso conviene usar **CALIDAD: BAJA**.
- El navegador no deja volver a capturar el ratón sin un clic. Tras **Esc** hay que pulsar **CONTINUAR** o hacer clic en la escena.
- La fuente Press Start 2P dibuja las mayúsculas acentuadas (Á, É, Í, Ó, Ú) más pequeñas, para que el acento quepa en la celda de 8×8.

## Diferencias con los clásicos

Los juegos reproducen las mecánicas del género, pero no copian el código, los mapas, los sprites ni la música originales. Su comportamiento es equivalente, no idéntico.

**MAZE MUNCHER**
- Laberinto propio (simétrico, 28×31) con otra distribución de pasillos.
- Los enemigos deciden al llegar al centro de cada casilla, no una casilla antes. Desempatan en el orden arriba, izquierda, abajo, derecha, y no dan media vuelta salvo al cambiar de modo.
- Sin «Cruise Elroy» (el primer enemigo no acelera cuando quedan pocos puntos), sin zonas en las que esté prohibido girar hacia arriba y sin frenazo al comer puntos.
- Ciclos de dispersión y persecución simplificados en tres tramos de niveles. Más allá del nivel 16, el modo vulnerable dura 1 s.
- La salida de la casa usa contadores de puntos por enemigo (o uno global tras perder una vida), más un temporizador de 4 s sin comer.
- El giro anticipado admite hasta 3 px antes y después del centro de la casilla.

**BARREL CLIMB**
- Un único tipo de fase (vigas). No hay fases de remaches, ascensores ni cintas.
- Las vigas son rectas inclinadas continuas, en lugar de tramos escalonados.
- Los barriles bajan escaleras con una probabilidad fija por nivel, mayor si estás debajo. No te «apuntan».
- Las escaleras rotas no las puede usar nadie: ni el jugador, ni los barriles, ni las llamas.
- El salto tiene un arco fijo de unos 16 px de altura y 36 fotogramas en el aire, sin control en el aire.

## Licencias

- **Código, modelos 3D, texturas, sprites, mapas, niveles, música y efectos**: creación propia de este proyecto. Todo se genera por código; no hay imágenes ni modelos externos.
- **three.js** (r170): licencia MIT, incluido en el archivo final.
- **Fuente**: Press Start 2P, © 2012 The Press Start 2P Project Authors, con licencia SIL Open Font License 1.1 (`fonts/OFL.txt`). Va incrustada sin modificar.

## Desarrollo

```bash
npm install
npx playwright install chromium
npm run dev          # servidor de desarrollo de Vite
npm run build        # genera dist/arcade.html (un único archivo)
npm run test:unit    # Vitest: lógica de datos y de los juegos
npm run test:e2e     # build + Playwright sobre dist/arcade.html
npm test             # las dos baterías
```

- Las pruebas e2e abren `dist/arcade.html?test=1`. El parámetro `?test=1` activa `window.__arcadeTest` (avanzar pasos, teletransportar al jugador, consultar el estado o terminar una partida con una puntuación dada) y hace que el tiempo solo avance con `step()`. Sin `?test=1`, los ganchos no existen.
- En WSL sin las dependencias de sistema de Chromium, falta `libasound.so.2`. Puedes instalarla con `sudo npx playwright install-deps chromium` o extraerla sin instalar (`apt-get download libasound2t64` y `dpkg -x` en `~/.cache/arcade-libs/root`). La configuración de Playwright la usa automáticamente si existe.
- Detalle de las pruebas y sus resultados: [TESTS.md](TESTS.md).

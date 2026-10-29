# Salón Recreativo 3D

Un salón recreativo en primera persona. Entras, ves tus manos, paseas entre las máquinas y juegas en ellas:

| Máquina | Qué es |
|---|---|
| **MAZE MUNCHER** | Laberinto: come los 240 puntos y caza a los enemigos con las superpíldoras. |
| **BARREL CLIMB** | Plataformas: sube por las vigas esquivando barriles y rescata a LUNA. |
| **BRICK BLAST** | Rompe ladrillos con una pala y una bola; cápsulas de pala ancha, bola lenta y vida extra. |
| **AIR HOCKEY** | Mesa contra la máquina: gana quien llegue antes a 7 goles. |
| **SKEE-BALL** | Pista de 9 bolas: apunta, carga la fuerza y mete la bola en los anillos (10-50) o en el 100. |
| **GRÚA DE PELUCHES** | Mueve la pinza 15 s y déjala caer; si agarra un peluche, es tuyo. |

Además, el salón tiene una **recepción** con Mari, que da monedas y canjea tickets por premios, y una **vitrina** con los premios que has ganado. También hay una **gramola** con 3 canciones, una **máquina de refrescos**, una recreativa **fuera de servicio** y un tablero luminoso con los récords de todas las máquinas.

Hasta 5 jugadores, cada uno con sus récords, monedas, tickets, premios y logros, guardados en el navegador.

## Cómo jugar

1. Genera el archivo con `npm install` y `npm run build` (ver *Desarrollo*), y abre **`dist/arcade.html`** con doble clic. No hace falta servidor ni internet: lleva dentro el código, la fuente y todas las texturas.
2. En **¿QUÉ USUARIO VA A JUGAR?** crea tu jugador (de 1 a 10 caracteres) o elige uno, y pulsa **ENTRAR AL SALÓN**.
3. Camina hasta una máquina. Cuando estés cerca y mirándola aparecerá **[E] …**. Pulsa **E** para jugar, hablar con Mari, elegir canción o comprar un refresco.
4. En una máquina, **Enter** echa una moneda y empieza. Al terminar ganas **tickets**. Si entras en el **TOP 10** de la máquina, pones tus iniciales. **Q** te levanta.

El navegador captura el ratón al entrar en la sala, para que puedas mirar alrededor. **Esc** lo suelta y abre el menú. Para volver, pulsa **CONTINUAR** o haz clic en la escena: el navegador exige ese clic, y se indica en pantalla.

## Controles

| Dónde | Acción | Teclado | Táctil |
|---|---|---|---|
| Sala | Andar / mirar | WASD o flechas / ratón | Palanca virtual / arrastrar |
| Sala | Correr | Shift | — |
| Sala | Usar (jugar, hablar, gramola, refresco) | E | Botón E |
| Sala | Menú | Esc | ☰ |
| Máquina | Mover | Flechas o WASD | Cruceta |
| Máquina | Saltar / lanzar / bajar la pinza | Espacio | A |
| Máquina | Empezar (1 moneda) | Enter | START |
| Máquina | Pausa (Continuar / Reiniciar / Pantalla grande / Levantarse) | Esc | ❚❚ |
| Máquina | Acercar la vista | F | — |
| Máquina | **Pantalla grande** | **G** | ▣ |
| Máquina | Levantarse | Q | SALIR |
| Iniciales | Letra / mover / confirmar | ↑↓ / ←→ / Espacio o Enter | Cruceta / A |
| Siempre | Silencio | M | — |

- **Pantalla grande (G):** el juego ocupa toda la ventana en 2D, con píxeles nítidos y scanlines. Va bien para jugar en serio o en pantallas pequeñas. Otra **G** vuelve al salón. No está en la grúa, que es 3D.
- **Pantalla completa:** en el menú de la sala (**PANTALLA COMPLETA**), o con F11 del navegador.
- **SKEE-BALL:** ←/→ apunta. Mantén **Espacio**: la barra de fuerza sube y baja, y sueltas en el momento justo.
- Los menús se usan también con el teclado: las flechas mueven el foco y Enter confirma. En pantallas táctiles aparecen los controles táctiles y no se captura el ratón.

## Monedas, tickets, premios y logros

- **Monedas:** cada jugador empieza con 3, y cada partida o intento en la grúa cuesta 1. Mari, en **recepción** (a la derecha), da 5 cada vez, hasta 30. Los refrescos cuestan 1. Sin monedas, la pantalla de título muestra **INSERTE MONEDA**.
- **Tickets** al terminar cada partida:
  - recreativas: 1 por cada 1000 puntos, con un mínimo de 1 y un máximo de 50;
  - SKEE-BALL: 1 por cada 10 puntos;
  - AIR HOCKEY: 10 si ganas o 2 si pierdes, más 1 por gol.
- **Premios:** en recepción, del llavero (15 tickets) al trofeo de oro (350). Lo que canjeas y los peluches de la grúa aparecen en **TUS PREMIOS**, la vitrina junto a recepción, que guarda hasta 40.
- **TOP 10:** cada máquina viene con 10 puntuaciones del salón. Si superas la décima, pones tus **iniciales** con la palanca. El tablero de la pared muestra el TOP 5 de cada juego y **RÉCORDS** en el menú, el TOP 10 completo y tus récords.
- **Logros:** hay 14, por ejemplo *COMILÓN* (los 4 enemigos con una superpíldora), *GANCHO DE ORO* (un peluche en la grúa), *PLENO* (meter una bola en el 100) o *TURISTA* (jugar a las 5 máquinas). Se ven en **LOGROS**, en el menú.

## Qué hay en el salón

- **Manos en primera persona** que se balancean al andar. Al sentarte agarran la palanca y los botones; en la mesa de hockey, el mazo; en el skee, la bola. Con un refresco, llevas la lata en la mano.
- **Recreativas 3D** con arte propio: vinilos laterales con los personajes, marquesina retroiluminada, bisel impreso, cubierta de mandos con rótulos, puerta de monedas metálica, moldura luminosa y pegatinas. La palanca se inclina y los botones se hunden.
- **Pantalla CRT** con *shader* de curvatura, scanlines, máscara de fósforo, viñeta y halo. Se puede desactivar.
- **Mesas:** la superficie es el juego en directo. En la de hockey, los mazos 3D siguen a los del juego. La pista de skee tiene la diana inclinada y un marcador encima.
- **Grúa** con urna de cristal, 14 peluches, pinza de tres dedos que se abre y se cierra, cable y boca de premios. A veces el peluche se escurre al subir, como en las de verdad.
- **Mari**, la recepcionista: te sigue con la mirada, parpadea, saluda al acercarte, habla con bocadillos y te deja las monedas en el mostrador. Detrás tiene el catálogo de premios con sus precios.
- **Ambiente:**
  - la gramola se oye más cerca de ella y baja mientras juegas;
  - las máquinas en demo hacen sonidos de vez en cuando;
  - hay un fluorescente viejo que parpadea, taburetes delante de las recreativas y reflejos de luz de colores en el suelo;
  - la máquina **STAR PATROL** está precintada y su pantalla no tiene señal.
- **Demo:** las máquinas que no se usan juegan solas y alternan con su TOP 10.

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
- Los barriles azules encienden el bidón y generan una llama.
- En cada nivel GROG lanza más rápido, los barriles ruedan más deprisa y bajan escaleras más a menudo, y hay más llamas.

**BRICK BLAST**
- Ladrillos de 10 a 70 puntos según la fila. Los plateados necesitan dos golpes y valen 50 por nivel.
- La bola sale con **Espacio** (o sola a los 2,5 s). Su ángulo depende de dónde golpea la pala, y acelera un poco con cada golpe.
- Cápsulas (10 % al romper un ladrillo): **W** pala ancha, **S** bola lenta, **L** vida extra. Cogerlas da 100.
- 3 vidas y una más a los 10 000. Cuatro diseños de nivel que se repiten, cada vez más rápidos.

**AIR HOCKEY**
- Mueves tu mazo en tu mitad de la mesa. La máquina defiende su portería y ataca cuando el disco entra en su campo.
- Gana quien llega a 7 goles. Puntos: 500 por gol y, si ganas, 3000 más 500 por cada gol de diferencia.

**SKEE-BALL**
- 9 bolas. Anillos de 50 (centro), 40, 30, 20 y 10 (fuera o si la bola no llega a la rampa), y dos agujeros de 100 en las esquinas de arriba.
- Cuanta más fuerza, más lejos cae la bola. Para el 100 hay que arrimarse a un lado y darle bastante. Cada bola tiene un pequeño efecto al azar.

**GRÚA DE PELUCHES**
- Una moneda da 15 s para colocar la pinza con las flechas. **Espacio** la deja caer antes.
- Agarra el peluche más cercano con más probabilidad cuanto más centrada esté, y a veces se escurre al subir. Los peluches ganados reaparecen al rato.

## Estructura

```
index.html                 overlays HTML (usuario, menús, récords, recepción, gramola, logros, HUD, táctil, pantalla grande)
vite.config.js             build de un solo archivo → dist/arcade.html
src/
  main.js                  arranque: WebGL, fuente, datos
  app/App.js               estados, bucle único y montaje del salón
  data/                    storage.js (esquema v4), users.js, scores.js, prizes.js, achievements.js
  core/                    input.js, audio.js (efectos, música y gramola), font.js, rng.js
  gfx/                     sprites.js, text.js
  world/                   Room.js, Cabinet.js + cabinetArt.js, Tables.js (hockey y skee), ClawMachine.js,
                           Reception.js (Mari y vitrina), Decor.js (gramola, refrescos, taburetes, luces),
                           prizeModels.js, CrtMaterial.js, Hands.js, FirstPerson.js
  arcade/                  ArcadeMachine.js, initials.js, ClawLogic.js
  games/                   maze/, climb/, brick/, hockey/, skee/ (lógica *Game.js + dibujo *Render.js)
  ui/                      panels.js, touch.js, dom.js
tests/unit/                Vitest
tests/e2e/                 Playwright sobre dist/arcade.html
```

**Decisiones técnicas**
- **Contrato de juego:** `new Game({ level, rng, sfx })`, `update(input)` a 60 Hz fijos y estado legible en `score`, `lives`, `level`, `state` y `gameOver`. La lógica no toca el DOM ni el canvas. La de la grúa (`ClawLogic.js`) tampoco depende del 3D. Todo se prueba con Vitest, sin navegador.
- **ArcadeMachine** gestiona igual las 5 máquinas de juego: demo, título, monedas, pausa, iniciales, resultado, tickets y logros. Cada una dibuja en su canvas (224×288 las recreativas, 224×400 la mesa de hockey, 224×560 la pista de skee), que se usa como textura 3D y como imagen de la pantalla grande.
- **Bucle único:** solo existe `renderer.setAnimationLoop`, con paso fijo de 1/60 s y un máximo de 5 pasos por fotograma. En pantalla grande no se dibuja el salón.
- **Movimiento:** colisión de círculo (0,28 m) contra cajas alineadas a los ejes, resuelta eje a eje para deslizar.
- **Rendimiento:** geometría procedural sencilla, sin sombras dinámicas y con `pixelRatio` limitado a 2. En calidad baja queda en 1 y hay menos luces.
- La única dependencia de ejecución es three.js. Todo lo demás (modelos, texturas, música y voces) se genera con código.

## Persistencia

Los datos se guardan en `localStorage`, con la clave `arcade.v1`, en el esquema 4:

```json
{
  "schemaVersion": 4,
  "activeUserId": "u_…",
  "users": [{ "id": "u_…", "name": "JAVI", "createdAt": "ISO",
              "records": { "maze": { "best": 0, "date": null, "level": 0 }, "climb": {…}, "brick": {…}, "skee": {…}, "hockey": {…} },
              "history": [{ "game": "maze", "score": 0, "level": 1, "date": "ISO" }],
              "coins": 3, "initials": "JAV", "tickets": 0, "prizes": ["duck", "plushCat"],
              "achievements": { "first": "ISO" } }],
  "hallOfFame": { "maze": [{ "initials": "SAL", "score": 10000, "level": 1, "date": null, "userId": null }, …], … },
  "settings": { "muted": false, "crt": true, "quality": "high", "mouseSens": 1, "jukebox": null }
}
```

- Los datos de versiones anteriores se migran solos al abrir, sin perder usuarios, récords ni historial:
  - **v2** añadió la calidad y la sensibilidad del ratón;
  - **v3**, las monedas, las iniciales y el TOP 10;
  - **v4**, los tres juegos nuevos, los tickets, los premios, los logros y la canción de la gramola.
- Al cargar se valida todo. Si algo está dañado, el original se copia en `arcade.backup` y se recupera lo válido.
- Si te levantas, pulsas REINICIAR o cambias de usuario a mitad de partida, esa partida no se guarda.
- Si `localStorage` no está disponible, se juega en **modo memoria** con un aviso.

## Limitaciones

- Los datos viven en el navegador y en el perfil donde juegas. Para conservarlos, usa **RÉCORDS → EXPORTAR / IMPORTAR**.
- Hace falta WebGL. Sin aceleración gráfica funciona, pero va lento; en ese caso conviene **CALIDAD: BAJA** o la pantalla grande (G).
- El navegador no deja volver a capturar el ratón sin un clic tras **Esc**.
- La pantalla completa la decide el navegador: si la bloquea, aparece un aviso.
- La fuente Press Start 2P dibuja las mayúsculas acentuadas más pequeñas, para que el acento quepa en la celda de 8×8.

## Diferencias con los clásicos

Los juegos reproducen las mecánicas del género, pero no copian el código, los mapas, los sprites ni la música originales.

**MAZE MUNCHER**
- Laberinto propio (28×31). Los enemigos deciden al llegar al centro de cada casilla y desempatan arriba, izquierda, abajo, derecha.
- Sin «Cruise Elroy», sin zonas prohibidas para girar y sin frenazo al comer puntos. Ciclos de modos simplificados.

**BARREL CLIMB**
- Un único tipo de fase, con vigas rectas inclinadas. Los barriles bajan escaleras con una probabilidad fija por nivel. El salto tiene un arco fijo y no se controla en el aire.

**BRICK BLAST, AIR HOCKEY, SKEE-BALL y la grúa**
- Son versiones propias y simplificadas: diseños de niveles, IA, física de mesa, anillos de la diana y probabilidades de la pinza ajustados para que se jueguen bien con teclado. No imitan ninguna máquina concreta.

## Licencias

- **Código, modelos 3D, texturas, sprites, mapas, niveles, música y efectos**: creación propia de este proyecto. No hay imágenes ni modelos externos.
- **three.js** (r170): licencia MIT.
- **Fuente**: Press Start 2P, © 2012 The Press Start 2P Project Authors, con licencia SIL Open Font License 1.1 (`fonts/OFL.txt`). Va incrustada sin modificar.

## Desarrollo

```bash
npm install
npx playwright install chromium
npm run dev          # servidor de desarrollo de Vite
npm run build        # genera dist/arcade.html (un único archivo)
npm run test:unit    # Vitest
npm run test:e2e     # build + Playwright sobre dist/arcade.html
npm test             # las dos baterías
```

- Las pruebas e2e abren `dist/arcade.html?test=1`. Eso activa `window.__arcadeTest` (avanzar pasos, teletransportar al jugador, consultar el estado, terminar una partida con una puntuación…) y hace que el tiempo solo avance con `step()`. Sin `?test=1`, los ganchos no existen.
- En WSL sin las dependencias de Chromium, falta `libasound.so.2`. Puedes instalarla con `sudo npx playwright install-deps chromium` o extraerla en `~/.cache/arcade-libs/root`, que la configuración de Playwright usa automáticamente.
- Detalle de las pruebas: [TESTS.md](TESTS.md).

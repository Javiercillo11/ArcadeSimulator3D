# Pruebas

## Última ejecución

| | |
|---|---|
| Fecha | 28/10/2026 |
| Comando | `npm test` (Playwright 1.64.1, Chromium headless shell 156, Node 24.22) |
| Entorno | WSL2 · Ubuntu 26.04 |
| Resultado | **59 de 59 pasan** (≈20 s, 4 workers) |
| Estabilidad | `--repeat-each=3`: 177 de 177 pasan, sin pruebas inestables |

Todas las pruebas fallan si aparece cualquier error de consola o una excepción de página (fixture automático `consoleErrors` en `tests/helpers.js`).

## Automatizadas

### Usuarios · `tests/users.spec.js`

| Prueba | Resultado |
|---|---|
| Se crea el primer usuario y se puede jugar al momento | ✅ |
| El usuario sigue ahí tras recargar | ✅ |
| Se crea y se selecciona un segundo usuario | ✅ |
| Se crean exactamente 5 usuarios y el sexto se bloquea con el aviso «LÍMITE DE 5 JUGADORES» (también en la capa de datos) | ✅ |
| Se rechaza un nombre vacío o de solo espacios | ✅ |
| Los nombres se recortan, pasan a mayúsculas y se limitan a 10 caracteres | ✅ |
| Un duplicado («javi» frente a «JAVI») no crea otro perfil y se ofrece seleccionar el existente | ✅ |
| Los récords son independientes por usuario y por juego | ✅ |
| Datos dañados: se recupera lo válido y el original queda en `arcade.backup` | ✅ |
| JSON ilegible: copia de seguridad y arranque limpio | ✅ |

### MAZE MUNCHER · `tests/maze.spec.js`

| Prueba | Resultado |
|---|---|
| El mapa tiene 240 puntos y 4 superpíldoras, y todo es alcanzable | ✅ |
| El jugador responde a las cuatro direcciones (y a WASD) | ✅ |
| No atraviesa paredes: desde cada casilla libre se empuja contra cada pared vecina durante 20 pasos (más de 300 combinaciones) | ✅ |
| Punto: +10 y desaparece. Superpíldora: +50 y activa el modo vulnerable en los 4 enemigos | ✅ |
| Los 4 enemigos cambian de posición y de modo (dispersión → persecución a los 7 s) y salen de casa | ✅ |
| Cada enemigo tiene un objetivo de persecución distinto | ✅ |
| La colisión con un enemigo normal quita una vida y reinicia las posiciones | ✅ |
| Comer enemigos encadenados da 200 / 400 / 800 / 1600 | ✅ |
| Los ojos de un enemigo comido vuelven a la casa y vuelve a salir | ✅ |
| La pausa congela el estado (120 pasos sin cambios) y al reanudar continúa igual | ✅ |
| Perder las 3 vidas lleva a GAME OVER y a la pantalla de fin de partida | ✅ |
| Al comer todos los puntos se pasa al nivel 2 | ✅ |
| La fruta aparece a los 70 puntos comidos y suma su valor | ✅ |
| El récord se guarda (con «¡NUEVO RÉCORD!») y se recupera tras recargar | ✅ |
| Velocidades, vulnerabilidad y ciclos cambian con el nivel | ✅ |

### BARREL CLIMB · `tests/climb.spec.js`

| Prueba | Resultado |
|---|---|
| El jugador camina sobre las vigas inclinadas sin atravesarlas (y = suelo en cada muestra) | ✅ |
| Sube y baja escaleras solo cuando está alineado; las escaleras rotas no se pueden subir | ✅ |
| El salto sigue un arco (12–20 px de altura, 30–45 pasos en el aire) y aterriza en la viga | ✅ |
| Los barriles ruedan, caen por las 6 vigas hasta el bidón y a veces bajan escaleras (con semilla fija) | ✅ |
| El contacto con un barril quita una vida | ✅ |
| El contacto con una llama quita una vida | ✅ |
| Una caída alta quita una vida | ✅ |
| Saltar un barril suma 100, saltando en cualquiera de los 9 pasos de la ventana de tiempo | ✅ |
| El martillo destruye barriles con 300, 500 u 800 puntos | ✅ |
| Con el martillo no se puede subir escaleras | ✅ |
| Al llegar a la cima se rescata a LUNA, se suma la bonificación y se pasa de nivel | ✅ |
| La bonificación decrece 100 cada 2 s | ✅ |
| GAME OVER y récord persistente tras recargar | ✅ |
| La dificultad sube por nivel | ✅ |

### Generales · `tests/general.spec.js`

| Prueba | Resultado |
|---|---|
| Menú → juego → menú → otro juego sin bucles duplicados (`activeLoops` = 1, `maxPending` = 1) | ✅ |
| 20 reinicios seguidos dejan un único bucle activo (y unos 30 pasos en 500 ms reales, no el doble) | ✅ |
| La velocidad del juego es igual a 60, 144 y 30 Hz; al volver de segundo plano no se recupera el tiempo perdido | ✅ |
| 0 errores en consola en todo el recorrido, en tiempo real y sin ganchos | ✅ |
| Las flechas y el espacio no desplazan la página; todo funciona con teclado | ✅ |
| Resolución 360×640: sin scroll horizontal y pantalla completa visible | ✅ |
| Resolución 768×1024 | ✅ |
| Resolución 1366×768 | ✅ |
| Resolución 1920×1080 | ✅ |
| Persistencia tras cerrar y volver a abrir el navegador (`launchPersistentContext`) | ✅ |
| Una partida con puntuación inferior al récord no lo modifica (pero sí queda en el historial) | ✅ |
| El historial se limita a las últimas 20 partidas por juego | ✅ |
| Silencio y CRT se recuerdan tras recargar | ✅ |
| Sin `localStorage`, se juega en modo memoria con aviso | ✅ |
| La versión empaquetada (un único HTML) arranca y se puede jugar | ✅ |
| Controles táctiles en móvil emulado: cruceta, botón A, START y pausa | ✅ |

### Rendimiento y robustez · `tests/perf.spec.js`

| Prueba | Resultado medido |
|---|---|
| MAZE: coste por fotograma (update + render) | ✅ ≈0,22–0,35 ms (presupuesto: 16,7 ms) |
| CLIMB: coste por fotograma | ✅ ≈0,17–0,22 ms |
| MAZE: memoria retenida tras 40 s más de partida con el JIT caliente | ✅ sin crecimiento (−4 a +7 KB) |
| CLIMB: memoria retenida | ✅ sin crecimiento (≈0 KB) |
| Asignación transitoria por fotograma (números temporales de V8) | ✅ 430–750 B (límite de la prueba: 1 KB) |
| MAZE: 20 000 pasos con entradas aleatorias, nunca dentro de una pared | ✅ |
| CLIMB: 20 000 pasos con entradas aleatorias, siempre sobre la viga al caminar | ✅ |

## Revisión visual

Capturas generadas por las pruebas en `test-results/screens/` (se regeneran en cada ejecución) y revisadas a mano:

- **360×640** (escala 1,44): todo cabe, sin scroll horizontal; los mandos táctiles se agrandan en móvil emulado.
- Con el mueble turquesa actual: **768×1024** (×1,97), **1366×768** (×1,35), **1920×1080** (×2); el panel de mandos y la marquesina, más altos para parecerse a la referencia, dejan menos hueco al monitor que antes.
- Revisadas: selección de jugador, menú, títulos de los dos juegos, partida, modo vulnerable, pausa, rescate, transición de fase, fin de partida con nuevo récord, récords y controles.
- Corregido durante la revisión: el emoji del altavoz salía como un cuadrado sin fuente de emojis (ahora es un SVG); el aviso vacío asomaba bajo el panel; «¡AYUDA!» se solapaba con la caja de BONO; en 1920×1080 la escala se quedaba en ×2 por 6 px.
- Rediseño «burbujas» (fondo celeste, mueble azul con laterales menta, marco naranja, joystick): la prueba táctil detectó que el lateral menta tapaba el botón rojo en móvil y el título de la marquesina desbordaba a 360 px; ambos corregidos.
- Réplica de la máquina turquesa de referencia (marquesina con espuma y dinosaurios originales, laterales menta, columnas de burbujas, tornillos, bisel azul y marco naranja de varias capas, joystick, botón rojo apilado, botones amarillos, START, INSERT COIN): comparada con la imagen a 1384×746, 1920×1080, 768×1024 y 390×844. Corregido durante la comparación: el título rosa salía tapado por su propio contorno, el marco de la marquesina tapaba la barra de jugador, el palo del joystick atravesaba la base e INSERT COIN quedaba cortado.
- Pase de volumen con CSS 3D (cubierta en perspectiva, paredes interiores, monitor hundido, sombras proyectadas, botones con lateral y sombra de contacto): revisado a 1384×746, 1920×1080 y 390×844. Corregido: la sombra interior del cristal oscurecía el marcador de los juegos, y el joystick empujaba INSERT COIN fuera de la pantalla.
- Mueble imagen (`assets/cabinet.png`) en pantallas apaisadas: revisado a 1194×642, 1366×768 y 1920×1080 con selección de jugador, menú, partida, pausa y récords. El botón rojo dibujado responde al ratón (hace saltar al personaje). Coste: el juego vertical va centrado en la pantalla apaisada de la ilustración, con escala ×1,16 a 1366×768 y ×1,64 a 1920×1080.
- Limitación conocida: Press Start 2P dibuja las mayúsculas acentuadas más pequeñas (se leen como «RéCORD»). Es el diseño de la fuente a 8×8.

## Manuales (pendientes de hacer con una persona)

No se pueden comprobar de forma automática. Quedan para probarlos jugando:

| Prueba | Estado | Qué mirar |
|---|---|---|
| Sensación de control y dificultad | Pendiente | Giro anticipado del laberinto, timing del salto, ritmo de barriles en los niveles 1–4 |
| Sincronía del audio | Pendiente | Chomp, efectos y música de título. Chromium headless corre silenciado (`--mute-audio`), así que solo se comprobó que el audio no da errores |
| Legibilidad con CRT | Revisado en capturas; pendiente en monitor real | Scanlines y viñeta a escala ×2 y ×3 |
| Controles táctiles en móvil real | Probado solo con emulación | Tamaño de la cruceta, pulsación mantenida, que no haga zoom ni scroll |

## Cómo ejecutar

```bash
npm install
npx playwright install chromium
npm test
npx playwright test tests/maze.spec.js     # un solo archivo
npx playwright test --repeat-each=3        # detectar pruebas inestables
```

En WSL sin `libasound.so.2`, consulta la nota en el [README](README.md#desarrollo).

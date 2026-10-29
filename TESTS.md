# Pruebas

Dos baterías:

- **Vitest** (`tests/unit/`): la lógica de datos y de los dos juegos, sin navegador. Los juegos siguen el contrato v2 (sin DOM ni canvas), así que se instancian directamente con una semilla fija y una entrada simulada.
- **Playwright** (`tests/e2e/`): el **HTML final** (`dist/arcade.html`) en Chromium real, abierto por `file://`. Todas las pruebas fallan si aparece un error en consola o una excepción de página. Solo se ignoran los avisos de rendimiento del driver gráfico por software (`GL Driver Message … GPU stall due to ReadPixels`), que no proceden de la aplicación.

`npm test` ejecuta las dos baterías; `test:e2e` hace antes el build.

## Resultado de la última ejecución

Ejecutado el 29/10/2026 con `npm test`, en Linux (WSL2), Node 24.22.1, Vitest 2.1.8, Playwright 1.64.1 y Chromium sin ventana, con WebGL por software (SwiftShader).

| Batería | Pruebas | Resultado | Tiempo |
|---|---|---|---|
| Vitest | 114 | 114 en verde | 0,4 s |
| Playwright | 42 | 42 en verde | 2,3 min (tres ejecuciones seguidas en verde: 1,7, 2,4 y 2,3 min) |

Build: `dist/arcade.html` de 897 KB (263 KB comprimido con gzip). Sin recursos externos: se ha comprobado que no queda ningún `src` ni `href` que no sea `data:`.

## Vitest

### Datos (`data.test.js`, 32 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Crear el primer usuario | Se normaliza a mayúsculas y queda activo |
| Recarga | El usuario y el activo sobreviven a `load()` |
| 5 usuarios | El sexto devuelve `LIMIT` y no se crea |
| Vacíos | `''` y `'    '` devuelven `EMPTY` |
| Normalización | Recorta, pasa a mayúsculas, máximo 10 caracteres, caracteres no permitidos → `INVALID`, admite Ñ y acentos |
| Duplicados | `javi` frente a `JAVI` → `DUPLICATE` con el usuario existente |
| Borrar | Borra al usuario y deja de haber uno activo |
| Récords aislados | Independientes por usuario y por juego; récord global |
| Puntuación inferior | No modifica el récord |
| Historial | Solo las últimas 20 partidas por juego |
| Tabla y avisos | Orden de mayor a menor; los oyentes reciben el cambio |
| Persistencia de récords | Sobreviven a recargar |
| Migración v1 → v3 | Conserva usuarios, récords y ajustes, añade `quality` y `mouseSens`, da 3 monedas e iniciales, coloca el récord en el TOP 10, no crea copia de seguridad y guarda la versión 3 |
| Migración v2 → v3 | No toca los ajustes existentes |
| Monedas | Se empieza con 3, cada partida gasta 1 y sin monedas no se gasta nada |
| Máquina de cambio | No pasa de 30, las monedas son de cada jugador y se guardan |
| Monedas dañadas | Fuera de rango vuelven a 3; iniciales inválidas vuelven a las del nombre |
| TOP 10 de fábrica | 10 entradas del salón, ordenadas, la última de 500 |
| Entrar en el TOP 10 | Solo quien supera al décimo; con empate no desplaza |
| Insertar | Va a su puesto, echa al último, avisa al tablero y persiste |
| Iniciales por defecto | Sacadas del nombre, sin acentos y rellenas con espacios; solo se aceptan válidas |
| Tabla dañada | Se descartan entradas inválidas y se reordena |
| Migración v3 → v4 | Añade los récords y el TOP 10 de los tres juegos nuevos, los tickets, los premios y los logros, sin tocar monedas ni iniciales |
| Tickets y premios | Se suman tickets; canjear resta el coste y añade a la vitrina; sin tickets suficientes no se canjea; los peluches se añaden gratis; persiste |
| Logros | Se desbloquean una vez, avisan y persisten; un logro desconocido no hace nada |
| Datos v4 dañados | Tickets negativos, premios o logros inválidos se reparan |
| Datos dañados | Duplicados, ids inválidos, récords negativos y juegos desconocidos se descartan o reparan; se guarda copia en `arcade.backup` |
| JSON ilegible | Copia de seguridad y arranque limpio |
| Versión desconocida | Se trata como dañada |
| Ajustes fuera de rango | Vuelven al valor por defecto |
| Sin localStorage | Modo memoria: se puede crear usuario y `save()` devuelve `false` |
| Importar | JSON válido sí; texto no válido no |

### MAZE MUNCHER (`maze.test.js`, 21 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Mapa | 28×31, 240 puntos, 4 superpíldoras, todo alcanzable desde la salida |
| Contrato | `score`, `lives`, `level`, `state` y `gameOver`; el nivel inicial se puede elegir; arranca en READY y pasa a PLAYING sola |
| Determinismo | Misma semilla y misma entrada dan el mismo estado tras 800 pasos |
| Cuatro direcciones | El jugador responde a arriba, abajo, izquierda y derecha |
| Paredes | Barrido de todas las casillas junto a pared (más de 300 casos): nunca entra en una pared |
| Giro guardado | El giro pedido se hace en el primer cruce posible |
| Punto y superpíldora | +10 y +50, la casilla queda vacía, modo vulnerable en los 4 enemigos y sonidos `chomp`/`power` |
| Enemigos y modos | Salen de casa, se mueven y pasan de dispersión a persecución a los 7 s |
| Objetivos | Persecución distinta por enemigo; el tímido se retira cuando está cerca; en dispersión cada uno va a su esquina |
| Colisión | Quita una vida y reinicia las posiciones |
| Cadena | 200 / 400 / 800 / 1600, y se reinicia con cada superpíldora |
| Ojos | Vuelven a casa y el enemigo sale de nuevo |
| Fin del modo vulnerable | Termina a los 6 s del nivel 1 |
| GAME_OVER | Tras perder 3 vidas; `gameOver` pasa a ser `true` al acabar la animación |
| Nivel superado | Al comer el último punto se pasa al nivel 2 con 244 puntos |
| Fruta | Aparece a los 70 y a los 170 puntos, y vale 100 en el nivel 1 |
| Vida extra | A los 10 000 puntos, una sola vez |
| Dificultad | Velocidades, vulnerabilidad y ciclos cambian con el nivel |

### Iniciales (`initials.test.js`, 6 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Inicio | Parte de las iniciales propuestas, normalizadas |
| Letra | Arriba y abajo cambian la letra dando la vuelta al alfabeto |
| Repetición | Mantener arriba repite tras una pausa |
| Cursor | Izquierda y derecha mueven el cursor sin salirse |
| Confirmar | SALTAR o START confirman cada letra; la tercera termina |
| Tiempo | A los 30 s se acepta lo que haya |

### BRICK BLAST (`brick.test.js`, 11 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Contrato | Estado legible; READY con la bola en la pala y 78 ladrillos |
| Pala | Se mueve sin salirse y lleva la bola pegada |
| Lanzamiento | ESPACIO la lanza hacia arriba; si no, sale sola a los 150 pasos |
| Rebotes | Paredes, techo y ángulo de la pala según el punto de impacto |
| Ladrillos | Puntos de su fila; los plateados necesitan dos golpes |
| Vidas | Perder la bola quita una vida y vuelve a sacar; sin vidas, GAME_OVER |
| Niveles | Sin ladrillos se supera el nivel; el siguiente tiene otro diseño y va más rápido |
| Cápsulas | W ensancha la pala y L da una vida (+100 cada una) |
| Determinismo | Misma semilla y misma entrada dan la misma partida |

### AIR HOCKEY (`hockey.test.js`, 11 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Contrato | Estado legible; READY con el disco en el campo del jugador |
| Mazo | Se mueve con las flechas sin pasar del centro ni de las bandas |
| Física | Rebotes en las bandas con rozamiento; el golpe del mazo lanza el disco |
| Goles | Portería de arriba: +500 y saca la máquina; fuera de la boca rebota en el fondo |
| IA | Defiende siguiendo al disco y ataca cuando está en su campo |
| Final | A 7 goles: victoria = 3000 + 500 por gol de diferencia; derrota = solo 500 por gol |
| Determinismo | Misma semilla y misma entrada dan la misma partida |

### SKEE-BALL (`skee.test.js`, 8 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Hoyos | 50 en el centro, 40/30/20 en los anillos, 10 fuera y 100 en las esquinas |
| Puntería y fuerza | ←/→ dentro de la pista; la barra sube y baja mientras se mantiene ESPACIO y al soltar se lanza |
| Tiros | Sin fuerza: 10; fuerza justa al centro: 50; más fuerza, más lejos; arrimada a un lado: 100 |
| Partida | Tras 9 bolas termina con la suma de los hoyos |

### Grúa (`claw.test.js`, 5 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Moneda | Sin moneda no se mueve; con moneda hay 15 s para moverla y luego baja sola |
| Premio | Sobre un peluche lo agarra, lo lleva a la boca y lo da como premio |
| Fallos | Lejos de cualquier peluche sube vacía; a veces se escurre; un peluche ya ganado no se repite |

### BARREL CLIMB (`climb.test.js`, 20 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Contrato | Estado legible y nivel inicial; arranca en READY |
| Determinismo | Misma semilla y misma entrada, con barriles reales, dan el mismo estado |
| Vigas | Camina pegado a la superficie inclinada (error < 0,001 px) a 0,75 px por paso |
| Escaleras | Sube y baja solo alineado; las escaleras rotas no se usan |
| Salto | Arco de entre 12 y 20 px, entre 30 y 45 pasos en el aire, aterriza en la viga |
| Caída alta | Quita una vida (`fall`) |
| Martillo | Con martillo no se suben escaleras |
| Tecla mantenida | Si sigue pulsada al perder una vida, no cuenta hasta soltarla (equivale al `input.clear()` de la versión anterior) |
| Barriles | Ruedan, bajan por las 6 vigas y desaparecen; con una semilla dada, unos bajan escaleras y otros no |
| Lanzamiento | El robot lanza barriles solo |
| Contacto | Un barril o una llama quitan una vida (`hit`) |
| Saltar un barril | +100 saltando en cualquiera de los 9 pasos de la ventana |
| Martillazo | 300, 500 u 800 |
| Vida extra | A los 7000 puntos |
| Rescate | Suma el bonus, pasa al nivel 2 con el bonus de ese nivel y el jugador vuelve abajo |
| Bonus | Baja 100 cada 2 s; si llega a 0 se pierde una vida (`time`) |
| GAME_OVER | Tras perder 3 vidas |
| Dificultad | Intervalo, velocidad, llamas y probabilidad de escalera suben con el nivel; el bonus tope es 8000 |

## Playwright (sobre `dist/arcade.html`)

### Flujo (`flow.spec.js`, 7 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Arranque | Pantalla **¿QUÉ USUARIO VA A JUGAR?**, ENTRAR desactivado, la cámara gira por la sala y no se ven las manos |
| Flujo completo | Crear usuario → entrar (manos visibles y nombre en el HUD) → **caminar con W** hasta la máquina → aviso **[E] JUGAR A MAZE MUNCHER** → E (estado SITTING a mitad de transición, CABINET al final) → Enter → partida → récord de 2500 → Q → sala con la máquina en demo → récord en el menú → recargar y comprobar que persiste |
| Sin récord | Una partida peor no cambia el récord, muestra FIN DE PARTIDA y vuelve sola al título |
| Pausa en la máquina | ESC congela el juego 120 pasos; Continuar lo reanuda; Reiniciar empieza de cero; Levantarse vuelve a la sala |
| Zoom | F acerca la cámara más de 20 cm y otra F la devuelve |
| Demo | Las máquinas inactivas tienen la pantalla encendida y cambian con el tiempo |
| Cambiar usuario | Desde el menú; los récords de cada uno quedan aislados |

### Sala (`room.spec.js`, 10 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Colisiones | Andar 5 s hacia cada recreativa se para en su taburete o en ella, nunca dentro; correr 8 s contra las paredes no las atraviesa |
| Deslizar | En diagonal contra la mesa de hockey, el jugador se desliza a lo largo de ella |
| Aviso de E | Solo aparece cerca, de frente y mirando a la máquina; E sin aviso no hace nada |
| Bucle único | Tras 10 ciclos de sentarse, jugar y levantarse, `loopStarts` es 1; en 2 s de tiempo real hay un fotograma de la app por cada fotograma del navegador (proporción entre 0,8 y 1,25) y nunca más de 66 pasos por segundo |
| Menú | ESC lo abre; las flechas mueven el foco; Controles, Récords y Volver; con el menú abierto no se anda |
| Ajustes | Sonido, CRT, calidad y sensibilidad se recuerdan tras recargar; M alterna el silencio |
| Vista | El ratón gira la vista y el cabeceo se limita a ±1,35 rad |
| Tablero | El tablero de la pared muestra el TOP de fábrica y se actualiza al entrar en él |
| Migración | Datos de la v1 se migran a la v4 sin perder el récord, con monedas, iniciales y su puesto en el TOP 10 |
| Modo memoria | Sin localStorage aparece el aviso y se juega en memoria |

### Plataforma (`platform.spec.js`, 7 pruebas)

| Prueba | Qué comprueba |
|---|---|
| 1366×768, 1920×1080, 1024×768 y 800×600 | Sin scroll; canvas a pantalla completa; paneles de usuario y de pausa dentro de la ventana |
| Móvil táctil 390×844 | Controles táctiles visibles y sin aviso de ratón; la palanca virtual hace andar; el botón E sienta al jugador; cruceta, START (empieza), A (salta) y SALIR (vuelve a la sala); sin scroll horizontal |
| Sin WebGL | Con `--disable-webgl --disable-3d-apis` aparece el mensaje **SIN 3D** y ningún error |
| Persistencia real | Cerrar el navegador con un perfil persistente y volver a abrirlo: el récord sigue en la lista y en el tablero |

### Juegos nuevos y salón (`extras.spec.js`, 12 pruebas)

| Prueba | Qué comprueba |
|---|---|
| BRICK BLAST | Se lanza la bola con ESPACIO; al terminar, récord y 3 tickets en el HUD |
| AIR HOCKEY | El mazo sube con ↑; ganar 7-2 da 17 tickets y los logros *first* y *hockeyWin* |
| SKEE-BALL | Mantener y soltar ESPACIO lanza una bola real que puntúa; pasa a la siguiente; 330 puntos dan 33 tickets |
| Demos | BRICK, HOCKEY y SKEE muestran su demo |
| Grúa | Cuesta una moneda, la pinza se mueve con →, el peluche ganado va a la vitrina y da el logro |
| Recepción y premios | Con 100 tickets se canjean el patito y el fantasma, se desactivan los que no alcanzan, Mari lo comenta, la vitrina los muestra y persisten |
| Gramola | Elegir, apagar y volver a elegir canción; se recuerda al recargar y da el logro |
| Refrescos | Cuesta una moneda, la lata aparece en la mano unos segundos; sin monedas se avisa |
| Máquina averiada | Aviso «FUERA DE SERVICIO» y E no hace nada |
| Pantalla grande | G muestra el canvas a toda la ventana mientras se sigue jugando; G o Q vuelven; también desde la pausa |
| Pantalla completa | El botón del menú la activa o avisa si el navegador no lo permite, sin errores |
| Logros | El panel muestra los conseguidos (*first*, *champion*) y los pendientes, «X DE 14» |

### Monedas e iniciales (`coins.spec.js`, 5 pruebas)

| Prueba | Qué comprueba |
|---|---|
| Coste | 3 partidas con 3 monedas; sin monedas ENTER no empieza, el HUD se pone en rojo y REINICIAR se desactiva |
| Recepción | Aviso «HABLAR CON MARI»; Mari saluda por el nombre y da +5 con 5 monedas en el mostrador; tope de 30; el mostrador no se atraviesa; persiste al recargar |
| Iniciales con teclado | ↑ → ↓ Espacio ↑ Enter dan «K W» en el puesto 3; aparecen en el TOP 10 y en el tablero, y se proponen en la siguiente partida |
| Fuera del TOP 10 | 300 puntos dan récord personal sin pedir iniciales |
| Levantarse | Con Q durante las iniciales, se guardan las que hubiera |

### Tiempo real (`realtime.spec.js`, 1 prueba, proyecto aparte)

Sin ganchos de prueba (`window.__arcadeTest` no existe) y con el bucle en tiempo real. Al entrar se captura el ratón y se anda con W. **ESC** hace que el navegador suelte el ratón y se abre el menú. **CONTINUAR** vuelve a la sala y recaptura el ratón.

Esta prueba va en un proyecto de Playwright que se ejecuta después de los demás y en solitario. Con otras pruebas en paralelo compitiendo por la CPU, el 3D por software ralentiza tanto Chromium que tarda más de 90 s en devolver la pulsación de ESC que suelta el ratón. En solitario tarda unos 2 s. El comportamiento de la aplicación es el mismo en los dos casos.

## Qué no se prueba automáticamente

- **Aspecto visual** (manos, palanca, CRT, iluminación): se ha revisado a ojo con capturas durante el desarrollo, no hay comparación de imágenes.
- **Sonido**: se comprueba que los juegos piden los efectos correctos (`sfx`), pero no lo que suena.
- **Rendimiento con GPU real**: las pruebas usan WebGL por software. La escena usa unas 70 llamadas de dibujo y 7000 triángulos.
- **Otros navegadores**: solo Chromium.

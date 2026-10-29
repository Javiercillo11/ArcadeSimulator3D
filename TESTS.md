# Pruebas

Dos baterías:

- **Vitest** (`tests/unit/`): la lógica de datos y de los dos juegos, sin navegador. Los juegos siguen el contrato v2 (sin DOM ni canvas), así que se instancian directamente con una semilla fija y una entrada simulada.
- **Playwright** (`tests/e2e/`): el **HTML final** (`dist/arcade.html`) en Chromium real, abierto por `file://`. Todas las pruebas fallan si aparece un error en consola o una excepción de página. Solo se ignoran los avisos de rendimiento del driver gráfico por software (`GL Driver Message … GPU stall due to ReadPixels`), que no proceden de la aplicación.

`npm test` ejecuta las dos baterías; `test:e2e` hace antes el build.

## Resultado de la última ejecución

Ejecutado el 29/10/2026 con `npm test`, en Linux (WSL2), Node 24.22.1, Vitest 2.1.8, Playwright 1.64.1 y Chromium sin ventana, con WebGL por software (SwiftShader).

| Batería | Pruebas | Resultado | Tiempo |
|---|---|---|---|
| Vitest | 60 | 60 en verde | 0,37 s |
| Playwright | 25 | 25 en verde | 39,1 s |

Build: `dist/arcade.html` de 777 KB (226 KB comprimido con gzip). Sin recursos externos: se ha comprobado que no queda ningún `src` ni `href` que no sea `data:`.

## Vitest

### Datos (`data.test.js`, 19 pruebas)

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
| Migración v1 → v2 | Conserva usuarios, récords y ajustes, añade `quality` y `mouseSens`, no crea copia de seguridad y guarda la versión 2 |
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
| Colisiones | Andar 5 s contra cada máquina la deja a la distancia del radio; correr 6 s contra las paredes (y contra el banco) no las atraviesa |
| Deslizar | En diagonal contra una máquina, el jugador se desliza a lo largo de ella |
| Aviso de E | Solo aparece cerca, de frente y mirando a la máquina; E sin aviso no hace nada |
| Bucle único | Tras 10 ciclos de sentarse, jugar y levantarse, `loopStarts` es 1; en 2 s de tiempo real hay un fotograma de la app por cada fotograma del navegador (proporción entre 0,8 y 1,25) y nunca más de 66 pasos por segundo |
| Menú | ESC lo abre; las flechas mueven el foco; Controles, Récords y Volver; con el menú abierto no se anda |
| Ajustes | Sonido, CRT, calidad y sensibilidad se recuerdan tras recargar; M alterna el silencio |
| Vista | El ratón gira la vista y el cabeceo se limita a ±1,35 rad |
| Tablero | El tablero de la pared se actualiza al batir un récord |
| Migración | Datos de la versión anterior (schemaVersion 1) se migran sin perder el récord |
| Modo memoria | Sin localStorage aparece el aviso y se juega en memoria |

### Plataforma (`platform.spec.js`, 7 pruebas)

| Prueba | Qué comprueba |
|---|---|
| 1366×768, 1920×1080, 1024×768 y 800×600 | Sin scroll; canvas a pantalla completa; paneles de usuario y de pausa dentro de la ventana |
| Móvil táctil 390×844 | Controles táctiles visibles y sin aviso de ratón; la palanca virtual hace andar; el botón E sienta al jugador; cruceta, START (empieza), A (salta) y SALIR (vuelve a la sala); sin scroll horizontal |
| Sin WebGL | Con `--disable-webgl --disable-3d-apis` aparece el mensaje **SIN 3D** y ningún error |
| Persistencia real | Cerrar el navegador con un perfil persistente y volver a abrirlo: el récord sigue en la lista y en el tablero |

### Tiempo real (`realtime.spec.js`, 1 prueba, proyecto aparte)

Sin ganchos de prueba (`window.__arcadeTest` no existe) y con el bucle en tiempo real. Al entrar se captura el ratón y se anda con W. **ESC** hace que el navegador suelte el ratón y se abre el menú. **CONTINUAR** vuelve a la sala y recaptura el ratón.

Esta prueba va en un proyecto de Playwright que se ejecuta después de los demás y en solitario. Con otras pruebas en paralelo compitiendo por la CPU, el 3D por software ralentiza tanto Chromium que tarda más de 90 s en devolver la pulsación de ESC que suelta el ratón. En solitario tarda unos 2 s. El comportamiento de la aplicación es el mismo en los dos casos.

## Qué no se prueba automáticamente

- **Aspecto visual** (manos, palanca, CRT, iluminación): se ha revisado a ojo con capturas durante el desarrollo, no hay comparación de imágenes.
- **Sonido**: se comprueba que los juegos piden los efectos correctos (`sfx`), pero no lo que suena.
- **Rendimiento con GPU real**: las pruebas usan WebGL por software. La escena usa unas 70 llamadas de dibujo y 7000 triángulos.
- **Otros navegadores**: solo Chromium.

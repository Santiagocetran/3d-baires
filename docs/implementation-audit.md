# Auditoría final de implementación · Astra · 2026-10-15

Revisión independiente de `gpt-6-astra` (high), de lectura sobre código y diff. No ejecutó pruebas. Dictamen: aceptable tras corregir los hallazgos y repetir las verificaciones afectadas; no encontró otros defectos de severidad alta.

| Hallazgo | Corrección |
|---|---|
| La prueba de inclinación/resize podía aprobar con el detalle de una selección previa | Cerrar y comprobar ausencia de selección antes de cada intento; esperar nuevamente el ID conocido, en DPR 1 y 2 |
| Un error de carga detenía también el dibujo de las mallas válidas | Separar fallo terminal del cargador de fallo fatal del renderizador; conservar dibujo durante navegación sin cambiar fase error |
| La animación podía quedar congelada al fallar una descarga | Permitir repintados hasta el límite temporal existente; sin bucle permanente ni nueva carga |
| Faltaba evidencia de errores de atributos aislados | Prueba específica: error en atributos, ciudad ready, navegación y selección en otro bloque |

La revisión confirmó razonablemente transporte gzip, validación CBA1 e identidad worker, finalización exacta, selección asíncrona, cámara/URL, checkpoints y recuperación por renombres. Worker MapLibre explícitamente empaquetado y atribución MIT presentes.

Las correcciones de código están aplicadas. La evidencia ejecutada y sus límites se registran en `resident-validation-notes.md` y `browser-*.json`; el dictamen de lectura no sustituye esas pruebas. La inyección de fallo de compilación de shader permanece fuera de la cobertura ejecutada; hay manejo terminal en código. No se acreditan FPS o memoria GPU de hardware a partir de SwiftShader.

## Hallazgo durante las pruebas posteriores

La prueba de `messageerror` detectó que asignar `worker.onmessageerror` no registraba el manejador en Chromium disponible. Se corrigió con `addEventListener('messageerror', ...)` y se repite la prueba negativa correspondiente. Este fallo lo detectó la ejecución de navegador, no la auditoría de lectura. El tipo de evento se inyecta mediante el harness; la pérdida WebGL se provoca con `WEBGL_lose_context` real.


La prueba real de pérdida de contexto encontró además una interacción con MapLibre 6: su listener de burbujeo destruye la capa antes de que llegue el listener original. Se pasó el listener propio a fase de captura y se conserva la fase/causa error durante `onRemove`; una eliminación normal sigue pasando a disposed. Se comprobó el comportamiento con `WEBGL_lose_context`, sin simular éxito mediante un simple mensaje de interfaz.

## Cierre

Astra releyó las correcciones y los informes: «no quedan correcciones obligatorias de código identificadas». Después de esa relectura, el preview final aprobado verificó la ciudad completa y el encuadre de los límites oficiales. No hubo nuevos cambios de producto; se corrigió únicamente la aserción de zoom del test de vista general usando su extensión espacial real. Ver `resident-validation-notes.md`.

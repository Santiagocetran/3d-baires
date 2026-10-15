# Plan de implementación · 2026-10-15

Estado: completado el 2026-10-15. Plan y código auditados por Astra; correcciones aplicadas y preview final aprobado. Evidencia en `resident-validation-notes.md`.

## Diagnóstico y comparación

- Git inicializado sin commits: todo el proyecto es todavía un conjunto de archivos sin seguimiento. Hay identidad Git local configurada; sin remotos. Guardar un punto de partida y luego un commit revisado.
- Tejido auditado: 1.386.616 volúmenes (no edificios únicos), 601 bloques, 13 paquetes; 60.922.260 bytes comprimidos de geometría. Mallas: 24.436.400 triángulos y 431.099.114 bytes de buffers/texturas contabilizados. No equivale a memoria GPU medida ni garantiza fluidez.
- Arquitectura residente ya adaptada de Amsterdam, MIT. `src/resident-city.ts` conserva mallas y usa workers, texturas, animación y picking GPU. La integración MapLibre preserva basemap y navegación; no hace falta reemplazarla por otro motor.
- Fallo pendiente de transporte: `unzip()` descomprime siempre aunque el servidor declare Content-Encoding y Fetch ya entregue contenido descomprimido. Confirmar con servidor real, no sólo mocks. Manejar gzip como archivo y compresión HTTP de forma diferenciada, validar la carga útil y rechazar HTML/ficheros truncados.
- `scripts/browser-city.mjs` infiere éxito porque desaparece un texto de progreso, también cuando aparece un error. El JSON previo (967 ms, 1 paquete) es un falso positivo y debe invalidarse explícitamente.
- Falta validación exhaustiva de índices internos CBA1 antes de reservar memoria/triangular; errores de workers pueden detener una cola sin un estado terminal inequívoco.
- Reanudación Python verifica el NDJSON pero no integridad/configuración de cada bloque cacheado; publicación elimina la versión anterior antes de promover la nueva.
- Interfaz útil pero sin vista general, estado de cámara compartible ni panel móvil plegable. Errores de selección se confunden con fallos completos del mapa.

Referencia principal: [Amsterdam](https://github.com/alexbarakov/amsterdam-by-building), código local en `/tmp/3d-baires-amsterdam`; commit base adaptado `d5eb5a89fabd1cc04473bddbc721b1e5f2b42bcb`, revisar cambios remotos antes de cerrar el informe. `web/app.js`: mallas permanentes, atributos en texturas, picking 1 píxel, animación GLSL, panel móvil plegable. `web/worker.js`: triangulación en worker. `pipeline/s03_tiles.py`: bloques 600 m, simplificación 0,25 m, paquetes. No importar sus estimaciones de años ni alturas de respaldo.

[SimCABA](https://caba.nicolaspoore.com/) sirve como referencia de exploración, barrios y descubrimientos. Su experiencia ilustrada no proporciona geometría/altura/edad verificable para este producto. No reutilizar sus imágenes ni añadir juegos/historias en esta iteración. La página Amsterdam falló en la herramienta web; el repositorio es accesible y constituye la evidencia técnica.

## Alcance y orden

### P0 · Carga correcta y evidencia fiable

1. Invalidar el informe de navegador falso positivo; preservar la explicación del fallo.
2. Transporte reutilizable: detectar bytes gzip frente a bytes ya decodificados, validar formato esperado, HTTP/mime cuando sea útil, errores en español con recurso, aborto y reintentos transitorios limitados. Evitar doble descompresión y fallos silenciosos.
3. Validar configuración CBA1, tamaños, rangos, monotonía de índices, coordenadas finitas, alturas y límites de identificación. Un archivo corrupto falla antes de asignaciones grandes; desconocidos usan únicamente el sentinel documentado.
4. Estado explícito del cargador: `loading`, `ready`, `error`, `disposed`. Ready sólo con todos los bloques y volúmenes esperados. Fallos terminales cancelan trabajo pendiente; no informar éxito parcial. Conservar mallas ya cargadas; recarga explícita para reintentar tras fallo terminal. Limpieza segura al desmontar.
5. Errores de atributos no borran la ciudad ni declaran fallo de toda la geometría. Feedback de selección pendiente/error; evitar resultados de selecciones antiguas.

### P1 · Continuidad y herramientas de exploración

6. Diagnósticos de lectura: bloques/volúmenes/paquetes recibidos, bytes de buffers estimados, fase y error. Separar medición de estimación. La UI muestra progreso y finalización; las pruebas consumen estado estructurado, no ausencia de texto. No habilitar nueva descarga/evicción de mallas por viewport.
7. Vista general CABA, URL de cámara (centro/zoom/inclinación/rumbo/capa) validada y acotada, copiar enlace con feedback y alternativa cuando Clipboard no esté disponible. Restaurar una URL válida; ignorar parámetros inválidos sin bloquear el mapa.
8. Panel móvil plegable accesible (botón y aria-expanded); mantener atribución, controles y leyenda accesibles. Respetar movimiento reducido en entrada y desplazamientos de cámara.

### P1 · Reproducibilidad y cierre

9. Checkpoints con versión/configuración y checksum de bloques; nunca reutilizar cache corrupta/configuración incompatible. Publicación preparada antes de sustituir el directorio activo, con recuperación de la versión anterior si falla la promoción. Tests sobre fixtures pequeños; no repetir auditoría cruda ni adquisición sin motivo.
10. Automatización real: servidor Vite y preview, transporte de archivos gzip real, ruta feliz y negativa (HTTP, HTML, corrupción, aborto, workers). Prueba de 800 volúmenes reales para shaders/picking/móvil/URL. Ciudad completa: confirmar exactamente 601 bloques, 1.386.616 volúmenes y 13 paquetes (derivados del manifiesto), ausencia de errores y presencia de geometría antes y después de navegar por barrios/zoom. Si faltan datos o no termina, fallar y escribir resultado fallido, nunca dejar un éxito anterior vigente.
11. Medir carga y continuidad en Chromium disponible. Contabilizar buffers y triángulos; declarar explícitamente SwiftShader/no benchmark GPU real. Inspeccionar capturas. No prometer FPS como Amsterdam sin hardware comparable. Verificar TypeScript, tests Python/TS, validador de ciudad y build.
12. Documentos y manifiestos coherentes: README, brief, auditoría, decisiones, informes de pruebas fechados, análisis de referencia/licencia y estado de pendientes. Auditoría Astra del código final; resolver hallazgos importantes y repetir pruebas afectadas. Commit local final y árbol limpio; excluir bulk, dependencias, capturas y secretos. No push/remotos.

## Reparto previsto y contratos

- Sol 6.1 / low A: `src/resident-city.ts`, `src/city-mesh.ts`, `src/city.worker.ts`, nuevo módulo de transporte/estado y tests TS correspondientes. Conservar `progress(loaded,total)`, `select`, `error`; añadir callback opcional `diagnostics` y `getDiagnostics()` de lectura. Coordinar tipos antes de cambiar interfaz.
- Sol 6.1 / low B: `src/main.tsx`, `src/style.css`, utilidades y tests de cámara/URL. Usar API pública del renderizador; no editar su implementación. Progreso/errores de atributos mediante contrato acordado.
- Sol 6.1 / low C: scripts de navegador, comprobaciones de estado/negativos, informes de navegador. No modificar código de producto ni manifiestos de dependencias. Validar endpoints reales además del fixture.
- Coordinador: scripts Python/checkpoints, dependencias/lockfile si procede, docs, integración, pruebas completas y commits. Tras revisión Astra, cerrar los cambios necesarios.

## Fuera de esta iteración / siguiente paso

- Años/edades: buscar fuente abierta compatible con edificios/volúmenes y auditar semántica y uniones. No simular un mapa de calor ni propagar fechas de parcela.
- Históricos, juegos, nuevas capas patrimoniales y arte: pospuestos.
- LOD agresivo, streaming que expulse mallas o cambio de renderer: sólo tras mediciones y acuerdo sobre continuidad.
- Revisar dependencias con avisos conocidos; cambios de versión sólo con evaluación y pruebas, sin actualización mayor automática ajena al alcance.

## Correcciones tras auditoría Astra

La puerta de ciudad completa y los diagnósticos pasan a P0, antes de aceptar mejoras UX. Ready exige conjuntos exactos de paquetes y bloques, identidad de cada respuesta worker, totales e IDs válidos y un render posterior; solicitudes e intentos se cuentan aparte de paquetes validados. Los informes se escriben running antes de iniciar Chromium y passed/failed aun ante fallo de lanzamiento o timeout. El informe anterior queda invalidado.

Transporte limitado por tamaños esperados, firma de bytes y validación de payload; un checksum comprimido no valida directamente bytes ya descomprimidos por Fetch. CBA1 valida tamaño exacto e índices antes de reservar mallas; sólo NaN significa altura desconocida. Estado terminal ante messageerror, excepciones de incorporación, shader o pérdida de contexto. Selección restaura estado GL en finally y se prueba con ID conocido, DPR 1/2, cámara inclinada y resize.

Distinguir buffers CPU residentes, recursos GPU creados al dibujar y memoria real no medida. Checkpoints vinculan configuración, NDJSON, binario y estadísticas; publicación con staging validado y recuperación de backup incluso tras interrupción. Actualización Vite acotada; evaluar aviso MapLibre antes de decidir versión.

Contrato entre implementadores: CityDiagnostics exportado con phase loading/ready/error/disposed, expectedBlocks, loadedBlocks, expectedVolumes, loadedVolumes, expectedPacks, validatedPacks (string[]), loadedBlockIds (string[]), requestAttempts, bufferBytes, retainedPackBytes, renders, error (string|null). Callback diagnostics opcional y getDiagnostics() entregan copia de lectura. selectionState opcional recibe {phase: idle/loading/ready/error, error?:string}. Conservar callbacks existentes. La UI expone window.__cityDiagnostics únicamente como getter de lectura para pruebas; no exponer mutaciones internas. Referencia revisada: Amsterdam commit 4d541802cc47257ce899cc1c75871346c6675c2d; arquitectura residente sin cambio respecto al commit adaptado.

## Entrega y evaluación

Implementado con subagentes Sol 6.1/low (runtime, interfaz y pruebas de navegador), coordinación de integración/pipeline y auditoría final Astra. `plan-audit.md` y `implementation-audit.md` conservan hallazgos y respuestas. No se añadieron historias ni fechas supuestas. Se mantuvo el formato geométrico y las mallas residentes; no fue necesaria una nueva adquisición ni transformación completa de los datos originales. Checkpoints/publicación se probaron con casos de corrupción e interrupción sobre directorios temporales; los paquetes de ciudad existentes se validaron completos.

Los errores de carga detienen nuevos trabajos y conservan dibujo/navegación de las mallas válidas; errores de shader/contexto/render son fatales y requieren recarga. La animación acotada termina incluso tras error de carga. El build mantiene aviso de chunk principal grande; dividirlo o cambiar estrategia de memoria requiere una medición posterior, no se ocultó el aviso.

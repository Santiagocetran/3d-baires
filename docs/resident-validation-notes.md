# Verificación de la ciudad residente

La arquitectura y código adaptado se detallan en `amsterdam-architecture.md`. Las mediciones reales se generan en `resident-city.json` (empaquetado), `resident-validation.json` (todas las mallas), `browser-smoke.json` (interacción sobre muestra) y, cuando se ejecuta, `browser-city.json` (carga completa en navegador).

- Diez pruebas Python: incluye transformación EPSG:3857→Mercator normalizado sin confundir radios terrestres, conservación de polígonos pequeños y altura cuestionable sin sustitución.
- Tres pruebas TypeScript: cubierta con hueco y polígonos separados, altura desconocida plana, rechazo de archivos truncados y alturas fuera de validación.
- Prueba de navegador con 800 registros reales y mapa base bloqueado: shaders sin errores, selección GPU devuelve identificador y atributos reales; alejar/desplazar/volver no solicita nuevos paquetes; prueba de cambio de capa, animación, viewport móvil y movimiento reducido.
- Capturas inspeccionadas en `data/processed/browser-check/desktop.png` y `mobile.png` (artefactos ignorados por Git). Son una muestra de datos reales, no una vista completa de CABA.
- El arranque usa `style.load`: preparar la ciudad local no depende de que OSM termine sus solicitudes.

El backend gráfico de prueba es Chromium headless con SwiftShader. Sus tiempos de carga no equivalen al rendimiento del dispositivo del usuario. Los bytes de buffers contabilizados no son una medición de memoria real del navegador o GPU; Three.js puede conservar copias en CPU y GPU.

El proceso de preparación inicial alcanzó el límite temporal del entorno. Se recuperaron bloques completos escritos y se añadió reanudación con checksum del NDJSON. Los puntos de control y los datos intermedios permanecen ignorados por Git. La ejecución normal desde cero y la reanudación aplican las mismas transformaciones geométricas.

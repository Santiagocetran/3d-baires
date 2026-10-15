# Historial de validación · desde 2026-10-14

**Estado actual y pruebas vigentes:** `resident-validation-notes.md`. Este documento conserva resultados históricos; no usar sus pendientes o comandos de la versión MVT como descripción de la interfaz actual.

La sección inicial describe la primera entrega GeoJSON. La iteración CABA en teselas se documenta al final; historias ya no forman parte de la interfaz.

## Ejecutado

- Ocho pruebas unitarias: decimales y desconocidos, extremos conservados, identidad SMP, colisiones, varios accesos y sentinelas, normalización de sección/espacios, orden de ejes y polígonos con huecos.
- `npm run check`: TypeScript estricto sin errores.
- `npm run build`: producción generada. Aviso de tamaño del bundle: MapLibre y React juntos, aproximadamente 1,14 MB sin comprimir / 321 KB gzip. No es un fallo de build; falta medir impacto en dispositivos reales.
- Servidor Vite local en loopback y respuesta HTTP 200 para la página principal.
- Las cuatro descargas se adquirieron de URLs devueltas por CKAN y registran SHA-256.

Controles finales completados: `scripts/validate.py` aprobó 29.933 geometrías válidas, pertenencia a los dos barrios, IDs de render únicos, alturas dentro de reglas y semántica de fechas de doce relatos. Diez marcadores históricos caen dentro del ámbito. Los endpoints de edificios, límites, relatos y resumen respondieron HTTP 200 con JSON válido y tipos MIME adecuados. El build final incluye los datos generados en `dist/data/`.

La entrega compacta ocupa 21.287.183 bytes frente a 29.089.347 bytes sin compactar; cero polígonos requirieron revertir el redondeo por invalidez. Esta medición es de tamaño, no de rendimiento gráfico.

## Inspección visual pendiente

La herramienta de navegador devolvió una lista vacía de navegadores disponibles. No se obtuvieron capturas ni se midieron FPS, tiempo real de renderizado, alineación visual contra mapa base o interacción táctil. TypeScript, build y pruebas de geometría **no sustituyen** estas verificaciones.

Lista histórica de comprobación de la entrega anterior (ya no aplicable a la interfaz actual):

1. Esperar volúmenes en San Telmo/Monserrat; contrastar calles y huellas con OSM en varios zooms.
2. Seleccionar un volumen alto y uno de altura desconocida. Comprobar valores, fuente, parcela y leyenda.
3. Abrir Historias; visitar Palacio Barolo, Palacio Vera y Mercado. El punto representa una parcela documentada, no un volumen individual.
4. En Construcción, confirmar dos puntos con fechas de construcción y volúmenes grises; no colorear por inauguración.
5. Probar ancho de 390 px: mapa superior, panel inferior desplazable, controles y atribución visibles.
6. Desactivar mapa base; recargar con red del proveedor bloqueada y comprobar que se siguen sirviendo edificios locales.
7. Probar error de datos ausentes en una copia del proyecto; el mensaje debe explicar cómo preparar datos y ofrecer reintento.

## Reproducción comprobada

Se volvió a ejecutar `scripts/publish.py` desde el NDJSON auditado. SHA-256 de edificios, límites e historias fue idéntico antes y después. La validación de datos volvió a aprobar. No se repitió el relevamiento ni se supone inmutabilidad de futuras descargas: una nueva versión requiere nueva auditoría.

La altura cuestionable de 830 m corresponde al registro fuente `1855249`, SMP `26-006-BEM1`. No se sustituyó por un valor supuesto. Los doce relatos tienen fuentes; diez tienen parcela localizada, pero sólo cinco tienen además candidatos con SMP compatible y posición dentro de esa parcela. Los demás marcadores no se presentan como vínculos verificados a un volumen.


## Iteración CABA 3D

Interfaz simplificada a alturas y antigüedad (gris/desconocida), selector de 48 barrios, carga MVT por zona visible y animación inicial/repetible. Datos de historias conservados, sin carga desde la interfaz. `scripts/validate-tiles.mjs` decodifica todas las teselas de zoom 15, comprueba IDs/alturas/ausencia de años y contrasta muestras de atributos con el NDJSON auditado; sus mediciones se guardan en `tile-validation.json`.

La herramienta de navegador volvió a devolver `apps: [], browsers: []`. El usuario vio correctamente la versión anterior; la animación y navegación de esta iteración requieren comprobación visual en su navegador vía SSH. No se han medido FPS ni memoria gráfica.

Comprobación manual actual:

1. Recargar y observar crecimiento hasta las alturas finales; repetir con «Animar volúmenes». Con movimiento reducido, las alturas deben aparecer directamente.
2. Saltar a Palermo, Villa Lugano, Belgrano y San Telmo; comprobar alineación, selección, atributos y bordes entre teselas.
3. Alejar por debajo de zoom 14: aparece aviso para acercar, sin afirmar ausencia de edificios.
4. Antigüedad muestra gris y explica que faltan fechas; volver a Alturas recupera los colores.
5. Probar móvil, atribución legible, desplazamiento del panel y controles táctiles.
6. Desactivar OSM: los volúmenes locales y su animación deben funcionar sin ese proveedor.

Resultados ejecutados de esta iteración: ocho pruebas unitarias y regresión GeoJSON aprobadas; TypeScript aprobado. Decodificación de todas las teselas z15: 1.382.714 `source_row` únicos, 1.516.798 fragmentos por recorte y 3.902 registros de entrada no representados en ese nivel. 234 muestras contrastadas con atributos originales y coordenadas dentro del envolvente original con tolerancia de cuantización. Ver `tile-validation.json`. Son verificaciones de datos, no de FPS.

Se descartó el nivel de vista general z13 tras medir una tesela de 20.125.627 bytes. La entrega z14–15 contiene 541 teselas y 310.889.982 bytes locales en total, con máximo 6.286.654 bytes por tesela. Ese total no se descarga al abrir: sólo las teselas visibles. Sin descarte por densidad; la cuantización puede eliminar geometrías subpíxel. El NDJSON original conserva todos los registros.

Build final de esta iteración aprobado (Vite 6.3.5, advertencia de bundle >500 KB conservada). Resumen CABA, límites y tesela no vacía respondieron HTTP 200 en el servidor local; bytes de la tesela servida idénticos al archivo generado. Herramientas compiladas y datos masivos comprobados como ignorados por Git; sin remotos.

## Entrega actual: ciudad residente

La experiencia activa reemplaza las extrusiones MVT por mallas Three.js persistentes, siguiendo el repositorio de Amsterdam. La validación de esta arquitectura se registra en `resident-validation-notes.md` y los JSON asociados. Las restricciones de zoom y descargas de geometría por viewport descritas arriba corresponden a la versión anterior. Ahora se ha ejecutado Chromium headless con datos reales y verificado selección, shaders, navegación sin repetir paquetes, redimensionado móvil y movimiento reducido sobre una muestra de 800 volúmenes. Esa muestra no es un benchmark de ciudad completa.

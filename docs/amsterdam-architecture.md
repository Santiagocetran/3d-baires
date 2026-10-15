# Arquitectura de Amsterdam adaptada a CABA

Repositorio analizado: https://github.com/alexbarakov/amsterdam-by-building, commit `d5eb5a89fabd1cc04473bddbc721b1e5f2b42bcb`. Licencia MIT verificada y conservada en `licenses/amsterdam-by-building-MIT.txt`.

## Qué hace la referencia

- `pipeline/s03_tiles.py`: agrupa geometría en bloques de 600 m, simplifica a 0,25 m y empaqueta anillos/atributos en binarios. Los distribuye en ocho paquetes, primero el centro.
- `web/worker.js`: triangula cubiertas con huecos y construye paredes fuera del hilo principal. Transfiere buffers tipados al renderizador.
- `web/app.js`, secciones Tiles, Shared uniforms y Picking: mantiene todas las mallas en la escena Three.js; cada bloque usa una textura de atributos. Un shader anima la llegada con desplazamiento por identificador. La selección renderiza identificadores RGB en un objetivo de un píxel. La navegación no descarga ni elimina geometría.

Los 192.000 edificios declarados por la referencia no son comparables directamente con los 1.386.616 **volúmenes** de Tejido.

## Adaptación

`meshpack.py`, `city-mesh.ts`, `city.worker.ts` y `resident-city.ts` adaptan esa arquitectura y partes del código bajo MIT. Se mantiene React para la interfaz y MapLibre para cámara, controles y mapa base; Three.js comparte el contexto WebGL mediante una capa personalizada. No hay extrusiones MVT activas ni umbral de zoom para los edificios. Frustum culling omite dibujos fuera de cámara pero **no elimina sus buffers**.

- Bloques locales de 600 m y paquetes gzip de hasta unos 8 MB descomprimidos (salvo un bloque individual mayor). Dos workers y carga progresiva desde el centro; los paquetes ya consumidos se liberan, las mallas permanecen.
- Coordenadas Float32 en metros locales, en lugar de enteros de decímetros: se comprueba la topología después de codificarlas. Se preservan los polígonos separados y huecos. Sin recorte por teselas, descarte por densidad ni pérdida deliberada de volúmenes pequeños.
- Simplificación topológica de 0,25 m, explícita como aproximación visual. El NDJSON mantiene geometría original. No se cambian alturas ni identidades fuente.
- Dos vértices por punto (base/cubierta), compartidos entre paredes y cubierta, en lugar de cinco; normales calculadas en shader. Reduce buffers manteniendo las caras y huecos. Índices de 16 bits cuando el bloque lo permite; 32 bits para bloques mayores.
- Textura por volumen con altura e identificador `source_row`. La altura desconocida usa estado -1 en la textura; geometría plana. El valor original cuestionable sigue en atributos.
- Atributos textuales por bloque descargados sólo al seleccionar. No se mantiene todo el catastro textual en la GPU ni se asignan años.
- Animación de llegada adaptada de Amsterdam, ejecutada en GPU. Identificador sólo determina la animación; jamás fechas, alturas o atributos. Respeta movimiento reducido. La selección usa exactamente la geometría animada.

## Coordenadas

Entrada longitud/latitud WGS84 → EPSG:3857 con `always_xy=True`. Se resta el origen `(-58.378, -34.617)` proyectado y se multiplica XY por cos(latitud de origen); ejes locales X este, Y arriba, Z sur. Para alinearse con MapLibre, la matriz XY utiliza el radio WGS84 de EPSG:3857 (6378137 m), no el radio terrestre medio que MapLibre usa para alturas. La escala vertical por bloque usa `meterInMercatorCoordinateUnits()` en su centro; el valor publicado de altura se conserva. La ligera variación de escala vertical dentro de 600 m es una aproximación de visualización.

## Límites

La residencia completa intercambia menos interrupciones al navegar por mayor memoria inicial. No se promete el mismo FPS que Amsterdam ni soporte de móviles de poca memoria sin medirlo. Los paquetes de geometría se descargan una sola vez por sesión y se mantienen como mallas; al cerrar se liberan workers, geometrías, texturas y materiales. El mapa base OSM sigue siendo un mapa de teselas y puede realizar nuevas solicitudes al navegar.

Fuentes técnicas: [Three.js con MapLibre](https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain/) y código de MapLibre instalado para `CustomLayerInterface`.

## Revisión del 2026-10-15

Se comparó el commit adaptado con `4d541802cc47257ce899cc1c75871346c6675c2d` del repositorio público. La arquitectura de mallas residentes no cambió; las diferencias principales son recorridos, grafo y contenido curado, fuera del enfoque actual. El panel plegable inspira nuestra mejora móvil. No se reutilizaron años suavizados/estimados, historias ni imágenes. SimCABA conserva valor como referencia de exploración, no como fuente de huellas/alturas medibles.

La adaptación añade validación estricta de manifiesto y CBA1, transporte compatible con gzip de archivo/HTTP, estado terminal explícito, errores de atributos independientes y diagnósticos de residencia. La residencia describe buffers CPU conservados en la escena. Three.js crea recursos GPU al dibujar; no se afirma que toda la ciudad esté subida a GPU al terminar la carga ni que 431 MB sea su memoria total.

MapLibre se actualizó de 5.6.0 a 6.4.1 por [GHSA-jrc7-96c5-q579](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579): el aviso afecta atribuciones HTML no confiables. Actualmente las atribuciones son constantes propias, pero se prefirió corregir la dependencia antes de futuras fuentes. La versión introduce módulos ESM/worker separado, integrado explícitamente con Vite. Vite 6.4.4 elimina los avisos del servidor de desarrollo detectados; `npm audit` quedó sin vulnerabilidades en esta revisión. No es una garantía sobre avisos futuros.

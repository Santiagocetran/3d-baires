# 3d-baires

Mapa 3D local de **Capital Federal (48 barrios)** con geometría y alturas reales publicadas por GCBA. La ciudad se carga progresivamente una vez y sus mallas permanecen en memoria al navegar, sin desaparecer al cambiar de zoom.

El motor de edificios adapta la arquitectura de [Amsterdam, building by building](https://github.com/alexbarakov/amsterdam-by-building): paquetes binarios, workers, mallas Three.js persistentes, animación en GPU y selección por identificador. React conserva la interfaz y MapLibre la cámara y el mapa base. Licencia MIT y atribución conservadas en `licenses/`. Ver `docs/amsterdam-architecture.md`.

**Antigüedad:** Tejido no contiene años de construcción. Gris significa desconocido. No hay mapa de calor de edades verificadas todavía. Historias fuera de la interfaz.

## Preparar y ejecutar

Requiere Node.js 22, Python 3.12, unos 8 GB libres para preparación y red para adquirir datos/dependencias. Navegador WebGL2 con `DecompressionStream`. Mantener toda CABA en memoria requiere más recursos que un mapa que descarga geometría al alejarse; ver mediciones en `docs/resident-validation.json`.

```sh
npm ci
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/acquire.py
.venv/bin/python scripts/process.py
.venv/bin/python scripts/meshpack.py
.venv/bin/python scripts/report.py
npm run dev
```

Con los datos actuales ya preparados basta `npm run dev`. Para regenerar únicamente la ciudad residente desde NDJSON auditado, ejecutar `scripts/meshpack.py`. Si la preparación se interrumpe, `.venv/bin/python scripts/meshpack.py --resume` reutiliza bloques terminados y verifica que el checksum de entrada no cambió. No se necesita Tippecanoe para esta entrega. Los scripts MVT y el recorte original siguen como antecedentes/regresión.

Abrir **http://127.0.0.1:5173**. Desde el equipo conectado por SSH:

```sh
ssh -N -L 5173:127.0.0.1:5173 usuario@dispositivo
```

Abrir **http://localhost:5173** en ese equipo. No se expone el servidor a internet.

Arrastrar mueve; rueda o +/− acercan; botón derecho y arrastre giran/inclinan. El selector salta a cualquier barrio. El indicador muestra preparación global de la ciudad, no nuevas descargas por viewport. Los bloques cargados permanecen y sólo se omite su dibujo cuando están fuera de cámara. «Animar volúmenes» repite la llegada visual; no representa historia constructiva. Se respeta movimiento reducido.

El mapa base OSM es opcional y requiere internet. Sus teselas sí cambian al navegar. Los edificios y límites se sirven localmente, sin cuenta, API key ni backend. Los archivos `.gz` son paquetes explícitos que el cliente descomprime: **no agregar `Content-Encoding: gzip`** a esas rutas, pues causaría doble descompresión.

## Verificar

```sh
.venv/bin/python -m unittest discover -s tests -v
npm run test:mesh
npm run validate:city
npm run check
npm run build
```

Prueba en navegador con una muestra de **800 volúmenes reales**, aislada mediante interceptación de solicitudes y sin sustituir la entrega del producto:

```sh
.venv/bin/python scripts/mesh-test-fixture.py
npx playwright install chromium
npm run test:browser
```

Para un Chromium ya instalado: `CHROMIUM_PATH=/ruta/al/ejecutable npm run test:browser`. La prueba comprueba shaders, selección, navegación sin volver a solicitar paquetes, tamaño móvil y movimiento reducido. No es un benchmark de toda CABA.

## Datos y límites

- `data/raw/`: originales inmutables; descarga inicial ~1,58 GB; ignorados por Git.
- `data/downloads.json`, `data/sources.json`: URLs, fechas, licencias y checksums.
- `data/processed/volumes.ndjson`: geometría original auditada, precisión completa.
- `public/data/city/city.json`, `pack-*.bin.gz`: índice y geometría residente.
- `public/data/city/attrs/`: atributos originales por bloque, consultados al seleccionar.
- `docs/resident-city.json`, `resident-validation.json`: mediciones de empaquetado y mallas.
- `docs/data-audit.md`: auditoría y límites; `docs/project-brief.md`: prioridades.

Un registro es un volumen, no necesariamente un edificio. No se prueba completitud con el conteo. Datos hasta 2021, no un relevamiento de 2026. La altura cuestionable de 830 m permanece en los atributos y se dibuja plana. La geometría visual se simplifica a 0,25 m preservando topología; Float32 local se valida después de codificarse. No se recortan polígonos por bloque ni se descartan por densidad/zoom. Alturas originales en ficha; no se estiman años.

Atribución: GCBA, Tejido Urbano, Parcelas/Frentes y Barrios. Recursos de Tejido/Parcelas: CC BY 4.0; catálogos: CC BY 2.5 AR; discrepancia conservada. Mapa base © OpenStreetMap contributors. Motor adaptado de alexbarakov/amsterdam-by-building (MIT), Three.js (MIT). Ver manifiesto y licencias.

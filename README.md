# 3d-baires

**Versión pública:** [3d-baires.vercel.app](https://3d-baires.vercel.app).

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

Con los datos actuales ya preparados basta `npm run dev`. Para regenerar únicamente la ciudad residente desde NDJSON auditado, ejecutar `scripts/meshpack.py`. Si la preparación se interrumpe, `.venv/bin/python scripts/meshpack.py --resume` verifica entrada, configuración/versiones, grupos NDJSON, binarios y estadísticas antes de reutilizar bloques. Checkpoints antiguos no se aceptan: repetir sin `--resume`. La publicación valida staging y conserva una copia recuperable hasta completar la promoción; una interrupción entre renombres se recupera al iniciar nuevamente el script. No se necesita Tippecanoe para esta entrega. Los scripts MVT y el recorte original siguen como antecedentes/regresión.

Abrir **http://127.0.0.1:5173**. Desde el equipo conectado por SSH:

```sh
ssh -N -L 5173:127.0.0.1:5173 usuario@dispositivo
```

Abrir **http://localhost:5173** en ese equipo. No se expone el servidor a internet.

Arrastrar mueve; rueda o +/− acercan; botón derecho y arrastre giran/inclinan. El selector salta a cualquier barrio; «Ver toda CABA» encuadra los límites oficiales. La URL conserva cámara y capa; «Copiar enlace de esta vista» permite compartirlas. En móvil el panel se puede contraer. El indicador muestra preparación global de la ciudad, no nuevas descargas por viewport. Los bloques cargados permanecen y sólo se omite su dibujo cuando están fuera de cámara. «Animar volúmenes» repite la llegada visual; no representa historia constructiva. Se respeta movimiento reducido.

El mapa base OSM es opcional y requiere internet. Sus teselas sí cambian al navegar. Los edificios y límites se sirven localmente, sin cuenta, API key ni backend. El cliente detecta la firma gzip en los bytes recibidos: admite archivos comprimidos y servidores con `Content-Encoding: gzip` (Fetch ya los descomprime). Valida tamaños y estructura antes de generar mallas. Los errores terminales muestran un botón para recargar; errores de atributos permiten seguir explorando.

## Verificar

```sh
.venv/bin/python -m unittest discover -s tests -v
npm test
npm run validate:city
npm run check
npm run build
```

Prueba en navegador con una muestra de **800 volúmenes reales**, aislada mediante interceptación de solicitudes y sin sustituir la entrega del producto:

```sh
.venv/bin/python scripts/mesh-test-fixture.py
npx playwright install chromium
npm run test:browser
npm run test:browser:negative
npm run test:browser:city
```

Para un Chromium ya instalado: `CHROMIUM_PATH=/ruta/al/ejecutable npm run test:browser`. Mantener `npm run dev` abierto durante las pruebas. `test:browser` usa la muestra para selección conocida, móvil y controles; `test:browser:negative` inyecta errores después de una carga parcial. `test:browser:city` usa toda la entrega local y exige conjuntos exactos de bloques/paquetes, volúmenes completos y continuidad al navegar. Los informes `docs/browser-*.json` registran `running`, `passed` o `failed`, incluso ante fallos de lanzamiento. Son pruebas funcionales con SwiftShader, no benchmarks de hardware.

Para verificar la versión de producción: `npm run build`, luego `npm run preview` en otra terminal y `BROWSER_BASE_URL=http://127.0.0.1:4173 BROWSER_REPORT=docs/browser-preview.json npm run test:browser:city`. `CHROMIUM_PATH` también se aplica a esa orden. El timeout completo predeterminado es 10 minutos; puede ajustarse con `CITY_TIMEOUT_MS`.

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

## Licencia

El código original y la documentación de 3d-baires se publican bajo [MIT](LICENSE). Las partes adaptadas de Amsterdam conservan el copyright de alexbarakov y su [licencia MIT](licenses/amsterdam-by-building-MIT.txt).

Los datos de GCBA, la cartografía de OpenStreetMap y las dependencias mantienen sus propias licencias; la licencia MIT del proyecto no las sustituye. Consultar [el manifiesto de fuentes y licencias](data/sources.json) para procedencia, atribución y discrepancias de metadatos. Los datos masivos se preparan localmente con los scripts indicados arriba.

## Publicar en Vercel

Con los datos locales preparados, `npm run prepare:vercel` crea el artefacto estático completo sin incluir los antecedentes MVT/GeoJSON. Ver [autenticación, despliegue y verificación](docs/deployment.md). Importar sólo el repositorio en Vercel no incluye los paquetes de datos.

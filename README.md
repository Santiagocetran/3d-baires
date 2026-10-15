# 3d-baires

**Versión pública:** [3d-baires.vercel.app](https://3d-baires.vercel.app).

Mapa 3D interactivo y de código abierto de **Capital Federal (48 barrios)** con geometría y alturas reales publicadas por GCBA. La ciudad se carga progresivamente una vez y sus mallas permanecen en memoria al navegar, sin desaparecer al cambiar de zoom.

La versión pública funciona sin cuenta ni API key. Incluye **1.386.616 volúmenes** distribuidos en 601 bloques y 13 paquetes de geometría; estos registros no equivalen a edificios individuales ni prueban completitud. La descarga inicial de geometría es de unos **61 MB**; los atributos se consultan al seleccionar. También se puede ejecutar localmente con los pasos siguientes.

El motor de edificios adapta la arquitectura de [Amsterdam, building by building](https://github.com/alexbarakov/amsterdam-by-building): paquetes binarios, workers, mallas Three.js persistentes, animación en GPU y selección por identificador. React conserva la interfaz y MapLibre la cámara y el mapa base. Licencia MIT y atribución conservadas en `licenses/`. Ver `docs/amsterdam-architecture.md`.

**Antigüedad:** Tejido no contiene años de construcción. Gris significa desconocido. No hay mapa de calor de edades verificadas todavía. Las fichas de lugares destacados son puntos independientes: no asignan años ni identidad a los volúmenes catastrales.

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

La interfaz usa un panel azul, edificios por altura en amarillo/coral/violeta y OSM a color con mayor saturación (también en parques). El exterior de CABA queda oculto por una máscara celeste con el contorno oficial, sin recortar ni alterar la geometría residente. `src/assets/caba-boundary.geojson` se obtiene de la unión sin simplificar de los 48 barrios; si cambian sus límites, regenerar con `.venv/bin/python scripts/map-boundary.py`. El archivo conserva el checksum de entrada.

Los símbolos ✦ muestran fotos y datos de **13 lugares**: Teatro Colón, Casa Rosada, Obelisco, Cabildo, Palacio Barolo y ocho estadios (Boca, River, San Lorenzo, Huracán, Vélez, Argentinos Juniors, Ferro y Atlanta) al pasar el mouse o enfocar con teclado. Clic/toque fija la ficha; × o Escape la cierran. También hay accesos en «Lugares para descubrir», con lista desplazable y filtro «Fútbol» que muestra sólo estadios tanto en la lista como en el mapa. Se ocultan los símbolos al alejarse (zoom < 14), sin ocultar los edificios. Los ocho estadios usan puntos y direcciones del catálogo oficial GCBA (CC BY 2.5 AR), transformados de EPSG:9498 a WGS84 con ejes explícitos. `data/stadium-points.json` conserva los IDs y coordenadas originales; `.venv/bin/python scripts/landmark_stadiums.py` reproduce la transformación y descarga el recurso sólo si no existe en `data/raw/`. La actualización del catálogo no se presenta como fecha de observación. Son puntos de interés independientes, sin identidad catastral verificada: no se asocian automáticamente a las mallas ni se propagan fechas/alturas. Fuentes oficiales, procedencia de coordenadas y checksums de fotografías en `data/landmarks-sources.json`; créditos/licencias en cada ficha. Las fotos se sirven localmente y sus licencias son independientes de MIT.

La animación usa una llegada vertical breve en GPU: semilla por volumen y límites calculados en el worker, dos materiales compartidos para dibujo/selección y comienzo en el primer dibujo visible. El reposo no solicita frames continuos. Son cambios para reducir trabajo y superposición; falta medir FPS en hardware real.

El mapa base OSM es opcional y requiere internet. Sus teselas sí cambian al navegar. Los edificios y límites se sirven como archivos estáticos desde Vercel en la versión pública o desde el servidor local durante el desarrollo, sin backend. El cliente detecta la firma gzip en los bytes recibidos: admite archivos comprimidos y servidores con `Content-Encoding: gzip` (Fetch ya los descomprime). Valida tamaños y estructura antes de generar mallas. Los errores terminales muestran un botón para recargar; errores de atributos permiten seguir explorando.

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
npm run test:browser:design
npm run test:browser:city
```

Para un Chromium ya instalado: `CHROMIUM_PATH=/ruta/al/ejecutable npm run test:browser`. Mantener `npm run dev` abierto durante las pruebas. `test:browser` usa la muestra para selección conocida, móvil y controles; `test:browser:negative` inyecta errores después de una carga parcial. `test:browser:city` usa toda la entrega local y exige conjuntos exactos de bloques/paquetes, volúmenes completos y continuidad al navegar. Los informes `docs/browser-*.json` registran `running`, `passed` o `failed`, incluso ante fallos de lanzamiento. `test:browser:design` verifica hover hacia la ficha, permanencia por clic, Escape, teclado, foto local y encuadre móvil, movimiento real por píxeles, retorno exacto a reposo y detención de frames; guarda capturas locales y `docs/browser-design.json`. Son pruebas funcionales con SwiftShader, no benchmarks de hardware.

Para verificar el build de producción localmente: `npm run build`, luego `npm run preview` en otra terminal y `BROWSER_BASE_URL=http://127.0.0.1:4173 BROWSER_REPORT=docs/browser-preview.json npm run test:browser:city`. `CHROMIUM_PATH` también se aplica a esa orden. El timeout completo predeterminado es 10 minutos; puede ajustarse con `CITY_TIMEOUT_MS`.

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

La versión pública está alojada en **https://3d-baires.vercel.app**. Los despliegues son manuales desde una copia con dependencias y datos preparados; un push a GitHub no publica automáticamente. Git no contiene los paquetes masivos, por lo que importar únicamente el repositorio en Vercel no genera una entrega completa.

```sh
# Primera vez en este equipo: autenticar y vincular al proyecto existente 3d-baires
npx --yes vercel@64.2.0 login
npx --yes vercel@64.2.0 link

# Cada publicación, con los datos locales preparados
npm run prepare:vercel
npx --yes vercel@64.2.0 deploy --prebuilt --prod
```

`prepare:vercel` verifica los datos, ejecuta TypeScript/build y genera `.vercel/output/static` con la aplicación, geometría, atributos, límites, licencias y manifiesto de fuentes. Excluye crudos y antecedentes MVT/GeoJSON. El artefacto verificado del 2026-10-15 contiene 624 archivos y 82.689.903 bytes. `.vercel/` y las credenciales permanecen fuera de Git.

La publicación se verificó sin autenticación: página y manifiesto accesibles, checksums coincidentes y 404 para un paquete inexistente. La [prueba remota de navegador](docs/browser-vercel.json) aprobó la carga de los 601 bloques, 1.386.616 volúmenes y 13 paquetes, el recorrido por cuatro barrios sin nuevas descargas de geometría y la vista completa de CABA. Se ejecutó con SwiftShader y teselas neutras: no mide rendimiento de hardware ni verifica el servicio externo de OSM.

Para repetir la prueba sobre la publicación, con Chromium instalado:

```sh
BROWSER_BASE_URL=https://3d-baires.vercel.app BROWSER_REPORT=docs/browser-vercel.json npm run test:browser:city
```

No requiere un servidor local; `CHROMIUM_PATH` permite indicar un ejecutable existente. Ver [detalles de despliegue, caché y verificación](docs/deployment.md).

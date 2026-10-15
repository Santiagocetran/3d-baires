# Referencias y fuentes revisadas · 2026-10-14

## Inspiración

- [LAYRS: Amsterdam](https://stop-token.com/lab/amsterdam/) y [repositorio](https://github.com/alexbarakov/amsterdam-by-building): HTML y README accesibles. [LICENSE](https://github.com/alexbarakov/amsterdam-by-building/blob/main/LICENSE) declara MIT, copyright 2026 alexbarakov. El README describe 192.000 edificios, una canalización Python y visualización three.js con teselas binarias. No se reutilizó código ni activos. Su política de estimar o distribuir algunos años no se adopta aquí. Inspección de contenido y arquitectura; no se pudo inspeccionar interactivamente porque la herramienta de navegador no tiene navegadores conectados.
- [SimCABA](https://caba.nicolaspoore.com/) aporta inspiración de exploración y descubrimientos. [Nota de TN](https://tn.com.ar/tecno/novedades/2026/05/30/es-programador-y-creo-un-mapa-detallado-de-buenos-aires-en-pixel-art-con-tesoros-escondidos/) describe imágenes ilustradas a partir de capturas satelitales y correcciones manuales. No es fuente de polígonos, alturas ni fechas. No se copiaron imágenes o teselas; no se comprobó una licencia de reutilización.

## Fuentes adicionales

- [RUS](https://data.buenosaires.gob.ar/dataset/relevamiento-usos-suelo): recurso SHP 2022–2024, UUID `613ef164-131b-422a-b9e2-257cee4b46b4`. Catálogo y enlaces descargables conservados en `research-resources.json`; registros no descargados ni auditados. No se presume compatibilidad de SMP con Tejido.
- [Atlas de Edificios Catalogados](https://buenosaires.gob.ar/gcaba_historico/planeamiento/publicaciones/patrimonio-urbano): [Tomo II](https://www.ssplan.buenosaires.gob.ar/dmdocuments/atlas_2/files/tomo2_web.pdf), edición 2010. El PDF declara derechos reservados y reproducción con consentimiento; no se redistribuye ni se importa masivamente. Es una vía de investigación de fechas de proyecto/construcción, con cobertura selectiva, no un catastro de edades completo.
- [APH](https://data.buenosaires.gob.ar/dataset/areas-proteccion-historica): enlaces verificados vía CKAN, no geometrías auditadas. Una zona protegida no atribuye edad a cada edificio.
- [Obras Registradas](https://data.buenosaires.gob.ar/dataset/obras-registradas): enlaces verificados vía CKAN, sin importar registros. Fechas administrativas no equivalen a terminación de obra.
- Ciudad 3D no se utiliza como fuente de alturas medidas: sus volúmenes normativos no representan necesariamente edificación existente.

## Mapa base

[OpenStreetMap Standard](https://operations.osmfoundation.org/policies/tiles/) se solicita directamente desde el navegador, con atribución visible, caché HTTP normal y Referer del navegador. Sin precarga masiva, descarga offline, proxy ni API key. Se puede apagar; los edificios siguen siendo locales. La disponibilidad del servicio es de mejor esfuerzo. No se publicará sin revisar nuevamente las condiciones y el volumen de uso.

## Historias

`data/stories.json` contiene doce resúmenes originales breves, fechas tipificadas, direcciones y enlaces del Ente de Turismo GCBA. Se conservan hechos y fuentes, sin copiar fotografías ni textos extensos. `docs/history-matches.json` registra el resultado de la unión con catastro. Un marcador de parcela no prueba identidad de todos los volúmenes de esa parcela. Las fechas de construcción verificadas se colorean sólo en los puntos históricos; los volúmenes continúan sin edad asignada.

## Iteración CABA 3D y antigüedad

Tippecanoe 2.79.0, commit `68ab8dcc229f95b8b25877697d5e8d66783af503`, [repositorio y licencia BSD-2-Clause](https://github.com/felt/tippecanoe/tree/2.79.0). Compilación local, sin incorporar su código al repositorio del proyecto. [Especificación de extrusiones MapLibre](https://maplibre.org/maplibre-style-spec/layers/#fill-extrusion): animación de altura implementada en el frontend, sin copiar assets de Amsterdam.

Búsqueda adicional del 2026-10-14 en los dominios oficiales por «antigüedad», «año de construcción» y «Ciudad 3D»: no se identificó un recurso descargable reutilizable y compatible con todo Tejido. No equivale a afirmar su inexistencia. Las fuentes históricas previas se conservan para investigación, fuera de la interfaz; ninguna fecha se propaga a volúmenes.

## Arquitectura residente de Amsterdam

Se analizó el commit `d5eb5a89fabd1cc04473bddbc721b1e5f2b42bcb` de [amsterdam-by-building](https://github.com/alexbarakov/amsterdam-by-building). Se adaptaron su empaquetado por bloques, worker de extrusión, texturas de atributos, shader de llegada y selección GPU. Licencia MIT copiada a `licenses/amsterdam-by-building-MIT.txt` y atribución visible. Esta iteración sí adapta código de la referencia; las notas anteriores de «sin código reutilizado» corresponden a la implementación inicial.

No se adaptaron sus estimaciones de años ni mínimos de altura: CABA mantiene sus propios datos y reglas de desconocidos. Detalles en `amsterdam-architecture.md`.

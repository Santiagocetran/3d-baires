# Convenciones de 3d-baires

Trabajar en esta raíz. Mantener frontend React + TypeScript + Vite + MapLibre y procesamiento Python, sin backend salvo necesidad concreta. Interfaz y documentación de producto en español. No desplegar, crear remotos ni contactar terceros sin solicitud.

## Comandos

- `npm install`, `npm run dev`, `npm run check`, `npm run build`.
- `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
- `.venv/bin/python scripts/acquire.py` y `.venv/bin/python scripts/process.py` (incluye resolver historias); `.venv/bin/python scripts/report.py` genera el informe.
- `.venv/bin/python scripts/validate.py` verifica la entrega contra datos y límites reales.
- `.venv/bin/python -m unittest discover -s tests -v`.

## Integridad

- Nunca fabricar años de construcción, alturas ni relatos históricos.
- Nunca presentar inferencias como hechos medidos ni inferir alturas de ilustraciones.
- Separar fecha de observación de actualización del catálogo.
- Separar fechas de proyecto, permiso, construcción e inauguración.
- Mantener distintas identidades de parcela, edificio y volumen.
- Conservar identificadores originales, URL, licencia, fecha de recuperación y checksum.
- Señalar coincidencias ambiguas; no asignarlas silenciosamente.
- Altura desconocida permanece desconocida en estadísticas. Toda altura visual de respaldo debe etiquetarse como aproximada; preferir huella plana.
- No modificar datos crudos. Transformaciones deterministas y rerunables; revisar cambios de esquema y CRS, fallar antes que adivinar.
- Conteos de geometrías no equivalen a conteos de edificios ni prueban completitud.
- Relatos separados de geometría; fechas sólo con tipo y fuente. No propagar una fecha a todos los volúmenes de una parcela sin verificación.
- Ignorar datos voluminosos, dependencias y secretos. Conservar resultados pequeños de auditoría y manifiestos.

## Verificación

Probar casos significativos de parsing, coordenadas y coincidencias. Ejecutar chequeo TypeScript y build. Actualizar README y docs/data-audit.md con evidencia real; distinguir ejecutado, pendiente y bloqueado. Nunca declarar pruebas no ejecutadas como aprobadas.

Normalizar SMP sólo mediante espacios alrededor del guion y sección numérica a tres dígitos; conservar SMP original y reportar colisiones. Las puertas separadas por puntos en Frentes son accesos distintos, no decimales. No propagar fechas de lugares históricos a volúmenes candidatos.

## Enfoque actual

Ciudad 3D residente con Three.js, adaptada de Amsterdam (MIT), integrada en cámara/mapa base MapLibre. Preparar con `.venv/bin/python scripts/meshpack.py`; verificar con `npm run test:mesh`, `npm run validate:city` y `npm run test:browser` (requiere fixture/Chromium, ver README). No volver a introducir descarga de mallas al cambiar zoom sin discutir el cambio de producto. Mantener atribución y licencia de código adaptado. Historias fuera de la interfaz; edades desconocidas hasta conseguir fuentes vinculables. Animación visual en GPU, nunca cronología. Respeta movimiento reducido. Recorte GeoJSON y MVT anteriores quedan como antecedentes.

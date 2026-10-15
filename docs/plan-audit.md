# Auditoría del plan · Astra · 2026-10-15

Revisión independiente solicitada por el usuario, realizada con `gpt-6-astra` (high) antes de implementar. Dictamen: viable con correcciones, sin reemplazar el motor residente.

Correcciones incorporadas en `implementation-plan.md`:

1. Adelantar diagnósticos y prueba completa a P0. Exigir conjuntos exactos de paquetes/bloques, identidad worker y totales; un render posterior a la incorporación completa. Separar intentos de paquetes validados.
2. Invalidar el falso positivo anterior y escribir informes running/passed/failed incluso ante fallo de lanzamiento o timeout.
3. Detectar compresión por bytes; acotar descarga/descompresión, validar tamaño/estructura. No comparar checksum comprimido con cuerpo decodificado por Fetch.
4. Validar configuración antes de asignar memoria, CBA1 antes de triangular; sólo NaN indica altura desconocida. Terminal ante errores de worker, shader o contexto. Separar atributos de geometría.
5. Selección determinista por ID conocido, DPR 1/2 y cambios de cámara/tamaño. Restaurar estado GL en finally.
6. Separar residencia CPU, recursos GPU y memoria real; no extrapolar SwiftShader a móviles ni introducir evicción.
7. Checkpoints vinculados a configuración/NDJSON/binario/estadísticas y promoción recuperable. Evaluar avisos de dependencias antes de actualizar.

La revisión leyó el plan y código; no ejecutó pruebas. Los resultados de implementación se documentan por separado en `resident-validation-notes.md` y en la auditoría final.

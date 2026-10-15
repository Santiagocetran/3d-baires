# Auditoría de datos · 3d-baires

Generada desde archivos reales: 2026-10-14T18:18:19.496343+00:00. Conteos de registros/volúmenes, **no de edificios únicos**. No existe una referencia independiente para calcular completitud.

## Entrega activa: ciudad 3D residente

La interfaz usa mallas Three.js persistentes, preparadas en workers a partir de paquetes binarios (arquitectura adaptada de Amsterdam, MIT). MapLibre sólo aporta cámara/mapa base. Sin eliminación de geometría al navegar, sin umbral de zoom ni recorte por bloque. Simplificación topológica de 0,25 m y Float32 local validados; originales conservados. Alturas desconocidas planas; fechas desconocidas. Las secciones MVT/GeoJSON que siguen son antecedentes, no la entrega activa.

| Métrica | Valor |
|---|---:|
| records | 1,386,616 |
| vertices | 9,068,079 |
| input_coordinates | 15,710,638 |
| parts | 1,386,616 |
| rings | 1,390,492 |
| blocks | 601 |
| packs | 13 |
| geometry_download_bytes | 60,922,260 |
| geometry_uncompressed_bytes | 100,316,496 |
| attrs_download_bytes | 18,705,100 |
| max_block_bytes | 485,940 |
| max_block_records | 7,177 |
| source_sha256 | b0e9a9be199d573886b7e151a2da9a83f10aa72b7b965b936e1e2cfc58270e3a |
| simplification_m | 0.25 |
| records_excluded | 0 |
| encoded_topology_failures | 0 |
| successful_run_seconds | 139.6 |
| resumed | 1 |

Verificación de mallas:

| Métrica | Valor |
|---|---:|
| records | 1,386,616 |
| unique_source_rows | 1,386,616 |
| triangles | 24,436,400 |
| vertices | 18,136,158 |
| typed_mesh_and_texture_bytes | 431,099,114 |
| unknown_height_flat | 1 |
| attribute_samples | 1,202 |
| note | Buffer storage estimate, not measured browser/GPU memory. Three.js retains CPU arrays and also uploads GPU buffers. |

## Antecedente MVT: toda CABA

La entrega anterior MVT usaba los 48 barrios: 541 teselas, 310,889,982 bytes totales, máximo 6,286,654 bytes por tesela. Se solicitan sólo las visibles desde zoom 14; zoom máximo nativo 15. No se descartan registros por densidad. MVT cuantiza y recorta; polígonos subpíxel pueden colapsar. La auditoría y los resultados del recorte GeoJSON de abajo se conservan como antecedente y regresión, no describen el formato activo. Historias fuera de la interfaz. Antigüedad desconocida para todos los volúmenes.

Comprobación MVT (zoom 15):

| Métrica | Valor |
|---|---:|
| zoom | 15 |
| unique_source_rows | 1,382,714 |
| source_records | 1,386,616 |
| records_not_represented_at_z15 | 3,902 |
| fragments | 1,516,798 |
| empty_tiles | 185 |
| sampled_source_property_and_coordinate_matches | 234 |

## Hallazgos medidos

| Métrica | Valor |
|---|---:|
| records | 1,386,616 |
| missing_smp | 20,659 |
| empty_geometry | 0 |
| invalid_geometry | 0 |
| non_polygon | 0 |
| missing_id | 0 |
| neighbourhood_unmatched_or_ambiguous | 0 |

### Geometría e identidad

| Métrica | Valor |
|---|---:|
| MultiPolygon | 1,386,616 |

| Métrica | Valor |
|---|---:|
| Exceso de IDs repetidos | 20 |
| Exceso de geometrías válidas idénticas | 3,479 |
| SMP con múltiples volúmenes | 272,159 |

Bounds EPSG:4326 (oeste, sur, este, norte): `[-58.53041508692756, -34.70014960827453, -58.335709138211556, -34.53181147971989]`. CRS originales y transformaciones: `audit-results.json → crs`. Entrada CRS84, salida longitud/latitud WGS84; si corresponde reproyección se usa pyproj con `always_xy=True`. El NDJSON conserva precisión completa. La entrega al navegador redondea coordenadas a 7 decimales (orden de un centímetro, sin afirmar esa precisión del relevamiento), revierte al original si el redondeo invalida el polígono, y comparte la fecha de observación en metadatos. No se reparan geometrías. Se excluyen geometrías inválidas, vacías, no poligonales y sin barrio único del producto procesado; se conservan crudas y se contabilizan. Duplicados geométricos se detectan normalizando anillos con Shapely; no se eliminan automáticamente.

### Alturas y esquema

| Métrica | Valor |
|---|---:|
| valid | 1,386,615 |
| implausible | 1 |
| missing | 0 |
| zero | 0 |
| negative | 0 |
| unparseable | 0 |

Rango numérico, incluidos ceros y valores cuestionables: [0.1, 830.0]. Media sólo de alturas positivas ≤350 m: 9.685 m. El umbral de 350 m es una regla de revisión, no una prueba de precisión. Cero no se interpreta como altura útil. Los desconocidos no se convierten a cero en estadísticas ni se estiman desde pisos.

Se aceptan números y cadenas decimales con punto o coma; no se interpreta `d` como separador decimal. Los ejemplos del esquema web no sustituyen el contenido descargado. Tipos reales por campo:

| Campo | Tipos y cantidades |
|---|---|
| id | {'int': 1386616} |
| smp | {'str': 1365957, 'NoneType': 20659} |
| consolidad | {'int': 1386616} |
| altura | {'float': 1386616} |
| altos | {'int': 1386616} |
| origen | {'str': 1386616} |
| tipo | {'str': 1386616} |
| fuente | {'str': 1386616} |

Campos con nombres de fecha/año: `[]`. Ninguna fecha de construcción individual se deriva de Tejido. La cobertura temporal 'hasta 2021' procede del catálogo, no de una fecha de levantamiento de cada volumen. Catálogo actualizado en 2026 no implica observación en 2026.

### Parcelas, frentes y uniones

| Métrica | Valor |
|---|---:|
| records | 318,046 |
| empty_geometry | 0 |
| invalid_geometry | 0 |
| missing_smp | 0 |

| Métrica | Valor |
|---|---:|
| records | 426,664 |
| missing_identity_or_address | 56,737 |

| Métrica | Valor |
|---|---:|
| parcel_address_single | 373,767 |
| parcel_address_multiple | 620,106 |
| parcel_unmatched | 391,569 |
| exact_smp_but_spatial_conflict | 7,507 |
| address_missing | 1,174 |
| raw_smp_match_records | 0 |
| parcel_ambiguous | 0 |

Claves de parcela duplicadas tras normalización: 0. `raw_smp_match_records` mide texto exacto sin normalizar; las demás uniones normalizan espacios alrededor del guion y sección numérica a tres dígitos. Se conservan mayúsculas/minúsculas, componentes de manzana/parcela y el SMP original. Puertas separadas por puntos se expanden, incluyendo sufijos alfabéticos; `N`, `X` y otros tokens no numéricos quedan fuera.

Las categorías de dirección son mutuamente excluyentes antes de comprobar posición. `exact_smp_but_spatial_conflict` es un subconjunto adicional: el punto interior del volumen no cae en la parcela única con ese SMP. Se marca conflicto y no se considera identidad verificada. Varios accesos no identifican el acceso de cada volumen. No se resuelven cambios catastrales mediante vecinos más cercanos.

### Distribución espacial

Un barrio se asigna por el punto interior de cada polígono válido, no por su centroide. Un volumen que cruza límites puede asignarse a uno; no se recorta su geometría. Los ceros o conteos bajos requieren investigar, no demuestran ausencia real de edificios.

| Barrio | Volúmenes válidos asignados | Altura positiva aceptada |
|---|---:|---:|
| Agronomia | 9,803 | 9,803 |
| Almagro | 48,526 | 48,526 |
| Balvanera | 52,250 | 52,250 |
| Barracas | 38,710 | 38,709 |
| Belgrano | 50,886 | 50,886 |
| Boedo | 26,667 | 26,667 |
| Caballito | 72,779 | 72,779 |
| Chacarita | 15,798 | 15,798 |
| Coghlan | 11,577 | 11,577 |
| Colegiales | 23,362 | 23,362 |
| Constitucion | 17,121 | 17,121 |
| Flores | 63,966 | 63,966 |
| Floresta | 20,945 | 20,945 |
| La Boca | 14,179 | 14,179 |
| Liniers | 30,413 | 30,413 |
| Mataderos | 44,644 | 44,644 |
| Monserrat | 20,538 | 20,538 |
| Monte Castro | 21,672 | 21,672 |
| Nueva Pompeya | 27,318 | 27,318 |
| Nuñez | 25,695 | 25,695 |
| Palermo | 95,939 | 95,939 |
| Parque Avellaneda | 26,536 | 26,536 |
| Parque Chacabuco | 34,331 | 34,331 |
| Parque Chas | 12,825 | 12,825 |
| Parque Patricios | 20,013 | 20,013 |
| Paternal | 12,618 | 12,618 |
| Puerto Madero | 1,187 | 1,187 |
| Recoleta | 61,955 | 61,955 |
| Retiro | 29,658 | 29,658 |
| Saavedra | 30,543 | 30,543 |
| San Cristobal | 20,749 | 20,749 |
| San Nicolas | 28,259 | 28,259 |
| San Telmo | 9,395 | 9,395 |
| Velez Sarsfield | 20,360 | 20,360 |
| Versalles | 9,949 | 9,949 |
| Villa Crespo | 38,547 | 38,547 |
| Villa Del Parque | 32,715 | 32,715 |
| Villa Devoto | 49,621 | 49,621 |
| Villa Gral. Mitre | 19,562 | 19,562 |
| Villa Lugano | 34,193 | 34,193 |
| Villa Luro | 20,020 | 20,020 |
| Villa Ortuzar | 14,741 | 14,741 |
| Villa Pueyrredon | 24,375 | 24,375 |
| Villa Real | 9,824 | 9,824 |
| Villa Riachuelo | 8,972 | 8,972 |
| Villa Santa Rita | 20,592 | 20,592 |
| Villa Soldati | 11,579 | 11,579 |
| Villa Urquiza | 50,709 | 50,709 |

## Tamaño y alcance del navegador

Fuentes: 1,576,456,584 bytes. Tejido solo: 1,087,959,837 bytes. Recorte de San Telmo y Monserrat, después de compactar la entrega: **29,933 volúmenes**, **21,287,183 bytes** de GeoJSON sin comprimir. Se descarta enviar el archivo citywide de 1,09 GB al cliente; no se afirma rendimiento citywide. Límite preventivo de publicación: 25 MB. NDJSON citywide se mantiene fuera del navegador y de Git. La siguiente etapa deberá generar teselas vectoriales y medir memoria/FPS.

## Historias y fechas

12 relatos originales con fuentes oficiales; 10 marcadores ubicados por dirección exacta y parcela única. Los restantes conservan la dirección textual sin inventar coordenadas. `history-matches.json` registra parcela y volúmenes candidatos cuya posición coincide, **no una identidad confirmada de edificio**. Dos fechas de construcción tipificadas se muestran en puntos históricos (Palacio Vera y Casa de la Cultura); ninguna se propaga a los volúmenes. Las demás fechas son inauguración, intervalos o cambios de uso y no se convierten en año de construcción.

## Licencias y procedencia

`data/downloads.json` y `data/sources.json` conservan URLs oficiales descubiertas por CKAN, recuperación UTC, tamaños, SHA-256 y licencias. Recursos Tejido, Parcelas y Frentes: CC-BY-4.0; sus datasets: CC-BY-2.5-AR. Barrios: recurso `cc-by` sin versión, dataset CC-BY-2.5-AR. Esta inconsistencia se mantiene explícita; la atribución cita a GCBA y el nombre de las fuentes. Los datos se transforman y no se presentan como obra original de este proyecto.

## Interpretaciones y pendientes

- Varias geometrías por SMP son compatibles con volúmenes de distintas alturas en una parcela; no prueban cuántos edificios hay.
- Falta validar relevamiento/precisión de alturas por registro y cambios posteriores a 2021.
- No hay auditoría contra un inventario independiente de edificios. No se publica porcentaje de completitud.
- Falta revisar causas de geometrías inválidas, conflictos espaciales, SMP no coincidentes y direcciones faltantes.
- RUS 2022–2024, APH, Obras y Atlas fueron investigados como fuentes futuras; sus registros no se presentan como auditados. Ver `references.md` y `research-resources.json`.

## Acceso y verificación

Los bloqueos iniciales de DNS y escritura de Git se resolvieron al habilitar acceso en la sesión. Hubo resets intermitentes del catálogo; los cuatro recursos terminaron descargados y con checksum.

Las pruebas ejecutadas y el estado de inspección visual se detallan en `validation.md`. No se afirma que los chequeos geométricos sustituyan una inspección visual ni una medición de rendimiento real.

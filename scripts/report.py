"""Render measured audit to Markdown; never invent figures when processing is incomplete."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def run():
    a=json.loads((ROOT/'docs/audit-results.json').read_text())
    for key in ('empty_geometry','invalid_geometry','non_polygon','missing_id','missing_smp','neighbourhood_unmatched_or_ambiguous'): a['counts'].setdefault(key,0)
    for key in ('raw_smp_match_records','parcel_ambiguous'): a['joins'].setdefault(key,0)
    for key in ('valid','missing','zero','negative','implausible','unparseable'): a['height_status'].setdefault(key,0)
    for key in ('empty_geometry','invalid_geometry','missing_smp'): a['parcel_quality'].setdefault(key,0)
    (ROOT/'docs/audit-results.json').write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
    h=json.loads((ROOT/'docs/history-matches.json').read_text())
    def table(values):
        return '| Métrica | Valor |\n|---|---:|\n'+'\n'.join(f'| {k} | {v:,} |' if isinstance(v,(int,float)) and not isinstance(v,bool) else f'| {k} | {v} |' for k,v in values.items())+'\n'
    text='# Auditoría de datos · 3d-baires\n\n'
    text+=f"Generada desde archivos reales: {a['generated_at']}. Conteos de registros/volúmenes, **no de edificios únicos**. No existe una referencia independiente para calcular completitud.\n\n"
    if (ROOT/'docs/resident-city.json').exists():
        city=json.loads((ROOT/'docs/resident-city.json').read_text())
        text+='## Entrega activa: ciudad 3D residente\n\n'
        text+='La interfaz usa mallas Three.js persistentes, preparadas en workers a partir de paquetes binarios (arquitectura adaptada de Amsterdam, MIT). MapLibre sólo aporta cámara/mapa base. Sin eliminación de geometría al navegar, sin umbral de zoom ni recorte por bloque. Simplificación topológica de 0,25 m y Float32 local validados; originales conservados. Alturas desconocidas planas; fechas desconocidas. Las secciones MVT/GeoJSON que siguen son antecedentes, no la entrega activa.\n\n'
        text+=table(city)+'\n'
        text+='La auditoría de transporte del 2026-10-15 invalidó un resultado anterior de navegador (967 ms, sólo un paquete). Los informes actuales exigen estado estructurado y conjuntos completos; ver `resident-validation-notes.md` y `browser-city.json`. La validación de datos no demuestra por sí sola rendimiento gráfico.\n\n'
        if (ROOT/'docs/resident-validation.json').exists():
            text+='Verificación de mallas:\n\n'+table(json.loads((ROOT/'docs/resident-validation.json').read_text()))+'\n'
    if (ROOT/'docs/citywide-tiles.json').exists():
        city=json.loads((ROOT/'docs/citywide-tiles.json').read_text())
        text+='## Antecedente MVT: toda CABA\n\n'
        text+=f"La entrega anterior MVT usaba los 48 barrios: {city['tile_count']:,} teselas, {city['bytes']:,} bytes totales, máximo {city['max_tile_bytes']:,} bytes por tesela. Se solicitan sólo las visibles desde zoom 14; zoom máximo nativo 15. No se descartan registros por densidad. MVT cuantiza y recorta; polígonos subpíxel pueden colapsar. La auditoría y los resultados del recorte GeoJSON de abajo se conservan como antecedente y regresión, no describen el formato activo. Historias fuera de la interfaz. Antigüedad desconocida para todos los volúmenes.\n\n"
        validation=ROOT/'docs/tile-validation.json'
        if validation.exists():
            text+='Comprobación MVT (zoom 15):\n\n'+table(json.loads(validation.read_text()))+'\n'
    text+='## Hallazgos medidos\n\n'+table(a['counts'])+'\n'
    text+='### Geometría e identidad\n\n'+table(a['geometry_types'])+'\n'
    text+=table({'Exceso de IDs repetidos':a['duplicate_id_excess'],'Exceso de geometrías válidas idénticas':a['duplicate_valid_polygon_geometry_excess'],'SMP con múltiples volúmenes':a['parcels_with_multiple_volumes']})
    text+=f"\nBounds EPSG:4326 (oeste, sur, este, norte): `{a['bounds_wgs84']}`. CRS originales y transformaciones: `audit-results.json → crs`. Entrada CRS84, salida longitud/latitud WGS84; si corresponde reproyección se usa pyproj con `always_xy=True`. El NDJSON conserva precisión completa. El antecedente GeoJSON redondea coordenadas a 7 decimales (orden de un centímetro, sin afirmar esa precisión del relevamiento), revierte al original si el redondeo invalida el polígono, y comparte la fecha de observación en metadatos. No se reparan geometrías. Se excluyen geometrías inválidas, vacías, no poligonales y sin barrio único del producto procesado; se conservan crudas y se contabilizan. Duplicados geométricos se detectan normalizando anillos con Shapely; no se eliminan automáticamente.\n\n"
    text+='### Alturas y esquema\n\n'+table(a['height_status'])
    text+=f"\nRango numérico, incluidos ceros y valores cuestionables: {a['height_range_all_parsed']}. Media sólo de alturas positivas ≤350 m: {a['mean_valid_height']:.3f} m. El umbral de 350 m es una regla de revisión, no una prueba de precisión. Cero no se interpreta como altura útil. Los desconocidos no se convierten a cero en estadísticas ni se estiman desde pisos.\n\n"
    text+='Se aceptan números y cadenas decimales con punto o coma; no se interpreta `d` como separador decimal. Los ejemplos del esquema web no sustituyen el contenido descargado. Tipos reales por campo:\n\n| Campo | Tipos y cantidades |\n|---|---|\n'
    for k,v in a['field_types'].items():text+=f'| {k} | {v} |\n'
    text+=f"\nCampos con nombres de fecha/año: `{a['date_like_fields']}`. Ninguna fecha de construcción individual se deriva de Tejido. La cobertura temporal 'hasta 2021' procede del catálogo, no de una fecha de levantamiento de cada volumen. Catálogo actualizado en 2026 no implica observación en 2026.\n\n"
    text+='### Parcelas, frentes y uniones\n\n'+table(a['parcel_quality'])+'\n'+table(a['frontage_quality'])+'\n'+table(a['joins'])
    text+=f"\nClaves de parcela duplicadas tras normalización: {a['duplicate_parcel_smp_keys']}. `raw_smp_match_records` mide texto exacto sin normalizar; las demás uniones normalizan espacios alrededor del guion y sección numérica a tres dígitos. Se conservan mayúsculas/minúsculas, componentes de manzana/parcela y el SMP original. Puertas separadas por puntos se expanden, incluyendo sufijos alfabéticos; `N`, `X` y otros tokens no numéricos quedan fuera.\n\nLas categorías de dirección son mutuamente excluyentes antes de comprobar posición. `exact_smp_but_spatial_conflict` es un subconjunto adicional: el punto interior del volumen no cae en la parcela única con ese SMP. Se marca conflicto y no se considera identidad verificada. Varios accesos no identifican el acceso de cada volumen. No se resuelven cambios catastrales mediante vecinos más cercanos.\n\n"
    text+='### Distribución espacial\n\nUn barrio se asigna por el punto interior de cada polígono válido, no por su centroide. Un volumen que cruza límites puede asignarse a uno; no se recorta su geometría. Los ceros o conteos bajos requieren investigar, no demuestran ausencia real de edificios.\n\n| Barrio | Volúmenes válidos asignados | Altura positiva aceptada |\n|---|---:|---:|\n'
    for n,c in sorted(a['neighbourhoods'].items()):text+=f"| {n} | {c.get('volumes',0):,} | {c.get('valid',0):,} |\n"
    text+='\n## Antecedente GeoJSON: tamaño y alcance\n\n'
    text+=f"Fuentes: {sum(s['bytes'] for s in a['sources'].values()):,} bytes. Tejido solo: {a['sources']['tejido']['bytes']:,} bytes. Recorte de San Telmo y Monserrat, después de compactar la entrega: **{a['browser_count']:,} volúmenes**, **{a['browser_bytes']:,} bytes** de GeoJSON sin comprimir. Se descarta enviar el archivo citywide de 1,09 GB al cliente; no se afirma rendimiento citywide. Límite preventivo de publicación: 25 MB. NDJSON citywide se mantiene fuera del navegador y de Git. La entrega activa usa paquetes residentes (mediciones al inicio); las teselas posteriores también quedan como antecedente. Falta medir memoria/FPS en hardware real.\n\n"
    text+='## Historias y fechas\n\n'
    text+=f"{len(h)} relatos originales con fuentes oficiales; {sum('coordinates' in s for s in h)} marcadores ubicados por dirección exacta y parcela única. Los restantes conservan la dirección textual sin inventar coordenadas. `history-matches.json` registra parcela y volúmenes candidatos cuya posición coincide, **no una identidad confirmada de edificio**. En la primera versión se mostraron dos fechas de construcción tipificadas en puntos históricos (Palacio Vera y Casa de la Cultura); ninguna se propaga a los volúmenes. Las demás fechas son inauguración, intervalos o cambios de uso y no se convierten en año de construcción.\n\n"
    text+='## Licencias y procedencia\n\n`data/downloads.json` y `data/sources.json` conservan URLs oficiales descubiertas por CKAN, recuperación UTC, tamaños, SHA-256 y licencias. Recursos Tejido, Parcelas y Frentes: CC-BY-4.0; sus datasets: CC-BY-2.5-AR. Barrios: recurso `cc-by` sin versión, dataset CC-BY-2.5-AR. Esta inconsistencia se mantiene explícita; la atribución cita a GCBA y el nombre de las fuentes. Los datos se transforman y no se presentan como obra original de este proyecto.\n\n'
    text+='## Interpretaciones y pendientes\n\n- Varias geometrías por SMP son compatibles con volúmenes de distintas alturas en una parcela; no prueban cuántos edificios hay.\n- Falta validar relevamiento/precisión de alturas por registro y cambios posteriores a 2021.\n- No hay auditoría contra un inventario independiente de edificios. No se publica porcentaje de completitud.\n- Falta revisar causas de geometrías inválidas, conflictos espaciales, SMP no coincidentes y direcciones faltantes.\n- RUS 2022–2024, APH, Obras y Atlas fueron investigados como fuentes futuras; sus registros no se presentan como auditados. Ver `references.md` y `research-resources.json`.\n\n'
    text+='## Acceso y verificación\n\nLos bloqueos iniciales de DNS y escritura de Git se resolvieron al habilitar acceso en la sesión. Hubo resets intermitentes del catálogo; los cuatro recursos terminaron descargados y con checksum.\n\nLas pruebas ejecutadas y el estado de inspección visual se detallan en `validation.md`. No se afirma que los chequeos geométricos sustituyan una inspección visual ni una medición de rendimiento real.\n'
    (ROOT/'docs/data-audit.md').write_text(text)
    print('Wrote docs/data-audit.md')

if __name__=='__main__':run()

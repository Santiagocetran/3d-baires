"""Create static CABA vector tiles from audited, full precision volumes.
Requires tippecanoe 2.79.0 (BSD-2-Clause) on PATH or TIPPECANOE.
"""
import hashlib
import json
import os
import math
import sys
from pathlib import Path
import subprocess
import shutil
ROOT = Path(__file__).resolve().parents[1]

def run():
    binary = os.environ.get('TIPPECANOE', str(ROOT/'.tools/tippecanoe/tippecanoe'))
    version = subprocess.check_output([binary, '--version'], stderr=subprocess.STDOUT, text=True).strip()
    target = ROOT/'public/data/caba-tiles'
    staging = ROOT/'data/processed/caba-tiles-staging'
    reuse = '--package-existing' in sys.argv
    if staging.exists() and not reuse: shutil.rmtree(staging)
    source = ROOT/'data/processed/volumes.ndjson'
    # No feature dropping by density or size. Low zoom geometry is quantized;
    # tiny polygons can collapse at the tile resolution. Full source is retained.
    command = [binary, '-e', str(staging), '-l', 'volumes', '-Z', '14', '-z', '15',
               '--no-tile-compression', '--no-feature-limit', '--no-tile-size-limit',
               '--no-tiny-polygon-reduction', '--no-line-simplification',
               '--exclude=observation', '--exclude=smp_join_key', str(source)]
    if not reuse:
        subprocess.run(command, check=True, env={**os.environ, 'TIPPECANOE_MAX_THREADS':'4'})
    if (staging/'13').exists(): shutil.rmtree(staging/'13')
    # Empty MVT tiles avoid 404s for water/gaps inside the advertised bounds.
    empty = 0
    def tile_xy(lon, lat, zoom):
        n = 2**zoom
        return int((lon+180)/360*n), int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
    for zoom in range(14,16):
        west,north = tile_xy(-58.54,-34.53,zoom)
        east,south = tile_xy(-58.33,-34.71,zoom)
        for x in range(west,east+1):
            for y in range(north,south+1):
                path = staging/str(zoom)/str(x)/f'{y}.pbf'
                if not path.exists():
                    path.parent.mkdir(parents=True,exist_ok=True)
                    path.write_bytes(b'')
                    empty += 1
    tiles = list(staging.rglob('*.pbf'))
    sizes = sorted(p.stat().st_size for p in tiles)
    if not sizes: raise ValueError('No tiles produced')
    if sizes[-1] > 8_000_000: raise ValueError('Tile exceeds 8 MB budget')
    metadata_path=staging/'metadata.json'
    metadata=json.loads(metadata_path.read_text())
    metadata['minzoom']=14
    metadata_path.write_text(json.dumps(metadata))
    if target.exists(): shutil.rmtree(target)
    staging.rename(target)
    scope = json.loads((ROOT/'data/raw/barrios.geojson').read_text())
    (ROOT/'public/data/caba-scope.geojson').write_text(json.dumps(scope, ensure_ascii=False, separators=(',',':')))
    audit = json.loads((ROOT/'docs/audit-results.json').read_text())
    summary = {'scope':'CABA', 'source_records':audit['counts']['records'], 'neighbourhoods':len(scope['features']), 'empty_tiles':sizes.count(0),
               'minzoom':14, 'maxzoom':15, 'tile_count':len(tiles), 'bytes':sum(sizes),
               'max_tile_bytes':sizes[-1], 'median_tile_bytes':sizes[len(sizes)//2],
               'tippecanoe':version, 'source_sha256':hashlib.file_digest(source.open('rb'),'sha256').hexdigest(),
               'source_observation':'Hasta 2021; fecha individual desconocida',
               'verified_construction_dates':0,
               'geometry_note':'MVT cuantiza y recorta por tesela; polígonos subpíxel pueden colapsar. Sin descarte por densidad.',
               'reproduction_command':command, 'reused_staging':reuse, 'staging_note':'First run produced zoom 13 too; discarded oversized overview level before publication.' if reuse else None}
    (ROOT/'docs/citywide-tiles.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
    (ROOT/'public/data/caba-summary.json').write_text(json.dumps(summary, ensure_ascii=False)+'\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == '__main__': run()

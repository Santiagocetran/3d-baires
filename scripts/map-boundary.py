"""Une límites oficiales de barrios para la máscara visual; no modifica crudos."""
import hashlib
import json
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'public/data/caba-scope.geojson'
raw = source.read_bytes()
scope = json.loads(raw)
boundary = unary_union([shape(f['geometry']) for f in scope['features']])
if boundary.geom_type != 'Polygon' or not boundary.is_valid:
    raise ValueError('Se esperaba un límite Polygon válido de CABA; revisar esquema/topología')
output = ROOT / 'src/assets/caba-boundary.geojson'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'type': 'Feature', 'properties': {
    'source': 'GCBA · Barrios · public/data/caba-scope.geojson',
    'source_sha256': hashlib.sha256(raw).hexdigest(),
    'transformation': 'shapely.ops.unary_union; sin simplificación',
}, 'geometry': mapping(boundary)}, separators=(',', ':')) + '\n')
print(output.relative_to(ROOT))

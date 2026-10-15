"""Prepara una publicación estática Vercel con datos reales; no despliega ni autentica."""
import json
from pathlib import Path
import shutil
import subprocess
from meshpack_io import validate_city

ROOT = Path(__file__).resolve().parents[1]

def prepare():
    city = ROOT / 'public/data/city'
    validate_city(city)
    manifest = json.loads((city / 'city.json').read_text())
    scope = ROOT / 'public/data/caba-scope.geojson'
    if not scope.is_file():
        raise ValueError('Faltan los límites de CABA; ejecutar scripts/meshpack.py')
    subprocess.run(['npm', 'run', 'build'], cwd=ROOT, check=True)
    output = ROOT / '.vercel/output'
    if output.exists():
        shutil.rmtree(output)
    static = output / 'static'
    (static / 'data/city').mkdir(parents=True)
    shutil.copy2(ROOT / 'dist/index.html', static / 'index.html')
    shutil.copytree(ROOT / 'dist/assets', static / 'assets')
    shutil.copy2(scope, static / 'data/caba-scope.geojson')
    files = {'city.json', *(p['file'] for p in manifest['packs']), *(t['attrs'] for t in manifest['tiles'])}
    for name in sorted(files):
        source = (city / name).resolve()
        if not source.is_relative_to(city.resolve()):
            raise ValueError(f'Ruta de datos fuera del directorio: {name}')
        destination = static / 'data/city' / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    shutil.copy2(ROOT / 'LICENSE', static / 'LICENSE.txt')
    shutil.copytree(ROOT / 'licenses', static / 'licenses')
    shutil.copy2(ROOT / 'data/sources.json', static / 'data/sources.json')
    # Fixed data filenames must revalidate after deployment; Vite assets have content hashes.
    config = {'version': 3, 'routes': [
        {'src': '/assets/(.*)', 'headers': {'Cache-Control': 'public, max-age=31536000, immutable'}, 'continue': True},
        {'src': '/data/(.*)', 'headers': {'Cache-Control': 'public, max-age=0, must-revalidate'}, 'continue': True},
        {'src': '^/$', 'dest': '/index.html', 'headers': {'Cache-Control': 'public, max-age=0, must-revalidate'}},
        {'handle': 'filesystem'}
    ]}
    (output / 'config.json').write_text(json.dumps(config, indent=2) + '\n')
    sizes = [p.stat().st_size for p in static.rglob('*') if p.is_file()]
    total = sum(sizes)
    if total > 100_000_000:
        raise ValueError(f'Publicación supera el presupuesto de 100 MB: {total} bytes')
    print(json.dumps({'output': '.vercel/output', 'files': len(sizes), 'bytes': total,
        'volumes': manifest['source_records'], 'blocks': len(manifest['tiles']),
        'packs': len(manifest['packs']), 'largest_file_bytes': max(sizes)}, indent=2))

if __name__ == '__main__':
    prepare()

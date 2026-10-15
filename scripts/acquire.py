"""Acquire official CKAN resources atomically, retaining provenance and failures."""
import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = 'https://data.buenosaires.gob.ar/api/3/action/'
SOURCES = [
    ('tejido', 'tejido-urbano', '9d950b8c-d8cd-4dde-9987-9565313974c8', 'geojson', 'hasta 2021; fecha individual desconocida'),
    ('parcelas', 'parcelas', '8d8ffe66-9eb9-4f12-8f23-e1586a2d888d', 'geojson', None),
    ('frentes', 'parcelas', 'juqdkmgo-1563-resource', 'csv', None),
    ('barrios', 'barrios', '1c3d185b-fdc9-474b-b41b-9bd960a3806e', 'geojson', None),
]

def get(url):
    for attempt in range(3):
        try:
            return urlopen(Request(url, headers={'User-Agent': '3d-baires/0.1 local data research'}), timeout=120)
        except OSError:
            if attempt == 2: raise
            time.sleep(attempt + 1)

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true', help='Re-fetch metadata and resources')
    args = parser.parse_args()
    raw = ROOT / 'data/raw'
    raw.mkdir(parents=True, exist_ok=True)
    manifest_path = ROOT / 'data/downloads.json'
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    result = {}
    for name, package, resource_id, extension, observed in SOURCES:
        path = raw / f'{name}.{extension}'
        previous = old.get(name, {})
        if not args.refresh and path.exists() and previous.get('sha256') == sha(path):
            result[name] = previous
            print(f'{name}: cached, checksum verified', flush=True)
            continue
        entry = {'catalogue_url': f'https://data.buenosaires.gob.ar/dataset/{package}',
                 'resource_id': resource_id, 'observation_date': observed,
                 'attempted_at': datetime.now(timezone.utc).isoformat(), 'path': str(path.relative_to(ROOT))}
        try:
            with get(API + 'package_show?id=' + package) as response:
                package_data = json.load(response)['result']
            (raw / f'{name}.metadata.json').write_text(json.dumps(package_data, ensure_ascii=False, indent=2))
            resource = next(r for r in package_data['resources'] if r['id'] == resource_id)
            entry.update(url=resource['url'], license=resource.get('license_id') or package_data.get('license_id'),
                         dataset_license=package_data.get('license_id'),
                         catalogue_modified=package_data.get('metadata_modified'),
                         resource_modified=resource.get('last_modified'))
            # This is a provenance gate, not a licence inference from the URL.
            if package_data.get('license_id') != 'CC-BY-2.5-AR':
                raise ValueError('Dataset licence changed: review before reuse')
            if resource.get('license_id') not in (None, 'cc-by', 'CC-BY-4.0', 'CC-BY-2.5-AR'):
                raise ValueError('Resource licence changed: review before reuse')
            temporary = path.with_suffix(path.suffix + '.part')
            with get(resource['url']) as response, temporary.open('wb') as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            if extension == 'geojson':
                with temporary.open('rb') as f:
                    prefix = f.read(4096).lstrip()
                if not prefix.startswith(b'{') or b'FeatureCollection' not in prefix:
                    raise ValueError('Response is not a GeoJSON FeatureCollection')
            temporary.replace(path)
            entry.update(status='downloaded', retrieved_at=datetime.now(timezone.utc).isoformat(),
                         bytes=path.stat().st_size, sha256=sha(path))
            print(f'{name}: {entry["bytes"]:,} bytes', flush=True)
        except Exception as exc:
            entry.update(status='failed', error=str(exc))
            print(f'{name}: FAILED: {exc}', flush=True)
        with (ROOT / 'data/acquisition-log.jsonl').open('a') as log:
            log.write(json.dumps(entry, ensure_ascii=False) + '\n')
        result[name] = entry
        manifest_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    manifest_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    sources_path = ROOT / 'data/sources.json'
    if sources_path.exists():
        sources = json.loads(sources_path.read_text())
        sources['sources'] = result
        sources['reviewed_at'] = datetime.now(timezone.utc).date().isoformat()
        sources_path.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n')
    if any(v.get('status') != 'downloaded' for v in result.values()):
        raise SystemExit('Acquisition incomplete; see data/downloads.json. No synthetic replacement created.')

if __name__ == '__main__':
    main()

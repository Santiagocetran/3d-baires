"""Checkpoints verificables y promoción recuperable del conjunto residente local."""
import gzip
import hashlib
import json
from pathlib import Path
import shutil


def sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def save_json(path, value):
    path = Path(path)
    temp = path.with_name(path.name + '.tmp')
    temp.write_text(json.dumps(value, sort_keys=True), encoding='utf-8')
    temp.replace(path)


def verify_checkpoint(work, source_hash, signature):
    checkpoint = json.loads((work / 'checkpoint.json').read_text())
    if checkpoint.get('source_sha256') != source_hash or checkpoint.get('signature') != signature:
        raise ValueError('Input/configuración cambió: repetir sin --resume')
    groups = checkpoint['groups']
    if set(groups) != {p.name for p in work.glob('*.ndjson')}:
        raise ValueError('Checkpoint incompleto: faltan/sobran grupos NDJSON')
    for name, expected in groups.items():
        if sha256(work / name) != expected:
            raise ValueError(f'Grupo alterado: {name}; repetir sin --resume')
    return checkpoint


def cached_block(base, group_hash, signature):
    """Una caché inválida se recalcula; nunca se reutiliza parcialmente."""
    try:
        meta = json.loads(base.with_suffix('.json').read_text())
        blob = base.with_suffix('.bin').read_bytes()
        stats = meta['stats']
        if (meta['group_sha256'] == group_hash and meta['signature'] == signature
                and meta['blob_sha256'] == hashlib.sha256(blob).hexdigest()
                and meta['stats_sha256'] == digest(stats)):
            return blob, stats
    except (OSError, ValueError, KeyError, TypeError):
        pass
    return None


def save_block(base, blob, stats, group_hash, signature):
    temp = base.with_suffix('.bin.tmp')
    temp.write_bytes(blob)
    temp.replace(base.with_suffix('.bin'))
    save_json(base.with_suffix('.json'), {'signature': signature, 'group_sha256': group_hash,
        'blob_sha256': hashlib.sha256(blob).hexdigest(), 'stats_sha256': digest(stats), 'stats': stats})


def validate_city(directory):
    config = json.loads((directory / 'city.json').read_text())
    if config.get('format') != 'CBA1' or not config['tiles'] or not config['packs']:
        raise ValueError('Manifiesto de ciudad inválido')
    if sum(t['n'] for t in config['tiles']) != config['source_records']:
        raise ValueError('Conteo de ciudad no coincide')
    packs = {p['file']: p for p in config['packs']}
    if len(packs) != len(config['packs']):
        raise ValueError('Paquetes duplicados')
    for name, pack in packs.items():
        path = directory / name
        if path.stat().st_size != pack['bytes'] or sha256(path) != pack['sha256']:
            raise ValueError(f'Paquete alterado: {name}')
        raw = gzip.decompress(path.read_bytes())
        if len(raw) != pack['uncompressed_bytes']:
            raise ValueError(f'Longitud de paquete inválida: {name}')
        end = 0
        for tile in sorted((t for t in config['tiles'] if t['pack'] == name), key=lambda t: t['offset']):
            if tile['offset'] != end or raw[end:end+4] != b'CBA1':
                raise ValueError(f'Rangos de paquete inválidos: {name}')
            end += tile['length']
            attrs = json.loads(gzip.decompress((directory / tile['attrs']).read_bytes()))
            if len(attrs) != tile['n']:
                raise ValueError(f'Atributos incompletos: {tile["id"]}')
        if end != len(raw):
            raise ValueError(f'Paquete incompleto: {name}')
    if any(t['pack'] not in packs for t in config['tiles']):
        raise ValueError('Bloque sin paquete')


def recover_publication(target, validator=validate_city):
    """Recupera una interrupción entre renombres en la próxima ejecución."""
    backup = target.with_name(target.name + '.previous')
    if not backup.exists():
        return
    if target.exists():
        try:
            validator(target)
        except Exception:
            shutil.rmtree(target)
            backup.rename(target)
            return
        shutil.rmtree(backup)
    else:
        backup.rename(target)


def publish_city(staging, target, validator=validate_city):
    recover_publication(target, validator)
    validator(staging)
    backup = target.with_name(target.name + '.previous')
    if target.exists():
        target.rename(backup)
    try:
        staging.rename(target)
        validator(target)
    except Exception:
        if target.exists():
            shutil.rmtree(target)
        if backup.exists():
            backup.rename(target)
        raise
    if backup.exists():
        shutil.rmtree(backup)

import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from meshpack_io import (sha256, save_json, verify_checkpoint, cached_block, save_block,
                        publish_city, recover_publication, validate_city)


class CheckpointTests(unittest.TestCase):
    def test_resume_rejects_changed_group_config_and_missing_group(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            group = work / '0_0.ndjson'; group.write_text('original')
            save_json(work / 'checkpoint.json', {'source_sha256':'source', 'signature':'config',
                'records':1, 'groups':{group.name:sha256(group)}})
            self.assertEqual(verify_checkpoint(work, 'source', 'config')['records'], 1)
            with self.assertRaises(ValueError):verify_checkpoint(work, 'source', 'changed')
            group.write_text('altered')
            with self.assertRaises(ValueError):verify_checkpoint(work, 'source', 'config')
            group.unlink()
            with self.assertRaises(ValueError):verify_checkpoint(work, 'source', 'config')

    def test_cache_binds_input_binary_and_stats(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp)/'0_0';stats={'records':1,'vertices':4}
            save_block(base,b'CBA1binary',stats,'input','config')
            self.assertEqual(cached_block(base,'input','config'),(b'CBA1binary',stats))
            self.assertIsNone(cached_block(base,'different input','config'))
            self.assertIsNone(cached_block(base,'input','different config'))
            base.with_suffix('.bin').write_bytes(b'corruption')
            self.assertIsNone(cached_block(base,'input','config'))
            save_block(base,b'CBA1binary',stats,'input','config')
            metadata=json.loads(base.with_suffix('.json').read_text())
            metadata['stats']['records']=2;save_json(base.with_suffix('.json'),metadata)
            self.assertIsNone(cached_block(base,'input','config'))

    def test_promotion_validates_before_replacement_and_rolls_back(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);target=root/'city';staging=root/'staging'
            target.mkdir();(target/'data').write_text('old')
            staging.mkdir();(staging/'data').write_text('new')
            def fail(_):raise ValueError('bad staging')
            with self.assertRaises(ValueError):publish_city(staging,target,fail)
            self.assertEqual((target/'data').read_text(),'old')
            original=Path.rename
            def rename(path,destination):
                if path==staging:raise OSError('injected failure after backup rename')
                return original(path,destination)
            with patch.object(Path,'rename',rename):
                with self.assertRaises(OSError):publish_city(staging,target,lambda _:None)
            self.assertEqual((target/'data').read_text(),'old')
            publish_city(staging,target,lambda _:None)
            self.assertEqual((target/'data').read_text(),'new')
            self.assertFalse((root/'city.previous').exists())

    def test_recovery_after_process_interruption(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);target=root/'city';backup=root/'city.previous'
            backup.mkdir();(backup/'data').write_text('old')
            recover_publication(target,lambda _:None)
            self.assertEqual((target/'data').read_text(),'old')
            target.rename(backup);target.mkdir();(target/'data').write_text('incomplete')
            def fail(_):raise ValueError('invalid target')
            recover_publication(target,fail)
            self.assertEqual((target/'data').read_text(),'old')

    def test_publication_validator_detects_corruption(self):
        import gzip,hashlib
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);raw=b'CBA1real';compressed=gzip.compress(raw,mtime=0)
            (root/'pack.bin.gz').write_bytes(compressed)
            (root/'attrs.json.gz').write_bytes(gzip.compress(b'[{"source_row":0}]',mtime=0))
            config={'format':'CBA1','source_records':1,'tiles':[{'id':'0','n':1,'pack':'pack.bin.gz',
                'offset':0,'length':len(raw),'attrs':'attrs.json.gz'}],
                'packs':[{'file':'pack.bin.gz','bytes':len(compressed),'uncompressed_bytes':len(raw),
                    'sha256':hashlib.sha256(compressed).hexdigest()}]}
            save_json(root/'city.json',config);validate_city(root)
            (root/'pack.bin.gz').write_bytes(b'broken')
            with self.assertRaises(ValueError):validate_city(root)

if __name__=='__main__':unittest.main()

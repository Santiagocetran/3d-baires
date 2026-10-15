import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from core import parse_height, smp_key, match_address, frontage_numbers

class ParsingTests(unittest.TestCase):
    def test_frontage_multiple_doors_and_sentinels(self):
        self.assertEqual(frontage_numbers('1474.1474A.N'), ['1474', '1474A'])
        self.assertEqual(frontage_numbers('N'), [])
    def test_decimal_and_unknown(self):
        self.assertEqual(parse_height(' 12,5 '), (12.5, 'valid'))
        self.assertEqual(parse_height(None), (None, 'missing'))
        self.assertEqual(parse_height('2d8'), (None, 'unparseable'))
        self.assertEqual(parse_height(True), (None, 'unparseable'))
    def test_suspicious_values_preserved(self):
        self.assertEqual(parse_height('-2'), (-2, 'negative'))
        self.assertEqual(parse_height('0'), (0, 'zero'))
        self.assertEqual(parse_height('999'), (999, 'implausible'))
    def test_identifiers_are_not_numbers(self):
        self.assertNotEqual(smp_key('087-006A-015'), smp_key('87-006A-015'))
        self.assertNotEqual(smp_key('01-a-1'), smp_key('01-A-1'))
    def test_ambiguous_parcel_never_unique(self):
        self.assertEqual(match_address('x', {'x': 2}, {'x': {'Defensa 1'}})[0], 'parcel_ambiguous')
        self.assertEqual(match_address('x', {'x': 1}, {'x': {'Defensa 1', 'Chile 2'}})[0], 'parcel_address_multiple')
        self.assertEqual(match_address('', {'': 1}, {'': {'bad'}}), ('parcel_unmatched', []))

if __name__ == '__main__':
    unittest.main()

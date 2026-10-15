import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from core import canonical_smp
from pyproj import Transformer
from shapely.geometry import Polygon, Point

class SpatialTests(unittest.TestCase):
    def test_section_normalization_only(self):
        self.assertEqual(canonical_smp('87-006A-015'),'087-006A-015')
        self.assertEqual(canonical_smp('087 - 006A - 015'),'087-006A-015')
        self.assertNotEqual(canonical_smp('4-027-024a'),canonical_smp('004-027-024A'))
        self.assertNotEqual(canonical_smp('4-27-024a'),canonical_smp('004-027-024a'))
    def test_coordinate_axis_control(self):
        t=Transformer.from_crs('EPSG:3857','EPSG:4326',always_xy=True)
        lon,lat=t.transform(-6498807.849,-4106515.032)
        self.assertAlmostEqual(lon,-58.38,places=3)
        self.assertAlmostEqual(lat,-34.58,places=1)
    def test_hole_is_not_a_building(self):
        g=Polygon([(0,0),(3,0),(3,3),(0,3)],holes=[[(1,1),(2,1),(2,2),(1,2)]])
        self.assertFalse(g.covers(Point(1.5,1.5)))
        self.assertTrue(g.covers(g.representative_point()))

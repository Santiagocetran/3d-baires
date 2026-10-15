import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from landmark_stadiums import SELECTED, stadium_points

class StadiumPointsTests(unittest.TestCase):
    def fixture(self):
        return {'type':'FeatureCollection','crs':{'properties':{'name':'urn:ogc:def:crs:EPSG::9498'}},'features':[{'properties':{'id':i,'nam':str(i),'aso':'Club','dir':'Calle 1','bar':'Barrio'},'geometry':{'type':'Point','coordinates':[29025.85231816901,69190.91611683409]}} for i in SELECTED]}
    def test_projected_boca_point_axis_order_and_original_are_preserved(self):
        raw=self.fixture();original=copy.deepcopy(raw);points=stadium_points(raw);boca=points[0]
        self.assertEqual(boca['id'],'bombonera');self.assertEqual(boca['source_id'],103)
        self.assertAlmostEqual(boca['coordinates'][0],-58.36487075,places=6)
        self.assertAlmostEqual(boca['coordinates'][1],-34.63652603,places=6)
        self.assertEqual(boca['original_coordinates'],raw['features'][0]['geometry']['coordinates'])
        self.assertEqual(raw,original)
    def test_changed_crs_missing_ids_duplicates_and_bad_coordinates_fail(self):
        cases=[]
        raw=self.fixture();raw['crs']['properties']['name']='EPSG:4326';cases.append(raw)
        raw=self.fixture();raw['features'].pop();cases.append(raw)
        raw=self.fixture();raw['features'].append(raw['features'][0]);cases.append(raw)
        for xy in [[float('nan'),1],[-58.36,-34.63],[1],[69190.91611683409,29025.85231816901]]:
            raw=self.fixture();raw['features'][0]['geometry']['coordinates']=xy;cases.append(raw)
        for raw in cases:
            with self.subTest(raw=raw),self.assertRaises(ValueError):stadium_points(raw)

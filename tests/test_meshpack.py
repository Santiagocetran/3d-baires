import sys,unittest,struct
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from meshpack import local,ORIGIN,pack_tile

class MeshPackTests(unittest.TestCase):
    def test_projection_roundtrip_matches_mercator_not_mean_earth_radius(self):
        pts=np.array([ORIGIN,(-58.53,-34.70),(-58.34,-34.54)])
        xy=local(pts)
        from meshpack import COS
        for (lon,lat),(x,z) in zip(pts,xy):
            expected_x=(lon+180)/360
            origin_x=(ORIGIN[0]+180)/360
            self.assertAlmostEqual(origin_x+x/(2*np.pi*6378137*COS),expected_x,places=12)
            expected_y=(1-np.arcsinh(np.tan(np.radians(lat)))/np.pi)/2
            origin_y=(1-np.arcsinh(np.tan(np.radians(ORIGIN[1])))/np.pi)/2
            self.assertAlmostEqual(origin_y+z/(2*np.pi*6378137*COS),expected_y,places=12)
    def test_unknown_height_preserved_and_small_polygon_retained(self):
        x,y=ORIGIN
        geom={'type':'MultiPolygon','coordinates':[[[[x,y],[x+.000001,y],[x+.000001,y+.000001],[x,y+.000001],[x,y]]]]}
        props={'source_row':7,'source_id':'original','height':None,'height_raw':830,'height_status':'implausible','construction_year':None}
        blob,attrs,stats=pack_tile([{'geometry':geom,'properties':props}],np.array([0,0]))
        self.assertEqual(stats['records'],1);self.assertEqual(stats['parts'],1)
        self.assertTrue(np.isnan(struct.unpack_from('<f',blob,32)[0]))
        self.assertEqual(attrs[0]['height_raw'],830)
        self.assertEqual(attrs[0]['height'],None)

if __name__=='__main__':unittest.main()

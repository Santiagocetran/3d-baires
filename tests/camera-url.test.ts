import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cameraURL,DEFAULT_CAMERA,readCamera} from '../src/camera-url';
test('restaura valores válidos y capa',()=>assert.deepEqual(readCamera('?lng=-58.4&lat=-34.6&zoom=12&pitch=20&bearing=90&mode=year'),{lng:-58.4,lat:-34.6,zoom:12,pitch:20,bearing:90,mode:'year'}));
test('acota valores y descarta vacíos o no finitos',()=>assert.deepEqual(readCamera('?lng=-70&lat=NaN&zoom=90&pitch=-4&bearing=Infinity&mode=other'),{...DEFAULT_CAMERA,lng:-58.54,zoom:20,pitch:0}));
test('conserva otros parámetros y fragmento al serializar',()=>{const url=cameraURL('https://example.org/?fixture=1#map',DEFAULT_CAMERA);assert.equal(new URL(url).searchParams.get('fixture'),'1');assert.equal(new URL(url).hash,'#map');assert.deepEqual(readCamera(new URL(url).search),DEFAULT_CAMERA)});

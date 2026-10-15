import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Feature,Polygon} from 'geojson';
import {exteriorMask} from '../src/map-scope';
const boundary=JSON.parse(readFileSync('src/assets/caba-boundary.geojson','utf8')) as Feature<Polygon>;
function insideRing([x,y]:number[],ring:number[][]){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside}return inside}
test('exterior mask keeps CABA visible and hides AMBA and river, without altering official boundary',()=>{
 const original=JSON.stringify(boundary),mask=exteriorMask(boundary);
 const masked=(point:number[])=>insideRing(point,mask.geometry.coordinates[0])&&!insideRing(point,mask.geometry.coordinates[1]);
 assert.equal(masked([-58.3817,-34.6036]),false,'Obelisco stays visible');
 assert.equal(masked([-58.421,-34.571]),false,'Palermo stays visible');
 assert.equal(masked([-58.529,-34.574]),true,'San Martín is outside CABA');
 assert.equal(masked([-58.35,-34.55]),true,'Río de la Plata is outside');
 assert.equal(masked([-58.366,-34.664]),true,'Avellaneda is outside');
 assert.equal(JSON.stringify(boundary),original);
 assert.deepEqual(mask.geometry.coordinates[1],boundary.geometry.coordinates[0]);
 const reversed=structuredClone(boundary);reversed.geometry.coordinates[0].reverse();
 assert.deepEqual(exteriorMask(reversed),mask);
});

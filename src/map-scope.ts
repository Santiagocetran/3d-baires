import type {Feature,Polygon} from 'geojson';
// An opaque exterior with CABA as a hole. Internal neighborhood boundaries are
// dissolved offline, avoiding seams between adjacent holes at different zooms.
export function exteriorMask(boundary:Feature<Polygon>):Feature<Polygon>{
  if(boundary.geometry.type!=='Polygon'||!boundary.geometry.coordinates[0]?.length)throw new Error('Límite de CABA incompatible');
  const ring=boundary.geometry.coordinates[0];
  const area=ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1]},0);
  // RFC 7946: exterior counterclockwise, hole clockwise, regardless of input winding.
  const hole=area<0?[...ring]:[...ring].reverse();
  return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[
    [[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],
    hole,
  ]}};
}

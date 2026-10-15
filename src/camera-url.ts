export type CameraState={lng:number;lat:number;zoom:number;pitch:number;bearing:number;mode:'height'|'year'};
export const DEFAULT_CAMERA:CameraState={lng:-58.378,lat:-34.617,zoom:15.1,pitch:52,bearing:-18,mode:'height'};
const ranges={lng:[-58.54,-58.31],lat:[-34.72,-34.52],zoom:[9,20],pitch:[0,70],bearing:[-180,180]} as const;
export function readCamera(search:string):CameraState {
  const params=new URLSearchParams(search),state={...DEFAULT_CAMERA};
  for(const key of Object.keys(ranges) as (keyof typeof ranges)[]){
    const raw=params.get(key);
    if(raw===null||raw.trim()==='')continue;
    const value=Number(raw),[min,max]=ranges[key];
    if(Number.isFinite(value))state[key]=Math.max(min,Math.min(max,value));
  }
  const mode=params.get('mode');if(mode==='height'||mode==='year')state.mode=mode;
  return state;
}
export function cameraURL(href:string,state:CameraState):string {
  const url=new URL(href);
  for(const key of Object.keys(ranges) as (keyof typeof ranges)[])url.searchParams.set(key,String(Number(state[key].toFixed(key==='lng'||key==='lat'?6:2))));
  url.searchParams.set('mode',state.mode);return url.href;
}

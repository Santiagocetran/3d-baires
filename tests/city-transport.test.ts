import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {gzipSync} from 'node:zlib';
import {loadPayload} from '../src/city-transport';
import {validateConfig,type CityConfig} from '../src/city-config';
test('real HTTP gzip file and HTTP Content-Encoding both decode once; failures and abort reject',async()=>{
 const raw=Buffer.from('CBA1payload'),gz=gzipSync(raw);let retries=0;
 const server=createServer((req,res)=>{if(req.url==='/retry'&&retries++<1){res.writeHead(503);res.end();return}if(req.url==='/encoded')res.setHeader('Content-Encoding','gzip');if(req.url==='/404'){res.writeHead(404);res.end();return}res.end(req.url==='/html'?'<html>error':req.url==='/bad'?gz.subarray(0,8):req.url==='/file'||req.url==='/encoded'?gz:raw)});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}`;
 try{for(const p of ['/file','/encoded','/retry'])assert.equal(Buffer.from(await loadPayload(base+p,new AbortController().signal,raw.length,()=>{},raw.length)).toString(),raw.toString());
 for(const p of ['/html','/bad','/404'])await assert.rejects(loadPayload(base+p,new AbortController().signal,raw.length));
 await assert.rejects(loadPayload(base+'/file',AbortSignal.abort(),raw.length));
 await assert.rejects(loadPayload(base+'/file',new AbortController().signal,2));
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
});
test('config enforces unique IDs, exact totals and contiguous pack ranges',()=>{
 const c:CityConfig={origin:[-58,-34],cos_origin:Math.cos(-34*Math.PI/180),max_source_row:1,source_records:1,packs:[{file:'a.gz',bytes:30}],tiles:[{id:'a',origin:[0,0],n:1,pack:'a.gz',offset:0,length:80,attrs:'a.json.gz'}]};
 assert.equal(validateConfig(c).get('a.gz'),80);assert.throws(()=>validateConfig({...c,cos_origin:.8}));assert.throws(()=>validateConfig({...c,source_records:2}));assert.throws(()=>validateConfig({...c,tiles:[{...c.tiles[0],offset:4}]}));assert.throws(()=>validateConfig({...c,packs:[...c.packs,...c.packs]}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { bridge } from './optagBridgeHarness.mjs';

test('OFF returned storage error and success retain Blob, MIME, row and reply contract', async()=>{
 for(const videoOptag2 of [undefined,false,'true',1,null,{}]){
 const f=await bridge({videoOptag2});try{
 f.upload=async()=>({error:{message:'original error'}});await f.send();
 assert.equal(f.replies[0].error,'Video kunne ikke uploades: original error');assert.equal(f.rows.length,0);
 f.upload=async()=>({});await f.send();assert.equal(f.replies[1].ok,true);assert.equal(f.rows.length,1);
 assert.equal(f.uploads[0].file,f.message.file);assert.equal(f.uploads[0].options.contentType,'video/mp4');assert.equal(f.preview(),undefined);assert.equal(f.aborts.size,0);
 }finally{f.restore();}}
});

// K-ENTROPI-UDGIVELSE1 fund 3 (deliberate change): the base rejected without any reply,
// leaving the athlete without a terminal answer. OFF now replies once with the error.
test('OFF thrown storage error gives one terminal error reply and cleanup',async()=>{
 // U4 har tændt uploadmodulet; vc_upload_retry_v1 = '0' holder denne prøve på den slukkede vej.
 const f=await bridge({storage:{getItem:key=>key==='vc_upload_retry_v1'?'0':null}});try{f.upload=async()=>{throw Error('base thrown')};await f.send();assert.equal(f.replies.length,1);assert.equal(f.replies[0].ok,false);assert.equal(f.replies[0].error,'Video kunne ikke uploades: base thrown');assert.equal(f.rows.length,0);assert.equal(f.aborts.size,0);}finally{f.restore();}
});

test('ON selection change during compression prevents transport',async()=>{
 const f=await bridge({videoOptag2:true});try{
 f.setRef.current={enabled:true,athleteId:f.athleteRef.current.id,selected:{lift:'squat',load_kg:80}};
 const work=f.send();await f.metadata(5);f.setRef.current={enabled:true,selected:null};await f.finish(5);await work;
 assert.equal(f.uploads.length,0);assert.equal(f.rows.length,0);assert.equal(f.replies[0].ok,false);
 }finally{f.restore();}
});

test('ON immediate abort during lazy module loading prevents DOM and transport',async()=>{
 const f=await bridge({videoOptag2:true});try{const work=f.send();await f.send({type:'test:vc:abort-upload',requestId:'attempt'});await work;assert.equal(f.preview(),undefined);assert.equal(f.uploads.length,0);assert.equal(f.aborts.size,0);}finally{f.restore();}
});

test('OFF with retry ON: thrown transport replies and manual retry keeps path and Blob',async()=>{
 const f=await bridge();try{
 globalThis.localStorage.getItem=()=> '1';let attempts=0;
 f.upload=async()=>{if(++attempts===1)throw Error('offline');return {}};
 await f.send();assert.equal(f.replies[0].ok,false);assert.match(f.replies[0].error,/Prøv igen/);assert.equal(f.rows.length,0);assert.equal(f.aborts.size,0);
 await f.send({...f.message,requestId:'retry'});assert.equal(f.replies[1].ok,true);assert.equal(f.rows.length,1);assert.equal(f.uploads[0].path,f.uploads[1].path);assert.equal(f.uploads[0].file,f.uploads[1].file);
 }finally{f.restore();}
});

test('OFF with retry ON: abort after successful transport cannot save a row',async()=>{
 const f=await bridge();try{
 globalThis.localStorage.getItem=()=> '1';let release;f.upload=()=>new Promise(resolve=>release=resolve);
 const work=f.send();await f.send({type:'test:vc:abort-upload',requestId:'attempt'});release({});await work;
 assert.equal(f.replies[0].aborted,true);assert.equal(f.rows.length,0);assert.equal(f.aborts.size,0);
 }finally{f.restore();}
});

test('OFF with retry ON: duplicate path allows explicit retry after row failure',async()=>{
 const f=await bridge();try{
 globalThis.localStorage.getItem=()=> '1';let uploads=0,saves=0;
 f.upload=async()=>++uploads===1?{}:{error:{statusCode:'409'}};
 f.save=async()=>++saves===1?{error:{message:'synthetic row failure'}}:{data:{id:'saved'}};
 await f.send();assert.equal(f.replies[0].ok,false);await f.send({...f.message,requestId:'retry'});assert.equal(f.replies[1].ok,true);assert.equal(f.rows[0].client_analysis_id,f.rows[1].client_analysis_id);assert.equal(f.uploads[0].path,f.uploads[1].path);
 }finally{f.restore();}
});

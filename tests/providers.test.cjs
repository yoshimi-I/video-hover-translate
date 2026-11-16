const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const file=path.join(__dirname,'../providers.js');const P=fs.existsSync(file)?require(file):{};
const body={text:'Hello world',tokens:['Hello','world'],context:[]};
const result={words:[{i:0,ja:'こんにちは',base:'hello'},{i:1,ja:'世界',base:'world'}],phrases:[],sentence:{ja:'こんにちは、世界'}};
const remote={provider:'openai',apiUrl:'https://api.openai.com/v1/chat/completions',apiKey:'test-key',model:'test-model'};
test('old custom API config remains valid and local Ollama needs no key',()=>{
 assert.equal(typeof P.normalize,'function');
 const legacy=P.normalize({apiUrl:'https://example.execute-api.ap-northeast-1.amazonaws.com/prod/translate',apiKey:'key'});
 assert.equal(legacy.provider,'custom');assert.equal(P.validate(legacy).ok,true);
 const local=P.normalize({provider:'ollama'});assert.equal(P.validate(local).ok,true);assert.equal(local.apiKey,'');
});
test('reject unsafe protocols, URL credentials, remote HTTP and missing remote keys',()=>{
 for(const apiUrl of ['http://example.com/v1/chat/completions','file:///tmp/data','https://user:password@example.com/v1/chat/completions','https://example.com/v1/chat/completions?key=secret'])assert.equal(P.validate({...remote,apiUrl}).ok,false,apiUrl);
 assert.equal(P.validate({...remote,apiKey:''}).ok,false);assert.equal(P.validate({...remote,model:''}).ok,false);
 assert.equal(P.validate({...remote,provider:'ollama'}).ok,false);
 assert.equal(P.originPattern('http://localhost:11434/v1/chat/completions'),'http://localhost/*');
});
test('OpenAI-compatible translation uses explicit JSON and keeps keys out of prompts/URL',async()=>{
 let request;const reply=await P.translate(remote,body,{fetch:async(url,options)=>{request={url,...options};return Response.json({choices:[{message:{content:JSON.stringify(result)}}]});}});
 assert.deepEqual(reply,{ok:true,result});assert.equal(request.headers.Authorization,'Bearer test-key');
 const payload=JSON.parse(request.body);assert.equal(payload.model,'test-model');assert.deepEqual(payload.response_format,{type:'json_object'});assert.ok(!request.url.includes('test-key'));assert.ok(!request.body.includes('test-key'));
});
test('local Ollama request never sends a saved cloud key',async()=>{
 let headers;const config=P.normalize({provider:'ollama',apiKey:'do-not-send'});
 const reply=await P.translate(config,body,{fetch:async(_,options)=>{headers=options.headers;return Response.json({choices:[{message:{content:JSON.stringify(result)}}]});}});
 assert.equal(reply.ok,true);assert.ok(!headers.Authorization);
});
test('span translations and fenced JSON are parsed',async()=>{
 const reply=await P.translate(remote,{...body,start:0,end:1},{span:true,fetch:async()=>Response.json({choices:[{message:{content:'```json\n{"ja":"こんにちは、世界"}\n```'}}]})});
 assert.deepEqual(reply,{ok:true,result:{ja:'こんにちは、世界'}});
});
test('malformed, missing and out-of-range token translations are rejected',async()=>{
 for(const value of ['not JSON',JSON.stringify({...result,words:result.words.slice(1)}),JSON.stringify({...result,words:[{i:99,ja:'x',base:'x'},result.words[1]]})]){
  const reply=await P.translate(remote,body,{fetch:async()=>Response.json({choices:[{message:{content:value}}]})});assert.equal(reply.ok,false);
 }
});
test('authentication and network errors are actionable and 429 is retried only once',async()=>{
 assert.deepEqual(await P.translate(remote,body,{fetch:async()=>new Response('',{status:401})}),{ok:false,error:'forbidden'});
 assert.deepEqual(await P.translate(remote,body,{fetch:async()=>{throw Error('private detail');}}),{ok:false,error:'network'});
 let calls=0;const reply=await P.translate(remote,body,{sleep:async()=>{},fetch:async()=>{calls++;return new Response('',{status:429});}});
 assert.equal(calls,2);assert.deepEqual(reply,{ok:false,error:'throttled'});
});
test('cache namespace separates provider/model/endpoint and never contains a key',()=>{
 assert.notEqual(P.cacheNamespace(remote),P.cacheNamespace({...remote,model:'other'}));assert.notEqual(P.cacheNamespace(remote),P.cacheNamespace({...remote,apiUrl:'https://other.invalid/v1/chat/completions'}));assert.ok(!P.cacheNamespace(remote).includes('test-key'));
});

const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');const {webcrypto}=require('node:crypto');
test('actual service worker loads its local modules and serializes quiz messages',async()=>{
 const root=path.join(__dirname,'..');let data={},listener;
 const event={addListener(){}};
 const local={get:async()=>{await new Promise(r=>setImmediate(r));return structuredClone(data);},set:async value=>{await new Promise(r=>setImmediate(r));Object.assign(data,value);},remove:async()=>{}};
 const context=vm.createContext({console,fetch,crypto:webcrypto,TextEncoder,TextDecoder,URL,setTimeout,clearTimeout,setInterval,clearInterval,
 chrome:{storage:{local,session:local},runtime:{onInstalled:event,onStartup:event,onMessage:{addListener:fn=>listener=fn}},tabs:{onRemoved:event},sidePanel:{setPanelBehavior:async()=>{}},action:{setBadgeText:async()=>{}}},
 importScripts:(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}
 });
 vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context,{filename:'sw.js'});
 const send=(key,correct)=>new Promise(resolve=>{assert.equal(listener({type:'studyAnswer',key,correct},{},resolve),true);});
 const replies=await Promise.all([send('w:hello',true),send('w:hello',false)]);
 assert.ok(replies.every(reply=>reply.ok));assert.equal(data['study-progress-v1']['w:hello'].attempts,2);
 assert.equal(data['study-progress-v1']['w:hello'].correct,1);
 const invalid=await send('__proto__',true);assert.equal(invalid.ok,false);
});
test('worker translates through configured engines, isolates caches, and always performs a fresh connection test',async()=>{
 const root=path.join(__dirname,'..');let listener,calls=0;const data={provider:'openai',apiUrl:'https://api.example.invalid/v1/chat/completions',apiKey:'test-key',model:'model-a'};const event={addListener(){}};
 const local={get:async()=>structuredClone(data),set:async value=>Object.assign(data,value),remove:async()=>{}};
 const example={words:[{i:0,ja:'こんにちは',base:'hello'},{i:1,ja:'世界',base:'world'}],phrases:[],sentence:{ja:'こんにちは、世界'}};
 const fetcher=async(url,options)=>{calls++;return Response.json(url.endsWith('/translate')?example:{choices:[{message:{content:JSON.stringify(example)}}]});};
 const context=vm.createContext({console,fetch:fetcher,crypto:webcrypto,TextEncoder,TextDecoder,URL,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,chrome:{storage:{local,session:local},runtime:{onInstalled:event,onStartup:event,onMessage:{addListener:fn=>listener=fn}},tabs:{onRemoved:event},sidePanel:{setPanelBehavior:async()=>{}},action:{setBadgeText:async()=>{}}},importScripts:(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}});
 vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
 const send=message=>new Promise(resolve=>listener(message,{},resolve));
 const cue={type:'translate',text:'Hello world',tokens:['Hello','world'],context:[]};
 assert.equal((await send(cue)).ok,true);assert.equal((await send(cue)).ok,true);assert.equal(calls,1);
 data.model='model-b';assert.equal((await send(cue)).ok,true);assert.equal(calls,2);
 assert.equal((await send({type:'testApi'})).ok,true);assert.equal(calls,3);
 data.provider='custom';data.apiUrl='https://example.invalid/prod/translate';data.model='';assert.equal((await send(cue)).ok,true);assert.equal(calls,4);
});

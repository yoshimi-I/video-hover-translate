const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const file=path.join(__dirname,'../study-store.js');const Store=fs.existsSync(file)?require(file):null;
test('simultaneous answers from multiple windows retain every answer',async()=>{
 assert.equal(typeof Store,'function');let data={};
 const kv={get:async()=>{await new Promise(r=>setImmediate(r));return structuredClone(data);},set:async next=>{await new Promise(r=>setImmediate(r));Object.assign(data,next);}};
 const store=new Store(kv,()=>123);
 await Promise.all([store.record('w:hello',true),store.record('w:world',false),store.record('w:hello',false)]);
 assert.equal(data['study-progress-v1']['w:hello'].attempts,2);assert.equal(data['study-progress-v1']['w:hello'].correct,1);assert.equal(data['study-progress-v1']['w:world'].attempts,1);
});
test('failed storage writes are reported and do not poison later answers; invalid messages are rejected',async()=>{
 let fail=true,data={};const kv={get:async()=>structuredClone(data),set:async next=>{if(fail)throw Error('quota');Object.assign(data,next);}};
 const store=new Store(kv);
 await assert.rejects(store.record('w:hello',true));fail=false;await store.record('w:hello',true);assert.equal(data['study-progress-v1']['w:hello'].attempts,1);
 await assert.rejects(store.record('__proto__',true));await assert.rejects(store.record('w:hello','yes'));
});

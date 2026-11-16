const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const history=[
 {kind:'word',headword:'hello',ja:'こんにちは',sentence:'Hello again',title:'Movie A',at:1},
 {kind:'word',headword:'hello',ja:'やあ',sentence:'Hello again',title:'Movie B',at:5},
 {kind:'word',headword:'world',ja:'世界',sentence:'The world',title:'Movie A',at:2},
 {kind:'phrase',headword:'look up',ja:'調べる',sentence:'Look it up',title:'Movie A',at:3},
 {kind:'span',headword:'take a break',ja:'休憩する',sentence:'Take a break',title:'Movie B',at:4}
];
let browser;
before(async()=>{browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true});});
after(async()=>{await browser?.close();});
async function mount(saved={lookups:history}) {
 const page=await browser.newPage({viewport:{width:360,height:1000},acceptDownloads:true});
 page.setDefaultTimeout(4000);
 await page.setContent(fs.readFileSync(path.join(root,'sidepanel.html'),'utf8'));
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'sidepanel.css'),'utf8')});
 await page.evaluate(saved=>{
  window.stored={...saved,apiUrl:'https://private.invalid/translate',apiKey:'PRIVATE_TEST_KEY'};
  const listeners=[];const event={addListener(){}};
  window.chrome={runtime:{sendMessage:async msg=>{try{return {ok:true,review:await reviewStore.record(msg.key,msg.correct)};}catch{return {ok:false,error:'storage'};}}},storage:{local:{get:async()=>structuredClone(stored),set:async updates=>{const changes={};for(const [key,value] of Object.entries(updates)){changes[key]={newValue:value,oldValue:stored[key]};stored[key]=value;}for(const fn of listeners)fn(changes,'local');}},sync:{get:async defaults=>defaults},session:{get:async()=>({})},onChanged:{addListener:fn=>listeners.push(fn)}},tabs:{query:async()=>[],onUpdated:event,onActivated:event}};
 },saved);
 for(const name of ['data/vocab-levels.js','providers.js','study-core.js','study-store.js','sidepanel.js','study-ui.js']) {
  const file=path.join(root,name);if(fs.existsSync(file))await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
 }
 await page.evaluate(()=>{window.reviewStore=new VHTReviewStore(chrome.storage.local);});
 await page.waitForFunction(()=>document.body.dataset.ready==='1');
 return page;
}
test('persistent library works without a playback tab, filters, and survives settings navigation',async()=>{
 const page=await mount();
 try{
  await page.getByRole('button',{name:'単語帳・クイズ',exact:true}).click();
  await page.waitForSelector('#library-list .library-item');
  assert.equal(await page.locator('#library-list .library-item').count(),4);
  await page.locator('#library-search').fill('調べ');
  assert.equal(await page.locator('#library-list .library-item').count(),1);
  await page.getByRole('button',{name:'設定',exact:true}).click();
  await page.locator('#close-settings').click();
  assert.equal(await page.locator('#view-study').isVisible(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }finally{await page.close();}
});
test('quiz records an answer once, reveals context after answering, and supports mistake-only review',async()=>{
 const page=await mount();
 try{
  await page.locator('#show-study').click();await page.locator('#start-quiz').click();
  await page.waitForSelector('#quiz-options button');
  const word=await page.locator('#quiz-word').textContent();
  const answer=({hello:'やあ',world:'世界','look up':'調べる','take a break':'休憩する'})[word];
  const options=page.locator('#quiz-options button');
  const texts=await options.allTextContents();
  await options.nth(texts.findIndex(value=>value!==answer)).click();
  await page.waitForFunction(()=>Object.keys(stored['study-progress-v1']??{}).length===1);
  assert.ok((await page.locator('#quiz-feedback').textContent()).includes(answer));
  assert.equal(await page.locator('#quiz-context').isVisible(),true);
  assert.equal(await page.locator('#quiz-options button:enabled').count(),0);
  const progress=await page.evaluate(()=>stored['study-progress-v1']);
  assert.equal(Object.values(progress)[0].attempts,1);
  await page.locator('#finish-quiz').click();
  await page.locator('#mistakes-only').check();await page.locator('#start-quiz').click();
  assert.equal(await page.locator('#quiz-word').textContent(),word);
  await page.locator('#quiz-options').getByRole('button',{name:answer,exact:true}).click();
  await page.waitForFunction(()=>Object.values(stored['study-progress-v1'])[0].attempts===2);
  await page.locator('#next-question').click();
  assert.ok((await page.locator('#quiz-summary').textContent()).includes('1 / 1'));
 }finally{await page.close();}
});
test('actual JSON and CSV downloads export filtered vocabulary without API credentials',async()=>{
 const page=await mount();
 try{
  await page.locator('#show-study').click();
  await page.waitForSelector('#library-list .library-item');
  await page.locator('#library-search').fill('hello');
  for(const format of ['json','csv','anki']) {
   await page.locator('#export-format').selectOption(format);
   const downloadPromise=page.waitForEvent('download');await page.locator('#export-vocabulary').click();
   const download=await downloadPromise;const data=fs.readFileSync(await download.path(),'utf8');
   assert.ok(data.includes('hello'));assert.ok(data.includes('やあ'));assert.ok(!data.includes('PRIVATE_TEST_KEY'));assert.ok(!data.includes('private.invalid'));assert.ok(!data.includes('world'));
   if(format==='json')assert.equal(JSON.parse(data).words.length,1);
   if(format==='csv')assert.equal(data.charCodeAt(0),0xFEFF);
  }
 }finally{await page.close();}
});
test('empty history explains how to add words and disables export/quiz',async()=>{
 const page=await mount({lookups:[]});
 try{await page.locator('#show-study').click();await page.waitForFunction(()=>document.querySelector('#library-empty')?.textContent.includes('ホバー'));assert.equal(await page.locator('#start-quiz').isDisabled(),true);assert.equal(await page.locator('#export-vocabulary').isDisabled(),true);}finally{await page.close();}
});
test('one saved word uses a self-rated flashcard and renders subtitle text safely',async()=>{
 const page=await mount({lookups:[{kind:'word',headword:'<img src=x onerror=alert(1)>',ja:'意味',sentence:'Example',at:1}]});
 try{
  await page.locator('#show-study').click();await page.locator('#start-quiz').click();
  await page.locator('#reveal-answer').click();assert.ok((await page.locator('#quiz-feedback').textContent()).includes('意味'));
  await page.locator('#remembered').click();await page.waitForFunction(()=>Object.values(stored['study-progress-v1']??{}).some(r=>r.correct===1));
  assert.equal(await page.locator('#quiz-word img').count(),0);
 }finally{await page.close();}
});
test('quiz does not claim that an answer was saved after storage failure',async()=>{
 const page=await mount({lookups:history.slice(0,1)});
 try{
  await page.evaluate(()=>{chrome.storage.local.set=async()=>{throw Error('quota');};});
  await page.locator('#show-study').click();await page.locator('#start-quiz').click();await page.locator('#reveal-answer').click();await page.locator('#remembered').click();
  await page.waitForFunction(()=>document.querySelector('#quiz-feedback').textContent.includes('保存に失敗'));
  await page.locator('#next-question').click();
  const summary=await page.locator('#quiz-summary').textContent();assert.ok(summary.includes('保存できなかった回答が1件'));assert.ok(!summary.includes('回答を記録しました'));
 }finally{await page.close();}
});
test('sample demo works without a key, saves no answers, and restores real history when closed',async()=>{
 const p=await mount({lookups:history});
 try{
  await p.locator('#show-study').click();await p.locator('#load-demo').click();await p.locator('#start-quiz').click();
  const word=await p.locator('#quiz-word').textContent();assert.ok(word);await p.locator('#quiz-options button').first().click();await p.locator('#finish-quiz').click();
  assert.equal(await p.evaluate(()=>stored['study-progress-v1']),undefined);assert.ok((await p.locator('#quiz-summary').textContent()).includes('保存しません'));
  await p.locator('#exit-demo').click();await p.waitForFunction(()=>document.querySelector('#library-count').textContent.includes('全4語'));assert.equal(await p.evaluate(()=>stored.lookups.length),history.length);
 }finally{await p.close();}
});
test('today review excludes future cards and includes legacy unscheduled history',async()=>{
 const p=await mount({lookups:history,'study-progress-v1':{'w:hello':{attempts:1,correct:1,lastCorrect:true,lastReviewedAt:Date.now(),dueAt:Date.now()+86400000,streak:1,intervalDays:1}}});
 try{await p.locator('#show-study').click();await p.locator('#review-mode').selectOption('due');await p.locator('#start-quiz').click();assert.ok((await p.locator('#quiz-position').textContent()).includes('/ 3問'));}finally{await p.close();}
});
test('leaving demo disables quiz and export until real storage has finished loading',async()=>{
 const p=await mount({lookups:history});
 try{
  await p.locator('#show-study').click();await p.locator('#load-demo').click();
  await p.evaluate(()=>{const previous=chrome.storage.local.get;chrome.storage.local.get=async keys=>{if(Array.isArray(keys)&&keys.includes('lookups'))await new Promise(resolve=>window.releaseRealHistory=resolve);return previous(keys);};});
  await p.locator('#exit-demo').click();assert.equal(await p.locator('#start-quiz').isDisabled(),true);assert.equal(await p.locator('#export-vocabulary').isDisabled(),true);
  await p.evaluate(()=>releaseRealHistory());await p.waitForFunction(()=>document.querySelector('#library-count').textContent.includes('全4語'));assert.equal(await p.locator('#start-quiz').isEnabled(),true);
  assert.equal(await p.evaluate(()=>stored['study-progress-v1']),undefined);
 }finally{await p.close();}
});

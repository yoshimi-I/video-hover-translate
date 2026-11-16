const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const content = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8');
const support = content.slice(content.indexOf('  // src/content/page-title.ts'), content.indexOf('  // src/content/main.ts'));
let browser;
before(async () => { browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: 'chrome' }), headless: true }); });
after(async () => { await browser?.close(); });
async function fixture(html, fn) {
  const page = await browser.newPage();
  try {
    await page.setContent(html);
    await page.addScriptTag({ content: support });
    await fn(page);
  } finally { await page.close(); }
}
test('Netflix watch pages and Disney+ play pages are recognized, other URLs rejected', () => {
  const ctx = { URL };
  vm.runInNewContext(panel.slice(panel.indexOf('  function isPlayPage'), panel.indexOf('  function fixedTabId')), ctx);
  for (const url of ['https://www.netflix.com/watch/81234567?trackId=1','https://www.disneyplus.com/en-gb/play/123']) assert.equal(ctx.isPlayPage(url), true, url);
  for (const url of ['https://www.netflix.com/browse','https://www.netflix.com/title/123','https://www.netflix.com.evil.test/watch/123','https://www.disneyplus.com/home','garbage',undefined]) assert.equal(ctx.isPlayPage(url), false, String(url));
});
test('both title helpers remove Netflix and Disney+ suffixes', () => {
  for (const code of [content, panel]) {
    const ctx = {};
    const start = code.indexOf('  function pageTitle');
    vm.runInNewContext(code.slice(start,code.indexOf('\n  }',start)+4),ctx);
    assert.equal(ctx.pageTitle('Example | Netflix'),'Example');
    assert.equal(ctx.pageTitle('Example | Disney+'),'Example');
    assert.equal(ctx.pageTitle('Example'),'Example');
  }
});
test('manifest injects into Netflix and Disney+ with matching host permissions', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  for (const host of ['https://www.netflix.com/*','https://www.disneyplus.com/*']) {
    assert.ok(m.host_permissions.includes(host),host);
    assert.ok(m.content_scripts.some(c=>c.matches.includes(host)),host);
  }
});
test('Netflix multi-speaker subtitles update, clear, and survive replacement; stop restores originals',async()=>{
  await fixture('<div class="player-timedtext"><div class="player-timedtext-text-container"><span>Hello<br>world</span></div><div class="player-timedtext-text-container"><span>Goodbye</span></div></div>',async page=>{
    await page.evaluate(()=>{window.cues=[];window.source=new SubtitleSource(lines=>cues.push(lines));source.tick();});
    assert.deepEqual(await page.evaluate(()=>cues),[['Hello','world','Goodbye']]);
    assert.equal(await page.locator('.player-timedtext').evaluate(el=>el.style.visibility),'hidden');
    await page.locator('.player-timedtext').evaluate(el=>el.replaceChildren());
    await page.waitForFunction(()=>cues.at(-1)===null);
    await page.locator('.player-timedtext').evaluate(el=>el.outerHTML='<div class="player-timedtext"><div class="player-timedtext-text-container"><span>Next cue</span></div></div>');
    await page.evaluate(()=>source.tick());
    assert.deepEqual(await page.evaluate(()=>cues.at(-1)),['Next cue']);
    await page.evaluate(()=>source.stop());
    assert.equal(await page.locator('.player-timedtext').evaluate(el=>el.style.visibility),'');
  });
});
test('unreadable Netflix image captions stay visible',async()=>{
  await fixture('<div class="player-timedtext"><svg><image href="data:," /></svg></div>',async page=>{
    const state=await page.evaluate(()=>{const cues=[];const s=new SubtitleSource(c=>cues.push(c));s.tick();return {cues,visibility:document.querySelector('.player-timedtext').style.visibility};});
    assert.deepEqual(state,{cues:[],visibility:''});
  });
});
test('Disney+ subtitles in shadow DOM still work',async()=>{
  await fixture('<disney-web-player></disney-web-player>',async page=>{
    const cues=await page.evaluate(()=>{document.querySelector('disney-web-player').attachShadow({mode:'open'}).innerHTML='<div class="hive-subtitle-renderer-wrapper"><div class="hive-subtitle-renderer-line">Hello Disney</div></div>';const cues=[];new SubtitleSource(c=>cues.push(c)).tick();return cues;});
    assert.deepEqual(cues,[['Hello Disney']]);
  });
});
test('Netflix pause/resume uses player controls and confirms video events',async()=>{
  await fixture('<video></video><button data-uia="control-play-pause-pause"></button>',async page=>{
    const result=await page.evaluate(async()=>{const video=document.querySelector('video');let paused=false;Object.defineProperty(video,'paused',{get:()=>paused});const button=document.querySelector('button');button.onclick=()=>{paused=!paused;button.dataset.uia=paused?'control-play-pause-play':'control-play-pause-pause';video.dispatchEvent(new Event(paused?'pause':'play'));};const first=await setPaused(video,true);const second=await setPaused(video,false);button.disabled=true;return {first,second,paused,disabled:await setPaused(video,true)};});
    assert.deepEqual(result,{first:true,second:true,paused:false,disabled:false});
  });
});
test('Netflix subtitles reach translation and display Japanese on hover through the full content script',async()=>{
  const page=await browser.newPage();
  try {
    await page.setContent('<video style="width:800px;height:500px"></video><div class="player-timedtext"><div class="player-timedtext-text-container"><span>Hello world</span></div></div>');
    await page.evaluate(()=>{window.messages=[];window.chrome={runtime:{id:'fixture',onMessage:{addListener(){}},sendMessage:async msg=>{messages.push(msg);return {ok:true,result:{words:[{i:0,ja:'こんにちは',base:'hello'},{i:1,ja:'世界',base:'world'}],phrases:[],sentence:{ja:'こんにちは、世界'}}};}},storage:{sync:{get:async defaults=>({...defaults,pauseOnHover:false})},onChanged:{addListener(){}}}};});
    await page.addScriptTag({content});
    await page.locator('#dht-overlay-host [data-token="0"]').hover();
    await page.waitForFunction(()=>document.querySelector('#dht-overlay-host').shadowRoot.querySelector('.popup').textContent.includes('こんにちは'));
    const request=await page.evaluate(()=>messages.find(m=>m.type==='translate'));
    assert.equal(request.text,'Hello world');
    assert.deepEqual(request.tokens,['Hello','world']);
  } finally {await page.close();}
});
test('Netflix browse trailers stay untouched; SPA navigation starts and stops translation',async()=>{
  const page=await browser.newPage();
  try {
    await page.route('https://www.netflix.com/**',route=>route.fulfill({contentType:'text/html',body:'<video style="width:800px;height:500px"></video><div class="player-timedtext"><span>Hello world</span></div>'}));
    await page.goto('https://www.netflix.com/browse');
    await page.evaluate(()=>{window.messages=[];window.chrome={runtime:{id:'fixture',onMessage:{addListener(){}},sendMessage:async msg=>{messages.push(msg);return {ok:false,error:'not-configured'};}},storage:{sync:{get:async defaults=>defaults},onChanged:{addListener(){}}}};});
    await page.addScriptTag({content});
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#dht-overlay-host').count(),0);
    assert.equal(await page.evaluate(()=>messages.some(m=>m.type==='translate')),false);
    await page.evaluate(()=>history.pushState({},'', '/watch/81234567'));
    await page.waitForSelector('#dht-overlay-host');
    assert.equal(await page.locator('.player-timedtext').evaluate(el=>el.style.visibility),'hidden');
    await page.evaluate(()=>history.pushState({},'', '/browse'));
    await page.waitForSelector('#dht-overlay-host',{state:'detached'});
    assert.equal(await page.locator('.player-timedtext').evaluate(el=>el.style.visibility),'');
  } finally { await page.close(); }
});
test('connection check distinguishes missing captions from translated captions without exposing subtitle text',async()=>{
  const page=await browser.newPage();
  try {
    await page.setContent('<video style="width:800px;height:500px"></video>');
    await page.evaluate(()=>{window.chrome={runtime:{id:'fixture',onMessage:{addListener:fn=>window.receive=fn},sendMessage:async()=>({ok:false,error:'forbidden'})},storage:{sync:{get:async defaults=>defaults},onChanged:{addListener(){}}}};});
    await page.addScriptTag({content});
    await page.waitForSelector('#dht-overlay-host');
    const before=await page.evaluate(()=>{let state;receive({type:'diagnose'}, {},reply=>state=reply);return state;});
    assert.equal(before.subtitlesReadable,false);
    assert.equal(before.videoFound,true);
    await page.evaluate(()=>{const el=document.createElement('div');el.className='player-timedtext';el.textContent='A private subtitle';document.body.appendChild(el);});
    await page.waitForSelector('#dht-overlay-host [data-token]');
    const after=await page.evaluate(()=>{let state;receive({type:'diagnose'}, {},reply=>state=reply);return state;});
    assert.equal(after.subtitlesReadable,true);
    assert.equal(after.translationError,'forbidden');
    assert.equal(after.tokenCount,3);
    assert.equal(JSON.stringify(after).includes('private'),false);
  } finally {await page.close();}
});
test('sidepanel connection check reports a missing content script and API authentication failure',async()=>{
  const page=await browser.newPage();
  try {
    await page.setContent(fs.readFileSync(path.join(root,'sidepanel.html'),'utf8'));
    await page.evaluate(()=>{
      const event={addListener(){}};
      window.chrome={storage:{sync:{get:async defaults=>defaults},local:{get:async()=>({apiUrl:'https://example.invalid/translate',apiKey:'test-key'})},session:{get:async()=>({})},onChanged:event},tabs:{query:async()=>[{id:1,url:'https://www.netflix.com/watch/123',title:'Movie | Netflix'}],onActivated:event,onUpdated:event,sendMessage:async()=>{throw Error('Receiving end does not exist');}}};
    });
    await page.addScriptTag({content:panel});
    await page.waitForFunction(()=>document.body.dataset.ready==='1');
    await page.locator('#check-connection').click();
    await page.waitForFunction(()=>document.querySelector('#connection-status').textContent.includes('ページ上の拡張に接続できません'));
    await page.evaluate(()=>{chrome.tabs.sendMessage=async()=>({version:'0.3.1',enabled:true,videoFound:true,subtitlesReadable:true,netflixContainers:2,tokenCount:3,pointerReachable:false,translationState:'error',translationError:'forbidden'});});
    await page.locator('#check-connection').click();
    await page.waitForFunction(()=>document.querySelector('#connection-status').textContent.includes('API認証エラー（403）'));
    const message=await page.locator('#connection-status').textContent();
    assert.ok(message.includes('他の要素に遮られています'));
    assert.ok(!message.includes('test-key'));
  } finally {await page.close();}
});
test('native captions remain hidden when Netflix rewrites visibility styles or sets child visibility',async()=>{
 await fixture('<div class="player-timedtext"><span style="visibility:visible!important">Hello world</span></div>',async page=>{
  await page.evaluate(()=>{window.source=new SubtitleSource(()=>{});source.tick();});
  const child=page.locator('.player-timedtext span');
  assert.equal(await child.evaluate(el=>getComputedStyle(el.parentElement).opacity),'0');
  await page.locator('.player-timedtext').evaluate(el=>el.setAttribute('style','visibility:visible!important'));
  assert.equal(await child.evaluate(el=>getComputedStyle(el.parentElement).opacity),'0');
  await page.evaluate(()=>source.stop());
  assert.equal(await child.evaluate(el=>getComputedStyle(el).visibility),'visible');
 });
});
test('replaced Netflix captions are suppressed before the next animation frame, without a one-second poll gap',async()=>{
 await fixture('<div class="player-timedtext">First subtitle</div>',async page=>{
  const result=await page.evaluate(async()=>{
   const source=new SubtitleSource(()=>{});source.start();
   document.querySelector('.player-timedtext').outerHTML='<div class="player-timedtext">Next subtitle</div>';
   await new Promise(resolve=>requestAnimationFrame(resolve));
   const opacity=getComputedStyle(document.querySelector('.player-timedtext')).opacity;
   source.stop();return opacity;
  });
  assert.equal(result,'0');
 });
});

// Deterministic demo screenshots; no viewing history, credentials or service footage.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true});
 try{
  const page=await browser.newPage({viewport:{width:400,height:930},deviceScaleFactor:1});
  await page.route('https://vht-preview.invalid/**',route=>{const file=path.join(root,new URL(route.request().url()).pathname);if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html>'});});
  await page.goto('https://vht-preview.invalid/');
  await page.setContent(fs.readFileSync(path.join(root,'sidepanel.html'),'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,''));
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'sidepanel.css'),'utf8')});
  await page.evaluate(()=>{Math.random=()=>0.33;const event={addListener(){}};window.chrome={runtime:{sendMessage:async()=>({ok:false})},storage:{local:{get:async()=>({})},sync:{get:async defaults=>defaults},session:{get:async()=>({})},onChanged:event},tabs:{query:async()=>[],onActivated:event,onUpdated:event}};});
  for(const file of ['data/vocab-levels.js','providers.js','study-core.js','sidepanel.js','study-ui.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
  await page.waitForFunction(()=>document.body.dataset.ready==='1');
  await page.locator('#show-study').click();await page.locator('#load-demo').click();
  await page.screenshot({path:path.join(root,'docs/images/library.png')});
  await page.locator('#start-quiz').click();
  await page.locator('#quiz-session').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(root,'docs/images/quiz.png')});
 }finally{await browser.close();}
 console.log('Wrote demo screenshots.');
})().catch(error=>{console.error(error);process.exitCode=1;});

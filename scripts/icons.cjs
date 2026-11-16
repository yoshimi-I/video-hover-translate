// Render the editable SVG into Chrome's required PNG sizes.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
 const root = path.resolve(__dirname, '..');
 const svg = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
 const browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: 'chrome' }), headless: true });
 try {
  for (const size of [16, 32, 48, 128, 512]) {
   const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
   await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
   await page.screenshot({ path: path.join(root, `icons/icon${size}.png`), omitBackground: true });
   await page.close();
  }
 } finally { await browser.close(); }
 console.log('Generated icons at 16, 32, 48, 128 and 512px.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });

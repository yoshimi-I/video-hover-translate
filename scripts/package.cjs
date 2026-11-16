const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('./check.cjs');
const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).version;
const files = ['manifest.json','content.js','sw.js','sidepanel.js','study-core.js','study-ui.js',
  'sidepanel.html','sidepanel.css','icons','data','licenses','LICENSE','README.md','PRIVACY.md',
  'THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','SECURITY.md','docs/API.md'];
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'vht-package-'));
const output = path.join(root, 'dist', `video-hover-translate-${version}.zip`);
try {
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(stage, file)), { recursive: true });
    fs.cpSync(path.join(root, file), path.join(stage, file), { recursive: true });
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.rmSync(output, { force: true });
  try { execFileSync('zip', ['-q', '-r', output, ...files], { cwd: stage, stdio: 'inherit' }); }
  catch (error) { if(error.code === 'ENOENT') throw Error('Packaging requires the zip command (macOS/Linux).'); throw error; }
  console.log(`Created ${output}`);
} finally { fs.rmSync(stage, { recursive: true, force: true }); }

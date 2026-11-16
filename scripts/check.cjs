const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (manifest.manifest_version !== 3 || manifest.version !== pkg.version) throw Error('Manifest/package version mismatch');
const html = fs.readFileSync(path.join(root, manifest.side_panel.default_path), 'utf8');
const referenced = [manifest.background.service_worker, manifest.side_panel.default_path,
  ...manifest.content_scripts.flatMap(script => script.js), ...Object.values(manifest.icons),
  ...[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1])];
for (const file of new Set(referenced)) {
  if (/^(?:[a-z]+:|\/)|\.\./i.test(file)) throw Error(`Expected a local asset: ${file}`);
  if (!fs.existsSync(path.join(root, file))) throw Error(`Missing runtime asset: ${file}`);
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}
for (const file of ['LICENSE','THIRD_PARTY_NOTICES.md','licenses/Zod-MIT.txt','licenses/Lucide-ISC.txt','licenses/CC-BY-SA-4.0.txt']) {
  if (!fs.existsSync(path.join(root,file))) throw Error(`Missing license: ${file}`);
}
console.log(`Runtime assets, syntax, licenses, and version ${manifest.version}: OK`);

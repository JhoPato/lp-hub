const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const EXCLUDE = new Set([
    '.claude',
    'frontend',
    'node_modules',
    'SS-JsonExample',
    'calibrate-minimap.html',
    'CLAUDE.md',
    '_pub.zip',
]);

// Step 1: build (_pub)
console.log('[1/2] Building...');
execSync('node build.js', { stdio: 'inherit' });

// Step 2: zip
const zipPath = path.join(__dirname, '_pub.zip');
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const items = fs.readdirSync(__dirname)
    .filter(f => !EXCLUDE.has(f))
    .map(f => path.join(__dirname, f));

// Use PowerShell Compress-Archive (built-in on Windows)
const pathList = items.map(p => `'${p}'`).join(',');
const cmd = `powershell -NoProfile -Command "Compress-Archive -Path ${pathList} -DestinationPath '${zipPath}'"`;

console.log('[2/2] Zipping...');
execSync(cmd, { stdio: 'inherit' });

console.log(`\nDone → _pub.zip`);

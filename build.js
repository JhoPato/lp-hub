const fs   = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC  = path.join(__dirname, 'frontend');
const DIST = path.join(__dirname, '_pub');

const OBFUSCATE_OPTS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: true,
    shuffleStringArray: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false,
};

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (entry.name.endsWith('.html')) {
            processHtml(srcPath, destPath);
        } else if (entry.name.endsWith('.js')) {
            processJs(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function obfuscate(code, filename) {
    try {
        return JavaScriptObfuscator.obfuscate(code, OBFUSCATE_OPTS).getObfuscatedCode();
    } catch (e) {
        console.warn(`  [warn] could not obfuscate ${filename}: ${e.message} — copying as-is`);
        return code;
    }
}

function processJs(srcPath, destPath) {
    const code = fs.readFileSync(srcPath, 'utf8');
    const out  = obfuscate(code, srcPath);
    fs.writeFileSync(destPath, out, 'utf8');
    console.log(`  [js]   ${path.relative(__dirname, destPath)}`);
}

function processHtml(srcPath, destPath) {
    let html = fs.readFileSync(srcPath, 'utf8');
    let count = 0;

    html = html.replace(
        /(<script(?:\s[^>]*)?>)([\s\S]*?)(<\/script>)/gi,
        (_, open, code, close) => {
            if (/\bsrc\s*=/i.test(open)) return _;
            const trimmed = code.trim();
            if (!trimmed) return _;
            const obf = obfuscate(trimmed, srcPath);
            count++;
            return open + '\n' + obf + '\n' + close;
        }
    );

    fs.writeFileSync(destPath, html, 'utf8');
    console.log(`  [html] ${path.relative(__dirname, destPath)} (${count} script block${count !== 1 ? 's' : ''} obfuscated)`);
}

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
console.log('Building to dist/...');
copyDir(SRC, DIST);
console.log('Done.');

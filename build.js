// Builds Emergence into one self-contained HTML file. No dependencies.
//   node build.js                    → index.html, a complete page that opens in any browser
//   node build.js --fragment <file>  → the same page without <html>/<head>/<body>,
//                                      for hosts that wrap it in their own document
const fs = require('fs'), path = require('path');
const root = __dirname, src = path.join(root, 'src');

const js = ['core', 'ui'].flatMap(d => fs.readdirSync(path.join(src, d)).filter(f => f.endsWith('.js')).sort().map(f => path.join(src, d, f)));
const code = js.map(f => `// ── ${path.basename(f)} ──\n` + fs.readFileSync(f, 'utf8')).join('\n');
const page = fs.readFileSync(path.join(src, 'index.html'), 'utf8').replace('/*__SCRIPT__*/', () => `(function () {\n'use strict';\n${code}\n})();`);

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`wrote ${path.relative(root, file)} (${(Buffer.byteLength(text) / 1024).toFixed(0)} KB)`);
};

const fi = process.argv.indexOf('--fragment');
if (fi >= 0) {
  write(path.resolve(process.argv[fi + 1] || path.join(root, 'dist', 'emergence.html')), page);
} else {
  // src/index.html is <title>, fonts and <style>, then the body markup and the script
  const cut = page.indexOf('</style>') + '</style>'.length;
  const head = fs.readFileSync(path.join(src, 'head.html'), 'utf8');
  write(path.join(root, 'index.html'),
    `<!doctype html>\n<html lang="en">\n<head>\n${head}${page.slice(0, cut)}\n</head>\n<body>\n${page.slice(cut).trim()}\n</body>\n</html>\n`);
}

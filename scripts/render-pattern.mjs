// Renders the Pharaonic background tile (src/theme/pattern.ts) to PNGs for native:
//   node scripts/render-pattern.mjs
// Needs Playwright + Chromium (PLAYWRIGHT_CHROMIUM=/path/to/chromium to override).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'src/theme/pattern.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const tmp = path.join(root, 'node_modules/.cache/pattern.mjs');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, js);
const { patternSvg, PATTERN_SIZE } = await import(pathToFileURL(tmp).href);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/opt/node-tools/node_modules/playwright/index.mjs'));
}
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
for (const scheme of ['light', 'dark']) {
  for (const scale of [1, 2, 3]) {
    const page = await browser.newPage({ viewport: { width: PATTERN_SIZE, height: PATTERN_SIZE }, deviceScaleFactor: scale });
    await page.setContent(`<html><body style="margin:0;background:transparent">${patternSvg(scheme)}</body></html>`);
    const suffix = scale === 1 ? '' : `@${scale}x`;
    await page.screenshot({ path: path.join(root, `assets/images/pattern-${scheme}${suffix}.png`), omitBackground: true, clip: { x: 0, y: 0, width: PATTERN_SIZE, height: PATTERN_SIZE } });
    await page.close();
  }
}
// A 3×3 preview on the app background colours, for reviewing the design.
const page = await browser.newPage({ viewport: { width: 960, height: 480 } });
const tile = (scheme, bg) => `<div style="width:480px;height:480px;background:${bg} url('data:image/svg+xml;utf8,${encodeURIComponent(patternSvg(scheme))}');background-size:${PATTERN_SIZE}px"></div>`;
await page.setContent(`<body style="margin:0;display:flex">${tile('light', '#FBF8F3')}${tile('dark', '#0E1215')}</body>`);
await page.screenshot({ path: path.join(root, 'node_modules/.cache/pattern-preview.png') });
await browser.close();
console.log('rendered');

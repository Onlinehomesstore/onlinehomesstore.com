/**
 * Full A–Z theme package with source↔zip parity check.
 * Packs all Shopify folders; refuses to ship if any theme file is dropped.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const themeRoot = __dirname;
const outDir = path.join(themeRoot, '..');
const outZip = path.join(outDir, 'UNIK CARE.zip');
const staging = path.join(outDir, '_uc_theme_zip_staging');
const keep = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];

const mustHave = [
  'layout/theme.liquid',
  'layout/password.liquid',
  'config/settings_schema.json',
  'config/settings_data.json',
  'templates/index.json',
  'templates/product.json',
  'sections/premium-product-hero.liquid',
  'sections/product-why-us.liquid',
  'sections/product-recently-viewed.liquid',
  'sections/main-product.liquid',
  'sections/pf-quick-view.liquid',
  'templates/collection.json',
  'templates/cart.json',
  'templates/404.json',
  'templates/page.about.json',
  'templates/page.contact.json',
  'templates/page.privacy-policy.json',
  'templates/page.terms-of-service.json',
  'templates/page.refund-policy.json',
  'templates/page.shipping-policy.json',
  'templates/page.cookie-policy.json',
  'templates/page.wishlist.json',
  'templates/gift_card.liquid',
  'templates/search.json',
  'templates/blog.json',
  'templates/article.json',
  'templates/password.json',
  'templates/list-collections.json',
  'sections/uc-legal-page.liquid',
  'sections/header-group.json',
  'sections/footer-group.json',
  'sections/overlay-group.json',
  'sections/uc-editorial-hero.liquid',
  'sections/before-after-comparison.liquid',
  'sections/visible-results.liquid',
  'sections/main-404.liquid',
  'sections/uc-premium-header.liquid',
  'sections/uc-footer.liquid',
  'sections/product-testimonials.liquid',
  'sections/product-faq.liquid',
  'sections/premium-product-showcase.liquid',
  'assets/uc-page-rhythm.css',
  'assets/uc-site-unify.css',
  'assets/uc-editorial-hero.css',
  'assets/uc-editorial-hero.js',
  'assets/uc-premium-header.css',
  'assets/uc-premium-header.js',
  'assets/before-after-comparison.css',
  'assets/before-after-comparison.js',
  'assets/visible-results.css',
  'assets/product-testimonials.css',
  'assets/uc-product-card.css',
  'assets/uc-product-card.js',
  'assets/uc-footer.css',
  'assets/uc-design-tokens.css',
  'assets/uc-perf-responsive.css',
  'assets/uc-mobile-premium.css',
  'assets/base.css',
  'snippets/uc-error-diagnostics.liquid',
  'snippets/uc-design-system.liquid',
  'snippets/uc-product-card.liquid',
  'snippets/card-product.liquid',
  'snippets/uc-section-vars.liquid',
  'locales/en.default.json',
];

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function listFiles(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    // Never drop theme files — only skip junk folders
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.DS_Store') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function countFiles(dir) {
  return listFiles(dir).length;
}

console.log('══════════════════════════════════════════════════');
console.log(' UNIK CARE — FULL A–Z THEME PACKAGE');
console.log('══════════════════════════════════════════════════\n');

console.log('── 1/6 Homepage 404 diagnose');
execFileSync(process.execPath, [path.join(themeRoot, '_diagnose_theme.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 2/6 Strict template validation (all JSON templates)');
execFileSync(process.execPath, [path.join(themeRoot, '_validate_strict.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 2b/6 Sanitize templates for Shopify ZIP upload');
execFileSync(process.execPath, [path.join(themeRoot, '_fix_upload.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});
// Ensure only the default product template exists (Shopify requires templates/product.json)
(() => {
  const tplDir = path.join(themeRoot, 'templates');
  for (const name of fs.readdirSync(tplDir)) {
    if (/^product\..+\.json$/i.test(name)) {
      fs.unlinkSync(path.join(tplDir, name));
      console.log('Removed legacy', name);
    }
  }
  const safePath = path.join(tplDir, 'product.safe.json');
  if (fs.existsSync(safePath)) {
    fs.unlinkSync(safePath);
    console.log('Removed product.safe.json');
  }
})();

console.log('\n── 3/6 Scan locked shopify://shop_images');
execFileSync(process.execPath, [path.join(themeRoot, '_scan_media.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 4/6 Required-file checklist');
const missing = mustHave.filter((rel) => !fs.existsSync(path.join(themeRoot, rel)));
if (missing.length) {
  console.error('MISSING REQUIRED FILES:');
  missing.forEach((m) => console.error('  -', m));
  process.exit(1);
}
console.log('All', mustHave.length, 'critical files present.');

console.log('\n── 5/6 Inventory source theme folders');
const sourceMap = {};
let sourceTotal = 0;
for (const name of keep) {
  const src = path.join(themeRoot, name);
  if (!fs.existsSync(src)) {
    console.error('Missing folder:', name);
    process.exit(1);
  }
  const files = listFiles(src);
  sourceMap[name] = files;
  sourceTotal += files.length;
  console.log('  ·', name.padEnd(12), files.length, 'files');
}
console.log('  TOTAL source:', sourceTotal, 'files');

console.log('\n── 6/6 Pack + parity verify → UNIK CARE.zip');
rimraf(staging);
fs.mkdirSync(staging, { recursive: true });

const stagedAll = [];
for (const name of keep) {
  const src = path.join(themeRoot, name);
  const dest = path.join(staging, name);
  copyDir(src, dest);
  const staged = listFiles(dest).map((f) => name + '/' + f);
  stagedAll.push(...staged);

  const srcRel = sourceMap[name];
  const destRel = listFiles(dest);
  const dropped = srcRel.filter((f) => !destRel.includes(f));
  const extra = destRel.filter((f) => !srcRel.includes(f));
  if (dropped.length || extra.length) {
    console.error('PARITY FAIL in', name);
    dropped.forEach((d) => console.error('  DROPPED', d));
    extra.forEach((e) => console.error('  EXTRA', e));
    process.exit(1);
  }
  console.log('  +', name, '(' + destRel.length + ' files) — parity OK');
}

if (stagedAll.length !== sourceTotal) {
  console.error('Staging count mismatch:', stagedAll.length, 'vs', sourceTotal);
  process.exit(1);
}

if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(themeRoot, '_zip_forwardslash.ps1'),
    '-SourceDir',
    staging,
    '-DestZip',
    outZip,
  ],
  { stdio: 'inherit' }
);

// Verify zip entry count matches source
const zipList = execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${outZip.replace(/'/g, "''")}'); $names=$z.Entries | Where-Object { -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName -replace '\\\\','/' }; $z.Dispose(); $names.Count; ($names | Select-Object -First 3) -join ' | '; if ($names | Where-Object { $_ -match '\\\\' }) { 'HAS_BACKSLASH' } else { 'FORWARD_SLASH_OK' }`,
  ],
  { encoding: 'utf8' }
).trim();

const zipLines = zipList.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const zipCount = parseInt(zipLines[0], 10);
console.log('ZIP entries:', zipCount);
console.log('Sample:', zipLines[1] || '');
console.log(zipLines[2] || '');

if (zipCount !== sourceTotal) {
  console.error('ZIP DROP DETECTED: zip has', zipCount, 'but source has', sourceTotal);
  process.exit(1);
}

rimraf(staging);

const sizeMb = (fs.statSync(outZip).size / 1024 / 1024).toFixed(2);
console.log('\n══════════════════════════════════════════════════');
console.log(' FULL THEME READY — ZERO DROPS');
console.log(' File :', outZip);
console.log(' Size :', sizeMb, 'MB');
console.log(' Files:', sourceTotal, '(source = staging = zip)');
console.log(' Name : UNIK CARE');
console.log('');
console.log(' Shopify Admin → Online Store → Themes');
console.log(' → Add theme → Upload zip file → select UNIK CARE.zip');
console.log(' → Preview → Customize → Publish when ready');
console.log('══════════════════════════════════════════════════');

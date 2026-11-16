/**
 * Build complete Shopify-ready "UNIK CARE.zip"
 * - Validates first (abort on any critical issue)
 * - Packs ONLY Shopify theme folders (no node_modules / docs / _scripts)
 * - Forward-slash zip entries (required by Shopify Admin upload)
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
  'templates/collection.json',
  'templates/cart.json',
  'templates/404.json',
  'templates/page.about.json',
  'templates/page.our-story.json',
  'templates/page.contact.json',
  'templates/page.privacy-policy.json',
  'templates/page.terms-of-service.json',
  'templates/page.refund-policy.json',
  'templates/page.shipping-policy.json',
  'templates/page.cookie-policy.json',
  'templates/page.wishlist.json',
  'sections/uc-legal-page.liquid',
  'assets/uc-page-rhythm.css',
  'templates/gift_card.liquid',
  'sections/header-group.json',
  'sections/footer-group.json',
  'sections/overlay-group.json',
  'sections/uc-editorial-hero.liquid',
  'sections/before-after-comparison.liquid',
  'sections/visible-results.liquid',
  'sections/main-404.liquid',
  'sections/premium-product-hero.liquid',
  'sections/premium-video-reels.liquid',
  'sections/product-ba-slider.liquid',
  'sections/product-how-it-works.liquid',
  'sections/uc-product-reviews.liquid',
  'sections/sticky-atc.liquid',
  'sections/sticky-mobile-atc.liquid',
  'snippets/uc-pph-purchase-panel.liquid',
  'snippets/uc-section-vars.liquid',
  'snippets/uc-section-colors.liquid',
  'snippets/uc-star-rating.liquid',
  'snippets/uc-icon.liquid',
  'assets/premium-product-hero.css',
  'assets/premium-product-hero.js',
  'sections/uc-premium-header.liquid',
  'sections/uc-footer.liquid',
  'assets/uc-editorial-hero.css',
  'assets/uc-editorial-hero.js',
  'assets/uc-premium-header.css',
  'assets/uc-premium-header.js',
  'assets/before-after-comparison.css',
  'assets/before-after-comparison.js',
  'assets/visible-results.css',
  'assets/uc-perf-responsive.css',
  'assets/uc-type-system.css',
  'assets/uc-home-polish-v2.css',
  'assets/uc-facets.css',
  'assets/uc-facets.js',
  'assets/uc-reels-redesign.css',
  'assets/uc-mobile-premium.css',
  'assets/uc-editorial-hero.css',
  'assets/base.css',
  'snippets/uc-error-diagnostics.liquid',
  'snippets/uc-design-system.liquid',
  'locales/en.default.json',
];

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    // Never drop theme files — only skip junk folders/files
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.DS_Store') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function countFiles(dir) {
  let n = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += countFiles(p);
    else n += 1;
  }
  return n;
}

console.log('══════════════════════════════════════════════════');
console.log(' UNIK CARE — full theme package builder');
console.log('══════════════════════════════════════════════════\n');

console.log('── 1/7 Homepage 404 diagnose');
execFileSync(process.execPath, [path.join(themeRoot, '_diagnose_theme.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 1b/7 Color scheme config verify');
execFileSync(process.execPath, [path.join(themeRoot, '_verify_color_schemes.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 2a/7 Section Liquid safety verify');
execFileSync(process.execPath, [path.join(themeRoot, '_verify_section_liquid.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 2b/7 Product page bundle verify');
execFileSync(process.execPath, [path.join(themeRoot, '_verify_product_page.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 2c/7 Sanitize templates for Shopify upload');
execFileSync(process.execPath, [path.join(themeRoot, '_fix_upload.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 3/7 Strict template validation (all JSON templates)');
execFileSync(process.execPath, [path.join(themeRoot, '_validate_strict.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 4/7 Scan locked shopify://shop_images');
execFileSync(process.execPath, [path.join(themeRoot, '_scan_media.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 5/7 Required-file checklist');
const missing = mustHave.filter((rel) => !fs.existsSync(path.join(themeRoot, rel)));
if (missing.length) {
  console.error('MISSING REQUIRED FILES:');
  missing.forEach((m) => console.error('  -', m));
  process.exit(1);
}
console.log('All', mustHave.length, 'critical files present.');

console.log('\n── 6/7 Liquid named-arg scan');
execFileSync(process.execPath, [path.join(themeRoot, '_scan_liquid_args.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 7/7 Pack Shopify folders → UNIK CARE.zip');
rimraf(staging);
fs.mkdirSync(staging, { recursive: true });
for (const name of keep) {
  const src = path.join(themeRoot, name);
  if (!fs.existsSync(src)) {
    console.error('Missing folder:', name);
    process.exit(1);
  }
  copyDir(src, path.join(staging, name));
  console.log('  +', name, '(' + countFiles(path.join(staging, name)) + ' files)');
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

rimraf(staging);

const sizeMb = (fs.statSync(outZip).size / 1024 / 1024).toFixed(2);
console.log('\n══════════════════════════════════════════════════');
console.log(' READY TO UPLOAD');
console.log(' File :', outZip);
console.log(' Size :', sizeMb, 'MB');
console.log(' Name : UNIK CARE');
console.log('');
console.log(' Shopify Admin → Online Store → Themes');
console.log(' → Add theme → Upload zip file → select UNIK CARE.zip');
console.log(' → Preview → Customize → Publish when ready');
console.log('══════════════════════════════════════════════════');

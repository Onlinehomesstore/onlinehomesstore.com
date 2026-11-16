/**
 * Refresh PDP_MANUAL_UPLOAD with current product-page files only.
 * Run: node _refresh_pdp_manual.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readShopifyJson } = require('./_shopify_json');

const theme = __dirname;
const root = path.join(theme, 'PDP_MANUAL_UPLOAD');

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}
function copy(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('missing:', src);
    return false;
  }
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

execFileSync(process.execPath, [path.join(theme, '_verify_product_page.js')], {
  stdio: 'inherit',
  cwd: theme,
});

const data = readShopifyJson(path.join(theme, 'templates', 'product.json'));
const sectionTypes = [...new Set(Object.values(data.sections).map((s) => s.type))];

rmrf(root);
['templates', 'sections', 'assets', 'snippets'].forEach((d) => mkdirp(path.join(root, d)));

copy(path.join(theme, 'templates', 'product.json'), path.join(root, 'templates', 'product.json'));

sectionTypes.forEach((type) =>
  copy(path.join(theme, 'sections', type + '.liquid'), path.join(root, 'sections', type + '.liquid'))
);

const snippetRe = /render\s+['"]([^'"]+)['"]/g;
const assetRe = /['"]([a-zA-Z0-9][\w.\-]*\.(?:css|js))['"]\s*\|\s*asset_url/g;
const snippets = new Set();
const assets = new Set();

function collectFromLiquid(text) {
  let m;
  while ((m = snippetRe.exec(text))) snippets.add(m[1].replace(/\.liquid$/, ''));
  while ((m = assetRe.exec(text))) assets.add(m[1]);
}

function walkSnippet(name, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);
  const file = path.join(theme, 'snippets', name + '.liquid');
  if (!fs.existsSync(file)) return;
  collectFromLiquid(fs.readFileSync(file, 'utf8'));
  const re = /render\s+['"]([^'"]+)['"]/g;
  let m;
  const text = fs.readFileSync(file, 'utf8');
  while ((m = re.exec(text))) walkSnippet(m[1].replace(/\.liquid$/, ''), seen);
}

sectionTypes.forEach((type) => {
  const text = fs.readFileSync(path.join(theme, 'sections', type + '.liquid'), 'utf8');
  collectFromLiquid(text);
});

[...snippets].forEach((s) => walkSnippet(s));

[...assets].forEach((a) => copy(path.join(theme, 'assets', a), path.join(root, 'assets', a)));
[...snippets].forEach((s) =>
  copy(path.join(theme, 'snippets', s + '.liquid'), path.join(root, 'snippets', s + '.liquid'))
);

fs.writeFileSync(
  path.join(root, 'README_UPLOAD_ORDER.txt'),
  `UNIK CARE — product page manual upload (Edit code on your live theme)

IMPORTANT: Upload sections BEFORE product.json.

Your OLD working product.json included quantity_tier blocks — do NOT paste that.
Use ONLY the product.json from this folder (no tier blocks; matches current hero schema).

1) sections/ — upload ALL .liquid files first (premium-product-hero.liquid MUST save OK)
2) snippets/
3) assets/
4) templates/product.json — LAST

FileSaveError: Section type premium-product-hero does not refer to an existing section file
→ sections/premium-product-hero.liquid is NOT saved on your theme yet.
product.json CANNOT be saved until every section file exists.

FIX (manual upload):
1) Edit code → sections → Add a new section
2) Name the file EXACTLY: premium-product-hero.liquid
3) Paste from PDP_MANUAL_UPLOAD/sections/premium-product-hero.liquid → Save (must succeed with no error)
4) Repeat for ALL 11 section files in PDP_MANUAL_UPLOAD/sections/
5) Upload snippets/ then assets/
6) ONLY THEN add templates/product.json

FIX (recommended):
Upload UNIK CARE.zip as a NEW theme → Publish.
Verify templates/product.json appears in Edit code.

After upload:
• Online Store → Themes → Customize → open any product → confirm PDP loads
• Products → Theme template → Default product

Prefer full theme zip instead:
  node theme/_build_zip.js  →  upload UNIK CARE.zip  →  Publish
`
);

const count = (function walk(d) {
  let n = 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) n += walk(path.join(d, e.name));
    else n += 1;
  }
  return n;
})(root);

console.log('Refreshed:', root);
console.log('Sections:', sectionTypes.length);
console.log('Snippets:', snippets.size);
console.log('Assets:', assets.size);
console.log('Files:', count);

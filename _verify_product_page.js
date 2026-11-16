/**
 * Verify product.json and every section/snippet/asset it depends on.
 * Run: node _verify_product_page.js
 */
const fs = require('fs');
const path = require('path');
const { readShopifyJson } = require('./_shopify_json');

const root = __dirname;
const tplPath = path.join(root, 'templates', 'product.json');

function fail(msg) {
  console.error('PRODUCT PAGE VERIFY FAIL:', msg);
  process.exit(1);
}

if (!fs.existsSync(tplPath)) fail('templates/product.json is missing');

let data;
try {
  data = readShopifyJson(tplPath);
} catch (e) {
  fail(`templates/product.json invalid JSON — ${e.message}`);
}

const order = data.order || [];
const sections = data.sections || {};
const missingSections = [];
const missingTypes = [];

for (const id of order) {
  const sec = sections[id];
  if (!sec) missingSections.push(`order references missing section "${id}"`);
  else {
    const file = path.join(root, 'sections', `${sec.type}.liquid`);
    if (!fs.existsSync(file)) missingTypes.push(`${id} → sections/${sec.type}.liquid`);
  }
}

if (missingSections.length) missingSections.forEach((m) => console.error('  -', m));
if (missingTypes.length) {
  console.error('Missing section files required by product.json:');
  missingTypes.forEach((m) => console.error('  -', m));
  process.exit(1);
}

const snippetRe = /render\s+['"]([^'"]+)['"]/g;
const assetRe = /['"]([a-zA-Z0-9][\w.\-]*\.(?:css|js))['"]\s*\|\s*asset_url/g;
const deps = { snippets: new Set(), assets: new Set() };

for (const sec of Object.values(sections)) {
  const file = path.join(root, 'sections', `${sec.type}.liquid`);
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = snippetRe.exec(text))) deps.snippets.add(m[1].replace(/\.liquid$/, ''));
  while ((m = assetRe.exec(text))) deps.assets.add(m[1]);
}

function walkSnippets(name, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);
  const file = path.join(root, 'snippets', `${name}.liquid`);
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = snippetRe.exec(text))) {
    deps.snippets.add(m[1].replace(/\.liquid$/, ''));
    walkSnippets(m[1].replace(/\.liquid$/, ''), seen);
  }
  while ((m = assetRe.exec(text))) deps.assets.add(m[1]);
}

[...deps.snippets].forEach((s) => walkSnippets(s));

const missingSnippets = [...deps.snippets].filter(
  (s) => !fs.existsSync(path.join(root, 'snippets', `${s}.liquid`))
);
const missingAssets = [...deps.assets].filter(
  (a) => !fs.existsSync(path.join(root, 'assets', a))
);

if (missingSnippets.length) {
  console.error('Missing snippets for product page:');
  missingSnippets.forEach((s) => console.error('  - snippets/' + s + '.liquid'));
  process.exit(1);
}
if (missingAssets.length) {
  console.error('Missing assets for product page:');
  missingAssets.forEach((a) => console.error('  - assets/' + a));
  process.exit(1);
}

console.log('OK product.json');
console.log('  sections:', order.length);
console.log('  snippets:', deps.snippets.size);
console.log('  assets:', deps.assets.size);
console.log('  order:', order.join(' → '));

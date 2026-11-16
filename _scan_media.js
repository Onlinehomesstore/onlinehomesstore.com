const fs = require('fs');
const path = require('path');
const { readShopifyJson } = require('./_shopify_json');

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.json')) acc.push(p);
  }
  return acc;
}

const files = walk('templates').concat(
  fs.readdirSync('sections').filter((n) => n.endsWith('.json')).map((n) => path.join('sections', n)),
  ['config/settings_data.json']
);

const media = [];
const invalid = [];
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  try {
    if (f.replace(/\\/g, '/').endsWith('templates/product.json')) {
      readShopifyJson(f);
    } else {
      JSON.parse(raw);
    }
  } catch (e) {
    invalid.push(f + ' INVALID ' + e.message);
    continue;
  }
  const imgs = [...raw.matchAll(/shopify:\/\/shop_images\/[^\"]+/g)].map((m) => m[0]);
  if (imgs.length) media.push(f + ' (' + imgs.length + ' refs)');
}

if (invalid.length) {
  console.error(invalid.join('\n'));
  process.exit(1);
}

if (media.length) {
  console.log('OK: store media refs kept for unik-care upload:');
  media.forEach((m) => console.log('  ·', m));
} else {
  console.log('No shopify://shop_images in templates/section groups');
}
process.exit(0);

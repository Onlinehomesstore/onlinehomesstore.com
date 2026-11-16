/**
 * Fix Shopify Liquid: no filters inside render/image_tag named arguments.
 * Run: node _fix_liquid_args.js
 */
const fs = require('fs');
const path = require('path');

const roots = [
  path.join(__dirname, 'sections'),
  path.join(__dirname, 'snippets'),
];

let changed = 0;

function fixFile(fp) {
  let t = fs.readFileSync(fp, 'utf8');
  const before = t;

  // Fix: render '...', scope: '#Foo-' | append: uid|section.id
  t = t.replace(
    /\{%-?\s*render\s+'uc-section-vars',\s*section:\s*section,\s*scope:\s*'([^']+)'\s*\|\s*append:\s*(uid|section\.id)\s*-?%\}/g,
    (m, prefix, appendVar) => {
      return `{%- assign uc_sec_scope = '${prefix}' | append: ${appendVar} -%}\n{%- render 'uc-section-vars', section: section, scope: uc_sec_scope -%}`;
    }
  );

  t = t.replace(
    /\{%-?\s*render\s+"uc-section-vars",\s*section:\s*section,\s*scope:\s*"([^"]+)"\s*\|\s*append:\s*(uid|section\.id)\s*-?%\}/g,
    (m, prefix, appendVar) => {
      return `{%- assign uc_sec_scope = "${prefix}" | append: ${appendVar} -%}\n{%- render 'uc-section-vars', section: section, scope: uc_sec_scope -%}`;
    }
  );

  if (t !== before) {
    fs.writeFileSync(fp, t);
    changed++;
    console.log('fixed render scopes:', path.relative(__dirname, fp));
    return true;
  }
  return false;
}

for (const dir of roots) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.liquid'))) {
    fixFile(path.join(dir, file));
  }
}

console.log('files changed:', changed);

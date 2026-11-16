/**
 * Strip UTF-8 mojibake from theme liquid/json (especially section {% schema %}).
 * Corrupted schema labels can make Shopify drop section files on upload → index 404.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const replacements = [
  [/â†”/g, ''],
  [/â‡„/g, ''],
  [/â€¢/g, ''],
  [/â€”/g, ' - '],
  [/â€“/g, ' - '],
  [/â€™/g, "'"],
  [/â€˜/g, "'"],
  [/â€œ/g, '"'],
  [/â€/g, '"'],
  [/â‰¥/g, '>='],
  [/â‰¤/g, '<='],
  [/â†’/g, '->'],
  [/â†/g, '<-'],
  [/â”€/g, '-'],
  [/Ã—/g, 'x'],
  [/Â /g, ' '],
  [/Â/g, ''],
  [/ï¿½/g, ''],
];

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('_') || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(liquid|json)$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

let changed = 0;
for (const file of walk(root)) {
  let raw = fs.readFileSync(file, 'utf8');
  if (!/â|Ã|Â|ï¿½/.test(raw)) continue;
  let out = raw;
  for (const [re, to] of replacements) out = out.replace(re, to);
  // collapse leftover box-drawing mojibake runs in comments
  out = out.replace(/(-{2,})/g, (m) => (m.length > 8 ? '----' : m));
  if (out !== raw) {
    fs.writeFileSync(file, out);
    changed++;
    console.log('cleaned', path.relative(root, file));
  }
}
console.log('files cleaned:', changed);

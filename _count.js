const fs = require('fs');
const p = JSON.parse(fs.readFileSync('templates/product.json', 'utf8'));
const i = JSON.parse(fs.readFileSync('templates/index.json', 'utf8'));
console.log('product order count', p.order.length);
console.log(p.order.join('\n'));
console.log('product sections object count', Object.keys(p.sections).length);
console.log('index order count', i.order.length);

for (const sid of p.order) {
  const type = p.sections[sid].type;
  const t = fs.readFileSync('sections/' + type + '.liquid', 'utf8');
  const en = t.match(/"enabled_on"\s*:\s*(\{[\s\S]*?\})\s*,/);
  const dis = t.match(/"disabled_on"\s*:\s*(\{[\s\S]*?\})\s*,/);
  if (en) console.log('enabled_on', sid, type, en[1].replace(/\s+/g, ' ').slice(0, 140));
  if (dis) console.log('disabled_on', sid, type, dis[1].replace(/\s+/g, ' ').slice(0, 140));
}

// Check for sections in object but not in order (still validated)
const orphans = Object.keys(p.sections).filter((id) => !p.order.includes(id));
console.log('orphan sections in product.json:', orphans);

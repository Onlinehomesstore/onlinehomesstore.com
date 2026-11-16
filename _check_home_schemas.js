const fs = require('fs');
const secs = [
  'uc-editorial-hero',
  'category-showcase',
  'premium-product-showcase',
  'before-after-comparison',
  'visible-results',
  'premium-video-reels',
  'product-testimonials',
  'uc-blog-posts',
];
for (const t of secs) {
  const raw = fs.readFileSync('sections/' + t + '.liquid', 'utf8');
  const m = raw.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) {
    console.log(t, 'NO SCHEMA');
    continue;
  }
  try {
    JSON.parse(m[1]);
    console.log(t, 'schema OK', m[1].length);
  } catch (e) {
    console.log(t, 'SCHEMA PARSE FAIL', e.message);
  }
  if (/â|Ã|Â|ï¿½/.test(raw)) console.log(t, 'mojibake in liquid body');
  if (/â|Ã|Â|ï¿½/.test(m[1])) console.log(t, 'mojibake IN SCHEMA');
}

console.log('index.liquid exists?', fs.existsSync('templates/index.liquid'));
console.log('index.json exists?', fs.existsSync('templates/index.json'));

// link setting types used in index
const idx = JSON.parse(fs.readFileSync('templates/index.json', 'utf8'));
function findSetting(sch, blockType, id) {
  if (blockType) {
    const b = (sch.blocks || []).find((x) => x.type === blockType);
    return (b?.settings || []).find((s) => s.id === id);
  }
  return (sch.settings || []).find((s) => s.id === id);
}
for (const [sid, sec] of Object.entries(idx.sections)) {
  const sch = JSON.parse(
    fs.readFileSync('sections/' + sec.type + '.liquid', 'utf8').match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]
  );
  for (const [k, v] of Object.entries(sec.settings || {})) {
    const def = findSetting(sch, null, k);
    if (def && (def.type === 'url' || def.type === 'text') && /link|url|href/i.test(k)) {
      console.log('set', sid, k, def.type, '=', v);
    }
  }
  for (const [bid, blk] of Object.entries(sec.blocks || {})) {
    for (const [k, v] of Object.entries(blk.settings || {})) {
      const def = findSetting(sch, blk.type, k);
      if (def && (def.type === 'url' || k.includes('link') || k.includes('url'))) {
        console.log('blk', sid + '.' + bid, k, def.type, '=', v);
      }
    }
  }
}

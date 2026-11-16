const fs = require('fs');
const path = require('path');

function extractSchema(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return { __err: e.message };
  }
}

const RESOURCE = new Set([
  'color',
  'color_background',
  'url',
  'product',
  'collection',
  'blog',
  'article',
  'page',
  'image_picker',
  'video',
  'video_url',
  'font_picker',
]);

function check(label, settings, schemaSettings) {
  const out = [];
  const map = Object.fromEntries((schemaSettings || []).filter((s) => s.id).map((s) => [s.id, s]));
  for (const [k, v] of Object.entries(settings || {})) {
    const s = map[k];
    if (!s) {
      out.push(`${label}: UNKNOWN ${k}=${JSON.stringify(v)}`);
      continue;
    }
    if (RESOURCE.has(s.type) && (v === '' || v === null)) out.push(`${label}: EMPTY ${s.type} ${k}`);
    if (s.type === 'color' && typeof v === 'string' && /rgba?\(/i.test(v)) out.push(`${label}: RGBA ${k}=${v}`);
    if (typeof v === 'string' && v.startsWith('shopify://')) out.push(`${label}: SHOPIFY_REF ${k}=${v}`);
    if (s.type === 'range' && typeof v === 'number') {
      if (v < s.min || v > s.max) out.push(`${label}: RANGE ${k}=${v}`);
      if (s.step != null && Math.abs((v - s.min) / s.step - Math.round((v - s.min) / s.step)) > 1e-9)
        out.push(`${label}: STEP ${k}=${v}`);
    }
    if (s.type === 'select' && s.options && v !== '' && v != null) {
      const ok = s.options.some((o) => o.value === v || o.value === String(v));
      if (!ok) out.push(`${label}: SELECT ${k}=${JSON.stringify(v)}`);
    }
  }
  return out;
}

function validateTemplate(tpl) {
  const data = JSON.parse(fs.readFileSync(tpl, 'utf8'));
  let problems = [];
  for (const [sid, sec] of Object.entries(data.sections || {})) {
    const sp = path.join('sections', `${sec.type}.liquid`);
    if (!fs.existsSync(sp)) {
      problems.push(`${sid}: MISSING FILE ${sp}`);
      continue;
    }
    const schema = extractSchema(sp);
    if (!schema) {
      problems.push(`${sid}: NO SCHEMA`);
      continue;
    }
    if (schema.__err) {
      problems.push(`${sid}: SCHEMA PARSE ${schema.__err}`);
      continue;
    }
    problems = problems.concat(check(sid, sec.settings, schema.settings));
    const bmap = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
    for (const bid of sec.block_order || []) {
      if (!sec.blocks?.[bid]) problems.push(`${sid}: block_order missing ${bid}`);
    }
    for (const [bid, block] of Object.entries(sec.blocks || {})) {
      if (!bmap[block.type] && !String(block.type).startsWith('@')) {
        problems.push(`${sid}/${bid}: BAD BLOCK ${block.type}`);
        continue;
      }
      if (bmap[block.type]) problems = problems.concat(check(`${sid}/${bid}`, block.settings, bmap[block.type].settings));
    }
  }
  for (const sid of data.order || []) {
    if (!data.sections[sid]) problems.push(`order missing section ${sid}`);
  }
  return problems;
}

for (const tpl of ['templates/index.json', 'templates/product.json', 'templates/cart.json']) {
  const p = validateTemplate(tpl);
  console.log('\n====', tpl, 'problems:', p.length);
  p.slice(0, 80).forEach((x) => console.log(' -', x));
  if (p.length > 80) console.log(' ...', p.length - 80, 'more');
}

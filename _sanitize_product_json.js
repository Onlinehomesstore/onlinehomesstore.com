/**
 * Sanitize templates/product.json only — strip values Shopify rejects on upload.
 * Run: node _sanitize_product_json.js
 */
const fs = require('fs');
const path = require('path');
const { readShopifyJson, writeShopifyJson } = require('./_shopify_json');

const tplPath = path.join(__dirname, 'templates', 'product.json');

function extractSchema(type) {
  const file = path.join(__dirname, 'sections', `${type}.liquid`);
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  return m ? JSON.parse(m[1]) : null;
}

function cleanSettings(settings, schemaSettings) {
  if (!settings) return {};
  const map = Object.fromEntries((schemaSettings || []).filter((s) => s.id).map((s) => [s.id, s]));
  const next = {};
  for (const [k, v] of Object.entries(settings)) {
    const s = map[k];
    if (!s) continue;
    if (typeof v === 'string' && v.includes('{{')) continue;
    if ((s.type === 'color' || s.type === 'color_background') && (v === '' || v === null)) continue;
    if (s.type === 'range' && typeof v === 'number') {
      const step = s.step || 1;
      const min = s.min ?? 0;
      const max = s.max ?? v;
      let nv = Math.min(max, Math.max(min, v));
      nv = min + Math.round((nv - min) / step) * step;
      next[k] = nv;
      continue;
    }
    next[k] = v;
  }
  return next;
}

const data = readShopifyJson(tplPath);
data.order = (data.order || []).filter((id) => data.sections[id]);

for (const [sid, sec] of Object.entries(data.sections || {})) {
  const schema = extractSchema(sec.type);
  if (!schema) {
    delete data.sections[sid];
    data.order = data.order.filter((id) => id !== sid);
    console.warn('removed section (no schema):', sid, sec.type);
    continue;
  }
  sec.settings = cleanSettings(sec.settings, schema.settings);
  const bmap = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
  const order = new Set(sec.block_order || []);
  for (const bid of Object.keys(sec.blocks || {})) {
    if (!order.has(bid)) delete sec.blocks[bid];
  }
  sec.block_order = (sec.block_order || []).filter((bid) => sec.blocks[bid]);
  for (const [bid, block] of Object.entries(sec.blocks || {})) {
    const bt = bmap[block.type];
    if (!bt) {
      delete sec.blocks[bid];
      sec.block_order = sec.block_order.filter((id) => id !== bid);
      continue;
    }
    block.settings = cleanSettings(block.settings, bt.settings);
  }
}

fs.writeFileSync(tplPath, JSON.stringify(data, null, 2) + '\n');
console.log('Sanitized templates/product.json');
console.log('Sections:', data.order.length, '→', data.order.join(' → '));

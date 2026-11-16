/**
 * Make JSON templates safe for Shopify ZIP upload.
 * Shopify silently DELETES invalid templates (index/product → homepage/PDP 404).
 */
const fs = require('fs');
const path = require('path');
const { readShopifyJson, writeProductJson } = require('./_shopify_json');

const RESOURCE = new Set([
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

const COLOR = new Set(['color', 'color_background']);

function extractSchema(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) return null;
  return JSON.parse(m[1]);
}

function isBadColor(v) {
  if (typeof v !== 'string' || !v) return false;
  // Strict hex-only for zip portability (color_background rgba can still fail on some uploads)
  if (COLOR_ALLOW_RGBA) {
    return /^(transparent|currentColor)$/i.test(v) || (!v.startsWith('#') && !v.startsWith('rgba') && !v.startsWith('rgb') && !v.startsWith('linear-gradient') && !v.startsWith('radial-gradient'));
  }
  return !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) && !/^(rgba?|hsla?|linear-gradient|radial-gradient)\(/i.test(v);
}

const COLOR_ALLOW_RGBA = true;

function rgbaToHexApprox(rgba) {
  const m = String(rgba).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return '#B68A35';
  const hex = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`.toUpperCase();
}

function cleanSettings(settings, schemaSettings, { stripResources = true } = {}) {
  if (!settings) return {};
  const map = Object.fromEntries((schemaSettings || []).filter((s) => s.id).map((s) => [s.id, s]));
  const next = {};
  for (const [k, v] of Object.entries(settings)) {
    if (typeof v === 'string' && v.startsWith('shopify://')) continue;
    if (typeof v === 'string' && v.includes('{{')) continue; // dynamic sources — omit for zip

    const s = map[k];
    if (s && RESOURCE.has(s.type)) {
      if (stripResources) continue; // never ship store handles / GIDs in zip
      if (v === '' || v === null) continue;
    }
    if (s && COLOR.has(s.type)) {
      if (v === '' || v === null) continue;
      if (typeof v === 'string' && v.includes('rgba') && s.type === 'color') {
        // plain color fields must be hex
        next[k] = rgbaToHexApprox(v);
        continue;
      }
      if (typeof v === 'string' && s.type === 'color' && !/^#/.test(v)) {
        next[k] = rgbaToHexApprox(v);
        continue;
      }
    }
    if (s && s.type === 'url' && (v === '' || v === null || (typeof v === 'string' && v.startsWith('shopify://')))) {
      if (typeof v === 'string' && v.includes('collections')) next[k] = '/collections/all';
      continue;
    }
    if (s && s.type === 'range' && typeof v === 'number') {
      const step = s.step || 1;
      const min = s.min ?? 0;
      const max = s.max ?? v;
      let nv = Math.min(max, Math.max(min, v));
      nv = min + Math.round((nv - min) / step) * step;
      next[k] = nv;
      continue;
    }
    if ((v === '' || v === null) && /(_color|_link|background_gradient|product|collection|blog|image|video)$/i.test(k)) {
      continue;
    }
    next[k] = v;
  }
  return next;
}

function sanitizeTemplate(tplPath, opts = {}) {
  const data = readShopifyJson(tplPath);
  let removed = 0;

  for (const sid of Object.keys(data.sections || {})) {
    if (!(data.order || []).includes(sid)) {
      delete data.sections[sid];
      removed++;
      console.log(tplPath, 'removed orphan section', sid);
    }
  }

  for (const [sid, sec] of Object.entries(data.sections || {})) {
    const schemaPath = path.join('sections', `${sec.type}.liquid`);
    if (!fs.existsSync(schemaPath)) {
      console.warn(tplPath, 'MISSING SECTION FILE', sec.type, '— removing', sid);
      delete data.sections[sid];
      data.order = (data.order || []).filter((id) => id !== sid);
      removed++;
      continue;
    }
    const schema = extractSchema(schemaPath);
    if (!schema) continue;

    const before = JSON.stringify(sec.settings || {});
    sec.settings = cleanSettings(sec.settings, schema.settings, opts);
    if (JSON.stringify(sec.settings) !== before) removed++;

    const bmap = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
    const order = new Set(sec.block_order || Object.keys(sec.blocks || {}));
    for (const bid of Object.keys(sec.blocks || {})) {
      if (!order.has(bid)) {
        delete sec.blocks[bid];
        removed++;
        console.log(tplPath, 'removed orphan block', sid, bid);
      }
    }
    for (const [bid, block] of Object.entries(sec.blocks || {})) {
      const bt = bmap[block.type];
      if (!bt) {
        console.warn(tplPath, 'unknown block type', sid, block.type, '— removing', bid);
        delete sec.blocks[bid];
        if (sec.block_order) sec.block_order = sec.block_order.filter((id) => id !== bid);
        removed++;
        continue;
      }
      const bBefore = JSON.stringify(block.settings || {});
      block.settings = cleanSettings(block.settings, bt.settings, opts);
      if (JSON.stringify(block.settings) !== bBefore) removed++;
    }
  }

  if (tplPath.endsWith('product.json')) {
    writeProductJson(tplPath, data);
  } else {
    fs.writeFileSync(tplPath, JSON.stringify(data, null, 2) + '\n');
  }
  console.log(tplPath, 'done, changes~', removed);
  return data;
}

function sanitizeGroup(groupPath) {
  const data = JSON.parse(fs.readFileSync(groupPath, 'utf8'));
  let removed = 0;
  for (const [sid, sec] of Object.entries(data.sections || {})) {
    const schemaPath = path.join('sections', `${sec.type}.liquid`);
    if (!fs.existsSync(schemaPath)) continue;
    const schema = extractSchema(schemaPath);
    if (!schema) continue;
    const before = JSON.stringify(sec.settings || {});
    sec.settings = cleanSettings(sec.settings, schema.settings, { stripResources: true });
    if (JSON.stringify(sec.settings) !== before) removed++;
    const bmap = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
    for (const [bid, block] of Object.entries(sec.blocks || {})) {
      const bt = bmap[block.type];
      if (!bt) continue;
      block.settings = cleanSettings(block.settings, bt.settings, { stripResources: true });
    }
  }
  fs.writeFileSync(groupPath, JSON.stringify(data, null, 2) + '\n');
  console.log(groupPath, 'done, changes~', removed);
}

// --- run ---
sanitizeTemplate('templates/index.json');
sanitizeTemplate('templates/product.json');
sanitizeTemplate('templates/cart.json');
sanitizeGroup('sections/header-group.json');
sanitizeGroup('sections/footer-group.json');

// Hero CTAs: plain paths only
const index = JSON.parse(fs.readFileSync('templates/index.json', 'utf8'));
const hero = index.sections.uc_hero_home;
if (hero?.blocks) {
  for (const block of Object.values(hero.blocks)) {
    if (block.settings.button_label && !block.settings.button_link) {
      block.settings.button_link = '/collections/all';
    }
    if (block.settings.button2_label && !block.settings.button2_link) {
      block.settings.button2_link = '/pages/about';
    }
  }
}
// Feature cards: force hex-safe icon_bg if present as color_background with rgba — keep rgba for color_background OR convert
if (index.sections.uc_feature_cards_home?.settings?.icon_bg?.includes?.('rgba')) {
  // color_background allows rgba; leave it. If Shopify still rejects, convert:
  // index.sections.uc_feature_cards_home.settings.icon_bg = '#F7F1E4';
}
fs.writeFileSync('templates/index.json', JSON.stringify(index, null, 2) + '\n');

// Product: drop disabled Dawn main-product (duplicate of premium hero) to reduce validation surface
const product = readShopifyJson('templates/product.json');
if (product.sections.main?.disabled) {
  delete product.sections.main;
  product.order = (product.order || []).filter((id) => id !== 'main');
  console.log('product.json removed disabled main-product');
}
writeProductJson('templates/product.json', product);

console.log('sanitize complete');

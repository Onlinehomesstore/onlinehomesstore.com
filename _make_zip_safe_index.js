/**
 * Make templates/index.json acceptable for Shopify Admin ZIP upload.
 *
 * Proven issue: Admin ZIP import silently DROPS templates/index.json when it
 * contains shopify://shop_images refs (even same-store). Editor paste keeps them.
 *
 * Also normalizes range floats to step-aligned numbers for ZIP safety.
 * Keeps collection/blog handles and TikTok URLs (same store).
 *
 * Writes:
 *  - templates/index.json          (ZIP-safe)
 *  - templates/_index_with_media.json  (for Admin Edit code paste; has images)
 */
const fs = require('fs');
const path = require('path');

function schemaOf(type) {
  const raw = fs.readFileSync(path.join('sections', type + '.liquid'), 'utf8');
  return JSON.parse(raw.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/)[1]);
}

function settingMap(list) {
  return Object.fromEntries((list || []).filter((s) => s.id).map((s) => [s.id, s]));
}

function snapRange(v, def) {
  if (typeof v !== 'number' || !def || def.type !== 'range') return v;
  const min = def.min ?? 0;
  const max = def.max ?? v;
  const step = def.step || 1;
  let nv = Math.min(max, Math.max(min, v));
  nv = min + Math.round((nv - min) / step) * step;
  // Prefer integer when step is integer
  if (Number.isInteger(step)) nv = Math.round(nv);
  return nv;
}

function cleanSettings(settings, schemaSettings, { stripShopify, stripResources }) {
  const map = settingMap(schemaSettings);
  const next = {};
  const RESOURCE = new Set(['product', 'collection', 'blog', 'article', 'page', 'image_picker', 'video']);
  for (const [k, v] of Object.entries(settings || {})) {
    const def = map[k];
    if (!def) continue; // drop unknown
    if (stripShopify && typeof v === 'string' && v.startsWith('shopify://')) continue;
    if (typeof v === 'string' && v.includes('{{')) continue;
    if (stripResources && RESOURCE.has(def.type) && v) continue;
    if (def.type === 'range' && typeof v === 'number') {
      next[k] = snapRange(v, def);
      continue;
    }
    if (def.type === 'url' && v === '') continue;
    next[k] = v;
  }
  return next;
}

function transform(src, { stripShopify, stripResources }) {
  const out = { sections: {}, order: src.order.slice() };
  for (const [sid, sec] of Object.entries(src.sections)) {
    const sch = schemaOf(sec.type);
    const next = {
      type: sec.type,
      settings: cleanSettings(sec.settings, sch.settings, { stripShopify, stripResources }),
    };
    if (sec.name) {
      next.name = String(sec.name).replace(/&/g, 'and');
    }
    if (sec.blocks) {
      next.blocks = {};
      const bmap = Object.fromEntries((sch.blocks || []).map((b) => [b.type, b]));
      for (const [bid, blk] of Object.entries(sec.blocks)) {
        const bdef = bmap[blk.type];
        if (!bdef) continue;
        next.blocks[bid] = {
          type: blk.type,
          settings: cleanSettings(blk.settings, bdef.settings, { stripShopify, stripResources }),
        };
      }
      next.block_order = (sec.block_order || Object.keys(next.blocks)).filter((id) => next.blocks[id]);
    }
    out.sections[sid] = next;
  }
  return out;
}

const src = JSON.parse(fs.readFileSync('templates/index.json', 'utf8'));

// Ensure hair-colour hero uses single <p> richtext (ZIP-safer)
function ensureHeroCopy(j) {
  const b = j.sections.uc_hero_home?.blocks;
  if (!b) return;
  if (b.slide_1) {
    b.slide_1.settings.heading = '<p>Beautiful colour. Made beautifully simple.</p>';
    b.slide_1.settings.subheading = 'UNIK CARE HAIR COLOUR';
  }
  if (b.slide_2) {
    b.slide_2.settings.heading = '<p>A fresh colour can change how you feel.</p>';
  }
  if (b.slide_aF4wbj) {
    b.slide_aF4wbj.settings.heading = '<p>Colour you can trust at home.</p>';
  }
}

const withMedia = transform(src, { stripShopify: false, stripResources: false });
ensureHeroCopy(withMedia);
fs.writeFileSync(path.join('..', 'INDEX_ADMIN_PASTE.json'), JSON.stringify(withMedia, null, 2) + '\n');
// remove accidental templates/_ files so they are not zipped
for (const n of fs.readdirSync('templates')) {
  if (n.startsWith('_') && n.endsWith('.json')) {
    fs.unlinkSync(path.join('templates', n));
    console.log('removed from templates/', n);
  }
}

const zipSafe = transform(src, { stripShopify: true, stripResources: true });
ensureHeroCopy(zipSafe);

// Force integer letter-spacing for ZIP (some Admin ZIP validators reject decimals)
if (zipSafe.sections.before_after_comparison_YFNQLG?.settings) {
  zipSafe.sections.before_after_comparison_YFNQLG.settings.heading_letter_spacing = -1;
}
if (zipSafe.sections.visible_results_FHCmVm?.settings) {
  zipSafe.sections.visible_results_FHCmVm.settings.letter_spacing = -1;
}

fs.writeFileSync('templates/index.json', JSON.stringify(zipSafe, null, 2) + '\n');

const raw = fs.readFileSync('templates/index.json', 'utf8');
console.log('ZIP-safe index written');
console.log('  shopify refs left:', (raw.match(/shopify:\/\//g) || []).length);
console.log('  floats left:', [...raw.matchAll(/: -?\d+\.\d+/g)].map((m) => m[0]));
console.log('  has collections:', /all-products|hair-color/.test(raw));
console.log('  has tiktok:', /tiktok\.com/.test(raw));
console.log('  media paste file: ../INDEX_ADMIN_PASTE.json');
console.log('  ZIP-safe has NO shopify:// and NO collection/blog handles');

/**
 * Shopify-strict index.json rejection hunter.
 * Flags anything that commonly causes Admin to DROP templates/index.json on zip upload.
 */
const fs = require('fs');
const path = require('path');

function loadSchema(type) {
  const file = path.join('sections', type + '.liquid');
  if (!fs.existsSync(file)) return { error: 'MISSING_FILE' };
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) return { error: 'NO_SCHEMA' };
  try {
    return { schema: JSON.parse(m[1]), raw: m[1] };
  } catch (e) {
    return { error: 'SCHEMA_JSON: ' + e.message };
  }
}

function checkSchemaIntegrity(type, schema) {
  const issues = [];
  if (schema.name == null) issues.push(type + ': schema missing name');
  const ids = new Set();
  for (const s of schema.settings || []) {
    if (!s.type) issues.push(type + ': setting without type');
    if (['header', 'paragraph'].includes(s.type)) continue;
    if (!s.id) {
      issues.push(type + ': setting type=' + s.type + ' missing id');
      continue;
    }
    if (ids.has(s.id)) issues.push(type + ': duplicate setting id ' + s.id);
    ids.add(s.id);
    if (s.type === 'range') {
      if (typeof s.min !== 'number' || typeof s.max !== 'number' || typeof s.default !== 'number') {
        issues.push(type + '.' + s.id + ': range missing min/max/default');
      } else {
        if (s.default < s.min || s.default > s.max) issues.push(type + '.' + s.id + ': default OOB');
        const step = s.step || 1;
        if (((s.default - s.min) / step) % 1 !== 0) issues.push(type + '.' + s.id + ': default off-step');
      }
    }
    if ((s.type === 'select' || s.type === 'radio') && s.default != null) {
      const opts = (s.options || []).map((o) => String(o.value));
      if (!opts.includes(String(s.default))) issues.push(type + '.' + s.id + ': default not in options');
    }
    if (s.type === 'checkbox' && s.default != null && typeof s.default !== 'boolean') {
      issues.push(type + '.' + s.id + ': checkbox default not boolean');
    }
  }
  for (const b of schema.blocks || []) {
    if (!b.type) issues.push(type + ': block missing type');
    const bids = new Set();
    for (const s of b.settings || []) {
      if (['header', 'paragraph'].includes(s.type)) continue;
      if (!s.id) {
        issues.push(type + '.' + b.type + ': setting missing id');
        continue;
      }
      if (bids.has(s.id)) issues.push(type + '.' + b.type + ': dup id ' + s.id);
      bids.add(s.id);
      if (s.type === 'range' && typeof s.default === 'number') {
        if (s.default < s.min || s.default > s.max) issues.push(type + '.' + b.type + '.' + s.id + ': default OOB');
      }
      if ((s.type === 'select' || s.type === 'radio') && s.default != null) {
        const opts = (s.options || []).map((o) => String(o.value));
        if (!opts.includes(String(s.default))) {
          issues.push(type + '.' + b.type + '.' + s.id + ': default not in options ' + s.default);
        }
      }
    }
  }
  // Shopify: info/content with unescaped issues — check for raw newlines in weird places already in JSON
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(JSON.stringify(schema))) {
    issues.push(type + ': control chars in schema');
  }
  return issues;
}

function typeOk(def, v, path, issues) {
  if (v === null || v === undefined) return;
  switch (def.type) {
    case 'checkbox':
      if (typeof v !== 'boolean') issues.push(path + ': expected boolean got ' + typeof v);
      break;
    case 'range':
    case 'number':
      if (typeof v !== 'number') issues.push(path + ': expected number got ' + typeof v + ' ' + JSON.stringify(v));
      else if (def.type === 'range') {
        if (v < def.min || v > def.max) issues.push(path + ': OOR ' + v);
        const step = def.step || 1;
        if (((v - (def.min || 0)) / step) % 1 !== 0) issues.push(path + ': off-step ' + v + ' step ' + step);
      }
      break;
    case 'select':
    case 'radio': {
      const opts = (def.options || []).map((o) => String(o.value));
      if (!opts.includes(String(v))) issues.push(path + ': bad option ' + JSON.stringify(v) + ' allowed=' + opts.join('|'));
      break;
    }
    case 'color':
    case 'color_background':
      if (typeof v !== 'string') issues.push(path + ': color not string');
      else if (v !== '' && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) && !/^rgba?\(/.test(v)) {
        issues.push(path + ': suspicious color ' + v);
      }
      break;
    case 'url':
      if (typeof v !== 'string') issues.push(path + ': url not string');
      // empty ok; relative ok; shopify:// ok
      break;
    case 'richtext':
      if (typeof v !== 'string') issues.push(path + ': richtext not string');
      else if (v && !/^<p[\s>]/.test(v.trim()) && v.includes('<')) {
        // not necessarily fatal
      }
      break;
    case 'text':
    case 'textarea':
    case 'inline_richtext':
    case 'html':
    case 'liquid':
    case 'id':
      if (typeof v !== 'string') issues.push(path + ': expected string got ' + typeof v);
      if (def.type === 'inline_richtext' && typeof v === 'string' && /<\/?(?:p|div|br|ul|ol|li)\b/i.test(v)) {
        issues.push(path + ': block tags in inline_richtext');
      }
      if (def.type === 'text' && typeof v === 'string' && /<[a-z][\s\S]*>/i.test(v)) {
        issues.push(path + ': HTML in text setting');
      }
      break;
    case 'collection':
    case 'product':
    case 'blog':
    case 'page':
    case 'article':
    case 'metaobject':
    case 'image_picker':
    case 'video':
    case 'video_url':
    case 'font_picker':
      // empty string or handle/gid
      break;
    default:
      // unknown setting type in schema itself
      break;
  }
}

const index = JSON.parse(fs.readFileSync('templates/index.json', 'utf8'));
const allIssues = [];
const types = new Set();

for (const [sid, sec] of Object.entries(index.sections)) {
  types.add(sec.type);
  const loaded = loadSchema(sec.type);
  if (loaded.error) {
    allIssues.push(sid + ': ' + loaded.error);
    continue;
  }
  allIssues.push(...checkSchemaIntegrity(sec.type, loaded.schema));

  const sch = loaded.schema;
  if (sch.disabled_on?.templates?.includes('index')) allIssues.push(sid + ' DISABLED on index');
  if (sch.enabled_on?.templates && !sch.enabled_on.templates.includes('index')) {
    allIssues.push(sid + ' NOT enabled on index: ' + JSON.stringify(sch.enabled_on));
  }
  if (sch.enabled_on?.groups && !sch.enabled_on.templates) {
    // section only for groups - can't be on index
    allIssues.push(sid + ' enabled_on groups only? ' + JSON.stringify(sch.enabled_on));
  }

  const smap = Object.fromEntries((sch.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
  for (const [k, v] of Object.entries(sec.settings || {})) {
    if (!smap[k]) allIssues.push('UNKNOWN setting ' + sid + '.' + k + '=' + JSON.stringify(v).slice(0, 60));
    else typeOk(smap[k], v, sid + '.' + k, allIssues);
  }

  const bmap = Object.fromEntries((sch.blocks || []).map((b) => [b.type, b]));
  const maxBlocks = sch.max_blocks;
  const blockCount = Object.keys(sec.blocks || {}).length;
  if (maxBlocks && blockCount > maxBlocks) allIssues.push(sid + ': too many blocks ' + blockCount + '>' + maxBlocks);

  for (const [bid, blk] of Object.entries(sec.blocks || {})) {
    const bdef = bmap[blk.type];
    if (!bdef) {
      allIssues.push('UNKNOWN block type ' + sid + '.' + bid + ' ' + blk.type);
      continue;
    }
    const bsmap = Object.fromEntries((bdef.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
    for (const [k, v] of Object.entries(blk.settings || {})) {
      if (!bsmap[k]) allIssues.push('UNKNOWN block setting ' + sid + '.' + bid + '.' + k);
      else typeOk(bsmap[k], v, sid + '.' + bid + '.' + k, allIssues);
    }
  }

  if (sec.block_order) {
    for (const bid of sec.block_order) {
      if (!sec.blocks?.[bid]) allIssues.push('block_order orphan ' + sid + '.' + bid);
    }
    for (const bid of Object.keys(sec.blocks || {})) {
      if (!sec.block_order.includes(bid)) allIssues.push('block missing from block_order ' + sid + '.' + bid);
    }
  } else if (sec.blocks && Object.keys(sec.blocks).length) {
    allIssues.push('missing block_order ' + sid);
  }
}

// unique schema integrity once per type
console.log('=== ISSUES (' + allIssues.length + ') ===');
[...new Set(allIssues)].forEach((i) => console.log(' -', i));

// Print range defs for hero that might be off
const hero = loadSchema('uc-editorial-hero').schema;
console.log('\n=== hero range settings ===');
for (const s of hero.settings || []) {
  if (s.type === 'range') console.log(s.id, 'min', s.min, 'max', s.max, 'step', s.step, 'default', s.default);
}
const idxHero = index.sections.uc_hero_home.settings;
console.log('index hero settings values:', idxHero);

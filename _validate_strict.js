/**
 * Strict local emulation of Shopify template JSON validation.
 * Flags anything that can make Shopify strip a template on ZIP upload.
 */
const fs = require('fs');
const path = require('path');
const { readShopifyJson } = require('./_shopify_json');

function extractSchema(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return { __parseError: e.message };
  }
}

function validateSettings(prefix, settings, schemaSettings, issues, infos) {
  const map = Object.fromEntries((schemaSettings || []).filter((s) => s.id).map((s) => [s.id, s]));
  for (const [k, v] of Object.entries(settings || {})) {
    const s = map[k];
    if (!s) {
      infos.push(`${prefix}.${k} :: UNKNOWN setting id (value ${JSON.stringify(v).slice(0, 40)})`);
      continue;
    }
    const type = s.type;
    // Same-store media/handles are REQUIRED for unik-care ZIP re-upload (do not strip / do not fail build)
    if (typeof v === 'string' && v.startsWith('shopify://')) {
      infos.push(`${prefix}.${k} :: shopify:// ref (kept for same-store upload)`);
    }
    if (typeof v === 'string' && v.includes('{{')) issues.push(`${prefix}.${k} :: liquid {{ }} in JSON`);

    if (type === 'range' && typeof v === 'number') {
      const step = s.step || 1;
      const min = s.min ?? 0;
      const max = s.max ?? Infinity;
      if (v < min) issues.push(`${prefix}.${k} :: range ${v} < min ${min}`);
      if (v > max) issues.push(`${prefix}.${k} :: range ${v} > max ${max}`);
      const off = (v - min) / step;
      if (Math.abs(off - Math.round(off)) > 1e-9) issues.push(`${prefix}.${k} :: range ${v} not on step ${step} (min ${min})`);
    }
    if (type === 'select' || type === 'radio') {
      const opts = (s.options || []).map((o) => String(o.value));
      if (!opts.includes(String(v))) issues.push(`${prefix}.${k} :: select value "${v}" not in [${opts.join(', ')}]`);
    }
    if (type === 'checkbox' && typeof v !== 'boolean') issues.push(`${prefix}.${k} :: checkbox not boolean (${JSON.stringify(v)})`);
    if ((type === 'color' || type === 'color_background') && typeof v === 'string' && v) {
      if (type === 'color' && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
        issues.push(`${prefix}.${k} :: color must be hex (got ${v})`);
      }
    }
    if (['collection', 'product', 'blog', 'article', 'page'].includes(type) && v) {
      infos.push(`${prefix}.${k} :: ${type} handle "${v}" (kept for same-store upload)`);
    }
    if (['image_picker', 'video'].includes(type) && v) {
      infos.push(`${prefix}.${k} :: ${type} media ref (kept for same-store upload)`);
    }
  }
}

function validateTemplate(tplPath) {
  const issues = [];
  const infos = [];
  let data;
  try {
    data = readShopifyJson(tplPath);
  } catch (e) {
    return { issues: [`${tplPath} :: INVALID JSON — ${e.message}`], infos: [] };
  }

  const order = data.order || [];
  // order must reference existing sections and vice versa
  for (const id of order) if (!data.sections[id]) issues.push(`order references missing section "${id}"`);

  for (const [sid, sec] of Object.entries(data.sections || {})) {
    if (!order.includes(sid)) issues.push(`section "${sid}" not in order (orphan)`);
    const file = path.join('sections', `${sec.type}.liquid`);
    if (!fs.existsSync(file)) {
      issues.push(`section "${sid}" :: type "${sec.type}" file missing`);
      continue;
    }
    const schema = extractSchema(file);
    if (!schema) {
      issues.push(`section "${sid}" :: ${sec.type} has no {% schema %}`);
      continue;
    }
    if (schema.__parseError) {
      issues.push(`section "${sid}" :: ${sec.type} schema JSON error — ${schema.__parseError}`);
      continue;
    }

    // enabled_on/disabled_on — Shopify matches base type (product.premium → product)
    const tplFile = path.basename(tplPath).replace(/\.json$/, '');
    const tplBase = tplFile.includes('.') ? tplFile.split('.')[0] : tplFile;
    const tplAllowed = (list) =>
      Array.isArray(list) &&
      (list.includes('*') || list.includes(tplFile) || list.includes(tplBase));

    if (schema.enabled_on && schema.enabled_on.templates && !tplAllowed(schema.enabled_on.templates)) {
      issues.push(`section "${sid}" (${sec.type}) enabled_on ${JSON.stringify(schema.enabled_on.templates)} — not allowed on ${tplFile}`);
    }
    if (schema.disabled_on && schema.disabled_on.templates && tplAllowed(schema.disabled_on.templates)) {
      issues.push(`section "${sid}" (${sec.type}) disabled_on ${tplFile}`);
    }

    validateSettings(`${sid}.settings`, sec.settings, schema.settings, issues, infos);

    const blockDefs = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
    const hasAtType = (schema.blocks || []).some((b) => b.type === '@app' || b.type === '@theme');
    const blockOrder = sec.block_order || [];
    const maxBlocks = schema.max_blocks;
    if (maxBlocks && blockOrder.length > maxBlocks) issues.push(`section "${sid}" :: ${blockOrder.length} blocks > max_blocks ${maxBlocks}`);

    for (const bid of blockOrder) if (!sec.blocks || !sec.blocks[bid]) issues.push(`section "${sid}" block_order references missing block "${bid}"`);

    for (const [bid, block] of Object.entries(sec.blocks || {})) {
      if (!blockOrder.includes(bid)) issues.push(`section "${sid}" block "${bid}" not in block_order (orphan)`);
      const bdef = blockDefs[block.type];
      if (!bdef) {
        if (!hasAtType) issues.push(`section "${sid}" block "${bid}" :: type "${block.type}" not in schema blocks [${Object.keys(blockDefs).join(', ')}]`);
        continue;
      }
      validateSettings(`${sid}.${bid}`, block.settings, bdef.settings, issues, infos);
    }
  }
  return { issues, infos };
}

function walkTemplates(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTemplates(p, acc);
    else if (e.name.endsWith('.json')) acc.push(p.replace(/\\/g, '/'));
  }
  return acc;
}

const targets = process.argv.slice(2);
const files = targets.length
  ? targets
  : walkTemplates('templates');

let total = 0;
for (const f of files) {
  const { issues, infos } = validateTemplate(f);
  if (issues.length || infos.length) {
    console.log(`\n=== ${f} :: ${issues.length} critical, ${infos.length} info ===`);
    for (const i of issues) console.log('  [X] ' + i);
    for (const i of infos.slice(0, 8)) console.log('  (info) ' + i);
    if (infos.length > 8) console.log('  (info) …' + (infos.length - 8) + ' more same-store refs');
  } else {
    console.log(`OK ${f}`);
  }
  total += issues.length;
}
console.log(`\nTOTAL CRITICAL: ${total}`);
process.exit(total ? 1 : 0);

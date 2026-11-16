/**
 * Lint section {% schema %} blocks for defects Shopify rejects at upload:
 * - invalid JSON
 * - duplicate setting ids
 * - duplicate block types
 * - range: min>=max, (max-min)/step > 101 steps, missing/невalid step
 * - select/radio with no options or default not in options
 * - preset settings referencing unknown setting ids
 * - too many settings, etc.
 */
const fs = require('fs');
const path = require('path');

function extractSchema(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) return { none: true };
  try {
    return { schema: JSON.parse(m[1]) };
  } catch (e) {
    return { error: e.message };
  }
}

function lintSettingsArray(prefix, arr, issues) {
  const ids = new Set();
  for (const s of arr || []) {
    if (!s || typeof s !== 'object') continue;
    if (s.type === 'header' || s.type === 'paragraph') continue;
    if (!s.id) {
      issues.push(`${prefix}: setting type "${s.type}" missing id`);
      continue;
    }
    if (ids.has(s.id)) issues.push(`${prefix}: DUPLICATE setting id "${s.id}"`);
    ids.add(s.id);

    if (s.type === 'range') {
      const min = s.min,
        max = s.max,
        step = s.step ?? 1;
      if (typeof min !== 'number' || typeof max !== 'number') issues.push(`${prefix}.${s.id}: range missing numeric min/max`);
      else {
        if (min >= max) issues.push(`${prefix}.${s.id}: range min ${min} >= max ${max}`);
        if (step <= 0) issues.push(`${prefix}.${s.id}: range step ${step} invalid`);
        else {
          const steps = (max - min) / step;
          if (steps > 101) issues.push(`${prefix}.${s.id}: range has ${Math.round(steps)} steps (>101, Shopify limit)`);
          if (Math.abs(steps - Math.round(steps)) > 1e-9) issues.push(`${prefix}.${s.id}: (max-min) not divisible by step`);
        }
        if (typeof s.default === 'number') {
          if (s.default < min || s.default > max) issues.push(`${prefix}.${s.id}: default ${s.default} out of [${min},${max}]`);
        }
      }
    }
    if (s.type === 'select' || s.type === 'radio') {
      const opts = (s.options || []).map((o) => String(o.value));
      if (!opts.length) issues.push(`${prefix}.${s.id}: ${s.type} has no options`);
      if (s.default !== undefined && !opts.includes(String(s.default))) issues.push(`${prefix}.${s.id}: default "${s.default}" not in options [${opts.join(', ')}]`);
    }
    if ((s.type === 'color' || s.type === 'color_background') && typeof s.default === 'string' && s.default) {
      if (s.type === 'color' && !/^#([0-9a-fA-F]{3,8})$/.test(s.default)) issues.push(`${prefix}.${s.id}: color default not hex (${s.default})`);
    }
  }
  return ids;
}

function lintFile(file) {
  const issues = [];
  const res = extractSchema(file);
  if (res.none) return issues; // no schema (snippet-like) — fine
  if (res.error) {
    issues.push(`SCHEMA JSON PARSE ERROR: ${res.error}`);
    return issues;
  }
  const schema = res.schema;

  const settingIds = lintSettingsArray('settings', schema.settings, issues);

  const blockTypes = new Set();
  for (const b of schema.blocks || []) {
    if (b.type === '@app' || b.type === '@theme') continue;
    if (blockTypes.has(b.type)) issues.push(`DUPLICATE block type "${b.type}"`);
    blockTypes.add(b.type);
    lintSettingsArray(`block:${b.type}`, b.settings, issues);
  }

  // presets referencing unknown setting ids
  for (const p of schema.presets || []) {
    for (const k of Object.keys(p.settings || {})) {
      if (!settingIds.has(k)) issues.push(`preset "${p.name}": unknown setting id "${k}"`);
    }
    // preset blocks reference known block types
    const pblocks = p.blocks;
    if (Array.isArray(pblocks)) {
      for (const pb of pblocks) if (pb.type && !blockTypes.has(pb.type) && pb.type !== '@app') issues.push(`preset "${p.name}": unknown block type "${pb.type}"`);
    } else if (pblocks && typeof pblocks === 'object') {
      for (const pb of Object.values(pblocks)) if (pb.type && !blockTypes.has(pb.type) && pb.type !== '@app') issues.push(`preset "${p.name}": unknown block type "${pb.type}"`);
    }
  }

  // default (deprecated) also validated
  if (schema.default) {
    for (const k of Object.keys(schema.default.settings || {})) if (!settingIds.has(k)) issues.push(`default: unknown setting id "${k}"`);
  }

  if (schema.max_blocks && schema.max_blocks > 50) issues.push(`max_blocks ${schema.max_blocks} > 50`);

  return issues;
}

const targets = process.argv.slice(2);
let files;
if (targets.length) {
  files = targets;
} else {
  files = fs.readdirSync('sections').filter((f) => f.endsWith('.liquid')).map((f) => path.join('sections', f));
}

let total = 0;
for (const f of files) {
  const issues = lintFile(f);
  if (issues.length) {
    console.log(`\n### ${f}`);
    issues.forEach((i) => console.log('   [X] ' + i));
    total += issues.length;
  }
}
console.log(`\nTOTAL SCHEMA DEFECTS: ${total}`);

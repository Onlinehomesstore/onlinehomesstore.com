#!/usr/bin/env node
/**
 * UC Theme 404 / upload diagnostic
 * Run: node _diagnose_theme.js
 *
 * Detects the exact issues that make Shopify serve 404 on "/" after zip/import
 * or manual code upload (missing index.json, missing sections, store-only media GIDs).
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const issues = [];
const warnings = [];
const ok = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function pushMissing(rel, why) {
  issues.push({ file: rel, why });
}

function readJson(rel) {
  const full = path.join(root, rel);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    issues.push({ file: rel, why: `Invalid JSON: ${e.message}` });
    return null;
  }
}

console.log('\n══ UC Theme Diagnose — homepage 404 hunter ══\n');

// Required core
[
  'layout/theme.liquid',
  'config/settings_data.json',
  'config/settings_schema.json',
  'templates/index.json',
  'templates/404.json',
  'sections/main-404.liquid',
  'sections/header-group.json',
  'sections/footer-group.json',
  'sections/uc-editorial-hero.liquid',
  'assets/uc-editorial-hero.css',
  'assets/uc-editorial-hero.js',
  'snippets/uc-error-diagnostics.liquid',
].forEach((rel) => {
  if (exists(rel)) ok.push(rel);
  else pushMissing(rel, 'Required for a working homepage / diagnostics');
});

// Stale hero that upload guides used to mention
if (exists('sections/uc-hero-slider.liquid')) {
  warnings.push({
    file: 'sections/uc-hero-slider.liquid',
    why: 'Legacy hero present. index.json must use uc-editorial-hero (current).',
  });
} else {
  ok.push('(legacy uc-hero-slider correctly absent)');
}

const index = readJson('templates/index.json');
if (index) {
  const order = index.order || [];
  const sections = index.sections || {};
  order.forEach((id) => {
    const sec = sections[id];
    if (!sec) {
      issues.push({ file: 'templates/index.json', why: `order references missing section id "${id}"` });
      return;
    }
    const type = sec.type;
    const liquid = `sections/${type}.liquid`;
    if (!exists(liquid)) {
      pushMissing(liquid, `index.json section "${id}" type "${type}" — THIS BLOCKS index.json UPLOAD → homepage 404`);
    } else {
      ok.push(`${liquid} (used by ${id})`);
    }
  });

  const raw = fs.readFileSync(path.join(root, 'templates/index.json'), 'utf8');
  const mediaRefs = [...raw.matchAll(/shopify:\/\/shop_images\/([^\"]+)/g)].map((m) => m[1]);
  if (mediaRefs.length) {
    warnings.push({
      file: 'templates/index.json',
      why:
        `Contains shopify://shop_images refs (${mediaRefs.join(', ')}). OK for re-upload to the SAME store (unik-care). Do not strip them or hero/BA images will vanish.`,
    });
  } else {
    warnings.push({
      file: 'templates/index.json',
      why: 'No shopify://shop_images refs. Homepage will upload but hero/BA images must be re-picked in the editor.',
    });
  }

  // Floats like -0.5 are valid in Shopify editor exports for this theme; do not block ZIP.
  const floatPaths = [];
  (function walk(o, p) {
    if (typeof o === 'number' && !Number.isInteger(o)) floatPaths.push(p + '=' + o);
    else if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) walk(o[k], p ? p + '.' + k : k);
    }
  })(index, '');
  if (floatPaths.length) {
    ok.push('index.json float ranges present (editor-compatible): ' + floatPaths.join(', '));
  } else {
    ok.push('index.json has no float range values');
  }
}

// settings_data store locks (logo etc.) — can break portability between shops
try {
  const sdRaw = fs.readFileSync(path.join(root, 'config/settings_data.json'), 'utf8');
  const sdRefs = [...sdRaw.matchAll(/shopify:\/\/shop_images\/([^\"]+)/g)].map((m) => m[1]);
  if (sdRefs.length) {
    warnings.push({
      file: 'config/settings_data.json',
      why:
        `Contains shopify://shop_images refs (${sdRefs.join(', ')}). Strip before ZIP upload for portability; re-upload logo in Theme settings after install.`,
    });
  } else {
    ok.push('settings_data.json has no shopify://shop_images locks');
  }
} catch (e) {
  /* already flagged missing */
}

// Header / footer groups
['sections/header-group.json', 'sections/footer-group.json'].forEach((rel) => {
  const g = readJson(rel);
  if (!g) return;
  Object.values(g.sections || {}).forEach((sec) => {
    if (!sec || !sec.type) return;
    const liquid = `sections/${sec.type}.liquid`;
    if (!exists(liquid)) pushMissing(liquid, `Referenced by ${rel}`);
  });
});

// main-404 schema
if (exists('sections/main-404.liquid')) {
  const t = fs.readFileSync(path.join(root, 'sections/main-404.liquid'), 'utf8');
  if (!/\{\%\s*schema\s*\%\}/.test(t)) {
    issues.push({ file: 'sections/main-404.liquid', why: 'Missing {% schema %} — 404.json may fail to save' });
  } else {
    ok.push('main-404.liquid has schema');
  }
}

console.log('✓ OK (' + ok.length + ')');
ok.slice(0, 12).forEach((m) => console.log('  ·', m));
if (ok.length > 12) console.log('  · …', ok.length - 12, 'more');

if (warnings.length) {
  console.log('\n⚠ WARNINGS (' + warnings.length + ')');
  warnings.forEach((w) => console.log('  ·', w.file, '—', w.why));
}

if (issues.length) {
  console.log('\n✗ ISSUES THAT CAUSE / SHOW AS 404 (' + issues.length + ')');
  issues.forEach((i, n) => console.log(`  ${n + 1}. [${i.file}]\n     ${i.why}`));
  console.log('\nFix the issues above, then re-upload those files to Shopify Admin → Edit code.\n');
  process.exit(1);
}

console.log('\nNo blocking 404 causes found in local theme files.\n');
process.exit(0);

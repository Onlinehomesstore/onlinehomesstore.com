/**
 * UNIK CARE — clean error-free theme ZIP
 * - Validates + sanitizes all JSON templates
 * - Scans Liquid for illegal filter-in-named-args
 * - Excludes unused assets + all non-Shopify junk
 * - Forward-slash zip → ../UNIK CARE.zip
 *
 * Run: node _build_clean_zip.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readShopifyJson } = require('./_shopify_json');

const themeRoot = __dirname;
const outDir = path.join(themeRoot, '..');
const outZip = path.join(outDir, 'UNIK CARE.zip');
const staging = path.join(outDir, '_uc_theme_zip_staging');
const KEEP = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];

/** Always keep even if static scan misses dynamic refs */
const ASSET_KEEP = new Set([
  'base.css',
  'global.js',
  'constants.js',
  'pubsub.js',
  'animations.js',
  'password-modal.js',
  'section-password.css',
  'customer.css',
  'customer.css',
  'mask-blobs.css',
  'collage.css',
  'video-section.css',
  'component-volume-pricing.css',
  'component-swatch.css',
  'component-swatch-input.css',
  'component-product-variant-picker.css',
  'component-product-model.css',
  'component-pickup-availability.css',
  'component-complementary-products.css',
  'component-accordion.css',
  'component-cart-items.css',
  'component-cart-drawer.css',
  'component-cart.css',
  'component-totals.css',
  'component-price.css',
  'component-discounts.css',
  'component-loading-overlay.css',
  'component-show-more.css',
  'component-slideshow.css',
  'component-list-menu.css',
  'component-search.css',
  'component-menu-drawer.css',
  'component-newsletter.css',
  'component-rte.css',
  'component-deferred-media.css',
  'component-model-viewer-ui.css',
  'component-pagination.css',
  'component-facets.css',
  'component-article-card.css',
  'component-card.css',
  'component-collection-hero.css',
  'component-image-with-text.css',
  'component-mega-menu.css',
  'component-modal-video.css',
  'component-predictive-search.css',
  'component-rating.css',
  'component-slider.css',
  'component-cart-notification.css',
  'localization-form.js',
  'component-localization-form.css',
  'predictive-search.js',
  'cart-drawer.js',
  'cart.js',
  'cart-notification.js',
  'product-form.js',
  'product-info.js',
  'product-modal.js',
  'media-gallery.js',
  'product-model.js',
  'pickup-availability.js',
  'show-more.js',
  'recipient-form.js',
  'share.js',
  'main-search.js',
  'facets.js',
  'password.js',
  'customer.js',
  'customer.js.liquid',
  'customer-styles.css',
  'customer-styles.css.liquid',
  'customer.styles.js',
  'customer.styles.js.liquid',
  'theme-editor.js',
  'quick-add.css',
  'quick-add.js',
  'quantity-popover.css',
  'quantity-popover.js',
  'price-per-item.js',
  'product-info.js',
  'sparkle.gif',
]);

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function listFiles(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '.DS_Store') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

function walkLiquidAndJson(cb) {
  for (const folder of KEEP) {
    const dir = path.join(themeRoot, folder);
    if (!fs.existsSync(dir)) continue;
    for (const rel of listFiles(dir)) {
      if (!/\.(liquid|json)$/i.test(rel)) continue;
      const fp = path.join(dir, rel);
      cb(fp, fs.readFileSync(fp, 'utf8'), folder + '/' + rel);
    }
  }
}

function collectReferencedAssets() {
  const refs = new Set(ASSET_KEEP);
  const assetRe =
    /['"]([a-zA-Z0-9][\w.\-]*\.(?:css|js|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|eot|json|liquid))['"]/g;
  const urlRe =
    /url\(\s*['"]?\.?\/?([a-zA-Z0-9][\w.\-]*\.(?:css|js|svg|png|jpg|jpeg|gif|webp|woff2?))['"]?\s*\)/gi;
  const tiktokPosterRe = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/gi;
  walkLiquidAndJson((_fp, text) => {
    let m;
    while ((m = assetRe.exec(text))) refs.add(m[1]);
    while ((m = urlRe.exec(text))) refs.add(m[1]);
    while ((m = tiktokPosterRe.exec(text))) refs.add(`pvr-poster-${m[1]}.jpg`);
  });
  // Also scan CSS/JS assets for relative url() / import refs
  const assetsDir = path.join(themeRoot, 'assets');
  for (const name of fs.readdirSync(assetsDir)) {
    if (!/\.(css|js)$/i.test(name)) continue;
    const text = fs.readFileSync(path.join(assetsDir, name), 'utf8');
    let m;
    while ((m = urlRe.exec(text))) refs.add(m[1]);
    while ((m = assetRe.exec(text))) refs.add(m[1]);
  }
  for (const name of fs.readdirSync(assetsDir)) {
    if (name.endsWith('.liquid')) {
      const bare = name.replace(/\.liquid$/, '');
      if (refs.has(bare)) refs.add(name);
    }
  }
  return refs;
}

function collectReferencedSnippets() {
  const refs = new Set();
  // {% render 'x' %} / {% include 'x' %} AND bare liquid-tag: render 'x'
  const re = /(?:\{%-?\s*)?(?:render|include)\s+['"]([^'"]+)['"]/g;
  walkLiquidAndJson((_fp, text) => {
    let m;
    while ((m = re.exec(text))) refs.add(m[1].replace(/\.liquid$/, ''));
  });
  return refs;
}

function collectReferencedSections() {
  const refs = new Set();
  // From JSON templates / groups
  walkLiquidAndJson((fp, text, rel) => {
    if (!rel.endsWith('.json')) return;
    try {
      const data = JSON.parse(text);
      for (const sec of Object.values(data.sections || {})) {
        if (sec && sec.type) refs.add(sec.type);
      }
    } catch (_) {}
  });
  // section / sections tags
  const re = /\{%-?\s*section(?:s)?\s+['"]([^'"]+)['"]/g;
  walkLiquidAndJson((_fp, text) => {
    let m;
    while ((m = re.exec(text))) refs.add(m[1].replace(/\.liquid$/, ''));
  });
  return refs;
}

function hasSchema(sectionFile) {
  const t = fs.readFileSync(sectionFile, 'utf8');
  return /\{\%\s*schema\s*\%\}/.test(t);
}

function sanitizeAllTemplates() {
  execFileSync(process.execPath, [path.join(themeRoot, '_fix_upload.js')], {
    stdio: 'inherit',
    cwd: themeRoot,
  });

  const sectionSchemas = {};
  function extractSchema(file) {
    if (sectionSchemas[file] !== undefined) return sectionSchemas[file];
    const t = fs.readFileSync(file, 'utf8');
    const m = t.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    sectionSchemas[file] = m ? JSON.parse(m[1]) : null;
    return sectionSchemas[file];
  }

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

  function rgbaToHexApprox(rgba) {
    const m = String(rgba).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return '#B68A35';
    const hex = (n) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`.toUpperCase();
  }

  function cleanSettings(settings, schemaSettings) {
    if (!settings) return {};
    const map = Object.fromEntries((schemaSettings || []).filter((s) => s.id).map((s) => [s.id, s]));
    const next = {};
    for (const [k, v] of Object.entries(settings)) {
      if (typeof v === 'string' && v.startsWith('shopify://')) continue;
      if (typeof v === 'string' && v.includes('{{')) continue;
      const s = map[k];
      if (s && RESOURCE.has(s.type)) continue;
      if (s && COLOR.has(s.type)) {
        if (v === '' || v === null) continue;
        if (typeof v === 'string' && v.includes('rgba') && s.type === 'color') {
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

  function sanitizeOne(tplPath) {
    const data = readShopifyJson(tplPath);
    for (const sid of Object.keys(data.sections || {})) {
      if (!(data.order || []).includes(sid)) delete data.sections[sid];
    }
    for (const [sid, sec] of Object.entries(data.sections || {})) {
      const schemaPath = path.join(themeRoot, 'sections', `${sec.type}.liquid`);
      if (!fs.existsSync(schemaPath)) {
        delete data.sections[sid];
        data.order = (data.order || []).filter((id) => id !== sid);
        continue;
      }
      const schema = extractSchema(schemaPath);
      if (!schema) continue;
      sec.settings = cleanSettings(sec.settings, schema.settings);
      const bmap = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
      const order = new Set(sec.block_order || Object.keys(sec.blocks || {}));
      for (const bid of Object.keys(sec.blocks || {})) {
        if (!order.has(bid)) delete sec.blocks[bid];
      }
      for (const [bid, block] of Object.entries(sec.blocks || {})) {
        const bt = bmap[block.type];
        if (!bt) {
          delete sec.blocks[bid];
          if (sec.block_order) sec.block_order = sec.block_order.filter((id) => id !== bid);
          continue;
        }
        block.settings = cleanSettings(block.settings, bt.settings);
      }
    }
    fs.writeFileSync(tplPath, JSON.stringify(data, null, 2) + '\n');
  }

  const tplRoot = path.join(themeRoot, 'templates');
  for (const rel of listFiles(tplRoot)) {
    if (!rel.endsWith('.json')) continue;
    sanitizeOne(path.join(tplRoot, rel));
  }
  for (const g of ['header-group.json', 'footer-group.json', 'overlay-group.json']) {
    const gp = path.join(themeRoot, 'sections', g);
    if (fs.existsSync(gp)) {
      // light pass via sanitizeOne shape (groups have no order)
      const data = readShopifyJson(gp);
      for (const [, sec] of Object.entries(data.sections || {})) {
        const schemaPath = path.join(themeRoot, 'sections', `${sec.type}.liquid`);
        if (!fs.existsSync(schemaPath)) continue;
        const schema = extractSchema(schemaPath);
        if (!schema) continue;
        sec.settings = cleanSettings(sec.settings, schema.settings);
        const bmap = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
        for (const [bid, block] of Object.entries(sec.blocks || {})) {
          const bt = bmap[block.type];
          if (!bt) continue;
          block.settings = cleanSettings(block.settings, bt.settings);
        }
      }
      fs.writeFileSync(gp, JSON.stringify(data, null, 2) + '\n');
    }
  }
  console.log('All JSON templates sanitized.');
}

function removeLegacyProductTemplates() {
  const tplDir = path.join(themeRoot, 'templates');
  for (const name of fs.readdirSync(tplDir)) {
    if (/^product\..+\.json$/i.test(name)) {
      fs.unlinkSync(path.join(tplDir, name));
      console.log('Removed legacy', name);
    }
  }
  const safePath = path.join(tplDir, 'product.safe.json');
  if (fs.existsSync(safePath)) {
    fs.unlinkSync(safePath);
    console.log('Deleted product.safe.json');
  }
}

function copyDirFiltered(src, dest, { skipAssets = new Set(), skipSnippets = new Set() } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.DS_Store') continue;
    if (entry.name.startsWith('_') && entry.isFile()) continue;
    if (/\.(bak|tmp|old|log)$/i.test(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirFiltered(s, d, { skipAssets, skipSnippets });
    } else {
      const folder = path.basename(src);
      if (folder === 'assets' && skipAssets.has(entry.name)) continue;
      if (folder === 'snippets' && skipSnippets.has(entry.name.replace(/\.liquid$/, ''))) continue;
      fs.copyFileSync(s, d);
    }
  }
}

console.log('══════════════════════════════════════════════════');
console.log(' UNIK CARE — CLEAN ERROR-FREE THEME ZIP');
console.log('══════════════════════════════════════════════════\n');

console.log('── 1/7 Liquid named-arg scan');
execFileSync(process.execPath, [path.join(themeRoot, '_scan_liquid_args.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 2/7 Sanitize all templates');
sanitizeAllTemplates();
removeLegacyProductTemplates();

console.log('\n── 3/7 Strict validation');
execFileSync(process.execPath, [path.join(themeRoot, '_validate_strict.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 4/7 Diagnose');
execFileSync(process.execPath, [path.join(themeRoot, '_diagnose_theme.js')], {
  stdio: 'inherit',
  cwd: themeRoot,
});

console.log('\n── 5/7 Find unused assets / orphan snippets');
const assetRefs = collectReferencedAssets();
const snippetRefs = collectReferencedSnippets();

const allAssets = fs.readdirSync(path.join(themeRoot, 'assets'));
const unusedAssets = allAssets.filter((name) => {
  // Dawn icon picker builds icon-*.svg at runtime — never drop
  if (/^icon-.*\.svg$/i.test(name)) return false;
  if (ASSET_KEEP.has(name)) return false;
  if (assetRefs.has(name)) return false;
  const base = name.replace(/\.(css|js|svg)$/i, '');
  if ([...assetRefs].some((r) => r.replace(/\.(css|js|svg)$/i, '') === base)) return false;
  if (name.endsWith('.liquid') && assetRefs.has(name.replace(/\.liquid$/, ''))) return false;
  return true;
});

const allSnippets = fs
  .readdirSync(path.join(themeRoot, 'snippets'))
  .filter((f) => f.endsWith('.liquid'))
  .map((f) => f.replace(/\.liquid$/, ''));

// Never drop core Dawn / shared snippets
const SNIPPET_KEEP = new Set([
  'meta-tags',
  'css-variables',
  'icon-accordion',
  'icon-with-text',
  'product-thumbnail',
  'product-media',
  'product-media-gallery',
  'product-media-modal',
  'buy-buttons',
  'price',
  'card-product',
  'card-collection',
  'header-drawer',
  'header-dropdown-menu',
  'header-mega-menu',
  'header-search',
  'cart-drawer',
  'cart-notification',
  'facets',
  'pagination',
  'social-icons',
  'share-button',
  'swatch',
  'swatch-input',
  'quantity-input',
  'loading-spinner',
  'progress-bar',
  'gift-card-recipient-form',
  'country-localization',
  'language-localization',
  'uc-section-vars',
  'uc-section-colors',
  'uc-icon',
  'uc-image',
  'uc-product-card',
  'uc-error-diagnostics',
  'uc-design-system',
  'uc-video-poster',
  'uc-accordion',
  'uc-ph-content-stack',
  'uc-ph-overlay-css',
  'uc-ph-responsive-css',
  'uc-ph-slide-picture',
]);

const unusedSnippets = allSnippets.filter((name) => {
  if (SNIPPET_KEEP.has(name)) return false;
  if (snippetRefs.has(name)) return false;
  return true;
});

// NEVER drop section files — Shopify Section Rendering API needs schema-less
// helpers like cart-drawer, predictive-search, pickup-availability.
const unusedSections = [];

console.log('Unused assets to EXCLUDE from zip:', unusedAssets.length);
unusedAssets.slice(0, 40).forEach((a) => console.log('  -', a));
if (unusedAssets.length > 40) console.log('  … +' + (unusedAssets.length - 40) + ' more');
console.log('Orphan snippets to EXCLUDE:', unusedSnippets.length);
unusedSnippets.forEach((s) => console.log('  -', s + '.liquid'));
console.log('Sections excluded: 0 (all kept for Theme Editor + Section API)');

const skipAssets = new Set(unusedAssets);
const skipSnippets = new Set(unusedSnippets);

console.log('\n── 6/7 Stage Shopify folders only');
rimraf(staging);
fs.mkdirSync(staging, { recursive: true });

let stagedCount = 0;
for (const name of KEEP) {
  const src = path.join(themeRoot, name);
  const dest = path.join(staging, name);
  if (name === 'assets') {
    copyDirFiltered(src, dest, { skipAssets });
  } else if (name === 'snippets') {
    copyDirFiltered(src, dest, { skipSnippets });
  } else {
    copyDirFiltered(src, dest);
  }
  const n = listFiles(dest).length;
  stagedCount += n;
  console.log('  +', name, '(' + n + ' files)');
}

// Ensure product.safe never in staging
const badSafe = path.join(staging, 'templates', 'product.safe.json');
if (fs.existsSync(badSafe)) fs.unlinkSync(badSafe);

console.log('\n── 7/7 Pack forward-slash ZIP');
if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(themeRoot, '_zip_forwardslash.ps1'),
    '-SourceDir',
    staging,
    '-DestZip',
    outZip,
  ],
  { stdio: 'inherit' }
);

const zipMeta = execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${outZip.replace(/'/g, "''")}'); $names=$z.Entries | Where-Object { -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName -replace '\\\\','/' }; $z.Dispose(); Write-Output $names.Count; if ($names | Where-Object { $_ -match '\\\\' }) { 'HAS_BACKSLASH' } else { 'FORWARD_SLASH_OK' }; if ($names | Where-Object { $_ -match 'node_modules|_build_|docs/' }) { 'HAS_JUNK' } else { 'NO_JUNK' }; if ($names | Where-Object { $_ -eq 'templates/product.safe.json' }) { 'HAS_SAFE' } else { 'NO_SAFE' }`,
  ],
  { encoding: 'utf8' }
)
  .trim()
  .split(/\r?\n/)
  .map((l) => l.trim());

rimraf(staging);

const sizeMb = (fs.statSync(outZip).size / 1024 / 1024).toFixed(2);
const zipCount = parseInt(zipMeta[0], 10);

if (zipMeta[1] !== 'FORWARD_SLASH_OK') {
  console.error('ZIP path separator FAIL');
  process.exit(1);
}
if (zipMeta[2] !== 'NO_JUNK') {
  console.error('Junk found in zip');
  process.exit(1);
}
if (zipMeta[3] !== 'NO_SAFE') {
  console.error('product.safe.json leaked into zip');
  process.exit(1);
}
if (zipCount !== stagedCount) {
  console.error('Zip count', zipCount, '!= staged', stagedCount);
  process.exit(1);
}

console.log('\n══════════════════════════════════════════════════');
console.log(' CLEAN THEME READY');
console.log(' File :', outZip);
console.log(' Size :', sizeMb, 'MB');
console.log(' Files:', zipCount);
console.log(' Excluded unused assets:', unusedAssets.length);
console.log(' Excluded orphan snippets:', unusedSnippets.length);
console.log(' Paths:', zipMeta[1], '|', zipMeta[2], '|', zipMeta[3]);
console.log('');
console.log(' Upload: Admin → Themes → Add theme → Upload zip');
console.log('══════════════════════════════════════════════════');

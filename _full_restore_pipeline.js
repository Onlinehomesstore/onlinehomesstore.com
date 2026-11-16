/**
 * Full restore pipeline:
 * 1) Load last-working store index base (with shopify:// images)
 * 2) Apply hair-colour copy
 * 3) Write INDEX_ADMIN_PASTE.json (WITH media — paste in Admin Edit code)
 * 4) Write templates/index.json ZIP-safe (NO media/handles — for ZIP upload)
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
  if (Number.isInteger(step)) nv = Math.round(nv);
  return nv;
}

function pruneAndClean(sec, { stripShopify, stripResources }) {
  const sch = schemaOf(sec.type);
  const RESOURCE = new Set(['product', 'collection', 'blog', 'article', 'page', 'image_picker', 'video']);
  function clean(settings, schemaSettings) {
    const map = settingMap(schemaSettings);
    const next = {};
    for (const [k, v] of Object.entries(settings || {})) {
      const def = map[k];
      if (!def) continue;
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
  const next = {
    type: sec.type,
    settings: clean(sec.settings, sch.settings),
  };
  if (sec.name) next.name = String(sec.name).replace(/&/g, 'and');
  if (sec.blocks) {
    next.blocks = {};
    const bmap = Object.fromEntries((sch.blocks || []).map((b) => [b.type, b]));
    for (const [bid, blk] of Object.entries(sec.blocks)) {
      const bdef = bmap[blk.type];
      if (!bdef) continue;
      next.blocks[bid] = { type: blk.type, settings: clean(blk.settings, bdef.settings) };
    }
    next.block_order = (sec.block_order || Object.keys(next.blocks)).filter((id) => next.blocks[id]);
  }
  return next;
}

function applyCopy(j) {
  const hero = j.sections.uc_hero_home.blocks;
  hero.slide_1.settings.subheading = 'UNIK CARE HAIR COLOUR';
  hero.slide_1.settings.heading = '<p>Beautiful colour. Made beautifully simple.</p>';
  hero.slide_1.settings.description =
    'Discover effortless hair colour designed for beautiful, natural looking results from the comfort of home.';
  hero.slide_1.settings.button_label = 'Shop Hair Colour';
  hero.slide_1.settings.button_link = '/collections/all';
  hero.slide_1.settings.button2_label = 'Explore Our Story';
  hero.slide_1.settings.button2_link = '/pages/about';

  hero.slide_2.settings.subheading = 'COLOUR YOUR CONFIDENCE';
  hero.slide_2.settings.heading = '<p>A fresh colour can change how you feel.</p>';
  hero.slide_2.settings.description =
    'From timeless black and beautiful browns to expressive shades, find the colour that feels like you.';
  hero.slide_2.settings.button_label = 'Find Your Colour';
  hero.slide_2.settings.button_link = '/collections/all';
  hero.slide_2.settings.button2_label = 'Shop All Products';
  hero.slide_2.settings.button2_link = '/collections/all';

  hero.slide_aF4wbj.settings.subheading = 'AT HOME MADE EASY';
  hero.slide_aF4wbj.settings.heading = '<p>Colour you can trust at home.</p>';
  hero.slide_aF4wbj.settings.description =
    'Clear steps, beautiful results, and shades chosen for real everyday hair.';
  hero.slide_aF4wbj.settings.button_label = 'Shop Hair Colour';
  hero.slide_aF4wbj.settings.button_link = '/collections/all';

  const cat = j.sections.category_showcase_3emxFE;
  cat.settings.subheading = 'EXPLORE THE RITUAL';
  cat.settings.heading = 'Your colour ritual starts here.';
  cat.settings.description =
    '<p>Choose the format that fits your routine. From shampoo and gel to sachets, every option is created for beautiful colour at home.</p>';
  cat.settings.button_label = 'Shop All Colour';
  cat.settings.button_link = '/collections/all';
  const cb = cat.blocks;
  cb.category_Dq9kew.settings.heading = 'Hair Colour Shampoo';
  cb.category_Dq9kew.settings.description =
    'A simple way to refresh your colour with rich coverage and an easy application routine.';
  cb.category_Dq9kew.settings.badge = 'BESTSELLER';
  cb.category_Dq9kew.settings.button_text = 'Shop Shampoo';
  cb.category_Ex4VML.settings.heading = 'Hair Dye Gel';
  cb.category_Ex4VML.settings.description =
    'A convenient two part colour system created for controlled application and confident results.';
  cb.category_Ex4VML.settings.badge = 'PROFESSIONAL FAVOURITE';
  cb.category_Ex4VML.settings.button_text = 'Shop Gel';
  cb.category_iPiLLc.settings.heading = 'Hair Colour Sachets';
  cb.category_iPiLLc.settings.description =
    'Portion ready colour made for easy mixing and dependable coverage when you need it.';
  cb.category_iPiLLc.settings.button_text = 'Shop Sachets';
  cb.category_QfqfDN.settings.heading = 'Shop All Colour';
  cb.category_QfqfDN.settings.description =
    'Explore the full UNIK CARE hair colour collection in one place.';
  cb.category_QfqfDN.settings.button_text = 'View All';

  const prod = j.sections.premium_product_showcase_meM4TD.settings;
  prod.subtitle = 'COLOUR MADE FOR REAL LIFE';
  prod.title = 'Hair colour that fits your routine.';
  prod.description =
    '<p>Beautiful shades and easy formats designed for natural looking colour you can achieve at home.</p>';
  prod.view_all_label = 'Shop All Colour';

  const ba = j.sections.before_after_comparison_YFNQLG.settings;
  ba.eyebrow = 'SEE THE DIFFERENCE';
  ba.heading = 'One colour. A whole new feeling.';
  ba.description =
    '<p>See how the right shade can refresh your look and bring new confidence to your everyday routine. Results can vary from person to person depending on starting hair colour, hair condition and application.</p>';
  ba.button_label = 'Shop The Collection';
  ba.button_link = '/collections/all';
  ba.before_text = 'BEFORE';
  ba.after_text = 'AFTER';

  const vr = j.sections.visible_results_FHCmVm;
  vr.settings.eyebrow = 'WHY IT WORKS';
  vr.settings.heading = 'Colour results you can feel good about.';
  vr.settings.description =
    '<p>Created for coverage, shine and an easier at home colour experience.</p>';
  vr.settings.footnote = 'Individual results vary based on starting colour and hair condition.';
  vr.blocks.statistic_LCVFh4.settings.percentage = 'Rich Colour';
  vr.blocks.statistic_LCVFh4.settings.title = 'Beautiful colour payoff';
  vr.blocks.statistic_LCVFh4.settings.count_up = false;
  vr.blocks.statistic_Xdtyfy.settings.percentage = 'Easy Application';
  vr.blocks.statistic_Xdtyfy.settings.title = 'Designed for home use';
  vr.blocks.statistic_Xdtyfy.settings.count_up = false;
  vr.blocks.statistic_DRdDYe.settings.percentage = 'Made for Your Routine';
  vr.blocks.statistic_DRdDYe.settings.title = 'Simple and convenient';
  vr.blocks.statistic_DRdDYe.settings.count_up = false;
  vr.blocks.feature_YPL97J.settings.title = 'Natural look';
  vr.blocks.feature_YPL97J.settings.description = 'Soft, believable colour';
  vr.blocks.feature_TNJVKR.settings.title = 'Lasting shine';
  vr.blocks.feature_TNJVKR.settings.description = 'Fresh looking finish';
  vr.blocks.feature_wCjqLf.settings.title = 'Gentle feel';
  vr.blocks.feature_wCjqLf.settings.description = 'Comfort focused formulas';
  vr.blocks.feature_gz77r8.settings.title = 'At home confidence';
  vr.blocks.feature_gz77r8.settings.description = 'Clear, simple steps';

  const reels = j.sections.premium_video_reels_CikyNW.settings;
  reels.label = 'WATCH AND SHOP';
  reels.heading = 'Real colour. Real routines.';
  reels.subtitle = 'See how people use UNIK CARE at home, then shop the shades you love.';

  const pt = j.sections.product_testimonials_8GJ38D;
  pt.settings.eyebrow = 'REAL CUSTOMER STORIES';
  pt.settings.heading = 'What our customers say.';
  pt.settings.subtitle =
    'Thousands of colour routines begin with UNIK CARE. Here are some of the experiences shared by our customers.';
  pt.settings.average_rating_text = '4.9';
  pt.settings.review_count = '1,240';
  pt.settings.review_count_label = 'verified reviews';
  for (const blk of Object.values(pt.blocks)) {
    if (blk.type !== 'testimonial') continue;
    for (const key of ['review_text', 'purchased_variant', 'review_title']) {
      if (typeof blk.settings[key] === 'string') {
        blk.settings[key] = blk.settings[key].replace(/\u2014/g, ' - ').replace(/\u2013/g, ' - ');
      }
    }
  }
  pt.blocks.stat_Pz6J6T.settings.number = 'Reviews';
  pt.blocks.stat_Pz6J6T.settings.suffix = '';
  pt.blocks.stat_Pz6J6T.settings.label = 'Real experiences from our community';
  pt.blocks.stat_bKhfGt.settings.number = 'Easy';
  pt.blocks.stat_bKhfGt.settings.suffix = '';
  pt.blocks.stat_bKhfGt.settings.label = 'Designed for convenient home use';
  pt.blocks.stat_8wVMK9.settings.number = 'Colour';
  pt.blocks.stat_8wVMK9.settings.suffix = '';
  pt.blocks.stat_8wVMK9.settings.label = 'Multiple shades and formats';
  pt.blocks.stat_PrHU4d.settings.number = 'Support';
  pt.blocks.stat_PrHU4d.settings.suffix = '';
  pt.blocks.stat_PrHU4d.settings.label = 'Here when you need us';

  const blog = j.sections.uc_blog_home.settings;
  blog.eyebrow = 'FROM THE UNIK CARE JOURNAL';
  blog.heading = 'Hair colour knowledge worth knowing.';
  blog.description =
    'Helpful guides, colour inspiration and practical advice to help you feel more confident about your hair colour routine.';
  blog.btn_label = 'Read The Journal';
  blog.read_more_label = 'Read article';
}

const base = JSON.parse(fs.readFileSync('_working_index_base.json', 'utf8'));
const full = { sections: {}, order: base.order };
for (const [id, sec] of Object.entries(base.sections)) {
  full.sections[id] = pruneAndClean(sec, { stripShopify: false, stripResources: false });
}
applyCopy(full);

// ADMIN PASTE (with images + collections)
fs.writeFileSync(path.join('..', 'INDEX_ADMIN_PASTE.json'), JSON.stringify(full, null, 2) + '\n');

// ZIP-SAFE
const zip = { sections: {}, order: full.order.slice() };
for (const [id, sec] of Object.entries(full.sections)) {
  zip.sections[id] = pruneAndClean(sec, { stripShopify: true, stripResources: true });
}
if (zip.sections.before_after_comparison_YFNQLG?.settings) {
  zip.sections.before_after_comparison_YFNQLG.settings.heading_letter_spacing = -1;
}
if (zip.sections.visible_results_FHCmVm?.settings) {
  zip.sections.visible_results_FHCmVm.settings.letter_spacing = -1;
}
fs.writeFileSync('templates/index.json', JSON.stringify(zip, null, 2) + '\n');

const paste = fs.readFileSync(path.join('..', 'INDEX_ADMIN_PASTE.json'), 'utf8');
const idx = fs.readFileSync('templates/index.json', 'utf8');
console.log('PASTE shopify refs', (paste.match(/shopify:\/\//g) || []).length);
console.log('PASTE collections', (paste.match(/all-products|hair-color/g) || []).length);
console.log('ZIP shopify refs', (idx.match(/shopify:\/\//g) || []).length);
console.log('ZIP collections', (idx.match(/all-products|hair-color/g) || []).length);
console.log('ZIP tiktok', /tiktok\.com/.test(idx));
console.log('done');

/**
 * Restore last-working index.json structure (images, collections, videos, floats)
 * then apply hair-colour copy ONLY onto text fields.
 * Strip any settings not present in current section schemas (prevents Admin drop).
 */
const fs = require('fs');
const path = require('path');

function schemaOf(type) {
  const raw = fs.readFileSync(path.join('sections', type + '.liquid'), 'utf8');
  const m = raw.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  return JSON.parse(m[1]);
}

function settingMap(list) {
  return Object.fromEntries((list || []).filter((s) => s.id).map((s) => [s.id, s]));
}

function pruneToSchema(sec) {
  const sch = schemaOf(sec.type);
  const smap = settingMap(sch.settings);
  const next = {
    type: sec.type,
    settings: {},
  };
  if (sec.name) next.name = sec.name;
  for (const [k, v] of Object.entries(sec.settings || {})) {
    if (smap[k]) next.settings[k] = v;
    else console.log('prune setting', sec.type + '.' + k);
  }
  if (sec.blocks) {
    next.blocks = {};
    const bmap = Object.fromEntries((sch.blocks || []).map((b) => [b.type, b]));
    for (const [bid, blk] of Object.entries(sec.blocks)) {
      const bdef = bmap[blk.type];
      if (!bdef) {
        console.log('prune block', sec.type, bid, blk.type);
        continue;
      }
      const bsmap = settingMap(bdef.settings);
      const nb = { type: blk.type, settings: {} };
      for (const [k, v] of Object.entries(blk.settings || {})) {
        if (bsmap[k]) nb.settings[k] = v;
        else console.log('prune block setting', sec.type + '.' + bid + '.' + k);
      }
      next.blocks[bid] = nb;
    }
    if (sec.block_order) {
      next.block_order = sec.block_order.filter((id) => next.blocks[id]);
    }
  }
  return next;
}

// Restore decimal letter-spacing ranges (working store uses -0.5)
function restoreDecimalRanges(file, id) {
  let raw = fs.readFileSync(file, 'utf8');
  const re = new RegExp(
    '\\{\\s*"type":\\s*"range",\\s*"id":\\s*"' +
      id +
      '",\\s*"label":\\s*"Heading letter spacing",\\s*"min":\\s*-2,\\s*"max":\\s*2,\\s*"step":\\s*1,\\s*"unit":\\s*"px",\\s*"default":\\s*-1\\s*\\}',
    'g'
  );
  const rep =
    '{ "type": "range", "id": "' +
    id +
    '", "label": "Heading letter spacing", "min": -2, "max": 2, "step": 0.5, "unit": "px", "default": -0.5 }';
  const out = raw.replace(re, rep);
  if (out !== raw) {
    fs.writeFileSync(file, out);
    console.log('restored decimal range', file, id);
  } else {
    // also try if already decimal
    if (!raw.includes('"id": "' + id + '"') && !raw.includes('"id":"' + id + '"')) {
      console.log('range id not found', file, id);
    } else {
      console.log('range already ok or pattern mismatch', file, id);
    }
  }
}

restoreDecimalRanges('sections/before-after-comparison.liquid', 'heading_letter_spacing');
restoreDecimalRanges('sections/visible-results.liquid', 'letter_spacing');

const base = JSON.parse(fs.readFileSync('_working_index_base.json', 'utf8'));
const j = { sections: {}, order: base.order };

for (const [id, sec] of Object.entries(base.sections)) {
  j.sections[id] = pruneToSchema(sec);
}

// ——— Hair colour copy (text only; media/collections/videos untouched) ———
const hero = j.sections.uc_hero_home.blocks;
hero.slide_1.settings.subheading = 'UNIK CARE HAIR COLOUR';
hero.slide_1.settings.heading = '<p>Beautiful colour.</p><p>Made beautifully simple.</p>';
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

// Keep collection handles; update labels to match hair colour story
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
  'Beautiful shades and easy formats designed for natural looking colour you can achieve at home.';
prod.view_all_label = 'Shop All Colour';
prod.button_label = 'Shop Now';

const ba = j.sections.before_after_comparison_YFNQLG.settings;
ba.eyebrow = 'SEE THE DIFFERENCE';
ba.heading = 'One colour. A whole new feeling.';
ba.description =
  '<p>See how the right shade can refresh your look and bring new confidence to your everyday routine. Results can vary from person to person depending on starting hair colour, hair condition and application.</p>';
ba.button_label = 'Shop The Collection';
ba.button_link = '/collections/all';
ba.before_text = 'BEFORE';
ba.after_text = 'AFTER';
// keep before_image / after_image / letter spacing floats exactly as working

const vr = j.sections.visible_results_FHCmVm;
vr.settings.eyebrow = 'WHY IT WORKS';
vr.settings.heading = 'Colour results you can feel good about.';
vr.settings.description =
  '<p>Created for coverage, shine and an easier at home colour experience.</p>';
vr.settings.footnote =
  'Individual results vary based on starting colour and hair condition.';

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
// keep every reel video_url untouched

const pt = j.sections.product_testimonials_8GJ38D;
pt.settings.eyebrow = 'REAL CUSTOMER STORIES';
pt.settings.heading = 'What our customers say.';
pt.settings.subtitle =
  'Thousands of colour routines begin with UNIK CARE. Here are some of the experiences shared by our customers.';
pt.settings.average_rating_text = '4.9';
pt.settings.review_count = '1,240';
pt.settings.review_count_label = 'verified reviews';

// Clean em dashes in review text only (storefront copy rules)
for (const blk of Object.values(pt.blocks)) {
  if (blk.type !== 'testimonial') continue;
  for (const key of ['review_text', 'purchased_variant', 'review_title']) {
    if (typeof blk.settings[key] === 'string') {
      blk.settings[key] = blk.settings[key].replace(/\u2014/g, ' - ').replace(/\u2013/g, ' - ');
    }
  }
}

pt.blocks.stat_CRrNj8.settings.number = '4.9';
pt.blocks.stat_CRrNj8.settings.label = 'Average rating';
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
// keep blog: news

// Final prune after copy (in case we added unknown keys)
for (const id of Object.keys(j.sections)) {
  j.sections[id] = pruneToSchema(j.sections[id]);
}

fs.writeFileSync('templates/index.json', JSON.stringify(j, null, 2) + '\n');
console.log('Wrote templates/index.json');

// Sanity
const out = JSON.parse(fs.readFileSync('templates/index.json', 'utf8'));
const s1 = out.sections.uc_hero_home.blocks.slide_1.settings;
console.log('image kept', s1.image);
console.log('heading', s1.heading);
console.log(
  'collections',
  Object.values(out.sections.category_showcase_3emxFE.blocks).map((b) => b.settings.collection)
);
console.log(
  'reel kept',
  !!out.sections.premium_video_reels_CikyNW.blocks.reel_JFxmJL.settings.video_url
);
console.log(
  'ba images',
  out.sections.before_after_comparison_YFNQLG.settings.before_image,
  out.sections.before_after_comparison_YFNQLG.settings.after_image
);
console.log(
  'floats',
  out.sections.before_after_comparison_YFNQLG.settings.heading_letter_spacing,
  out.sections.visible_results_FHCmVm.settings.letter_spacing
);
console.log('blog', out.sections.uc_blog_home.settings.blog);

/**
 * Harden homepage index.json for Shopify upload acceptance.
 * - Single <p> richtext (multi-p can be picky on some imports)
 * - No shopify:// media locks
 * - Stable pretty JSON, no BOM
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'templates', 'index.json');
const j = JSON.parse(fs.readFileSync(file, 'utf8'));

const hero = j.sections.uc_hero_home;
if (hero?.blocks) {
  const s1 = hero.blocks.slide_1?.settings;
  const s2 = hero.blocks.slide_2?.settings;
  if (s1) {
    s1.subheading = 'UNIK CARE HAIR COLOUR';
    s1.heading = '<p>Beautiful colour. Made beautifully simple.</p>';
    s1.description =
      'Discover effortless hair colour designed for beautiful, natural looking results from the comfort of home.';
    s1.button_label = 'Shop Hair Colour';
    s1.button_link = '/collections/all';
    s1.button2_label = 'Explore Our Story';
    s1.button2_link = '/pages/about';
    s1.heading_mobile = 'Beautiful colour, made simple.';
  }
  if (s2) {
    s2.subheading = 'COLOUR YOUR CONFIDENCE';
    s2.heading = '<p>A fresh colour can change how you feel.</p>';
    s2.description =
      'From timeless black and beautiful browns to expressive shades, find the colour that feels like you.';
    s2.button_label = 'Find Your Colour';
    s2.button_link = '/collections/all';
    s2.button2_label = 'Shop All Products';
    s2.button2_link = '/collections/all';
    s2.heading_mobile = 'Find the colour that feels like you.';
  }
}

// before/after description: keep two sentences in ONE <p> to reduce richtext rejection risk
const ba = j.sections.before_after_comparison_YFNQLG?.settings;
if (ba) {
  ba.description =
    '<p>See how the right shade can refresh your look and bring new confidence to your everyday routine. Results can vary from person to person depending on starting hair colour, hair condition and application.</p>';
}

function stripShopifyImages(obj) {
  if (obj == null) return;
  if (typeof obj === 'string') return;
  if (Array.isArray(obj)) return obj.forEach(stripShopifyImages);
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === 'string' && obj[k].startsWith('shopify://shop_images/')) {
      console.log('strip media', k, obj[k]);
      obj[k] = '';
    } else if (obj[k] && typeof obj[k] === 'object') {
      stripShopifyImages(obj[k]);
    }
  }
}
stripShopifyImages(j);

fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('hardened templates/index.json');

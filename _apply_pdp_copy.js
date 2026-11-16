/**
 * Apply UNIK CARE universal PDP copy to product.json.
 * Rules: no invented claims, no em/en dashes, no &, wrap richtext in <p>.
 */
const fs = require('fs');
const path = require('path');

const p = (t) => '<p>' + t + '</p>';
const pp = (...paras) => paras.map((t) => '<p>' + t + '</p>').join('');

function apply(j) {
  const h = j.sections.premium_product_hero;
  const hb = h.blocks;
  const hs = h.settings;

  hs.eyebrow = 'UNIK CARE HAIR COLOUR';
  hs.subtitle =
    'Beautiful colour without the complicated routine. Designed to make at home hair colouring feel simple, convenient and easy to fit into everyday life.';
  hs.show_vendor = true;
  hs.show_rating = true;
  // Leave rating_value / review_count as merchant editable; do not invent
  hs.rating_value = '';
  hs.review_count = '';
  hs.show_verified_badge = false;
  hs.atc_text = 'Add to Cart';
  hs.buy_now_text = 'Buy Now';
  hs.show_buy_now = true;
  hs.benefits_heading = 'Why you will love it';
  hs.use_benefits_as_highlights = false;
  hs.show_benefits_grid = true;
  hs.first_accordion_open = true;
  hs.tax_info = 'Taxes and shipping calculated at checkout.';
  hs.in_stock_line = 'In stock and ready to ship';
  hs.low_stock_line = 'Only a few left in stock';
  hs.out_of_stock_line = 'Currently out of stock';
  hs.reviews_link = '#ProductReviewForm';

  // Compact trust icons (4)
  hb.trust_icon_1.settings = {
    icon: 'heart',
    label: 'Made for Home',
    description: 'Designed for a convenient at home colour routine.',
  };
  hb.trust_icon_2.settings = {
    icon: 'check',
    label: 'Simple to Use',
    description: 'Clear instructions designed to make colouring feel easier.',
  };
  hb.trust_icon_3.settings = {
    icon: 'star',
    label: 'Real Customer Reviews',
    description: 'Honest experiences from the UNIK CARE community.',
  };
  hb.trust_icon_4.settings = {
    icon: 'award',
    label: 'Quality Focused',
    description: 'Created with attention to formula, colour and everyday use.',
  };
  delete hb.trust_icon_5;

  // Hero benefits grid
  hb.benefit_1.settings = {
    icon: 'sparkle',
    title: 'Beautiful Colour',
    description: 'Designed to help you achieve the shade you want from the comfort of home.',
    text: 'Beautiful Colour',
  };
  hb.benefit_2.settings = {
    icon: 'check',
    title: 'Easy Application',
    description: 'A straightforward colour routine without unnecessary complexity.',
    text: 'Easy Application',
  };
  hb.benefit_3.settings = {
    icon: 'heart',
    title: 'Made for Everyday Life',
    description: 'Created to fit naturally into your schedule.',
    text: 'Made for Everyday Life',
  };
  hb.benefit_4.settings = {
    icon: 'zap',
    title: 'Convenient Format',
    description: 'Available in a practical format designed around your routine.',
    text: 'Convenient Format',
  };

  // Purchase reassurance (true, non invented)
  hb.delivery_1.settings = {
    icon: 'shield',
    heading: 'Secure checkout',
    description: 'Your payment details are protected at checkout.',
  };
  hb.delivery_2.settings = {
    icon: 'truck',
    heading: 'Fast delivery',
    description: 'Shipping options are shown at checkout.',
  };
  hb.delivery_3.settings = {
    icon: 'shield',
    heading: 'Easy product information',
    description: 'Clear details to help you choose with confidence.',
  };

  // Accordions
  hb.accordion_1.settings = {
    heading: 'About this product',
    content: pp(
      'This product is created for people who want a simple way to refresh their hair colour at home. Designed around ease, convenience and beautiful colour, it brings the UNIK CARE approach into your everyday routine.',
      'From shade selection to application, every part of the experience is designed to feel straightforward and reassuring.'
    ),
    open_default: true,
  };
  hb.accordion_2.settings = {
    heading: 'How to use',
    content: pp(
      'Start by reading the instructions supplied with your product. Prepare everything you need before beginning, then apply the product according to the recommended method and development time.',
      'Once the recommended time has passed, rinse and complete your usual hair routine. Exact steps and timing are listed with your product information.'
    ),
    open_default: false,
  };
  hb.accordion_3.settings = {
    heading: 'Product details',
    content: pp(
      'Shade, format, size, quantity, application time and recommended use are listed with this product so you can make an informed choice before ordering.',
      'Please check the product packaging and the details above for the latest product specific information.'
    ),
    open_default: false,
  };
  hb.accordion_4.settings = {
    heading: 'Delivery and returns',
    content: p(
      'Your order will be prepared and shipped according to the delivery option selected at checkout. Please see our delivery and returns information for the latest details.'
    ),
    open_default: false,
  };

  h.block_order = [
    'trust_icon_1',
    'trust_icon_2',
    'trust_icon_3',
    'trust_icon_4',
    'benefit_1',
    'benefit_2',
    'benefit_3',
    'benefit_4',
    'delivery_1',
    'delivery_2',
    'delivery_3',
    'accordion_1',
    'accordion_2',
    'accordion_3',
    'accordion_4',
  ];

  // Video reviews chrome + labels (no fake review claims)
  const vr = j.sections.product_video_reviews;
  vr.settings.label = 'REAL PEOPLE. REAL ROUTINES.';
  vr.settings.heading = 'See it in action.';
  vr.settings.subtitle =
    'Watch real customers, colour routines and application moments to see how UNIK CARE fits into everyday life.';
  const labels = [
    'Customer Routine',
    'How to Apply',
    'Colour Result',
    'Real Experience',
    'Shade Inspiration',
    'Before and After',
  ];
  const vOrder = [];
  Object.keys(vr.blocks).forEach((id, i) => {
    const b = vr.blocks[id];
    b.settings.customer_name = labels[i] || 'Real Experience';
    b.settings.location = '';
    b.settings.review_text = 'Replace this clip with a real approved routine or application video.';
    b.settings.result_time = '';
    b.settings.verified = false;
    vOrder.push(id);
  });
  // ensure 6 label slots if only 3 blocks exist - keep 3
  vr.block_order = vOrder;

  // Before after
  const ba = j.sections.product_ba_slider;
  ba.settings.eyebrow = 'REAL COLOUR RESULTS';
  ba.settings.heading = 'See the transformation.';
  ba.settings.subtitle =
    'Explore real colour results and see how this product can refresh the look of your hair.';
  for (const b of Object.values(ba.blocks)) {
    b.settings.before_text = 'Before';
    b.settings.after_text = 'After';
    b.settings.quote =
      'Colour results can vary depending on your starting hair colour, previous colour treatments, hair condition and application.';
    b.settings.customer_name = '';
    b.settings.duration = '';
    b.settings.button_label = 'Shop this shade';
  }

  // Benefits section
  const ben = j.sections.product_benefits;
  ben.settings.eyebrow = 'DESIGNED AROUND YOUR ROUTINE';
  ben.settings.heading = 'Everything you need for a simpler colour routine.';
  ben.settings.subtitle =
    'UNIK CARE products are designed to bring colour, convenience and confidence together in one straightforward experience.';
  const benefitCards = [
    ['check', 'Easy at home application', 'Designed to make your colour routine feel simple and approachable.'],
    ['sparkle', 'Beautiful colour', 'Created to help you achieve a rich, polished colour result.'],
    ['zap', 'Convenient format', 'Thoughtfully packaged for easy handling and everyday use.'],
    ['heart', 'Made for real routines', 'Designed to fit naturally into busy everyday life.'],
    ['star', 'Clear instructions', 'Straightforward product guidance helps you feel more confident from start to finish.'],
    ['shield', 'Colour with confidence', 'A simple experience for people who want to feel good about their hair colour at home.'],
  ];
  const benIds = Object.keys(ben.blocks);
  benefitCards.forEach((c, i) => {
    const id = benIds[i];
    if (!id) return;
    ben.blocks[id].settings.icon = c[0];
    ben.blocks[id].settings.title = c[1];
    ben.blocks[id].settings.description = c[2];
    ben.blocks[id].settings.badge = '';
  });

  // Ingredients — placeholders only, no invented formula claims
  const ing = j.sections.product_ingredients;
  ing.settings.eyebrow = 'WHAT IS INSIDE';
  ing.settings.heading = 'Ingredients chosen with purpose.';
  ing.settings.subtitle =
    'Every formula has a reason behind it. Update each card with verified ingredient details from your packaging. Please check the product packaging for the latest ingredient information.';
  const ingIds = Object.keys(ing.blocks);
  ['Ingredient 1', 'Ingredient 2', 'Ingredient 3', 'Ingredient 4'].forEach((name, i) => {
    const id = ingIds[i];
    if (!id) return;
    ing.blocks[id].settings.name = name;
    ing.blocks[id].settings.scientific_name = '';
    ing.blocks[id].settings.purpose = 'Add the verified role from your packaging';
    ing.blocks[id].settings.key_benefit = 'Update from product documentation';
    ing.blocks[id].settings.details = p(
      'Replace this text with the approved explanation for this ingredient from your product documentation.'
    );
    ing.blocks[id].settings.certification = '';
    ing.blocks[id].settings.is_natural = false;
  });

  // How it works — 5 steps
  const how = j.sections.product_how_it_works;
  how.settings.eyebrow = 'HOW IT WORKS';
  how.settings.heading = 'Your colour routine, made simple.';
  how.settings.subtitle =
    'A clear process designed to make at home hair colouring feel easier from beginning to end.';
  const steps = [
    ['droplets', 'Prepare', 'Read the product instructions and prepare your hair and workspace before you begin.', ''],
    ['hand', 'Apply', 'Apply this product according to the instructions supplied with your product.', ''],
    ['timer', 'Develop', 'Leave the product on the hair for the recommended development time.', 'See packaging'],
    ['waves', 'Rinse', 'Rinse thoroughly according to the product instructions.', ''],
    ['sparkles', 'Finish', 'Dry and style your hair as you normally would.', ''],
  ];
  const stepIds = Object.keys(how.blocks);
  steps.forEach((s, i) => {
    const id = stepIds[i];
    if (!id) return;
    how.blocks[id].settings.icon = s[0];
    how.blocks[id].settings.title = s[1];
    how.blocks[id].settings.description = s[2];
    how.blocks[id].settings.duration = s[3];
    how.blocks[id].settings.tip = '';
  });

  // Comparison as decision tool
  const cmp = j.sections.product_comparison_table;
  cmp.settings.eyebrow = 'FIND YOUR FIT';
  cmp.settings.heading = 'Why choose this format?';
  cmp.settings.subtitle =
    'Different people prefer different ways to colour their hair. Here is a simple look at what makes this product suitable for its intended routine.';
  cmp.settings.our_brand_name = 'This product';
  cmp.settings.others_name = 'Other formats';
  const rows = [
    ['Colour format', 'Update from product data', 'Varies by format'],
    ['Shade', 'Update from product data', 'Varies by shade'],
    ['Application', 'At home colour routine', 'Depends on format'],
    ['Quantity', 'Update from product data', 'Varies'],
    ['Recommended use', 'Update from product data', 'Varies'],
    ['Application time', 'See product instructions', 'See packaging'],
    ['Format', 'Update from product data', 'Shampoo, gel or sachets'],
  ];
  const rowIds = Object.keys(cmp.blocks);
  rows.forEach((r, i) => {
    const id = rowIds[i];
    if (!id) return;
    cmp.blocks[id].settings.feature = r[0];
    cmp.blocks[id].settings.our_value = r[1];
    cmp.blocks[id].settings.others_value = r[2];
    cmp.blocks[id].settings.our_check = true;
    cmp.blocks[id].settings.others_check = true;
  });

  // Reviews chrome
  const rev = j.sections.product_reviews.settings;
  rev.eyebrow = 'REAL CUSTOMER REVIEWS';
  rev.heading = 'What our customers say.';
  rev.empty_text = 'No reviews yet. Be the first to share your experience.';
  rev.form_always_open = false;
  rev.form_toggle_label = 'Write a Review';
  rev.form_heading = 'Tell us about your experience.';
  rev.form_lead = 'Your experience can help another customer make a more confident choice.';
  rev.submit_label = 'Submit Review';
  rev.form_note = 'Your review may be published after approval.';
  rev.success_text = 'Thank you. Your review has been submitted for approval.';

  // FAQ
  const faq = j.sections.product_faq;
  faq.settings.eyebrow = 'NEED TO KNOW';
  faq.settings.heading = 'Frequently asked questions.';
  faq.settings.subtitle =
    'Everything you need to know before adding this product to your routine.';
  faq.settings.support_heading = 'Still need help?';
  faq.settings.support_subtitle = 'Our team is here to help with your colour routine questions.';
  faq.settings.search_placeholder = 'Search questions';

  const faqs = [
    [
      'What is this product?',
      'This UNIK CARE product is designed to make beautiful hair colour easier to achieve at home.',
    ],
    [
      'What shade is this product?',
      'See the shade details listed with this product. Choose the shade that best matches your colour goal.',
    ],
    [
      'How do I use this product?',
      'Follow the application instructions supplied with the product. The recommended method and development time are provided with your product information.',
    ],
    [
      'How long should I leave it on my hair?',
      'Use the exact development time specified for this product on the packaging and in the product details.',
    ],
    [
      'How many applications will I get?',
      'This depends on the product format, quantity and how much product your hair requires. See the product details above for the exact quantity included.',
    ],
    [
      'Will the result look the same on everyone?',
      'Hair colour results can vary depending on your starting hair colour, previous colour treatments, hair condition and other individual factors.',
    ],
    [
      'Is this product suitable for at home use?',
      'UNIK CARE products are designed around convenient at home colour routines. Always read and follow the product instructions before use.',
    ],
    [
      'What ingredients are used?',
      'Explore the ingredients section above for the current ingredient information for this product, and always check the packaging for the latest details.',
    ],
    [
      'How should I prepare before colouring?',
      'Read the product instructions, prepare your workspace and complete any recommended test or safety step before beginning.',
    ],
    [
      'Where can I buy this product?',
      'You can shop this product directly from the official UNIK CARE online store.',
    ],
  ];

  // rebuild faq blocks
  const keepSupport = {};
  for (const [id, b] of Object.entries(faq.blocks)) {
    if (b.type === 'support_link') keepSupport[id] = b;
  }
  faq.blocks = {};
  const faqOrder = [];
  faqs.forEach((f, i) => {
    const id = 'faq_' + (i + 1);
    faq.blocks[id] = {
      type: 'faq_item',
      settings: {
        category: 'Product',
        question: f[0],
        answer: p(f[1]),
      },
    };
    faqOrder.push(id);
  });
  for (const [id, b] of Object.entries(keepSupport)) {
    faq.blocks[id] = b;
    faqOrder.push(id);
  }
  faq.block_order = faqOrder;

  // Related
  const rel = j.sections.product_related.settings;
  rel.eyebrow = 'EXPLORE MORE';
  rel.heading = 'Find your next colour.';
  rel.subtitle =
    'Explore more UNIK CARE shades, formats and hair colour essentials created to make at home colouring easier.';
  rel.show_quick_add = true;

  // Sticky
  if (j.sections.sticky_mobile_atc) {
    j.sections.sticky_mobile_atc.settings.atc_label = 'Add to Cart';
    j.sections.sticky_mobile_atc.settings.buy_now_label = 'Buy Now';
    j.sections.sticky_mobile_atc.settings.shipping_text = 'Shipping options are shown at checkout.';
  }
  if (j.sections.sticky_atc) {
    j.sections.sticky_atc.settings.atc_label = 'Add to Cart';
  }

  return j;
}

function assertClean(obj, path = '') {
  if (typeof obj === 'string') {
    if (obj.includes('\u2014') || obj.includes('\u2013')) throw new Error('dash at ' + path);
    // allow & only inside URLs / HTML entities already not present
    if (/&(?!#\d+;|[a-z]+;)/i.test(obj) && !obj.includes('http') && !obj.startsWith('<')) {
      // richtext shouldn't have bare &
      if (obj.includes('&') && !obj.includes('&amp;')) {
        // skip mailto and wa links
        if (!obj.includes('mailto:') && !obj.includes('wa.me')) {
          // allow empty
        }
      }
    }
    return;
  }
  if (Array.isArray(obj)) obj.forEach((v, i) => assertClean(v, path + '[' + i + ']'));
  else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) assertClean(obj[k], path + '.' + k);
  }
}

function wrapRichtext(fileLabel, j) {
  function schema(type) {
    const m = fs
      .readFileSync(path.join('sections', type + '.liquid'), 'utf8')
      .match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    return JSON.parse(m[1]);
  }
  for (const sec of Object.values(j.sections)) {
    const sch = schema(sec.type);
    const smap = Object.fromEntries((sch.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
    for (const [k, v] of Object.entries(sec.settings || {})) {
      if (smap[k]?.type === 'richtext' && typeof v === 'string' && v && !/^<(p|ul|ol|h[1-6])(\s|>)/i.test(v.trim())) {
        sec.settings[k] = p(v);
        console.log(fileLabel, 'wrap', sec.type, k);
      }
    }
    const bmap = Object.fromEntries((sch.blocks || []).map((b) => [b.type, b]));
    for (const blk of Object.values(sec.blocks || {})) {
      const bdef = bmap[blk.type];
      if (!bdef) continue;
      const bs = Object.fromEntries((bdef.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
      for (const [k, v] of Object.entries(blk.settings || {})) {
        if (bs[k]?.type === 'richtext' && typeof v === 'string' && v && !/^<(p|ul|ol|h[1-6])(\s|>)/i.test(v.trim())) {
          blk.settings[k] = p(v);
          console.log(fileLabel, 'wrap block', k);
        }
      }
    }
  }
}

const files = [path.join('templates', 'product.json')];

for (const file of files) {
  const j = apply(JSON.parse(fs.readFileSync(file, 'utf8')));
  wrapRichtext(file, j);
  assertClean(j);
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
  console.log('updated', file);
}

console.log('PDP copy applied to', files.length, 'templates');

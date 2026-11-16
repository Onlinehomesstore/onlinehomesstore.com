/**
 * Build restored product template payload (last working structure)
 */
const fs = require('fs');

let data = JSON.parse(fs.readFileSync('templates/product.json', 'utf8'));

const hero = data.sections.premium_product_hero;
hero.blocks = hero.blocks || {};
hero.block_order = hero.block_order || [];

const deliveries = {
  delivery_1: {
    type: 'delivery_card',
    settings: {
      icon: 'zap',
      heading: 'Ships in 24 hours',
      description: 'Order before 2pm for same-day dispatch',
    },
  },
  delivery_2: {
    type: 'delivery_card',
    settings: {
      icon: 'truck',
      heading: 'Free Shipping',
      description: 'On orders over PKR 2,000',
    },
  },
  delivery_3: {
    type: 'delivery_card',
    settings: {
      icon: 'recycle',
      heading: 'Easy Returns',
      description: '30-day money-back guarantee',
    },
  },
};

for (const [id, b] of Object.entries(deliveries)) {
  hero.blocks[id] = b;
  if (!hero.block_order.includes(id)) {
    const ai = hero.block_order.findIndex((x) => String(x).startsWith('accordion'));
    if (ai >= 0) hero.block_order.splice(ai, 0, id);
    else hero.block_order.push(id);
  }
}

Object.assign(hero.settings, {
  subtitle: 'Instant colour. Lasting shine. Zero damage.',
  show_vendor: true,
  show_rating: true,
  rating_value: '4.8',
  review_count: '1,240 reviews',
  show_verified_badge: true,
  verified_label: 'Verified buyers',
  reviews_link: '#ProductTestimonials',
  star_color: '#f5a623',
  tax_info: 'Taxes and shipping calculated at checkout.',
  installment_text: '',
  show_money_saved: true,
  money_saved_label: 'You save',
  show_stock_line: true,
  in_stock_line: 'In stock — ready to ship',
  low_stock_line: 'Only a few left in stock',
  out_of_stock_line: 'Currently out of stock',
  use_benefits_as_highlights: true,
  show_benefits_grid: false,
  variant_style: 'cards',
  enable_thumbnails: true,
  show_image_counter: true,
  enable_hover_zoom: true,
  gallery_col_width: 46,
  gallery_aspect_ratio: '1 / 1',
  gallery_image_fit: 'contain',
  show_badge_bestseller: true,
  badge_bestseller: 'Best Seller',
  show_badge_new: false,
  badge_new: 'New',
  show_badge_lowstock: true,
  badge_lowstock: 'Only a few left',
  lowstock_threshold: 5,
  atc_text: 'Add to cart',
  soldout_text: 'Sold out',
  atc_radius: 100,
  show_buy_now: true,
  show_payment_icons: false,
  benefits_heading: "Why you'll love it",
  first_accordion_open: true,
  max_width: 1280,
  col_gap: 48,
  stack_gap: 24,
  border_radius: 18,
  padding_top: 64,
  padding_bottom: 64,
  pad_top_lg: 80,
  pad_top_xxl: 96,
  container_max_lg: 1280,
  container_mode: 'boxed',
  use_custom_section_styles: false,
  h_size_xs: 28,
  h_size_lg: 40,
  h_size_xxl: 44,
  use_global_colors: true,
  color_scheme: 'scheme-1',
  background_color: '',
  heading_color: '',
  accent_color: '#b68a35',
});

if (hero.blocks.accordion_1) hero.blocks.accordion_1.settings.open_default = true;

data.sections.product_why_us = {
  type: 'product-why-us',
  blocks: {
    wu_1: {
      type: 'comparison_row',
      settings: {
        feature: 'Ammonia-free formula',
        our_check: true,
        our_detail: '',
        others_check: false,
        other_detail: '',
      },
    },
    wu_2: {
      type: 'comparison_row',
      settings: {
        feature: 'Covers grey hair 100%',
        our_check: true,
        our_detail: 'From first use',
        others_check: true,
        other_detail: 'Partial coverage',
      },
    },
    wu_3: {
      type: 'comparison_row',
      settings: {
        feature: 'No harsh chemicals',
        our_check: true,
        our_detail: '',
        others_check: false,
        other_detail: '',
      },
    },
    wu_4: {
      type: 'comparison_row',
      settings: {
        feature: 'Long-lasting colour',
        our_check: true,
        our_detail: 'Up to 6 weeks',
        others_check: true,
        other_detail: '2-3 weeks',
      },
    },
    wu_5: {
      type: 'comparison_row',
      settings: {
        feature: 'Dermatologically tested',
        our_check: true,
        our_detail: '',
        others_check: false,
        other_detail: '',
      },
    },
    wu_6: {
      type: 'comparison_row',
      settings: {
        feature: '30-day guarantee',
        our_check: true,
        our_detail: '',
        others_check: false,
        other_detail: '',
      },
    },
    wu_stat_1: {
      type: 'stat',
      settings: { prefix: '', number: '50000', suffix: '+', label: 'Happy Customers' },
    },
    wu_stat_2: {
      type: 'stat',
      settings: { prefix: '', number: '98', suffix: '%', label: 'Positive Reviews' },
    },
  },
  block_order: ['wu_1', 'wu_2', 'wu_3', 'wu_4', 'wu_5', 'wu_6', 'wu_stat_1', 'wu_stat_2'],
  settings: {
    eyebrow: 'Why choose us',
    heading: 'Why choose us',
    subtitle: 'Not all colour shampoos are equal. See what sets us apart.',
    heading_alignment: 'center',
    our_brand_name: 'UNIK CARE',
    others_name: 'Other Brands',
    stats_heading: 'Trusted by thousands',
    padding_top: 64,
    padding_bottom: 64,
    card_radius: 24,
    pad_top_lg: 80,
    pad_top_xxl: 96,
    container_max_lg: 1280,
    container_mode: 'boxed',
    use_custom_section_styles: false,
    h_size_xs: 28,
    h_size_lg: 40,
    h_size_xxl: 44,
    use_global_colors: true,
    color_scheme: 'scheme-1',
    background_color: '',
    accent_color: '#B69A5E',
  },
};

data.sections.product_recently_viewed = {
  type: 'product-recently-viewed',
  settings: {
    eyebrow: 'Your history',
    heading: 'Recently viewed',
    max_products: 4,
    image_ratio: 'square',
    card_radius: 18,
    padding_top: 64,
    padding_bottom: 64,
    pad_top_lg: 80,
    pad_top_xxl: 96,
    container_max_lg: 1280,
    container_mode: 'boxed',
    use_custom_section_styles: false,
    h_size_xs: 28,
    h_size_lg: 40,
    h_size_xxl: 44,
    use_global_colors: true,
    color_scheme: 'scheme-2',
    background_color: '',
  },
};

Object.assign(data.sections.product_related.settings, {
  eyebrow: 'Explore more',
  heading: 'You may also like',
  subtitle: '',
  products_to_show: 4,
  recommendation_intent: 'related',
  image_ratio: 'square',
  show_rating: true,
  show_quick_add: true,
  show_savings: true,
  show_vendor: false,
  card_radius: 18,
  padding_top: 64,
  padding_bottom: 64,
  pad_top_lg: 80,
  pad_top_xxl: 96,
  container_max_lg: 1280,
  container_mode: 'boxed',
  use_custom_section_styles: false,
  h_size_xs: 28,
  h_size_lg: 40,
  h_size_xxl: 44,
  use_global_colors: true,
  color_scheme: 'scheme-1',
  background_color: '',
});

if (data.sections.footer_upsell) {
  Object.assign(data.sections.footer_upsell.settings, {
    show_shipping_progress: true,
    free_shipping_threshold: 2000,
    show_guarantees: true,
    show_upsells: false,
    show_bundle_cta: true,
  });
  // ensure guarantee blocks exist
  data.sections.footer_upsell.blocks = data.sections.footer_upsell.blocks || {};
  const g = data.sections.footer_upsell.blocks;
  if (!g.guarantee_1) {
    g.guarantee_1 = {
      type: 'guarantee',
      settings: {
        icon: 'rotate-ccw',
        title: 'Free Returns',
        text: 'Return any unopened product within 30 days for a full refund, no questions asked.',
      },
    };
    g.guarantee_2 = {
      type: 'guarantee',
      settings: {
        icon: 'lock',
        title: 'Secure Payments',
        text: 'All transactions are encrypted and processed securely.',
      },
    };
    g.guarantee_3 = {
      type: 'guarantee',
      settings: {
        icon: 'zap',
        title: 'Fast Dispatch',
        text: 'Orders placed before 2 PM are dispatched the same day, Monday to Saturday.',
      },
    };
    const bo = data.sections.footer_upsell.block_order || [];
    ['guarantee_1', 'guarantee_2', 'guarantee_3'].forEach((id) => {
      if (!bo.includes(id)) bo.push(id);
    });
    data.sections.footer_upsell.block_order = bo;
  }
}

if (data.sections.sticky_mobile_atc) {
  Object.assign(data.sections.sticky_mobile_atc.settings, {
    show_info_bar: true,
    show_variant_selector: true,
    show_quantity: false,
    show_buy_now: true,
    show_on_desktop: false,
    atc_label: 'Add to Cart',
    sold_out_label: 'Sold Out',
    buy_now_label: 'Buy Now',
    shipping_text: 'Free delivery on orders over Rs. 2,000',
    low_stock_threshold: 5,
    z_index: 300,
  });
}

if (data.sections.sticky_atc) {
  Object.assign(data.sections.sticky_atc.settings, {
    show_image: true,
    show_title: true,
    show_variant_selector: true,
    show_quantity: true,
    atc_label: 'Add to Cart',
    sold_out_label: 'Sold Out',
    enable_animation: true,
    z_index: 200,
  });
}

// Enrich FAQ search placeholder
if (data.sections.product_faq) {
  Object.assign(data.sections.product_faq.settings, {
    show_search: true,
    search_placeholder: 'Search questions…',
    show_support_card: true,
  });
}

data.order = [
  'premium_product_hero',
  'product_video_reviews',
  'product_ba_slider',
  'product_benefits',
  'product_why_us',
  'product_ingredients',
  'product_how_it_works',
  'product_comparison_table',
  'product_reviews',
  'product_faq',
  'product_related',
  'product_recently_viewed',
  'sticky_atc',
  'sticky_mobile_atc',
  'footer_upsell',
];

fs.writeFileSync('_user_product_restore.json', JSON.stringify(data, null, 2));
console.log('OK sections', Object.keys(data.sections).length);
console.log(data.order.join(' -> '));

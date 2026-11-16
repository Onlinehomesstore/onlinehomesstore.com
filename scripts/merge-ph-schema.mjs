import fs from 'fs';
import path from 'path';

const root = new URL('..', import.meta.url);
const liquidPath = new URL('sections/uc-premium-hero.liquid', root);
const sectionSettings = JSON.parse(fs.readFileSync(new URL('snippets/_ph-section-settings.json', root), 'utf8'));
const floatSettings = JSON.parse(fs.readFileSync(new URL('snippets/_ph-float-settings.json', root), 'utf8'));
const annoSettings = JSON.parse(fs.readFileSync(new URL('snippets/_ph-anno-settings.json', root), 'utf8'));

const liquid = fs.readFileSync(liquidPath, 'utf8');
const schemaStart = liquid.indexOf('{% schema %}');
const schemaEnd = liquid.indexOf('{% endschema %}');
const before = liquid.slice(0, schemaStart);

const keepSettings = [
  { type: 'header', content: 'Background media' },
  { type: 'select', id: 'media_type', label: 'Media type', default: 'image', options: [
    { value: 'image', label: 'Image' }, { value: 'video', label: 'Video' },
  ]},
  { type: 'image_picker', id: 'image_desktop', label: 'Desktop image' },
  { type: 'image_picker', id: 'image_laptop', label: 'Laptop image' },
  { type: 'image_picker', id: 'image_tablet', label: 'Tablet image' },
  { type: 'image_picker', id: 'image_mobile', label: 'Mobile image' },
  { type: 'text', id: 'image_alt', label: 'Image alt text' },
  { type: 'video', id: 'video_desktop', label: 'Desktop video' },
  { type: 'video', id: 'video_mobile', label: 'Mobile video' },
  { type: 'checkbox', id: 'video_autoplay', label: 'Video autoplay', default: true },
  { type: 'checkbox', id: 'video_loop', label: 'Video loop', default: true },
  { type: 'text', id: 'overlay_color', label: 'Overlay color (CSS)', default: 'rgba(0,0,0,0.35)' },
  { type: 'range', id: 'overlay_opacity', min: 0, max: 90, step: 5, unit: '%', label: 'Overlay strength', default: 35 },
  { type: 'header', content: 'Colors' },
  { type: 'color', id: 'text_color', label: 'Text color', default: '#FFFFFF' },
  { type: 'color', id: 'accent_color', label: 'Accent color', default: '#B68A35' },
  { type: 'header', content: 'Content' },
  { type: 'text', id: 'badge', label: 'Badge / label' },
  { type: 'textarea', id: 'heading', label: 'Heading', info: 'Insert [avatars] where customer avatars should appear inline.', default: 'YOUR HAIR, OUR CRAFT — [avatars] PREMIUM CARE MADE SIMPLE' },
  { type: 'textarea', id: 'description', label: 'Description', default: 'Salon-grade hair color and care essentials — gentle formulas, rich results, delivered to your door.' },
  { type: 'text', id: 'trust_text', label: 'Trust line' },
  { type: 'header', content: 'Customer avatars' },
  { type: 'checkbox', id: 'show_avatars', label: 'Show avatars in heading', default: true },
  { type: 'text', id: 'avatars_label', label: 'Avatars aria-label', default: 'Happy customers' },
  { type: 'image_picker', id: 'avatar_1', label: 'Avatar 1' },
  { type: 'image_picker', id: 'avatar_2', label: 'Avatar 2' },
  { type: 'image_picker', id: 'avatar_3', label: 'Avatar 3' },
  { type: 'header', content: 'CTA' },
  { type: 'select', id: 'cta_style', label: 'CTA style', default: 'email_pill', options: [
    { value: 'email_pill', label: 'Email capture pill' }, { value: 'buttons', label: 'Primary + secondary buttons' },
  ]},
  { type: 'checkbox', id: 'enable_email_capture', label: 'Enable email capture', default: true },
  { type: 'text', id: 'email_placeholder', label: 'Email placeholder', default: 'Enter your email' },
  { type: 'text', id: 'email_btn_label', label: 'Email button label', default: 'Get Started' },
  { type: 'text', id: 'btn_primary_label', label: 'Primary button label', default: 'Shop Collection' },
  { type: 'url', id: 'btn_primary_url', label: 'Primary button link' },
  { type: 'text', id: 'btn_secondary_label', label: 'Secondary button label' },
  { type: 'url', id: 'btn_secondary_url', label: 'Secondary button link' },
  { type: 'color', id: 'btn_primary_bg', label: 'Primary button background', default: '#FFFFFF' },
  { type: 'color', id: 'btn_primary_text', label: 'Primary button text', default: '#171717' },
  { type: 'header', content: 'Product showcase' },
  { type: 'product', id: 'product', label: 'Featured product' },
  { type: 'image_picker', id: 'product_image', label: 'Product PNG / lifestyle image' },
  { type: 'text', id: 'product_alt', label: 'Product image alt' },
  { type: 'checkbox', id: 'product_link', label: 'Link product image', default: true },
  { type: 'header', content: 'Bottom dock' },
  { type: 'text', id: 'dock_bg', label: 'Dock background (CSS)', default: 'rgba(23,23,23,0.55)' },
  { type: 'range', id: 'dock_blur', min: 0, max: 40, step: 2, unit: 'px', label: 'Dock blur', default: 20 },
  { type: 'textarea', id: 'dock_heading', label: 'Dock center message' },
  { type: 'checkbox', id: 'show_dock_social', label: 'Show dock social icons', default: true },
  { type: 'url', id: 'social_instagram', label: 'Instagram' },
  { type: 'url', id: 'social_facebook', label: 'Facebook' },
  { type: 'url', id: 'social_twitter', label: 'X / Twitter' },
  { type: 'header', content: 'Design system' },
  { type: 'range', id: 'radius_base', min: 12, max: 32, step: 2, unit: 'px', label: 'Base border radius', default: 20 },
  { type: 'range', id: 'shadow_strength', min: 8, max: 48, step: 2, unit: 'px', label: 'Shadow spread', default: 24 },
  { type: 'range', id: 'anim_duration', min: 400, max: 1200, step: 50, unit: 'ms', label: 'Animation duration', default: 900 },
  { type: 'header', content: 'Effects' },
  { type: 'checkbox', id: 'enable_parallax', label: 'Mouse parallax (desktop)', default: true },
  { type: 'checkbox', id: 'enable_particles', label: 'Floating particles', default: true },
];

const floatBlockBase = [
  { type: 'checkbox', id: 'enabled', label: 'Enable', default: true },
  { type: 'select', id: 'zone', label: 'Zone', default: 'free', options: [
    { value: 'free', label: 'Free position' }, { value: 'dock-left', label: 'Dock left style' }, { value: 'dock-right', label: 'Dock right style' },
  ]},
  { type: 'range', id: 'radius', min: 12, max: 32, step: 2, unit: 'px', label: 'Radius', default: 20 },
  { type: 'range', id: 'blur', min: 0, max: 32, step: 2, unit: 'px', label: 'Glass blur', default: 16 },
  { type: 'range', id: 'opacity', min: 50, max: 100, step: 5, unit: '%', label: 'Opacity', default: 100 },
  { type: 'text', id: 'bg', label: 'Background (CSS)', default: 'rgba(255,255,255,0.88)' },
  { type: 'text', id: 'border', label: 'Border (CSS)', default: 'rgba(255,255,255,0.5)' },
  { type: 'checkbox', id: 'show_arrow', label: 'Show arrow icon', default: true },
  { type: 'text', id: 'heading', label: 'Heading' },
  { type: 'text', id: 'stat', label: 'Statistic' },
  { type: 'textarea', id: 'text', label: 'Text' },
  { type: 'text', id: 'badge', label: 'Badge' },
  { type: 'checkbox', id: 'show_progress', label: 'Progress bar', default: false },
  { type: 'range', id: 'progress_value', min: 0, max: 100, step: 1, unit: '%', label: 'Progress value', default: 72 },
  { type: 'color', id: 'progress_from', label: 'Progress start', default: '#B68A35' },
  { type: 'color', id: 'progress_to', label: 'Progress end', default: '#E8C56A' },
  { type: 'checkbox', id: 'show_graph', label: 'Line graph', default: false },
  { type: 'range', id: 'anim_delay', min: 0, max: 800, step: 50, unit: 'ms', label: 'Reveal delay', default: 200 },
];

const schema = {
  name: 'UC Premium Hero',
  tag: 'section',
  class: 'uc-ph-section',
  disabled_on: { groups: ['header', 'footer'] },
  settings: [
    { type: 'header', content: 'Responsive typography' },
    ...sectionSettings,
    ...keepSettings,
  ],
  blocks: [
    {
      type: 'float_card',
      name: 'Floating glass card',
      settings: [...floatBlockBase, ...floatSettings],
    },
    {
      type: 'annotation',
      name: 'Floating annotation',
      settings: [
        { type: 'checkbox', id: 'enabled', label: 'Enable', default: true },
        { type: 'text', id: 'label', label: 'Label', default: 'Natural ingredients' },
        ...annoSettings,
      ],
    },
    {
      type: 'dock_card',
      name: 'Dock stat card',
      limit: 2,
      settings: [
        { type: 'checkbox', id: 'enabled', label: 'Enable', default: true },
        { type: 'select', id: 'side', label: 'Position', default: 'left', options: [
          { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' },
        ]},
        { type: 'checkbox', id: 'show_arrow', label: 'Show arrow', default: true },
        { type: 'text', id: 'heading', label: 'Heading' },
        { type: 'text', id: 'stat', label: 'Statistic' },
        { type: 'textarea', id: 'text', label: 'Text' },
        { type: 'text', id: 'badge', label: 'Badge' },
        { type: 'checkbox', id: 'show_progress', label: 'Progress bar', default: false },
        { type: 'range', id: 'progress_value', min: 0, max: 100, step: 1, unit: '%', label: 'Progress', default: 72 },
        { type: 'color', id: 'progress_from', label: 'Progress start', default: '#B68A35' },
        { type: 'color', id: 'progress_to', label: 'Progress end', default: '#E8C56A' },
        { type: 'checkbox', id: 'show_graph', label: 'Line graph', default: false },
      ],
    },
  ],
  presets: [
    {
      name: 'UC Premium Hero',
      blocks: [
        { type: 'annotation', settings: { label: 'Ammonia-free formula', pos_x_d: 68, pos_y_d: 34 } },
        { type: 'annotation', settings: { label: 'Salon-grade results', pos_x_d: 24, pos_y_d: 48 } },
        { type: 'float_card', settings: { heading: 'Customer satisfaction', stat: '+92%', text: 'Verified reviews from UNIK CARE customers', pos_x_d: 6, pos_y_d: 58, show_graph: true } },
        { type: 'dock_card', settings: { side: 'left', heading: 'Growing community', stat: '+12%', text: 'Increase in repeat customers this year', show_progress: true, progress_value: 72 } },
        { type: 'dock_card', settings: { side: 'right', heading: 'Customer satisfaction', stat: '+92%', text: 'Based on verified product reviews', show_graph: true, badge: '+35%' } },
      ],
    },
  ],
};

const updated = before + '{% schema %}\n' + JSON.stringify(schema, null, 2) + '\n{% endschema %}\n';
fs.writeFileSync(liquidPath, updated);
console.log('Updated uc-premium-hero.liquid schema with', schema.settings.length, 'settings');

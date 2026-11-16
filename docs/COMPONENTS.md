# Reusable Components Reference

## Shared Snippets

### `uc-image.liquid` — Global responsive images

Documented in `docs/IMAGE-SYSTEM.md`. Use `role` for correct srcset/sizes and aspect-ratio wrapper.

### `uc-icon.liquid` — Lucide Icon Library

Single source of truth for all icons. 40+ authentic Lucide SVG icons.

```liquid
{% render 'uc-icon', icon: 'shield-check' %}
{% render 'uc-icon', icon: 'truck', size: 20, class: 'my-class' %}
{% render 'uc-icon', icon: 'star', label: 'Rating' %}  {# accessible #}
```

**Parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `icon` | String | `'check'` | Icon name (see list below) |
| `size` | Number | `24` | Width + height in px |
| `class` | String | `''` | Extra CSS classes |
| `stroke` | Number | `1.75` | Stroke width |
| `label` | String | `nil` | Accessible label (omit for decorative icons) |

**Available icons:**
`droplet` `droplets` `sun` `leaf` `shield` `sparkles` `heart` `star` `flask` `moon` `flower` `feather`
`check` `eye` `truck` `gift` `award` `recycle` `clock` `zap` `thumbs-up` `plus` `arrow-right` `arrow-left`
`chevron-down` `chevron-up` `chevron-left` `chevron-right`
`search` `x` `check-circle-2` `x-circle` `shield-check` `badge-check` `lock` `credit-card` `package` `rotate-ccw` `shopping-cart`
`user` `users` `message-circle` `phone` `mail` `trending-up`
`lightbulb` `waves` `timer` `hand` `send`

---

### `uc-product-card.liquid` — Portable Product Card

Reusable product card for Related Products, Recently Viewed, and any future listing section.
CSS: `uc-product-card.css` (prefix: `pc-`). JS: `uc-product-card.js`.

```liquid
{% render 'uc-product-card',
  product: some_product,
  image_ratio: 'portrait',
  show_rating: true,
  show_quick_add: true,
  show_savings: true,
  show_vendor: false,
  lazy: true,
  section_id: section.id,
  card_index: forloop.index,
  badge_type: 'bestseller',
  badge_label: 'Staff Pick'
%}
```

**Parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `product` | Object | — | Shopify product object (required) |
| `image_ratio` | String | `'portrait'` | `portrait` / `square` / `landscape` |
| `show_rating` | Boolean | `true` | Shows star rating from metafields |
| `show_quick_add` | Boolean | `true` | Shows Add to Cart button |
| `show_savings` | Boolean | `true` | Shows "Save X%" badge |
| `show_vendor` | Boolean | `false` | Shows vendor name |
| `lazy` | Boolean | `true` | Lazy-loads images |
| `section_id` | String | `'uc'` | Used for unique form IDs |
| `card_index` | Number | `0` | Used for unique form IDs |
| `badge_type` | String | auto | `sale` / `bestseller` / `new` |
| `badge_label` | String | auto | Custom badge text override |

**Rating sources** (checked in order):
1. `product.metafields.reviews.rating` (Shopify Reviews app)
2. `product.metafields.loox.avg_rating` (Loox)
3. `product.metafields.judgeme.avg_rating` (Judge.me)

---

### `pf-product-card.liquid` — Premium Product Showcase Card

Used by `premium-product-showcase.liquid` only. Reads all settings from
`section.settings`. Not portable — use `uc-product-card.liquid` for new sections.

---

## CSS Utility Classes (uc-components.css)

### Section Headers

```html
<div class="uc-section-header">
  <div>
    <p class="uc-section-label">Eyebrow text</p>
    <h2 class="uc-section-title">Main heading</h2>
    <div class="uc-section-description">Optional subtitle</div>
  </div>
</div>
```

### Buttons

```html
<!-- Primary button -->
<button class="uc-btn uc-btn--primary">Shop Now</button>

<!-- Secondary / outlined -->
<button class="uc-btn uc-btn--secondary">Learn More</button>

<!-- Ghost / text -->
<button class="uc-btn uc-btn--ghost">View All</button>

<!-- Sizes -->
<button class="uc-btn uc-btn--primary uc-btn--sm">Small</button>
<button class="uc-btn uc-btn--primary uc-btn--lg">Large</button>

<!-- Loading state -->
<button class="uc-btn uc-btn--primary is-loading">...</button>
```

### Cards

```html
<div class="uc-card">
  <div class="uc-card__media"> ... </div>
  <div class="uc-card__body"> ... </div>
</div>
```

### Glass Effect

```html
<div class="uc-glass"> ... </div>        <!-- full glass -->
<div class="uc-glass-light"> ... </div>  <!-- subtle glass -->
```

---

## JavaScript Utilities

### Cart Integration (uc-product-card.js)

Handles Quick Add for all `.pc-card__form` elements via event delegation.
No initialization required — works automatically on page load and after
section reloads in Theme Editor.

```js
/* Trigger cart update event for other listeners (e.g., cart drawer) */
window.publish(window.PUB_SUB_EVENTS.cartUpdate, { cart: cartObject });
```

### Recently Viewed Storage (product-recently-viewed.js)

```js
/* Key: 'uc_rv_products' */
/* Value: Array of product objects */
/* Max items: configurable via section setting */
var stored = JSON.parse(localStorage.getItem('uc_rv_products') || '[]');
```

### Scroll Reveal Pattern

Any section can implement scroll reveal using the `IntersectionObserver`:

```js
var io = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
section.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
```

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s var(--ease-premium);
}
[data-reveal].is-in {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal] { opacity: 1; transform: none; transition: none; }
}
```

### Count-Up Animation

Used in Why Us (stats) and Testimonials (social proof strip):

```js
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function countUp(el) {
  var target = parseInt(el.dataset.target, 10) || 0;
  var duration = 1800;
  var start = performance.now();
  function step(now) {
    var elapsed = Math.min(now - start, duration);
    var progress = easeOut(elapsed / duration);
    el.textContent = Math.round(progress * target).toLocaleString();
    if (elapsed < duration) requestAnimationFrame(step);
    else el.textContent = el.dataset.suffix ? target + el.dataset.suffix : target;
  }
  requestAnimationFrame(step);
}
```

### Accordion Animation

All accordions use CSS `grid-template-rows` for smooth height animation
without JavaScript layout thrashing:

```css
.accordion__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.38s var(--ease-premium);
  overflow: hidden;
}
.accordion__item.is-open .accordion__body {
  grid-template-rows: 1fr;
}
.accordion__body-inner { min-height: 0; }
```

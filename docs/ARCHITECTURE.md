# Architecture Overview

## Design System

### CSS Token Architecture

All visual values are defined as CSS custom properties in `uc-design-tokens.css`.
Sections never hard-code colors, spacing, or typography values — they reference tokens.

```css
/* Colors */
--color-foreground        /* main text / borders */
--color-base-background-1 /* page background */

/* Spacing (4px grid) */
--space-1 … --space-12

/* Typography */
--heading-font
--body-font
--type-label-size
--type-label-spacing
--type-title-line
--type-body-line

/* Radius */
--radius-sm  --radius-md  --radius-lg  --radius-xl

/* Transitions */
--ease-premium   /* cubic-bezier(.22,.68,0,1.2) — signature animation curve */

/* Shadows */
--shadow-sm  --shadow-md  --shadow-lg  --shadow-xl
```

### CSS File Hierarchy

```
uc-design-tokens.css        ← Layer 1: tokens (all sections load this)
uc-image-system.css         ← Layer 1b: global image ratios & fit (theme.liquid)
uc-components.css           ← Layer 2: reusable UI patterns (buttons, cards, headers)
uc-showcase.css             ← Layer 3: layout / grid utilities
uc-module-bridge.css        ← Layer 4: cross-module compatibility
uc-product-card.css         ← Layer 5: shared product card (pc- prefix)
[section].css               ← Layer 6: section-specific styles
```

Every section follows this load order in its Liquid file:

```liquid
{{ 'uc-design-tokens.css' | asset_url | stylesheet_tag }}
{{ 'uc-components.css'    | asset_url | stylesheet_tag }}
{{ '[section].css'        | asset_url | stylesheet_tag }}
```

Shopify deduplicates stylesheet tags — even if 10 sections include `uc-design-tokens.css`,
it is only loaded once in the final HTML.

---

## CSS Naming Convention

Each section uses a unique **2–5 character prefix** to prevent class collisions:

| Section | Prefix |
|---|---|
| Premium Hero | `pph-` |
| Video Reviews | `pvr-` |
| Before/After | `ba-` |
| BA Slider | `bas-` |
| Benefits | `pb-` |
| Why Us | `pwu-` |
| Ingredients | `pi-` |
| How It Works | `hiw-` |
| Comparison | `pct-` |
| Testimonials | `pt-` |
| FAQ | `pfaq-` |
| Related Products | `prel-` |
| Recently Viewed | `prv-` |
| Sticky ATC | `satc-` |
| Sticky Mobile ATC | `sma-` |
| Footer Upsell | `fu-` |
| Product Showcase | `pf-` |
| Hero Slider | `uc-hs-` |
| Category Showcase | `uc-cat-` |
| Custom Header | `ch-` |
| Visible Results | `vr-` |
| Premium Video Reels | `pvr-` |
| Shared Product Card | `pc-` |

---

## JavaScript Architecture

### IIFE Module Pattern

Every JS file is an Immediately Invoked Function Expression (IIFE) to prevent
global scope pollution:

```js
(function () {
  'use strict';
  function init(section) { /* ... */ }
  function boot() {
    document.querySelectorAll('[data-SECTION-selector]').forEach(init);
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  /* Theme Editor support */
  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-SECTION-selector]');
    if (s) init(s);
  });
})();
```

### AJAX Cart Integration

All sections that add to cart use the same consistent pattern:

```js
fetch(rootUrl() + 'cart/add.js', {
  method: 'POST',
  body: new FormData(form),
  headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
})
.then(function () {
  return fetch(rootUrl() + 'cart.js', { headers: { 'Accept': 'application/json' } });
})
.then(function (r) { return r.json(); })
.then(function (cart) {
  publishCart(cart);   // triggers Dawn's pub/sub system
  openCartDrawer();    // opens the cart drawer
});
```

### Performance Patterns

| Technique | Where used |
|---|---|
| `IntersectionObserver` | Scroll reveal animations, sticky bars |
| `requestAnimationFrame` | Count-up animations |
| Passive event listeners | Touch + scroll handlers |
| CSS `grid-template-rows: 0fr → 1fr` | Accordion animation (no height calc) |
| `will-change: transform` | Hover/animation elements |
| `transform: translate3d` | GPU-accelerated transitions |
| Lazy loading images | All non-hero images |
| Debounced input | FAQ search |

---

## Shopify Integration Points

| Feature | Implementation |
|---|---|
| Theme Editor | All sections have `{% schema %}` with full settings |
| Variant sync | JS reads `product.variants` JSON island |
| Product Recommendations | Section rendering API (`/recommendations/products?section_id=...`) |
| Recently Viewed | `localStorage` key `uc_rv_products` |
| AJAX Cart | `fetch('/cart/add.js')` + `publish(PUB_SUB_EVENTS.cartUpdate)` |
| Cart Drawer | Custom drawer in `custom-header-cart-drawer.liquid` |
| Dynamic Checkout | Buy Now via `/cart/buy` form action |
| Metafields | Rating: `reviews.rating`, `loox.avg_rating`, `judgeme.avg_rating` |
| Markets / Localization | All strings use `| t` filter or editable schema settings |

---

## Scroll Reveal Pattern

Sections use a consistent, accessible reveal pattern:

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
[data-reveal] { opacity: 0; transform: translateY(20px); transition: opacity 0.6s, transform 0.6s; }
[data-reveal].is-in { opacity: 1; transform: none; }
```

`prefers-reduced-motion` is respected: animations are disabled when the user
has set their OS motion preference to "reduce".

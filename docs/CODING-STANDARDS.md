# Coding Standards & Naming Conventions

## Golden Rules

1. **Never duplicate** CSS, JavaScript, or Liquid that already exists.
2. **Always load** `uc-design-tokens.css` + `uc-components.css` before any section CSS.
3. **Always use** `uc-icon.liquid` for icons — never inline SVG directly in section files.
4. **Always scope** JavaScript inside an IIFE with `'use strict'`.
5. **Always support** `shopify:section:load` for Theme Editor compatibility.
6. **Always respect** `prefers-reduced-motion` for animations.
7. **Never hard-code** colors, spacing, or font sizes — use CSS custom properties.
8. **Always provide** accessible labels (ARIA, alt text, `visually-hidden`) for interactive elements.

---

## File Naming

### Sections
```
product-[feature].liquid     product page sections
[component]-[type].liquid    global components (e.g., sticky-mobile-atc.liquid)
```

### Assets
```
[section-name].css           section-specific CSS
[section-name].js            section-specific JS
uc-[system].css              shared design-system CSS (uc- prefix)
uc-[utility].js              shared utility JS (uc- prefix)
```

### Snippets
```
uc-[name].liquid             shared utility snippets (uc- prefix)
[component]-[part].liquid    component-part snippets
```

---

## CSS Naming Convention (BEM-like)

Each section uses a unique 2–5 character prefix to prevent collisions.

```css
/* Block */
.pfaq { }

/* Element */
.pfaq__header { }
.pfaq__item { }
.pfaq__trigger { }

/* Modifier */
.pfaq__item--active { }
.pfaq__btn--primary { }

/* State (JS-driven, NOT CSS modifiers) */
.pfaq__item.is-open { }
.pfaq__btn.is-loading { }
.pfaq__btn.is-success { }
```

**State classes start with `is-` or `has-`:**
- `is-open`, `is-active`, `is-visible`, `is-loading`, `is-success`, `is-error`
- `has-media`, `has-video`, `has-sale`

---

## JavaScript Conventions

### Data Attributes for JS Hooks

Never use CSS classes as JS selectors. Use `data-` attributes:

```html
<!-- Good -->
<button data-pfaq-trigger>Question</button>

<!-- Bad -->
<button class="pfaq__trigger js-trigger">Question</button>
```

### Section Root Selectors

Every section's JS looks for its root via a unique `data-[prefix]-section` attribute:

```js
document.querySelectorAll('[data-pfaq-section]').forEach(initFAQ);
```

### Event Delegation

Prefer event delegation on the section root over direct event listeners on children:

```js
/* Good — one listener, works for dynamic content */
section.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-pfaq-trigger]');
  if (!btn) return;
  // handle click
});

/* Bad — many listeners, breaks on section reload */
section.querySelectorAll('[data-pfaq-trigger]').forEach(function (btn) {
  btn.addEventListener('click', handler);
});
```

### Theme Editor Support

Every JS file must handle `shopify:section:load` for Theme Editor previews:

```js
document.addEventListener('shopify:section:load', function (e) {
  var s = e.target.querySelector('[data-pfaq-section]');
  if (s) initFAQ(s);
});
```

---

## Liquid Conventions

### Schema Settings IDs

Use `snake_case` for setting IDs. Group related settings with `type: "header"`:

```json
{ "type": "header", "content": "Section header" },
{ "type": "text", "id": "heading", "label": "Heading", "default": "Our story" },
{ "type": "richtext", "id": "subtitle", "label": "Subtitle" }
```

### Data Islands (JSON for JS)

Pass server-side data to JS using embedded JSON:

```liquid
<script type="application/json" id="section-data-{{ section.id }}">
  { "variantId": {{ cv.id }}, "price": {{ cv.price }} }
</script>
```

```js
var data = JSON.parse(document.getElementById('section-data-' + sectionId).textContent);
```

### Section-Scoped CSS Variables

Override design tokens per-section using inline `<style>` blocks:

```liquid
{%- style -%}
  #MySection-{{ section.id }} {
    --section-pad-top: {{ s.padding_top | default: 72 }}px;
  }
{%- endstyle -%}
```

---

## Responsive Breakpoints

| Name | Max-width | Use for |
|---|---|---|
| Small mobile | `479px` | Extra compact layouts |
| Mobile | `749px` | Stacked single-column |
| Tablet portrait | `989px` | 2-column grids |
| Tablet landscape | `1099px` | 3-column grids |
| Laptop | `1279px` | 4-column grids (reduced gutters) |
| Desktop | `1440px+` | Full premium layouts |

Always use `max-width` in media queries (mobile-first within each breakpoint block):

```css
/* Desktop default */
.section__grid { grid-template-columns: repeat(4, 1fr); }

/* Tablet */
@media (max-width: 989px) {
  .section__grid { grid-template-columns: repeat(2, 1fr); }
}

/* Mobile */
@media (max-width: 749px) {
  .section__grid { grid-template-columns: 1fr; gap: 10px; }
}
```

---

## Performance Guidelines

| Rule | Reason |
|---|---|
| Use `loading="lazy"` on all non-LCP images | Core Web Vitals (LCP) |
| Add `width` + `height` attributes to images | Prevent CLS |
| Use `aspect-ratio` CSS instead of padding-top hacks | Cleaner + CLS prevention |
| Use `will-change: transform` sparingly | Memory pressure |
| Debounce scroll and input events | CPU performance |
| Use `IntersectionObserver` for reveal animations | No scroll event overhead |
| Avoid `document.querySelectorAll` in scroll handlers | Reflow triggers |
| Unobserve after first intersection | Memory leak prevention |

---

## Adding a New Section Checklist

1. [ ] Create `sections/[section-name].liquid` with `{% schema %}`
2. [ ] Create `assets/[section-name].css` with unique prefix
3. [ ] Create `assets/[section-name].js` if interactive (IIFE + `shopify:section:load`)
4. [ ] Load design system at top: `uc-design-tokens.css` + `uc-components.css`
5. [ ] Use `uc-icon.liquid` for all icons (never inline SVG)
6. [ ] Use `uc-product-card.liquid` if displaying product cards
7. [ ] Add `data-[prefix]-section` attribute to root element
8. [ ] Support `prefers-reduced-motion` for all animations
9. [ ] Test in Theme Editor (section load/unload/settings changes)
10. [ ] Test on mobile (< 480px), tablet (750–989px), desktop (> 1200px)
11. [ ] Validate Liquid tags balance, schema JSON, CSS brace balance
12. [ ] Copy file to `sections/` and `assets/`

# Shopify Upload Guide

## What to Upload and Where

Shopify requires a **flat** file structure within each folder.
Upload files from this repository using the exact folder locations below.

---

## Step-by-Step Upload

### 1. Online Store → Themes → Edit Code

In Shopify Admin navigate to:
**Online Store → Themes → [Your Theme] → Actions → Edit Code**

---

### 2. Sections (upload to `sections/`)

| File | Shopify location |
|---|---|
| `premium-product-hero.liquid` | `sections/premium-product-hero.liquid` |
| `product-video-reviews.liquid` | `sections/product-video-reviews.liquid` |
| `before-after-comparison.liquid` | `sections/before-after-comparison.liquid` |
| `product-ba-slider.liquid` | `sections/product-ba-slider.liquid` |
| `product-benefits.liquid` | `sections/product-benefits.liquid` |
| `product-why-us.liquid` | `sections/product-why-us.liquid` |
| `product-ingredients.liquid` | `sections/product-ingredients.liquid` |
| `product-how-it-works.liquid` | `sections/product-how-it-works.liquid` |
| `product-comparison-table.liquid` | `sections/product-comparison-table.liquid` |
| `product-testimonials.liquid` | `sections/product-testimonials.liquid` |
| `product-faq.liquid` | `sections/product-faq.liquid` |
| `product-related.liquid` | `sections/product-related.liquid` |
| `product-recently-viewed.liquid` | `sections/product-recently-viewed.liquid` |
| `sticky-mobile-atc.liquid` | `sections/sticky-mobile-atc.liquid` |
| `sticky-atc.liquid` | `sections/sticky-atc.liquid` |
| `footer-upsell.liquid` | `sections/footer-upsell.liquid` |
| `premium-video-reels.liquid` | `sections/premium-video-reels.liquid` |
| `visible-results.liquid` | `sections/visible-results.liquid` |
| `premium-product-showcase.liquid` | `sections/premium-product-showcase.liquid` |
| `pf-quick-view.liquid` | `sections/pf-quick-view.liquid` |
| `uc-hero-slider.liquid` | `sections/uc-hero-slider.liquid` |
| `category-showcase.liquid` | `sections/category-showcase.liquid` |
| `custom-header.liquid` | `sections/custom-header.liquid` |

---

### 3. Snippets (upload to `snippets/`)

| File | Shopify location |
|---|---|
| `uc-icon.liquid` | `snippets/uc-icon.liquid` |
| `uc-design-system.liquid` | `snippets/uc-design-system.liquid` |
| `uc-product-card.liquid` | `snippets/uc-product-card.liquid` |
| `pf-product-card.liquid` | `snippets/pf-product-card.liquid` |
| `uc-hero-slide.liquid` | `snippets/uc-hero-slide.liquid` |
| `custom-header-account.liquid` | `snippets/custom-header-account.liquid` |
| `custom-header-announcement.liquid` | `snippets/custom-header-announcement.liquid` |
| `custom-header-cart-drawer.liquid` | `snippets/custom-header-cart-drawer.liquid` |
| `custom-header-drawer.liquid` | `snippets/custom-header-drawer.liquid` |
| `custom-header-icon.liquid` | `snippets/custom-header-icon.liquid` |
| `custom-header-pill.liquid` | `snippets/custom-header-pill.liquid` |
| `custom-header-search.liquid` | `snippets/custom-header-search.liquid` |
| `custom-header-social.liquid` | `snippets/custom-header-social.liquid` |

---

### 4. Assets (upload to `assets/`)

Upload **all 43 files** from `assets/` to `assets/` in Shopify.

**Design system (load order matters — upload these first):**
- `uc-design-tokens.css` ← must be uploaded before all section CSS
- `uc-components.css`
- `uc-showcase.css`
- `uc-module-bridge.css`
- `uc-product-card.css`
- `uc-product-card.js`

**Section CSS** (one per section — all load the design system above):
- All `product-*.css`, `premium-*.css`, `before-after-*.css`, `visible-results.css`,
  `sticky-*.css`, `footer-upsell.css`, `custom-header.css`, `uc-hero-slider.css`

**Section JS** (one per section with interactive behavior):
- All `product-*.js`, `premium-*.js`, `before-after-*.js`, `visible-results.js`,
  `sticky-*.js`, `custom-header.js`, `uc-hero-slider.js`

---

### 5. Add to Product Template

In `templates/product.json` (or your product JSON template), add sections in this order:

```json
{
  "sections": {
    "main": { "type": "premium-product-hero" },
    "video-reviews": { "type": "product-video-reviews" },
    "before-after": { "type": "before-after-comparison" },
    "ba-slider": { "type": "product-ba-slider" },
    "benefits": { "type": "product-benefits" },
    "why-us": { "type": "product-why-us" },
    "ingredients": { "type": "product-ingredients" },
    "how-it-works": { "type": "product-how-it-works" },
    "comparison": { "type": "product-comparison-table" },
    "testimonials": { "type": "product-testimonials" },
    "faq": { "type": "product-faq" },
    "related": { "type": "product-related" },
    "recently-viewed": { "type": "product-recently-viewed" },
    "sticky-mobile": { "type": "sticky-mobile-atc" },
    "footer-upsell": { "type": "footer-upsell" }
  },
  "order": [
    "main","video-reviews","before-after","ba-slider","benefits",
    "why-us","ingredients","how-it-works","comparison","testimonials",
    "faq","related","recently-viewed","sticky-mobile","footer-upsell"
  ]
}
```

---

## Shopify CLI Alternative

If using Shopify CLI (recommended for teams):

```bash
shopify theme push --path .
```

This will automatically upload all files in the correct Shopify folder locations.

---

## Important Notes

- **Never add sub-folders inside `sections/`, `snippets/`, or `assets/`** on Shopify.
  Shopify does not support nested folders in these locations.
- `uc-design-tokens.css` and `uc-components.css` are shared by ALL sections.
  Shopify deduplicates `{% stylesheet_tag %}` calls automatically.
- The `sticky-mobile-atc` section must be placed in the product template
  **outside** the main product form to avoid form nesting conflicts.

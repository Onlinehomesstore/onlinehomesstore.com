# Unik Care Theme — Complete Shopify Upload Guide

Copy every file below from this repository into **Shopify Admin → Online Store → Themes → … → Edit code**.

Upload in this order. After uploading, hard-refresh the storefront (`Ctrl+Shift+R`).

---

## STEP 1 — Layout (required first)

| Shopify path | Local file |
|---|---|
| `layout/theme.liquid` | `layout/theme.liquid` |

---

## STEP 2 — Config

| Shopify path | Local file |
|---|---|
| `config/settings_schema.json` | `config/settings_schema.json` |

---

## STEP 3 — Templates

| Shopify path | Local file |
|---|---|
| `templates/index.json` | `templates/index.json` |
| `templates/product.json` | `templates/product.json` |

---

## STEP 4 — Section groups

| Shopify path | Local file |
|---|---|
| `sections/header-group.json` | `sections/header-group.json` |
| `sections/footer-group.json` | `sections/footer-group.json` |

---

## STEP 5 — Global assets (design system + motion)

| Shopify path | Local file |
|---|---|
| `assets/uc-design-tokens.css` | `assets/uc-design-tokens.css` |
| `assets/uc-components.css` | `assets/uc-components.css` |
| `assets/uc-utilities.css` | `assets/uc-utilities.css` |
| `assets/uc-section-responsive.css` | `assets/uc-section-responsive.css` |
| `assets/uc-module-bridge.css` | `assets/uc-module-bridge.css` |
| `assets/uc-showcase.css` | `assets/uc-showcase.css` |
| `assets/uc-motion.js` | `assets/uc-motion.js` |
| `assets/custom-header.css` | `assets/custom-header.css` |

---

## STEP 6 — Snippets (shared components)

| Shopify path | Local file |
|---|---|
| `snippets/uc-design-system.liquid` | `snippets/uc-design-system.liquid` |
| `snippets/uc-section-vars.liquid` | `snippets/uc-section-vars.liquid` |
| `snippets/uc-section-colors.liquid` | `snippets/uc-section-colors.liquid` |
| `snippets/uc-video-poster.liquid` | `snippets/uc-video-poster.liquid` |
| `snippets/uc-star-rating.liquid` | `snippets/uc-star-rating.liquid` |
| `snippets/uc-icon.liquid` | `snippets/uc-icon.liquid` |
| `snippets/uc-product-card.liquid` | `snippets/uc-product-card.liquid` |
| `snippets/pf-product-card.liquid` | `snippets/pf-product-card.liquid` |
| `snippets/promo-banner.liquid` | `snippets/promo-banner.liquid` |
| `snippets/premium-blog-card.liquid` | `snippets/premium-blog-card.liquid` |
| `snippets/trust-badge-card.liquid` | `snippets/trust-badge-card.liquid` |

---

## STEP 7 — Homepage sections

| Shopify path | Local file |
|---|---|
| `sections/uc-editorial-hero.liquid` | `sections/uc-editorial-hero.liquid` |
| `sections/category-showcase.liquid` | `sections/category-showcase.liquid` |
| `sections/premium-product-showcase.liquid` | `sections/premium-product-showcase.liquid` |
| `sections/before-after-comparison.liquid` | `sections/before-after-comparison.liquid` |
| `sections/visible-results.liquid` | `sections/visible-results.liquid` |
| `sections/premium-video-reels.liquid` | `sections/premium-video-reels.liquid` |
| `sections/premium-promo-blog.liquid` | `sections/premium-promo-blog.liquid` |
| `sections/product-testimonials.liquid` | `sections/product-testimonials.liquid` |
| `sections/main-404.liquid` | `sections/main-404.liquid` |
| `snippets/uc-error-diagnostics.liquid` | `snippets/uc-error-diagnostics.liquid` |

### Homepage section assets

| Shopify path | Local file |
|---|---|
| `assets/uc-editorial-hero.css` | `assets/uc-editorial-hero.css` |
| `assets/uc-editorial-hero.js` | `assets/uc-editorial-hero.js` |
| `assets/uc-perf-responsive.css` | `assets/uc-perf-responsive.css` |
| `assets/premium-product-showcase.css` | `assets/premium-product-showcase.css` |
| `assets/premium-product-showcase.js` | `assets/premium-product-showcase.js` |
| `assets/premium-video-reels.css` | `assets/premium-video-reels.css` |
| `assets/premium-video-reels.js` | `assets/premium-video-reels.js` |
| `assets/premium-promo-blog.css` | `assets/premium-promo-blog.css` |
| `assets/premium-promo-blog.js` | `assets/premium-promo-blog.js` |
| `assets/product-testimonials.css` | `assets/product-testimonials.css` |
| `assets/product-testimonials.js` | `assets/product-testimonials.js` |
| `assets/visible-results.css` | `assets/visible-results.css` |
| `assets/visible-results.js` | `assets/visible-results.js` |
| `assets/before-after-comparison.css` | `assets/before-after-comparison.css` |
| `assets/before-after-comparison.js` | `assets/before-after-comparison.js` |

> **Homepage 404?** Do not upload legacy `uc-hero-slider` — use `uc-editorial-hero`. Run `node _diagnose_theme.js` before upload. Never leave other-store `shopify://shop_images/…` refs in `index.json`.


---

## STEP 8 — Header & footer

| Shopify path | Local file |
|---|---|
| `sections/custom-header.liquid` | `sections/custom-header.liquid` |
| `sections/premium-footer.liquid` | `sections/premium-footer.liquid` |
| `assets/premium-footer.css` | `assets/premium-footer.css` |
| `assets/premium-footer.js` | `assets/premium-footer.js` |

---

## STEP 9 — Product page sections

| Shopify path | Local file |
|---|---|
| `sections/premium-product-hero.liquid` | `sections/premium-product-hero.liquid` |
| `sections/product-video-reviews.liquid` | `sections/product-video-reviews.liquid` |
| `sections/product-ba-slider.liquid` | `sections/product-ba-slider.liquid` |
| `sections/product-benefits.liquid` | `sections/product-benefits.liquid` |
| `sections/product-why-us.liquid` | `sections/product-why-us.liquid` |
| `sections/product-ingredients.liquid` | `sections/product-ingredients.liquid` |
| `sections/product-how-it-works.liquid` | `sections/product-how-it-works.liquid` |
| `sections/product-comparison-table.liquid` | `sections/product-comparison-table.liquid` |
| `sections/product-testimonials.liquid` | *(same as homepage — upload once)* |
| `sections/product-faq.liquid` | `sections/product-faq.liquid` |
| `sections/product-related.liquid` | `sections/product-related.liquid` |
| `sections/product-recently-viewed.liquid` | `sections/product-recently-viewed.liquid` |
| `sections/sticky-atc.liquid` | `sections/sticky-atc.liquid` |
| `sections/sticky-mobile-atc.liquid` | `sections/sticky-mobile-atc.liquid` |
| `sections/footer-upsell.liquid` | `sections/footer-upsell.liquid` |

### Product page assets

| Shopify path | Local file |
|---|---|
| `assets/premium-product-hero.css` | `assets/premium-product-hero.css` |
| `assets/premium-product-hero.js` | `assets/premium-product-hero.js` |
| `assets/product-video-reviews.css` | `assets/product-video-reviews.css` |
| `assets/product-ba-slider.css` | `assets/product-ba-slider.css` |
| `assets/product-benefits.css` | `assets/product-benefits.css` |
| `assets/product-benefits.js` | `assets/product-benefits.js` |
| `assets/product-why-us.css` | `assets/product-why-us.css` |
| `assets/product-why-us.js` | `assets/product-why-us.js` |
| `assets/product-ingredients.css` | `assets/product-ingredients.css` |
| `assets/product-how-it-works.css` | `assets/product-how-it-works.css` |
| `assets/product-how-it-works.js` | `assets/product-how-it-works.js` |
| `assets/product-comparison-table.css` | `assets/product-comparison-table.css` |
| `assets/product-faq.css` | `assets/product-faq.css` |
| `assets/product-faq.js` | `assets/product-faq.js` |
| `assets/product-related.css` | `assets/product-related.css` |
| `assets/product-related.js` | `assets/product-related.js` |
| `assets/product-recently-viewed.js` | `assets/product-recently-viewed.js` |
| `assets/uc-product-card.css` | `assets/uc-product-card.css` |
| `assets/uc-product-card.js` | `assets/uc-product-card.js` |
| `assets/sticky-atc.css` | `assets/sticky-atc.css` |
| `assets/sticky-atc.js` | `assets/sticky-atc.js` |
| `assets/sticky-mobile-atc.css` | `assets/sticky-mobile-atc.css` |
| `assets/sticky-mobile-atc.js` | `assets/sticky-mobile-atc.js` |
| `assets/footer-upsell.css` | `assets/footer-upsell.css` |

---

## STEP 10 — After upload checklist

1. **Theme Editor → Design System** — confirm Poppins fonts, gold `#B68A35`, ivory `#F7F4EF`, save.
2. **Homepage** — hard refresh, check all 8 sections load with no Liquid errors.
3. **Product page** — verify related products quick-add works, no form errors in footer/newsletter.
4. **Reels** — paste a TikTok URL (`https://www.tiktok.com/@user/video/1234567890`), confirm auto thumbnail.
5. **Hover** — product/category cards should deepen shadow without jumping neighbors.
6. **Customize any section** — look for **"UC — Responsive spacing"** and **"UC — Typography overrides"** panels.

---

## What changed (summary)

- **Design system**: Poppins, gold/ivory tokens, Lucide icons, shared buttons/cards/containers
- **Responsive controls**: Every UC section has breakpoint spacing + typography overrides via Theme Editor
- **Hover jitter fixed**: Cards use shadow + image scale only (no translateY layout shift)
- **Reels**: Auto thumbnails (YouTube/Vimeo/TikTok oEmbed), TikTok embed support, manual override
- **Stars/encoding**: CSS-based star ratings (no mojibake)
- **Form fixes**: Newsletter + quick-add forms use pre-assigned IDs (no Liquid filter bugs)
- **Font leak fixed**: `@font-face` wrapped inside `<style>` tag

---

## Reference docs (optional, do not upload to Shopify)

- `docs/section-typography-spacing-schema-template.json`
- `docs/section-colors-schema-template.json`

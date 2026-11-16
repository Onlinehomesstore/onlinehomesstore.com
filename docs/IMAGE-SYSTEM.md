# UNIK Care — Global Image System

Single source of truth for upload dimensions, CSS tokens, and Liquid rendering.

## CSS tokens (`uc-design-tokens.css` + Theme Editor)

| Token | Ratio | Recommended upload |
|--------|--------|---------------------|
| `--uc-ar-product` | 1:1 | **2000×2000** (min 1600×1600) |
| `--uc-ar-collection` / category | 4:5 | **1200×1500** |
| `--uc-ar-hero-desktop` | ~192:90 | **1920×900** |
| `--uc-ar-hero-tablet` | 7:5 | **1400×1000** |
| `--uc-ar-hero-mobile` | 3:4 | **900×1200** |
| `--uc-ar-before-after` | 4:5 | **1200×1500** |
| `--uc-ar-blog` | 3:2 | **1200×800** |
| `--uc-ar-testimonial` | 1:1 | **800×800** |
| `--uc-ar-ingredient` | 1:1 | **1000×1000** |

Theme settings (**Design System — Images**):

- `uc_product_image_fit` — product cards (default **contain** for pack shots)
- `uc_category_image_fit` — category/collection cards (default **cover**)
- `uc_card_image_ratio` — global card aspect (existing setting)

Stylesheet: `assets/uc-image-system.css` (loaded globally in `layout/theme.liquid`).

## Liquid snippet: `uc-image.liquid`

```liquid
{% render 'uc-image',
  image: product.featured_image,
  role: 'product',
  alt: product.title,
  lazy: true,
  fit: 'contain',
  position: 'center center'
%}
```

Roles: `product`, `collection`, `category`, `hero`, `ba`, `blog`, `testimonial`, `ingredient`, `custom`.

Outputs: responsive `srcset`, `sizes`, explicit `width`/`height`, optional aspect-ratio wrapper for CLS.

## Section-level controls

**Category Showcase** (homepage collections):

- Image ratio (% height) — default 125 ≈ 4:5
- Image fit — cover / contain
- Per-block image position, mobile image override (existing)

**UC Premium Hero**:

- Desktop / laptop / tablet / mobile image pickers (existing)

## Product cards

- `snippets/uc-product-card.liquid` — default **square**, srcset up to 1600px
- `snippets/pf-product-card.liquid` — inherits `--uc-ar-product` via CSS
- Cart drawer / search — use same tokens where Dawn cards are overridden

## Icons

Use `snippets/uc-icon.liquid` (SVG). Avoid PNG UI icons.

## Homepage responsive layer

`assets/uc-home-refine.css` — loaded only on `template.index`:

- Prevents horizontal overflow
- Tighter section rhythm on small phones
- Category slider peek cards
- Product showcase square media on mobile (no 180px crop)
- Tap target and ultra-wide max-width polish

## Merchant checklist

1. Upload product photos at **2000×2000** square on white/brand background.
2. Collection/category art at **1200×1500**.
3. Hero: three crops (desktop / tablet / mobile) in UC Premium Hero.
4. Set product fit to **Contain** in Theme settings if bottles must not crop.
5. Use WebP in Shopify admin when available; Shopify CDN serves modern formats automatically.

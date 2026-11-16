# Checkout custom CSS — what and where

Checkout cannot use theme CSS files. Paste styles in Shopify Admin only.

## Where (matches your Checkout editor screenshot)

1. Shopify Admin → **Settings** → **Checkout**
2. Open your checkout profile → **Customize** (the editor with Header / Main / Order summary / Footer)
3. In that editor, open **Branding** (not Footer — Footer only edits policy links)
4. Find **Custom CSS**
5. Paste the CSS below → **Save**

Also set **Poppins** in Branding fonts. Do **not** paste `@import` font lines (Checkout rejects them).

**Limit:** 1500 characters.

---

## Paste this CSS

```css
:root{--c:#b68a35;--cd:#9c7328;--bg:#f7f4ef;--ink:#171717;--mu:#5c564e;--ln:#e6e0d6}
html,body{background:var(--bg)!important;color:var(--ink)!important;font-size:15px!important;line-height:1.55!important}
h1,h2,h3{font-weight:650!important;letter-spacing:-.02em!important}
.sidebar,.order-summary,[data-order-summary],.section,.card{background:#fff!important;border:1px solid var(--ln)!important;border-radius:14px!important;box-shadow:0 8px 22px rgba(23,20,16,.05)!important}
input,select,textarea,.field__input{border-radius:12px!important;border-color:var(--ln)!important;min-height:48px!important;font-size:15px!important}
input:focus,select:focus,textarea:focus{border-color:rgba(182,138,53,.55)!important;box-shadow:0 0 0 3px rgba(182,138,53,.14)!important;outline:0!important}
label,.field__label{font-size:13px!important;font-weight:600!important;color:var(--mu)!important}
button[type=submit],.btn,.button--primary,#continue_button,.shopify-payment-button__button--unbranded{background:var(--c)!important;color:#fff!important;border:0!important;border-radius:999px!important;min-height:52px!important;font-weight:650!important}
button[type=submit]:hover,#continue_button:hover{background:var(--cd)!important}
a{color:var(--c)!important}.product-thumbnail{border-radius:12px!important}
.payment-due__price,.order-summary__emphasis{font-weight:700!important;font-size:16px!important}
footer,a[href*=privacy],.breadcrumb{font-size:14px!important;color:var(--mu)!important}
```

This softens the default light-blue **Pay now** button to UNIK gold and matches the cream storefront look.

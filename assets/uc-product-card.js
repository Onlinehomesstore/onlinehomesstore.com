/*
  UC PRODUCT CARD — fast ATC
  Flow: API success → fly animation → header badge from Shopify cart
*/
(function () {
  'use strict';

  if (window.__UC_PRODUCT_CARD_READY__) return;
  window.__UC_PRODUCT_CARD_READY__ = true;

  var locks = new WeakSet();
  var ANIM_MS = 720;

  function rootUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.charAt(root.length - 1) === '/' ? root : root + '/';
  }

  function cartAddUrl() {
    var url =
      (typeof routes !== 'undefined' && routes && routes.cart_add_url) ||
      (window.routes && window.routes.cart_add_url) ||
      rootUrl() + 'cart/add';
    if (url.indexOf('.js') === -1) url += '.js';
    return url;
  }

  function cartJsonUrl() {
    var url =
      (typeof routes !== 'undefined' && routes && routes.cart_url) ||
      (window.routes && window.routes.cart_url) ||
      rootUrl() + 'cart';
    if (url.indexOf('.js') === -1) url += '.js';
    return url;
  }

  function elFromEvent(e, selector) {
    var t = e.target;
    if (t && t.nodeType === 3) t = t.parentElement;
    if (t && t.closest) {
      var hit = t.closest(selector);
      if (hit) return hit;
    }
    if (e.composedPath) {
      var path = e.composedPath();
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        if (n && n.matches && n.matches(selector)) return n;
      }
    }
    return null;
  }

  function readId(btn) {
    var id = parseInt(btn && btn.getAttribute('data-variant-id'), 10);
    if (id) return id;
    var card = btn && btn.closest('[data-pc-card]');
    return parseInt(card && card.getAttribute('data-variant-id'), 10) || 0;
  }

  function readQty(btn) {
    return Math.max(1, parseInt(btn && btn.getAttribute('data-quantity'), 10) || 1);
  }

  function setLoading(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-loading', !!on);
    var spin = btn.querySelector('.pc-card__btn-spinner');
    var icon = btn.querySelector('.pc-card__btn-icon--cart');
    var ok = btn.querySelector('.pc-card__btn-icon--ok');
    var text = btn.querySelector('.pc-card__btn-text');
    if (spin) spin.hidden = !on;
    if (icon) icon.hidden = !!on;
    if (ok) ok.hidden = true;
    if (text) text.style.opacity = on ? '0.4' : '';
  }

  function bumpBadgeOptimistic() {
    document.querySelectorAll('[data-uc-phdr-cart-count]').forEach(function (el) {
      var n = parseInt(el.textContent, 10);
      if (isNaN(n)) n = 0;
      n += 1;
      el.textContent = String(n);
      el.hidden = false;
      el.classList.remove('uc-phdr-badge--empty', 'uc-phdr__badge--empty');
    });
  }

  function syncBadgeFromCart() {
    return fetch(cartJsonUrl(), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (cart) {
        if (!cart) return null;
        if (window.UCCart && typeof window.UCCart.applyCartUi === 'function') {
          window.UCCart.applyCartUi(cart);
        } else if (window.UCCart && typeof window.UCCart.syncHeaderBadges === 'function') {
          window.UCCart.syncHeaderBadges(cart);
        }
        return cart;
      })
      .catch(function () {
        return null;
      });
  }

  /* Fast add — only waits for /cart/add.js */
  function fastAdd(id, qty) {
    return fetch(cartAddUrl(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ items: [{ id: id, quantity: qty }] }),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || data.status) {
          var err = data || {};
          err.description = err.description || err.message || 'Could not add to cart';
          throw err;
        }
        return data;
      });
    });
  }

  function handleAdd(btn) {
    if (!btn || locks.has(btn) || btn.disabled) return;
    var id = readId(btn);
    var qty = readQty(btn);
    var text = btn.querySelector('.pc-card__btn-text');
    var cartIcon = btn.querySelector('.pc-card__btn-icon--cart');
    var okIcon = btn.querySelector('.pc-card__btn-icon--ok');
    if (!id) {
      if (text) text.textContent = 'Unavailable';
      return;
    }

    locks.add(btn);
    setLoading(btn, true);

    var addPromise =
      window.UCCart && typeof window.UCCart.addItems === 'function'
        ? window.UCCart.addItems([{ id: id, quantity: qty }], 'uc-product-card')
        : fastAdd(id, qty).then(function () {
            return syncBadgeFromCart();
          });

    addPromise
      .then(function () {
        /* 1) Stop loading immediately */
        setLoading(btn, false);
        locks.delete(btn);
        btn.classList.add('is-success');
        if (cartIcon) cartIcon.hidden = true;
        if (okIcon) okIcon.hidden = false;
        if (text) text.textContent = 'Added!';

        var card = btn.closest('[data-pc-card]') || btn;
        var img = card.querySelector('img[src]:not([src=""])');
        var animate = img && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        /* 2) Fly animation FIRST */
        if (animate) {
          document.dispatchEvent(
            new CustomEvent('cart:atc:success', {
              bubbles: true,
              detail: { button: btn, image: img },
            })
          );
        }

        if (!(window.UCCart && typeof window.UCCart.addItems === 'function')) {
          window.setTimeout(function () {
            bumpBadgeOptimistic();
            syncBadgeFromCart();
          }, animate ? 380 : 0);
        }

        window.setTimeout(function () {
          btn.classList.remove('is-success');
          if (cartIcon) cartIcon.hidden = false;
          if (okIcon) okIcon.hidden = true;
          if (text) text.textContent = 'Add to Cart';
        }, 2000);
      })
      .catch(function (err) {
        setLoading(btn, false);
        locks.delete(btn);
        if (cartIcon) cartIcon.hidden = false;
        if (okIcon) okIcon.hidden = true;
        if (text) text.textContent = (err && err.description) || 'Try again';
        window.setTimeout(function () {
          if (text) text.textContent = 'Add to Cart';
        }, 2200);
        console.warn('[uc-product-card] ATC failed', err);
      });
  }

  function handleBuy(btn) {
    if (!btn || btn.disabled) return;
    var id = readId(btn);
    var qty = readQty(btn);
    if (!id) return;
    window.__UC_BUY_NOW__ = true;
    btn.disabled = true;
    window.location.assign(rootUrl() + 'cart/' + id + ':' + qty);
  }

  function wishKey() {
    return (window.UCWishlist && window.UCWishlist.storageKey) || 'uc:wishlist';
  }

  function readWish() {
    try {
      var list = JSON.parse(localStorage.getItem(wishKey()) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function writeWish(list) {
    try {
      localStorage.setItem(wishKey(), JSON.stringify(list));
      document.dispatchEvent(
        new CustomEvent('uc:wishlist:change', { bubbles: true, detail: { list: list, count: list.length } })
      );
      document.dispatchEvent(
        new CustomEvent('wishlist:change', { bubbles: true, detail: { list: list, count: list.length } })
      );
    } catch (_) {}
  }

  function syncWish(root) {
    var list = readWish();
    (root || document).querySelectorAll('[data-pc-wishlist]').forEach(function (btn) {
      var id = String(btn.getAttribute('data-product-id') || '');
      var active = list.some(function (x) {
        return String(x.id) === id;
      });
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function handleWish(btn) {
    var id = String(btn.getAttribute('data-product-id') || '');
    if (!id) return;
    var list = readWish();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === id) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      list.push({
        id: id,
        handle: btn.getAttribute('data-product-handle') || '',
        title: btn.getAttribute('data-product-title') || '',
        url: btn.getAttribute('data-product-url') || '',
        image: btn.getAttribute('data-product-image') || '',
        price: btn.getAttribute('data-product-price') || '',
        vendor: btn.getAttribute('data-product-vendor') || '',
        variantId: btn.getAttribute('data-variant-id') || '',
        available: btn.getAttribute('data-product-available') !== 'false',
      });
    } else {
      list.splice(idx, 1);
    }
    writeWish(list);
    syncWish(document);
  }

  document.addEventListener(
    'click',
    function (e) {
      var add = elFromEvent(e, '[data-pc-quick-add]');
      if (add) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleAdd(add);
        return;
      }
      var buy = elFromEvent(e, '[data-pc-buy-now]');
      if (buy) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleBuy(buy);
        return;
      }
      var wish = elFromEvent(e, '[data-pc-wishlist]');
      if (wish) {
        e.preventDefault();
        e.stopPropagation();
        handleWish(wish);
      }
    },
    true
  );

  /* Cart icon hover — CSS only (no GSAP) */
  function bindCartIconHover() {
    /* Intentionally empty: hover handled in uc-product-card.css */
  }

  function boot(root) {
    syncWish(root || document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot(document);
    });
  } else {
    boot(document);
  }

  document.addEventListener('shopify:section:load', function (e) {
    boot(e.target);
  });
})();

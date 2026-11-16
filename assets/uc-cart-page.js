/*
  UC Cart Page — Shopify discount codes stay in sync with the Cart API.
  Any merchant coupon (current or future) is applied exactly as Shopify evaluates it.
*/
(function () {
  'use strict';

  if (window.__ucCartPageBound) return;
  window.__ucCartPageBound = true;

  var INVALID_MSG = 'This coupon code is not correct.';
  var NO_EFFECT_MSG = 'This coupon does not apply to the items in your cart.';
  var discountBusy = false;

  function fetchCart() {
    if (window.UCCart && typeof window.UCCart.fetchCartJson === 'function') {
      return window.UCCart.fetchCartJson();
    }
    var url = (window.routes && window.routes.cart_url) || '/cart';
    if (url.indexOf('.js') === -1) url += '.js';
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' }).then(
      function (r) {
        return r.ok ? r.json() : null;
      }
    );
  }

  function normalizeCode(code) {
    return String(code || '').trim();
  }

  function getDiscountCents(cartData) {
    if (window.UCCart && typeof window.UCCart.getCartDiscountCents === 'function') {
      return window.UCCart.getCartDiscountCents(cartData);
    }
    return cartData && cartData.total_discount ? cartData.total_discount : 0;
  }

  function findEntry(cartData, code) {
    if (window.UCCart && typeof window.UCCart.findDiscountCodeEntry === 'function') {
      return window.UCCart.findDiscountCodeEntry(cartData, code);
    }
    return null;
  }

  function shopifyCode(cartData) {
    if (window.UCCart && typeof window.UCCart.cartDiscountCode === 'function') {
      return window.UCCart.cartDiscountCode(cartData) || '';
    }
    return '';
  }

  function storedCode() {
    if (window.UCCart && typeof window.UCCart.readStoredDiscount === 'function') {
      return window.UCCart.readStoredDiscount() || '';
    }
    return '';
  }

  function storeCode(code) {
    if (window.UCCart && typeof window.UCCart.writeStoredDiscount === 'function') {
      window.UCCart.writeStoredDiscount(code || '');
    }
  }

  function applyOnShopify(code) {
    if (window.UCCart && typeof window.UCCart.applyShopifyDiscount === 'function') {
      return window.UCCart.applyShopifyDiscount(code);
    }
    return Promise.reject(new Error(INVALID_MSG));
  }

  function queueCartWork(fn) {
    if (window.UCCart && typeof window.UCCart.runCartOp === 'function') {
      return window.UCCart.runCartOp(fn);
    }
    return fn();
  }

  function refreshFromShopify(cartData) {
    if (window.UCCart && typeof window.UCCart.paintCartState === 'function') {
      return window.UCCart.paintCartState(cartData, { reinitCheckout: true });
    }
    return fetchCart().then(function (latest) {
      var data = latest || cartData;
      if (data && window.UCCart && typeof window.UCCart.syncCartSummary === 'function') {
        window.UCCart.syncCartSummary(data);
      }
      return data;
    });
  }

  function setCouponMessage(wrap, text, type) {
    var msg = wrap && wrap.querySelector('[data-uc-coupon-msg]');
    if (!msg) return;
    msg.textContent = text || '';
    msg.hidden = !text;
    msg.classList.toggle('is-error', type === 'error');
    msg.classList.toggle('is-success', type === 'success');
  }

  function setCouponBusy(wrap, busy) {
    discountBusy = !!busy;
    var btn = wrap && wrap.querySelector('[data-uc-coupon-apply]');
    var removeBtn = wrap && wrap.querySelector('[data-uc-coupon-remove]');
    var input = wrap && wrap.querySelector('[data-uc-coupon-input]');
    if (btn) {
      btn.disabled = !!busy;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (removeBtn) removeBtn.disabled = !!busy;
    if (input) input.readOnly = !!busy;
  }

  function discountIsActive(cartData) {
    if (window.UCCart && typeof window.UCCart.shopifyDiscountIsActive === 'function') {
      return window.UCCart.shopifyDiscountIsActive(cartData);
    }
    return getDiscountCents(cartData) > 0;
  }

  function updateCouponUi(cartData) {
    var wrap = document.querySelector('[data-uc-coupon]');
    if (!wrap) return wrap;

    var applied = shopifyCode(cartData) || '';
    var live = discountIsActive(cartData) && !!applied;
    var remembered = storedCode();

    var input = wrap.querySelector('[data-uc-coupon-input]');
    if (input && document.activeElement !== input) {
      if (live) input.value = applied;
      else if (remembered && !input.value) input.value = remembered;
    }

    wrap.dataset.appliedCode = live ? applied : '';
    wrap.dataset.hasDiscount = getDiscountCents(cartData) > 0 ? 'true' : 'false';

    var removeBtn = wrap.querySelector('[data-uc-coupon-remove]');
    if (live) {
      if (!removeBtn) {
        removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'uc-cartx__coupon-remove';
        removeBtn.setAttribute('data-uc-coupon-remove', '');
        wrap.appendChild(removeBtn);
      }
      removeBtn.textContent = 'Remove ' + applied;
      removeBtn.setAttribute('aria-label', 'Remove coupon ' + applied);
      removeBtn.hidden = false;
    } else if (removeBtn) {
      removeBtn.remove();
    }

    return wrap;
  }

  function applyDiscountCode(wrap, code) {
    var normalized = normalizeCode(code);
    if (!normalized) {
      var emptyInput = wrap.querySelector('[data-uc-coupon-input]');
      if (emptyInput) emptyInput.focus();
      setCouponMessage(wrap, 'Enter a coupon code', 'error');
      return Promise.resolve();
    }

    setCouponBusy(wrap, true);
    setCouponMessage(wrap, 'Applying…', null);

    return queueCartWork(function () {
      return applyOnShopify(normalized)
      .then(function (cart) {
        if (!cart) throw new Error(INVALID_MSG);
        var entry = findEntry(cart, normalized);
        if (entry && entry.applicable === false) {
          return applyOnShopify('').then(function () {
            storeCode('');
            throw new Error(INVALID_MSG);
          });
        }
        if (!discountIsActive(cart)) {
          return applyOnShopify('').then(function () {
            storeCode(normalized);
            throw new Error(NO_EFFECT_MSG);
          });
        }
        storeCode(normalized);
        return refreshFromShopify(cart).then(function (latest) {
          var confirmed = latest || cart;
          if (!discountIsActive(confirmed)) {
            return applyOnShopify('').then(function () {
              storeCode(normalized);
              throw new Error(NO_EFFECT_MSG);
            });
          }
          return confirmed;
        });
      });
    })
      .then(function (cartData) {
        if (!cartData) return;
        if (!discountIsActive(cartData)) {
          throw new Error(NO_EFFECT_MSG);
        }
        var nextWrap = updateCouponUi(cartData) || wrap;
        if (window.UCCart && typeof window.UCCart.syncCartSummary === 'function') {
          window.UCCart.syncCartSummary(cartData);
        }
        setCouponMessage(nextWrap, 'Coupon applied successfully.', 'success');
      })
      .catch(function (err) {
        setCouponMessage(wrap, err && err.message ? err.message : INVALID_MSG, 'error');
        return fetchCart().then(function (cart) {
          updateCouponUi(cart || {});
          if (cart && window.UCCart && typeof window.UCCart.syncCartSummary === 'function') {
            window.UCCart.syncCartSummary(cart);
          }
        });
      })
      .finally(function () {
        setCouponBusy(wrap, false);
      });
  }

  function removeDiscountCode(wrap) {
    setCouponBusy(wrap, true);
    setCouponMessage(wrap, 'Removing coupon…', null);

    return queueCartWork(function () {
      return applyOnShopify('')
      .then(function (cart) {
        storeCode('');
        if (cart && getDiscountCents(cart) > 0) {
          return applyOnShopify('').then(function (retry) {
            return retry || cart;
          });
        }
        return cart;
      })
      .then(function (cart) {
        return refreshFromShopify(cart);
      });
    })
      .then(function (cart) {
        if (cart && getDiscountCents(cart) > 0) {
          window.location.reload();
          return;
        }
        var nextWrap = updateCouponUi(cart || {}) || wrap;
        var input = nextWrap && nextWrap.querySelector('[data-uc-coupon-input]');
        if (input) input.value = '';
        setCouponMessage(nextWrap, 'Coupon removed.', 'success');
      })
      .catch(function (err) {
        setCouponMessage(wrap, err && err.message ? err.message : 'Could not remove coupon.', 'error');
      })
      .finally(function () {
        setCouponBusy(wrap, false);
      });
  }

  function syncAfterCartChange(cart) {
    if (!document.querySelector('[data-uc-coupon]')) return;
    var wrap = updateCouponUi(cart || {});
    if (!wrap) return;
    setCouponMessage(wrap, '', null);
  }

  document.addEventListener(
    'click',
    function (e) {
      var applyBtn = e.target.closest('[data-uc-coupon-apply]');
      if (applyBtn) {
        e.preventDefault();
        e.stopPropagation();
        var wrap = applyBtn.closest('[data-uc-coupon]');
        if (wrap) {
          if (discountBusy) return;
          var input = wrap.querySelector('[data-uc-coupon-input]');
          applyDiscountCode(wrap, input && input.value);
        }
        return;
      }

      var removeBtn = e.target.closest('[data-uc-coupon-remove]');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        var wrapRemove = removeBtn.closest('[data-uc-coupon]');
        if (wrapRemove) removeDiscountCode(wrapRemove);
      }
    },
    true
  );

  document.addEventListener(
    'keydown',
    function (e) {
      if (e.key !== 'Enter') return;
      var input = e.target.closest('[data-uc-coupon-input]');
      if (!input) return;
      e.preventDefault();
      e.stopPropagation();
      var wrap = input.closest('[data-uc-coupon]');
      if (wrap) {
        if (discountBusy) return;
        applyDiscountCode(wrap, input.value);
      }
    },
    true
  );

  if (typeof subscribe === 'function' && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
    subscribe(window.PUB_SUB_EVENTS.cartUpdate, function (payload) {
      if (!document.querySelector('cart-items')) return;
      if (discountBusy) return;
      var cart = payload && payload.cartData;
      if (!cart) return;
      if (window.UCCart && typeof window.UCCart.syncCartSummary === 'function') {
        window.UCCart.syncCartSummary(cart);
      }
      syncAfterCartChange(cart);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('[data-uc-coupon]')) return;
    fetchCart().then(function (cart) {
      if (!cart) return;
      var remembered = storedCode();
      var current = shopifyCode(cart);
      var start = Promise.resolve(cart);
      if (remembered && window.UCCart && typeof window.UCCart.reapplyDiscountAfterCartChange === 'function') {
        start = queueCartWork(function () {
          return window.UCCart.reapplyDiscountAfterCartChange(cart);
        });
      } else if (current) {
        storeCode(current);
      }
      return start.then(function (next) {
        var data = next || cart;
        return refreshFromShopify(data).then(function (latest) {
          var finalCart = latest || data;
          if (window.UCCart && typeof window.UCCart.syncCartSummary === 'function') {
            window.UCCart.syncCartSummary(finalCart);
          }
          syncAfterCartChange(finalCart);
        });
      });
    });
  });
})();

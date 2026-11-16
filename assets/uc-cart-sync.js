/*
  UC Cart Sync — AJAX add + Dawn drawer / header badge / shipping updates
  Load after constants.js (PUB_SUB_EVENTS, publish, routes).
*/
(function () {
  'use strict';

  var _inFlightForms = new WeakSet();
  var _cartOpChain = Promise.resolve();

  function runCartOp(fn) {
    var p = _cartOpChain.then(fn, fn);
    _cartOpChain = p.then(
      function () {},
      function () {}
    );
    return p;
  }

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

  function getCartUI() {
    return document.querySelector('cart-notification');
  }

  function formatMoney(cents, format) {
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      return Shopify.formatMoney(cents, format || '${{amount}}');
    }
    return (cents / 100).toFixed(2);
  }

  function pulseIcon(selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.classList.remove('uc-icon-pulse');
      void el.offsetWidth;
      el.classList.add('uc-icon-pulse');
      setTimeout(function () {
        el.classList.remove('uc-icon-pulse');
      }, 700);
    });
  }

  function broadcastCartUpdate(source, cartData) {
    var payload = { source: source || 'uc-cart-sync', cartData: cartData };
    if (window.publish && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
      window.publish(window.PUB_SUB_EVENTS.cartUpdate, payload);
    }
    document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: payload }));
    document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: payload }));
  }

  function syncHeaderBadges(cartData) {
    if (!cartData || typeof cartData.item_count !== 'number') return;
    var count = cartData.item_count;
    document.querySelectorAll('[data-uc-phdr-cart-count]').forEach(function (el) {
      el.textContent = String(count);
      el.classList.toggle('uc-phdr-badge--empty', count === 0);
      el.classList.toggle('uc-phdr__badge--empty', count === 0);
      el.hidden = count === 0;
    });
    document.querySelectorAll('[data-uc-cart-count-label]').forEach(function (el) {
      el.textContent = count === 1 ? '1 item' : count + ' items';
    });
    document.querySelectorAll('[data-cart-count], .cart-count-bubble span[aria-hidden="true"]').forEach(function (el) {
      if (el.closest('[data-uc-phdr-cart-count]')) return;
      el.textContent = String(count);
    });
  }

  function syncShippingBars(cartData) {
    if (!cartData) return;
    var total = cartData.total_price || 0;
    document.querySelectorAll('[data-uc-cart-shipping]').forEach(function (bar) {
      var threshold = parseInt(bar.dataset.threshold || '0', 10);
      if (!threshold) return;
      var remaining = Math.max(0, threshold - total);
      var pct = Math.min(100, Math.round((total / threshold) * 100));
      var fill = bar.querySelector('[data-uc-cart-shipping-fill]');
      var text = bar.querySelector('[data-uc-cart-shipping-text]');
      if (fill) {
        fill.style.width = pct + '%';
        var progress = fill.closest('[role="progressbar"]');
        if (progress) progress.setAttribute('aria-valuenow', String(pct));
      }
      if (text) {
        if (remaining <= 0) {
          text.textContent = bar.dataset.success || 'You unlocked free shipping!';
        } else {
          var msg = bar.dataset.message || 'Spend [amount] more for free shipping';
          text.textContent = msg.replace('[amount]', formatMoney(remaining, bar.dataset.moneyFormat));
        }
      }
      bar.classList.toggle('is-unlocked', remaining <= 0);
    });
  }

  function moneyFormat() {
    return (window.themeSettings && window.themeSettings.moneyFormat) || '${{amount}}';
  }

  function formatTotalDisplay(cents, cartData) {
    if (typeof Shopify === 'undefined' || !Shopify.formatMoney) return String(cents / 100);
    var money = Shopify.formatMoney(cents, moneyFormat());
    var sample = document.querySelector('.totals__total-value');
    var currency = cartData && cartData.currency;
    if (currency && sample) {
      var parts = sample.textContent.trim().split(/\s+/);
      var last = parts[parts.length - 1];
      if (last && last === currency) return money + ' ' + currency;
    }
    if (currency) return money + ' ' + currency;
    return money;
  }

  function getCartDiscountCents(cartData) {
    if (!cartData) return 0;
    var discount = Number(cartData.total_discount) || 0;
    if (discount > 0) return discount;
    var appTotal = 0;
    (cartData.cart_level_discount_applications || []).forEach(function (app) {
      appTotal += app.total_allocated_amount || 0;
    });
    if (appTotal > 0) return appTotal;
    var lineDiscount = 0;
    (cartData.items || []).forEach(function (item) {
      (item.line_level_discount_allocations || []).forEach(function (entry) {
        lineDiscount += entry.amount || 0;
      });
    });
    return lineDiscount;
  }

  function shopifyDiscountIsActive(cartData) {
    if (!cartData) return false;
    if (getCartDiscountCents(cartData) > 0) return true;
    var apps = cartData.cart_level_discount_applications || [];
    for (var i = 0; i < apps.length; i++) {
      if (!apps[i]) continue;
      if ((apps[i].total_allocated_amount || 0) > 0) return true;
      if (apps[i].target_type === 'shipping_line') return true;
    }
    return false;
  }

  function syncCartSummary(cartData) {
    if (!cartData || typeof Shopify === 'undefined' || !Shopify.formatMoney) return;
    var format = moneyFormat();
    var discountCents = getCartDiscountCents(cartData);

    if (typeof cartData.items_subtotal_price === 'number') {
      var subtotalMoney = Shopify.formatMoney(cartData.items_subtotal_price, format);
      document.querySelectorAll('[data-uc-cart-subtotal], .totals__subtotal-value').forEach(function (el) {
        el.textContent = subtotalMoney;
      });
    }

    var discountMoney =
      discountCents > 0 ? '\u2212' + Shopify.formatMoney(discountCents, format) : Shopify.formatMoney(0, format);
    document.querySelectorAll('[data-uc-cart-discount]').forEach(function (el) {
      el.textContent = discountMoney;
    });

    if (typeof cartData.total_price === 'number') {
      var totalMoney = formatTotalDisplay(cartData.total_price, cartData);
      document.querySelectorAll('.totals__total-value').forEach(function (el) {
        el.textContent = totalMoney;
      });
    }

    document.querySelectorAll('.uc-cartx__summary .js-contents').forEach(function (summary) {
      var apps = (cartData.cart_level_discount_applications || []).filter(function (app) {
        return app && (app.total_allocated_amount || 0) > 0;
      });
      var list = summary.querySelector('.uc-cartx__discounts, .discounts.uc-cartx__discounts, .discounts');
      if (apps.length && discountCents > 0) {
        if (!list) {
          list = document.createElement('ul');
          list.className = 'discounts list-unstyled uc-cartx__discounts';
          list.setAttribute('role', 'list');
          var rows = summary.querySelector('.uc-cartx__rows');
          if (rows) summary.insertBefore(list, rows);
          else summary.appendChild(list);
        }
        list.innerHTML = apps
          .map(function (app) {
            var amount = app.total_allocated_amount || 0;
            var label = app.title || 'Discount';
            var amountText = amount > 0 ? ' (\u2212' + Shopify.formatMoney(amount, format) + ')' : '';
            return '<li class="discounts__discount discounts__discount--position">' + label + amountText + '</li>';
          })
          .join('');
        list.hidden = false;
      } else if (list) {
        list.remove();
      }
    });
  }

  function syncSubtotals(cartData) {
    syncCartSummary(cartData);
  }

  function protectHeaderCartIcon() {
    var el = document.getElementById('cart-icon-bubble');
    if (!el || !el.classList.contains('uc-phdr__tool--cart')) return;
    var official = el.querySelector('.uc-phdr-icon');
    if (!official && el._ucCartIconHtml) {
      var badge = el.querySelector('[data-uc-phdr-cart-count]');
      var count = badge ? badge.textContent : '0';
      var empty = badge && badge.classList.contains('uc-phdr__badge--empty');
      el.innerHTML =
        el._ucCartIconHtml +
        '<span class="uc-phdr__badge' +
        (empty ? ' uc-phdr__badge--empty' : '') +
        '" data-uc-phdr-cart-count>' +
        count +
        '</span>';
      return;
    }
    if (official && !el._ucCartIconHtml) {
      el._ucCartIconHtml = official.outerHTML;
    }
    el.querySelectorAll('.svg-wrapper, .cart-count-bubble, .visually-hidden').forEach(function (node) {
      node.remove();
    });
  }

  function applyCartUi(cartData) {
    if (!cartData) return;
    protectHeaderCartIcon();
    syncHeaderBadges(cartData);
    syncShippingBars(cartData);
    syncSubtotals(cartData);
    protectHeaderCartIcon();
  }

  function openCartUI() {
    /* Header cart icon is a real /cart link. Add-to-cart must never navigate. */
  }

  function fetchCartJson() {
    return fetch(cartJsonUrl(), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }).then(function (r) {
      return r.ok ? r.json() : null;
    });
  }

  var DISCOUNT_STORAGE_KEY = 'uc_cart_discount_code';

  function readStoredDiscount() {
    try {
      return String(sessionStorage.getItem(DISCOUNT_STORAGE_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function writeStoredDiscount(code) {
    try {
      var value = String(code || '').trim();
      if (value) sessionStorage.setItem(DISCOUNT_STORAGE_KEY, value);
      else sessionStorage.removeItem(DISCOUNT_STORAGE_KEY);
    } catch (e) {}
  }

  function normalizeDiscountCode(code) {
    return String(code || '').trim();
  }

  function findDiscountCodeEntry(cartData, code) {
    var target = normalizeDiscountCode(code).toLowerCase();
    if (!cartData || !target) return null;
    var codes = cartData.discount_codes || [];
    for (var i = 0; i < codes.length; i++) {
      if (codes[i] && String(codes[i].code || '').trim().toLowerCase() === target) return codes[i];
    }
    return null;
  }

  function cartDiscountCode(cartData) {
    if (!shopifyDiscountIsActive(cartData)) return '';
    var codes = cartData.discount_codes || [];
    for (var i = 0; i < codes.length; i++) {
      if (codes[i] && codes[i].code && codes[i].applicable !== false) {
        return String(codes[i].code).trim();
      }
    }
    var apps = cartData.cart_level_discount_applications || [];
    for (var k = 0; k < apps.length; k++) {
      if (apps[k] && apps[k].title && ((apps[k].total_allocated_amount || 0) > 0 || apps[k].target_type === 'shipping_line')) {
        return String(apps[k].title).trim();
      }
    }
    return '';
  }

  function cartUpdateJsUrl() {
    var url =
      (typeof routes !== 'undefined' && routes && routes.cart_update_url) ||
      (window.routes && window.routes.cart_update_url) ||
      rootUrl() + 'cart/update';
    if (url.indexOf('.js') === -1) url += '.js';
    return url;
  }

  function postCartDiscount(code, extra) {
    extra = extra || {};
    var payload = { discount: normalizeDiscountCode(code) };
    if (extra.sections && extra.sections.length) {
      payload.sections = extra.sections;
      payload.sections_url = extra.sections_url || (window.routes && window.routes.cart_url) || rootUrl() + 'cart';
    }
    return fetch(cartUpdateJsUrl(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || (data && data.status && typeof data.item_count !== 'number')) {
          var err = new Error((data && (data.description || data.message)) || 'Discount failed');
          err.data = data;
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function paintCartState(cart, options) {
    options = options || {};
    var chain = Promise.resolve(cart);
    if (!cart) {
      chain = fetchCartJson();
    }
    return chain.then(function (data) {
      if (!data) return null;
      var next = Promise.resolve(data);
      if (data.sections && Object.keys(data.sections).length) {
        next = next.then(function (state) {
          return applyCartSectionResponse(state).then(function () {
            return state;
          });
        });
      } else if (document.querySelector('cart-items')) {
        next = next.then(function (state) {
          return refreshCartPage().then(function () {
            return state;
          });
        });
      }
      return next.then(function (state) {
        return fetchCartJson().then(function (fresh) {
          var finalCart = fresh || state;
          applyCartUi(finalCart);
          syncCartSummary(finalCart);
          if (options.broadcast) {
            broadcastCartUpdate(options.source || 'uc-cart-sync', finalCart);
          }
          if (options.reinitCheckout) {
            reinitAcceleratedCheckout();
          }
          return finalCart;
        });
      });
    });
  }

  function applyShopifyDiscount(code, options) {
    options = options || {};
    var normalized = normalizeDiscountCode(code);
    var ids = getCartSectionIds();
    var sections = [];
    if (options.withSections !== false) {
      if (ids.items) sections.push(ids.items);
      if (ids.footer) sections.push(ids.footer);
    }
    return postCartDiscount(normalized, {
      sections: sections,
      sections_url: (window.routes && window.routes.cart_url) || rootUrl() + 'cart',
    }).then(function (data) {
      return fetchCartJson().then(function (latest) {
        var cart = latest || data;
        if (data && data.sections && cart) {
          cart.sections = Object.assign({}, data.sections, cart.sections || {});
        }
        return paintCartState(cart, { reinitCheckout: true });
      });
    });
  }

  function resolveDiscountToKeep(cartData) {
    return cartDiscountCode(cartData) || readStoredDiscount();
  }

  function reapplyDiscountAfterCartChange(parsedState) {
    if (!parsedState || parsedState.item_count === 0) {
      if (parsedState && parsedState.item_count === 0) writeStoredDiscount('');
      return Promise.resolve(parsedState);
    }
    var code = resolveDiscountToKeep(parsedState);
    if (!code) return Promise.resolve(parsedState);
    writeStoredDiscount(code);
    return applyShopifyDiscount(code)
      .then(function (cart) {
        writeStoredDiscount(code);
        var next = Promise.resolve(cart);
        if (!shopifyDiscountIsActive(cart)) {
          next = applyShopifyDiscount('').then(function (cleared) {
            writeStoredDiscount(code);
            return cleared || cart;
          });
        }
        return next.then(function (finalCart) {
          var merged = finalCart || parsedState;
          if (merged && parsedState && parsedState.sections) {
            if (!merged.sections) merged.sections = parsedState.sections;
            else merged.sections = Object.assign({}, parsedState.sections, merged.sections);
          }
          return paintCartState(merged).then(function (painted) {
            return painted || merged;
          });
        });
      })
      .catch(function () {
        return parsedState;
      });
  }

  function rebindDrawer(cart) {
    if (!cart) return;
    if (typeof cart.bindOverlayClose === 'function') {
      var overlay = cart.querySelector('#CartDrawer-Overlay');
      if (overlay) delete overlay.dataset.ucBound;
      cart.bindOverlayClose();
    }
  }

  var _refreshingPage = null;

  function getCartSectionIds() {
    var itemsEl = document.getElementById('main-cart-items');
    var cartItemsEl = document.querySelector('cart-items');
    var footerEl = document.getElementById('main-cart-footer');
    return {
      items: (itemsEl && itemsEl.dataset.id) || (cartItemsEl && cartItemsEl.dataset.sectionId),
      footer: footerEl && footerEl.dataset.id,
    };
  }

  function getCartSectionsConfig() {
    var ids = getCartSectionIds();
    return {
      items: ids.items,
      footer: ids.footer,
      targets: [
        { sectionKey: ids.items, rootId: 'main-cart-items', selector: '.js-contents' },
        { sectionKey: ids.footer, rootId: 'main-cart-footer', selector: '.uc-cartx__summary .js-contents' },
        { sectionKey: ids.footer, rootId: 'main-cart-footer', selector: '[data-uc-coupon]', replaceNode: true },
        { sectionKey: ids.footer, rootId: 'main-cart-footer', selector: '.uc-cartx__pay' },
      ],
    };
  }

  function parseSectionNode(html, selector) {
    if (!html) return null;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.querySelector(selector);
  }

  function applyCartSectionResponse(parsedState) {
    if (!parsedState) return Promise.resolve(false);
    var sections = parsedState.sections || {};
    var config = getCartSectionsConfig();
    var updated = false;

    if (config.items && sections[config.items]) {
      var nextItems =
        parseSectionNode(sections[config.items], '#main-cart-items .js-contents') ||
        parseSectionNode(sections[config.items], 'cart-items .js-contents') ||
        parseSectionNode(sections[config.items], '.js-contents');
      var curItems = document.querySelector('#main-cart-items .js-contents');
      if (nextItems && curItems) {
        curItems.innerHTML = nextItems.innerHTML;
        updated = true;
      }
    }

    if (config.footer && sections[config.footer]) {
      var footerHtml = sections[config.footer];
      var nextSummary = parseSectionNode(footerHtml, '.uc-cartx__summary .js-contents');
      var curSummary = document.querySelector('.uc-cartx__summary .js-contents');
      if (nextSummary && curSummary) {
        curSummary.innerHTML = nextSummary.innerHTML;
        updated = true;
      }
      var nextCoupon = parseSectionNode(footerHtml, '[data-uc-coupon]');
      var curCoupon = document.querySelector('[data-uc-coupon]');
      if (nextCoupon && curCoupon) {
        curCoupon.replaceWith(document.importNode(nextCoupon, true));
        updated = true;
      }
      var nextPay = parseSectionNode(footerHtml, '.uc-cartx__pay');
      var curPay = document.querySelector('.uc-cartx__pay');
      if (nextPay && curPay) {
        curPay.innerHTML = nextPay.innerHTML;
        reinitAcceleratedCheckout(curPay);
        updated = true;
      }
    }

    var cartItemsEl = document.querySelector('cart-items');
    if (cartItemsEl && typeof parsedState.item_count === 'number') {
      cartItemsEl.classList.toggle('is-empty', parsedState.item_count === 0);
    }
    var cartFooter = document.getElementById('main-cart-footer');
    if (cartFooter && typeof parsedState.item_count === 'number') {
      cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
    }

    applyCartUi(parsedState);

    if (!updated && config.items && config.footer) {
      return refreshCartPage(1).then(function () {
        return true;
      });
    }

    return Promise.resolve(updated);
  }

  function reinitAcceleratedCheckout(scope) {
    if (window.Shopify && window.Shopify.PaymentButton && typeof window.Shopify.PaymentButton.init === 'function') {
      window.Shopify.PaymentButton.init();
    }
    (scope || document).querySelectorAll('shopify-accelerated-checkout, shopify-accelerated-checkout-cart').forEach(function (el) {
      if (typeof el.update === 'function') el.update();
    });
  }

  function updateCartItemsFromHtml(htmlString) {
    var nextContents =
      parseSectionNode(htmlString, '#main-cart-items .js-contents') ||
      parseSectionNode(htmlString, 'cart-items .js-contents') ||
      parseSectionNode(htmlString, '.js-contents');
    var curContents = document.querySelector('#main-cart-items .js-contents');
    if (nextContents && curContents) {
      curContents.innerHTML = nextContents.innerHTML;
      return;
    }

    var doc = new DOMParser().parseFromString(htmlString, 'text/html');
    var cartItems = document.querySelector('cart-items');
    var nextCartItems = doc.querySelector('cart-items');
    if (!cartItems || !nextCartItems) return;

    cartItems.innerHTML = nextCartItems.innerHTML;
    cartItems.classList.toggle('is-empty', nextCartItems.classList.contains('is-empty'));
  }

  function updateCartFooterFromHtml(htmlString) {
    var footerDoc = new DOMParser().parseFromString(htmlString, 'text/html');
    var cartFooter = document.getElementById('main-cart-footer');
    var nextFooter = footerDoc.getElementById('main-cart-footer');
    if (!cartFooter || !nextFooter) return;

    cartFooter.classList.toggle('is-empty', nextFooter.classList.contains('is-empty'));

    var nextCoupon = footerDoc.querySelector('[data-uc-coupon]');
    var curCoupon = cartFooter.querySelector('[data-uc-coupon]');
    if (nextCoupon && curCoupon) {
      curCoupon.replaceWith(document.importNode(nextCoupon, true));
    }

    var nextSummary = footerDoc.querySelector('.uc-cartx__summary .js-contents');
    var curSummary = cartFooter.querySelector('.uc-cartx__summary .js-contents');
    if (nextSummary && curSummary) {
      curSummary.innerHTML = nextSummary.innerHTML;
    }

    var nextPay = footerDoc.querySelector('.uc-cartx__pay');
    var curPay = cartFooter.querySelector('.uc-cartx__pay');
    if (nextPay && curPay) {
      curPay.innerHTML = nextPay.innerHTML;
      reinitAcceleratedCheckout(curPay);
    }
  }

  function refreshCartPage(attempt) {
    attempt = attempt || 0;
    var cartItems = document.querySelector('cart-items');
    if (!cartItems) return Promise.resolve(null);
    if (_refreshingPage && attempt === 0) return _refreshingPage;

    var ids = getCartSectionIds();
    if (!ids.items || !ids.footer) return Promise.resolve(null);

    var cartUrl =
      (typeof routes !== 'undefined' && routes && routes.cart_url) ||
      (window.routes && window.routes.cart_url) ||
      rootUrl() + 'cart';
    var url =
      cartUrl +
      '?sections=' +
      encodeURIComponent(ids.items) +
      ',' +
      encodeURIComponent(ids.footer) +
      '&_uc=' +
      Date.now();

    var req = fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (sections) {
        if (!sections) {
          if (cartItems.onCartUpdate) return cartItems.onCartUpdate();
          return null;
        }

        if (sections[ids.items]) {
          updateCartItemsFromHtml(sections[ids.items]);
        }

        if (sections[ids.footer]) {
          updateCartFooterFromHtml(sections[ids.footer]);
        }

        return fetchCartJson().then(applyCartUi);
      })
      .catch(function () {
        if (cartItems.onCartUpdate) return cartItems.onCartUpdate();
        return null;
      })
      .finally(function () {
        if (attempt === 0) _refreshingPage = null;
      });

    if (attempt === 0) _refreshingPage = req;
    return req;
  }

  function refreshCartDrawer() {
    return Promise.resolve(null);
  }

  function normalizeError(data) {
    if (!data) return { description: 'Could not add to cart' };
    if (typeof data === 'string') return { description: data };
    return {
      description: data.description || data.message || 'Could not add to cart',
      status: data.status,
      message: data.message,
      errors: data.errors,
    };
  }

  function parseVariantId(form) {
    if (!form) return null;
    var input =
      form.querySelector('[name="id"]:not([disabled])') ||
      form.querySelector('[data-pc-variant-input]') ||
      form.querySelector('[data-pf-variant-input]') ||
      form.querySelector('[data-pvr-variant]');
    var raw = input && String(input.value || '').trim();
    if (!raw) {
      try {
        raw = new FormData(form).get('id');
      } catch (_) {
        raw = null;
      }
    }
    var id = parseInt(raw, 10);
    if (!id || isNaN(id)) return null;
    var qtyInput = form.querySelector('[name="quantity"]');
    var qty = parseInt((qtyInput && qtyInput.value) || '1', 10) || 1;
    return { id: id, quantity: Math.max(1, qty) };
  }

  function afterAdd(source) {
    pulseIcon('[data-uc-phdr-cart-open], #cart-icon-bubble, .uc-phdr__tool--cart');

    return fetchCartJson()
      .then(function (cartData) {
        if (!cartData) {
          broadcastCartUpdate(source, null);
          return null;
        }
        return reapplyDiscountAfterCartChange(cartData).then(function (next) {
          var data = next || cartData;
          applyCartUi(data);
          return refreshCartPage()
            .then(function () {
              applyCartUi(data);
              broadcastCartUpdate(source, data);
              return data;
            })
            .catch(function () {
              applyCartUi(data);
              broadcastCartUpdate(source, data);
              return data;
            });
        });
      })
      .catch(function () {
        broadcastCartUpdate(source, null);
        return null;
      });
  }

  function addFromForm(form, source, options) {
    var parsed = parseVariantId(form);
    if (!parsed) {
      return Promise.reject({ description: 'Missing product variant' });
    }
    if (_inFlightForms.has(form)) {
      return Promise.reject({ description: 'Please wait…' });
    }
    _inFlightForms.add(form);

    return runCartOp(function () {
      return fetch(cartAddUrl(), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ items: [{ id: parsed.id, quantity: parsed.quantity }] }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok || data.status) throw normalizeError(data);
            return data;
          });
        })
        .then(function () {
          return afterAdd(source || 'uc-cart-sync');
        });
    }).finally(function () {
      _inFlightForms.delete(form);
    });
  }

  function addItems(items, source, options) {
    return runCartOp(function () {
      return fetch(cartAddUrl(), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ items: items }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok || data.status) throw normalizeError(data);
            return data;
          });
        })
        .then(function () {
          return afterAdd(source || 'uc-cart-sync');
        });
    });
  }

  /**
   * Fastest Buy Now: Shopify cart permalink → checkout in one navigation.
   * Falls back to add.js → /checkout if permalink is blocked.
   */
  function buyNowFromForm(form) {
    window.__UC_BUY_NOW__ = true;
    var parsed = parseVariantId(form);
    if (!parsed) {
      window.__UC_BUY_NOW__ = false;
      return Promise.reject({ description: 'Missing product variant' });
    }

    /* Instant path — no AJAX wait */
    window.location.assign(rootUrl() + 'cart/' + parsed.id + ':' + parsed.quantity);
    return Promise.resolve();
  }

  function buyNowItems(items) {
    window.__UC_BUY_NOW__ = true;
    if (!items || !items.length || !items[0].id) {
      window.__UC_BUY_NOW__ = false;
      return Promise.reject({ description: 'Missing product variant' });
    }
    var parts = items
      .map(function (it) {
        return parseInt(it.id, 10) + ':' + (parseInt(it.quantity, 10) || 1);
      })
      .join(',');
    window.location.assign(rootUrl() + 'cart/' + parts);
    return Promise.resolve();
  }

  function bindGlobalListeners() {
    if (window.__UC_CART_SYNC_BOUND__) return;
    window.__UC_CART_SYNC_BOUND__ = true;

    function refreshFromEvent(detail) {
      var cartData = detail && (detail.cartData || detail.cart);
      if (cartData && typeof cartData.item_count === 'number') {
        applyCartUi(cartData);
        return;
      }
      fetchCartJson().then(applyCartUi);
    }

    document.addEventListener('cart:updated', function (e) {
      refreshFromEvent(e.detail);
    });
    document.addEventListener('cart:refresh', function (e) {
      refreshFromEvent(e.detail);
      var hasCart = e.detail && (e.detail.cartData || e.detail.cart);
      if (!hasCart) refreshCartPage();
    });

    if (typeof subscribe === 'function' && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
      subscribe(window.PUB_SUB_EVENTS.cartUpdate, function (payload) {
        refreshFromEvent(payload);
      });
    }

    function resyncCartFromShopify() {
      if (!document.querySelector('cart-items')) {
        return fetchCartJson().then(applyCartUi);
      }
      return fetchCartJson().then(function (cart) {
        if (!cart) return null;
        var code = readStoredDiscount();
        var start = Promise.resolve(cart);
        if (code) {
          start = reapplyDiscountAfterCartChange(cart);
        }
        return start.then(function (next) {
          return paintCartState(next || cart, { reinitCheckout: true });
        });
      });
    }

    /* Back-forward cache (e.g. return from checkout) — full cart repaint from Shopify */
    window.addEventListener('pageshow', function () {
      window.__UC_BUY_NOW__ = false;
      resyncCartFromShopify();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        window.__UC_BUY_NOW__ = false;
        resyncCartFromShopify();
      }
    });

    var bubble = document.getElementById('cart-icon-bubble');
    if (bubble && bubble.classList.contains('uc-phdr__tool--cart')) {
      var icon = bubble.querySelector('.uc-phdr-icon');
      if (icon) bubble._ucCartIconHtml = icon.outerHTML;
      if (window.MutationObserver) {
        new MutationObserver(function () {
          protectHeaderCartIcon();
        }).observe(bubble, { childList: true, subtree: true });
      }
    }

    fetchCartJson().then(applyCartUi);
  }

  bindGlobalListeners();

  window.UCCart = {
    runCartOp: runCartOp,
    addFromForm: addFromForm,
    addItems: addItems,
    buyNowFromForm: buyNowFromForm,
    buyNowItems: buyNowItems,
    broadcastCartUpdate: broadcastCartUpdate,
    fetchCartJson: fetchCartJson,
    openCartUI: openCartUI,
    refreshCartDrawer: refreshCartDrawer,
    refreshCartPage: refreshCartPage,
    reinitAcceleratedCheckout: reinitAcceleratedCheckout,
    syncHeaderBadges: syncHeaderBadges,
    syncShippingBars: syncShippingBars,
    applyCartUi: applyCartUi,
    applyCartSectionResponse: applyCartSectionResponse,
    paintCartState: paintCartState,
    getCartSectionsConfig: getCartSectionsConfig,
    syncCartSummary: syncCartSummary,
    getCartDiscountCents: getCartDiscountCents,
    shopifyDiscountIsActive: shopifyDiscountIsActive,
    applyShopifyDiscount: applyShopifyDiscount,
    reapplyDiscountAfterCartChange: reapplyDiscountAfterCartChange,
    readStoredDiscount: readStoredDiscount,
    writeStoredDiscount: writeStoredDiscount,
    cartDiscountCode: cartDiscountCode,
    findDiscountCodeEntry: findDiscountCodeEntry,
    pulseIcon: pulseIcon,
  };
})();

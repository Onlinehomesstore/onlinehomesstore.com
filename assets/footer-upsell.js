/*
  FOOTER UPSELL — free shipping progress + bundle add (cart API)
 */
(function () {
  'use strict';

  function rootUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.charAt(root.length - 1) === '/' ? root : root + '/';
  }

  function publishCart(cart) {
    if (window.UCCart && window.UCCart.broadcastCartUpdate) {
      window.UCCart.broadcastCartUpdate('footer-upsell', cart);
      return;
    }
    if (window.publish && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
      window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'footer-upsell', cartData: cart });
    }
  }

  function formatMoney(cents, format) {
    if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
    var value = (cents / 100).toFixed(2);
    if (!format) return value;
    return format.replace(/\{\{\s*amount\s*\}\}/, value);
  }

  function initShipping(section) {
    var bar = section.querySelector('[data-fu-shipping]');
    if (!bar) return;

    var dataEl = section.querySelector('[id^="fu-data-"]');
    var threshold = 200000;
    var thresholdDisplay = '';
    if (dataEl) {
      try {
        var data = JSON.parse(dataEl.textContent || '{}');
        threshold = parseInt(data.threshold, 10) || threshold;
        thresholdDisplay = data.thresholdDisplay || '';
      } catch (_) { /* noop */ }
    }

    var fill = bar.querySelector('[data-fu-ship-fill]');
    var msg = bar.querySelector('[data-fu-ship-msg]');
    var amt = bar.querySelector('[data-fu-ship-amount]');

    function render(cart) {
      var total = cart && cart.total_price ? cart.total_price : 0;
      var pct = threshold > 0 ? Math.min(100, Math.round(total * 100 / threshold)) : 0;
      var remaining = Math.max(0, threshold - total);

      if (fill) fill.style.setProperty('--fu-ship-pct', pct + '%');

      if (amt) {
        amt.textContent = pct >= 100 ? 'Unlocked' : Math.round(pct) + '%';
      }

      if (msg) {
        if (pct >= 100) {
          msg.textContent = 'You qualify for free shipping!';
        } else {
          var rem = (remaining / 100).toFixed(2);
          msg.textContent = 'Add items worth ' + rem + ' more to unlock free delivery.';
        }
      }
    }

    function refresh() {
      fetch(rootUrl() + 'cart.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(render)
        .catch(function () { render({ total_price: 0 }); });
    }

    refresh();

    document.addEventListener('cart:updated', refresh);
    if (window.PUB_SUB_EVENTS && window.subscribe) {
      try {
        window.subscribe(window.PUB_SUB_EVENTS.cartUpdate, refresh);
      } catch (_) { /* noop */ }
    }
  }

  function initBundle(section) {
    var btn = section.querySelector('[data-fu-bundle-add]');
    if (!btn) return;

    var dataEl = section.querySelector('[id^="fu-data-"]');
    var ids = [];
    if (dataEl) {
      try {
        ids = JSON.parse(dataEl.textContent || '{}').bundleVariantIds || [];
      } catch (_) { ids = []; }
    }
    ids = ids.filter(Boolean);
    if (!ids.length) {
      btn.hidden = true;
      return;
    }

    btn.addEventListener('click', function () {
      btn.classList.add('is-loading');
      btn.disabled = true;

      var items = ids.map(function (id) {
        return { id: Number(id), quantity: 1 };
      }).filter(function (item) { return item.id; });

      var chain =
        window.UCCart && typeof window.UCCart.addItems === 'function'
          ? window.UCCart.addItems(items, 'footer-upsell')
          : items.reduce(function (next, item) {
              return next.then(function () {
                var fd = new FormData();
                fd.append('id', item.id);
                fd.append('quantity', '1');
                return fetch(rootUrl() + 'cart/add.js', {
                  method: 'POST',
                  body: fd,
                  headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }
                }).then(function (res) {
                  if (!res.ok) return res.json().then(function (e) { throw e; });
                  return res.json();
                });
              });
            }, Promise.resolve());

      chain
        .then(function () {
          if (window.UCCart && typeof window.UCCart.fetchCartJson === 'function') {
            return window.UCCart.fetchCartJson();
          }
          return fetch(rootUrl() + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) {
            return r.json();
          });
        })
        .then(function (cart) {
          publishCart(cart);
          btn.textContent = 'Added!';
          setTimeout(function () {
            btn.textContent = btn.getAttribute('data-default-label') || 'Add bundle to cart';
          }, 2000);
        })
        .catch(function (err) {
          console.warn('[FooterUpsell] bundle', err);
        })
        .finally(function () {
          btn.classList.remove('is-loading');
          btn.disabled = false;
        });
    });

    btn.setAttribute('data-default-label', btn.textContent.trim());
  }

  function init(section) {
    initShipping(section);
    initBundle(section);
  }

  function boot() {
    document.querySelectorAll('[data-fu-section]').forEach(init);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-fu-section]');
    if (s) init(s);
  });
})();

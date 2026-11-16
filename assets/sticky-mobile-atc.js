/*
  ============================================================================
  STICKY MOBILE ATC — JavaScript (~160 lines)
  ----------------------------------------------------------------------------
  1. IntersectionObserver: show when main ATC scrolls out of view,
     hide when footer enters viewport.
  2. Variant select → price / image / availability / inventory update.
  3. Quantity stepper.
  4. AJAX Add to Cart (same pattern as premium-product-hero.js).
  5. Buy Now variant sync.
  6. Low-stock badge update.
  ============================================================================
*/
(function () {
  'use strict';

  var LOW_STOCK_THRESHOLD = 5;

  function rootUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.charAt(root.length - 1) === '/' ? root : root + '/';
  }

  function publishCart(cart) {
    if (window.UCCart && typeof window.UCCart.broadcastCartUpdate === 'function') {
      window.UCCart.broadcastCartUpdate('sticky-mobile-atc', cart);
      return;
    }
    if (window.publish && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
      window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'sticky-mobile-atc', cart: cart });
    }
  }

  function initSMA(bar) {
    var uid        = bar.id.replace('StickyMobileATC-', '');
    var formEl     = bar.querySelector('.sma__form');
    var varInput   = bar.querySelector('[data-sma-variant]');
    var selectEl   = bar.querySelector('[data-sma-select]');
    var atcBtn     = bar.querySelector('[data-sma-atc]');
    var atcText    = bar.querySelector('[data-sma-atc-text]');
    var atcSpin    = bar.querySelector('[data-sma-spin]');
    var priceEl    = bar.querySelector('[data-sma-price]');
    var compareEl  = bar.querySelector('[data-sma-compare]');
    var discountEl = bar.querySelector('[data-sma-discount]');
    var imgEl      = bar.querySelector('[data-sma-img]');
    var qtyInput   = bar.querySelector('[data-sma-qty]');
    var qtyDec     = bar.querySelector('[data-sma-qty-dec]');
    var qtyInc     = bar.querySelector('[data-sma-qty-inc]');
    var stockBadge = bar.querySelector('.sma__infobar-badge');
    var buyBtn     = bar.querySelector('[data-sma-buy]');

    /* Load variant map */
    var variantsMap = {};
    var threshold   = LOW_STOCK_THRESHOLD;
    var dataEl = document.getElementById('sma-variants-' + uid);
    if (dataEl) {
      try {
        var parsed = JSON.parse(dataEl.textContent || '{}');
        (parsed.variants || []).forEach(function (v) { variantsMap[String(v.id)] = v; });
      } catch (_) {}
    }

    /* ── Apply variant ──────────────────────────────────────────────── */
    function applyVariant(id) {
      var v = variantsMap[String(id)];
      if (!v) return;

      /* Price */
      if (priceEl) priceEl.textContent = v.priceFmt || '';
      if (compareEl) {
        if (v.compareAt && v.compareAt > v.price) {
          compareEl.textContent = v.compareFmt || '';
          compareEl.hidden = false;
        } else {
          compareEl.hidden = true;
        }
      }
      if (discountEl) {
        if (v.compareAt && v.compareAt > v.price) {
          var pct = Math.round((v.compareAt - v.price) * 100 / v.compareAt);
          discountEl.textContent = '-' + pct + '%';
          discountEl.hidden = false;
        } else {
          discountEl.hidden = true;
        }
      }

      /* Image */
      if (imgEl && v.img) imgEl.src = v.img;

      /* Button */
      if (atcBtn) {
        atcBtn.disabled = !v.available;
        atcBtn.setAttribute('aria-disabled', String(!v.available));
      }
      if (atcText) {
        atcText.textContent = v.available
          ? (atcBtn && atcBtn.dataset.labelAdd || 'Add to Cart')
          : (atcBtn && atcBtn.dataset.labelSold || 'Sold Out');
      }

      /* Variant inputs + sync main hero form when present */
      if (varInput) varInput.value = id;
      var heroId = document.querySelector('.pph__form input[name="id"]');
      if (heroId) heroId.value = id;
      if (buyBtn) buyBtn.disabled = !v.available;

      /* Stock badge */
      if (stockBadge && v.invMgmt === 'shopify') {
        if (v.available && v.invQty > 0 && v.invQty <= threshold) {
          stockBadge.textContent = 'Only ' + v.invQty + ' left!';
          stockBadge.className = 'sma__infobar-badge sma__infobar-badge--warn';
          stockBadge.hidden = false;
        } else if (v.available) {
          stockBadge.textContent = 'In Stock';
          stockBadge.className = 'sma__infobar-badge sma__infobar-badge--ok';
          stockBadge.hidden = false;
        } else {
          stockBadge.hidden = true;
        }
      }
    }

    if (selectEl) {
      selectEl.addEventListener('change', function () { applyVariant(this.value); });
    }

    /* ── Quantity stepper ───────────────────────────────────────────── */
    if (qtyDec && qtyInc && qtyInput) {
      qtyDec.addEventListener('click', function () {
        var v = parseInt(qtyInput.value, 10) || 1;
        if (v > 1) qtyInput.value = v - 1;
      });
      qtyInc.addEventListener('click', function () {
        var v = parseInt(qtyInput.value, 10) || 1;
        qtyInput.value = v + 1;
      });
    }

    /* ── AJAX Add to Cart ───────────────────────────────────────────── */
    if (formEl) {
      formEl.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!atcBtn || atcBtn.disabled || atcBtn.classList.contains('is-loading')) return;
        atcBtn.classList.add('is-loading');
        if (atcText) atcText.hidden = true;
        if (atcSpin) atcSpin.hidden = false;

        var addPromise =
          window.UCCart && typeof window.UCCart.addFromForm === 'function'
            ? window.UCCart.addFromForm(formEl, 'sticky-mobile-atc')
            : fetch(rootUrl() + 'cart/add.js', {
                method: 'POST',
                body: new FormData(formEl),
                headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
              }).then(function (res) {
                if (!res.ok) return res.json().then(function (e) { throw e; });
                return res.json();
              }).then(function () {
                return fetch(rootUrl() + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) {
                  return r.json();
                });
              }).then(function (cart) {
                publishCart(cart);
                return cart;
              });

        addPromise
        .then(function () {
          atcBtn.classList.add('is-success');
          if (atcText) atcText.textContent = 'Added';
          window.setTimeout(function () {
            atcBtn.classList.remove('is-success');
            if (atcText) atcText.textContent = atcBtn.getAttribute('data-label-add') || 'Add to Cart';
          }, 2000);
        })
        .catch(function (err) { console.warn('[sticky-mobile-atc]', err); })
        .finally(function () {
          atcBtn.classList.remove('is-loading');
          if (atcText) atcText.hidden = false;
          if (atcSpin) atcSpin.hidden = true;
        });
      });
    }

    /* ── Buy Now — AJAX add then checkout (no page reload /cart/buy) ─── */
    if (buyBtn && formEl) {
      buyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (buyBtn.disabled) return;
        buyBtn.disabled = true;
        buyBtn.classList.add('is-loading');
        var prev = buyBtn.textContent;
        buyBtn.textContent = '…';

        /* Keep ATC form qty/variant in sync before buy */
        if (qtyInput) {
          var qtyField = formEl.querySelector('input[name="quantity"]');
          if (qtyField) qtyField.value = qtyInput.value;
          else {
            var hiddenQty = document.createElement('input');
            hiddenQty.type = 'hidden';
            hiddenQty.name = 'quantity';
            hiddenQty.value = qtyInput.value || '1';
            formEl.appendChild(hiddenQty);
          }
        }

        var buyPromise =
          window.UCCart && typeof window.UCCart.buyNowFromForm === 'function'
            ? window.UCCart.buyNowFromForm(formEl, 'sticky-mobile-atc-buy-now')
            : window.UCCart && typeof window.UCCart.addFromForm === 'function'
              ? window.UCCart.addFromForm(formEl, 'sticky-mobile-atc-buy-now', { openDrawer: false }).then(function () {
                  window.location.href = rootUrl() + 'checkout';
                })
              : fetch(rootUrl() + 'cart/add.js', {
                  method: 'POST',
                  body: new FormData(formEl),
                  headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
                }).then(function (res) {
                  if (!res.ok) return res.json().then(function (err) { throw err; });
                  window.location.href = rootUrl() + 'checkout';
                });

        buyPromise.catch(function (err) {
          console.warn('[sticky-mobile-atc] buy now', err);
          buyBtn.disabled = false;
          buyBtn.classList.remove('is-loading');
          buyBtn.textContent = prev || 'Buy Now';
        });
      });
    }

    /* ── Visibility: main ATC + footer ─────────────────────────────── */
    var mainATC = document.querySelector('[data-pph-atc]') || document.querySelector('.product-form__submit');
    var footer  = document.querySelector('footer, .footer, [data-section-type="footer"]');

    function setVisible(show) {
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', String(!show));
    }

    if (!window.IntersectionObserver) { setVisible(true); return; }

    var atcIO = null, footIO = null;
    var atcOut = false, footIn = false;

    function updateVisibility() { setVisible(atcOut && !footIn); }

    if (mainATC) {
      atcIO = new IntersectionObserver(function (entries) {
        atcOut = !entries[0].isIntersecting;
        updateVisibility();
      }, { threshold: 0 });
      atcIO.observe(mainATC);
    } else {
      atcOut = true;
      updateVisibility();
    }

    if (footer) {
      footIO = new IntersectionObserver(function (entries) {
        footIn = entries[0].isIntersecting;
        updateVisibility();
      }, { threshold: 0 });
      footIO.observe(footer);
    }
  }

  function boot() {
    document.querySelectorAll('[data-sma-section]').forEach(initSMA);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-sma-section]');
    if (s) initSMA(s);
  });
})();

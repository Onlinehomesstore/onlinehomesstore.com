/*
  STICKY ADD TO CART — syncs with Premium Product Hero via uc:variant-change
 */
(function () {
  'use strict';

  function rootUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.charAt(root.length - 1) === '/' ? root : root + '/';
  }

  function formatMoney(cents, format) {
    if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
    if (!format) return (cents / 100).toFixed(2);
    var value = (cents / 100).toFixed(2);
    return format.replace(/\{\{\s*amount\s*\}\}/, value);
  }

  function initStickyATC(bar) {
    var formEl = bar.querySelector('.satc__form');
    var varInput = bar.querySelector('[data-satc-variant]');
    var selectEl = bar.querySelector('[data-satc-select]');
    var atcBtn = bar.querySelector('[data-satc-atc]');
    var atcText = bar.querySelector('[data-satc-atc-text]');
    var atcSpin = bar.querySelector('[data-satc-spinner]');
    var priceEl = bar.querySelector('[data-satc-price]');
    var compareEl = bar.querySelector('[data-satc-compare]');
    var saveBadge = bar.querySelector('[data-satc-save]');
    var currentEl = bar.querySelector('[data-satc-current]');
    var saveLine = bar.querySelector('[data-satc-save-line]');
    var saveAmt = bar.querySelector('[data-satc-save-amt]');
    var imgEl = bar.querySelector('[data-satc-img]');
    var qtyInput = bar.querySelector('[data-satc-qty]');
    var qtyDec = bar.querySelector('[data-satc-qty-dec]');
    var qtyInc = bar.querySelector('[data-satc-qty-inc]');

    var meta = { moneyFormat: '${{amount}}', saveLabel: 'You save' };
    var variantsMap = {};

    var dataEl = document.getElementById(bar.id.replace('StickyATC-', 'satc-variants-'));
    if (dataEl) {
      try {
        var parsed = JSON.parse(dataEl.textContent || '{}');
        meta.moneyFormat = parsed.moneyFormat || meta.moneyFormat;
        meta.saveLabel = parsed.saveLabel || meta.saveLabel;
        (parsed.variants || []).forEach(function (v) { variantsMap[String(v.id)] = v; });
      } catch (_) { /* noop */ }
    }

    function applyVariant(id) {
      var v = variantsMap[String(id)];
      if (!v) return;

      if (currentEl) currentEl.textContent = v.priceFmt;

      var onSale = v.compareAt && v.compareAt > v.price;
      if (compareEl) {
        if (onSale) {
          compareEl.textContent = v.compareFmt;
          compareEl.hidden = false;
        } else {
          compareEl.hidden = true;
        }
      }

      if (saveBadge) {
        if (onSale) {
          var pct = Math.round((v.compareAt - v.price) * 100 / v.compareAt);
          saveBadge.textContent = '-' + pct + '%';
          saveBadge.hidden = false;
        } else {
          saveBadge.hidden = true;
        }
      }

      if (saveLine && saveAmt) {
        if (v.saveAmountRaw > 0) {
          saveAmt.textContent = formatMoney(v.saveAmountRaw, meta.moneyFormat);
          saveLine.hidden = false;
        } else {
          saveLine.hidden = true;
        }
      }

      if (imgEl && v.featuredImg) imgEl.src = v.featuredImg;

      if (atcBtn && atcText) {
        atcBtn.disabled = !v.available;
        atcBtn.setAttribute('aria-disabled', String(!v.available));
        atcText.textContent = v.available
          ? (atcBtn.getAttribute('data-label-add') || 'Add to Cart')
          : (atcBtn.getAttribute('data-label-sold') || 'Sold Out');
      }

      if (varInput) varInput.value = id;
      if (selectEl && selectEl.value !== String(id)) selectEl.value = String(id);
    }

    if (selectEl) {
      selectEl.addEventListener('change', function () {
        applyVariant(this.value);
        document.dispatchEvent(new CustomEvent('uc:variant-change', {
          bubbles: true,
          detail: { variantId: parseInt(this.value, 10), source: 'sticky-atc' }
        }));
      });
    }

    document.addEventListener('uc:variant-change', function (e) {
      if (!e.detail || e.detail.source === 'sticky-atc') return;
      applyVariant(e.detail.variantId);
    });

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

    if (formEl) {
      formEl.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!atcBtn || atcBtn.disabled) return;

        atcBtn.classList.add('is-loading');
        if (atcText) atcText.hidden = true;
        if (atcSpin) atcSpin.hidden = false;

        var addPromise =
          window.UCCart && window.UCCart.addFromForm
            ? window.UCCart.addFromForm(formEl, 'sticky-atc')
            : fetch(rootUrl() + 'cart/add.js', {
                method: 'POST',
                body: new FormData(formEl),
                headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
              }).then(function (res) {
                if (!res.ok) return res.json().then(function (err) { throw err; });
                return res.json();
              });

        addPromise
        .catch(function (err) {
          console.warn('[StickyATC]', err);
        })
        .finally(function () {
          atcBtn.classList.remove('is-loading');
          if (atcText) atcText.hidden = false;
          if (atcSpin) atcSpin.hidden = true;
        });
      });
    }

    var mainATC = document.querySelector('[data-pph-atc]') ||
                  document.querySelector('.product-form__submit');

    if (!mainATC || !window.IntersectionObserver) {
      bar.classList.add('is-visible');
      bar.setAttribute('aria-hidden', 'false');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var show = !e.isIntersecting;
        bar.classList.toggle('is-visible', show);
        bar.setAttribute('aria-hidden', String(!show));
      });
    }, { threshold: 0 });

    io.observe(mainATC);
  }

  function boot() {
    document.querySelectorAll('[data-satc-section]').forEach(initStickyATC);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-satc-section]');
    if (s) initStickyATC(s);
  });
})();

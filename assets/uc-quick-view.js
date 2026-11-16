/*
  UC Premium Quick View — global modal (Section Rendering API)
  Uses sections/pf-quick-view.liquid + UCCart for AJAX add / Buy Now.
  Single modal system for homepage + collection + all product cards.
*/
(function () {
  'use strict';

  if (window.__UC_QUICK_VIEW__) return;
  window.__UC_QUICK_VIEW__ = true;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var qvCache = {};

  function rootUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.charAt(root.length - 1) === '/' ? root : root + '/';
  }

  function qvEndpoint(url) {
    return url.split('?')[0] + '?section_id=pf-quick-view';
  }

  function fetchQuickView(url) {
    var key = qvEndpoint(url);
    if (qvCache[key]) return qvCache[key];
    var promise = fetch(key, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'text/html' },
    }).then(function (r) {
      if (!r.ok) throw new Error('QV fetch failed');
      return r.text();
    });
    qvCache[key] = promise;
    promise.catch(function () {
      delete qvCache[key];
    });
    return promise;
  }

  function trapFocus(container, e) {
    var nodes = container.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  var QuickView = {
    modal: null,
    panel: null,
    lastFocus: null,
    closing: false,
    openUrl: '',

    ensure: function () {
      if (this.modal) return;
      this.modal = document.createElement('div');
      this.modal.className = 'pf-qv-modal uc-qv-modal';
      this.modal.hidden = true;
      this.modal.setAttribute('aria-hidden', 'true');
      this.modal.innerHTML =
        '<div class="pf-qv-modal__backdrop" data-pf-qv-close tabindex="-1"></div>' +
        '<div class="pf-qv-modal__panel" role="dialog" aria-modal="true" aria-label="Quick view" tabindex="-1"></div>';
      document.body.appendChild(this.modal);
      this.panel = this.modal.querySelector('.pf-qv-modal__panel');
      var self = this;
      this.modal.addEventListener('click', function (e) {
        var closer = e.target.closest('[data-pf-qv-close]');
        if (!closer && !e.target.classList.contains('pf-qv-modal__backdrop')) return;
        e.preventDefault();
        e.stopPropagation();
        self.close();
      });
      this.modal.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') self.close();
        else if (e.key === 'Tab') trapFocus(self.panel, e);
      });
    },

    prefetch: function (url) {
      if (url) fetchQuickView(url);
    },

    open: function (url) {
      if (!url) return;
      if (window.matchMedia && window.matchMedia('(max-width: 989px)').matches) {
        window.location.href = url.split('?')[0];
        return;
      }
      var self = this;
      this.ensure();
      this.closing = false;
      this.openUrl = url;
      this.lastFocus = document.activeElement;
      this.modal.hidden = false;
      this.modal.setAttribute('aria-hidden', 'false');
      this.modal.classList.add('is-open');
      document.documentElement.classList.add('ch-scroll-locked', 'uc-qv-open');
      if (window.UCScrollLock) window.UCScrollLock.lock();
      this.panel.innerHTML =
        '<div class="pf-qv__skeleton" aria-hidden="true">' +
        '<div class="pf-qv__skeleton-media"></div>' +
        '<div class="pf-qv__skeleton-body"><span></span><span></span><span></span><span></span></div></div>';

      fetchQuickView(url)
        .then(function (html) {
          if (self.closing || self.modal.hidden || self.openUrl !== url) return;
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var root = doc.querySelector('[data-pf-qv-root]');
          self.panel.innerHTML = root
            ? root.outerHTML
            : '<p class="pf-qv__loading">Unable to load product.</p>';
          bindPanel(self.panel);
          var closeBtn = self.panel.querySelector('[data-pf-qv-close]');
          (closeBtn || self.panel).focus();
        })
        .catch(function () {
          if (self.closing || self.modal.hidden) return;
          self.panel.innerHTML = '<p class="pf-qv__loading">Unable to load product.</p>';
        });
    },

    close: function () {
      if (!this.modal || this.closing) return;
      if (this.modal.hidden && !this.modal.classList.contains('is-open')) return;
      this.closing = true;
      this.openUrl = '';
      this.modal.classList.remove('is-open');
      document.documentElement.classList.remove('ch-scroll-locked', 'uc-qv-open');
      if (window.UCScrollLock) window.UCScrollLock.unlock();
      var self = this;
      var finish = function () {
        self.modal.hidden = true;
        self.modal.setAttribute('aria-hidden', 'true');
        self.panel.innerHTML = '';
        self.closing = false;
      };
      window.setTimeout(finish, REDUCED ? 0 : 180);
      if (this.lastFocus && this.lastFocus.focus) {
        if (window.UCScrollLock && window.UCScrollLock.focus) window.UCScrollLock.focus(this.lastFocus);
        else {
          try {
            this.lastFocus.focus({ preventScroll: true });
          } catch (_) {}
        }
      }
    },
  };

  function activateSlide(root, id) {
    if (!root || id == null || id === '') return;
    var slides = root.querySelectorAll('[data-pf-qv-slide]');
    var thumbs = root.querySelectorAll('[data-pf-qv-thumb]');
    var matched = false;
    slides.forEach(function (slide) {
      var on = String(slide.getAttribute('data-media-id')) === String(id);
      slide.classList.toggle('is-active', on);
      if (on) matched = true;
    });
    if (!matched && slides[0]) {
      slides[0].classList.add('is-active');
      id = slides[0].getAttribute('data-media-id');
    }
    thumbs.forEach(function (t) {
      t.classList.toggle('is-active', String(t.getAttribute('data-media-id')) === String(id));
    });
    var activeThumb = root.querySelector('[data-pf-qv-thumb].is-active');
    if (activeThumb && activeThumb.scrollIntoView) {
      activeThumb.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function stepGallery(root, dir) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-pf-qv-slide]'));
    if (slides.length < 2) return;
    var idx = slides.findIndex(function (s) {
      return s.classList.contains('is-active');
    });
    if (idx < 0) idx = 0;
    var next = slides[(idx + dir + slides.length) % slides.length];
    activateSlide(root, next.getAttribute('data-media-id'));
  }

  function bindPanel(scope) {
    var root = scope.querySelector('[data-pf-qv-root]') || scope.closest('[data-pf-qv-root]') || scope;

    root.querySelectorAll('[data-pf-qv-thumb]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        activateSlide(root, btn.getAttribute('data-media-id'));
      });
    });

    var prev = root.querySelector('[data-pf-qv-prev]');
    var next = root.querySelector('[data-pf-qv-next]');
    if (prev) {
      prev.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        stepGallery(root, -1);
      });
    }
    if (next) {
      next.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        stepGallery(root, 1);
      });
    }

    /* Ensure one active slide */
    if (!root.querySelector('[data-pf-qv-slide].is-active')) {
      var first = root.querySelector('[data-pf-qv-slide]');
      if (first) activateSlide(root, first.getAttribute('data-media-id'));
    }

    scope.querySelectorAll('[data-pf-qty]').forEach(function (wrap) {
      if (wrap.dataset.ucQvBound) return;
      wrap.dataset.ucQvBound = '1';
      var input = wrap.querySelector('.pf-qty__input');
      var minus = wrap.querySelector('[data-pf-qty-minus]');
      var plus = wrap.querySelector('[data-pf-qty-plus]');
      if (minus)
        minus.addEventListener('click', function (e) {
          e.preventDefault();
          input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
        });
      if (plus)
        plus.addEventListener('click', function (e) {
          e.preventDefault();
          input.value = (parseInt(input.value, 10) || 1) + 1;
        });
    });

    scope.querySelectorAll('[data-pf-qv-variant]').forEach(function (select) {
      select.addEventListener('change', function () {
        var opt = select.options[select.selectedIndex];
        var r = select.closest('[data-pf-qv-root]');
        var priceEl = r && r.querySelector('[data-pf-qv-price]');
        var stockEl = r && r.querySelector('[data-pf-qv-stock]');
        var atc = r && r.querySelector('[data-pf-add]');
        var buy = r && r.querySelector('[data-pf-buy-now]');
        if (opt && priceEl) {
          var compare = opt.getAttribute('data-compare');
          var price = opt.getAttribute('data-price');
          if (compare && compare !== price) {
            priceEl.innerHTML =
              '<span class="pf-qv__price pf-qv__price--sale">' +
              price +
              '</span><span class="pf-qv__price pf-qv__price--compare">' +
              compare +
              '</span>';
          } else {
            priceEl.innerHTML = '<span class="pf-qv__price">' + price + '</span>';
          }
        }
        var available = opt && opt.getAttribute('data-available') === 'true';
        if (stockEl) {
          stockEl.innerHTML = available
            ? '<span class="pf-qv__stock-dot"></span> In stock — ready to ship'
            : 'Currently unavailable';
        }
        if (atc) atc.disabled = !available;
        if (buy) buy.disabled = !available;
      });
    });

    scope.querySelectorAll('[data-pf-qv-wish]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var cardWish = document.querySelector(
          '[data-pc-wishlist][data-product-id="' + (btn.dataset.productId || '') + '"]'
        );
        if (cardWish) cardWish.click();
        btn.classList.toggle('is-active');
      });
    });

    var form = scope.querySelector('form[data-type="add-to-cart-form"], .pf-qv__form');
    if (form && !form.dataset.ucQvCart) {
      form.dataset.ucQvCart = '1';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var btn = form.querySelector('[data-pf-add]');
        if (!btn || btn.disabled || btn.classList.contains('is-loading')) return;
        btn.classList.add('is-loading');
        btn.disabled = true;
        var run =
          window.UCCart && window.UCCart.addFromForm
            ? window.UCCart.addFromForm(form, 'uc-quick-view', { openDrawer: false })
            : Promise.reject({ description: 'Cart unavailable' });
        run
          .then(function () {
            btn.classList.remove('is-loading');
            btn.classList.add('is-success');
            setTimeout(function () {
              QuickView.close();
            }, 320);
          })
          .catch(function (err) {
            btn.disabled = false;
            btn.classList.remove('is-loading');
            btn.classList.add('is-error');
            console.warn('[uc-quick-view]', err);
            setTimeout(function () {
              btn.classList.remove('is-error');
            }, 2000);
          });
      });
    }

    var buyBtn = scope.querySelector('[data-pf-buy-now]');
    if (buyBtn && form) {
      buyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (buyBtn.disabled) return;
        buyBtn.disabled = true;
        buyBtn.classList.add('is-loading');
        if (window.UCCart && window.UCCart.buyNowFromForm) {
          window.UCCart.buyNowFromForm(form).catch(function () {
            buyBtn.disabled = false;
            buyBtn.classList.remove('is-loading');
          });
        }
      });
    }
  }

  document.addEventListener(
    'click',
    function (e) {
      var qv = e.target.closest('[data-pf-quickview], [data-uc-quickview]');
      if (!qv) return;
      e.preventDefault();
      e.stopPropagation();
      var url = qv.getAttribute('data-product-url') || qv.getAttribute('href');
      QuickView.open(url);
    },
    true
  );

  document.addEventListener(
    'pointerdown',
    function (e) {
      var qv = e.target.closest && e.target.closest('[data-pf-quickview], [data-uc-quickview]');
      if (!qv) return;
      QuickView.prefetch(qv.getAttribute('data-product-url') || qv.getAttribute('href'));
    },
    { passive: true }
  );

  window.UCQuickView = QuickView;
})();

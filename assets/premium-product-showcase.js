/*
  Premium Product Showcase — vanilla JS
  AJAX cart, quick view, wishlist, variants, reveal
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WISH_KEY = 'uc:wishlist';

  function rootUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.charAt(root.length - 1) === '/' ? root : root + '/';
  }

  /* Quick View uses global UCQuickView (uc-quick-view.js) — never create a second modal */

  function publishCart(cart) {
    if (window.publish && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
      window.publish(window.PUB_SUB_EVENTS.cartUpdate, {
        source: 'premium-product-showcase',
        cartData: cart,
      });
    }
    document.dispatchEvent(
      new CustomEvent('cart:refresh', {
        bubbles: true,
        detail: { source: 'premium-product-showcase', cartData: cart },
      })
    );
  }

  function fetchCart() {
    return fetch(rootUrl() + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) {
      return r.ok ? r.json() : null;
    });
  }

  var Wishlist = {
    read: function () {
      try {
        var list = JSON.parse(localStorage.getItem(WISH_KEY)) || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    },
    write: function (list) {
      try {
        localStorage.setItem(WISH_KEY, JSON.stringify(list));
      } catch (e) {}
      var count = list.length;
      document.dispatchEvent(new CustomEvent('wishlist:change', { bubbles: true, detail: { list: list, count: count } }));
      document.dispatchEvent(new CustomEvent('uc:wishlist:change', { bubbles: true, detail: { list: list, count: count } }));
    },
    indexOf: function (list, id) {
      id = String(id);
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (item == null) continue;
        if (typeof item === 'object') {
          if (String(item.id) === id) return i;
        } else if (String(item) === id) {
          return i;
        }
      }
      return -1;
    },
    toggle: function (id, meta) {
      id = String(id);
      var list = this.read();
      var idx = this.indexOf(list, id);
      if (idx === -1) {
        list.push(
          meta && typeof meta === 'object'
            ? Object.assign({ id: id }, meta)
            : { id: id }
        );
      } else {
        list.splice(idx, 1);
      }
      this.write(list);
      return this.indexOf(list, id) !== -1;
    },
    has: function (id) {
      return this.indexOf(this.read(), id) !== -1;
    },
  };

  var QuickView = {
    prefetch: function (url) {
      if (window.UCQuickView) window.UCQuickView.prefetch(url);
    },
    open: function (url) {
      if (window.UCQuickView) window.UCQuickView.open(url);
    },
    close: function () {
      if (window.UCQuickView) window.UCQuickView.close();
    },
  };

  function bindQty(scope) {
    scope.querySelectorAll('[data-pf-qty]').forEach(function (wrap) {
      if (wrap.dataset.pfBound) return;
      wrap.dataset.pfBound = 'true';
      var input = wrap.querySelector('.pf-qty__input');
      var minus = wrap.querySelector('[data-pf-qty-minus]');
      var plus = wrap.querySelector('[data-pf-qty-plus]');
      if (minus)
        minus.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
        });
      if (plus)
        plus.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          input.value = (parseInt(input.value, 10) || 1) + 1;
        });
    });
  }

  function bindWishlist(scope) {
    scope.querySelectorAll('[data-pf-wishlist]').forEach(function (btn) {
      if (btn.dataset.pfBound) return;
      btn.dataset.pfBound = 'true';
      var id = btn.getAttribute('data-product-id');
      btn.classList.toggle('is-active', Wishlist.has(id));
      btn.setAttribute('aria-pressed', Wishlist.has(id) ? 'true' : 'false');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var active = Wishlist.toggle(id, {
          handle: btn.getAttribute('data-product-handle') || '',
          title: btn.getAttribute('data-product-title') || '',
          url: btn.getAttribute('data-product-url') || '',
          image: btn.getAttribute('data-product-image') || '',
          price: btn.getAttribute('data-product-price') || '',
          variantId: btn.getAttribute('data-variant-id') || '',
        });
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  }

  function bindVariants(scope) {
    scope.querySelectorAll('[data-pf-variant-select]').forEach(function (select) {
      if (select.dataset.pfBound) return;
      select.dataset.pfBound = 'true';
      select.addEventListener('change', function () {
        var card = select.closest('[data-pf-card]');
        var input = card && card.querySelector('[data-pf-variant-input]');
        var btn = card && card.querySelector('[data-pf-add]');
        if (input) input.value = select.value;
        if (btn) {
          var opt = select.options[select.selectedIndex];
          btn.disabled = opt && opt.disabled;
        }
      });
    });
  }

  function setButtonState(btn, state) {
    if (!btn) return;
    btn.classList.remove('is-loading', 'is-success', 'is-error');
    if (state) btn.classList.add(state);
  }

  function addToCart(form, btn) {
    var idInput = form.querySelector('[name="id"]');
    var qtyInput = form.querySelector('[name="quantity"]');
    var variantId = parseInt(idInput && idInput.value, 10);
    var quantity = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;

    if (!variantId) {
      setButtonState(btn, 'is-error');
      return Promise.reject(new Error('Missing variant'));
    }

    setButtonState(btn, 'is-loading');
    btn.disabled = true;

    var run =
      window.UCCart && typeof window.UCCart.addItems === 'function'
        ? window.UCCart.addItems([{ id: variantId, quantity: quantity }], 'premium-product-showcase', {
            openDrawer: false,
          })
        : window.UCCart && typeof window.UCCart.addFromForm === 'function'
          ? window.UCCart.addFromForm(form, 'premium-product-showcase', { openDrawer: false })
          : fetch(rootUrl() + 'cart/add.js', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ items: [{ id: variantId, quantity: quantity }] }),
            }).then(function (response) {
              return response.json().then(function (data) {
                if (!response.ok || data.status) throw data;
                return data;
              });
            });

    return run
      .then(function () {
        btn.disabled = false;
        setButtonState(btn, 'is-success');

        /* Fire fly animation ONLY after confirmed cart success */
        var scope = form.closest('.cs-card, .pf-showcase, .pph, form') || form;
        var img = scope.querySelector('img[src]:not([src=""])');
        var hasAnimation = img && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (hasAnimation) {
          document.dispatchEvent(new CustomEvent('cart:atc:success', {
            bubbles: true,
            detail: { button: btn, image: img },
          }));
        }

        if (form.closest('[data-pf-qv-root]')) {
          window.setTimeout(function () {
            QuickView.close();
          }, 500);
        }
        window.setTimeout(function () {
          setButtonState(btn, null);
        }, 1800);
      })
      .catch(function (err) {
        btn.disabled = false;
        setButtonState(btn, 'is-error');
        window.setTimeout(function () {
          setButtonState(btn, null);
        }, 2000);
        console.error('[Premium Products] Add to cart failed', err);
      });
  }

  function bindCartForms(scope) {
    scope.querySelectorAll('form[data-type="add-to-cart-form"]').forEach(function (form) {
      if (form.dataset.pfCartBound) return;
      form.dataset.pfCartBound = 'true';

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var btn = form.querySelector('[data-pf-add], button[name="add"]');
        addToCart(form, btn);
      });
    });
  }

  function initReveal(section) {
    if (REDUCED || !('IntersectionObserver' in window)) {
      section.querySelectorAll('.category-showcase__cell').forEach(function (el) {
        el.classList.add('pf-in');
      });
      return;
    }
    var cells = section.querySelectorAll('.category-showcase__cell');
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('pf-in');
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -4% 0px', threshold: 0.06 }
    );
    cells.forEach(function (cell, i) {
      cell.style.setProperty('--pf-delay', Math.min(i * 55, 360) + 'ms');
      io.observe(cell);
    });
  }

  function initSection(section) {
    bindQty(section);
    bindWishlist(section);
    bindVariants(section);
    bindCartForms(section);
    if (section.getAttribute('data-reveal') === 'true') initReveal(section);
  }

  document.addEventListener('click', function (e) {
    /* Quick view handled by uc-quick-view.js (capture). Only ATC here. */
    if (e.target.closest('[data-pf-quickview], [data-uc-quickview]')) return;

    /* Document-level delegation for [data-pf-add] — covers dynamically-rendered
       showcase cards that may not have had bindCartForms called on them yet. */
    var addBtn = e.target.closest('[data-pf-add]');
    if (!addBtn) return;
    var form = addBtn.closest('form');
    if (!form) return;
    if (form.dataset.pfCartBound) return; /* skip — direct submit binding already handles it */
    e.preventDefault();
    e.stopPropagation();
    addToCart(form, addBtn);
  });

  // Warm the cache on intent (hover / touch) so the modal opens instantly.
  var qvLastPrefetch = '';
  document.addEventListener(
    'mouseover',
    function (e) {
      var qv = e.target.closest && e.target.closest('[data-pf-quickview]');
      if (!qv) return;
      var url = qv.getAttribute('data-product-url');
      if (url && url !== qvLastPrefetch) {
        qvLastPrefetch = url;
        QuickView.prefetch(url);
      }
    },
    { passive: true }
  );
  document.addEventListener(
    'touchstart',
    function (e) {
      var qv = e.target.closest && e.target.closest('[data-pf-quickview]');
      if (qv) QuickView.prefetch(qv.getAttribute('data-product-url'));
    },
    { passive: true }
  );

  function boot(scope) {
    (scope || document).querySelectorAll('.pf-showcase').forEach(initSection);
  }

  if (document.readyState !== 'loading') boot();
  else
    document.addEventListener('DOMContentLoaded', function () {
      boot();
    });

  document.addEventListener('shopify:section:load', function (e) {
    boot(e.target);
  });
})();

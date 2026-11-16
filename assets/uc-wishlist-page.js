/**
 * UC Wishlist page — reads localStorage and renders product cards.
 * Used by sections/uc-wishlist.liquid and snippets/uc-soft-wishlist.liquid
 */
(function () {
  var PLACEHOLDER =
    '<span class="pc-card__img pc-card__img--primary pc-card__img--placeholder" aria-hidden="true"></span>';

  function rootUrl() {
    var r = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return r.charAt(r.length - 1) === '/' ? r : r + '/';
  }

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function read(KEY) {
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) || [] : [];
      return list.map(function (i) {
        return typeof i === 'string' ? { id: i } : i;
      });
    } catch (e) {
      return [];
    }
  }

  function write(KEY, list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      document.dispatchEvent(new CustomEvent('wishlist:change', { detail: { count: list.length } }));
    } catch (e) {}
  }

  function cardHTML(item) {
    var url = esc(item.url || (item.handle ? rootUrl() + 'products/' + item.handle : '#'));
    var img = item.image
      ? '<img class="pc-card__img pc-card__img--primary" src="' +
        esc(item.image) +
        '" alt="' +
        esc(item.title) +
        '" loading="lazy" width="600" height="600">'
      : PLACEHOLDER;
    var vendor = item.vendor ? '<p class="pc-card__vendor">' + esc(item.vendor) + '</p>' : '';
    var price = item.price
      ? '<div class="pc-card__meta"><div class="pc-card__price-row"><span class="pc-card__price">' +
        esc(item.price) +
        '</span></div><span class="pc-card__stock ' +
        (item.available === false ? 'pc-card__stock--out' : 'pc-card__stock--in') +
        '"><span class="pc-card__stock-dot"></span>' +
        (item.available === false ? 'Sold out' : 'In stock') +
        '</span></div>'
      : '';
    var variantId = item.variantId || '';
    var cartIcon =
      '<span class="pc-card__btn-icon pc-card__btn-icon--cart" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></span>';
    var okIcon =
      '<span class="pc-card__btn-icon pc-card__btn-icon--ok" hidden aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>';
    var spinner =
      '<span class="pc-card__btn-spinner" hidden aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/></svg></span>';
    var actions = '';
    if (variantId && item.available !== false) {
      actions =
        '<div class="pc-card__actions">' +
        '<button type="button" class="pc-card__btn pc-card__btn--add" data-pc-quick-add data-variant-id="' +
        esc(variantId) +
        '" data-quantity="1" aria-label="Add to cart">' +
        cartIcon +
        okIcon +
        spinner +
        '</button>' +
        '<button type="button" class="pc-card__btn pc-card__btn--buy" data-pc-buy-now data-variant-id="' +
        esc(variantId) +
        '" data-quantity="1" aria-label="Buy now"><span class="pc-card__btn-text">Buy Now</span></button>' +
        '</div>';
    } else {
      actions =
        '<div class="pc-card__actions pc-card__actions--soldout">' +
        '<a class="pc-card__btn pc-card__btn--buy" href="' +
        url +
        '"><span class="pc-card__btn-text">View product</span></a>' +
        '</div>';
    }
    return (
      '<article class="pc-card uc-card-stable" data-pc-card data-ucw-item data-id="' +
      esc(item.id) +
      '" data-variant-id="' +
      esc(variantId) +
      '">' +
      '<div class="pc-card__media-wrap pc-card__media--square">' +
      '<a class="pc-card__media uc-card-stable__media" href="' +
      url +
      '" aria-label="' +
      esc(item.title) +
      '" tabindex="-1">' +
      img +
      '</a>' +
      '<button type="button" class="ucw__remove" data-ucw-remove data-id="' +
      esc(item.id) +
      '" aria-label="Remove from wishlist">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
      '</div>' +
      '<div class="pc-card__info">' +
      vendor +
      '<a class="pc-card__title-link" href="' +
      url +
      '"><h3 class="pc-card__title">' +
      esc(item.title || 'Product') +
      '</h3></a>' +
      price +
      actions +
      '</div>' +
      '</article>'
    );
  }

  function enrich(item) {
    if (!item.handle || item.variantId) return Promise.resolve(item);
    return fetch(rootUrl() + 'products/' + item.handle + '.js')
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (p) {
        if (!p) return item;
        var v = (p.variants && p.variants[0]) || {};
        item.variantId = String(v.id || '');
        item.available = !!p.available;
        item.title = item.title || p.title;
        item.url = item.url || rootUrl() + 'products/' + p.handle;
        item.image = item.image || p.featured_image || '';
        if (!item.price && typeof v.price === 'number') {
          item.price =
            window.Shopify && Shopify.formatMoney
              ? Shopify.formatMoney(v.price)
              : (v.price / 100).toFixed(2);
        }
        return item;
      })
      .catch(function () {
        return item;
      });
  }

  function initRoot(root) {
    var KEY = root.getAttribute('data-wishlist-key') || 'uc:wishlist';
    var grid = root.querySelector('[data-ucw-grid]');
    var empty = root.querySelector('[data-ucw-empty]');
    var loading = root.querySelector('[data-ucw-loading]');
    var countLabel = root.querySelector('[data-ucw-count-label]');
    var rendering = false;

    function render() {
      if (rendering) return;
      rendering = true;
      var list = read(KEY);
      if (loading) loading.setAttribute('hidden', '');
      if (!list.length) {
        if (grid) {
          grid.setAttribute('hidden', '');
          grid.innerHTML = '';
        }
        if (empty) empty.removeAttribute('hidden');
        if (countLabel) countLabel.textContent = 'You have not saved anything yet.';
        rendering = false;
        return;
      }
      if (empty) empty.setAttribute('hidden', '');
      Promise.all(list.map(enrich)).then(function (items) {
        if (grid) {
          grid.innerHTML = items.map(cardHTML).join('');
          grid.removeAttribute('hidden');
        }
        if (countLabel) {
          countLabel.textContent =
            items.length + (items.length === 1 ? ' item saved' : ' items saved');
        }
        var stored = read(KEY);
        var merged = stored.map(function (s) {
          var match = items.find(function (it) {
            return String(it.id) === String(s.id);
          });
          return match ? Object.assign({}, s, match) : s;
        });
        try {
          localStorage.setItem(KEY, JSON.stringify(merged));
        } catch (e) {}
        document.dispatchEvent(
          new CustomEvent('uc:wishlist:change', { detail: { count: items.length, list: merged } })
        );
        rendering = false;
      });
    }

    if (grid) {
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-ucw-remove]');
        if (!btn) return;
        e.preventDefault();
        var id = String(btn.getAttribute('data-id'));
        var list = read(KEY).filter(function (i) {
          return String(i.id) !== id;
        });
        write(KEY, list);
        var card = btn.closest('[data-ucw-item]');
        if (card) {
          card.style.transition = 'opacity .25s ease, transform .25s ease';
          card.style.opacity = '0';
          card.style.transform = 'scale(.96)';
        }
        setTimeout(render, 220);
      });
    }

    document.addEventListener('wishlist:change', function () {
      render();
    });
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) render();
    });

    render();
  }

  function boot() {
    document.querySelectorAll('[data-uc-wishlist]').forEach(initRoot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

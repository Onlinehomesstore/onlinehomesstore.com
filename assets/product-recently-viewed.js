/**
 * product-recently-viewed.js — track + render recent product handles
 */
(function () {
  'use strict';
  if (window.__UC_PRV__) return;
  window.__UC_PRV__ = true;

  function rootUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.charAt(root.length - 1) === '/' ? root : root + '/';
  }

  function readList(key) {
    try {
      var raw = localStorage.getItem(key);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function writeList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list.slice(0, 16)));
    } catch (_) {}
  }

  function track(section) {
    var key = section.getAttribute('data-prv-key') || 'uc:recently-viewed';
    var handle = section.getAttribute('data-prv-current');
    if (!handle) return;
    var list = readList(key).filter(function (h) {
      return h && h !== handle;
    });
    list.unshift(handle);
    writeList(key, list);
  }

  function cardHtml(p) {
    var img = (p.featured_image && (p.featured_image.src || p.featured_image)) || '';
    var title = p.title || '';
    var url = p.url || (rootUrl() + 'products/' + p.handle);
    var price = p.price != null ? (window.Shopify && Shopify.formatMoney ? Shopify.formatMoney(p.price) : (p.price / 100).toFixed(2)) : '';
    return (
      '<article class="pc-card">' +
      '<a class="pc-card__media-link" href="' + url + '">' +
      (img ? '<img class="pc-card__img" src="' + img.replace(/(\.(jpg|jpeg|png|webp)).*$/i, '_400x.$2') + '" alt="" loading="lazy" width="400" height="400">' : '') +
      '</a>' +
      '<div class="pc-card__info">' +
      '<a class="pc-card__title-link" href="' + url + '"><h3 class="pc-card__title">' + title.replace(/</g, '&lt;') + '</h3></a>' +
      (price ? '<div class="pc-card__price-row"><span class="pc-card__price">' + price + '</span></div>' : '') +
      '</div></article>'
    );
  }

  function render(section) {
    var key = section.getAttribute('data-prv-key') || 'uc:recently-viewed';
    var current = section.getAttribute('data-prv-current');
    var max = parseInt(section.getAttribute('data-prv-max') || '4', 10) || 4;
    var grid = section.querySelector('[data-prv-grid]');
    if (!grid) return;

    var handles = readList(key)
      .filter(function (h) {
        return h && h !== current;
      })
      .slice(0, max);

    if (!handles.length) {
      section.hidden = true;
      return;
    }

    Promise.all(
      handles.map(function (h) {
        return fetch(rootUrl() + 'products/' + encodeURIComponent(h) + '.js', {
          credentials: 'same-origin',
        })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .catch(function () {
            return null;
          });
      })
    ).then(function (products) {
      var html = products
        .filter(Boolean)
        .map(cardHtml)
        .join('');
      if (!html) {
        section.hidden = true;
        return;
      }
      grid.innerHTML = html;
      section.hidden = false;
    });
  }

  function init() {
    document.querySelectorAll('[data-prv-section]').forEach(function (section) {
      track(section);
      render(section);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('shopify:section:load', init);
})();

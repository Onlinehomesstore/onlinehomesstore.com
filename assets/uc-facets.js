/**
 * UNIK CARE — custom sort dropdown + facet accordion polish
 * Filtering is server-side only (facets.js). Do not re-filter the product grid in JS.
 */
(function () {
  if (window.__UC_FACETS_UI__) return;
  window.__UC_FACETS_UI__ = true;

  function resetGridAfterUpdate(container) {
    if (!container) return;
    container.querySelectorAll('#product-grid .grid__item[hidden]').forEach(function (item) {
      item.hidden = false;
    });
    var grid = container.querySelector('#product-grid');
    if (grid) grid.hidden = false;
    container.querySelectorAll('[data-uc-filter-empty].collection.collection--empty').forEach(function (node) {
      node.remove();
    });
  }

  document.addEventListener('uc:facets:grid-updated', function (event) {
    resetGridAfterUpdate(event.detail && event.detail.container);
  });

  document.addEventListener('DOMContentLoaded', function () {
    resetGridAfterUpdate(document.getElementById('ProductGridContainer'));
  });

  document.addEventListener('click', function (e) {
    var clearBtn = e.target.closest('[data-uc-clear-filters]');
    if (clearBtn) {
      e.preventDefault();
      var removeAll = document.querySelector('.active-facets__button-remove');
      if (removeAll) {
        removeAll.click();
        return;
      }
      var path = window.location.pathname;
      if (window.FacetFiltersForm && typeof FacetFiltersForm.renderPage === 'function') {
        FacetFiltersForm.renderPage('');
      } else {
        window.location.assign(path);
      }
      return;
    }
    var trigger = e.target.closest('[data-uc-sort-trigger]');
    var option = e.target.closest('[data-uc-sort-option]');
    var wrap = e.target.closest('[data-uc-sort]');

    document.querySelectorAll('[data-uc-sort]').forEach(function (w) {
      if (wrap && w === wrap && (trigger || option)) return;
      var list = w.querySelector('[data-uc-sort-list]');
      var btn = w.querySelector('[data-uc-sort-trigger]');
      if (list) list.hidden = true;
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });

    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      var root = trigger.closest('[data-uc-sort]');
      var list = root && root.querySelector('[data-uc-sort-list]');
      if (!list) return;
      var open = list.hidden;
      list.hidden = !open;
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }

    if (option) {
      e.preventDefault();
      e.stopPropagation();
      var root2 = option.closest('[data-uc-sort]');
      var form = option.closest('form');
      var select = form && form.querySelector('#SortBy');
      var current = root2 && root2.querySelector('[data-uc-sort-current]');
      var list2 = root2 && root2.querySelector('[data-uc-sort-list]');
      var btn2 = root2 && root2.querySelector('[data-uc-sort-trigger]');

      if (select) {
        select.value = option.getAttribute('data-value') || '';
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (current) current.textContent = option.textContent.trim();
      if (root2) {
        root2.querySelectorAll('[data-uc-sort-option]').forEach(function (o) {
          o.classList.toggle('is-active', o === option);
          o.setAttribute('aria-selected', o === option ? 'true' : 'false');
        });
      }
      if (list2) list2.hidden = true;
      if (btn2) btn2.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', function (e) {
    var list = document.querySelector('[data-uc-sort-list]:not([hidden])');
    if (!list) return;
    var options = Array.prototype.slice.call(list.querySelectorAll('[data-uc-sort-option]'));
    if (!options.length) return;
    var active = list.querySelector('[data-uc-sort-option]:focus') || list.querySelector('.is-active');
    var idx = active ? options.indexOf(active) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      options[Math.min(idx + 1, options.length - 1)].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      options[Math.max(idx - 1, 0)].focus();
    } else if (e.key === 'Escape') {
      var root = list.closest('[data-uc-sort]');
      list.hidden = true;
      var btn = root && root.querySelector('[data-uc-sort-trigger]');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    }
  });
})();

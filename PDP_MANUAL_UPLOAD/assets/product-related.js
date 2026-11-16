/*
  ============================================================================
  PRODUCT RELATED — JavaScript (~70 lines)
  ----------------------------------------------------------------------------
  Fetches product recommendations via Shopify's section rendering API and
  replaces the skeleton/placeholder with real server-rendered cards.
  URL: /recommendations/products?section_id=...&product_id=...&limit=...
  ============================================================================
*/
(function () {
  'use strict';

  function initRelated(section) {
    var sectionId = section.dataset.prelSection;
    var productId = section.dataset.prelProductId;
    var limit     = section.dataset.prelLimit || '4';
    var intent    = section.dataset.prelIntent || 'related';

    if (!sectionId || !productId) return;

    /* If recommendations already performed (rendered as static template),
       nothing to do — cards are already in DOM */
    if (!section.querySelector('[data-prel-skeleton]')) return;

    var url = '/recommendations/products?section_id=' + sectionId +
              '&product_id=' + productId +
              '&limit=' + limit +
              '&intent=' + intent;

    fetch(url, { headers: { 'Accept': 'text/html' } })
      .then(function (res) {
        if (!res.ok) throw new Error('Recommendations fetch failed: ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc    = parser.parseFromString(html, 'text/html');
        var inner  = doc.querySelector('[data-prel-inner]');
        if (!inner) return;

        var existing = section.querySelector('[data-prel-inner]');
        if (existing) existing.innerHTML = inner.innerHTML;

        /* Re-init quick-add for newly injected cards */
        /* uc-product-card.js uses event delegation — no re-init needed */
      })
      .catch(function (err) {
        /* Silently remove skeleton if fetch fails — manual blocks remain if any */
        var skeleton = section.querySelector('[data-prel-skeleton]');
        if (skeleton) skeleton.remove();
        console.warn('[product-related]', err);
      });
  }

  function boot() {
    document.querySelectorAll('[data-prel-section]').forEach(initRelated);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-prel-section]');
    if (s) initRelated(s);
  });
})();

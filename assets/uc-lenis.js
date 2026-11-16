/**
 * uc-lenis.js — native scroll only (custom wheel hijack removed).
 * Keeps a tiny unlock helper so drawers/modals never leave the page stuck.
 */
(function () {
  'use strict';

  if (window.__UC_LENIS__) return;
  window.__UC_LENIS__ = true;

  document.documentElement.classList.add('uc-scroll-native');
  document.documentElement.classList.remove('uc-lenis-on');

  function unlockIfSafe() {
    var html = document.documentElement;
    var body = document.body;
    if (!html || !body) return;

    var locked =
      html.classList.contains('uc-scroll-locked') ||
      html.classList.contains('uc-scroll-restoring') ||
      html.hasAttribute('data-uc-lock-y') ||
      html.classList.contains('uc-phdr-search-open') ||
      html.classList.contains('uc-cart-open') ||
      html.classList.contains('uc-phdr-lock') ||
      html.classList.contains('uc-qv-open') ||
      html.classList.contains('ch-scroll-locked') ||
      body.classList.contains('uc-scroll-locked') ||
      body.classList.contains('overflow-hidden') ||
      body.classList.contains('pph-lightbox-open') ||
      body.classList.contains('uc-cart-scroll-locked');

    if (locked) return;

    html.style.removeProperty('overflow');
    body.style.removeProperty('overflow');
    body.style.removeProperty('position');
    body.style.removeProperty('top');
    body.style.removeProperty('width');
    body.style.removeProperty('padding-right');
  }

  var mo = new MutationObserver(unlockIfSafe);
  if (document.documentElement) {
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  if (document.body) {
    mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
      unlockIfSafe();
    });
  }

  window.addEventListener('visibilitychange', unlockIfSafe);
  window.addEventListener('pageshow', unlockIfSafe);
  document.addEventListener('shopify:section:load', unlockIfSafe);

  window.UCLenis = {
    scrollTo: function (y, opts) {
      var top = typeof y === 'number' ? y : 0;
      try {
        window.scrollTo({ top: top, left: 0, behavior: opts && opts.immediate ? 'auto' : 'smooth' });
      } catch (_) {
        window.scrollTo(0, top);
      }
    },
    stop: function () {},
  };

  unlockIfSafe();
})();

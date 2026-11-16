/* Subtle 3D tilt — homepage showcase only, no product-card jank */
(function () {
  'use strict';
  if (window.__UC_3D_CARDS__) return;
  window.__UC_3D_CARDS__ = true;

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (REDUCE || !FINE) return;

  var CARD_SELECTOR = '.cs-card, .category-showcase__card, .pf-card, .ubp__card, .ucs__media';
  var IMAGE_SELECTOR = '.ucs__media[data-uc-3d-image]';
  var IGNORE =
    'button, a, input, select, textarea, label, [data-pc-quick-add], [data-pc-buy-now], .pph-gallery__arrow, .pph-gallery__thumb, .pph-gallery__thumbs';
  var MAX_TILT = 1.4;
  var CS_MAX_TILT = 3;

  function bindTilt(el, kind) {
    if (!el || el.dataset.uc3d === '1' || el.dataset.uc3dImage === '1') return;
    if (kind === 'card') el.dataset.uc3d = '1';
    else el.dataset.uc3dImage = '1';
    el.classList.add(kind === 'card' ? 'uc-3d-card' : 'uc-3d-image');

    function onEnter(e) {
      if (e.target && e.target.closest && e.target.closest(IGNORE)) return;
      el.classList.add('is-tilting');
    }

    var moveRaf = 0;
    function onMove(e) {
      if (!el.classList.contains('is-tilting')) return;
      if (e.target && e.target.closest && e.target.closest(IGNORE)) return;
      var cx = e.clientX;
      var cy = e.clientY;
      if (moveRaf) return;
      moveRaf = window.requestAnimationFrame(function () {
        moveRaf = 0;
        var rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var px = (cx - rect.left) / rect.width - 0.5;
        var py = (cy - rect.top) / rect.height - 0.5;
        var isCs = el.classList.contains('cs-card');
        var tilt = isCs ? CS_MAX_TILT : MAX_TILT;
        el.style.transform =
          'rotateX(' + (-py * tilt).toFixed(2) + 'deg) rotateY(' + (px * tilt).toFixed(2) + 'deg)';
      });
    }

    function onLeave() {
      el.classList.remove('is-tilting');
      el.style.transform = '';
    }

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
  }

  function scan(root) {
    var scope = root || document;
    scope.querySelectorAll(CARD_SELECTOR).forEach(function (el) {
      bindTilt(el, 'card');
    });
    scope.querySelectorAll(IMAGE_SELECTOR).forEach(function (el) {
      bindTilt(el, 'image');
    });
  }

  function boot() {
    scan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  document.addEventListener('shopify:section:load', function (e) {
    scan(e.target);
  });
})();

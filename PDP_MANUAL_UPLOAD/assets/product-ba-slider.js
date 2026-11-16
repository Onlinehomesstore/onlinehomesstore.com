/*
  ============================================================================
  PRODUCT BA SLIDER — JavaScript (~50 lines)
  ----------------------------------------------------------------------------
  Handles ONLY the carousel arrow navigation and scroll-progress bar.
  The comparison drag/touch/keyboard logic is 100% from before-after-comparison.js.
  No code is duplicated from that file.
  ============================================================================
*/
(function () {
  'use strict';

  function initSlider(section) {
    var track    = section.querySelector('[data-pba-track]');
    var prev     = section.querySelector('[data-pba-prev]');
    var next     = section.querySelector('[data-pba-next]');
    var fill     = section.querySelector('[data-pba-progressfill]');
    if (!track) return;

    function slideWidth() {
      var slide = track.querySelector('[data-pba-slide]');
      if (!slide) return 0;
      var gap = parseInt(getComputedStyle(track).gap) || 0;
      return slide.offsetWidth + gap;
    }

    function scrollBy(dir) {
      track.scrollBy({ left: dir * slideWidth(), behavior: 'smooth' });
    }

    function syncUI() {
      var max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;
      var ratio = track.scrollLeft / max;
      if (fill) fill.style.width = (ratio * 100) + '%';
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    }

    if (prev) prev.addEventListener('click', function () { scrollBy(-1); });
    if (next) next.addEventListener('click', function () { scrollBy(1); });

    track.addEventListener('scroll', syncUI, { passive: true });

    /* Keyboard navigation on the track */
    track.setAttribute('tabindex', '0');
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { scrollBy(-1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { scrollBy(1);  e.preventDefault(); }
    });

    syncUI();
  }

  function boot() {
    document.querySelectorAll('[data-pba-section]').forEach(initSlider);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-pba-section]');
    if (s) initSlider(s);
  });
})();

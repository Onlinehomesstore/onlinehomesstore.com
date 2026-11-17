/**
 * OHS horizontal card rails (shop by category / room).
 */
(function () {
  'use strict';

  function stepsPerView(root) {
    var w = window.innerWidth;
    if (w >= 990) return 1;
    if (w >= 750) return 1;
    if (w >= 480) return 1;
    return 1;
  }

  function initRail(root) {
    var viewport = root.querySelector('[data-ohs-rail-viewport]');
    var track = root.querySelector('[data-ohs-rail-track]');
    if (!viewport || !track) return;

    var cards = track.querySelectorAll('.ohs-cat-card, .ohs-tile');
    if (cards.length < 2) return;

    var index = 0;
    var prevBtn = root.querySelector('[data-ohs-rail-prev]');
    var nextBtn = root.querySelector('[data-ohs-rail-next]');

    function cardStep() {
      var first = cards[0];
      if (!first) return 0;
      var gap = parseFloat(getComputedStyle(track).gap) || 16;
      return first.getBoundingClientRect().width + gap;
    }

    function maxIndex() {
      var visible = Math.max(1, Math.floor(viewport.clientWidth / Math.max(cardStep(), 1)));
      return Math.max(0, cards.length - visible);
    }

    function go(i) {
      var max = maxIndex();
      index = Math.min(Math.max(0, i), max);
      track.style.transform = 'translate3d(' + -index * cardStep() + 'px,0,0)';
      if (prevBtn) prevBtn.disabled = index <= 0;
      if (nextBtn) nextBtn.disabled = index >= max;
    }

    function next() {
      go(index + stepsPerView(root));
    }

    function prev() {
      go(index - stepsPerView(root));
    }

    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    var startX = 0;
    viewport.addEventListener(
      'touchstart',
      function (e) {
        startX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    viewport.addEventListener(
      'touchend',
      function (e) {
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 44) {
          dx < 0 ? next() : prev();
        }
      },
      { passive: true }
    );

    window.addEventListener('resize', function () {
      go(index);
    });
    go(0);
  }

  function boot() {
    document.querySelectorAll('[data-ohs-card-rail]').forEach(initRail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
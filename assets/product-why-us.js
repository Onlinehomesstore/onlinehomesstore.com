/*
  ============================================================================
  WHY CHOOSE US — JavaScript (~75 lines)
  ----------------------------------------------------------------------------
  Handles:
    1. Count-up animation for [data-count] stat numbers
    2. IntersectionObserver to trigger counting only when visible
    3. Theme Editor reload support
  ============================================================================
*/
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Ease-out cubic — smooth deceleration */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function countUp(el) {
    var raw    = el.getAttribute('data-count') || el.textContent.replace(/[^0-9.]/g, '');
    var target = parseFloat(raw) || 0;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var isInt  = target === Math.floor(target);
    var dur    = 1800;
    var start  = performance.now();

    function tick(now) {
      var elapsed  = now - start;
      var progress = Math.min(elapsed / dur, 1);
      var eased    = easeOut(progress);
      var value    = target * eased;
      el.textContent = prefix + (isInt ? Math.round(value).toLocaleString() : value.toFixed(1)) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function initCounters(section) {
    var stats = section.querySelector('[data-pwu-stats]');
    if (!stats) return;

    if (REDUCED) {
      /* Just set the final value for reduced-motion users */
      stats.querySelectorAll('[data-count]').forEach(function (el) {
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var raw    = el.getAttribute('data-count') || '0';
        var target = parseFloat(raw) || 0;
        var isInt  = target === Math.floor(target);
        el.textContent = prefix + (isInt ? Math.round(target).toLocaleString() : target.toFixed(1)) + suffix;
      });
      return;
    }

    if (!window.IntersectionObserver) {
      stats.querySelectorAll('[data-count]').forEach(countUp);
      return;
    }

    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        entry.target.querySelectorAll('[data-count]').forEach(countUp);
      });
    }, { threshold: 0.4 });

    io.observe(stats);
  }

  function boot() {
    document.querySelectorAll('[data-pwu-section]').forEach(initCounters);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-pwu-section]');
    if (s) initCounters(s);
  });
})();

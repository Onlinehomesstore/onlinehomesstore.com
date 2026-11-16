(function () {
  'use strict';

  function initTimeline(section) {
    if (!section || section.classList.contains('is-active')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      section.classList.add('is-active');
      return;
    }
    if (!('IntersectionObserver' in window)) {
      section.classList.add('is-active');
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-active');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    io.observe(section);
  }

  function boot() {
    document.querySelectorAll('[data-ubt-section]').forEach(initTimeline);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-ubt-section]');
    if (s) initTimeline(s);
  });
})();

/* ==========================================================================
   VISIBLE RESULTS / BRAND BENEFITS
   Reveal-on-scroll + count-up. Vanilla, no dependencies, no layout shift.
   Loaded only when scroll animations are enabled.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Parse "95%", "1.5x", "+120", "$40" → { prefix, value, decimals, suffix } */
  function parseNumber(text) {
    var m = String(text).match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return null;
    var raw = m[2].replace(',', '.');
    var decimals = raw.indexOf('.') !== -1 ? raw.split('.')[1].length : 0;
    return { prefix: m[1], value: parseFloat(raw), decimals: decimals, suffix: m[3] };
  }

  function format(parsed, current) {
    return parsed.prefix + current.toFixed(parsed.decimals) + parsed.suffix;
  }

  function countUp(el, duration) {
    var parsed = parseNumber(el.textContent);
    if (!parsed) return;
    if (REDUCED) { el.textContent = format(parsed, parsed.value); return; }

    var start = null;
    var from = 0;
    var to = parsed.value;

    function ease(t) { return 1 - Math.pow(1 - t, 3); } // easeOutCubic

    function frame(now) {
      if (start === null) start = now;
      var progress = Math.min((now - start) / duration, 1);
      var value = from + (to - from) * ease(progress);
      el.textContent = format(parsed, value);
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = format(parsed, to);
    }
    requestAnimationFrame(frame);
  }

  function reveal(section) {
    if (section._vrDone) return;
    section._vrDone = true;
    section.classList.add('is-in');

    var speed = parseInt(section.style.getPropertyValue('--vr-anim'), 10) || 600;
    section.querySelectorAll('.vr-stat__num[data-vr-count]').forEach(function (el) {
      countUp(el, Math.max(600, speed + 400));
    });
  }

  function init(section) {
    if (!section || section._vrInit) return;
    section._vrInit = true;

    var animate = section.getAttribute('data-animate') === 'true';

    // No animation, reduced motion, or no observer support → content stays
    // visible (default) and any count-up resolves to its final value.
    if (!animate || REDUCED || !('IntersectionObserver' in window)) {
      reveal(section);
      return;
    }

    // Arm the reveal (hide) only now that we know JS is running and will reveal.
    section.classList.add('is-armed');

    var done = false;
    function go() {
      if (done) return;
      done = true;
      reveal(section);
    }

    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            go();
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(section);

    // Safety net: if the observer never fires, reveal anyway.
    setTimeout(go, 1500);
  }

  function boot(scope) {
    (scope || document).querySelectorAll('visible-results').forEach(init);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', function () { boot(); });

  document.addEventListener('shopify:section:load', function (e) {
    boot(e.target);
  });
})();

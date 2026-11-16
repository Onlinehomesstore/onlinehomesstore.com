/**
 * Dual review rows: keep a full set of cards on screen, then step one card.
 * No CSS % translate (that left the reverse row empty). No hover pause.
 */
(function () {
  'use strict';

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function uniqueCount(track) {
    var marked = track.getAttribute('data-uc-rev-unique');
    if (marked) return parseInt(marked, 10) || 0;
    var n = track.querySelectorAll('.pt__card, .upr__card').length;
    if (n < 2) return n;
    return Math.max(1, Math.floor(n / 2));
  }

  function sizeWrap(wrap) {
    if (!wrap) return;
    var cs = getComputedStyle(wrap);
    var show = parseFloat(cs.getPropertyValue('--uc-rev-show')) || 3;
    var gap = parseFloat(cs.getPropertyValue('--uc-rev-gap')) || 16;
    var width = wrap.clientWidth;
    if (width < 40) return;
    var card = Math.floor((width - (show - 1) * gap) / show);
    if (card < 160) card = 160;
    wrap.style.setProperty('--uc-rev-card', card + 'px');
    wrap.style.setProperty('--uc-rev-step', card + gap + 'px');
    return card + gap;
  }

  function paint(track, offset, step, instant) {
    if (!track) return;
    if (instant) {
      track.style.transition = 'none';
    } else {
      track.style.transition = 'transform 640ms cubic-bezier(0.4, 0, 0.2, 1)';
    }
    track.style.transform = 'translate3d(' + (-offset * step) + 'px,0,0)';
    if (instant) {
      void track.offsetWidth;
      track.style.transition = 'transform 640ms cubic-bezier(0.4, 0, 0.2, 1)';
    }
  }

  function startRow(wrap, row, dir) {
    var track = row.querySelector('.pt-marquee__track, .upr-marquee__track');
    if (!track || track.__ucRevTick) return;
    var unique = uniqueCount(track);
    if (unique < 1) return;
    track.__ucRevTick = true;
    track.setAttribute('data-uc-rev-unique', String(unique));

    var offset = dir < 0 ? 0 : unique;
    var step = sizeWrap(wrap);
    paint(track, offset, step, true);

    if (REDUCE) return;

    var gap = dir < 0 ? 3400 : 4000;
    var snapping = false;

    function tick() {
      if (document.hidden || snapping) return;
      step = sizeWrap(wrap) || step;
      offset += dir < 0 ? 1 : -1;
      paint(track, offset, step, false);

      if (dir < 0 && offset >= unique) {
        snapping = true;
        window.setTimeout(function () {
          offset = 0;
          paint(track, offset, step, true);
          snapping = false;
        }, 660);
      } else if (dir > 0 && offset <= 0) {
        snapping = true;
        window.setTimeout(function () {
          offset = unique;
          paint(track, offset, step, true);
          snapping = false;
        }, 660);
      }
    }

    track.__ucRevTimer = window.setInterval(tick, gap);
  }

  function bind(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.pt-marquee, .upr-marquee').forEach(function (wrap) {
      sizeWrap(wrap);
      if (!wrap.__ucRevBound) {
        wrap.__ucRevBound = true;
        if ('ResizeObserver' in window) {
          var resizeTimer = 0;
          new ResizeObserver(function () {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(function () { sizeWrap(wrap); }, 100);
          }).observe(wrap);
        }
      }
      wrap.querySelectorAll('.pt-marquee__row--left, .upr-marquee__row--left').forEach(function (row) {
        startRow(wrap, row, -1);
      });
      wrap.querySelectorAll('.pt-marquee__row--right, .upr-marquee__row--right').forEach(function (row) {
        startRow(wrap, row, 1);
      });
    });
  }

  window.ucBindReviewMarquee = bind;

  function boot() { bind(document); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (event) {
    bind(event.target);
  });
})();

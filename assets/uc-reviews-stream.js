/**
 * Dual-lane infinite review stream — smooth CSS drift, duplicated halves.
 */
(function () {
  'use strict';

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function laneHtml(cardsHtml, alt) {
    var half = '<div class="uc-rev-stream__half">' + cardsHtml + '</div>';
    return (
      '<div class="uc-rev-stream__lane' + (alt ? ' uc-rev-stream__lane--alt' : '') + '">' +
        '<div class="uc-rev-stream__track">' +
          half +
          half +
        '</div>' +
      '</div>'
    );
  }

  function buildStreamFromCards(cards) {
    if (!cards || !cards.length) return '';
    var rowA = cards.join('');
    var rowB = cards.slice().reverse().join('');
    if (!rowB) rowB = rowA;
    return (
      '<div class="uc-rev-stream" data-uc-reviews-stream>' +
        '<div class="uc-rev-stream__mask">' +
          laneHtml(rowA, false) +
          laneHtml(rowB, true) +
        '</div>' +
      '</div>'
    );
  }

  function tuneDuration(wrap) {
    if (!wrap || REDUCE || wrap.dataset.ucRevTuned === '1') return;
    var run = function () {
      if (wrap.dataset.ucRevTuned === '1') return;
      var track = wrap.querySelector('.uc-rev-stream__lane:not(.uc-rev-stream__lane--alt) .uc-rev-stream__track');
      if (!track) return;
      var w = track.scrollWidth / 2;
      if (w < 200) return;
      wrap.dataset.ucRevTuned = '1';
      var sec = Math.max(48, Math.min(120, Math.round(w / 42)));
      wrap.style.setProperty('--uc-rev-drift', sec + 's');
      wrap.style.setProperty('--uc-rev-drift-alt', Math.round(sec * 1.12) + 's');
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1800 });
    } else {
      window.setTimeout(run, 400);
    }
  }

  function prepareCards(root) {
    root.querySelectorAll('.pt__card, .upr__card').forEach(function (card) {
      card.removeAttribute('data-uc-reveal');
      card.classList.add('is-visible', 'is-revealed', 'uc-rev-card');
      card.style.opacity = '1';
      card.style.transform = 'none';
    });
  }

  function mountStream(section, html) {
    if (!html) return null;
    var carousel = section.querySelector('[data-pt-carousel]');
    var existing = section.querySelector('[data-uc-reviews-stream], [data-pt-marquee], .upr-marquee');
    var el = document.createElement('div');
    el.innerHTML = html;
    var stream = el.firstElementChild;
    if (!stream) return null;
    prepareCards(stream);
    if (existing) existing.replaceWith(stream);
    else if (carousel) carousel.replaceWith(stream);
    else section.appendChild(stream);
    tuneDuration(stream);
    bindVisibilityPause(stream);
    return stream;
  }

  function cardsFromSelector(section, sel) {
    var track = section.querySelector(sel);
    if (!track) return [];
    return Array.prototype.map.call(track.querySelectorAll('.pt__card, .upr__card'), function (el) {
      return el.outerHTML;
    });
  }

  function initExisting(section) {
    var stream = section.querySelector('[data-uc-reviews-stream]');
    if (!stream) return;
    prepareCards(stream);
    tuneDuration(stream);
  }

  window.ucBuildReviewsStream = function (section, htmlCards) {
    var html = buildStreamFromCards(htmlCards);
    return mountStream(section, html);
  };

  function bindVisibilityPause(stream) {
    if (!stream || REDUCE || !('IntersectionObserver' in window)) return;
    if (stream.dataset.ucRevIo === '1') return;
    stream.dataset.ucRevIo = '1';
    var tracks = stream.querySelectorAll('.uc-rev-stream__track');
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var play = entry.isIntersecting ? 'running' : 'paused';
          stream.classList.toggle('is-in-view', entry.isIntersecting);
          tracks.forEach(function (track) {
            track.style.animationPlayState = play;
          });
        });
      },
      { rootMargin: '120px 0px', threshold: 0.01 }
    );
    io.observe(stream);
  }

  function boot(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-uc-reviews-stream]').forEach(function (stream) {
      prepareCards(stream);
      tuneDuration(stream);
      bindVisibilityPause(stream);
    });
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.querySelectorAll('[data-uc-reviews-stream]').forEach(tuneDuration);
    }, 120);
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  document.addEventListener('shopify:section:load', function (e) {
    boot(e.target);
  });

  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        var stream = entry.target.closest('[data-uc-reviews-stream]');
        if (stream) tuneDuration(stream);
      });
    });
    document.querySelectorAll('[data-uc-reviews-stream]').forEach(function (s) {
      var t = s.querySelector('.uc-rev-stream__track');
      if (t) ro.observe(t);
    });
  }
})();

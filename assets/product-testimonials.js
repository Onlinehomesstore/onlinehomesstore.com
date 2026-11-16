/*
  PRODUCT TESTIMONIALS — filters, sort, load-more, carousel, stats
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function parseCount(raw) {
    if (!raw || String(raw).trim() === '') return null;
    var target = parseFloat(raw);
    if (!isFinite(target)) return null;
    return target;
  }

  function countUp(el) {
    var raw = el.getAttribute('data-count') || '';
    var target = parseCount(raw);
    if (target === null) return;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var isInt = target === Math.floor(target);
    var dur = 1800;
    var start = performance.now();

    function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var v = target * easeOut(p);
      el.textContent = prefix + (isInt ? Math.round(v).toLocaleString() : v.toFixed(1)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function initStats(section) {
    var stats = section.querySelector('[data-pt-stats]');
    if (!stats) return;

    if (REDUCED || !window.IntersectionObserver) {
      stats.querySelectorAll('[data-count]').forEach(function (el) {
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var target = parseCount(el.getAttribute('data-count') || '');
        if (target === null) return;
        var isInt = target === Math.floor(target);
        el.textContent = prefix + (isInt ? Math.round(target).toLocaleString() : target.toFixed(1)) + suffix;
      });
      return;
    }

    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        obs.unobserve(e.target);
        e.target.querySelectorAll('[data-count]').forEach(countUp);
      });
    }, { threshold: 0.35 });

    io.observe(stats);
  }

  function initFilters(section) {
    var track = section.querySelector('[data-pt-track]');
    if (!track) return;

    var cards = Array.prototype.slice.call(track.querySelectorAll('.pt__card'));
    var filterBtns = section.querySelectorAll('[data-pt-filter]');
    var sortEl = section.querySelector('[data-pt-sort]');
    var loadBtn = section.querySelector('[data-pt-load-more]');
    var pageSize = parseInt(section.getAttribute('data-pt-page-size'), 10) || 6;
    /* No load-more control → show the full catalog (carousel still scrolls) */
    if (!loadBtn) pageSize = 9999;
    var visibleLimit = pageSize;
    var activeFilter = 'all';

    function cardPassesFilter(card) {
      var rating = parseInt(card.getAttribute('data-pt-rating'), 10) || 5;
      var hasPhoto = card.getAttribute('data-pt-has-photo') === 'true';
      var verified = card.getAttribute('data-pt-verified') === 'true';

      if (activeFilter === 'photos' && !hasPhoto) return false;
      if (activeFilter === 'verified' && !verified) return false;
      if (activeFilter === 'top' && rating < 5) return false;
      return true;
    }

    function applyVisibility() {
      var shown = 0;
      track.classList.add('is-filtering');
      cards.forEach(function (card) {
        if (!cardPassesFilter(card)) {
          card.classList.add('pt__card--hidden');
          card.setAttribute('aria-hidden', 'true');
          return;
        }
        shown += 1;
        if (shown > visibleLimit) {
          card.classList.add('pt__card--hidden');
          card.setAttribute('aria-hidden', 'true');
        } else {
          card.classList.remove('pt__card--hidden');
          card.removeAttribute('aria-hidden');
        }
      });

      if (loadBtn) {
        var totalMatch = cards.filter(cardPassesFilter).length;
        loadBtn.hidden = visibleLimit >= totalMatch;
      }
      window.requestAnimationFrame(function () {
        track.classList.remove('is-filtering');
      });
    }

    function sortCards(mode) {
      if (mode === 'default') return;
      cards.sort(function (a, b) {
        if (mode === 'rating-desc') {
          return (parseInt(b.getAttribute('data-pt-rating'), 10) || 0) -
                 (parseInt(a.getAttribute('data-pt-rating'), 10) || 0);
        }
        if (mode === 'helpful-desc') {
          return (parseInt(b.getAttribute('data-pt-helpful'), 10) || 0) -
                 (parseInt(a.getAttribute('data-pt-helpful'), 10) || 0);
        }
        return 0;
      });
      cards.forEach(function (c) { track.appendChild(c); });
    }

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-pt-filter') || 'all';
        filterBtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        visibleLimit = pageSize;
        applyVisibility();
      });
    });

    if (sortEl) {
      sortEl.addEventListener('change', function () {
        sortCards(sortEl.value);
        applyVisibility();
        sortEl.blur();
      });
    }

    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        visibleLimit += pageSize;
        applyVisibility();
      });
    }

    cards.forEach(function (card, i) {
      if (i >= pageSize) card.classList.add('pt__card--paginated');
    });
    applyVisibility();
  }

  function initCarousel(section) {
    var track = section.querySelector('[data-pt-track]');
    var prevBtn = section.querySelector('[data-pt-prev]');
    var nextBtn = section.querySelector('[data-pt-next]');
    var fill = section.querySelector('[data-pt-progressfill]');

    if (!track) return;

    var autoplayMs = parseInt(section.dataset.ptAutoplay, 10) || 0;
    var autoTimer = null;

    function visibleCards() {
      return Array.prototype.slice.call(track.querySelectorAll('.pt__card:not(.pt__card--hidden)'));
    }

    function slideWidth() {
      var first = visibleCards()[0];
      if (!first) return track.offsetWidth;
      var style = getComputedStyle(track);
      return first.offsetWidth + parseInt(style.gap, 10);
    }

    function scrollBy(dir) {
      track.scrollBy({ left: dir * slideWidth(), behavior: 'smooth' });
    }

    function syncUI() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      var pos = track.scrollLeft;
      var ratio = maxScroll > 0 ? pos / maxScroll : 0;
      if (prevBtn) prevBtn.disabled = pos <= 1;
      if (nextBtn) nextBtn.disabled = pos >= maxScroll - 1;
      if (fill) fill.style.transform = 'scaleX(' + ratio + ')';
    }

    function startAutoplay() {
      if (!autoplayMs || REDUCED) return;
      autoTimer = setInterval(function () {
        var maxScroll = track.scrollWidth - track.clientWidth;
        if (track.scrollLeft >= maxScroll - 1) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollBy(1);
        }
      }, autoplayMs);
    }

    function stopAutoplay() { clearInterval(autoTimer); }

    if (prevBtn) prevBtn.addEventListener('click', function () { scrollBy(-1); stopAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { scrollBy(1); stopAutoplay(); });
    track.addEventListener('scroll', syncUI, { passive: true });
    section.addEventListener('mouseenter', stopAutoplay);
    section.addEventListener('focusin', stopAutoplay);
    section.addEventListener('mouseleave', startAutoplay);

    syncUI();
    startAutoplay();
  }

  var STAR_PATH = 'M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27l-4.94 2.43.94-5.49-4-3.9 5.53-.8z';

  function starGlyphs() {
    var out = '';
    for (var i = 0; i < 5; i++) {
      out += '<svg class="uc-star-glyph" viewBox="0 0 20 20" width="20" height="20" focusable="false" aria-hidden="true"><path fill="currentColor" d="' + STAR_PATH + '"/></svg>';
    }
    return out;
  }

  function starsHtml(rating) {
    var pct = Math.max(0, Math.min(5, Number(rating) || 5)) * 20;
    return (
      '<span class="uc-stars pt__card-stars" style="--uc-star-pct:' + pct + '%;--pt-star-pct:' + pct + '%" aria-label="Rated ' + rating + ' out of 5 stars" role="img">' +
        '<span class="uc-stars__row uc-stars__row--empty">' + starGlyphs() + '</span>' +
        '<span class="uc-stars__row uc-stars__row--fill">' + starGlyphs() + '</span>' +
      '</span>'
    );
  }

  function cardFromReview(r, index) {
    var verified = r.verified
      ? '<span class="pt__card-verified">Verified</span>'
      : '';
    var photoAttr = r.hasPhoto ? 'true' : 'false';
    return (
      '<article class="pt__card uc-card-stable" data-pt-card="' + index + '" data-pt-rating="' + (r.rating || 5) + '" data-pt-has-photo="' + photoAttr + '" data-pt-verified="' + (!!r.verified) + '" data-pt-helpful="' + (r.helpful || 0) + '" data-pt-index="' + index + '" aria-label="Review by ' + (r.name || 'Customer') + '">' +
        '<header class="pt__card-head">' + starsHtml(r.rating) +
          '<div class="pt__card-meta-right">' + verified +
            (r.date ? '<time class="pt__card-date">' + r.date + '</time>' : '') +
          '</div></header>' +
        (r.title ? '<h3 class="pt__card-title">' + r.title + '</h3>' : '') +
        (r.text ? '<p class="pt__card-text">' + r.text + '</p>' : '') +
        '<footer class="pt__card-foot"><div class="pt__card-person">' +
          (r.name ? '<strong class="pt__card-name">' + r.name + '</strong>' : '') +
          (r.location ? '<span class="pt__card-location">' + r.location + '</span>' : '') +
          (r.variant ? '<span class="pt__card-variant">' + r.variant + '</span>' : '') +
        '</div>' +
        (r.helpful ? '<div class="pt__card-helpful">' + r.helpful + '</div>' : '') +
        '</footer></article>'
    );
  }

  function syncSummaryFromCatalog(section, data) {
    if (!data) return;
    var num = section.querySelector('.pt__summary-num');
    var count = section.querySelector('.pt__summary-count');
    var stars = section.querySelector('.pt__summary-stars, .pt__summary-score .uc-stars');
    if (num && data.average != null) num.textContent = data.average;
    if (stars && data.average != null) {
      var pct = Math.max(0, Math.min(5, Number(data.average) || 0)) * 20;
      stars.style.setProperty('--uc-star-pct', pct + '%');
      stars.style.setProperty('--pt-star-pct', pct + '%');
    }
    if (count && data.count != null) {
      var label = count.textContent.replace(/^[\d,.]+\s*/, '');
      count.textContent = data.count.toLocaleString() + ' ' + (label || 'verified reviews');
    }
    if (data.distribution) {
      var total = data.count || 1;
      var rows = section.querySelectorAll('[data-pt-distribution] .pt__dist-row');
      [5, 4, 3, 2, 1].forEach(function (star, i) {
        var row = rows[i];
        if (!row) return;
        var pct = Math.round(((data.distribution[star] || 0) * 100) / total);
        var fill = row.querySelector('.pt__dist-fill');
        var labelEl = row.querySelector('.pt__dist-count');
        if (fill) fill.style.setProperty('--pt-dist-pct', pct + '%');
        if (labelEl) labelEl.textContent = pct + '%';
      });
    }
  }

  function cardsFromTrack(track) {
    return Array.prototype.slice.call(track.querySelectorAll('.pt__card')).map(function (el) {
      return el.outerHTML;
    });
  }

  function buildReviewsStream(section, htmlCards) {
    if (!htmlCards || !htmlCards.length) return;
    if (typeof window.ucBuildReviewsStream === 'function') {
      window.ucBuildReviewsStream(section, htmlCards);
    }
    var arrows = section.querySelector('.pt__arrows');
    if (arrows) arrows.hidden = true;
    var toolbar = section.querySelector('[data-pt-toolbar]');
    if (toolbar) toolbar.hidden = true;
    var progress = section.querySelector('[data-pt-progress]');
    if (progress) progress.hidden = true;
  }

  function loadCatalog(section) {
    var url = section.getAttribute('data-pt-catalog');
    if (!url) return Promise.resolve();

    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.reviews || !data.reviews.length) return;
        var pool = data.reviews.slice(0, 12);
        buildReviewsStream(section, pool.map(cardFromReview));
        data.count = data.count || 36;
        data.average = data.average || 4.8;
        syncSummaryFromCatalog(section, data);
        var communityStat = section.querySelectorAll('[data-pt-stats] .pt__stat-number');
        communityStat.forEach(function (el) {
          var label = el.parentElement && el.parentElement.querySelector('.pt__stat-label');
          if (!label) return;
          var t = (label.textContent || '').toLowerCase();
          if (t.indexOf('community') !== -1 || t.indexOf('experiences') !== -1) {
            el.setAttribute('data-count', String(data.count));
            el.textContent = data.count + '+';
          }
          if (t.indexOf('rating') !== -1) {
            el.setAttribute('data-count', String(data.average));
            el.textContent = String(data.average);
          }
        });
      })
      .catch(function () { /* keep liquid cards */ });
  }

  function initSection(section) {
    loadCatalog(section).then(function () {
      if (!section.querySelector('[data-uc-reviews-stream]')) {
        var track = section.querySelector('[data-pt-track]');
        if (track) buildReviewsStream(section, cardsFromTrack(track));
      }
      if (!section.querySelector('[data-uc-reviews-stream]')) {
        initFilters(section);
        initCarousel(section);
      }
      initStats(section);
    });
  }

  function boot() {
    document.querySelectorAll('[data-pt-section]').forEach(initSection);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-pt-section]');
    if (s) initSection(s);
  });
})();

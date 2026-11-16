/**
 * uc-motion.js — scroll-synced reveals + light interactive polish
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(pointer: fine)').matches;
  /* Do NOT include .pc-card — AJAX facet swaps inject cards without is-visible
     and they stay opacity:0 (white grid). Product cards render immediately. */
  var REVEAL_SEL = [
    '.uc-reveal',
    '.ppb-reveal',
    '[data-uc-reveal]',
    '[data-cs-reveal]',
    '.pb__card',
    '.ucs__row',
    '.pfaq__item',
    '.ubt__item',
    '.vr-stat',
    '.fu__trust-item',
    '.ubp__item',
    '.hiw__card',
    '.hiw__step',
    '.pi__card',
    '.pct',
    '.category-showcase__header'
  ].join(', ');
  var VISIBLE_CLS = ['is-visible', 'is-revealed', 'cs-is-visible'];
  var io = null;

  function markVisible(el) {
    VISIBLE_CLS.forEach(function (c) {
      el.classList.add(c);
    });
  }

  function initReveal(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll ? scope.querySelectorAll(REVEAL_SEL) : [];
    if (!nodes.length) return;

    if (REDUCED || !('IntersectionObserver' in window)) {
      nodes.forEach(markVisible);
      return;
    }

    if (!io) {
      io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            var delay = el.getAttribute('data-reveal-delay');
            if (delay) {
              el.style.transitionDelay = Math.min(parseInt(delay, 10) || 0, 120) + 'ms';
            }
            markVisible(el);
            io.unobserve(el);
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
      );
    }

    nodes.forEach(function (el, index) {
      if (el.closest && el.closest('.uc-rev-stream, .pt-marquee, .upr-marquee')) {
        markVisible(el);
        el.style.opacity = '1';
        el.style.transform = 'none';
        return;
      }
      if (
        el.classList.contains('is-visible') ||
        el.classList.contains('is-revealed') ||
        el.classList.contains('cs-is-visible')
      ) {
        return;
      }
      if (!el.hasAttribute('data-uc-reveal') && !el.classList.contains('uc-reveal')) {
        el.setAttribute('data-uc-reveal', '');
      }
      if (!el.hasAttribute('data-reveal-delay') && el.parentElement) {
        var siblings = el.parentElement.children;
        var i = Array.prototype.indexOf.call(siblings, el);
        if (i > 0 && i < 8) el.setAttribute('data-reveal-delay', String(i * 40));
      }
      io.observe(el);
    });
  }

  function initAccordions(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-uc-accordion]').forEach(function (acc) {
      if (acc.dataset.ucAccBound === '1') return;
      acc.dataset.ucAccBound = '1';
      acc.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-uc-accordion-trigger]');
        if (!trigger) return;
        var item = trigger.closest('[data-uc-accordion-item]') || trigger.parentElement;
        if (!item) return;
        var open = item.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  function initScrollProgress() {
    if (REDUCED) return;
    var ticking = false;
    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      var p = Math.min(1, Math.max(0, window.scrollY / max));
      doc.style.setProperty('--uc-scroll-progress', String(p));
    }
    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }

  function initHoverLift(root) {
    if (REDUCED || !FINE) return;
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.pc-card, .ubp__card, .pi__card, .hiw__card').forEach(function (card) {
      if (card.dataset.ucHoverBound === '1') return;
      card.dataset.ucHoverBound = '1';
      card.classList.add('uc-hover-lift');
    });
  }

  function boot(root) {
    initReveal(root);
    initAccordions(root);
    initHoverLift(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot(document);
      initScrollProgress();
    });
  } else {
    boot(document);
    initScrollProgress();
  }

  document.addEventListener('shopify:section:load', function (e) {
    boot(e.target);
  });
})();

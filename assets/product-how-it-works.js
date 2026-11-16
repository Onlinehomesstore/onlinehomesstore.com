/*
  ============================================================================
  PRODUCT HOW IT WORKS — interactive steps
  ============================================================================
*/
(function () {
  'use strict';

  function setCurrent(section, index) {
    var steps = section.querySelectorAll('[data-hiw-step]');
    var panels = section.querySelectorAll('[data-hiw-focus-panel]');
    steps.forEach(function (step, i) {
      var on = i === index;
      step.classList.toggle('is-current', on);
      step.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      var on = String(panel.getAttribute('data-hiw-focus-panel')) === String(index);
      panel.classList.toggle('is-active', on);
    });
    section.classList.add('is-active');
  }

  function bindSteps(section) {
    if (section.dataset.hiwBound === '1') return;
    section.dataset.hiwBound = '1';
    var steps = section.querySelectorAll('[data-hiw-step]');
    steps.forEach(function (step, index) {
      step.setAttribute('tabindex', '0');
      step.setAttribute('role', 'button');
      step.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      function select() {
        setCurrent(section, index);
      }
      step.addEventListener('click', select);
      step.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          setCurrent(section, Math.min(steps.length - 1, index + 1));
          steps[Math.min(steps.length - 1, index + 1)].focus();
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setCurrent(section, Math.max(0, index - 1));
          steps[Math.max(0, index - 1)].focus();
        }
      });
    });
  }

  function activate(section) {
    section.classList.add('is-active');
    setCurrent(section, 0);
  }

  function initHIW(section) {
    bindSteps(section);
    if (!window.IntersectionObserver) {
      activate(section);
      return;
    }
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          obs.unobserve(e.target);
          activate(e.target);
        });
      },
      { threshold: 0.15 }
    );
    io.observe(section);
  }

  function boot() {
    document.querySelectorAll('[data-hiw-section]').forEach(initHIW);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-hiw-section]');
    if (s) initHIW(s);
  });
})();

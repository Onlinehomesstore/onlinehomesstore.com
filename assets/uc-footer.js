/**
 * uc-footer.js
 * UC Footer — Accordion · Newsletter AJAX · Accessibility
 * Vanilla JS only. No libraries. No jQuery.
 */
(function () {
  'use strict';

  /* ───────────────────────────────────────────────────────────────────────────
     ACCORDION (mobile nav columns)
     ─────────────────────────────────────────────────────────────────────────── */

  function initAccordion(section) {
    if (window.matchMedia('(max-width: 768px)').matches) return;

    var toggles = section.querySelectorAll('.uc-ft-nav-col__toggle');
    if (!toggles.length) return;

    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var col = btn.closest('.uc-ft-nav-col, .uc-ft-contact');
        if (!col) return;

        var isOpen = col.classList.contains('is-open');

        // Close all (single-open mode)
        section.querySelectorAll('.uc-ft-nav-col.is-open, .uc-ft-contact.is-open').forEach(function (c) {
          c.classList.remove('is-open');
          var tb = c.querySelector('.uc-ft-nav-col__toggle');
          if (tb) {
            tb.setAttribute('aria-expanded', 'false');
            tb.setAttribute('aria-label', tb.dataset.labelOpen || 'Expand');
          }
        });

        // Toggle clicked col
        if (!isOpen) {
          col.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          btn.setAttribute('aria-label', btn.dataset.labelClose || 'Collapse');
        }
      });
    });

    var heads = section.querySelectorAll('.uc-ft-nav-col__head');
    heads.forEach(function (head) {
      head.addEventListener('click', function (e) {
        if (window.matchMedia('(min-width: 769px)').matches) return;
        if (e.target.closest('a')) return;
        var btn = head.querySelector('.uc-ft-nav-col__toggle');
        if (btn && e.target !== btn && !btn.contains(e.target)) btn.click();
      });
    });
  }

  /* ───────────────────────────────────────────────────────────────────────────
     NEWSLETTER FORM — AJAX submit with UX states
     ─────────────────────────────────────────────────────────────────────────── */

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  }

  function initNewsletter(section) {
    var forms = section.querySelectorAll('.uc-ft-nl-form[data-uc-ft-nl]');

    forms.forEach(function (form) {
      var inputEl   = form.querySelector('.uc-ft-nl-input');
      var feedback  = form.nextElementSibling; // .uc-ft-nl-feedback div
      var noteEl    = form.parentElement.querySelector('.uc-ft-nl-note');

      if (!inputEl) return;

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var email = inputEl.value.trim();

        // Clear previous state
        form.classList.remove('is-loading', 'is-error');
        if (feedback) { feedback.className = 'uc-ft-nl-feedback'; feedback.textContent = ''; }

        // Validate
        if (!email) {
          showFeedback(feedback, 'error', form.dataset.msgRequired || 'Please enter your email address.');
          inputEl.focus();
          return;
        }

        if (!isValidEmail(email)) {
          showFeedback(feedback, 'error', form.dataset.msgInvalid || 'Please enter a valid email address.');
          inputEl.focus();
          return;
        }

        // Loading
        form.classList.add('is-loading');

        var data = new FormData(form);

        fetch(form.action || '/contact', {
          method: 'POST',
          body: data,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
          .then(function (r) {
            form.classList.remove('is-loading');
            if (r.ok || r.redirected) {
              // Success
              form.style.display = 'none';
              if (noteEl) noteEl.style.display = 'none';
              showFeedback(feedback, 'success', form.dataset.msgSuccess || 'You are in! Thank you for subscribing.');
            } else {
              showFeedback(feedback, 'error', form.dataset.msgError || 'Something went wrong. Please try again.');
            }
          })
          .catch(function () {
            form.classList.remove('is-loading');
            showFeedback(feedback, 'error', form.dataset.msgError || 'Something went wrong. Please try again.');
          });
      });
    });
  }

  function showFeedback(el, type, message) {
    if (!el) return;
    el.className = 'uc-ft-nl-feedback is-' + type;
    el.textContent = message;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
  }

  /* ───────────────────────────────────────────────────────────────────────────
     CURRENT YEAR (in-case Liquid isn't being used)
     ─────────────────────────────────────────────────────────────────────────── */

  function initYear(section) {
    var yearEls = section.querySelectorAll('[data-uc-ft-year]');
    var year = new Date().getFullYear();
    yearEls.forEach(function (el) { el.textContent = year; });
  }

  /* ───────────────────────────────────────────────────────────────────────────
     SCROLL REVEAL (subtle entrance)
     ─────────────────────────────────────────────────────────────────────────── */

  function initReveal(section) {
    if (!('IntersectionObserver' in window)) return;

    var targets = section.querySelectorAll('.uc-ft-nl-banner, .uc-ft-brand, .uc-ft-nav-col, .uc-ft-contact');
    if (!targets.length) return;

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('uc-ft-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -24px 0px' });

    targets.forEach(function (el) {
      el.style.setProperty('opacity', '0');
      el.style.setProperty('transform', 'translateY(16px)');
      el.style.setProperty('transition', 'opacity 0.55s ease, transform 0.55s var(--uc-ease-premium, ease)');
      obs.observe(el);
    });

    // Re-use css class toggle
    document.head.insertAdjacentHTML('beforeend',
      '<style>.uc-ft-revealed{opacity:1!important;transform:none!important}</style>'
    );

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach(function (el) {
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
        el.style.removeProperty('transition');
        obs.unobserve(el);
      });
      obs.disconnect();
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     RESET ACCORDION on resize (desktop: force-open, mobile: collapsed)
     ─────────────────────────────────────────────────────────────────────────── */

  function onResize(section) {
    var mq = window.matchMedia('(min-width: 769px)');

    function handle(e) {
      if (e.matches) {
        // Desktop: close all accordions gracefully (CSS handles display)
        section.querySelectorAll('.uc-ft-nav-col.is-open, .uc-ft-contact.is-open').forEach(function (c) {
          // Keep classes; CSS @media will override visibility
        });
      }
    }

    mq.addEventListener('change', handle);
    handle(mq);
  }

  /* ───────────────────────────────────────────────────────────────────────────
     INIT
     ─────────────────────────────────────────────────────────────────────────── */

  function init(root) {
    var sections = root ? [root] : document.querySelectorAll('.uc-ft-section');
    sections.forEach(function (section) {
      initAccordion(section);
      initNewsletter(section);
      initYear(section);
      initReveal(section);
      onResize(section);
    });
  }

  /* ───────────────────────────────────────────────────────────────────────────
     THEME EDITOR SUPPORT
     ─────────────────────────────────────────────────────────────────────────── */

  document.addEventListener('shopify:section:load', function (e) {
    if (e.target && e.target.querySelector('.uc-ft-section')) {
      init(e.target.querySelector('.uc-ft-section'));
    }
  });

  /* ───────────────────────────────────────────────────────────────────────────
     BOOT
     ─────────────────────────────────────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }

})();

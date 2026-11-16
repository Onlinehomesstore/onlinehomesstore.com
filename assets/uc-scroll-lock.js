/**
 * UC Scroll Lock — shared modal/popup background lock.
 * Prevents page scroll + touch scroll-through; restores exact scroll on close
 * without jumping to the header or the opener section.
 */
(function () {
  'use strict';
  if (window.UCScrollLock) return;

  var locks = 0;
  var savedY = 0;

  function scrollbarWidth() {
    return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  }

  function restoreY(y) {
    var top = typeof y === 'number' ? y : savedY;
    try {
      window.scrollTo({ top: top, left: 0, behavior: 'instant' });
    } catch (_) {
      window.scrollTo(0, top);
    }
  }

  function apply() {
    var html = document.documentElement;
    var body = document.body;
    if (!body) return;
    if (locks === 1) {
      savedY = window.scrollY || window.pageYOffset || 0;
      var pad = scrollbarWidth();
      html.style.setProperty('--uc-scroll-lock-pad', pad + 'px');
      html.style.setProperty('--uc-scroll-lock-y', '-' + savedY + 'px');
      html.setAttribute('data-uc-lock-y', String(savedY));
      html.classList.add('uc-scroll-locked', 'ch-scroll-locked');
      body.style.top = '-' + savedY + 'px';
      body.classList.add('uc-scroll-locked');
    }
  }

  function release() {
    var html = document.documentElement;
    var body = document.body;
    if (!body) return;
    if (locks > 0) return;

    locks = 0;
    var y = savedY;
    html.classList.add('uc-scroll-restoring');
    body.style.top = '';
    body.style.removeProperty('overflow');
    body.style.removeProperty('padding-right');
    body.classList.remove('uc-scroll-locked');
    html.classList.remove('uc-scroll-locked', 'ch-scroll-locked');
    html.style.removeProperty('--uc-scroll-lock-pad');
    html.style.removeProperty('--uc-scroll-lock-y');
    restoreY(y);
    requestAnimationFrame(function () {
      restoreY(y);
      requestAnimationFrame(function () {
        restoreY(y);
        html.classList.remove('uc-scroll-restoring');
        html.removeAttribute('data-uc-lock-y');
      });
    });
  }

  function focusKeep(el) {
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch (_) {
      el.focus();
    }
  }

  window.UCScrollLock = {
    lock: function () {
      locks += 1;
      apply();
    },
    unlock: function () {
      locks = Math.max(0, locks - 1);
      release();
    },
    forceUnlock: function () {
      locks = 0;
      release();
    },
    focus: focusKeep,
  };
})();

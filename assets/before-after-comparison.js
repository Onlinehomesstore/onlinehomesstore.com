/* ==========================================================================
   BEFORE & AFTER IMAGE COMPARISON
   Vanilla, dependency-free. Pointer + touch + keyboard, rAF-driven position,
   ResizeObserver for crisp image width, IntersectionObserver reveal.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function Comparison(section) {
    this.section = section;
    this.compare = section.querySelector('[data-ba-compare]');
    if (!this.compare) return;

    this.before = this.compare.querySelector('[data-ba-before]');
    this.divider = this.compare.querySelector('[data-ba-divider]');
    this.pos = parseFloat(this.compare.getAttribute('data-start'));
    if (isNaN(this.pos)) this.pos = 50;

    this.dragging = false;
    this.rafId = null;
    this.pendingPos = this.pos;

    this.init();
  }

  Comparison.prototype.init = function () {
    var self = this;

    this.apply(this.pos);

    // Pointer (mouse + touch + pen) unified.
    this.onDown = function (e) { self.start(e); };
    this.onMove = function (e) { self.move(e); };
    this.onUp = function () { self.end(); };

    this.compare.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerup', this.onUp, { passive: true });
    window.addEventListener('pointercancel', this.onUp, { passive: true });

    // Click / tap to jump (only if not the end of a drag).
    this.compare.addEventListener('click', function (e) {
      if (self._moved) { self._moved = false; return; }
      self.queue(self.fromEvent(e));
    });

    // Keyboard.
    this.compare.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowLeft') { e.preventDefault(); self.queue(self.pos - step); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); self.queue(self.pos + step); }
      else if (e.key === 'Home') { e.preventDefault(); self.queue(0); }
      else if (e.key === 'End') { e.preventDefault(); self.queue(100); }
    });
  };

  Comparison.prototype.fromEvent = function (e) {
    var rect = this.compare.getBoundingClientRect();
    var x = e.clientX - rect.left;
    return clamp((x / rect.width) * 100, 0, 100);
  };

  Comparison.prototype.start = function (e) {
    this.dragging = true;
    this._moved = false;
    this.section.classList.add('is-dragging');
    this.compare.setPointerCapture && this.compare.setPointerCapture(e.pointerId);
    this.queue(this.fromEvent(e));
  };

  Comparison.prototype.move = function (e) {
    if (!this.dragging) return;
    this._moved = true;
    this.queue(this.fromEvent(e));
  };

  Comparison.prototype.end = function () {
    if (!this.dragging) return;
    this.dragging = false;
    this.section.classList.remove('is-dragging');
  };

  /* Batch updates to a single rAF for buttery, thrash-free movement. */
  Comparison.prototype.queue = function (next) {
    this.pendingPos = clamp(next, 0, 100);
    if (this.rafId) return;
    var self = this;
    this.rafId = requestAnimationFrame(function () {
      self.rafId = null;
      self.apply(self.pendingPos);
    });
  };

  Comparison.prototype.apply = function (pos) {
    this.pos = pos;
    var css = pos + '%';
    this.compare.style.setProperty('--ba-pos', css);
    this.compare.setAttribute('aria-valuenow', Math.round(pos));
  };

  Comparison.prototype.destroy = function () {
    this.compare.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  };

  function initReveal(section) {
    if (!section.classList.contains('ba--reveal') || REDUCED || !('IntersectionObserver' in window)) {
      section.classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(section);
  }

  function init(section) {
    if (!section || section._baInit) return;
    section._baInit = true;
    section._ba = new Comparison(section);
    initReveal(section);
  }

  function boot(scope) {
    (scope || document).querySelectorAll('.ba').forEach(init);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', function () { boot(); });

  // Theme editor lifecycle.
  document.addEventListener('shopify:section:load', function (e) {
    boot(e.target);
  });
  document.addEventListener('shopify:section:unload', function (e) {
    var section = e.target.querySelector('.ba');
    if (section && section._ba) section._ba.destroy();
  });
})();

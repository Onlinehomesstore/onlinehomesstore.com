/* uc-editorial-hero.js — full-bleed overlay banner slideshow */
(() => {
  'use strict';

  class UcEditorialHero extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.track = this.querySelector('[data-ueh-track]');
      this.slides = Array.from(this.querySelectorAll('[data-ueh-slide]'));
      this.dots = Array.from(this.querySelectorAll('[data-ueh-dot]'));
      this.index = 0;
      this.count = this.slides.length;

      this.setActive(0, true);

      if (this.count <= 1) {
        this.classList.remove('ueh--slider');
        this.classList.add('ueh--single');
        return;
      }

      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.autoplay = this.dataset.autoplay === 'true' && !this.reduced;
      this.interval = parseInt(this.dataset.interval, 10) || 6000;

      this.bindControls();
      this.bindSwipe();
      if (this.autoplay) this.start();

      this.addEventListener('mouseenter', () => this.stop());
      this.addEventListener('mouseleave', () => { if (this.autoplay) this.start(); });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stop();
        else if (this.autoplay) this.start();
      });
    }

    bindControls() {
      const prev = this.querySelector('[data-ueh-prev]');
      const next = this.querySelector('[data-ueh-next]');
      if (prev) prev.addEventListener('click', () => { this.go(this.index - 1); this.restart(); });
      if (next) next.addEventListener('click', () => { this.go(this.index + 1); this.restart(); });
      this.dots.forEach((dot, i) => dot.addEventListener('click', () => { this.go(i); this.restart(); }));
    }

    bindSwipe() {
      let startX = 0;
      let dragging = false;
      const vp = this.querySelector('[data-ueh-viewport]') || this;
      vp.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; dragging = true; }, { passive: true });
      vp.addEventListener('touchend', (e) => {
        if (!dragging) return;
        dragging = false;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) < 40) return;
        this.go(dx < 0 ? this.index + 1 : this.index - 1);
        this.restart();
      }, { passive: true });
    }

    go(i) {
      const next = (i + this.count) % this.count;
      this.index = next;
      if (this.track) this.track.style.transform = `translate3d(-${next * 100}%, 0, 0)`;
      this.setActive(next);
    }

    setActive(i, initial) {
      this.slides.forEach((s, idx) => s.classList.toggle('is-active', idx === i));
      this.dots.forEach((d, idx) => {
        var on = idx === i;
        d.classList.toggle('is-active', on);
        d.setAttribute('aria-current', on ? 'true' : 'false');
      });
      if (initial && this.track) this.track.style.transform = 'translate3d(0,0,0)';
    }

    start() { this.stop(); this._timer = setInterval(() => this.go(this.index + 1), this.interval); }
    stop() { if (this._timer) clearInterval(this._timer); }
    restart() { if (this.autoplay) this.start(); }
  }

  if (!customElements.get('uc-editorial-hero')) {
    customElements.define('uc-editorial-hero', UcEditorialHero);
  }
})();

/**
 * uc-global-ui.js — scroll-to-top, popups, purchase notifications
 * Lightweight, no dependencies. Respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Scroll to top ─────────────────────────────────────────────────────── */
  function initScrollTop(root) {
    const btn = root.querySelector('[data-uc-scroll-top]');
    if (!btn) return;

    const threshold = parseInt(btn.dataset.threshold || '400', 10);
    let visible = false;

    const toggle = () => {
      const show = window.scrollY > threshold;
      if (show === visible) return;
      visible = show;
      btn.classList.toggle('is-visible', show);
      btn.setAttribute('aria-hidden', show ? 'false' : 'true');
      btn.tabIndex = show ? 0 : -1;
    };

    window.addEventListener('scroll', toggle, { passive: true });
    toggle();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ── Popups ────────────────────────────────────────────────────────────── */
  function initPopups(root) {
    const layers = root.querySelectorAll('[data-uc-popup]');
    if (!layers.length) return;

    const storageKey = 'uc-popup-seen';
    const seen = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    const pageStart = Date.now();

    const openPopup = (layer) => {
      layer.hidden = false;
      layer.removeAttribute('hidden');
      layer.classList.add('is-open');
      layer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const id = layer.dataset.popupId;
      if (id && layer.dataset.once === 'true') {
        seen[id] = true;
        sessionStorage.setItem(storageKey, JSON.stringify(seen));
      }
    };

    const closePopup = (layer) => {
      layer.classList.remove('is-open');
      layer.setAttribute('aria-hidden', 'true');
      layer.hidden = true;
      layer.setAttribute('hidden', '');
      document.body.style.overflow = '';
    };

    layers.forEach((layer) => {
      const id = layer.dataset.popupId;
      if (id && seen[id] && layer.dataset.once === 'true') return;

      const trigger = layer.dataset.trigger || 'delay';
      const delay = parseInt(layer.dataset.delay || '5', 10) * 1000;
      const scrollPct = parseInt(layer.dataset.scroll || '50', 10);
      const minTime = parseInt(layer.dataset.minTime || '0', 10) * 1000;

      const tryOpen = () => {
        if (layer.classList.contains('is-open')) return;
        if (window.__UC_NLP_SHOWN) return;
        if (minTime && Date.now() - pageStart < minTime) return;
        window.__UC_NLP_SHOWN = true;
        openPopup(layer);
      };

      if (trigger === 'delay') {
        setTimeout(tryOpen, delay);
      } else if (trigger === 'scroll') {
        const onScroll = () => {
          const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
          if (pct >= scrollPct) {
            tryOpen();
            window.removeEventListener('scroll', onScroll);
          }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
      } else if (trigger === 'exit') {
        document.addEventListener('mouseout', (e) => {
          if (e.clientY <= 0) tryOpen();
        }, { once: true });
      }

      layer.querySelectorAll('[data-uc-popup-close]').forEach((el) => {
        el.addEventListener('click', () => closePopup(layer));
      });

      layer.addEventListener('click', (e) => {
        if (e.target === layer) closePopup(layer);
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && layer.classList.contains('is-open')) closePopup(layer);
      });
    });
  }

  /* ── Purchase notifications ────────────────────────────────────────────── */
  function initPurchaseToasts(root) {
    const layer = root.querySelector('[data-uc-purchase-toasts]');
    if (!layer) return;

    const path = window.location.pathname || '';
    if (/\/checkouts?\//.test(path) || document.body.classList.contains('template-checkout')) return;

    let products = [];
    try {
      products = JSON.parse(layer.dataset.products || '[]');
    } catch (e) {
      products = [];
    }

    if (!products.length) return;

    const names = (layer.dataset.names || 'Alex,Jordan,Sam,Casey,Riley').split(',');
    const cities = (layer.dataset.cities || 'London,Manchester,Birmingham,Leeds,Bristol').split(',');
    const minDelay = parseInt(layer.dataset.minDelay || '8', 10) * 1000;
    const maxDelay = parseInt(layer.dataset.maxDelay || '18', 10) * 1000;
    const anim = layer.dataset.anim || 'fade';
    const times = ['2 minutes ago', '5 minutes ago', '8 minutes ago', '12 minutes ago', 'just now'];

    const showToast = () => {
      const product = products[Math.floor(Math.random() * products.length)];
      const toast = document.createElement('div');
      toast.className = 'uc-purchase-toast';
      toast.setAttribute('data-anim', anim);
      toast.innerHTML = `
        ${product.image ? `<img class="uc-purchase-toast__img" src="${product.image}" alt="" width="48" height="48" loading="lazy">` : ''}
        <p class="uc-purchase-toast__text"><strong>${names[Math.floor(Math.random() * names.length)].trim()}</strong> from ${cities[Math.floor(Math.random() * cities.length)].trim()} purchased <strong>${product.title}</strong></p>
        <span class="uc-purchase-toast__time">${times[Math.floor(Math.random() * times.length)]}</span>
      `;
      layer.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('is-visible'));

      setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 500);
      }, 5000);
    };

    const schedule = () => {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      setTimeout(() => {
        showToast();
        schedule();
      }, delay);
    };

    setTimeout(schedule, minDelay);
  }

  function init() {
    const root = document.querySelector('[data-uc-global-ui]');
    if (!root) return;
    initScrollTop(root);
    initPopups(root);
    initPurchaseToasts(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

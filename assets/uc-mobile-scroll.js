(() => {
  'use strict';

  const MQ = window.matchMedia('(max-width: 749px)');

  function wrapWithNav(track) {
    if (track.dataset.ucCarouselWrapped === '1') return;
    if (track.parentElement && track.parentElement.classList.contains('uc-m-carousel')) {
      track.dataset.ucCarouselWrapped = '1';
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'uc-m-carousel';
    track.parentNode.insertBefore(wrap, track);
    wrap.appendChild(track);

    const nav = document.createElement('div');
    nav.className = 'uc-m-carousel__nav';
    nav.innerHTML =
      '<button type="button" class="uc-m-carousel__btn" data-uc-m-prev aria-label="Previous">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>' +
      '</button>' +
      '<button type="button" class="uc-m-carousel__btn" data-uc-m-next aria-label="Next">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
      '</button>';
    wrap.appendChild(nav);

    const step = () => {
      const item = track.querySelector('.grid__item, .category-showcase__cell, .pc-card, li');
      if (!item) return track.clientWidth * 0.85;
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 12;
      return item.getBoundingClientRect().width + gap;
    };

    nav.querySelector('[data-uc-m-prev]').addEventListener('click', () => {
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    nav.querySelector('[data-uc-m-next]').addEventListener('click', () => {
      track.scrollBy({ left: step(), behavior: 'smooth' });
    });

    track.dataset.ucCarouselWrapped = '1';
  }

  function initTrack(el) {
    if (!el) return;
    el.classList.add('uc-scroll-track');
    el.setAttribute('role', el.getAttribute('role') || 'list');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Product carousel');
    wrapWithNav(el);
  }

  function boot() {
    if (!MQ.matches) return;

    document.querySelectorAll('[data-uc-mobile-scroll]').forEach(initTrack);

    /* Collection / search / related product grids — skip carousel */
    if (grid.id === 'product-grid' || grid.closest('.template-collection, .template-search')) return;

    /* Featured / showcase product grids */
    document.querySelectorAll('.pf-showcase .category-showcase__grid').forEach(initTrack);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  MQ.addEventListener('change', () => {
    if (MQ.matches) boot();
  });
  document.addEventListener('shopify:section:load', boot);
  document.addEventListener('uc:mobile-scroll:refresh', boot);
})();

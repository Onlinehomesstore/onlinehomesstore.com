/**
 * uc-newsletter-popup.js — triggers, cookies, focus trap, AJAX newsletter
 */
(function () {
  'use strict';

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

  function trapFocus(container) {
    const nodes = [...container.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden]'));
    if (!nodes.length) return () => {};
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    try {
      first.focus({ preventScroll: true });
    } catch (_) {
      first.focus();
    }
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', onKey);
    return () => container.removeEventListener('keydown', onKey);
  }

  function pageMatches(layer) {
    const scope = layer.dataset.scope || 'all';
    const tpl = document.querySelector('main[data-template]')?.dataset.template || '';
    if (scope === 'all') return true;
    if (scope === 'index' && tpl === 'index') return true;
    if (scope === 'collection' && tpl.includes('collection')) return true;
    if (scope === 'product' && tpl === 'product') return true;
    if (scope === 'blog' && (tpl === 'blog' || tpl === 'article')) return true;
    if (scope === 'page' && tpl === 'page') return true;
    return false;
  }

  function audienceOk(layer) {
    if (layer.dataset.loggedOutOnly === 'true' && window.Shopify?.customer?.id) return false;
    if (layer.dataset.returningOnly === 'true') {
      const key = 'uc-nlp-returning';
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        return false;
      }
    }
    if (layer.dataset.firstVisitOnly === 'true') {
      const key = 'uc-nlp-ever';
      if (localStorage.getItem(key)) return false;
      localStorage.setItem(key, '1');
    }
    return true;
  }

  function cookieSeen(id, days) {
    try {
      const raw = localStorage.getItem('uc-nlp-dismiss');
      const map = raw ? JSON.parse(raw) : {};
      const entry = map[id];
      if (!entry) return false;
      if (days <= 0) return true;
      return Date.now() - entry < days * 86400000;
    } catch {
      return false;
    }
  }

  function markSeen(id) {
    try {
      const raw = localStorage.getItem('uc-nlp-dismiss');
      const map = raw ? JSON.parse(raw) : {};
      map[id] = Date.now();
      localStorage.setItem('uc-nlp-dismiss', JSON.stringify(map));
    } catch (_) { /* noop */ }
  }

  function initForm(layer) {
    const form = layer.querySelector('[data-uc-nlp-form]');
    if (!form) return;
    const input = form.querySelector('input[type="email"]');
    const btn = form.querySelector('[data-uc-nlp-submit]');
    const feedback = layer.querySelector('[data-uc-nlp-feedback]');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = input?.value?.trim() || '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        if (feedback) {
          feedback.textContent = form.dataset.msgInvalid || 'Enter a valid email.';
          feedback.className = 'uc-nlp__feedback is-error';
        }
        input?.focus();
        return;
      }
      btn?.classList.add('is-loading');
      fetch(form.action || '/contact', { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then((r) => {
          btn?.classList.remove('is-loading');
          if (r.ok || r.redirected) {
            if (feedback) {
              feedback.textContent = form.dataset.msgSuccess || 'Thank you!';
              feedback.className = 'uc-nlp__feedback is-success';
            }
            form.reset();
            if (!(window.Shopify && window.Shopify.designMode)) {
              markSeen(layer.dataset.popupId || 'default');
            }
          } else if (feedback) {
            feedback.textContent = form.dataset.msgError || 'Something went wrong.';
            feedback.className = 'uc-nlp__feedback is-error';
          }
        })
        .catch(() => {
          btn?.classList.remove('is-loading');
          if (feedback) {
            feedback.textContent = form.dataset.msgError || 'Something went wrong.';
            feedback.className = 'uc-nlp__feedback is-error';
          }
        });
    });
  }

  function initCountdown(layer) {
    const el = layer.querySelector('[data-uc-nlp-countdown]');
    if (!el) return;
    const min = parseInt(el.dataset.minutes || '0', 10);
    if (!min) return;
    const end = Date.now() + min * 60000;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const s = Math.floor(left / 1000);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      el.textContent = `${m}:${String(sec).padStart(2, '0')} remaining`;
      if (left > 0) requestAnimationFrame(tick);
    };
    tick();
  }

  function initLayer(layer) {
    if (layer.dataset.ready === 'true') return;
    layer.dataset.ready = 'true';

    const designMode = !!(window.Shopify && window.Shopify.designMode);
    if (!designMode) {
      layer.hidden = true;
      layer.setAttribute('hidden', '');
      layer.classList.remove('is-open');
      layer.setAttribute('aria-hidden', 'true');
    }
    const id = layer.dataset.popupId || 'default';
    const cookieDays = parseInt(layer.dataset.cookieDays || '7', 10);

    let releaseFocus = () => {};
    const open = () => {
      if (layer.classList.contains('is-open')) return;
      layer.hidden = false;
      layer.removeAttribute('hidden');
      layer.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => {
        layer.classList.add('is-open');
      });
      if (window.UCScrollLock) window.UCScrollLock.lock();
      else document.body.classList.add('overflow-hidden');
      releaseFocus = trapFocus(layer.querySelector('.uc-nlp__dialog') || layer);
    };

    const close = () => {
      layer.classList.remove('is-open');
      layer.setAttribute('aria-hidden', 'true');
      layer.hidden = true;
      layer.setAttribute('hidden', '');
      if (window.UCScrollLock) window.UCScrollLock.unlock();
      else document.body.classList.remove('overflow-hidden');
      releaseFocus();
      if (!designMode) markSeen(id);
    };

    // Allow other scripts / buttons to open this popup directly.
    layer.ucOpen = open;
    layer.ucClose = close;

    // In the theme editor, preview immediately and skip cookie/audience gating.
    if (designMode) {
      layer.querySelectorAll('[data-uc-nlp-close]').forEach((el) => el.addEventListener('click', close));
      layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
      initForm(layer);
      initCountdown(layer);
      requestAnimationFrame(open);
      return;
    }

    if (cookieSeen(id, cookieDays)) return;
    if (!pageMatches(layer) || !audienceOk(layer)) return;

    const trigger = layer.dataset.trigger || 'delay';
    const delay = parseInt(layer.dataset.delay || '5', 10) * 1000;
    const scrollPct = parseInt(layer.dataset.scroll || '50', 10);
    const minTime = parseInt(layer.dataset.minTime || '0', 10) * 1000;
    const inactivity = parseInt(layer.dataset.inactivity || '0', 10) * 1000;
    const pageViews = parseInt(layer.dataset.pageViews || '0', 10);
    const start = Date.now();
    let opened = false;

    const tryOpen = () => {
      if (opened) return;
      if (window.__UC_NLP_SHOWN) return;
      if (minTime && Date.now() - start < minTime) return;
      opened = true;
      window.__UC_NLP_SHOWN = true;
      if (!designMode) markSeen(id);
      open();
    };

    if (pageViews > 0) {
      const pvKey = 'uc-nlp-pv';
      let pv = parseInt(sessionStorage.getItem(pvKey) || '0', 10) + 1;
      sessionStorage.setItem(pvKey, String(pv));
      if (pv < pageViews) opened = true;
    }

    if (trigger === 'delay') {
      const startDelay = () => setTimeout(tryOpen, delay);
      if (document.readyState === 'complete') startDelay();
      else window.addEventListener('load', startDelay, { once: true });
    } else if (trigger === 'scroll') {
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
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
    } else if (trigger === 'inactivity' && inactivity > 0) {
      let timer;
      const reset = () => {
        clearTimeout(timer);
        timer = setTimeout(tryOpen, inactivity);
      };
      ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
      reset();
    }

    layer.querySelectorAll('[data-uc-nlp-close]').forEach((el) => el.addEventListener('click', close));
    layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && layer.classList.contains('is-open')) close();
    });

    initForm(layer);
    initCountdown(layer);
  }

  function boot() {
    if (window.__ucNlpBooted && !(window.Shopify && window.Shopify.designMode)) return;
    window.__ucNlpBooted = true;
    document.querySelectorAll('[data-uc-nlp]').forEach(initLayer);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  document.addEventListener('shopify:section:load', (e) => {
    if (!(window.Shopify && window.Shopify.designMode)) return;
    e.target?.querySelectorAll('[data-uc-nlp]').forEach((el) => {
      el.dataset.ready = 'false';
      initLayer(el);
    });
  });
})();

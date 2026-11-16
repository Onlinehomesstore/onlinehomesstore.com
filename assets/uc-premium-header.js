(() => {
  'use strict';

  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  class UcPremiumHeader extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;
      this.sectionId = this.dataset.sectionId;
      this.initScroll();
      this.initDropdowns();
      this.initSearch();
      this.initDrawer();
      this.initCart();
      this.initWishlist();
      this.initAccount();
      this.syncOffset();
      this._ro = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.syncOffset())
        : null;
      this._ro?.observe(this);
      window.addEventListener('resize', this._onResize = () => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this.syncOffset(), 120);
      }, { passive: true });
    }

    disconnectedCallback() {
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
      this._ro?.disconnect();
    }

    syncOffset() {
      /* Distance from viewport top to bottom of the floating capsule. */
      const floatEl = this.querySelector('.uc-phdr__float');
      let bottom = 72;
      let floatTop = 14;
      if (floatEl) {
        const rect = floatEl.getBoundingClientRect();
        bottom = Math.ceil(rect.bottom);
        floatTop = Math.max(0, Math.ceil(rect.top));
      }
      const gap = 0;
      const h = Math.max(56, bottom + gap);
      document.documentElement.style.setProperty('--uc-phdr-offset', `${h}px`);
      document.documentElement.style.setProperty('--uc-site-header-offset', `${h}px`);
      document.documentElement.style.setProperty('--uc-phdr-gap', `${gap}px`);
      document.documentElement.style.setProperty('--uc-phdr-float-y', `${floatTop}px`);
    }

    initScroll() {
      const shrink = this.dataset.shrink !== 'false';
      const hideOnScroll = this.dataset.scrollHide === 'true';
      this._lastY = window.scrollY || 0;
      this._section = this.closest('.shopify-section');
      this._ticking = false;
      this._onScroll = () => {
        if (this._ticking) return;
        this._ticking = true;
        window.requestAnimationFrame(() => {
          this._ticking = false;
          const html = document.documentElement;
          /* Freeze header hide/show while cart or quick view is open */
          if (
            html.classList.contains('uc-cart-open') ||
            html.classList.contains('uc-qv-open') ||
            html.classList.contains('ch-scroll-locked')
          ) {
            this._section?.classList.remove('is-scroll-hidden');
            return;
          }
          const y = window.scrollY || 0;
          const scrolled = y > 24;
          this.classList.toggle('is-scrolled', scrolled);
          if (shrink) this.classList.toggle('is-compact', y > 80);

          if (hideOnScroll) {
            const delta = y - this._lastY;
            /* Wider hysteresis to prevent scroll-direction flicker */
            if (y > 140 && delta > 10) {
              this._section?.classList.add('is-scroll-hidden');
            } else if (delta < -10 || y <= 80) {
              this._section?.classList.remove('is-scroll-hidden');
            }
          } else {
            this._section?.classList.remove('is-scroll-hidden');
          }

          this._lastY = y;
        });
      };
      window.addEventListener('scroll', this._onScroll, { passive: true });
      this._onScroll();
    }

    initDropdowns() {
      this.querySelectorAll('[data-uc-phdr-drop]').forEach((drop) => {
        const toggle = drop.querySelector('[data-uc-phdr-drop-toggle]');
        const panel = drop.querySelector('[data-uc-phdr-drop-panel]');
        if (!toggle || !panel) return;
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = !drop.classList.contains('is-open');
          this.closeAllDropdowns();
          if (open) {
            drop.classList.add('is-open');
            panel.removeAttribute('hidden');
            toggle.setAttribute('aria-expanded', 'true');
          }
        });
      });
      document.addEventListener('click', () => this.closeAllDropdowns());
    }

    closeAllDropdowns() {
      this.querySelectorAll('[data-uc-phdr-drop]').forEach((d) => d.classList.remove('is-open'));
      this.querySelectorAll('[data-uc-phdr-drop-panel]').forEach((p) => p.setAttribute('hidden', ''));
      this.querySelectorAll('[data-uc-phdr-drop-toggle]').forEach((t) => t.setAttribute('aria-expanded', 'false'));
    }

    initSearch() {
      const panel = document.getElementById(`UcPhdrSearch-${this.sectionId}`);
      const openBtn = this.querySelector('[data-uc-phdr-search-open]');
      const form = panel?.querySelector('[data-uc-phdr-search-form]');
      const input = panel?.querySelector('.uc-phdr__search-input');
      const quick = panel?.querySelector('[data-uc-phdr-search-quick]');
      if (!panel || !openBtn) return;

      const close = () => {
        panel.classList.remove('is-open');
        openBtn.setAttribute('aria-expanded', 'false');
        document.documentElement.classList.remove('uc-phdr-lock', 'uc-phdr-search-open');
        document.body.style.removeProperty('overflow');
        this._pageScrim?.classList.remove('is-visible');
        if (window.UCScrollLock) window.UCScrollLock.unlock();
        setTimeout(() => { if (!panel.classList.contains('is-open')) panel.setAttribute('hidden', ''); }, 360);
      };

      if (!this._pageScrim) {
        const scrim = document.createElement('div');
        scrim.className = 'uc-phdr__page-scrim';
        scrim.setAttribute('aria-hidden', 'true');
        scrim.addEventListener('click', close);
        document.body.appendChild(scrim);
        this._pageScrim = scrim;
      }

      const open = () => {
        if (panel.parentElement !== document.body) {
          document.body.appendChild(panel);
        }
        panel.removeAttribute('hidden');
        openBtn.setAttribute('aria-expanded', 'true');
        document.documentElement.classList.add('uc-phdr-lock', 'uc-phdr-search-open');
        this._pageScrim?.classList.add('is-visible');
        if (window.UCScrollLock) window.UCScrollLock.lock();
        requestAnimationFrame(() => {
          panel.classList.add('is-open');
          input?.focus();
        });
      };

      openBtn.addEventListener('click', () => (panel.hasAttribute('hidden') ? open() : close()));
      panel.querySelectorAll('[data-uc-phdr-search-close]').forEach((el) => el.addEventListener('click', close));
      document.addEventListener('keydown', (e) => {
        if (panel.hasAttribute('hidden')) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
          if (window.UCScrollLock && window.UCScrollLock.focus) window.UCScrollLock.focus(openBtn);
          else {
            try { openBtn.focus({ preventScroll: true }); } catch (_) { openBtn.focus(); }
          }
        }
      });

      quick?.querySelectorAll('[data-uc-phdr-chip]').forEach((chip) => {
        chip.addEventListener('click', () => {
          if (!input || !form) return;
          input.value = chip.getAttribute('data-uc-phdr-chip') || '';
          form.requestSubmit ? form.requestSubmit() : form.submit();
        });
      });
    }

    initDrawer() {
      const drawer = document.getElementById(`UcPhdrDrawer-${this.sectionId}`);
      const openBtn = this.querySelector('[data-uc-phdr-drawer-open]');
      if (!drawer || !openBtn) return;

      /* Escape section pointer-events trap — keep drawer on document.body */
      if (drawer.parentElement !== document.body) {
        document.body.appendChild(drawer);
      }

      const open = () => {
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        openBtn.setAttribute('aria-expanded', 'true');
        document.documentElement.classList.add('uc-phdr-lock');
        if (window.UCScrollLock) window.UCScrollLock.lock();
        const closeBtn = drawer.querySelector('[data-uc-phdr-drawer-close]');
        requestAnimationFrame(() => {
          try { closeBtn?.focus?.({ preventScroll: true }); } catch (_) { closeBtn?.focus?.(); }
        });
      };
      const close = () => {
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        openBtn.setAttribute('aria-expanded', 'false');
        document.documentElement.classList.remove('uc-phdr-lock');
        if (window.UCScrollLock) window.UCScrollLock.unlock();
        if (window.UCScrollLock && window.UCScrollLock.focus) window.UCScrollLock.focus(openBtn);
        else {
          try { openBtn.focus?.({ preventScroll: true }); } catch (_) { openBtn.focus?.(); }
        }
      };

      openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        drawer.classList.contains('is-open') ? close() : open();
      });

      drawer.addEventListener('click', (e) => {
        if (
          e.target.closest('[data-uc-phdr-drawer-close]') ||
          e.target.matches('[data-uc-phdr-drawer-overlay]') ||
          e.target.hasAttribute('data-uc-phdr-drawer-overlay')
        ) {
          e.preventDefault();
          close();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
          e.preventDefault();
          close();
        }
      });

      this._drawerClose = close;
    }

    initCart() {
      document.addEventListener('cart:updated', (e) => {
        this.applyCartCount(e.detail);
        this.pulseTool('[data-uc-phdr-cart-open], .uc-phdr__tool--cart');
      });
      document.addEventListener('cart:refresh', (e) => {
        this.applyCartCount(e.detail);
      });
      if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
        subscribe(PUB_SUB_EVENTS.cartUpdate, (payload) => {
          this.applyCartCount(payload);
          this.pulseTool('[data-uc-phdr-cart-open], .uc-phdr__tool--cart');
        });
      }
      this.syncCartBadge();
    }

    applyCartCount(detail) {
      const cart = detail && (detail.cartData || detail.cart);
      if (cart && typeof cart.item_count === 'number') {
        document.querySelectorAll('[data-uc-phdr-cart-count]').forEach((el) => {
          el.textContent = String(cart.item_count);
          el.classList.toggle('uc-phdr__badge--empty', cart.item_count === 0);
          el.hidden = cart.item_count === 0;
        });
        return;
      }
      this.syncCartBadge();
    }

    pulseTool(selector) {
      document.querySelectorAll(selector).forEach((el) => {
        el.classList.remove('uc-icon-pulse');
        void el.offsetWidth;
        el.classList.add('uc-icon-pulse');
        setTimeout(() => el.classList.remove('uc-icon-pulse'), 700);
      });
    }

    syncCartBadge() {
      const apply = (cart) => {
        if (!cart || typeof cart.item_count !== 'number') return;
        document.querySelectorAll('[data-uc-phdr-cart-count]').forEach((el) => {
          el.textContent = String(cart.item_count);
          el.classList.toggle('uc-phdr__badge--empty', cart.item_count === 0);
          el.hidden = cart.item_count === 0;
        });
      };
      if (window.UCCart && typeof window.UCCart.fetchCartJson === 'function') {
        window.UCCart.fetchCartJson().then(apply);
        return;
      }
      fetch(`${window.Shopify?.routes?.root || '/'}cart.js`)
        .then((r) => r.json())
        .then(apply)
        .catch(() => {});
    }

    initAccount() {
      const loginUrl =
        (window.routes && window.routes.account_login_url) ||
        (window.routes && window.routes.storefront_login_url) ||
        '/account/login';
      const accountUrl = (window.routes && window.routes.account_url) || '/account';

      document.querySelectorAll('[data-uc-phdr-account], .uc-phdr__tool--account').forEach((el) => {
        const state = el.dataset.accountState || 'out';
        const dataLogin = el.getAttribute('data-account-login-url');
        const dataPortal = el.getAttribute('data-account-portal-url');
        const href = el.getAttribute('href');
        const target =
          state === 'in'
            ? dataPortal || accountUrl
            : dataLogin || loginUrl;

        if (!href || href === '#' || href === '') {
          el.setAttribute('href', target);
        }

        el.classList.remove('is-loading');
        el.removeAttribute('aria-busy');
        el.addEventListener('click', () => {
          this.pulseTool('[data-uc-phdr-account], .uc-phdr__tool--account');
        });
      });
    }

    initWishlist() {
      const key = this.dataset.wishlistKey || 'uc:wishlist';
      const sync = (detail) => {
        let count = 0;
        try {
          const raw = localStorage.getItem(key);
          if (raw) count = (JSON.parse(raw) || []).length;
        } catch (_) { /* noop */ }
        if (detail && typeof detail.count === 'number') count = detail.count;
        document.querySelectorAll('[data-uc-phdr-wish-count]').forEach((el) => {
          el.textContent = String(count);
          el.classList.toggle('uc-phdr__badge--empty', count === 0);
          el.hidden = count === 0;
        });
      };
      sync();
      document.addEventListener('wishlist:change', (e) => {
        sync(e.detail);
        this.pulseTool('[data-uc-phdr-wishlist], .uc-phdr__tool--wish');
      });
      document.addEventListener('uc:wishlist:change', (e) => {
        sync(e.detail);
        this.pulseTool('[data-uc-phdr-wishlist], .uc-phdr__tool--wish');
      });
    }

  }

  if (!customElements.get('uc-premium-header')) {
    customElements.define('uc-premium-header', UcPremiumHeader);
  }
})();

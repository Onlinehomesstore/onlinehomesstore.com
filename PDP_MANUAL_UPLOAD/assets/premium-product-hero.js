/*
  ============================================================================
  PREMIUM PRODUCT HERO — JavaScript
  ----------------------------------------------------------------------------
  Vanilla JS (ES5-compatible, no dependencies) for:
    • Gallery     — scroll-snap + thumbnails + arrows + counter + swipe
    • Variants    — pill selection → price + availability update + image swap
    • Quantity    — +/− stepper
    • Cart        — AJAX add to cart, loading/success/error states
    • Accordion   — one-open-at-a-time with smooth CSS grid animation
    • Theme Ed.   — re-inits on section:load / section:unload events

  Cart integration: fires Shopify PUB_SUB cartUpdate event and opens Dawn's
  cart drawer automatically (compatible with Dawn 8+).
  ============================================================================
*/
(function () {
  'use strict';

  /* ─── Utility ──────────────────────────────────────────────────────────── */

  function rootUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.charAt(root.length - 1) === '/' ? root : root + '/';
  }

  function formatMoney(cents, format) {
    if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
    if (!format) return (cents / 100).toFixed(2);
    var value = (cents / 100).toFixed(2);
    return format.replace(/\{\{\s*amount\s*\}\}/, value).replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100));
  }

  function bindReviewsLink(section) {
    var link = section.querySelector('[data-pph-reviews-link]');
    if (!link) return;

    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) !== '#') return;

      var id = href.slice(1);
      var target = document.getElementById(id);
      if (!target && id.indexOf('ProductTestimonials') === 0) {
        target = document.querySelector('[id^="ProductTestimonials-"]');
      }
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  function addToCartFromForm(form) {
    if (window.UCCart && typeof window.UCCart.addFromForm === 'function') {
      return window.UCCart.addFromForm(form, 'premium-product-hero');
    }
    var formData = new FormData(form);
    return fetch(rootUrl() + 'cart/add.js', {
      method: 'POST',
      body: formData,
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (err) { throw err; });
        return res.json();
      })
      .then(function () {
        return fetch(rootUrl() + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) {
          return r.json();
        });
      })
      .then(function (cart) {
        if (window.UCCart) window.UCCart.broadcastCartUpdate('premium-product-hero', cart);
        if (window.UCCart) window.UCCart.openCartUI();
      });
  }

  /* ─── Gallery ─────────────────────────────────────────────────────────── */

  function Gallery(root) {
    this.root     = root;
    this.track    = root.querySelector('[data-pph-track]');
    this.thumbs   = Array.prototype.slice.call(root.querySelectorAll('[data-pph-thumb]'));
    this.counter  = root.querySelector('[data-pph-counter]');
    this.current  = 0;
    this._scrollT = null;

    if (!this.track) return;

    this._slides = Array.prototype.slice.call(this.track.querySelectorAll('[data-pph-slide]'));
    if (!this._slides.length) return;

    this._bindArrows();
    this._bindThumbs();
    this._bindScroll();
    this._bindSwipe();
    this._bindKeyboard();
    this._bindLightbox();
    this.setActive(0, false);
  }

  Gallery.prototype._bindArrows = function () {
    var self = this;
    var prev = this.root.querySelector('[data-pph-prev]');
    var next = this.root.querySelector('[data-pph-next]');
    if (prev) prev.addEventListener('click', function () { self.go(self.current - 1); });
    if (next) next.addEventListener('click', function () { self.go(self.current + 1); });
  };

  Gallery.prototype._bindThumbs = function () {
    var self = this;
    this.thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var idx = parseInt(thumb.getAttribute('data-pph-thumb'), 10);
        self.go(idx);
      });
    });
  };

  Gallery.prototype._bindScroll = function () {
    var self = this;
    this.track.addEventListener('scroll', function () {
      if (self._scrollT) clearTimeout(self._scrollT);
      self._scrollT = setTimeout(function () {
        var w = self.track.offsetWidth;
        if (!w) return;
        var idx = Math.round(self.track.scrollLeft / w);
        if (idx !== self.current) self.setActive(idx, false);
      }, 60);
    }, { passive: true });
  };

  Gallery.prototype._bindSwipe = function () {
    var self = this;
    var sx = 0, sy = 0, dragging = false;

    this.track.addEventListener('touchstart', function (e) {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      dragging = true;
    }, { passive: true });

    this.track.addEventListener('touchend', function (e) {
      if (!dragging) return;
      dragging = false;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        self.go(self.current + (dx < 0 ? 1 : -1));
        e.preventDefault();
      }
    }, { passive: true });
  };

  Gallery.prototype._bindKeyboard = function () {
    var self = this;
    this.root.setAttribute('tabindex', '-1');
    this.root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { self.go(self.current - 1); if (self._syncLightbox) self._syncLightbox(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { self.go(self.current + 1); if (self._syncLightbox) self._syncLightbox(); e.preventDefault(); }
      if (e.key === 'Escape' && self._lightbox) { self._closeLightbox(); e.preventDefault(); }
    });
  };

  Gallery.prototype._getSlideImageData = function (slide, preferDisplay) {
    if (!slide) return { src: '', alt: '' };
    var img = slide.querySelector('.pph-gallery__img:not(.pph-gallery__img--placeholder)');
    if (!img) return { src: '', alt: '' };
    var src = '';

    if (preferDisplay) {
      if (img.currentSrc) src = img.currentSrc;
      else if (img.src) src = img.src;
    } else {
      src = slide.getAttribute('data-zoom-src') || img.getAttribute('data-zoom-src') || '';
      if (!src) {
        var srcset = img.getAttribute('srcset');
        if (srcset) {
          var parts = srcset.split(',');
          var best = parts[parts.length - 1].trim().split(/\s+/)[0];
          if (best) src = best;
        }
      }
      if (!src && img.currentSrc) src = img.currentSrc;
      if (!src && img.src) src = img.src;
    }

    return { src: src || '', alt: img.alt || '' };
  };

  Gallery.prototype._syncLightbox = function () {
    if (!this._lightbox) return;
    var slide = this._slides[this.current];
    var data = this._getSlideImageData(slide, true);
    var lbImg = this._lightbox.querySelector('.pph-lightbox__img');
    var counter = this._lightbox.querySelector('.pph-lightbox__counter');
    if (lbImg && data.src) {
      if (lbImg.getAttribute('src') !== data.src) {
        lbImg.style.opacity = '0.55';
        lbImg.onload = function () {
          lbImg.style.opacity = '1';
          lbImg.onload = null;
        };
        lbImg.src = data.src;
      }
      lbImg.alt = data.alt;
    }
    if (counter) counter.textContent = (this.current + 1) + ' / ' + this._slides.length;
    var prev = this._lightbox.querySelector('.pph-lightbox__nav--prev');
    var next = this._lightbox.querySelector('.pph-lightbox__nav--next');
    if (prev) prev.hidden = this._slides.length < 2;
    if (next) next.hidden = this._slides.length < 2;
    var thumbs = this._lightbox.querySelectorAll('[data-pph-lb-thumb]');
    var self = this;
    thumbs.forEach(function (btn) {
      var idx = parseInt(btn.getAttribute('data-pph-lb-thumb'), 10);
      btn.classList.toggle('is-active', idx === self.current);
    });
  };

  Gallery.prototype._bindLightbox = function () {
    var self = this;
    var viewport = this.root.querySelector('.pph-gallery__viewport');
    if (!viewport) return;

    viewport.addEventListener('click', function (e) {
      if (e.target.closest('.pph-gallery__arrow, button, video, iframe')) return;
      var slide = self._slides[self.current];
      if (!slide) return;
      var img = slide.querySelector('.pph-gallery__img:not(.pph-gallery__img--placeholder)');
      if (!img || !img.currentSrc && !img.src) return;
      var zoomSrc = slide.getAttribute('data-zoom-src') || img.getAttribute('data-zoom-src') || img.currentSrc || img.src;
      self._openLightbox(zoomSrc, img.alt || '');
    });
  };

  Gallery.prototype._openLightbox = function (src, alt) {
    if (this._lightbox) this._closeLightbox();

    var overlay = document.createElement('div');
    overlay.className = 'pph-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Product image fullscreen view');

    var thumbsHtml = '';
    var self = this;
    this._slides.forEach(function (slide, i) {
      var img = slide.querySelector('img');
      var thumbSrc = '';
      if (img) {
        thumbSrc = img.currentSrc || img.src || img.getAttribute('src') || '';
      }
      if (!thumbSrc) return;
      thumbsHtml +=
        '<button type="button" class="pph-lightbox__thumb' + (i === self.current ? ' is-active' : '') + '" data-pph-lb-thumb="' + i + '" aria-label="View image ' + (i + 1) + '">' +
          '<img src="' + thumbSrc.replace(/"/g, '&quot;') + '" alt="" loading="lazy" decoding="async">' +
        '</button>';
    });

    overlay.innerHTML =
      '<button type="button" class="pph-lightbox__close" aria-label="Close">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<div class="pph-lightbox__stage">' +
        '<button type="button" class="pph-lightbox__nav pph-lightbox__nav--prev" aria-label="Previous image">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<img class="pph-lightbox__img" src="' + src + '" alt="' + (alt || '').replace(/"/g, '&quot;') + '">' +
        '<button type="button" class="pph-lightbox__nav pph-lightbox__nav--next" aria-label="Next image">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>' +
      (thumbsHtml
        ? '<div class="pph-lightbox__thumbs" role="list" aria-label="Gallery navigation">' + thumbsHtml + '</div>'
        : '') +
      '<p class="pph-lightbox__counter" aria-live="polite"></p>';

    document.body.appendChild(overlay);
    document.body.classList.add('pph-lightbox-open');
    this._lightbox = overlay;
    overlay.setAttribute('tabindex', '0');

    self._syncLightbox();
    overlay.focus();

    overlay.querySelector('.pph-lightbox__close').addEventListener('click', function () {
      self._closeLightbox();
    });
    overlay.querySelector('.pph-lightbox__nav--prev').addEventListener('click', function (e) {
      e.stopPropagation();
      self.go(self.current - 1);
    });
    overlay.querySelector('.pph-lightbox__nav--next').addEventListener('click', function (e) {
      e.stopPropagation();
      self.go(self.current + 1);
    });
    overlay.querySelectorAll('[data-pph-lb-thumb]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.getAttribute('data-pph-lb-thumb'), 10);
        if (!isNaN(idx)) self.go(idx);
      });
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        self.go(self.current - 1);
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        self.go(self.current + 1);
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        self._closeLightbox();
        e.preventDefault();
      }
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) self._closeLightbox();
    });
  };

  Gallery.prototype._closeLightbox = function () {
    if (!this._lightbox) return;
    this._lightbox.remove();
    this._lightbox = null;
    document.body.classList.remove('pph-lightbox-open');

    var slide = this._slides[this.current];
    var track = this.track;
    if (slide && track) {
      var left = slide.offsetLeft - track.offsetLeft;
      if (typeof track.scrollTo === 'function') {
        track.scrollTo({ left: left, behavior: 'auto' });
      } else {
        track.scrollLeft = left;
      }
    }
  };

  Gallery.prototype.go = function (idx) {
    var total = this._slides.length;
    idx = ((idx % total) + total) % total;
    var slide = this._slides[idx];
    var track = this.track;

    if (!this._lightbox && slide && track) {
      var left = slide.offsetLeft - track.offsetLeft;
      if (typeof track.scrollTo === 'function') {
        track.scrollTo({ left: left, behavior: 'smooth' });
      } else {
        track.scrollLeft = left;
      }
    }

    this.setActive(idx, !this._lightbox);
  };

  Gallery.prototype.goToMediaId = function (mediaId) {
    var self = this;
    this._slides.forEach(function (slide, i) {
      if (parseInt(slide.getAttribute('data-media-id'), 10) === mediaId) {
        self.go(i);
      }
    });
  };

  Gallery.prototype.setActive = function (idx, scroll) {
    this.current = idx;
    var self = this;

    this.thumbs.forEach(function (thumb, i) {
      var active = i === idx;
      thumb.classList.toggle('is-active', active);
      thumb.setAttribute('aria-label', 'View image ' + (i + 1) + (active ? ' (current)' : ''));
      if (active && scroll !== false) {
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    });

    if (this.counter) {
      this.counter.textContent = (idx + 1) + ' / ' + this._slides.length;
    }

    if (this._syncLightbox) this._syncLightbox();
  };

  /* ─── Variant handler ──────────────────────────────────────────────────── */

  function VariantHandler(section, gallery) {
    this.section = section;
    this.gallery = gallery;

    var dataEl = document.getElementById('pph-data-' + section.getAttribute('data-section-id'));
    if (!dataEl) return;

    try {
      var data = JSON.parse(dataEl.textContent || dataEl.innerText);
      this.variants  = data.variants  || [];
      this.options   = data.options   || [];
      this.mediaData = data.media     || [];
      this.meta      = data;
    } catch (e) {
      this.variants = []; this.options = []; this.mediaData = [];
      this.meta = {};
    }

    /* Build selected options array from active pills / variant cards */
    this.selected = [];
    var self = this;
    var optionEls = section.querySelectorAll('[data-pph-option]');
    optionEls.forEach(function (optEl) {
      var active = optEl.querySelector('.pph__pill.is-active, .pph__variant-card.is-active');
      self.selected.push(active ? active.getAttribute('data-value') : '');
    });

    this._bind();
  }

  VariantHandler.prototype._bind = function () {
    var self = this;
    this.section.addEventListener('click', function (e) {
      var pill = e.target.closest('[data-pph-pill]');
      if (!pill || pill.disabled) return;

      var optIdx = parseInt(pill.getAttribute('data-pph-pill'), 10);
      var value  = pill.getAttribute('data-value');

      /* Deactivate siblings, activate clicked */
      var siblings = self.section.querySelectorAll('[data-pph-pill="' + optIdx + '"]');
      siblings.forEach(function (s) {
        s.classList.remove('is-active');
        s.setAttribute('aria-pressed', 'false');
      });
      pill.classList.add('is-active');
      pill.setAttribute('aria-pressed', 'true');

      /* Update label */
      var label = self.section.querySelector('[data-pph-selected="' + optIdx + '"]');
      if (label) label.textContent = value;

      self.selected[optIdx] = value;
      self._onVariantChange();
    });

    document.addEventListener('uc:variant-change', function (e) {
      if (!e.detail || e.detail.source !== 'sticky-atc') return;

      var variant = self.variants.find(function (v) { return v.id === e.detail.variantId; });
      if (!variant) return;

      self.selected = variant.options.slice();
      variant.options.forEach(function (val, idx) {
        var pills = self.section.querySelectorAll('[data-pph-pill="' + idx + '"]');
        pills.forEach(function (p) {
          var active = p.getAttribute('data-value') === val;
          p.classList.toggle('is-active', active);
          p.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        var label = self.section.querySelector('[data-pph-selected="' + idx + '"]');
        if (label) label.textContent = val;
      });

      var idInput = self.section.querySelector('[data-pph-variant-id]');
      if (idInput) idInput.value = variant.id;

      self._updatePrice(variant);
      self._updateStock(variant);
      self._updateATC(variant);
      if (variant.featuredMediaId && self.gallery) {
        self.gallery.goToMediaId(variant.featuredMediaId);
      }
    });
  };

  VariantHandler.prototype._findVariant = function () {
    var sel = this.selected;
    return this.variants.find(function (v) {
      return v.options.every(function (opt, i) { return opt === sel[i]; });
    }) || null;
  };

  VariantHandler.prototype._onVariantChange = function () {
    var variant = this._findVariant();
    if (!variant) return;

    /* Update hidden variant input */
    var idInput = this.section.querySelector('[data-pph-variant-id]');
    if (idInput) idInput.value = variant.id;

    /* Update URL without reloading */
    if (window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    }

    /* Update price */
    this._updatePrice(variant);

    /* Update stock line */
    this._updateStock(variant);

    /* Update ATC button */
    this._updateATC(variant);

    /* Switch gallery to variant image */
    if (variant.featuredMediaId && this.gallery) {
      this.gallery.goToMediaId(variant.featuredMediaId);
    }

    document.dispatchEvent(new CustomEvent('uc:variant-change', {
      bubbles: true,
      detail: {
        source: 'hero',
        variantId: variant.id,
        available: variant.available,
        price: variant.price,
        priceRaw: variant.priceRaw,
        comparePriceRaw: variant.comparePriceRaw,
        saveAmountRaw: variant.saveAmountRaw || 0,
        featuredMediaId: variant.featuredMediaId
      }
    }));
  };

  VariantHandler.prototype._updatePrice = function (variant) {
    var priceEl   = this.section.querySelector('[data-pph-current-price]');
    var compareEl = this.section.querySelector('[data-pph-compare-price]');
    var saveEl    = this.section.querySelector('[data-pph-save-badge]');
    var saveLine  = this.section.querySelector('[data-pph-save-line]');
    var saveAmtEl = this.section.querySelector('[data-pph-save-amount]');

    if (priceEl) {
      priceEl.textContent = variant.price;
      priceEl.classList.toggle('pph__price--sale', variant.comparePriceRaw > variant.priceRaw);
    }

    if (compareEl) {
      if (variant.comparePriceRaw > variant.priceRaw) {
        compareEl.textContent = variant.comparePrice;
        compareEl.hidden = false;
      } else {
        compareEl.hidden = true;
      }
    }

    if (saveEl) {
      if (variant.comparePriceRaw > variant.priceRaw) {
        var pct = Math.round((variant.comparePriceRaw - variant.priceRaw) * 100 / variant.comparePriceRaw);
        saveEl.textContent = '-' + pct + '%';
        saveEl.hidden = false;
      } else {
        saveEl.hidden = true;
      }
    }

    if (saveLine && saveAmtEl && variant.saveAmountRaw > 0) {
      saveAmtEl.textContent = formatMoney(variant.saveAmountRaw, this.meta.moneyFormat);
      saveLine.hidden = false;
    } else if (saveLine) {
      saveLine.hidden = true;
    }
  };

  VariantHandler.prototype._updateStock = function (variant) {
    var stockEl = this.section.querySelector('[data-pph-stock]');
    if (!stockEl || !this.meta) return;

    var threshold = this.meta.lowStockThreshold || 5;
    var html = '';

    if (!variant.available) {
      html = '<span class="pph__stock--out">' + (this.meta.outOfStockLine || 'Currently out of stock') + '</span>';
    } else if (variant.inventoryQuantity > 0 && variant.inventoryQuantity <= threshold) {
      html = '<span class="pph__stock--low">' + (this.meta.lowStockLine || 'Only a few left in stock') + '</span>';
    } else {
      html = '<span class="pph__stock--in">' + (this.meta.inStockLine || 'In stock — ready to ship') + '</span>';
    }

    stockEl.innerHTML = html;
  };

  VariantHandler.prototype._updateATC = function (variant) {
    var btn     = this.section.querySelector('[data-pph-atc]');
    var textEl  = this.section.querySelector('.pph__atc-text');
    var buyBtn  = this.section.querySelector('[data-pph-buy-now]');
    if (!btn || !textEl) return;

    if (!variant.available) {
      btn.disabled = true;
      textEl.textContent = 'Sold out';
      if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.setAttribute('aria-disabled', 'true');
      }
    } else {
      btn.disabled = false;
      textEl.textContent = btn.getAttribute('data-atc-text') || 'Add to cart';
      if (buyBtn) {
        buyBtn.disabled = false;
        buyBtn.removeAttribute('aria-disabled');
      }
    }
  };

  /* ─── Cart ─────────────────────────────────────────────────────────────── */

  function Cart(section) {
    this.section = section;
    this._bind();
  }

  Cart.prototype._bind = function () {
    var self = this;
    var form = this.section.querySelector('.pph__form');
    if (!form) return;

    /* Store original ATC label so variants can restore it */
    var btn = form.querySelector('[data-pph-atc]');
    if (btn) {
      var textEl = btn.querySelector('.pph__atc-text');
      if (textEl) btn.setAttribute('data-atc-text', textEl.textContent.trim());
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      self._submit(form);
    });

    var buyBtn = this.section.querySelector('[data-pph-buy-now]');
    if (buyBtn) {
      buyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self._buyNow(form, buyBtn);
      });
    }

  };

  Cart.prototype._buyNow = function (form, btn) {
    var textEl = btn.querySelector('.pph__buy-fast-text');
    var prev = textEl ? textEl.textContent : 'Buy Now';
    btn.disabled = true;
    btn.classList.add('is-loading');

    var run;
    if (window.UCCart && typeof window.UCCart.buyNowFromForm === 'function') {
      run = window.UCCart.buyNowFromForm(form);
    } else {
      window.__UC_BUY_NOW__ = true;
      run = addToCartFromForm(form).then(function () {
        window.location.href = rootUrl() + 'checkout';
      });
    }

    run.catch(function (err) {
      window.__UC_BUY_NOW__ = false;
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (textEl) textEl.textContent = (err && err.description) || 'Try again';
      setTimeout(function () {
        if (textEl) textEl.textContent = prev;
      }, 2500);
    });
  };

  Cart.prototype._submit = function (form) {
    var btn    = form.querySelector('[data-pph-atc]');
    var textEl = form.querySelector('.pph__atc-text');
    var spinner = form.querySelector('.pph__atc-spinner');
    if (!btn) return;

    btn.classList.add('is-loading');
    btn.disabled = true;
    if (spinner) spinner.hidden = false;

    addToCartFromForm(form)
    .then(function () {
      btn.classList.remove('is-loading');
      btn.classList.add('is-success');
      if (spinner) spinner.hidden = true;
      if (textEl) textEl.textContent = '✓ Added!';

      setTimeout(function () {
        btn.classList.remove('is-success');
        btn.disabled = false;
        if (textEl) textEl.textContent = btn.getAttribute('data-atc-text') || 'Add to cart';
      }, 2400);
    })
    .catch(function (err) {
      btn.classList.remove('is-loading');
      if (spinner) spinner.hidden = true;
      btn.disabled = false;
      var msg = (err && err.description) || 'Could not add to cart. Please try again.';
      if (textEl) textEl.textContent = msg;
      setTimeout(function () {
        if (textEl) textEl.textContent = btn.getAttribute('data-atc-text') || 'Add to cart';
      }, 3000);
    });
  };


  /* ─── Quantity stepper ──────────────────────────────────────────────────── */

  function bindQty(section) {
    section.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pph-minus], [data-pph-plus]');
      if (!btn) return;
      var input = btn.closest('[data-pph-qty]');
      if (!input) return;
      var inp = input.querySelector('[data-pph-qty-val]');
      if (!inp) return;
      var val = parseInt(inp.value, 10) || 1;
      if (btn.hasAttribute('data-pph-plus'))  val = val + 1;
      if (btn.hasAttribute('data-pph-minus')) val = Math.max(1, val - 1);
      inp.value = val;
    });
  }

  /* ─── Init & boot ───────────────────────────────────────────────────────── */

  var instances = {};

  function bindRipple(section) {
    section.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('.uc-btn--ripple');
      if (!btn) return;
      var rect = btn.getBoundingClientRect();
      btn.style.setProperty('--ripple-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
      btn.style.setProperty('--ripple-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
  }

  function bindGalleryParallax(section) {
    /* Parallax disabled — kept gallery pinned without vertical drift into next sections */
    var parallax = section.querySelector('[data-pph-gallery-parallax]');
    if (parallax) parallax.style.transform = '';
  }

  function init(section) {
    var uid = section.getAttribute('data-section-id');
    if (!uid) return;

    /* Theme Editor: avoid stacking listeners — skip if already live */
    if (instances[uid] && section.dataset.pphBound === '1') {
      return;
    }
    section.dataset.pphBound = '1';

    var galleryRoot = section.querySelector('[data-pph-gallery]');
    var gallery     = galleryRoot ? new Gallery(galleryRoot) : null;
    var variants    = new VariantHandler(section, gallery);
    var cart        = new Cart(section);

    bindQty(section);
    bindRipple(section);
    bindReviewsLink(section);
    bindGalleryParallax(section);

    instances[uid] = { gallery: gallery, variants: variants, cart: cart };
  }

  function boot() {
    var sections = document.querySelectorAll('[data-pph-section]');
    sections.forEach(function (section) { init(section); });
  }

  /* Theme Editor events */
  document.addEventListener('shopify:section:load', function (e) {
    var section = e.target.querySelector('[data-pph-section]');
    if (section) init(section);
  });

  document.addEventListener('shopify:section:unload', function (e) {
    var section = e.target.querySelector('[data-pph-section]');
    if (!section) return;
    var uid = section.getAttribute('data-section-id');
    if (uid && instances[uid]) delete instances[uid];
  });

  /* Boot on DOMContentLoaded or immediately if document is already ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

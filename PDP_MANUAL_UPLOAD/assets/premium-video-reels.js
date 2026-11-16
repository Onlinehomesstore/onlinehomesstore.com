/* ==========================================================================
   PREMIUM SHOPPABLE VIDEO REELS
   Vanilla JS custom element. No dependencies.

   Modules:
     Utils        — helpers (root url, debounce, money, provider parsing)
     Cart         — AJAX add + native drawer sync + toast
     Toast        — success / error notifications
     VideoManager — lazy mount, providers, autoplay, controls, progress
     Slider       — drag / wheel / touch / keyboard / arrows / pagination
     Popup        — luxury shoppable popup (single reusable instance)
     PremiumVideoReels (custom element) — wires everything per section
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------- Utils */
  var Utils = {
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,

    root: function () {
      var r = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      return r.charAt(r.length - 1) === '/' ? r : r + '/';
    },

    debounce: function (fn, wait) {
      var t;
      return function () {
        var ctx = this, args = arguments;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(ctx, args); }, wait);
      };
    },

    vibrate: function (ms) {
      if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
    },

    /* Detect a video provider from an external URL. */
    parseProvider: function (url) {
      if (!url) return null;
      url = url.trim();

      var yt = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i);
      if (yt) return { type: 'youtube', id: yt[1], src: url };

      var vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
      if (vm) return { type: 'vimeo', id: vm[1], src: url };

      if (/\.mp4(\?|$)/i.test(url)) return { type: 'mp4', src: url };

      var tt = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i) ||
        url.match(/tiktok\.com\/.*\/video\/(\d+)/i) ||
        url.match(/tiktok\.com\/v\/(\d+)/i);
      if (tt) return { type: 'tiktok', id: tt[1], src: url };
      if (/tiktok\.com/i.test(url) || /vm\.tiktok\.com/i.test(url)) {
        return { type: 'tiktok', id: '', src: url };
      }

      if (/instagram\.com\/(?:reel|p|tv)\//i.test(url)) {
        return { type: 'instagram', src: url };
      }

      return { type: 'mp4', src: url };
    },

    /* Load an external embed script once (TikTok / Instagram). */
    loadScript: function (src, id) {
      return new Promise(function (resolve) {
        if (id && document.getElementById(id)) { resolve(); return; }
        var s = document.createElement('script');
        if (id) s.id = id;
        s.src = src;
        s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { resolve(); };
        document.body.appendChild(s);
      });
    },

    /* Extract thumbnail_url from oEmbed-like JSON (string or object). */
    parseOEmbedThumb: function (data) {
      if (!data) return null;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return null; }
      }
      return data.thumbnail_url || data.thumbnail_url_with_play_button || null;
    },

    /*
      TikTok/Vimeo oEmbed is usually CORS-blocked in the browser.
      Try direct fetch first, then public CORS proxies (best-effort).
    */
    fetchThumbnail: function (provider, url) {
      if (!provider) return Promise.resolve(null);

      if (provider.type === 'youtube' && provider.id) {
        return Promise.resolve('https://img.youtube.com/vi/' + provider.id + '/hqdefault.jpg');
      }

      var oembedUrl = null;
      if (provider.type === 'tiktok' && url) {
        oembedUrl = 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url.split('?')[0]);
      } else if (provider.type === 'vimeo' && url) {
        oembedUrl = 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(url);
      }

      if (!oembedUrl) return Promise.resolve(null);

      var self = this;
      var attempts = [
        function () {
          return fetch(oembedUrl, { mode: 'cors', credentials: 'omit' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(self.parseOEmbedThumb);
        },
        function () {
          return fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(oembedUrl), {
            mode: 'cors',
            credentials: 'omit',
          })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (wrap) { return self.parseOEmbedThumb(wrap && wrap.contents); });
        },
        function () {
          return fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(oembedUrl), {
            mode: 'cors',
            credentials: 'omit',
          })
            .then(function (r) { return r.ok ? r.text() : null; })
            .then(self.parseOEmbedThumb);
        },
      ];

      var run = function (i) {
        if (i >= attempts.length) return Promise.resolve(null);
        return attempts[i]()
          .then(function (thumb) {
            if (thumb) return thumb;
            return run(i + 1);
          })
          .catch(function () { return run(i + 1); });
      };

      return run(0);
    },
  };

  /* ----------------------------------------------------------------- Toast */
  var Toast = {
    el: null,
    timer: null,
    show: function (message, isError) {
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.className = 'pvr-toast';
        this.el.setAttribute('role', 'status');
        this.el.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.el);
      }
      this.el.textContent = message;
      this.el.classList.toggle('pvr-toast--error', !!isError);
      var self = this;
      requestAnimationFrame(function () { self.el.classList.add('is-visible'); });
      clearTimeout(this.timer);
      this.timer = setTimeout(function () { self.el.classList.remove('is-visible'); }, 2600);
    },
  };

  /* ------------------------------------------------------------------ Cart */
  var Cart = {
    publish: function (cart) {
      if (window.UCCart && typeof window.UCCart.broadcastCartUpdate === 'function') {
        window.UCCart.broadcastCartUpdate('premium-video-reels', cart);
        return;
      }
      if (window.publish && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
        window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'premium-video-reels', cartData: cart });
      }
      document.dispatchEvent(new CustomEvent('cart:refresh', {
        bubbles: true,
        detail: { source: 'premium-video-reels', cartData: cart },
      }));
    },

    openDrawer: function () {
      if (window.UCCart && typeof window.UCCart.openCartUI === 'function') {
        window.UCCart.openCartUI();
        return;
      }
      var opener =
        document.querySelector('[data-uc-phdr-cart-open]') ||
        document.querySelector('#cart-icon-bubble') ||
        document.querySelector('[data-ch-cart-open]');
      if (opener) opener.click();
    },

    fetchCart: function () {
      if (window.UCCart && typeof window.UCCart.fetchCartJson === 'function') {
        return window.UCCart.fetchCartJson();
      }
      return fetch(Utils.root() + 'cart.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; });
    },

    add: function (variantId, quantity, options) {
      var opts = options || {};
      var openDrawer = opts.openDrawer !== false;
      if (window.UCCart && typeof window.UCCart.addItems === 'function') {
        return window.UCCart.addItems(
          [{ id: Number(variantId), quantity: quantity || 1 }],
          'premium-video-reels',
          { openDrawer: openDrawer }
        );
      }
      return fetch(Utils.root() + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: variantId, quantity: quantity || 1 }] }),
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw data;
          return data;
        });
      });
    },
  };

  /* ---------------------------------------------------------- VideoManager */
  function VideoCard(cell, section) {
    this.cell = cell;
    this.section = section;
    this.card = cell.querySelector('.pvr-card');
    this.slot = cell.querySelector('[data-pvr-video-slot]');
    this.media = cell.querySelector('[data-pvr-media]');
    this.spinner = cell.querySelector('[data-pvr-spinner]');
    this.replayBtn = cell.querySelector('[data-pvr-replay]');
    this.fill = cell.querySelector('[data-pvr-fill]');
    this.buffer = cell.querySelector('[data-pvr-buffer]');
    this.shopifySrc = cell.getAttribute('data-video-shopify') || '';
    this.externalUrl = cell.getAttribute('data-video-url') || '';
    this.provider = this.shopifySrc
      ? { type: 'mp4', src: this.shopifySrc }
      : Utils.parseProvider(this.externalUrl);
    this.muted = cell.getAttribute('data-muted-block') === 'true';
    this.canAutoplay = cell.getAttribute('data-autoplay-block') !== 'false' && section.autoplay;
    this.video = null;
    this.mounted = false;
    this.rafId = null;
    if (this.isSocial()) this.card.classList.add('is-social');
    // Show branded cover immediately while TikTok/IG thumbnails resolve
    var pendingPoster = this.cell.querySelector('.pvr-card__poster--pending, .pvr-card__poster[data-poster-pending="true"]');
    if (pendingPoster && this.media) this.media.classList.add('is-placeholder');
  }

  VideoCard.prototype.isEmbed = function () {
    /* Only clean providers mount inline. TikTok/IG chrome is banned in-card. */
    return this.provider && (
      this.provider.type === 'youtube' ||
      this.provider.type === 'vimeo'
    );
  };

  VideoCard.prototype.isSocial = function () {
    return this.provider && (
      this.provider.type === 'tiktok' ||
      this.provider.type === 'instagram'
    );
  };

  VideoCard.prototype.isPlayable = function () {
    return this.provider && (this.provider.type === 'mp4' || this.isEmbed() || this.isSocial());
  };

  VideoCard.prototype.mount = function () {
    if (this.mounted || !this.provider) { this.markLoaded(); return; }
    this.mounted = true;

    /* Never mount TikTok/Instagram iframes in the carousel — they destroy the premium UI. */
    if (this.isSocial()) {
      this.markLoaded();
      this.card.classList.add('is-social');
      return;
    }

    if (this.provider.type === 'mp4') {
      var v = document.createElement('video');
      /* Autoplay requires mute on most mobile browsers; unmute on user open/tap */
      var isCoarse = window.matchMedia && window.matchMedia('(max-width: 749px), (pointer: coarse)').matches;
      v.muted = isCoarse ? true : this.muted;
      this.muted = v.muted;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.preload = isCoarse ? 'none' : 'metadata';
      v.src = this.provider.src;
      try { if (!isCoarse) v.load(); } catch (_) { /* noop */ }
      this.video = v;
      this.slot.appendChild(v);
      this.bindVideoEvents();
    } else if (this.isEmbed()) {
      var iframe = document.createElement('iframe');
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.setAttribute('loading', 'lazy');
      iframe.title = 'Video reel';
      /* Inline embeds stay muted for autoplay policy; popup opens with sound */
      if (this.provider.type === 'youtube') {
        iframe.src = 'https://www.youtube.com/embed/' + this.provider.id +
          '?autoplay=0&mute=1&loop=1&controls=0&playsinline=1&rel=0&playlist=' + this.provider.id;
      } else if (this.provider.type === 'vimeo') {
        iframe.src = 'https://player.vimeo.com/video/' + this.provider.id +
          '?autoplay=0&muted=1&loop=1&background=1';
      }
      if (iframe.src) {
        this.slot.appendChild(iframe);
        this.markLoaded();
        this.card.classList.add('is-playing');
      } else {
        this.markLoaded();
      }
    } else {
      this.markLoaded();
    }
  };

  VideoCard.prototype.markLoaded = function () {
    this.card.classList.add('is-loaded');
  };

  VideoCard.prototype.showPlaceholder = function () {
    var poster = this.cell && this.cell.querySelector('.pvr-card__poster');
    if (poster) {
      poster.classList.add('pvr-card__poster--empty');
      poster.classList.remove('pvr-card__poster--pending');
      poster.removeAttribute('src');
      poster.removeAttribute('srcset');
      poster.setAttribute('hidden', '');
      poster.setAttribute('aria-hidden', 'true');
    }
    if (this.media) this.media.classList.add('is-placeholder');
    this.markLoaded();
  };

  VideoCard.prototype.resolveThumbnail = function () {
    var self = this;
    var poster = this.cell.querySelector('.pvr-card__poster');

    var hasValidSrc = function (img) {
      if (!img) return false;
      var attr = (img.getAttribute('src') || '').trim();
      if (!attr || attr === '#' || attr.indexOf('data:') === 0 && attr.length < 40) return false;
      try {
        if (img.src && (img.src === location.href || img.src.replace(/\/$/, '') === location.origin)) return false;
      } catch (e) {}
      return true;
    };

    var revealPoster = function () {
      if (!poster) return;
      poster.removeAttribute('hidden');
      poster.classList.remove('pvr-card__poster--pending', 'pvr-card__poster--empty');
      poster.removeAttribute('data-poster-pending');
      if (self.media) self.media.classList.remove('is-placeholder');
      self.markLoaded();
    };

    // Poster already resolved server-side (manual, Shopify preview, bundled asset, product image).
    if (poster && poster.tagName === 'IMG' && hasValidSrc(poster)) {
      poster.addEventListener('error', function () {
        // Drop broken src then try remote oEmbed / proxies
        poster.removeAttribute('src');
        poster.removeAttribute('srcset');
        poster.classList.add('pvr-card__poster--pending');
        self._fetchRemoteThumb(poster);
      }, { once: true });
      poster.addEventListener('load', revealPoster, { once: true });
      if (poster.complete && poster.naturalWidth > 0) {
        revealPoster();
      } else if (poster.complete && poster.naturalWidth === 0 && hasValidSrc(poster)) {
        // Cached error state
        poster.removeAttribute('src');
        poster.classList.add('pvr-card__poster--pending');
        self._fetchRemoteThumb(poster);
      }
      return;
    }
    if (!poster || poster.tagName !== 'IMG') { this.showPlaceholder(); return; }
    if (poster.getAttribute('data-thumb-resolved') === 'true') return;

    this._fetchRemoteThumb(poster);
  };

  VideoCard.prototype._fetchRemoteThumb = function (poster) {
    var self = this;
    if (!poster) { this.showPlaceholder(); return; }

    var setPoster = function (url) {
      if (!url) { self.showPlaceholder(); return; }
      poster.removeAttribute('hidden');
      poster.setAttribute('referrerpolicy', 'no-referrer');
      poster.setAttribute('crossorigin', 'anonymous');
      poster.setAttribute('data-thumb-resolved', 'true');
      poster.classList.remove('pvr-card__poster--pending', 'pvr-card__poster--empty');
      poster.addEventListener('error', function () { self.showPlaceholder(); }, { once: true });
      poster.addEventListener('load', function () {
        if (self.media) self.media.classList.remove('is-placeholder');
        poster.removeAttribute('data-poster-pending');
        self.markLoaded();
      }, { once: true });
      poster.src = url;
    };

    var preset = poster.getAttribute('data-poster-url');
    if (preset) { setPoster(preset); return; }

    if (this.cell.getAttribute('data-thumb-auto') !== 'true') { this.showPlaceholder(); return; }

    Utils.fetchThumbnail(this.provider, this.externalUrl).then(function (thumb) {
      if (!poster.isConnected) return;
      if (thumb) setPoster(thumb);
      else self.showPlaceholder();
    }).catch(function () { self.showPlaceholder(); });
  };

  VideoCard.prototype.bindVideoEvents = function () {
    var self = this;
    var v = this.video;
    v.addEventListener('loadeddata', function () { self.markLoaded(); }, { once: true });
    v.addEventListener('waiting', function () { if (self.spinner) self.spinner.hidden = false; });
    v.addEventListener('playing', function () {
      if (self.spinner) self.spinner.hidden = true;
      self.card.classList.add('is-playing');
      if (self.replayBtn) self.replayBtn.hidden = true;
      self.trackProgress();
    });
    v.addEventListener('pause', function () {
      self.card.classList.remove('is-playing');
      self.stopProgress();
    });
    v.addEventListener('ended', function () {
      if (!v.loop && self.replayBtn) self.replayBtn.hidden = false;
    });
    v.addEventListener('progress', function () { self.updateBuffer(); });
  };

  VideoCard.prototype.trackProgress = function () {
    var self = this;
    cancelAnimationFrame(this.rafId);
    var step = function () {
      if (!self.video || self.video.paused) return;
      if (self.fill && self.video.duration) {
        self.fill.style.width = (self.video.currentTime / self.video.duration * 100) + '%';
      }
      self.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  };

  VideoCard.prototype.stopProgress = function () { cancelAnimationFrame(this.rafId); };

  VideoCard.prototype.updateBuffer = function () {
    if (!this.video || !this.buffer || !this.video.duration || !this.video.buffered.length) return;
    var end = this.video.buffered.end(this.video.buffered.length - 1);
    this.buffer.style.width = (end / this.video.duration * 100) + '%';
  };

  VideoCard.prototype.play = function () {
    if (!this.mounted) this.mount();
    if (!this.video) return;
    /* Never fight the main thread with many concurrent decoders on phones */
    if (this.section && typeof this.section._limitPlaying === 'function') {
      this.section._limitPlaying(this);
    }
    var p = this.video.play();
    if (p && p.catch) p.catch(function () {});
  };

  VideoCard.prototype.pause = function () {
    if (this.video && !this.video.paused) this.video.pause();
    this.stopProgress();
  };

  VideoCard.prototype.toggle = function () {
    if (!this.video) {
      this.mount();
      if (!this.video) return;
    }
    if (this.video.paused) {
      /* User gesture — prefer sound */
      this.setMuted(false);
      this.play();
    } else {
      this.pause();
    }
  };

  VideoCard.prototype.setMuted = function (m) {
    this.muted = !!m;
    if (this.video) this.video.muted = this.muted;
    var btn = this.card.querySelector('[data-pvr-mute]');
    if (btn) {
      btn.setAttribute('aria-pressed', this.muted ? 'true' : 'false');
      var on = btn.querySelector('.pvr-card__mute-on');
      var off = btn.querySelector('.pvr-card__mute-off');
      if (on) on.hidden = this.muted;
      if (off) off.hidden = !this.muted;
    }
  };

  VideoCard.prototype.syncMuteUi = function () {
    this.setMuted(this.muted);
  };

  /* ---------------------------------------------------------------- Slider */
  function Slider(section) {
    this.section = section;
    this.track = section.querySelector('[data-pvr-track]');
    this.cells = Array.prototype.slice.call(section.querySelectorAll('[data-pvr-cell]'));
    this.prevBtn = section.querySelector('[data-pvr-prev]');
    this.nextBtn = section.querySelector('[data-pvr-next]');
    this.loop = section.getAttribute('data-loop') === 'true';
    this.dotsWrap = section.querySelector('[data-pvr-dots]');
    this.scrollFill = section.querySelector('[data-pvr-scrollfill]');
    this.numCurrent = section.querySelector('[data-pvr-num-current]');
    this.drag = { active: false, startX: 0, startScroll: 0, moved: false };
    this.init();
  }

  Slider.prototype.init = function () {
    var self = this;
    if (this.prevBtn) this.prevBtn.addEventListener('click', function () { self.page(-1); });
    if (this.nextBtn) this.nextBtn.addEventListener('click', function () { self.page(1); });

    this.bindDrag();
    this.bindWheel();
    this.bindKeyboard();
    this.buildDots();

    this.onScroll = function () {
      if (self._scrollRaf) return;
      self._scrollRaf = requestAnimationFrame(function () {
        self._scrollRaf = null;
        self.syncUI();
      });
    };
    this.track.addEventListener('scroll', this.onScroll, { passive: true });
    this.syncUI();
  };

  Slider.prototype.step = function () {
    var first = this.cells[0];
    if (!first) return this.track.clientWidth;
    var gap = parseFloat(getComputedStyle(this.track).columnGap || getComputedStyle(this.track).gap) || 0;
    return first.getBoundingClientRect().width + gap;
  };

  Slider.prototype.perView = function () {
    return Math.max(1, Math.round(this.track.clientWidth / this.step()));
  };

  Slider.prototype.page = function (dir) {
    var oneByOne = window.innerWidth <= 749;
    var perView = this.perView();
    var amount = oneByOne ? this.step() : this.step() * perView;
    var max = this.track.scrollWidth - this.track.clientWidth;
    var target = this.track.scrollLeft + dir * amount;

    if (this.loop) {
      if (dir > 0 && this.track.scrollLeft >= max - 4) target = 0;
      else if (dir < 0 && this.track.scrollLeft <= 4) target = max;
    }
    this.track.scrollTo({ left: target, behavior: Utils.reduced ? 'auto' : 'smooth' });
  };

  Slider.prototype.bindDrag = function () {
    var self = this;
    var track = this.track;
    /* Touch / coarse pointers: use native overflow + scroll-snap (momentum).
       Custom pointer drag fights iOS/Android swipe and kills reels scrolling. */
    var coarse = window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
    if (coarse || window.innerWidth < 990) {
      track.style.touchAction = 'pan-x';
      return;
    }

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'touch') return;
      self.drag.active = true;
      self.drag.moved = false;
      self.drag.startX = e.clientX;
      self.drag.startScroll = track.scrollLeft;
      self.section.classList.add('is-dragging');
    });

    track.addEventListener('pointermove', function (e) {
      if (!self.drag.active) return;
      var dx = e.clientX - self.drag.startX;
      if (Math.abs(dx) > 4) self.drag.moved = true;
      track.scrollLeft = self.drag.startScroll - dx;
    });

    var end = function () {
      if (!self.drag.active) return;
      self.drag.active = false;
      self.section.classList.remove('is-dragging');
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('pointerleave', end);

    track.addEventListener(
      'click',
      function (e) {
        if (self.drag.moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );
  };

  Slider.prototype.bindWheel = function () {
    var self = this;
    this.track.addEventListener('wheel', function (e) {
      /* Never steal vertical page scroll. Only nudge horizontally when the
         user is already scrolling sideways (trackpads / shift+wheel). */
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (e.deltaX === 0) return;
      var max = self.track.scrollWidth - self.track.clientWidth;
      if (max <= 0) return;
      var next = self.track.scrollLeft + e.deltaX;
      if (next < 0 && self.track.scrollLeft <= 0) return;
      if (next > max && self.track.scrollLeft >= max - 1) return;
      e.preventDefault();
      self.track.scrollLeft += e.deltaX;
    }, { passive: false });
  };

  Slider.prototype.bindKeyboard = function () {
    var self = this;
    this.track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); self.page(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); self.page(-1); }
      else if (e.key === 'Home') { e.preventDefault(); self.track.scrollTo({ left: 0, behavior: 'smooth' }); }
      else if (e.key === 'End') { e.preventDefault(); self.track.scrollTo({ left: self.track.scrollWidth, behavior: 'smooth' }); }
    });
  };

  Slider.prototype.buildDots = function () {
    if (!this.dotsWrap) return;
    var self = this;
    var pages = Math.max(1, Math.ceil(this.cells.length / this.perView()));
    this.dotsWrap.innerHTML = '';
    for (var i = 0; i < pages; i++) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'pvr__dot';
      dot.setAttribute('aria-label', 'Go to slide group ' + (i + 1));
      (function (idx) {
        dot.addEventListener('click', function () {
          var oneByOne = window.innerWidth <= 749;
          var perView = self.perView();
          var amount = oneByOne ? (idx * self.step()) : (idx * self.step() * perView);
          self.track.scrollTo({ left: amount, behavior: 'smooth' });
        });
      })(i);
      this.dotsWrap.appendChild(dot);
    }
  };

  Slider.prototype.syncUI = function () {
    var max = this.track.scrollWidth - this.track.clientWidth;
    var left = this.track.scrollLeft;

    if (this.prevBtn && !this.loop) this.prevBtn.disabled = left <= 2;
    if (this.nextBtn && !this.loop) this.nextBtn.disabled = left >= max - 2;

    if (this.dotsWrap) {
      var pv = this.perView();
      var oneByOne = window.innerWidth <= 749;
      var group = oneByOne ? Math.round(left / this.step()) : Math.round(left / (this.step() * pv));
      var dots = this.dotsWrap.children;
      group = Math.max(0, Math.min(dots.length - 1, group));
      for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('is-active', i === group);
    }
    if (this.scrollFill) this.scrollFill.style.width = (max > 0 ? (left / max * 100) : 0) + '%';
    if (this.numCurrent) {
      var idx = Math.round(left / this.step()) + 1;
      this.numCurrent.textContent = Math.min(this.cells.length, Math.max(1, idx));
    }
  };

  Slider.prototype.refresh = function () { this.buildDots(); this.syncUI(); };

  /* ----------------------------------------------------------------- Popup */
  function Popup(section) {
    this.section = section;
    this.el = null;
    this.lastFocus = null;
    this.currentCard = null;
    this.currentCell = null;
    this.muted = false;
    this._ttId = '';
    this._ttSrc = '';
  }

  Popup.prototype.build = function () {
    if (this.el) return;
    var el = document.createElement('div');
    el.className = 'pvr-popup';
    el.hidden = true;
    el.setAttribute('data-uc-reel-modal', '1');
    el.innerHTML =
      '<div class="pvr-popup__backdrop" data-pvr-popup-close></div>' +
      '<div class="pvr-popup__shell">' +
        '<div class="pvr-popup__panel" role="dialog" aria-modal="true" aria-label="Reel" tabindex="-1">' +
          '<div class="pvr-popup__stage">' +
            '<div class="pvr-popup__video" data-pvr-popup-video></div>' +
          '</div>' +
          '<div class="pvr-popup__chrome">' +
            '<button type="button" class="pvr-popup__ctl pvr-popup__ctl--close" data-pvr-popup-close aria-label="Close">' +
              '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
            '</button>' +
            '<button type="button" class="pvr-popup__ctl pvr-popup__ctl--more" data-pvr-popup-more aria-label="More" aria-expanded="false">' +
              '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>' +
            '</button>' +
            '<button type="button" class="pvr-popup__ctl pvr-popup__ctl--share" data-pvr-popup-share aria-label="Share">' +
              '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 4v12M8 8l4-4 4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            '<div class="pvr-popup__nav">' +
              '<button type="button" class="pvr-popup__ctl" data-pvr-popup-prev aria-label="Previous reel">' +
                '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              '</button>' +
              '<button type="button" class="pvr-popup__ctl" data-pvr-popup-next aria-label="Next reel">' +
                '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="pvr-popup__menu" data-pvr-popup-menu hidden>' +
              '<a href="#" data-pvr-popup-external target="_blank" rel="noopener noreferrer">Open original</a>' +
              '<button type="button" data-pvr-popup-copy>Copy link</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    this.el = el;
    this.panel = el.querySelector('.pvr-popup__panel');
    this.videoWrap = el.querySelector('[data-pvr-popup-video]');
    this.menu = el.querySelector('[data-pvr-popup-menu]');
    this.muteBtn = null;
    this.extLink = el.querySelector('[data-pvr-popup-external]');

    /* Block TikTok / browser fullscreen that paints a blurred twin video */
    var selfFs = this;
    if (!this._fsGuard) {
      this._fsGuard = function () {
        var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fsEl) return;
        if (selfFs.el && selfFs.el.contains(fsEl)) {
          var exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (exit) {
            try { exit.call(document); } catch (e) {}
          }
        }
      };
      document.addEventListener('fullscreenchange', this._fsGuard);
      document.addEventListener('webkitfullscreenchange', this._fsGuard);
    }

    var self = this;
    /* Capture phase so controls always win over iframe / nested hits */
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      if (t.closest('[data-pvr-popup-close]')) {
        e.preventDefault();
        e.stopPropagation();
        self.close();
        return;
      }
      if (t.closest('[data-pvr-popup-prev]')) {
        e.preventDefault();
        e.stopPropagation();
        self.step(-1);
        return;
      }
      if (t.closest('[data-pvr-popup-next]')) {
        e.preventDefault();
        e.stopPropagation();
        self.step(1);
        return;
      }
      if (t.closest('[data-pvr-popup-share]')) {
        e.preventDefault();
        e.stopPropagation();
        self.share();
        return;
      }
      if (t.closest('[data-pvr-popup-copy]')) {
        e.preventDefault();
        e.stopPropagation();
        self.copyCurrent();
        self.toggleMenu(false);
        return;
      }
      if (t.closest('[data-pvr-popup-more]')) {
        e.preventDefault();
        e.stopPropagation();
        self.toggleMenu();
        return;
      }
      if (t.closest('[data-pvr-popup-external]')) {
        self.toggleMenu(false);
        return;
      }
      if (!t.closest('.pvr-popup__menu') && !t.closest('[data-pvr-popup-more]')) {
        self.toggleMenu(false);
      }
    }, true);

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') self.close();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); self.step(-1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); self.step(1); }
      else if (e.key === 'Tab') self.trapFocus(e);
    });

    /* Swipe-down to close on mobile/touch devices */
    var swipe = { y0: 0, dy: 0, active: false };
    self.panel.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      swipe.y0 = e.touches[0].clientY;
      swipe.dy = 0;
      swipe.active = true;
    }, { passive: true });
    self.panel.addEventListener('touchmove', function (e) {
      if (!swipe.active || e.touches.length !== 1) return;
      swipe.dy = e.touches[0].clientY - swipe.y0;
      if (swipe.dy > 0) {
        var t = Math.min(swipe.dy, 180);
        var scale = 1 - (t / 180) * 0.08;
        self.panel.style.transform = 'translateY(' + t + 'px) scale(' + scale.toFixed(3) + ')';
        self.panel.style.transition = 'none';
      }
    }, { passive: true });
    self.panel.addEventListener('touchend', function () {
      if (!swipe.active) return;
      swipe.active = false;
      if (swipe.dy > 100) {
        self.close();
      } else {
        self.panel.style.transition = '';
        self.panel.style.transform = '';
      }
    }, { passive: true });
  };

  Popup.prototype.trapFocus = function (e) {
    var nodes = this.panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!nodes.length) return;
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  Popup.prototype.getData = function (cell) {
    var script = cell.querySelector('[data-pvr-data]');
    if (!script) return {};
    try { return JSON.parse(script.textContent); } catch (e) { return {}; }
  };

  Popup.prototype.cells = function () {
    return Array.prototype.slice.call(this.section.querySelectorAll('[data-pvr-cell]'));
  };

  Popup.prototype.open = function (cell, videoCard) {
    this.build();
    this.currentCell = cell;
    this.currentCard = videoCard;
    this.currentData = this.getData(cell);
    this.lastFocus = document.activeElement;
    this.muted = false;
    this.toggleMenu(false);
    try { this.section.pauseAll(); } catch (_) {}

    /* Show shell immediately so mobile never "freezes" waiting on TikTok */
    this.el.hidden = false;
    document.documentElement.classList.add('ch-scroll-locked');
    document.body.style.overflow = 'hidden';
    this.el.classList.add('is-open');
    this.syncChrome();

    var self = this;
    /* Paint poster first, then mount media on next frames */
    this.renderPosterShell(cell);
    var close = this.el.querySelector('[data-pvr-popup-close]');
    if (close) close.focus();

    window.setTimeout(function () {
      self.renderMedia();
      self.ensureSound();
    }, 40);
  };

  Popup.prototype.renderPosterShell = function (cell) {
    if (!this.videoWrap) return;
    if (this._ttResizeObs) {
      try { this._ttResizeObs.disconnect(); } catch (e) {}
      this._ttResizeObs = null;
    }
    this.videoWrap.innerHTML = '';
    this.videoWrap.className = 'pvr-popup__video pvr-popup__video--viewbox pvr-popup__video--loading';
    var poster = cell && cell.querySelector('.pvr-card__poster');
    if (poster && poster.tagName === 'IMG' && poster.getAttribute('src')) {
      var img = document.createElement('img');
      img.className = 'pvr-popup__poster-shell';
      img.src = poster.currentSrc || poster.src;
      img.alt = '';
      this.videoWrap.appendChild(img);
    }
    var spin = document.createElement('div');
    spin.className = 'pvr-popup__loading';
    spin.setAttribute('aria-hidden', 'true');
    spin.textContent = 'Loading';
    this.videoWrap.appendChild(spin);
  };

  Popup.prototype.renderMedia = function () {
    var videoCard = this.currentCard;
    var cell = this.currentCell;
    var data = this.currentData || {};
    if (this._ttResizeObs) {
      try { this._ttResizeObs.disconnect(); } catch (e) {}
      this._ttResizeObs = null;
    }
    this.videoWrap.innerHTML = '';
    this.videoWrap.className = 'pvr-popup__video pvr-popup__video--viewbox';
    this._activeVideo = null;
    this._ttId = '';
    this._ttSrc = '';

    if (videoCard && videoCard.provider && videoCard.provider.type === 'mp4') {
      var selfMp4 = this;
      var v = document.createElement('video');
      v.src = videoCard.provider.src;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.autoplay = true;
      v.loop = true;
      v.muted = false;
      v.defaultMuted = false;
      v.volume = 1;
      v.playsInline = true;
      v.controls = false;
      v.preload = 'auto';
      this.videoWrap.appendChild(v);
      this._activeVideo = v;
      var play = function () {
        v.muted = false;
        var p = v.play();
        if (p && p.catch) {
          /* Gesture may have expired — retry muted then unmute */
          p.catch(function () {
            v.muted = true;
            v.play().then(function () {
              v.muted = false;
            }).catch(function () {});
          });
        }
      };
      if (v.readyState >= 2) play();
      else v.addEventListener('loadeddata', play, { once: true });
      v.addEventListener('ended', function () {
        v.currentTime = 0;
        v.play().catch(function () {});
      });
    } else if (videoCard && videoCard.provider && (videoCard.provider.type === 'youtube' || videoCard.provider.type === 'vimeo')) {
      var iframe = document.createElement('iframe');
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      if (videoCard.provider.type === 'youtube') {
        iframe.src = 'https://www.youtube.com/embed/' + videoCard.provider.id +
          '?autoplay=1&rel=0&playsinline=1&controls=0&loop=1&playlist=' + videoCard.provider.id +
          '&mute=0&fs=0';
      } else {
        iframe.src = 'https://player.vimeo.com/video/' + videoCard.provider.id +
          '?autoplay=1&loop=1&muted=0&controls=0';
      }
      this.videoWrap.appendChild(iframe);
    } else if (videoCard && videoCard.provider && videoCard.provider.type === 'tiktok' && videoCard.provider.id) {
      this._ttId = videoCard.provider.id;
      this._ttSrc = videoCard.provider.src || '';
      this.renderTikTok(this._ttId);
    } else if (videoCard && videoCard.provider && (videoCard.provider.type === 'tiktok' || videoCard.provider.type === 'instagram')) {
      this.renderPosterFallback(cell, data, videoCard.provider.src);
    } else {
      this.renderPosterFallback(cell, data, data.url || '');
    }
  };

  Popup.prototype.ensureSound = function () {
    if (this._activeVideo) {
      this._activeVideo.muted = false;
      this._activeVideo.volume = 1;
      this._activeVideo.play().catch(function () {});
    }
  };

  Popup.prototype.syncChrome = function () {
    var data = this.currentData || {};
    var card = this.currentCard;
    var href = (card && card.provider && card.provider.src) || data.url || location.href;
    if (href && href.charAt(0) === '/') href = location.origin + href;
    if (this.extLink) {
      this.extLink.href = href || '#';
      this.extLink.textContent = (card && card.provider && card.provider.type === 'tiktok')
        ? 'Open on TikTok'
        : 'Open original';
    }
    var cells = this.cells();
    var prev = this.el.querySelector('[data-pvr-popup-prev]');
    var next = this.el.querySelector('[data-pvr-popup-next]');
    var multi = cells.length > 1;
    if (prev) prev.disabled = !multi;
    if (next) next.disabled = !multi;
  };

  Popup.prototype.step = function (dir) {
    var cells = this.cells();
    if (!cells.length) return;
    var idx = cells.indexOf(this.currentCell);
    if (idx < 0) idx = 0;
    var nextIdx = (idx + dir + cells.length) % cells.length;
    var next = cells[nextIdx];
    if (!next || !next._pvrCard) return;
    this.currentCell = next;
    this.currentCard = next._pvrCard;
    this.currentData = this.getData(next);
    this.toggleMenu(false);
    this.renderMedia();
    this.syncChrome();
  };

  Popup.prototype.toggleMenu = function (force) {
    if (!this.menu) return;
    var open = typeof force === 'boolean' ? force : !this.menu.classList.contains('is-open');
    this.menu.classList.toggle('is-open', open);
    this.menu.hidden = !open;
    var more = this.el && this.el.querySelector('[data-pvr-popup-more]');
    if (more) more.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  Popup.prototype.share = function () {
    var data = this.currentData || {};
    var card = this.currentCard;
    var url = (card && card.provider && card.provider.src) ||
      (data.url ? (data.url.charAt(0) === '/' ? location.origin + data.url : data.url) : location.href);
    var title = data.title || 'Reel';
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else {
      this.copyLink(url);
    }
  };

  Popup.prototype.copyCurrent = function () {
    var data = this.currentData || {};
    var card = this.currentCard;
    var url = (card && card.provider && card.provider.src) ||
      (data.url ? (data.url.charAt(0) === '/' ? location.origin + data.url : data.url) : location.href);
    this.copyLink(url);
  };

  Popup.prototype.setMuted = function () { /* sound control removed */ };

  Popup.prototype.syncMuteUi = function () { /* sound control removed */ };

  Popup.prototype.renderTikTok = function (id) {
    var self = this;
    var isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 749px), (pointer: coarse)').matches);
    this.videoWrap.innerHTML = '';
    this.videoWrap.className = 'pvr-popup__video pvr-popup__video--viewbox pvr-popup__video--tiktok';

    /*
      Exact 9:16 contain — no cover crop, no fullscreen.
      Panel itself is phone-sized so TikTok does not paint blur side panels.
    */
    var frame = document.createElement('div');
    frame.className = 'pvr-popup__crop pvr-popup__crop--fit';
    var iframe = document.createElement('iframe');
    iframe.className = 'pvr-popup__crop-iframe';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope';
    iframe.removeAttribute('allowfullscreen');
    iframe.setAttribute('scrolling', 'no');
    iframe.title = 'Reel';
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('loading', 'eager');
    frame.appendChild(iframe);
    this.videoWrap.appendChild(frame);

    function sizeIframe() {
      var box = frame.getBoundingClientRect();
      var w = Math.max(240, Math.round(box.width || self.videoWrap.clientWidth || (isMobile ? 300 : 360)));
      var h = Math.max(420, Math.round(box.height || self.videoWrap.clientHeight || (isMobile ? 520 : 640)));
      var ratio = 9 / 16;
      if (w / h > ratio) w = Math.round(h * ratio);
      else h = Math.round(w / ratio);
      iframe.setAttribute('width', String(w));
      iframe.setAttribute('height', String(h));
      iframe.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;border:0;transform:none;' +
        'pointer-events:auto;background:#050505;max-width:100%;max-height:100%;';
    }

    sizeIframe();

    iframe.src =
      'https://www.tiktok.com/player/v1/' + id +
      '?autoplay=1&loop=1&mute=0&controls=1&progress_bar=1&play_button=1' +
      '&volume_control=1&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&closed_caption=0' +
      '&native_context_menu=0';

    if (this._ttResizeObs) {
      try { this._ttResizeObs.disconnect(); } catch (e) {}
      this._ttResizeObs = null;
    }
    if (typeof ResizeObserver !== 'undefined') {
      this._ttResizeObs = new ResizeObserver(function () {
        sizeIframe();
      });
      this._ttResizeObs.observe(frame);
    } else {
      window.setTimeout(sizeIframe, 80);
      window.setTimeout(sizeIframe, 320);
    }
  };

  Popup.prototype.renderPosterFallback = function (cell, data) {
    var poster = cell && cell.querySelector('.pvr-card__poster');
    if (poster && (poster.currentSrc || poster.src)) {
      var img = document.createElement('img');
      img.src = poster.currentSrc || poster.src;
      img.alt = (data && data.title) || '';
      img.className = 'pvr-popup__poster';
      this.videoWrap.appendChild(img);
    }
  };

  Popup.prototype.copyLink = function (url) {
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { Toast.show('Link copied'); });
    else Toast.show('Link: ' + url);
  };

  Popup.prototype.close = function () {
    if (!this.el) return;
    if (this._ttResizeObs) {
      try { this._ttResizeObs.disconnect(); } catch (e) {}
      this._ttResizeObs = null;
    }
    this.toggleMenu(false);
    /* Reset any swipe-drag transform before animating out */
    if (this.panel) {
      this.panel.style.transition = '';
      this.panel.style.transform = '';
    }
    this.el.classList.remove('is-open');
    document.documentElement.classList.remove('ch-scroll-locked');
    document.body.style.overflow = '';
    var self = this;
    setTimeout(function () {
      self.el.hidden = true;
      self.videoWrap.innerHTML = '';
    }, 280);
    if (this.lastFocus && this.lastFocus.focus) {
      try { this.lastFocus.focus(); } catch (_) {}
    }
    if (this.section && !this.section.isMobile) {
      this.section.resumeActive();
    }
  };

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  /* --------------------------------------------------- Custom element root */
  function whenIdle(fn) {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 800 });
    else setTimeout(fn, 200);
  }

  var PremiumVideoReels = function () {};

  if (typeof window.HTMLElement === 'function') {
    PremiumVideoReels = class extends HTMLElement {
      connectedCallback() {
        if (this._init) return;
        this._init = true;
        this.autoplay = this.getAttribute('data-autoplay') === 'true';
        /* Premium lightbox for social (TikTok/IG) — never mount platform chrome in-card */
        this.popupEnabled = this.getAttribute('data-popup') !== 'false';
        this.cards = [];
        this.visible = [];
        this.popup = new Popup(this);
        this.setup();
      }

      setup() {
        var self = this;
        this.isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 749px), (pointer: coarse)').matches);
        /* On phones: never autoplay carousel (prevents freeze); open with sound on tap */
        if (this.isMobile) this.autoplay = false;
        var cells = Array.prototype.slice.call(this.querySelectorAll('[data-pvr-cell]'));
        cells.forEach(function (cell) {
          var card = new VideoCard(cell, self);
          cell._pvrCard = card;
          self.cards.push(card);
          card.resolveThumbnail();
          self.bindProduct(cell);
        });

        this.slider = new Slider(this);
        this.observeVideos();
        this.observeReveal();
        this.bindResize();
        this.bindVisibility();
        this.bindInlineControls();

        /* Always allow lightbox for social / embeds (needed on mobile) */
        this.popupEnabled = true;
        this.querySelectorAll('[data-pvr-open]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var cell = btn.closest('[data-pvr-cell]');
            if (cell && cell._pvrCard) self.popup.open(cell, cell._pvrCard);
          });
        });
      }

      _limitPlaying(activeCard) {
        var max = this.isMobile ? 1 : 2;
        var playing = [];
        this.cards.forEach(function (c) {
          if (c.video && !c.video.paused) playing.push(c);
        });
        if (playing.indexOf(activeCard) === -1) playing.push(activeCard);
        while (playing.length > max) {
          var victim = playing.shift();
          if (victim && victim !== activeCard) victim.pause();
        }
      }

      bindInlineControls() {
        var self = this;
        this.querySelectorAll('[data-pvr-cell]').forEach(function (cell) {
          if (cell.dataset.pvrInlineBound === '1') return;
          cell.dataset.pvrInlineBound = '1';

          var toggle = cell.querySelector('[data-pvr-toggle]');
          var muteBtn = cell.querySelector('[data-pvr-mute]');
          var card = cell._pvrCard;
          if (!card) return;

          card.syncMuteUi();

          if (toggle) {
            toggle.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              /* Social embeds: open premium viewer with sound */
              if (card.isSocial && card.isSocial()) {
                self.popup.open(cell, card);
                return;
              }
              if (!(card.provider && card.provider.type === 'mp4')) {
                self.popup.open(cell, card);
                return;
              }
              card.setMuted(false);
              card.toggle();
            });
          }

          if (muteBtn) {
            muteBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              card.setMuted(!card.muted);
            });
          }

          /* Tap media (not product/links) */
          var media = cell.querySelector('[data-pvr-media]');
          if (media) {
            media.addEventListener('click', function (e) {
              if (e.target.closest('a, button, form, .pvr-card__product')) return;
              e.preventDefault();
              if (card.isSocial && card.isSocial()) {
                self.popup.open(cell, card);
                return;
              }
              if (card.provider && card.provider.type === 'mp4') {
                card.setMuted(false);
                card.toggle();
                return;
              }
              self.popup.open(cell, card);
            });
          }
        });
      }

      bindProduct(cell) {
        var self = this;
        var form = cell.querySelector('form[data-type="add-to-cart-form"]');
        if (!form) return;
        var addBtn = form.querySelector('[data-pvr-add]');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var variant = form.querySelector('[data-pvr-variant]');
          self.addToCart(variant ? variant.value : null, 1, addBtn);
        });
      }

      addToCart(variantId, qty, btn) {
        if (!variantId) return;
        if (btn) {
          btn.classList.add('is-loading');
          btn.disabled = true;
          this._toggleBtnParts(btn, 'spin');
        }
        var self = this;
        Cart.add(variantId, qty, { openDrawer: true })
          .then(function (cart) {
            if (btn) {
              btn.classList.remove('is-loading');
              btn.classList.add('is-success');
              self._toggleBtnParts(btn, 'done');
              setTimeout(function () {
                btn.classList.remove('is-success');
                btn.disabled = false;
                self._toggleBtnParts(btn, 'text');
              }, 1600);
            }
            /* UCCart.addItems already refreshes drawer/badges; legacy path still publishes */
            if (cart && !(window.UCCart && window.UCCart.addItems)) {
              return Cart.fetchCart().then(function (full) {
                if (full) Cart.publish(full);
                Cart.openDrawer();
                Utils.vibrate(15);
                Toast.show('Added to cart');
              });
            }
            Utils.vibrate(15);
            Toast.show('Added to cart');
          })
          .catch(function (err) {
            if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; self._toggleBtnParts(btn, 'text'); }
            Toast.show((err && err.description) || 'Could not add to cart', true);
          });
      }

      _toggleBtnParts(btn, show) {
        var spin = btn.querySelector('.pvr-btn__spin');
        var done = btn.querySelector('.pvr-btn__done');
        if (spin) spin.hidden = show !== 'spin';
        if (done) done.hidden = show !== 'done';
      }

      observeVideos() {
        var self = this;
        if (!('IntersectionObserver' in window)) {
          this.cards.forEach(function (c) {
            /* Posters only on fallback — wait for tap */
            if (!c.isSocial || !c.isSocial()) c.mount();
          });
          return;
        }

        /* Light preload — avoid mounting a wall of videos on phones */
        var preloadMargin = self.isMobile ? '80px 0px' : '240px 0px';
        this.preloadIo = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              var card = entry.target._pvrCard;
              if (!card || !entry.isIntersecting) return;
              if (card.isSocial && card.isSocial()) return;
              if (self.isMobile) return;
              if (!card.mounted) card.mount();
            });
          },
          { rootMargin: preloadMargin, threshold: 0.01 }
        );

        this.io = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              var card = entry.target._pvrCard;
              if (!card) return;
              if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
                card.card.classList.add('is-active');
                if (self.visible.indexOf(card) === -1) self.visible.push(card);
                /* Mobile / social: never autoplay — tap opens with sound */
                if (self.isMobile) return;
                if (card.isSocial && card.isSocial()) return;
                if (!card.mounted) card.mount();
                if (self.autoplay && card.canAutoplay) card.play();
              } else if (entry.intersectionRatio < 0.2) {
                card.pause();
                card.card.classList.remove('is-active');
                var i = self.visible.indexOf(card);
                if (i !== -1) self.visible.splice(i, 1);
              }
            });
          },
          { threshold: [0, 0.2, 0.45, 0.75, 1], rootMargin: self.isMobile ? '40px 0px' : '80px 0px' }
        );

        this.cards.forEach(function (c) {
          self.preloadIo.observe(c.cell);
          self.io.observe(c.cell);
        });

        /* Desktop only: warm first card */
        if (!this.isMobile && this.cards[0] && !(this.cards[0].isSocial && this.cards[0].isSocial())) {
          if (!this.cards[0].mounted) this.cards[0].mount();
        }
      }

      pauseAll() {
        this.cards.forEach(function (c) { c.pause(); });
      }

      resumeActive() {
        var self = this;
        if (!this.autoplay || this.isMobile) return;
        this.visible.forEach(function (c) {
          if (c.isSocial && c.isSocial()) return;
          if (c.canAutoplay) c.play();
        });
      }

      observeReveal() {
        var self = this;
        if (Utils.reduced || !('IntersectionObserver' in window)) { this.classList.add('is-revealed'); return; }
        var ro = new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) { self.classList.add('is-revealed'); obs.disconnect(); }
          });
        }, { threshold: 0.1 });
        ro.observe(this);
      }

      bindResize() {
        var self = this;
        var handler = Utils.debounce(function () { if (self.slider) self.slider.refresh(); }, 180);
        if ('ResizeObserver' in window) {
          this._ro = new ResizeObserver(handler);
          this._ro.observe(this);
        } else {
          window.addEventListener('resize', handler, { passive: true });
        }
      }

      bindVisibility() {
        var self = this;
        document.addEventListener('visibilitychange', function () {
          if (document.hidden) self.pauseAll();
          else self.resumeActive();
        });
      }

      disconnectedCallback() {
        this.pauseAll();
        if (this.io) this.io.disconnect();
        if (this.preloadIo) this.preloadIo.disconnect();
        if (this._ro) this._ro.disconnect();
        if (this.popup && this.popup._ttResizeObs) {
          try { this.popup._ttResizeObs.disconnect(); } catch (_) {}
        }
      }
    };
  }

  if (!customElements.get('premium-video-reels')) {
    customElements.define('premium-video-reels', PremiumVideoReels);
  }

  // Theme editor: re-init on section load (element upgrade handles most).
  document.addEventListener('shopify:section:load', function (e) {
    var el = e.target.querySelector('premium-video-reels');
    if (el && el.connectedCallback && !el._init) el.connectedCallback();
  });
})();

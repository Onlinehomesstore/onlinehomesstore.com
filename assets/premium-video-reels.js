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

    extractTikTokId: function (url) {
      if (!url) return '';
      var raw = String(url).trim();
      var path = raw.split('#')[0].split('?')[0];
      var m = path.match(/\/video\/(\d{8,})/i) ||
        path.match(/\/photo\/(\d{8,})/i) ||
        path.match(/\/embed\/v2\/(\d{8,})/i) ||
        path.match(/\/embed\/(\d{8,})/i) ||
        path.match(/\/v\/(\d{8,})/i);
      if (m) return m[1];
      var q = raw.match(/[?&]item_id=(\d{8,})/i);
      if (q) return q[1];
      m = raw.match(/data-video-id=["'](\d{8,})["']/i);
      return m ? m[1] : '';
    },

    _tikTokIdCache: {},
    _thumbCache: {},
    _oembedCache: {},
    _queue: [],
    _queueActive: 0,
    _queueMax: 6,
    _tikwmCache: {},
    _tikwmQueue: [],
    _tikwmBusy: false,

    enqueueNet: function (fn) {
      var self = this;
      return new Promise(function (resolve, reject) {
        self._queue.push(function () {
          return Promise.resolve().then(fn).then(resolve, reject);
        });
        self._drainQueue();
      });
    },

    _drainQueue: function () {
      while (this._queueActive < this._queueMax && this._queue.length) {
        var job = this._queue.shift();
        if (!job) return;
        this._queueActive += 1;
        job().finally(function () {
          Utils._queueActive -= 1;
          Utils._drainQueue();
        });
      }
    },

    tikTokCanonicalUrl: function (id, href) {
      var cleanId = String(id || '').replace(/\D/g, '');
      if (cleanId) return 'https://www.tiktok.com/video/' + cleanId;
      return this.normalizeTikTokUrl(href || '') || String(href || '').trim();
    },

    isShortTikTok: function (url) {
      return /\/\/(?:vm|vt)\.tiktok\.com\//i.test(String(url || ''));
    },

    ttStorageKey: function (url) {
      return 'pvr-tt-id:' + String(url || '').trim().split('#')[0];
    },

    recallTikTokId: function (url) {
      var mem = this._tikTokIdCache[String(url || '').trim().split('#')[0]];
      if (mem && typeof mem === 'string' && mem.length >= 8) return mem;
      try {
        var stored = window.sessionStorage.getItem(this.ttStorageKey(url));
        if (stored && /^\d{8,}$/.test(stored)) return stored;
      } catch (e) {}
      return '';
    },

    rememberTikTokId: function (url, id) {
      var cleanId = String(id || '').replace(/\D/g, '');
      if (!url || !cleanId) return;
      var key = String(url).trim().split('#')[0];
      this._tikTokIdCache[key] = cleanId;
      try { window.sessionStorage.setItem(this.ttStorageKey(url), cleanId); } catch (e) {}
    },

    parseOembedId: function (data) {
      if (!data) return '';
      if (data.html) {
        var hm = String(data.html).match(/data-video-id=["'](\d{8,})["']/i);
        if (hm) return hm[1];
        var fromHtml = this.extractTikTokId(data.html);
        if (fromHtml) return fromHtml;
      }
      if (data.embed_product_id) return String(data.embed_product_id).replace(/\D/g, '');
      return this.extractTikTokId(data.author_url || data.url || '') || '';
    },

    cacheOembedThumb: function (id, data) {
      var thumb = this.parseOEmbedThumb(data);
      if (!id || !thumb) return;
      this._thumbCache['tt:' + id] = Promise.resolve(thumb);
    },

    parseFetchBody: function (res) {
      if (!res || !res.ok) throw new Error('oembed ' + (res && res.status));
      var type = (res.headers.get('content-type') || '').toLowerCase();
      if (type.indexOf('json') !== -1) return res.json();
      return res.text();
    },

    coerceOembed: function (data) {
      if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return { html: data }; }
      }
      return data;
    },

    fetchOEmbedImmediate: function (endpoint) {
      var self = this;
      if (!endpoint) return Promise.resolve(null);
      if (self._oembedCache[endpoint]) return self._oembedCache[endpoint];
      var p = fetch(endpoint, { method: 'GET', credentials: 'omit', mode: 'cors' })
        .then(function (res) { return self.parseFetchBody(res); })
        .then(function (data) { return self.coerceOembed(data); })
        .catch(function () { return null; });
      self._oembedCache[endpoint] = p;
      return p;
    },

    fetchOEmbedJson: function (endpoint) {
      var self = this;
      if (!endpoint) return Promise.resolve(null);
      if (self._oembedCache[endpoint]) return self._oembedCache[endpoint];
      var p = self.enqueueNet(function () {
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
        var opts = { method: 'GET', credentials: 'omit', mode: 'cors' };
        if (ctrl) opts.signal = ctrl.signal;
        return fetch(endpoint, opts)
          .then(function (res) { return self.parseFetchBody(res); })
          .then(function (data) { clearTimeout(timer); return self.coerceOembed(data); })
          .catch(function (err) { clearTimeout(timer); throw err; });
      }).catch(function () { return null; });
      self._oembedCache[endpoint] = p;
      return p;
    },

    normalizeTikTokUrl: function (url) {
      if (!url) return '';
      var s = String(url).trim().split('#')[0];
      var id = this.extractTikTokId(s);
      if (!id) return s;
      return 'https://www.tiktok.com/video/' + id;
    },

    isTikTokUrl: function (url) {
      return /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i.test(String(url || ''));
    },

    isInstagramUrl: function (url) {
      return /instagram\.com\/(?:reel|p|tv)\//i.test(String(url || ''));
    },

    tikTokIdFromCell: function (cell, card) {
      var href = '';
      if (cell) href = (cell.getAttribute('data-video-url') || '').trim();
      var fromUrl = this.extractTikTokId(href) || this.extractTikTokId(card && card.externalUrl);
      var dataId = cell ? (cell.getAttribute('data-video-id') || '').replace(/\D/g, '') : '';
      var fromCard = card && card.provider && card.provider.id
        ? String(card.provider.id).replace(/\D/g, '')
        : '';
      return fromUrl || dataId || fromCard || this.recallTikTokId(href) || '';
    },

    fetchTikTokId: function (url) {
      var self = this;
      if (!url || !this.isTikTokUrl(url)) return Promise.resolve('');
      var cleanUrl = String(url).trim().split('#')[0];
      var cached = this.extractTikTokId(cleanUrl) || this.recallTikTokId(cleanUrl);
      if (cached) {
        this.rememberTikTokId(cleanUrl, cached);
        return Promise.resolve(cached);
      }
      return this.fetchTikwm(cleanUrl).then(function (meta) {
        var id = (meta && meta.id) || self.extractTikTokId(cleanUrl) || '';
        if (id) self.rememberTikTokId(cleanUrl, id);
        return id;
      });
    },

    tikwmKey: function (url) {
      return String(url || '').trim().split('#')[0];
    },

    readThumbStore: function (key) {
      try { return window.localStorage.getItem('pvr-ttmeta:' + key) || ''; } catch (e) { return ''; }
    },

    writeThumbStore: function (key, value) {
      try { window.localStorage.setItem('pvr-ttmeta:' + key, value); } catch (e) {}
    },

    /* One paced TikTok metadata lookup. Official oEmbed hangs or is CORS-blocked,
       and noembed does not serve TikTok, which left most reel cards black. */
    _bumpTikwm: function (key) {
      var queue = this._tikwmQueue;
      for (var i = 1; i < queue.length; i++) {
        if (queue[i].url === key) {
          queue.unshift(queue.splice(i, 1)[0]);
          return;
        }
      }
    },

    fetchTikwm: function (url, priority) {
      var self = this;
      var key = this.tikwmKey(url);
      if (!key) return Promise.resolve(null);
      if (this._tikwmCache[key]) {
        if (priority) this._bumpTikwm(key);
        return this._tikwmCache[key];
      }

      var stored = this.readThumbStore(key);
      if (stored) {
        try {
          var parsed = JSON.parse(stored);
          if (parsed && (parsed.cover || parsed.id)) {
            var hit = Promise.resolve(parsed);
            this._tikwmCache[key] = hit;
            return hit;
          }
        } catch (e) {}
      }

      var promise = new Promise(function (resolve) {
        var job = { url: key, resolve: resolve, tries: 0 };
        if (priority) self._tikwmQueue.unshift(job);
        else self._tikwmQueue.push(job);
        self._pumpTikwm();
      });
      this._tikwmCache[key] = promise;
      return promise;
    },

    _pumpTikwm: function () {
      var self = this;
      if (this._tikwmBusy || !this._tikwmQueue.length) return;
      this._tikwmBusy = true;
      var job = this._tikwmQueue.shift();
      var endpoint = 'https://www.tikwm.com/api/?url=' + encodeURIComponent(job.url);
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
      var opts = { credentials: 'omit', mode: 'cors' };
      if (ctrl) opts.signal = ctrl.signal;

      var release = function (wait) {
        setTimeout(function () {
          self._tikwmBusy = false;
          self._pumpTikwm();
        }, wait == null ? 1150 : wait);
      };

      fetch(endpoint, opts).then(function (r) {
        return r.json();
      }).then(function (j) {
        clearTimeout(timer);
        var msg = (j && j.msg) || '';
        if (j && j.code === -1 && /limit/i.test(msg)) {
          job.tries += 1;
          if (job.tries < 6) self._tikwmQueue.unshift(job);
          else job.resolve(null);
          release(1400);
          return;
        }
        var d = j && j.data;
        if (!d) {
          job.tries += 1;
          if (job.tries < 3) self._tikwmQueue.push(job);
          else job.resolve(null);
          release(1150);
          return;
        }
        /* Static JPEG only. ai_dynamic_cover is an animated clip and reads as a playing video. */
        var cover = d.cover || d.origin_cover || '';
        if (/\.mp4(\?|$)/i.test(cover) || /mime_type=video/i.test(cover)) cover = d.origin_cover || '';
        var id = d.id ? String(d.id) : '';
        if (id) self.rememberTikTokId(job.url, id);
        var result = { id: id, cover: cover || '' };
        if (result.cover || result.id) self.writeThumbStore(job.url, JSON.stringify(result));
        job.resolve(result);
        release(1000);
      }).catch(function () {
        clearTimeout(timer);
        job.tries += 1;
        if (job.tries < 3) self._tikwmQueue.push(job);
        else job.resolve(null);
        release(1150);
      });
    },

    _pickCover: function (covers) {
      var self = this;
      var next = function (i) {
        if (!covers || i >= covers.length) return Promise.resolve(null);
        return self.probeImage(covers[i]).then(function (hit) {
          return hit || next(i + 1);
        });
      };
      return next(0);
    },

    extractInstagramId: function (url) {
      if (!url) return '';
      var m = String(url).match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i);
      return m ? m[1] : '';
    },

    /* Detect a video provider from an external URL. */
    parseProvider: function (url) {
      if (!url) return null;
      url = url.trim();

      var yt = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
      if (yt) return { type: 'youtube', id: yt[1], src: url };

      var vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
      if (vm) return { type: 'vimeo', id: vm[1], src: url };

      if (/\.mp4(\?|#|$)/i.test(url) || /\.webm(\?|#|$)/i.test(url)) return { type: 'mp4', src: url };

      if (/tiktok\.com/i.test(url) || /vm\.tiktok\.com/i.test(url) || /vt\.tiktok\.com/i.test(url)) {
        return { type: 'tiktok', id: this.extractTikTokId(url), src: url };
      }

      if (/instagram\.com\/(?:reel|p|tv)\//i.test(url)) {
        return { type: 'instagram', id: this.extractInstagramId(url), src: url };
      }

      var ttId = this.extractTikTokId(url);
      if (ttId) return { type: 'tiktok', id: ttId, src: url };

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
      var thumb =
        data.thumbnail_url ||
        data.thumbnail_url_with_play_button ||
        data.thumbnail ||
        (data.image && (data.image.url || data.image)) ||
        null;
      if (thumb) return thumb;
      if (data.html && typeof data.html === 'string') {
        var match = data.html.match(/poster=["']([^"']+)["']/) ||
          data.html.match(/https?:\/\/[^"' ]+\.(?:jpg|jpeg|png|webp)/i);
        if (match) return match[1] || match[0];
      }
      return null;
    },

    /* Auto-fetch platform thumbnails (YouTube / Vimeo / TikTok / Instagram). */
    probeImage: function (url) {
      return new Promise(function (resolve) {
        if (!url) { resolve(null); return; }
        var img = new Image();
        var done = function (ok) {
          img.onload = null;
          img.onerror = null;
          resolve(ok && img.naturalWidth > 80 ? url : null);
        };
        img.onload = function () { done(true); };
        img.onerror = function () { done(false); };
        img.referrerPolicy = 'no-referrer';
        img.src = url;
      });
    },

    fetchThumbnail: function (provider, url) {
      if (!provider) return Promise.resolve(null);
      var self = this;
      var clean = url ? String(url).split('?')[0].replace(/\/$/, '') : '';

      if (provider.type === 'youtube' && provider.id) {
        var yt = [
          'https://i.ytimg.com/vi/' + provider.id + '/maxresdefault.jpg',
          'https://i.ytimg.com/vi/' + provider.id + '/sddefault.jpg',
          'https://i.ytimg.com/vi/' + provider.id + '/hqdefault.jpg',
          'https://img.youtube.com/vi/' + provider.id + '/hqdefault.jpg',
        ];
        var nextYt = function (i) {
          if (i >= yt.length) return Promise.resolve(null);
          return self.probeImage(yt[i]).then(function (hit) {
            return hit || nextYt(i + 1);
          });
        };
        return nextYt(0);
      }

      if (provider.type === 'vimeo' && provider.id) {
        return self.probeImage('https://vumbnail.com/' + provider.id + '.jpg').then(function (hit) {
          return hit || 'https://vumbnail.com/' + provider.id + '.jpg';
        });
      }

      if (provider.type === 'tiktok') {
        var ttSrc = url || clean;
        var ttKey = 'tt:' + (provider.id || self.tikwmKey(ttSrc));
        if (self._thumbCache[ttKey]) return self._thumbCache[ttKey];
        var ttPromise = self.fetchTikwm(ttSrc, true).then(function (meta) {
          if (meta && meta.id) provider.id = meta.id;
          return (meta && meta.cover) || null;
        });
        self._thumbCache[ttKey] = ttPromise;
        return ttPromise;
      }

      if (provider.type === 'instagram' && clean) {
        var cacheKey = 'ig:' + (provider.id || clean);
        if (self._thumbCache[cacheKey]) return self._thumbCache[cacheKey];

        var oembedIg = 'https://www.instagram.com/api/v1/oembed/?url=' + encodeURIComponent(clean) + '&hidecaption=1';
        var endpoints = [
          'https://noembed.com/embed?url=' + encodeURIComponent(clean),
          oembedIg,
          'https://api.instagram.com/oembed?url=' + encodeURIComponent(clean)
        ];

        var tryNext = function (i) {
          if (i >= endpoints.length) return Promise.resolve(null);
          return self.fetchOEmbedJson(endpoints[i]).then(function (data) {
            var thumb = self.parseOEmbedThumb(data);
            if (thumb) return thumb;
            return tryNext(i + 1);
          });
        };

        var promise = tryNext(0);
        self._thumbCache[cacheKey] = promise;
        return promise;
      }

      return Promise.resolve(null);
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

    fetchCart: function () {
      if (window.UCCart && typeof window.UCCart.fetchCartJson === 'function') {
        return window.UCCart.fetchCartJson();
      }
      return fetch(Utils.root() + 'cart.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; });
    },

    add: function (variantId, quantity, options) {
      if (window.UCCart && typeof window.UCCart.addItems === 'function') {
        return window.UCCart.addItems(
          [{ id: Number(variantId), quantity: quantity || 1 }],
          'premium-video-reels'
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
    this.shopifySrc = (cell.getAttribute('data-video-shopify') || '').trim();
    this.externalUrl = (cell.getAttribute('data-video-url') || '').trim();
    if (this.shopifySrc && Utils.isTikTokUrl(this.externalUrl)) {
      this.provider = Utils.parseProvider(this.externalUrl);
    } else {
      this.provider = this.shopifySrc
        ? { type: 'mp4', src: this.shopifySrc }
        : Utils.parseProvider(this.externalUrl);
    }
    var dataProv = (cell.getAttribute('data-video-provider') || '').toLowerCase();
    var dataId = (cell.getAttribute('data-video-id') || '').replace(/\D/g, '');
    if (dataProv === 'tiktok' || Utils.isTikTokUrl(this.externalUrl)) {
      this.provider = {
        type: 'tiktok',
        id: dataId || Utils.extractTikTokId(this.externalUrl) || (this.provider && this.provider.id) || '',
        src: this.externalUrl || (this.provider && this.provider.src) || ''
      };
    } else if (dataProv === 'instagram') {
      this.provider = {
        type: 'instagram',
        id: dataId || Utils.extractInstagramId(this.externalUrl),
        src: this.externalUrl
      };
    } else if (dataProv === 'youtube' && dataId) {
      this.provider = { type: 'youtube', id: dataId, src: this.externalUrl };
    } else if (dataProv === 'vimeo' && dataId) {
      this.provider = { type: 'vimeo', id: dataId, src: this.externalUrl };
    } else if (this.provider && this.provider.type === 'tiktok' && !this.provider.id) {
      this.provider.id = (dataId.match(/\d{8,}/) || [])[0] || Utils.extractTikTokId(this.externalUrl);
    }
    this.muted = cell.getAttribute('data-muted-block') === 'true';
    this.canAutoplay = cell.getAttribute('data-autoplay-block') !== 'false' && section.autoplay;
    this.video = null;
    this.mounted = false;
    this.rafId = null;
    if (this.provider && this.provider.type === 'tiktok' && !this.provider.id) {
      this.provider.id = Utils.recallTikTokId(this.externalUrl) || '';
      if (this.provider.id) cell.setAttribute('data-video-id', this.provider.id);
    }
    if (this.isSocial()) this.card.classList.add('is-social');
  }

  VideoCard.prototype.ensureTikTokId = function () {
    if (!this.provider || this.provider.type !== 'tiktok') return Promise.resolve('');
    if (this.provider.id) return Promise.resolve(this.provider.id);
    if (this._idPromise) return this._idPromise;
    var self = this;
    this._idPromise = Utils.fetchTikTokId(this.externalUrl).then(function (id) {
      if (id) {
        self.provider.id = id;
        if (self.cell) self.cell.setAttribute('data-video-id', id);
        var poster = self.cell && self.cell.querySelector('.pvr-card__poster');
        if (poster && poster.getAttribute('data-poster-pending') === 'true') {
          self._thumbResolved = false;
          self.resolveThumbnail();
        }
      }
      return id || '';
    });
    return this._idPromise;
  };

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

    /* Social reels: poster + popup only — never mount TikTok/IG iframes in carousel */
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
      iframe.allow = 'autoplay; encrypted-media; fullscreen';
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

  VideoCard.prototype.getFallbackImage = function () {
    if (!this.cell) return '';
    return (this.cell.getAttribute('data-fallback-image') || '').trim();
  };

  VideoCard.prototype.applyFallbackPoster = function () {
    var url = this.getFallbackImage();
    if (!url) return false;

    var media = this.cell && this.cell.querySelector('[data-pvr-media]');
    if (!media) return false;

    var poster = this.cell.querySelector('.pvr-card__poster');
    if (!poster || poster.tagName !== 'IMG') {
      poster = document.createElement('img');
      poster.className = 'pvr-card__poster';
      media.insertBefore(poster, media.firstChild);
    }

    var self = this;
    poster.removeAttribute('hidden');
    poster.classList.remove('pvr-card__poster--pending', 'pvr-card__poster--empty');
    poster.removeAttribute('data-poster-pending');
    poster.setAttribute('data-thumb-resolved', 'true');
    poster.setAttribute('referrerpolicy', 'no-referrer');
    poster.removeAttribute('crossorigin');
    poster.addEventListener('error', function () { self.showPlaceholder(true); }, { once: true });
    poster.addEventListener('load', function () {
      if (self.media) self.media.classList.remove('is-placeholder');
      self.markLoaded();
    }, { once: true });
    poster.src = url;
    return true;
  };

  VideoCard.prototype.captureMp4Frame = function () {
    var src = this.shopifySrc || (this.provider && this.provider.type === 'mp4' && this.provider.src) || '';
    if (!src) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      var done = false;
      var finish = function (url) {
        if (done) return;
        done = true;
        try {
          v.removeAttribute('src');
          v.load();
        } catch (e) {}
        resolve(url || null);
      };
      var timer = setTimeout(function () { finish(null); }, 4500);
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      v.addEventListener('error', function () {
        clearTimeout(timer);
        finish(null);
      }, { once: true });
      var grab = function () {
        clearTimeout(timer);
        try {
          if (!v.videoWidth) { finish(null); return; }
          var c = document.createElement('canvas');
          c.width = Math.min(480, v.videoWidth);
          c.height = Math.max(1, Math.round(c.width * (v.videoHeight / v.videoWidth)));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          finish(c.toDataURL('image/jpeg', 0.74));
        } catch (e) {
          finish(null);
        }
      };
      v.addEventListener('seeked', grab, { once: true });
      v.addEventListener('loadeddata', function () {
        try {
          var t = 0.35;
          if (v.duration && isFinite(v.duration)) t = Math.min(0.6, Math.max(0.12, v.duration * 0.08));
          v.currentTime = t;
        } catch (e) {
          grab();
        }
      }, { once: true });
      v.src = src;
    });
  };

  VideoCard.prototype.showPlaceholder = function (skipFallback) {
    if (!skipFallback && this.applyFallbackPoster()) return;

    var editorSlot = this.cell && this.cell.querySelector('[data-pvr-editor-slot]');
    if (editorSlot) {
      editorSlot.hidden = false;
      if (this.media) this.media.classList.remove('is-placeholder');
      this.markLoaded();
      return;
    }
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
    var editorSlot = this.cell.querySelector('[data-pvr-editor-slot]');
    if (editorSlot) {
      this.markLoaded();
      return;
    }
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

    // Poster already resolved server-side (manual, Shopify preview, product image).
    if (poster && poster.tagName === 'IMG' && hasValidSrc(poster) && poster.getAttribute('data-poster-pending') !== 'true') {
      poster.addEventListener('error', function () {
        self._fetchRemoteThumb(poster);
      }, { once: true });
      poster.addEventListener('load', revealPoster, { once: true });
      if (poster.complete && poster.naturalWidth > 0) {
        revealPoster();
      } else if (poster.complete && poster.naturalWidth === 0 && hasValidSrc(poster)) {
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
      if (!url) {
        if (self.applyFallbackPoster()) return;
        self.showPlaceholder(true);
        return;
      }
      poster.removeAttribute('hidden');
      poster.setAttribute('referrerpolicy', 'no-referrer');
      /* Do NOT set crossorigin — TikTok/CDN thumbs often lack CORS and fail to paint */
      poster.removeAttribute('crossorigin');
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

    var finishEmpty = function () {
      self.captureMp4Frame().then(function (frame) {
        if (frame) {
          setPoster(frame);
          return;
        }
        if (self.applyFallbackPoster()) return;
        self.showPlaceholder(true);
      });
    };

    if (this.provider && this.provider.type === 'tiktok') {
      var cellTtId = (this.cell.getAttribute('data-video-id') || '').replace(/\D/g, '');
      if (cellTtId && cellTtId.length >= 8) this.provider.id = cellTtId;
    }

    if (this.cell.getAttribute('data-thumb-auto') !== 'true') {
      finishEmpty();
      return;
    }

    Utils.fetchThumbnail(this.provider, this.externalUrl).then(function (thumb) {
      if (!poster.isConnected) return;
      if (thumb) setPoster(thumb);
      else finishEmpty();
    }).catch(function () { finishEmpty(); });
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

  Slider.prototype.pageCount = function () {
    var pv = this.perView();
    if (window.innerWidth <= 749 && pv > 1) {
      return Math.max(1, this.cells.length - pv + 1);
    }
    return Math.max(1, Math.ceil(this.cells.length / pv));
  };

  Slider.prototype.buildDots = function () {
    if (!this.dotsWrap) return;
    var self = this;
    var pages = this.pageCount();
    this.dotsWrap.innerHTML = '';
    this.dotsWrap.hidden = pages <= 1;
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
      '<div class="pvr-popup__fs-bleed" aria-hidden="true">' +
        '<img class="pvr-popup__fs-bleed-img" alt="">' +
      '</div>' +
      '<div class="pvr-popup__shell">' +
        '<button type="button" class="pvr-popup__ctl pvr-popup__ctl--rail" data-pvr-popup-prev aria-label="Previous reel">' +
          '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<div class="pvr-popup__panel" role="dialog" aria-modal="true" aria-label="Reel" tabindex="-1">' +
          '<div class="pvr-popup__stage">' +
            '<div class="pvr-popup__video" data-pvr-popup-video></div>' +
          '</div>' +
          '<div class="pvr-popup__chrome">' +
            '<button type="button" class="pvr-popup__ctl pvr-popup__ctl--close" data-pvr-popup-close aria-label="Close">' +
              '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="pvr-popup__ctl pvr-popup__ctl--rail" data-pvr-popup-next aria-label="Next reel">' +
          '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(el);
    this.el = el;
    this.panel = el.querySelector('.pvr-popup__panel');
    this.videoWrap = el.querySelector('[data-pvr-popup-video]');
    this.menu = null;
    this.muteBtn = null;
    this.extLink = null;
    var self = this;
    if (!this._fsSync) {
      this._fsSync = function () {
        var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        var iframe = self._ttIframe;
        var iframeFs = !!(iframe && fsEl && (fsEl === iframe || (iframe.contains && iframe.contains(fsEl))));
        var overlayFs = !!(self.el && fsEl && (fsEl === self.el || fsEl === self.panel));
        self._ownFs = overlayFs;
        if (self.el) self.el.classList.toggle('is-own-fs', overlayFs);
        document.documentElement.classList.toggle('pvr-iframe-fs', overlayFs);
        if (iframeFs && !overlayFs && !self._fsIgnore) {
          self._fsIgnore = true;
          var exit = document.exitFullscreen || document.webkitExitFullscreen;
          try { if (exit) exit.call(document); } catch (err) {}
          window.setTimeout(function () { self._fsIgnore = false; }, 120);
          return;
        }
        if (overlayFs) {
          self.freezeBackground();
          self.syncBleed();
        }
      };
      document.addEventListener('fullscreenchange', this._fsSync);
      document.addEventListener('webkitfullscreenchange', this._fsSync);
    }
    if (!this._pipBlock) {
      this._pipBlock = function (e) {
        try { e.preventDefault(); } catch (_) {}
        try {
          if (document.pictureInPictureElement && document.exitPictureInPicture) {
            document.exitPictureInPicture();
          }
        } catch (_) {}
      };
      document.addEventListener('enterpictureinpicture', this._pipBlock, true);
    }
    /* Capture phase so controls always win over iframe / nested hits */
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      if (t.closest('[data-pvr-popup-fs]')) {
        e.preventDefault();
        e.stopPropagation();
        self.toggleTheatreFullscreen();
        return;
      }
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

    /* Swipe-down to close — no live scale (iframes jitter when the panel transforms) */
    var swipe = { y0: 0, dy: 0, active: false };
    self.panel.addEventListener('touchstart', function (e) {
      if (self._ownFs) return;
      if (e.touches.length !== 1) return;
      swipe.y0 = e.touches[0].clientY;
      swipe.dy = 0;
      swipe.active = true;
    }, { passive: true });
    self.panel.addEventListener('touchmove', function (e) {
      if (!swipe.active || e.touches.length !== 1 || self._ownFs) return;
      swipe.dy = e.touches[0].clientY - swipe.y0;
    }, { passive: true });
    self.panel.addEventListener('touchend', function () {
      if (!swipe.active) return;
      swipe.active = false;
      if (swipe.dy > 110) self.close();
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
    try { this.freezeBackground(); } catch (_) {}

    this.el.hidden = false;
    document.documentElement.classList.add('pvr-open');
    if (window.UCScrollLock) window.UCScrollLock.lock();
    this.el.classList.add('is-open');
    this.syncChrome();
    this.renderMedia();

    var close = this.el.querySelector('[data-pvr-popup-close]');
    if (close) close.focus({ preventScroll: true });
  };

  Popup.prototype.coverSrcFromCell = function (cell) {
    var poster = cell && cell.querySelector('.pvr-card__poster');
    if (!poster || poster.tagName !== 'IMG') return '';
    return (poster.currentSrc || poster.getAttribute('src') || '').trim();
  };

  Popup.prototype.setPosterBackdrop = function (src) {
    if (!this.videoWrap) return;
    var url = (src || this.coverSrcFromCell(this.currentCell) || '').trim();
    if (!url) {
      this.videoWrap.style.removeProperty('--pvr-tt-poster');
      return;
    }
    var safe = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    this.videoWrap.style.setProperty('--pvr-tt-poster', 'url("' + safe + '")');
  };

  Popup.prototype.placeCover = function (src) {
    this.syncBleed(src);
    this.setPosterBackdrop(src);
    if (!this.videoWrap || !src) return;
    var cover = this.videoWrap.querySelector('.pvr-popup__cover');
    if (!cover) {
      cover = document.createElement('img');
      cover.className = 'pvr-popup__cover';
      cover.alt = '';
      this.videoWrap.appendChild(cover);
    }
    cover.classList.remove('is-gone');
    if (cover.src !== src) cover.src = src;
  };

  Popup.prototype.toggleTheatreFullscreen = function () {
    var el = this.el;
    if (!el) return;
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try { exit.call(document); } catch (e) {}
      }
      return;
    }
    this.syncBleed();
    this.freezeBackground();
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      try { req.call(el); } catch (e) {}
    }
  };

  Popup.prototype.syncBleed = function (src) {
    if (!this.el) return;
    var img = this.el.querySelector('.pvr-popup__fs-bleed-img');
    if (!img) return;
    var url = (src || this.coverSrcFromCell(this.currentCell) || '').trim();
    if (url && img.getAttribute('src') !== url) img.src = url;
  };

  Popup.prototype.revealPlayer = function () {
    var wrap = this.videoWrap;
    if (!wrap) return;
    wrap.classList.add('is-playing');
    var cover = wrap.querySelector('.pvr-popup__cover');
    if (!cover) return;
    cover.classList.add('is-gone');
    window.setTimeout(function () {
      if (cover.parentNode) cover.parentNode.removeChild(cover);
    }, 240);
  };

  Popup.prototype.freezeBackground = function () {
    try { this.section.pauseAll(); } catch (e) {}
    try {
      document.querySelectorAll('#MainContent video').forEach(function (v) {
        try { v.pause(); } catch (e2) {}
      });
    } catch (e3) {}
  };

  Popup.prototype._setTikTokPanel = function (on) {
    if (!this.panel) return;
    this.panel.classList.toggle('pvr-popup__panel--tiktok', !!on);
  };

  Popup.prototype.renderMedia = function () {
    var videoCard = this.currentCard;
    var cell = this.currentCell;
    var data = this.currentData || {};
    this._setTikTokPanel(false);
    this._ttKeepMuted = true;
    if (this._ttResizeObs) {
      try { this._ttResizeObs.disconnect(); } catch (e) {}
      this._ttResizeObs = null;
    }
    this.videoWrap.innerHTML = '';
    this.videoWrap.className = 'pvr-popup__video pvr-popup__video--viewbox';
    this.videoWrap.classList.remove('is-playing');
    this._activeVideo = null;
    this._ttId = '';
    this._ttSrc = '';
    this.placeCover(this.coverSrcFromCell(cell));

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
      v.controls = true;
      v.preload = 'auto';
      v.disablePictureInPicture = true;
      v.setAttribute('disablepictureinpicture', '');
      try { v.controlsList = 'nodownload noplaybackrate noremoteplayback'; } catch (_) {}
      this.videoWrap.appendChild(v);
      this._activeVideo = v;
      var play = function () {
        v.muted = false;
        var p = v.play();
        if (p && p.catch) {
          p.catch(function () {
            v.muted = true;
            v.play().then(function () {
              v.muted = false;
            }).catch(function () {});
          });
        }
        selfMp4.revealPlayer();
      };
      if (v.readyState >= 2) play();
      else v.addEventListener('loadeddata', play, { once: true });
      v.addEventListener('ended', function () {
        v.currentTime = 0;
        v.play().catch(function () {});
      });
    } else if (videoCard && videoCard.provider && (videoCard.provider.type === 'youtube' || videoCard.provider.type === 'vimeo')) {
      var selfYt = this;
      var iframe = document.createElement('iframe');
      iframe.allow = 'autoplay; encrypted-media; fullscreen';
      if (videoCard.provider.type === 'youtube') {
        iframe.src = 'https://www.youtube.com/embed/' + videoCard.provider.id +
          '?autoplay=1&rel=0&playsinline=1&controls=0&loop=1&playlist=' + videoCard.provider.id +
          '&mute=0&fs=0';
      } else {
        iframe.src = 'https://player.vimeo.com/video/' + videoCard.provider.id +
          '?autoplay=1&loop=1&muted=0&controls=0';
      }
      this.videoWrap.appendChild(iframe);
      iframe.addEventListener('load', function () { selfYt.revealPlayer(); }, { once: true });
      window.setTimeout(function () { selfYt.revealPlayer(); }, 900);
    } else if (
      (videoCard && videoCard.provider && videoCard.provider.type === 'tiktok') ||
      Utils.isTikTokUrl(cell && cell.getAttribute('data-video-url'))
    ) {
      var selfTt = this;
      this._ttSrc = (videoCard && videoCard.provider && videoCard.provider.src) ||
        (videoCard && videoCard.externalUrl) ||
        (cell && cell.getAttribute('data-video-url')) || '';
      this._ttId = Utils.tikTokIdFromCell(cell, videoCard) ||
        Utils.extractTikTokId(this._ttSrc) ||
        Utils.recallTikTokId(this._ttSrc);
      var bootTikTok = function (id) {
        if (!selfTt.el || !selfTt.el.classList.contains('is-open')) return;
        if (selfTt.currentCell !== cell) return;
        if (id) {
          selfTt._ttId = id;
          if (videoCard && videoCard.provider) videoCard.provider.id = id;
          if (cell) cell.setAttribute('data-video-id', id);
          selfTt.renderTikTok(id, selfTt._ttSrc);
        } else {
          selfTt.renderSocialFallback(cell, data, selfTt._ttSrc, 'tiktok');
        }
      };
      if (this._ttId) {
        bootTikTok(this._ttId);
      } else if (videoCard && typeof videoCard.ensureTikTokId === 'function') {
        videoCard.ensureTikTokId().then(bootTikTok);
      } else if (this._ttSrc) {
        Utils.fetchTikTokId(this._ttSrc).then(bootTikTok);
      } else {
        this.renderSocialFallback(cell, data, '', 'tiktok');
      }
    } else if (videoCard && videoCard.provider && videoCard.provider.type === 'instagram') {
      var igId = videoCard.provider.id || Utils.extractInstagramId(videoCard.provider.src || videoCard.externalUrl);
      if (igId) this.renderInstagram(igId, videoCard.provider.src);
      else this.renderSocialFallback(cell, data, videoCard.provider.src, 'instagram');
      var selfIg = this;
      window.setTimeout(function () { selfIg.revealPlayer(); }, 800);
    } else {
      this.renderPosterFallback(cell, data, data.url || '');
      this.revealPlayer();
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

  Popup.prototype.preloadTikTok = function (id) {
    var cleanId = String(id || '').replace(/\D/g, '');
    if (!cleanId || this._ttPreloadId === cleanId) return;
    this._ttPreloadId = cleanId;
    if (!document.querySelector('link[rel="preconnect"][href="https://www.tiktok.com"]')) {
      var cite = document.createElement('link');
      cite.rel = 'preconnect';
      cite.href = 'https://www.tiktok.com';
      document.head.appendChild(cite);
    }
    /* Browsers ignore preload for TikTok player URLs — preconnect only */
  };

  Popup.prototype.tikTokPlayerSrc = function (id, preload) {
    var cleanId = String(id || '').replace(/\D/g, '');
    return 'https://www.tiktok.com/player/v1/' + encodeURIComponent(cleanId) +
      (preload
        ? '?autoplay=0&mute=1&loop=1&music_info=0&description=0&rel=0&controls=0'
        : '?autoplay=1&mute=1&loop=1&music_info=0&description=0&rel=0' +
          '&native_context_menu=0&closed_caption=1&controls=1&progress_bar=1' +
          '&play_button=1&volume_control=1&fullscreen_button=1&timestamp=0');
  };

  Popup.prototype.mountFillIframe = function (src, title, cropMode) {
    cropMode = cropMode || 'fit';
    var wrap = this.videoWrap;
    var cover = wrap.querySelector('.pvr-popup__cover');
    var old = wrap.querySelector('.pvr-popup__crop');
    if (old) old.remove();
    wrap.querySelectorAll('.pvr-popup__tt-hide').forEach(function (node) { node.remove(); });
    wrap.classList.add('pvr-popup__video--viewbox', 'pvr-popup__video--tiktok');
    wrap.classList.remove('pvr-popup__video--loading');
    var frame = document.createElement('div');
    frame.className = 'pvr-popup__crop pvr-popup__crop--' + cropMode;
    var iframe = document.createElement('iframe');
    iframe.className = 'pvr-popup__crop-iframe';
    iframe.allow = 'autoplay';
    iframe.setAttribute('allow', 'autoplay');
    iframe.removeAttribute('allowfullscreen');
    iframe.removeAttribute('webkitallowfullscreen');
    iframe.removeAttribute('mozallowfullscreen');
    iframe.setAttribute('scrolling', 'no');
    iframe.title = title || 'Reel';
    iframe.setAttribute('loading', 'eager');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:auto;background:transparent;';
    iframe.src = src;
    frame.appendChild(iframe);
    wrap.appendChild(frame);
    if (cropMode === 'tiktok') {
      this.setPosterBackdrop(cover && (cover.currentSrc || cover.src));
      var pip = document.createElement('div');
      pip.className = 'pvr-popup__tt-hide pvr-popup__tt-hide--pip';
      pip.setAttribute('aria-hidden', 'true');
      pip.setAttribute('title', '');
      pip.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      wrap.appendChild(pip);
      var fsHit = document.createElement('button');
      fsHit.type = 'button';
      fsHit.className = 'pvr-popup__tt-hide pvr-popup__tt-hide--fs';
      fsHit.setAttribute('data-pvr-popup-fs', '');
      fsHit.setAttribute('aria-label', 'Fullscreen');
      wrap.appendChild(fsHit);
    }
    if (cover) wrap.appendChild(cover);
    return iframe;
  };

  Popup.prototype.pingTikTokPlayer = function (iframe) {
    if (!iframe || !iframe.contentWindow) return;
    try { iframe.contentWindow.postMessage({ 'x-tiktok-player': true, type: 'play', value: true }, '*'); } catch (e) {}
    if (this._ttKeepMuted === false) {
      try { iframe.contentWindow.postMessage({ 'x-tiktok-player': true, type: 'mute', value: false }, '*'); } catch (e) {}
      try { iframe.contentWindow.postMessage({ 'x-tiktok-player': true, type: 'unmute' }, '*'); } catch (e) {}
    }
  };

  Popup.prototype.clearTikTokEmbedWatch = function () {
    if (this._ttMsgHandler) {
      window.removeEventListener('message', this._ttMsgHandler);
      this._ttMsgHandler = null;
    }
    this._ttIframe = null;
    if (this.videoWrap) this.videoWrap.classList.remove('pvr-popup__video--tiktok-player');
  };

  Popup.prototype.mountTikTokEmbed = function (id) {
    var self = this;
    var cleanId = String(id || '').replace(/\D/g, '');
    if (!cleanId) return null;
    var iframe = this.mountFillIframe(this.tikTokPlayerSrc(cleanId, false), 'TikTok reel', 'tiktok');
    this._ttActiveId = cleanId;
    this._ttIframe = iframe;
    this._ttKeepMuted = true;

    var tries = 0;
    var ping = function () {
      if (!self.el || !self.el.classList.contains('is-open')) return;
      if (!self._ttIframe) return;
      self.pingTikTokPlayer(self._ttIframe);
      tries += 1;
      if (tries < 4) window.setTimeout(ping, 320);
    };
    iframe.addEventListener('load', function () {
      ping();
      self.revealPlayer();
    }, { once: true });
    window.setTimeout(ping, 120);
    return iframe;
  };

  Popup.prototype.renderTikTok = function (id, href) {
    var self = this;
    this.clearTikTokEmbedWatch();
    var canonical = Utils.normalizeTikTokUrl(href || '');
    var cleanId = String(id || '').replace(/\D/g, '') || Utils.extractTikTokId(canonical);
    if (!cleanId) return;

    if (!document.querySelector('link[rel="preconnect"][href="https://www.tiktok.com"]')) {
      var cite = document.createElement('link');
      cite.rel = 'preconnect';
      cite.href = 'https://www.tiktok.com';
      document.head.appendChild(cite);
    }

    this.placeCover(this.coverSrcFromCell(this.currentCell));
    this.videoWrap.classList.add('pvr-popup__video--tiktok-player');
    this.mountTikTokEmbed(cleanId);

    var revealed = false;
    var reveal = function () {
      if (revealed) return;
      revealed = true;
      self.revealPlayer();
    };

    this._ttMsgHandler = function (e) {
      if (!self.el || !self.el.classList.contains('is-open')) return;
      var d = e && e.data;
      if (!d || d['x-tiktok-player'] !== true) return;
      var kind = d.type;
      if (kind === 'mute' || kind === 'onMute' || kind === 'volumeChange' || kind === 'onVolumeChange') {
        var muted = d.muted;
        if (muted == null) muted = d.value === true || d.value === 1 || d.value === 'muted';
        if (d.volume != null) muted = Number(d.volume) <= 0;
        self._ttKeepMuted = !!muted;
        return;
      }
      if (kind === 'onPlayerReady' || kind === 'onVideoCanPlay') {
        self.pingTikTokPlayer(self._ttIframe);
        reveal();
        return;
      }
      if (kind === 'onCurrentTime') {
        if (d.value > 0.05) reveal();
        return;
      }
      if (kind === 'onStateChange' && (d.value === 'playing' || d.value === 1 || d.value === 'play')) {
        reveal();
      }
    };
    window.addEventListener('message', this._ttMsgHandler);
    window.setTimeout(reveal, 480);
  };

  Popup.prototype.renderInstagram = function (id, src) {
    var kind = (src && /\/reel\//i.test(src)) ? 'reel' : 'p';
    var embedSrc = 'https://www.instagram.com/' + kind + '/' + encodeURIComponent(id) + '/embed';
    this.mountFillIframe(embedSrc, 'Instagram reel');
  };

  Popup.prototype.renderSocialFallback = function (cell, data, href, kind) {
    this.revealPlayer();
    this.renderPosterFallback(cell, data);
    var wrap = this.videoWrap;
    if (!wrap) return;
    var a = document.createElement('a');
    a.className = 'pvr-popup__open-native';
    a.href = href || '#';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = kind === 'instagram' ? 'Play on Instagram' : 'Play on TikTok';
    wrap.appendChild(a);
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
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try { exit.call(document); } catch (e) {}
      }
    }
    this.clearTikTokEmbedWatch();
    if (this._ttResizeObs) {
      try { this._ttResizeObs.disconnect(); } catch (e) {}
      this._ttResizeObs = null;
    }
    this.toggleMenu(false);
    if (this.panel) {
      this.panel.style.transition = '';
      this.panel.style.transform = '';
      this._setTikTokPanel(false);
    }
    this.el.classList.remove('is-open', 'is-own-fs');
    document.documentElement.classList.remove('pvr-iframe-fs', 'pvr-open');
    if (window.UCScrollLock) window.UCScrollLock.unlock();
    var self = this;
    setTimeout(function () {
      self.el.hidden = true;
      self.videoWrap.innerHTML = '';
    }, 280);
    if (this.lastFocus && this.lastFocus.focus) {
      try { this.lastFocus.focus({ preventScroll: true }); } catch (_) {}
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
        /* Carousel stays a still poster. Playback only starts in the reel viewer. */
        this.autoplay = false;
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
        cells.forEach(function (cell, index) {
          var card = new VideoCard(cell, self);
          cell._pvrCard = card;
          self.cards.push(card);
          if (card.ensureTikTokId) card.ensureTikTokId();
          self.scheduleThumbnail(card, index);
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

        whenIdle(function () {
          self.cards.slice(0, 6).forEach(function (card) {
            if (!card.ensureTikTokId) return;
            card.ensureTikTokId().then(function (id) {
              if (id) self.popup.preloadTikTok(id);
            });
          });
        });

        this.syncFromHome();
      }

      reelKey(url) {
        var raw = String(url || '').trim();
        var id = (raw.match(/\/video\/(\d{8,})/) || raw.match(/[?&]item_id=(\d{8,})/) || [])[1];
        if (id) return 'id:' + id;
        return raw.split('?')[0].split('#')[0].replace(/\/$/, '').toLowerCase();
      }

      applyReelOrder(urls) {
        var track = this.querySelector('[data-pvr-track]');
        if (!track || !urls || !urls.length) return;
        var cells = Array.prototype.slice.call(track.querySelectorAll('[data-pvr-cell]'));
        var map = {};
        cells.forEach(function (cell) {
          var key = this.reelKey(cell.getAttribute('data-video-url') || '');
          if (key) map[key] = cell;
          var id = (cell.getAttribute('data-video-id') || '').replace(/\D/g, '');
          if (id) map['id:' + id] = cell;
        }, this);
        var used = {};
        var matched = 0;
        urls.forEach(function (url) {
          var key = this.reelKey(url);
          var cell = map[key];
          if (!cell) return;
          matched += 1;
          used[cell.getAttribute('data-block-id') || key] = true;
          cell.hidden = false;
          track.appendChild(cell);
        }, this);
        if (!matched) return;
        cells.forEach(function (cell) {
          var id = cell.getAttribute('data-block-id') || '';
          if (!used[id] && this.getAttribute('data-reel-order') === 'sync') cell.hidden = true;
        }, this);
        if (this.slider && typeof this.slider.refresh === 'function') this.slider.refresh();
      }

      syncFromHome() {
        if (this.getAttribute('data-reel-order') !== 'sync') return;
        var masterId = this.getAttribute('data-reel-master-id') || '';
        if (!masterId || masterId === this.getAttribute('data-section-id')) return;
        var self = this;
        var cacheKey = 'uc-reel-order:' + masterId;
        try {
          var cached = window.localStorage.getItem(cacheKey);
          if (cached) this.applyReelOrder(JSON.parse(cached));
        } catch (e) {}
        fetch('/?sections=' + encodeURIComponent(masterId), { credentials: 'same-origin' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            var html = data && data[masterId];
            if (!html) return;
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var urls = [];
            doc.querySelectorAll('[data-video-url]').forEach(function (el) {
              var u = (el.getAttribute('data-video-url') || '').trim();
              if (u) urls.push(u);
            });
            if (!urls.length) return;
            try { window.localStorage.setItem(cacheKey, JSON.stringify(urls)); } catch (e) {}
            self.applyReelOrder(urls);
          })
          .catch(function () {});
      }

      scheduleThumbnail(card, index) {
        if (!card || !card.cell) return;
        var cell = card.cell;
        if (card._thumbScheduled) return;
        card._thumbScheduled = true;

        var run = function () {
          if (card._thumbResolved) return;
          card._thumbResolved = true;
          card.resolveThumbnail();
        };

        if (index < 8) {
          run();
          return;
        }

        if ('IntersectionObserver' in window) {
          if (!this._thumbIo) {
            var self = this;
            this._thumbIo = new IntersectionObserver(function (entries) {
              entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var c = entry.target._pvrCard;
                if (c && !c._thumbResolved) {
                  c._thumbResolved = true;
                  c.resolveThumbnail();
                }
                self._thumbIo.unobserve(entry.target);
              });
            }, { rootMargin: '320px 0px', threshold: 0.01 });
          }
          this._thumbIo.observe(cell);
          return;
        }

        window.setTimeout(run, Math.min(index * 90, 2400));
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

          var warm = function () {
            if (!(card.isSocial && card.isSocial())) return;
            self.popup.build();
            if (card.ensureTikTokId) {
              card.ensureTikTokId().then(function (tid) {
                if (tid) self.popup.preloadTikTok(tid);
              });
            }
          };
          cell.addEventListener('pointerdown', warm, { passive: true });
          cell.addEventListener('pointerenter', warm, { passive: true });

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
        Cart.add(variantId, qty, { openDrawer: false })
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
            c.mount();
          });
          return;
        }

        /* Light preload — carousel stays poster-first; popup handles playback */
        var preloadMargin = self.isMobile ? '80px 0px' : '240px 0px';
        this.preloadIo = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              var card = entry.target._pvrCard;
              if (!card || !entry.isIntersecting) return;
              if (card.isSocial && card.isSocial()) return;
              if (card.provider && card.provider.type === 'mp4') return;
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
        if (this._thumbIo) this._thumbIo.disconnect();
        if (this._ro) this._ro.disconnect();
        if (this.popup) {
          if (this.popup._ttResizeObs) {
            try { this.popup._ttResizeObs.disconnect(); } catch (_) {}
          }
          if (this.popup.el && this.popup.el.parentNode) {
            try { this.popup.el.parentNode.removeChild(this.popup.el); } catch (_) {}
          }
          this.popup.el = null;
        }
        this._init = false;
        this.cards = [];
      }
    };
  }

  if (!customElements.get('premium-video-reels')) {
    customElements.define('premium-video-reels', PremiumVideoReels);
  }

  // Theme editor: re-init on section load (element upgrade handles most).
  document.addEventListener('shopify:section:load', function (e) {
    var root = e.target;
    var el = root.matches && root.matches('premium-video-reels')
      ? root
      : root.querySelector('premium-video-reels');
    if (!el || !el.connectedCallback) return;
    el._init = false;
    el.cards = [];
    el.connectedCallback();
  });
})();

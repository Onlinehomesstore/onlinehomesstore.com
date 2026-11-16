/* Product reviews section — extracted for valid Liquid HTML */
(function () {
  function boot(cfg) {
    if (!cfg || !cfg.rootId) return;

    var root = document.getElementById(cfg.rootId) || document.querySelector('[data-uc-reviews]');
    if (!root) return;
    var productId = cfg.productId;
    var storageKey = 'uc:pending-reviews:' + productId;
    var toggles = root.querySelectorAll('[data-upr-write-toggle]');
    var formWrap = root.querySelector('[data-upr-form-wrap]');
    var form = root.querySelector('.upr__form');
    var photoInput = root.querySelector('[data-upr-photo-input]');
    var photosWrap = root.querySelector('[data-upr-photos]');
    var photoCount = root.querySelector('[data-upr-photo-count]');
    var photoNote = root.querySelector('[data-upr-photo-note]');
    var bodyField = root.querySelector('[data-upr-body]');
    var pendingFiles = [];

    function setFormOpen(open) {
      if (!formWrap) return;
      formWrap.classList.toggle('is-open', open);
      formWrap.setAttribute('aria-hidden', open ? 'false' : 'true');
      toggles.forEach(function (t) {
        t.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      if (open) {
        formWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        var first = formWrap.querySelector('input[type="radio"], input[type="text"], textarea');
        if (first) window.setTimeout(function () { first.focus(); }, 280);
      }
    }

    toggles.forEach(function (t) {
      t.addEventListener('click', function () {
        if (!formWrap) return;
        setFormOpen(!formWrap.classList.contains('is-open'));
      });
    });

    var chips = root.querySelectorAll('[data-upr-filter]');
    function filterCards() {
      var active = root.querySelector('[data-upr-filter].is-active');
      var f = active ? active.getAttribute('data-upr-filter') : 'all';
      root.querySelectorAll('[data-upr-grid] .upr__card').forEach(function (card) {
        var show = true;
        if (f === 'verified') show = card.getAttribute('data-verified') === 'true';
        if (f === 'top') show = parseInt(card.getAttribute('data-rating'), 10) >= 4;
        if (f === 'photos') show = card.getAttribute('data-has-photos') === 'true';
        card.classList.toggle('is-hidden', !show);
      });
    }
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        filterCards();
      });
    });

    function compressImage(file) {
      return new Promise(function (resolve) {
        if (!file || !file.type || file.type.indexOf('image') !== 0) {
          resolve(null);
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var max = 1200;
            var w = img.width;
            var h = img.height;
            if (w > max || h > max) {
              var ratio = Math.min(max / w, max / h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            var quality = 0.72;
            var dataUrl = canvas.toDataURL('image/jpeg', quality);
            while (dataUrl.length > 180000 && quality > 0.4) {
              quality -= 0.08;
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            resolve({ name: file.name, dataUrl: dataUrl });
          };
          img.onerror = function () { resolve(null); };
          img.src = reader.result;
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(file);
      });
    }

    function renderPreviews() {
      if (!photosWrap) return;
      photosWrap.querySelectorAll('.upr__photo-preview').forEach(function (el) { el.remove(); });
      pendingFiles.forEach(function (item, idx) {
        var wrap = document.createElement('div');
        wrap.className = 'upr__photo-preview';
        wrap.innerHTML = '<img src="' + item.dataUrl + '" alt=""><button type="button" class="upr__photo-remove" aria-label="Remove photo">&times;</button>';
        wrap.querySelector('.upr__photo-remove').addEventListener('click', function () {
          pendingFiles.splice(idx, 1);
          renderPreviews();
          syncPhotoFields();
        });
        photosWrap.insertBefore(wrap, photosWrap.querySelector('.upr__photo-add'));
      });
      var add = photosWrap.querySelector('.upr__photo-add');
      if (add) add.style.display = pendingFiles.length >= 3 ? 'none' : '';
      syncPhotoFields();
    }

    function syncPhotoFields() {
      if (photoCount) photoCount.value = String(pendingFiles.length);
      if (photoNote) {
        photoNote.value = pendingFiles.length
          ? pendingFiles.length + ' photo(s) attached by customer: ' + pendingFiles.map(function (f) { return f.name; }).join(', ')
          : '';
      }
    }

    if (photoInput) {
      photoInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(photoInput.files || [], 0);
        photoInput.value = '';
        var room = 3 - pendingFiles.length;
        if (room <= 0) return;
        Promise.all(files.slice(0, room).map(compressImage)).then(function (results) {
          results.forEach(function (r) { if (r) pendingFiles.push(r); });
          renderPreviews();
        });
      });
    }

    function readPending() {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || '[]') || [];
      } catch (e) { return []; }
    }

    function writePending(list) {
      try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch (e) { /* quota */ }
    }

    function injectPending() {
      var grid = root.querySelector('[data-upr-grid]');
      var list = readPending();
      if (!list.length) return;
      if (!grid) {
        var empty = root.querySelector('.upr__empty');
        if (empty) {
          grid = document.createElement('div');
          grid.className = 'upr__grid';
          grid.setAttribute('data-upr-grid', '');
          empty.replaceWith(grid);
        }
      }
      if (!grid) return;
      if (grid.matches('[data-uc-reviews-stream]')) {
        grid = grid.querySelector('.uc-rev-stream__lane .uc-rev-stream__half') || grid;
      } else if (grid.classList.contains('upr-marquee')) {
        grid = grid.querySelector('.upr-marquee__track') || grid;
      }
      list.forEach(function (r) {
        var article = document.createElement('article');
        article.className = 'upr__card';
        article.setAttribute('data-verified', 'false');
        article.setAttribute('data-rating', String(r.rating || 5));
        article.setAttribute('data-has-photos', (r.images && r.images.length) ? 'true' : 'false');
        var pct = (r.rating || 5) * 20;
        var photos = '';
        if (r.images && r.images.length) {
          photos = '<div class="upr__card-photos">' + r.images.map(function (src) {
            return '<button type="button" class="upr__photo" data-upr-lightbox="' + src.replace(/"/g, '&quot;') + '"><img src="' + src.replace(/"/g, '&quot;') + '" alt="" loading="lazy" width="120" height="120"></button>';
          }).join('') + '</div>';
        }
        article.innerHTML =
          '<div class="upr__card-top"><span class="upr__stars upr__stars--sm" style="--upr-pct:' + pct + '%;" aria-hidden="true"></span><span class="upr__badge">Pending</span></div>' +
          (r.title ? '<h3 class="upr__card-title">' + r.title.replace(/</g, '&lt;') + '</h3>' : '') +
          '<p class="upr__card-body">' + (r.body || '').replace(/</g, '&lt;') + '</p>' +
          photos +
          '<div class="upr__card-foot"><span class="upr__avatar" aria-hidden="true">' + ((r.author || 'Y').charAt(0).toUpperCase()) + '</span><span class="upr__author"><strong>' + (r.author || 'You').replace(/</g, '&lt;') + '</strong><em>Awaiting approval</em></span></div>';
        grid.prepend(article);
      });
      bindLightbox();
    }

    function bindLightbox() {
      var lb = document.getElementById(cfg.lightboxId);
      if (!lb) {
        lb = document.createElement('div');
        lb.id = cfg.lightboxId;
        lb.className = 'upr__lightbox';
        lb.hidden = true;
        lb.innerHTML = '<button type="button" class="upr__lightbox-close" aria-label="Close">&times;</button><img alt="">';
        document.body.appendChild(lb);
        lb.querySelector('.upr__lightbox-close').addEventListener('click', function () { lb.hidden = true; });
        lb.addEventListener('click', function (e) { if (e.target === lb) lb.hidden = true; });
      }
      root.querySelectorAll('[data-upr-lightbox]').forEach(function (btn) {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
          var src = btn.getAttribute('data-upr-lightbox');
          if (!src) return;
          lb.querySelector('img').src = src;
          lb.hidden = false;
        });
      });
    }

    if (form) {
      form.addEventListener('submit', function () {
        var ratingEl = form.querySelector('input[name="contact[rating]"]:checked');
        var nameEl = form.querySelector('input[name="contact[name]"]');
        var titleEl = form.querySelector('input[name="contact[review_title]"]');
        var images = pendingFiles.map(function (f) { return f.dataUrl; });
        if (bodyField && pendingFiles.length) {
          var note = '\n\n[Photos attached: ' + pendingFiles.length + ' — ' + pendingFiles.map(function (f) { return f.name; }).join(', ') + ']';
          if (bodyField.value.indexOf('[Photos attached:') === -1) bodyField.value += note;
        }
        var entry = {
          author: nameEl ? nameEl.value : 'Customer',
          rating: ratingEl ? parseInt(ratingEl.value, 10) : 5,
          title: titleEl ? titleEl.value : '',
          body: bodyField ? bodyField.value.replace(/\n\n\[Photos attached:[\s\S]*$/, '') : '',
          images: images,
          date: new Date().toISOString().slice(0, 10)
        };
        var list = readPending();
        list.unshift(entry);
        writePending(list.slice(0, 8));
      });
    }

    injectPending();
    bindLightbox();

    if (cfg.posted || (formWrap && formWrap.classList.contains('is-open'))) setFormOpen(true);
  
  }

  function run() {
    document.querySelectorAll('script[data-upr-boot]').forEach(function (el) {
      boot({
        rootId: el.getAttribute('data-upr-root'),
        productId: el.getAttribute('data-upr-product-id'),
        lightboxId: el.getAttribute('data-upr-lightbox-id'),
        posted: el.getAttribute('data-upr-posted') === '1'
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

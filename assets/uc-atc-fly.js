(function () {
  'use strict';
  if (window.__UC_ATC_FLY__) return;
  window.__UC_ATC_FLY__ = true;

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCE) return;

  var CART_SELECTOR = [
    '#cart-icon-bubble',
    '.header__icon--cart',
    '[data-uc-phdr-cart-open]',
    'a[href$="/cart"]'
  ].join(',');

  function getCartTarget() {
    return document.querySelector(CART_SELECTOR);
  }

  function animate(image, button) {
    var cart = getCartTarget();
    if (!image || !cart) return;

    var imageRect = image.getBoundingClientRect();
    var buttonRect = button ? button.getBoundingClientRect() : imageRect;
    var cartRect = cart.getBoundingClientRect();
    var startX = imageRect.left + imageRect.width / 2 - 28;
    var startY = imageRect.top + Math.min(imageRect.height * 0.38, 120);
    if (!isFinite(startX) || !isFinite(startY)) {
      startX = buttonRect.left + buttonRect.width / 2 - 28;
      startY = buttonRect.top + buttonRect.height / 2 - 28;
    }

    var endX = cartRect.left + cartRect.width / 2 - 18;
    var endY = cartRect.top + cartRect.height / 2 - 18;
    var dx = endX - startX;

    var clone = document.createElement('div');
    clone.className = 'uc-atc-fly';
    clone.setAttribute('aria-hidden', 'true');
    clone.innerHTML = '<img src="' + (image.currentSrc || image.src) + '" alt="">';
    clone.style.transform = 'translate3d(' + startX + 'px,' + startY + 'px,0) scale(1)';
    clone.style.opacity = '0.96';
    document.body.appendChild(clone);

    var controlY = Math.min(startY, endY) - Math.max(120, Math.abs(dx) * 0.12);
    var start = performance.now();
    var duration = 680;

    function ease(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      var p = Math.min(1, (now - start) / duration);
      var e = ease(p);
      var inv = 1 - p;
      var x = inv * inv * startX + 2 * inv * p * (startX + dx * 0.35) + p * p * endX;
      var y = inv * inv * startY + 2 * inv * p * controlY + p * p * endY;
      var scale = 1 - e * 0.45;
      clone.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ')';
      clone.style.opacity = String(0.96 - e * 0.72);
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        clone.remove();
        cart.classList.add('is-cart-bumped');
        setTimeout(function () {
          cart.classList.remove('is-cart-bumped');
        }, 320);
      }
    }

    requestAnimationFrame(frame);
  }

  /* Animation fires ONLY after a confirmed successful cart add.
     Dispatched by uc-product-card.js, premium-product-showcase.js, etc.
     after the /cart/add.js API returns 200. */
  document.addEventListener('cart:atc:success', function (e) {
    var detail = e.detail || {};
    var button = detail.button;
    var image = detail.image;

    /* If no image provided, try to find one near the button */
    if (!image && button) {
      var scope = button.closest('.pc-card, .pvr-card, .pph, .product, .card, form, .cs-card, .upr__card') || document;
      image = scope.querySelector('img[src]:not([src=""])');
      if (!image) {
        var prev = button.parentElement;
        while (prev && prev !== document.body && !image) {
          image = prev.querySelector('img[src]:not([src=""])');
          prev = prev.parentElement;
        }
      }
    }

    if (!image) return;
    requestAnimationFrame(function () {
      animate(image, button);
    });
  });
})();

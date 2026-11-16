/**
 * Live activity card — idle-friendly, pauses when tab hidden.
 */
(function () {
  'use strict';
  if (window.__UC_VIEWING__) return;
  window.__UC_VIEWING__ = true;

  var NAMES = ['Sophie', 'Amira', 'James', 'Priya', 'Helen', 'Omar', 'Nadia', 'Daniel', 'Maya', 'Chris', 'Lauren', 'Yasmin', 'Fatima', 'Ben', 'Grace', 'Chloe', 'Leila', 'Hannah', 'Ruth', 'Zara'];
  var PLACES = ['Leeds', 'Manchester', 'Birmingham', 'London', 'Bristol', 'Glasgow', 'Cardiff', 'Edinburgh', 'Nottingham', 'Brighton', 'Sheffield', 'Liverpool', 'York', 'Oxford', 'Leicester'];
  var TIMES = ['Just now', 'A moment ago', '2 minutes ago', '3 minutes ago'];
  var ACTIONS = [
    { id: 'view', weight: 5, line: 'is viewing right now' },
    { id: 'cart', weight: 3, line: 'added this to their bag' },
    { id: 'buy', weight: 2, line: 'just purchased' },
    { id: 'wish', weight: 2, line: 'saved this for later' }
  ];
  var ACTION_BAG = [];
  ACTIONS.forEach(function (action) {
    for (var i = 0; i < action.weight; i++) ACTION_BAG.push(action);
  });

  function shortTitle(title) {
    var text = String(title || '').replace(/\s+/g, ' ').trim();
    text = text.split('|')[0].trim();
    text = text.replace(/\s+[I|]\s+\d.*$/i, '').trim();
    text = text.replace(/\s+\d+\s*[×xX].*$/, '').trim();
    if (text.length > 48) text = text.slice(0, 45).replace(/\s+\S*$/, '') + '…';
    return text;
  }

  function boot() {
    var root = document.querySelector('[data-uc-viewing]');
    if (!root) return;

    var link = root.querySelector('[data-uc-viewing-link]');
    var img = root.querySelector('[data-uc-viewing-img]');
    var productEl = root.querySelector('[data-uc-viewing-product]');
    var whoEl = root.querySelector('[data-uc-viewing-who]');
    var timeEl = root.querySelector('[data-uc-viewing-time]');
    var closeBtn = root.querySelector('[data-uc-viewing-close]');
    var catalogNode = document.querySelector('[data-uc-viewing-catalog]');

    var catalog = [];
    try {
      catalog = JSON.parse(catalogNode && catalogNode.textContent ? catalogNode.textContent : '[]');
    } catch (e) {
      catalog = [];
    }
    if (!catalog.length) return;

    var interval = Math.max(10, parseInt(root.getAttribute('data-interval'), 10) || 10) * 1000;
    var firstDelay = Math.max(14, parseInt(root.getAttribute('data-first-delay'), 10) || 14) * 1000;
    var visibleFor = Math.min(Math.round(interval * 0.5), 5200);
    var hideTimer = null;
    var cycleTimer = null;
    var lastIndex = -1;
    var lastName = '';
    var lastAction = '';
    var dismissed = false;
    var path = (window.location && window.location.pathname) || '';

    function pick(list, avoid) {
      if (!list.length) return '';
      var i = Math.floor(Math.random() * list.length);
      var value = list[i];
      if (value === avoid && list.length > 1) value = list[(i + 1) % list.length];
      return value;
    }

    function pickProduct() {
      var i = Math.floor(Math.random() * catalog.length);
      if (catalog.length > 1 && (i === lastIndex || (catalog[i].url && path.indexOf(catalog[i].url) !== -1))) {
        i = (i + 1) % catalog.length;
      }
      lastIndex = i;
      return catalog[i];
    }

    function hideCard() {
      root.classList.remove('is-visible');
      window.setTimeout(function () {
        if (!root.classList.contains('is-visible')) root.hidden = true;
      }, 420);
    }

    function showCard() {
      if (dismissed || document.hidden) return;
      var item = pickProduct();
      if (!item) return;
      var action = pick(ACTION_BAG, lastAction);
      lastAction = action.id;
      lastName = pick(NAMES, lastName);
      var place = pick(PLACES);
      var product = shortTitle(item.title);
      var whoLine = lastName + ' from ' + place;

      if (productEl) productEl.textContent = product;
      if (whoEl) whoEl.textContent = whoLine + ' ' + action.line;
      if (timeEl) {
        timeEl.textContent = pick(TIMES);
        timeEl.setAttribute('datetime', new Date().toISOString());
      }
      if (img) {
        img.src = item.image || '';
        img.alt = product + ' product image';
      }
      if (link) {
        link.href = item.url || '#';
        link.setAttribute('aria-label', 'View ' + product);
      }
      root.setAttribute('data-kind', action.id);
      root.hidden = false;
      window.requestAnimationFrame(function () {
        root.classList.add('is-visible');
      });
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hideCard, visibleFor);
    }

    function cycle() {
      if (dismissed || document.hidden) {
        cycleTimer = window.setTimeout(cycle, interval);
        return;
      }
      showCard();
      cycleTimer = window.setTimeout(cycle, interval + 400);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dismissed = true;
        window.clearTimeout(hideTimer);
        window.clearTimeout(cycleTimer);
        hideCard();
      }, { passive: false });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        root.classList.remove('is-visible');
        root.hidden = true;
        window.clearTimeout(hideTimer);
      }
    }, { passive: true });

    function start() {
      if (dismissed) return;
      cycleTimer = window.setTimeout(cycle, firstDelay);
    }

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(start, { timeout: firstDelay + 2000 });
    } else {
      window.setTimeout(start, 2000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

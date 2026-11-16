/*
  ============================================================================
  PRODUCT FAQ — JavaScript (~110 lines)
  ----------------------------------------------------------------------------
  1. Category tab filtering — hides items not matching active category.
  2. Live search — debounced, filters by question + answer text.
  3. Accordion — one item open at a time, grid-template-rows animation.
  4. Combined filter: category × search work together.
  ============================================================================
*/
(function () {
  'use strict';

  function initFAQ(section) {
    var items     = Array.prototype.slice.call(section.querySelectorAll('[data-pfaq-item]'));
    var cats      = section.querySelector('[data-pfaq-cats]');
    var searchEl  = section.querySelector('[data-pfaq-search]');
    var clearBtn  = section.querySelector('[data-pfaq-clear]');
    var emptyEl   = section.querySelector('[data-pfaq-empty]');
    var openItem  = null;

    var activeCat = 'all';
    var searchVal = '';

    /* ── Filter logic ─────────────────────────────────────────────────── */
    function applyFilter() {
      var visible = 0;
      items.forEach(function (item) {
        var cat     = item.dataset.pfaqCategory || '';
        var q       = item.dataset.pfaqQuestion || '';
        var a       = item.dataset.pfaqAnswer   || '';
        var catOk   = activeCat === 'all' || cat === activeCat;
        var termLow = searchVal.toLowerCase().trim();
        var srchOk  = termLow === '' || q.includes(termLow) || a.includes(termLow);

        var show = catOk && srchOk;
        item.hidden = !show;
        if (show) visible++;
      });
      if (emptyEl) emptyEl.hidden = visible > 0;
    }

    /* ── Category tabs ────────────────────────────────────────────────── */
    if (cats) {
      cats.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-pfaq-cat]');
        if (!btn) return;
        activeCat = btn.dataset.pfaqCat;
        cats.querySelectorAll('[data-pfaq-cat]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        applyFilter();
      });
    }

    /* ── Search ───────────────────────────────────────────────────────── */
    var debounceT;
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        searchVal = this.value;
        if (clearBtn) clearBtn.hidden = !searchVal;
        clearTimeout(debounceT);
        debounceT = setTimeout(applyFilter, 200);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchEl) { searchEl.value = ''; searchEl.focus(); }
        searchVal = '';
        this.hidden = true;
        clearTimeout(debounceT);
        applyFilter();
      });
    }

    /* ── Accordion ────────────────────────────────────────────────────── */
    function closeItem(item) {
      item.classList.remove('is-open');
      var trigger = item.querySelector('.pfaq__trigger');
      var body    = item.querySelector('.pfaq__body');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      if (body)    body.setAttribute('aria-hidden', 'true');
    }

    function openAcc(item) {
      if (openItem && openItem !== item) closeItem(openItem);
      item.classList.add('is-open');
      var trigger = item.querySelector('.pfaq__trigger');
      var body    = item.querySelector('.pfaq__body');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      if (body)    body.setAttribute('aria-hidden', 'false');
      openItem = item;
    }

    section.addEventListener('click', function (e) {
      var trigger = e.target.closest('.pfaq__trigger');
      if (!trigger) return;
      var item = trigger.closest('[data-pfaq-item]');
      if (!item) return;
      if (item.classList.contains('is-open')) {
        closeItem(item);
        openItem = null;
      } else {
        openAcc(item);
      }
    });

    /* Keyboard: space/enter on trigger already handled by button semantics */
  }

  function boot() {
    document.querySelectorAll('[data-pfaq-section]').forEach(initFAQ);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  document.addEventListener('shopify:section:load', function (e) {
    var s = e.target.querySelector('[data-pfaq-section]');
    if (s) initFAQ(s);
  });
})();

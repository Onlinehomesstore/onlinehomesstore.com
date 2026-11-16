/**
 * Suppress Shopify cookie consent banner if injected after load.
 */
(function () {
  if (window.__UC_COOKIE_SUPPRESS__) return;
  window.__UC_COOKIE_SUPPRESS__ = true;

  var SEL =
    '#shopify-pc__banner,#shopify-pc__prefs__dialog,.shopify-pc__banner__dialog,[data-shopify-privacy-banner],.shopify-privacy-banner-container';

  function hide(node) {
    if (!node || node.nodeType !== 1) return;
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
  }

  function sweep() {
    document.querySelectorAll(SEL).forEach(hide);
  }

  sweep();
  document.addEventListener('DOMContentLoaded', sweep);
  new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
})();

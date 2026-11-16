/*
  uc-mobile-filter-portal.js
  Moves the mobile filter <menu-drawer> to <body> on small screens
  so position:fixed is never trapped by content-visibility/contain ancestors.
  Desktop (≥990px) is untouched — the element stays in place.
*/
(function () {
  if (window.innerWidth >= 990) return;

  var drawer = document.querySelector(
    '.template-collection menu-drawer.mobile-facets__wrapper, ' +
    '.template-search menu-drawer.mobile-facets__wrapper'
  );
  if (!drawer) return;

  var placeholder = document.createComment('uc-filter-portal');
  drawer.parentNode.insertBefore(placeholder, drawer);
  document.body.appendChild(drawer);
})();

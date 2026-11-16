/* Contact page hub — nest FAQ/details into the inquiry sidebar */
(function () {
  if (window.__UC_CONTACT_HUB__) return;
  window.__UC_CONTACT_HUB__ = true;

  function nestContactInfo() {
    var host = document.querySelector('[data-uci-info-host]');
    if (!host || host.dataset.ready === '1') return;
    var main = document.getElementById('MainContent');
    if (!main) return;
    var move = [];
    main.querySelectorAll('.shopify-section').forEach(function (sec) {
      var id = sec.id || '';
      if (id.indexOf('faq_preview') !== -1 || id.indexOf('__details') !== -1 || /details$/.test(id)) {
        if (move.indexOf(sec) === -1) move.push(sec);
        return;
      }
      if (sec.querySelector('.pfaq') || sec.querySelector('.ucd')) {
        if (move.indexOf(sec) === -1) move.push(sec);
      }
    });
    if (!move.length) return;
    move.forEach(function (sec) {
      sec.classList.add('uci-nested-section');
      host.appendChild(sec);
    });
    host.dataset.ready = '1';
    document.documentElement.classList.add('uc-contact-hub-nested');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', nestContactInfo);
  } else {
    nestContactInfo();
  }
})();

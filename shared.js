// IMMO PRO-X — Shared scripts
(function () {
  // ───────────────────────────────────────────────────────────────────────
  // Mobile nav toggle
  // ───────────────────────────────────────────────────────────────────────
  function initMobileNav() {
    var burger = document.querySelector('.nav-burger');
    var panel = document.querySelector('.nav-mobile');
    if (!burger || !panel) return;

    function close() {
      burger.setAttribute('aria-expanded', 'false');
      panel.classList.remove('open');
      document.body.classList.remove('nav-open');
    }
    function open() {
      burger.setAttribute('aria-expanded', 'true');
      panel.classList.add('open');
      document.body.classList.add('nav-open');
    }

    burger.addEventListener('click', function () {
      var expanded = burger.getAttribute('aria-expanded') === 'true';
      if (expanded) close(); else open();
    });

    panel.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 960) close();
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Cookie consent banner — gates GTM until accepted.
  // Choice persisted in localStorage. On accept, fire dataLayer event so
  // GTM can release tags that depend on consent.
  // ───────────────────────────────────────────────────────────────────────
  var STORAGE_KEY = 'ipx_cookie_consent_v1';

  function loadGTM() {
    if (window.__gtmLoaded) return;
    window.__gtmLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0];
      var j = d.createElement(s);
      var dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', 'GTM-NF3G7HXL');
  }

  function consentRecorded() {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
  }
  function consentAccepted() {
    try { return localStorage.getItem(STORAGE_KEY) === 'accepted'; } catch (e) { return false; }
  }
  function setConsent(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) {}
  }

  function initCookieBanner() {
    if (consentAccepted()) {
      loadGTM();
    }
    if (consentRecorded()) return;

    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Consentement aux cookies');
    banner.innerHTML = ''
      + '<div class="cookie-inner">'
      + '  <p>Nous utilisons des cookies pour mesurer l\'audience du site et améliorer votre expérience. '
      + '     Vous pouvez accepter ou refuser. En savoir plus dans notre <a href="/confidentialite">politique de confidentialité</a>.</p>'
      + '  <div class="cookie-actions">'
      + '    <button type="button" class="cookie-decline">Refuser</button>'
      + '    <button type="button" class="cookie-accept">Accepter</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(banner);
    // double rAF to allow CSS transitions in future versions
    requestAnimationFrame(function () { banner.classList.add('show'); });

    banner.querySelector('.cookie-accept').addEventListener('click', function () {
      setConsent('accepted');
      banner.classList.remove('show');
      banner.remove();
      loadGTM();
      // Notifie tracking.js que le consentement vient d'être donné
      try { window.dispatchEvent(new Event('cookie-consent-given')); } catch (e) {}
    });
    banner.querySelector('.cookie-decline').addEventListener('click', function () {
      setConsent('declined');
      banner.classList.remove('show');
      banner.remove();
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    initMobileNav();
    initCookieBanner();
  });
})();

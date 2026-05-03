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

    // Styles inline pour garantir le rendu indépendamment de shared.css
    var bannerStyle = [
      'position:fixed', 'left:24px', 'right:24px', 'bottom:24px',
      'z-index:99999',
      'background:#ffffff',
      'border:1px solid #e3e8ef',
      'border-radius:16px',
      'box-shadow:0 12px 40px rgba(10,37,64,0.18), 0 4px 12px rgba(10,37,64,0.08)',
      'padding:18px 22px',
      'display:flex', 'align-items:center', 'justify-content:space-between',
      'gap:18px', 'flex-wrap:wrap',
      'max-width:980px', 'margin:0 auto',
      'font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif',
      'opacity:0', 'transform:translateY(20px)',
      'transition:opacity .35s ease, transform .35s cubic-bezier(.16,1,.3,1)'
    ].join(';');

    var textStyle = 'flex:1;min-width:240px;font-size:13px;line-height:1.6;color:#425466;margin:0';
    var linkStyle = 'color:#0579da;font-weight:600;text-decoration:underline';
    var actionsStyle = 'display:flex;gap:10px;flex-wrap:wrap;flex-shrink:0';
    var btnBase = 'font-family:inherit;font-size:13px;font-weight:700;padding:11px 22px;border-radius:999px;cursor:pointer;transition:all .2s;border:1.5px solid';
    var declineStyle = btnBase + ';background:#ffffff;color:#64748b;border-color:#e3e8ef';
    var acceptStyle = btnBase + ';background:#0579da;color:#ffffff;border-color:#0579da;box-shadow:0 4px 12px rgba(5,121,218,0.25)';

    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Consentement aux cookies');
    banner.style.cssText = bannerStyle;
    banner.innerHTML = ''
      + '<p style="' + textStyle + '">'
      + '🍪 Nous utilisons des cookies pour mesurer l\'audience et améliorer votre expérience. '
      + '<a href="/confidentialite" style="' + linkStyle + '">En savoir plus</a>.'
      + '</p>'
      + '<div style="' + actionsStyle + '">'
      + '  <button type="button" class="cookie-decline" style="' + declineStyle + '">Refuser</button>'
      + '  <button type="button" class="cookie-accept" style="' + acceptStyle + '">Accepter</button>'
      + '</div>';
    document.body.appendChild(banner);

    // Animation d'entrée slide-up + fade-in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.style.opacity = '1';
        banner.style.transform = 'translateY(0)';
      });
    });

    function dismissBanner() {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(20px)';
      setTimeout(function () { if (banner.parentNode) banner.remove(); }, 350);
    }

    banner.querySelector('.cookie-accept').addEventListener('click', function () {
      setConsent('accepted');
      dismissBanner();
      loadGTM();
      try { window.dispatchEvent(new Event('cookie-consent-given')); } catch (e) {}
    });
    banner.querySelector('.cookie-decline').addEventListener('click', function () {
      setConsent('declined');
      dismissBanner();
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

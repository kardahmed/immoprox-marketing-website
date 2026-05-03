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
  // Cookie consent — modal RGPD avec consentement granulaire par catégorie.
  // Persiste un objet JSON en localStorage avec les choix par catégorie.
  // ───────────────────────────────────────────────────────────────────────
  var STORAGE_KEY = 'ipx_cookie_consent_v2';
  var LEGACY_KEY = 'ipx_cookie_consent_v1';

  var CATEGORIES = [
    { id: 'essential', label: 'Cookies essentiels', desc: 'Indispensables au fonctionnement du site (sécurité, formulaires, préférences). Toujours actifs.', required: true },
    { id: 'analytics', label: 'Mesure d\'audience', desc: 'Statistiques anonymes pour comprendre comment vous utilisez le site (Google Analytics, Microsoft Clarity).', required: false },
    { id: 'marketing', label: 'Marketing & publicité', desc: 'Personnalisation des publicités et mesure des campagnes (Meta Pixel, TikTok, LinkedIn, Google Ads).', required: false },
    { id: 'personalization', label: 'Personnalisation', desc: 'Outils de communication et chat (HubSpot, Intercom).', required: false }
  ];

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

  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
      // Migration depuis l'ancien format v1 (accepted/declined)
      var legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy === 'accepted') {
        return { v: 2, essential: true, analytics: true, marketing: true, personalization: true };
      }
      if (legacy === 'declined') {
        return { v: 2, essential: true, analytics: false, marketing: false, personalization: false };
      }
    } catch (e) {}
    return null;
  }
  function consentRecorded() { return !!getConsent(); }
  function consentAccepted() {
    var c = getConsent();
    return c && (c.analytics || c.marketing);
  }
  function saveConsent(consent) {
    consent.v = 2;
    consent.essential = true;
    consent.ts = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch (e) {}
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
    // Compat avec tracking.js qui attend ipx_cookie_consent_v1
    try {
      localStorage.setItem(LEGACY_KEY, (consent.analytics || consent.marketing) ? 'accepted' : 'declined');
    } catch (e) {}
  }

  function initCookieBanner() {
    var existing = getConsent();
    if (existing) {
      if (existing.analytics || existing.marketing) loadGTM();
      return;
    }

    // ── Construction de la modal ─────────────────────────────────────────
    var FONT = 'Inter,-apple-system,BlinkMacSystemFont,sans-serif';
    var COLOR_DARK = '#0A2540';
    var COLOR_GRAY = '#425466';
    var COLOR_MUTED = '#8898AA';
    var COLOR_BLUE = '#0579DA';
    var COLOR_BORDER = '#E3E8EF';

    var overlay = document.createElement('div');
    overlay.id = 'cookie-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cookie-title');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(10,37,64,0.55)',
      'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
      'display:flex', 'align-items:flex-end', 'justify-content:center',
      'padding:0',
      'opacity:0',
      'transition:opacity .35s ease',
      'font-family:' + FONT,
      'overflow-y:auto'
    ].join(';');

    // Mobile : bottom sheet ; desktop : carte centrée
    var isDesktop = window.innerWidth >= 720;
    var modalCss = isDesktop
      ? 'background:#fff;border-radius:20px;max-width:560px;width:calc(100% - 48px);margin:auto;padding:32px;box-shadow:0 24px 60px rgba(10,37,64,0.25);transform:translateY(20px);transition:transform .35s cubic-bezier(.16,1,.3,1);max-height:calc(100vh - 48px);overflow-y:auto'
      : 'background:#fff;border-radius:20px 20px 0 0;width:100%;padding:24px 20px 28px;transform:translateY(100%);transition:transform .4s cubic-bezier(.16,1,.3,1);max-height:90vh;overflow-y:auto';

    var modal = document.createElement('div');
    modal.style.cssText = modalCss;

    // Construction du HTML
    var catsHtml = CATEGORIES.map(function (cat) {
      var checked = cat.required ? 'checked disabled' : 'checked';
      return '' +
        '<div data-cat="' + cat.id + '" style="padding:16px 0;border-bottom:1px solid ' + COLOR_BORDER + '">' +
        '  <label style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;cursor:' + (cat.required ? 'not-allowed' : 'pointer') + '">' +
        '    <div style="flex:1;min-width:0">' +
        '      <div style="font-weight:700;font-size:14px;color:' + COLOR_DARK + ';margin-bottom:4px">' + cat.label + (cat.required ? ' <span style="font-size:10px;color:' + COLOR_MUTED + ';font-weight:600;margin-left:6px">REQUIS</span>' : '') + '</div>' +
        '      <div style="font-size:12px;color:' + COLOR_GRAY + ';line-height:1.5">' + cat.desc + '</div>' +
        '    </div>' +
        '    <div style="position:relative;flex-shrink:0">' +
        '      <input type="checkbox" data-toggle="' + cat.id + '" ' + checked + ' style="position:absolute;opacity:0;pointer-events:none">' +
        '      <div data-switch="' + cat.id + '" style="width:40px;height:22px;background:' + (cat.required ? COLOR_BLUE : COLOR_BLUE) + ';border-radius:999px;position:relative;transition:background .2s;' + (cat.required ? 'opacity:0.5;' : '') + '">' +
        '        <div data-switch-thumb="' + cat.id + '" style="position:absolute;top:2px;left:20px;width:18px;height:18px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>' +
        '      </div>' +
        '    </div>' +
        '  </label>' +
        '</div>';
    }).join('');

    modal.innerHTML = '' +
      '<div style="text-align:center;margin-bottom:20px">' +
      '  <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(5,121,218,0.1);border-radius:16px;font-size:28px;margin-bottom:14px">🍪</div>' +
      '  <h2 id="cookie-title" style="font-size:22px;font-weight:800;color:' + COLOR_DARK + ';margin:0 0 8px;letter-spacing:-0.3px">Vos cookies, votre choix</h2>' +
      '  <p style="font-size:13px;color:' + COLOR_GRAY + ';margin:0;line-height:1.6;max-width:440px;margin:0 auto">' +
      '    Nous utilisons des cookies pour mesurer l\'audience, améliorer votre expérience et personnaliser le contenu. ' +
      '    <a href="/confidentialite" style="color:' + COLOR_BLUE + ';font-weight:600">En savoir plus</a>' +
      '  </p>' +
      '</div>' +
      '<div data-customize style="display:none;border-top:1px solid ' + COLOR_BORDER + ';margin:18px -8px 0">' + catsHtml + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:22px">' +
      '  <button type="button" data-action="accept-all" style="' + btnPrimary() + '">Tout accepter</button>' +
      '  <div style="display:flex;gap:8px">' +
      '    <button type="button" data-action="reject-all" style="' + btnSecondary() + ';flex:1">Tout refuser</button>' +
      '    <button type="button" data-action="customize" style="' + btnSecondary() + ';flex:1">Personnaliser</button>' +
      '  </div>' +
      '  <button type="button" data-action="save" style="' + btnPrimary() + ';display:none;margin-top:4px">Enregistrer mes choix</button>' +
      '</div>' +
      '<p style="font-size:11px;color:' + COLOR_MUTED + ';margin:18px 0 0;text-align:center;line-height:1.5">' +
      '  Vous pourrez modifier vos choix à tout moment depuis la page <a href="/confidentialite" style="color:' + COLOR_GRAY + ';font-weight:600">Confidentialité</a>.' +
      '</p>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';

    // Animation d'entrée
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.opacity = '1';
        modal.style.transform = 'translateY(0)';
      });
    });

    function btnPrimary() {
      return 'font-family:' + FONT + ';font-size:14px;font-weight:700;padding:14px 24px;border-radius:12px;cursor:pointer;border:none;background:' + COLOR_BLUE + ';color:#fff;width:100%;transition:all .2s;box-shadow:0 4px 12px rgba(5,121,218,0.25)';
    }
    function btnSecondary() {
      return 'font-family:' + FONT + ';font-size:13px;font-weight:600;padding:12px 18px;border-radius:12px;cursor:pointer;background:#fff;color:' + COLOR_GRAY + ';border:1.5px solid ' + COLOR_BORDER + ';transition:all .2s';
    }

    function setSwitchVisual(catId, on) {
      var sw = modal.querySelector('[data-switch="' + catId + '"]');
      var thumb = modal.querySelector('[data-switch-thumb="' + catId + '"]');
      if (!sw || !thumb) return;
      sw.style.background = on ? COLOR_BLUE : '#cbd5e1';
      thumb.style.left = on ? '20px' : '2px';
    }

    // Wire toggles
    CATEGORIES.forEach(function (cat) {
      if (cat.required) return;
      var label = modal.querySelector('[data-cat="' + cat.id + '"] label');
      label.addEventListener('click', function (e) {
        e.preventDefault();
        var input = modal.querySelector('[data-toggle="' + cat.id + '"]');
        input.checked = !input.checked;
        setSwitchVisual(cat.id, input.checked);
      });
    });

    function getChoicesFromUI() {
      var consent = { essential: true };
      CATEGORIES.forEach(function (cat) {
        if (cat.required) { consent[cat.id] = true; return; }
        var input = modal.querySelector('[data-toggle="' + cat.id + '"]');
        consent[cat.id] = !!(input && input.checked);
      });
      return consent;
    }

    function close() {
      overlay.style.opacity = '0';
      modal.style.transform = isDesktop ? 'translateY(20px)' : 'translateY(100%)';
      setTimeout(function () {
        if (overlay.parentNode) overlay.remove();
        document.documentElement.style.overflow = '';
      }, 400);
    }

    function applyConsent(consent) {
      saveConsent(consent);
      close();
      if (consent.analytics || consent.marketing) {
        loadGTM();
        try { window.dispatchEvent(new Event('cookie-consent-given')); } catch (e) {}
      }
    }

    // Wire actions
    modal.querySelector('[data-action="accept-all"]').addEventListener('click', function () {
      applyConsent({ essential: true, analytics: true, marketing: true, personalization: true });
    });
    modal.querySelector('[data-action="reject-all"]').addEventListener('click', function () {
      applyConsent({ essential: true, analytics: false, marketing: false, personalization: false });
    });
    modal.querySelector('[data-action="customize"]').addEventListener('click', function () {
      var customize = modal.querySelector('[data-customize]');
      var saveBtn = modal.querySelector('[data-action="save"]');
      customize.style.display = 'block';
      saveBtn.style.display = 'block';
      this.style.display = 'none';
    });
    modal.querySelector('[data-action="save"]').addEventListener('click', function () {
      applyConsent(getChoicesFromUI());
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

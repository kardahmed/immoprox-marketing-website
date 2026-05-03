/* ═══════════════════════════════════════════════════════════════════════════
 *  IMMO PRO-X — Tracking Full Stack v2 (config dynamique via Supabase)
 *  ───────────────────────────────────────────────────────────────────────────
 *  Récupère automatiquement les IDs / pixels depuis Supabase site_config.
 *  Aucune clé en dur dans ce fichier — TOUT se gère depuis /admin.
 *
 *  Cycle de vie :
 *  1. Au chargement, fetch /functions/v1/config → retourne les clés ACTIVÉES
 *  2. Cache en localStorage (TTL 5 min) pour éviter un appel par page
 *  3. Pour chaque clé présente, charge automatiquement le tracker correspondant
 *  4. Expose window.IMMOTrack avec les méthodes lead(), click_cta(), etc.
 *
 *  Respect du consentement cookie (clé localStorage `ipx_cookie_consent_v1`).
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://lbnqccsebwiifxcucflg.supabase.co';
  var CONFIG_ENDPOINT = SUPABASE_URL + '/functions/v1/config';
  var CAPI_ENDPOINT = SUPABASE_URL + '/functions/v1/meta-capi';
  var WHATSAPP_ENDPOINT = SUPABASE_URL + '/functions/v1/whatsapp-send';
  var CACHE_KEY = 'ipx_tracking_config_v1';
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  function getConsent() {
    try {
      var raw = localStorage.getItem('ipx_cookie_consent_v2');
      if (raw) return JSON.parse(raw);
      // Fallback v1 : tout accepté ou tout refusé
      var legacy = localStorage.getItem('ipx_cookie_consent_v1');
      if (legacy === 'accepted') return { analytics: true, marketing: true, personalization: true };
      if (legacy === 'declined') return { analytics: false, marketing: false, personalization: false };
    } catch (_) {}
    return null;
  }
  function consentGiven() {
    var c = getConsent();
    return !!(c && (c.analytics || c.marketing));
  }
  function allowsAnalytics() {
    var c = getConsent();
    return !!(c && c.analytics);
  }
  function allowsMarketing() {
    var c = getConsent();
    return !!(c && c.marketing);
  }
  function allowsPersonalization() {
    var c = getConsent();
    return !!(c && c.personalization);
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  async function sha256(text) {
    if (!text || !window.crypto || !window.crypto.subtle) return null;
    var buffer = new TextEncoder().encode(text.trim().toLowerCase());
    var hash = await window.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function getCookie(name) {
    var v = ('; ' + document.cookie).split('; ' + name + '=');
    return v.length === 2 ? v.pop().split(';').shift() : null;
  }

  // ─── ATTRIBUTION (UTM + click IDs persistés) ────────────────────────────
  function captureAttribution() {
    try {
      var params = new URLSearchParams(location.search);
      var stored = JSON.parse(localStorage.getItem('attribution') || '{}');
      var keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content',
                  'gclid','fbclid','ttclid','li_fat_id','msclkid'];
      var updated = false;
      keys.forEach(function (k) {
        var v = params.get(k);
        if (v && v !== stored[k]) { stored[k] = v; updated = true; }
      });
      if (!stored.first_landing) {
        stored.first_landing = location.href;
        stored.first_referrer = document.referrer || '(direct)';
        stored.first_visit_at = new Date().toISOString();
        updated = true;
      }
      if (updated) localStorage.setItem('attribution', JSON.stringify(stored));
      return stored;
    } catch (_) { return {}; }
  }
  var ATTR = captureAttribution();

  // ─── CONFIG : fetch + cache ─────────────────────────────────────────────
  async function fetchConfig() {
    try {
      var cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && Date.now() - parsed.fetched_at < CACHE_TTL_MS) {
          return parsed.config;
        }
      }
    } catch (_) {}

    try {
      var res = await fetch(CONFIG_ENDPOINT);
      if (!res.ok) throw new Error('Config fetch failed');
      var json = await res.json();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ config: json.config || {}, fetched_at: Date.now() }));
      } catch (_) {}
      return json.config || {};
    } catch (err) {
      console.warn('Tracking config fetch failed', err);
      return {};
    }
  }

  // ─── 1. Google Tag Manager ──────────────────────────────────────────────
  function loadGTM(gtmId) {
    if (!gtmId || window.__gtmLoaded) return;
    window.__gtmLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0],
          j = d.createElement(s), dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', gtmId);
  }

  // ─── 2. Google Analytics 4 + Google Ads ─────────────────────────────────
  function loadGoogleTags(ga4Id, gadsId) {
    var primary = ga4Id || gadsId;
    if (!primary || window.__gtagLoaded) return;
    window.__gtagLoaded = true;

    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + primary;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    if (ga4Id) gtag('config', ga4Id, { anonymize_ip: true, send_page_view: true });
    if (gadsId) gtag('config', gadsId);
  }

  // ─── 3. Meta Pixel ───────────────────────────────────────────────────────
  function loadMetaPixel(pixelId) {
    if (!pixelId || window.fbq) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', pixelId);
    fbq('track', 'PageView');
  }

  // ─── 4. TikTok Pixel ────────────────────────────────────────────────────
  function loadTikTokPixel(id) {
    if (!id || window.ttq) return;
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
      ttq.methods = ['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
      ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; };
      ttq.load = function (e, n) {
        var r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
        ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {};
        var i = d.createElement('script'); i.type = 'text/javascript'; i.async = !0;
        i.src = r + '?sdkid=' + e + '&lib=' + t;
        var a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(i, a);
      };
      ttq.load(id); ttq.page();
    }(window, document, 'ttq');
  }

  // ─── 5. LinkedIn Insight Tag ────────────────────────────────────────────
  function loadLinkedIn(partnerId) {
    if (!partnerId || window._linkedin_partner_id) return;
    window._linkedin_partner_id = partnerId;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(partnerId);
    (function (l) {
      if (!l) {
        window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); };
        window.lintrk.q = [];
      }
      var s = document.getElementsByTagName('script')[0];
      var b = document.createElement('script');
      b.type = 'text/javascript'; b.async = true;
      b.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
      s.parentNode.insertBefore(b, s);
    })(window.lintrk);
  }

  // ─── 6. Microsoft Clarity ───────────────────────────────────────────────
  function loadClarity(id) {
    if (!id || window.clarity) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', id);
  }

  // ─── 7. Hotjar ──────────────────────────────────────────────────────────
  function loadHotjar(id) {
    if (!id || window.hj) return;
    (function(h,o,t,j,a,r){
      h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
      h._hjSettings={hjid:id,hjsv:6};
      a=o.getElementsByTagName('head')[0];
      r=o.createElement('script');r.async=1;
      r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
      a.appendChild(r);
    })(window,document,'https://static.hotjar.com/c/hotjar-',  '.js?sv=');
  }

  // ─── 8. HubSpot tracking ────────────────────────────────────────────────
  function loadHubSpot(hubId) {
    if (!hubId || window.HubSpotConversations) return;
    var s = document.createElement('script');
    s.type = 'text/javascript'; s.id = 'hs-script-loader'; s.async = true; s.defer = true;
    s.src = '//js.hs-scripts.com/' + hubId + '.js';
    document.head.appendChild(s);
  }

  // ─── 9. Sentry (errors) ─────────────────────────────────────────────────
  function loadSentry(dsn) {
    if (!dsn || window.Sentry) return;
    var s = document.createElement('script');
    s.src = 'https://browser.sentry-cdn.com/7.99.0/bundle.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = function () {
      window.Sentry.init({ dsn: dsn, tracesSampleRate: 0.1 });
    };
    document.head.appendChild(s);
  }

  // ─── INIT (orchestrateur) ───────────────────────────────────────────────
  var CONFIG = {};
  async function initAll() {
    if (!consentGiven()) return;
    CONFIG = await fetchConfig();

    // GTM est un container neutre, chargé dès qu'analytics OU marketing consenti
    if (allowsAnalytics() || allowsMarketing()) {
      loadGTM(CONFIG.gtm_id);
    }

    // Catégorie ANALYTICS (mesure d'audience)
    if (allowsAnalytics()) {
      loadGoogleTags(CONFIG.ga4_id, null);
      loadClarity(CONFIG.clarity_id);
      loadHotjar(CONFIG.hotjar_id);
    }

    // Catégorie MARKETING (publicité)
    if (allowsMarketing()) {
      loadGoogleTags(null, CONFIG.gads_conversion_id);
      loadMetaPixel(CONFIG.meta_pixel_id);
      loadTikTokPixel(CONFIG.tiktok_pixel_id);
      loadLinkedIn(CONFIG.linkedin_partner_id);
    }

    // Catégorie PERSONALIZATION (chat, support)
    if (allowsPersonalization()) {
      loadHubSpot(CONFIG.hubspot_hub_id);
    }

    // Sentry est dans la catégorie ESSENTIELLE (monitoring d'erreurs)
    loadSentry(CONFIG.sentry_dsn);
  }

  // ─── ÉVÉNEMENTS DE CONVERSION (API publique) ────────────────────────────
  window.IMMOTrack = {
    /** Conversion principale — soumission formulaire complet */
    lead: async function (data) {
      data = data || {};
      var eventId = uuid();
      var value = data.value || 0;
      var currency = data.currency || 'EUR';

      if (window.gtag) {
        gtag('event', 'generate_lead', {
          event_id: eventId, value: value, currency: currency,
          form_destination: data.form_destination || 'contact',
        });
        if (CONFIG.gads_conversion_id && CONFIG.gads_conversion_label) {
          gtag('event', 'conversion', {
            send_to: CONFIG.gads_conversion_id + '/' + CONFIG.gads_conversion_label,
            value: value, currency: currency, transaction_id: eventId,
          });
        }
      }
      if (window.fbq) fbq('track', 'Lead', { value: value, currency: currency }, { eventID: eventId });
      if (window.ttq) ttq.track('SubmitForm', { value: value, currency: currency, event_id: eventId });
      if (window.lintrk && CONFIG.linkedin_conversion_id) lintrk('track', { conversion_id: CONFIG.linkedin_conversion_id });

      // Meta Conversions API server-side (dédup avec event_id)
      if (CONFIG.meta_pixel_id) {
        try {
          // Split du nom complet en prénom + nom (pour EMQ Meta optimal)
          var nameParts = (data.name || '').trim().split(/\s+/);
          var firstName = nameParts[0] || '';
          var lastName = nameParts.slice(1).join(' ') || '';

          var hashedEmail = await sha256(data.email);
          var hashedPhone = await sha256((data.phone || '').replace(/[^0-9]/g, ''));
          var hashedFirstName = await sha256(firstName);
          var hashedLastName = await sha256(lastName);
          var hashedCountry = await sha256(data.country || 'dz');
          var hashedState = await sha256(data.state || data.wilaya || '');
          var hashedCity = await sha256(data.city || '');

          fetch(CAPI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_name: 'Lead',
              event_id: eventId,
              event_time: Math.floor(Date.now() / 1000),
              event_source_url: location.href,
              action_source: 'website',
              user_data: {
                em: hashedEmail ? [hashedEmail] : [],
                ph: hashedPhone ? [hashedPhone] : [],
                fn: hashedFirstName ? [hashedFirstName] : [],
                ln: hashedLastName ? [hashedLastName] : [],
                country: hashedCountry ? [hashedCountry] : [],
                st: hashedState ? [hashedState] : [],
                ct: hashedCity ? [hashedCity] : [],
                external_id: data.external_id ? [String(data.external_id)] : [],
                fbp: getCookie('_fbp'),
                fbc: getCookie('_fbc'),
              },
              custom_data: {
                value: value, currency: currency,
                content_name: data.form_destination || 'contact',
              },
              attribution: ATTR,
            }),
            keepalive: true,
          }).catch(function (e) { console.warn('CAPI failed', e); });
        } catch (e) { console.warn('CAPI hash failed', e); }
      }

      // WhatsApp auto-message au lead (server-side)
      if (data.phone && CONFIG.whatsapp_phone_id) {
        try {
          fetch(WHATSAPP_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: data.phone,
              language: 'fr',
              template_params: [data.name || 'Bonjour'],
              text: 'Bonjour ' + (data.name || '') + ', merci pour votre demande IMMO PRO-X. Notre équipe vous recontacte sous 24 h ouvrées. À très vite !',
            }),
            keepalive: true,
          }).catch(function (e) { console.warn('WhatsApp failed', e); });
        } catch (_) {}
      }

      return eventId;
    },

    click_cta: function (label, location_hint) {
      if (window.gtag) gtag('event', 'click_cta', { cta_label: label, cta_location: location_hint || '' });
      if (window.fbq) fbq('trackCustom', 'ClickCTA', { label: label, location: location_hint });
    },

    contact_intent: function (channel) {
      if (window.gtag) gtag('event', 'contact_intent', { channel: channel });
      if (window.fbq) fbq('track', 'Contact', { channel: channel });
    },

    schedule: function () {
      if (window.gtag) gtag('event', 'schedule', { method: 'cal' });
      if (window.fbq) fbq('track', 'Schedule');
    },

    form_start: function (form_name) {
      if (window.gtag) gtag('event', 'form_start', { form_name: form_name });
    },

    form_step: function (form_name, step) {
      if (window.gtag) gtag('event', 'form_step', { form_name: form_name, step: step });
    },
  };

  // ─── AUTO-WIRING (clics CTA détectés via attributs) ─────────────────────
  function wireAutoTracking() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-cta], a[href^="https://wa.me"], a[href^="mailto:"], a[href^="tel:"], a[href*="cal.eu"]');
      if (!el) return;
      var cta = el.dataset.cta;
      var href = el.getAttribute('href') || '';
      if (cta) IMMOTrack.click_cta(cta, location.pathname);
      else if (href.indexOf('wa.me') !== -1) IMMOTrack.contact_intent('whatsapp');
      else if (href.indexOf('mailto:') === 0) IMMOTrack.contact_intent('email');
      else if (href.indexOf('tel:') === 0) IMMOTrack.contact_intent('phone');
      else if (href.indexOf('cal.eu') !== -1) IMMOTrack.schedule();
    }, { passive: true });

    document.querySelectorAll('form').forEach(function (form) {
      var started = false;
      form.addEventListener('focusin', function () {
        if (started) return;
        started = true;
        IMMOTrack.form_start(form.id || 'unnamed-form');
      }, { passive: true, capture: true });
    });
  }

  // ─── BOOT ────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); wireAutoTracking(); });
  } else {
    initAll();
    wireAutoTracking();
  }
  window.addEventListener('cookie-consent-given', initAll);
  window.__IMMOTrackConfig = function () { return CONFIG; };
})();

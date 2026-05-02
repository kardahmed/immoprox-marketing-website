/* ═══════════════════════════════════════════════════════════════════════════
 *  IMMO PRO-X — Tracking Full Stack
 *  ───────────────────────────────────────────────────────────────────────────
 *  Centralise GA4, Meta Pixel, Meta Conversions API (CAPI), TikTok Pixel,
 *  LinkedIn Insight Tag, Microsoft Clarity et Google Tag Manager.
 *
 *  ⚠ Avant déploiement, REMPLACEZ les placeholders ci-dessous par vos vrais
 *  IDs (cherchez "REMPLACER" dans ce fichier). Voir TRACKING_SETUP.md.
 *
 *  Ce script :
 *  ─ Respecte le consentement cookie (cookie-banner) — rien ne charge tant
 *    que l'utilisateur n'a pas accepté.
 *  ─ Capture UTM + click ID (gclid, fbclid, ttclid, li_fat_id) en localStorage
 *  ─ Émet des events de conversion (lead, contact, schedule, click_cta)
 *  ─ Hash les emails / téléphones côté client avant envoi à Meta CAPI
 *  ─ Génère un event_id unique pour la déduplication Pixel ⇄ CAPI
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── CONFIGURATION (REMPLACER par vos IDs) ──────────────────────────────
  var CONFIG = {
    // Google Analytics 4 — créer une propriété sur analytics.google.com
    GA4_ID: 'G-XXXXXXXXXX', // REMPLACER (ex: G-ABC123XYZ4)

    // Google Ads Conversion ID + Label — depuis ads.google.com → Conversions
    GADS_CONVERSION_ID: 'AW-XXXXXXXXX',   // REMPLACER (ex: AW-1234567890)
    GADS_CONVERSION_LABEL: 'XXXXXXXXX',   // REMPLACER (label de la conversion "Lead")

    // Meta Pixel — depuis business.facebook.com → Events Manager
    META_PIXEL_ID: '000000000000000', // REMPLACER (15 chiffres)

    // Meta Conversions API endpoint (votre edge function — voir capi-template.js)
    META_CAPI_ENDPOINT: '/api/meta-capi', // À configurer côté serveur

    // TikTok Pixel — depuis ads.tiktok.com → Events Manager
    TIKTOK_PIXEL_ID: 'XXXXXXXXXXXXXXXXXXXX', // REMPLACER

    // LinkedIn Insight Tag — depuis campaign manager LinkedIn
    LINKEDIN_PARTNER_ID: '0000000', // REMPLACER

    // Microsoft Clarity (heatmaps, gratuit) — clarity.microsoft.com
    CLARITY_ID: 'XXXXXXXXXX', // REMPLACER

    // GTM (déjà présent dans shared.js)
    GTM_ID: 'GTM-NF3G7HXL',

    // Activer/désactiver chaque outil
    ENABLE: {
      ga4: true,
      gads: true,
      meta_pixel: true,
      meta_capi: false,         // Activez quand l'edge function est déployée
      tiktok: false,            // Activez quand vous en avez un
      linkedin: false,          // Activez quand vous en avez un
      clarity: false,           // Activez quand vous en avez un
      gtm: true,
    },
  };

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  function consentGiven() {
    try { return localStorage.getItem('ipx_cookie_consent_v1') === 'accepted'; }
    catch (_) { return false; }
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // SHA-256 hashing pour Meta CAPI (PII)
  async function sha256(text) {
    if (!text) return null;
    var normalized = text.trim().toLowerCase();
    if (!window.crypto || !window.crypto.subtle) return null;
    var buffer = new TextEncoder().encode(normalized);
    var hash = await window.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  // ─── CAPTURE UTM + CLICK IDS (au chargement) ────────────────────────────
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

  // ─── 1. Google Tag Manager (déjà présent — wrapper pour cohérence) ───────
  function loadGTM() {
    if (!CONFIG.ENABLE.gtm) return;
    if (window.google_tag_manager) return; // déjà chargé
    (function (w, d, s, l, i) {
      w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0],
          j = d.createElement(s), dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', CONFIG.GTM_ID);
  }

  // ─── 2. Google Analytics 4 + Google Ads ─────────────────────────────────
  function loadGoogleTags() {
    if (!CONFIG.ENABLE.ga4 && !CONFIG.ENABLE.gads) return;
    var primaryId = CONFIG.ENABLE.ga4 ? CONFIG.GA4_ID : CONFIG.GADS_CONVERSION_ID;
    if (!primaryId || primaryId.indexOf('XXXXXXXXX') !== -1) return;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + primaryId;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());

    if (CONFIG.ENABLE.ga4 && CONFIG.GA4_ID && CONFIG.GA4_ID.indexOf('X') === -1) {
      gtag('config', CONFIG.GA4_ID, {
        send_page_view: true,
        anonymize_ip: true,
        page_path: location.pathname + location.search,
      });
    }
    if (CONFIG.ENABLE.gads && CONFIG.GADS_CONVERSION_ID && CONFIG.GADS_CONVERSION_ID.indexOf('X') === -1) {
      gtag('config', CONFIG.GADS_CONVERSION_ID);
    }
  }

  // ─── 3. Meta Pixel ───────────────────────────────────────────────────────
  function loadMetaPixel() {
    if (!CONFIG.ENABLE.meta_pixel) return;
    if (!CONFIG.META_PIXEL_ID || CONFIG.META_PIXEL_ID.indexOf('0000') === 0) return;

    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', CONFIG.META_PIXEL_ID);
    fbq('track', 'PageView');
  }

  // ─── 4. TikTok Pixel ────────────────────────────────────────────────────
  function loadTikTokPixel() {
    if (!CONFIG.ENABLE.tiktok) return;
    if (!CONFIG.TIKTOK_PIXEL_ID || CONFIG.TIKTOK_PIXEL_ID.indexOf('XXXX') !== -1) return;

    !function (w, d, t) {
      w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
      ttq.methods = ['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
      ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (t) {
        for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
        return e;
      };
      ttq.load = function (e, n) {
        var r = 'https://analytics.tiktok.com/i18n/pixel/events.js', o = n && n.partner;
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
        ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {};
        var i = d.createElement('script'); i.type = 'text/javascript'; i.async = !0;
        i.src = r + '?sdkid=' + e + '&lib=' + t;
        var a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(i, a);
      };
      ttq.load(CONFIG.TIKTOK_PIXEL_ID); ttq.page();
    }(window, document, 'ttq');
  }

  // ─── 5. LinkedIn Insight Tag ────────────────────────────────────────────
  function loadLinkedIn() {
    if (!CONFIG.ENABLE.linkedin) return;
    if (!CONFIG.LINKEDIN_PARTNER_ID || CONFIG.LINKEDIN_PARTNER_ID.indexOf('0') === 0) return;

    window._linkedin_partner_id = CONFIG.LINKEDIN_PARTNER_ID;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(CONFIG.LINKEDIN_PARTNER_ID);
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

  // ─── 6. Microsoft Clarity (heatmaps, gratuit) ───────────────────────────
  function loadClarity() {
    if (!CONFIG.ENABLE.clarity) return;
    if (!CONFIG.CLARITY_ID || CONFIG.CLARITY_ID.indexOf('XXXX') !== -1) return;

    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CONFIG.CLARITY_ID);
  }

  // ─── INIT (au chargement, après consentement) ───────────────────────────
  function initAll() {
    if (!consentGiven()) return;
    loadGTM();
    loadGoogleTags();
    loadMetaPixel();
    loadTikTokPixel();
    loadLinkedIn();
    loadClarity();
  }

  // ─── ÉVÉNEMENTS DE CONVERSION (API publique) ────────────────────────────
  // Usage : window.IMMOTrack.lead({ email, phone, name, value, currency })
  window.IMMOTrack = {
    /**
     * Conversion principale : un visiteur a soumis le formulaire de démo.
     * Émet vers GA4, Google Ads, Meta Pixel + envoie à Meta CAPI (server-side)
     * pour la déduplication.
     */
    lead: async function (data) {
      data = data || {};
      var eventId = uuid();
      var value = data.value || 0;
      var currency = data.currency || 'EUR';

      // GA4
      if (window.gtag) {
        gtag('event', 'generate_lead', {
          event_id: eventId,
          value: value, currency: currency,
          form_destination: data.form_destination || 'contact',
        });
      }
      // Google Ads conversion
      if (window.gtag && CONFIG.GADS_CONVERSION_ID && CONFIG.GADS_CONVERSION_ID.indexOf('X') === -1) {
        gtag('event', 'conversion', {
          send_to: CONFIG.GADS_CONVERSION_ID + '/' + CONFIG.GADS_CONVERSION_LABEL,
          value: value, currency: currency,
          transaction_id: eventId,
        });
      }
      // Meta Pixel
      if (window.fbq) {
        fbq('track', 'Lead', { value: value, currency: currency }, { eventID: eventId });
      }
      // TikTok
      if (window.ttq) {
        ttq.track('SubmitForm', { value: value, currency: currency, event_id: eventId });
      }
      // LinkedIn
      if (window.lintrk) {
        lintrk('track', { conversion_id: 0 }); // mettre votre conversion_id LinkedIn
      }
      // Meta Conversions API (server-side — pour iOS 14+ et bloqueurs)
      if (CONFIG.ENABLE.meta_capi && CONFIG.META_CAPI_ENDPOINT) {
        try {
          var hashedEmail = await sha256(data.email);
          var hashedPhone = await sha256((data.phone || '').replace(/[^0-9]/g, ''));
          var hashedName = await sha256(data.name);
          fetch(CONFIG.META_CAPI_ENDPOINT, {
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
                fn: hashedName ? [hashedName] : [],
                client_user_agent: navigator.userAgent,
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
      return eventId;
    },

    /** Click sur un CTA majeur (Demander une démo, Réserver un créneau, etc.) */
    click_cta: function (label, location_hint) {
      if (window.gtag) gtag('event', 'click_cta', { cta_label: label, cta_location: location_hint || '' });
      if (window.fbq) fbq('trackCustom', 'ClickCTA', { label: label, location: location_hint });
    },

    /** Click sur lien WhatsApp / Email / Téléphone */
    contact_intent: function (channel) {
      if (window.gtag) gtag('event', 'contact_intent', { channel: channel });
      if (window.fbq) fbq('track', 'Contact', { channel: channel });
    },

    /** Démarrage de la prise de RDV Cal.eu */
    schedule: function () {
      if (window.gtag) gtag('event', 'schedule', { method: 'cal' });
      if (window.fbq) fbq('track', 'Schedule');
    },

    /** Démarrage du formulaire (1er champ focus) — pour mesurer l'intent */
    form_start: function (form_name) {
      if (window.gtag) gtag('event', 'form_start', { form_name: form_name });
    },

    /** Étape complétée (multi-step form) */
    form_step: function (form_name, step) {
      if (window.gtag) gtag('event', 'form_step', { form_name: form_name, step: step });
    },
  };

  function getCookie(name) {
    var v = ('; ' + document.cookie).split('; ' + name + '=');
    return v.length === 2 ? v.pop().split(';').shift() : null;
  }

  // ─── AUTO-WIRING (clics CTA détectés via attributs data-) ───────────────
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

    // form_start sur premier focus
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

  // Re-initialiser quand le user accepte le cookie banner (custom event)
  window.addEventListener('cookie-consent-given', initAll);

  // Exposer la config en debug
  window.__IMMOTrackConfig = CONFIG;
})();

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  TEMPLATE : Edge Function — Meta Conversions API (server-side)
 *  ─────────────────────────────────────────────────────────────────────────
 *  Pourquoi ?
 *  ─ Meta Pixel côté client est bloqué par iOS 14+, ad-blockers et ITP.
 *  ─ La Conversions API envoie les events directement de votre serveur à Meta.
 *  ─ Combiné au Pixel + event_id partagé, Meta déduplique automatiquement
 *    pour ne pas compter 2 fois la même conversion.
 *  ─ Résultat : ROAS plus précis, audiences plus qualifiées, CAC plus bas.
 *
 *  Déploiement (3 options) :
 *
 *  ─── A. Supabase Edge Function (recommandé — vous utilisez déjà Supabase)
 *  ─ Créer le fichier dans : supabase/functions/meta-capi/index.ts
 *  ─ Déployer : supabase functions deploy meta-capi
 *  ─ Configurer secrets : supabase secrets set META_PIXEL_ID=xxx META_ACCESS_TOKEN=xxx
 *  ─ Mettre à jour CONFIG.META_CAPI_ENDPOINT dans tracking.js :
 *      'https://VOTRE-PROJET.supabase.co/functions/v1/meta-capi'
 *
 *  ─── B. Vercel Edge Function
 *  ─ Déposer dans : api/meta-capi.js
 *  ─ Déployer : vercel deploy
 *  ─ Variables d'env : META_PIXEL_ID, META_ACCESS_TOKEN
 *  ─ Endpoint : https://votre-projet.vercel.app/api/meta-capi
 *
 *  ─── C. Cloudflare Workers
 *  ─ Adapter la handler signature à `addEventListener('fetch', ...)`
 *
 *  Obtenir un Access Token Meta :
 *  1. https://business.facebook.com → Events Manager → choisir le pixel
 *  2. Settings → "Conversions API" → "Generate Access Token"
 *  3. Copier le token (il est long, ~250 chars)
 *  4. Le stocker en variable d'env (JAMAIS dans le code source)
 * ════════════════════════════════════════════════════════════════════════════
 */

// ─── VERSION SUPABASE EDGE FUNCTION (Deno) ──────────────────────────────────
// Renommer en `index.ts` et déposer dans supabase/functions/meta-capi/

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const META_PIXEL_ID = Deno.env.get('META_PIXEL_ID') ?? '';
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN') ?? '';
const META_TEST_EVENT_CODE = Deno.env.get('META_TEST_EVENT_CODE') ?? ''; // optionnel — debug

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://immoprox.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured (missing env vars)' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('cf-connecting-ip')
            || '';
    const ua = req.headers.get('user-agent') || '';

    // Construction du payload Meta CAPI
    const event = {
      event_name: body.event_name || 'Lead',
      event_id: body.event_id, // ⚠ MUST match the eventID sent via Pixel for dedup
      event_time: body.event_time || Math.floor(Date.now() / 1000),
      action_source: body.action_source || 'website',
      event_source_url: body.event_source_url || '',
      user_data: {
        ...(body.user_data || {}),
        client_ip_address: ip,
        client_user_agent: ua,
      },
      custom_data: body.custom_data || {},
    };

    const payload = {
      data: [event],
      ...(META_TEST_EVENT_CODE && { test_event_code: META_TEST_EVENT_CODE }),
    };

    const url = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;
    const metaRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const metaJson = await metaRes.json();

    if (!metaRes.ok) {
      console.error('Meta CAPI error', metaJson);
      return new Response(JSON.stringify({ error: 'Meta CAPI failed', details: metaJson }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, fb_response: metaJson }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('CAPI handler exception', err);
    return new Response(JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 *  VERSION VERCEL EDGE FUNCTION (Node.js / TypeScript)
 *  ─ Renommer en api/meta-capi.js et adapter exports.
 * ────────────────────────────────────────────────────────────────────────────

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const META_PIXEL_ID = process.env.META_PIXEL_ID;
  const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  // ... même logique que la version Supabase ci-dessus
}
*/

// Edge Function : /meta-capi
// Reçoit un event de conversion depuis le navigateur, le hash, l'enrichit
// (IP, UA, fbp, fbc) et l'envoie à Meta Conversions API server-side.
// Permet la déduplication avec le Meta Pixel via event_id partagé.
//
// Lit dynamiquement le Pixel ID + Access Token depuis site_config.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // restreindre à https://immoprox.io en prod
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  try {
    // Service role pour lire les secrets de site_config
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: configs } = await sb
      .from('site_config')
      .select('key, value, enabled')
      .in('key', ['meta_pixel_id', 'meta_capi_token', 'meta_capi_test_code']);

    const cfg: Record<string, { value: string; enabled: boolean }> = {};
    for (const c of configs ?? []) cfg[c.key] = { value: c.value, enabled: c.enabled };

    const pixelId = cfg.meta_pixel_id?.value;
    const token   = cfg.meta_capi_token?.value;
    const testCode = cfg.meta_capi_test_code?.value;

    if (!pixelId || !token || !cfg.meta_capi_token?.enabled) {
      return jsonOk({ skipped: true, reason: 'Meta CAPI not configured or disabled' });
    }

    const body = await req.json();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('cf-connecting-ip') || '';
    const ua = req.headers.get('user-agent') || '';

    const event = {
      event_name: body.event_name || 'Lead',
      event_id: body.event_id, // doit matcher l'eventID du Pixel pour dédup
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
      ...(testCode && { test_event_code: testCode }),
    };

    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`;

    // ─── Diagnostic logs (visible dans Supabase functions logs) ─────────
    console.log('[meta-capi] Sending event', {
      pixel_id: pixelId,
      token_prefix: token.substring(0, 12) + '...',
      token_length: token.length,
      event_name: event.event_name,
      event_id: event.event_id,
      has_test_code: !!testCode,
      url_safe: url.replace(token, '<TOKEN>'),
    });

    const metaRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const metaJson = await metaRes.json();

    if (!metaRes.ok) {
      console.error('[meta-capi] FAILED', {
        status: metaRes.status,
        meta_error: metaJson,
        pixel_id: pixelId,
        token_prefix: token.substring(0, 12) + '...',
        token_length: token.length,
        hint: metaJson?.error?.code === 100 && metaJson?.error?.error_subcode === 33
          ? 'Token does NOT have ads_management permission OR no admin access to this Pixel. Generate new token via Graph API Explorer with ads_management scope.'
          : 'Check Meta error details',
      });
      return jsonError('Meta CAPI failed: ' + JSON.stringify(metaJson), 502);
    }

    console.log('[meta-capi] OK', { events_received: metaJson?.events_received, fbtrace: metaJson?.fbtrace_id });
    return jsonOk({ ok: true, fb: metaJson });
  } catch (err) {
    console.error('meta-capi exception', err);
    return jsonError('Internal: ' + (err as Error).message, 500);
  }
});

function jsonOk(b: unknown) {
  return new Response(JSON.stringify(b), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
function jsonError(m: string, s: number) {
  return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

// Edge Function : /whatsapp-send
// Envoie un message WhatsApp Business API à un nouveau lead.
// Lit dynamiquement Phone ID + Token + Template depuis site_config.
//
// Body attendu :
//   { to: "+213542766068", template_params: ["Mohamed", "https://cal.eu/..."] }
//
// Si pas de template configuré, envoie un message texte simple en fallback
// (uniquement valide dans la fenêtre de 24h après contact entrant).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: configs } = await sb
      .from('site_config')
      .select('key, value, enabled')
      .in('key', ['whatsapp_phone_id', 'whatsapp_token', 'whatsapp_template_lead']);

    const cfg: Record<string, any> = {};
    for (const c of configs ?? []) cfg[c.key] = c;

    const phoneId = cfg.whatsapp_phone_id?.value;
    const token   = cfg.whatsapp_token?.value;
    const template = cfg.whatsapp_template_lead?.value;

    if (!phoneId || !token || !cfg.whatsapp_token?.enabled) {
      return jsonOk({ skipped: true, reason: 'WhatsApp not configured or disabled' });
    }

    const body = await req.json();
    let to = (body.to || '').replace(/[^0-9]/g, '');
    if (!to) return jsonError('Missing recipient', 400);

    // Construit le payload WhatsApp Business API
    let payload: any;
    if (template) {
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: body.language || 'fr' },
          components: body.template_params ? [{
            type: 'body',
            parameters: (body.template_params as string[]).map((t) => ({ type: 'text', text: t })),
          }] : undefined,
        },
      };
    } else {
      // Fallback texte (valide uniquement dans fenêtre 24h)
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: body.text || 'Bonjour, merci pour votre demande de démo IMMO PRO-X. Notre équipe vous recontacte sous 24 h.' },
      };
    }

    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const waRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const waJson = await waRes.json();

    if (!waRes.ok) {
      console.error('WhatsApp API error', waJson);
      return jsonError('WhatsApp API failed: ' + JSON.stringify(waJson), 502);
    }

    return jsonOk({ ok: true, message_id: waJson.messages?.[0]?.id, wa: waJson });
  } catch (err) {
    console.error('whatsapp-send exception', err);
    return jsonError('Internal: ' + (err as Error).message, 500);
  }
});

function jsonOk(b: unknown) {
  return new Response(JSON.stringify(b), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
function jsonError(m: string, s: number) {
  return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

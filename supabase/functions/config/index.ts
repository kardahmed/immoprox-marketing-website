// Edge Function : /config
// Retourne la liste des clés/valeurs des intégrations ACTIVÉES et NON SECRÈTES.
// Aucune authentification requise — c'est de la config publique côté client.
// Les valeurs `is_secret = true` (tokens, API keys) ne sont JAMAIS retournées ici.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb
      .from('site_config')
      .select('key, value, label, category')
      .eq('is_secret', false)
      .eq('enabled', true);

    if (error) throw error;

    // Format : { ga4_id: "G-XXX", meta_pixel_id: "123...", ... }
    const config: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.value) config[row.key] = row.value;
    }

    return new Response(JSON.stringify({ config, fetched_at: Date.now() }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // cache 5 min côté CDN
      },
    });
  } catch (err) {
    console.error('config fetch error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

// Edge Function : /admin-config
// Endpoints :
//   GET    /admin-config           → liste TOUTES les configs (incl. secrets, masqués)
//   PATCH  /admin-config           → met à jour { key, value, enabled }
//   POST   /admin-config/test      → teste une intégration (envoie un event de test)
// Authentification : header `Authorization: Bearer <jwt>` ; rôle admin requis (RLS).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Auth via JWT
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return jsonError('Missing Authorization header', 401);
  }

  // Crée un client avec le JWT du caller (RLS s'applique automatiquement)
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });

  // Vérifie que le caller est admin
  const { data: isAdminData, error: isAdminErr } = await sb.rpc('is_admin');
  if (isAdminErr || !isAdminData) {
    return jsonError('Forbidden — admin role required', 403);
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/admin-config\/?/, '');

  try {
    // ─── GET : liste de toutes les configs ──────────────────────────────────
    if (req.method === 'GET' && !path) {
      const { data, error } = await sb
        .from('site_config')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      // Masque les valeurs des secrets pour l'affichage (****)
      const masked = (data ?? []).map((row: any) => ({
        ...row,
        value: row.is_secret && row.value ? '••••••••••••' + row.value.slice(-4) : row.value,
        has_value: !!row.value,
      }));
      return jsonOk({ items: masked });
    }

    // ─── PATCH : update { key, value, enabled } ─────────────────────────────
    if (req.method === 'PATCH' && !path) {
      const body = await req.json();
      const { key, value, enabled } = body;
      if (!key) return jsonError('Missing key', 400);

      const update: Record<string, unknown> = {};
      if (value !== undefined) update.value = value === '' ? null : value;
      if (enabled !== undefined) update.enabled = !!enabled;

      const { data, error } = await sb
        .from('site_config')
        .update(update)
        .eq('key', key)
        .select()
        .single();
      if (error) throw error;
      return jsonOk({ updated: data });
    }

    // ─── POST /test : ping de test d'une intégration ────────────────────────
    if (req.method === 'POST' && path === 'test') {
      const { key } = await req.json();
      const { data: row } = await sb
        .from('site_config')
        .select('*')
        .eq('key', key)
        .single();
      if (!row || !row.value) return jsonError('Integration not configured', 400);

      // Test très basique : vérifie que la valeur respecte un format attendu
      const formatChecks: Record<string, RegExp> = {
        ga4_id: /^G-[A-Z0-9]{8,12}$/,
        gtm_id: /^GTM-[A-Z0-9]{6,8}$/,
        gads_conversion_id: /^AW-\d{8,12}$/,
        meta_pixel_id: /^\d{15,16}$/,
        clarity_id: /^[a-z0-9]{8,12}$/,
        whatsapp_phone_id: /^\d{15,18}$/,
      };
      const re = formatChecks[key];
      if (re && !re.test(row.value)) {
        return jsonOk({ ok: false, message: 'Format suspect — vérifiez la valeur.' });
      }
      return jsonOk({ ok: true, message: 'Format valide ✓ (test live à venir)' });
    }

    return jsonError('Not found', 404);
  } catch (err) {
    console.error('admin-config error', err);
    return jsonError('Internal error: ' + (err as Error).message, 500);
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

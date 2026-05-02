/**
 * Service API pour gérer les intégrations marketing.
 * Appelle les Supabase Edge Functions /admin-config (admin) et /config (public).
 *
 * ⚠ IMPORTANT : ce service utilise VOTRE client Supabase existant
 * (celui qui gère l'auth de votre plateforme). Il n'instancie PAS un nouveau client.
 *
 * Adaptez l'import `supabase` à votre projet (ex: `from '@/lib/supabase'` ou `from '../supabaseClient'`).
 */

import { supabase } from '../lib/supabase'; // ← ADAPTER ce chemin à votre projet
import type {
  Integration,
  UpdateIntegrationPayload,
  TestResult,
} from '../types/integrations.types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://lbnqccsebwiifxcucflg.supabase.co';
const ADMIN_ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-config`;

/**
 * Helper interne — récupère le JWT de l'utilisateur courant.
 * Throw si non connecté.
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Vous devez être connecté.');
  }
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Vérifie si l'utilisateur courant est admin (via la fonction RPC `is_admin`).
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.error('checkIsAdmin error', error);
      return false;
    }
    return !!data;
  } catch (e) {
    console.error('checkIsAdmin exception', e);
    return false;
  }
}

/**
 * Liste TOUTES les intégrations (incluant les secrets — masqués).
 * Réservé aux admins (RLS Supabase).
 */
export async function listIntegrations(): Promise<Integration[]> {
  const headers = await getAuthHeader();
  const res = await fetch(ADMIN_ENDPOINT, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erreur HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.items ?? [];
}

/**
 * Met à jour une intégration (valeur et/ou état activé).
 * Réservé aux admins.
 */
export async function updateIntegration(
  payload: UpdateIntegrationPayload
): Promise<Integration> {
  const headers = await getAuthHeader();
  const res = await fetch(ADMIN_ENDPOINT, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erreur HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.updated;
}

/**
 * Test rapide d'une intégration (valide le format de la valeur).
 */
export async function testIntegration(key: string): Promise<TestResult> {
  const headers = await getAuthHeader();
  const res = await fetch(`${ADMIN_ENDPOINT}/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key }),
  });
  const json = await res.json();
  if (!res.ok) {
    return { ok: false, message: json.error ?? `Erreur HTTP ${res.status}` };
  }
  return { ok: !!json.ok, message: json.message ?? 'OK' };
}

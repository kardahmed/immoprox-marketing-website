# 🤖 Prompt à copier-coller dans la session Claude qui code `app.immoprox.io`

Ce prompt est **complet et autonome** : votre autre session Claude a tout ce qu'il faut pour intégrer le panneau d'administration des intégrations marketing dans votre plateforme `app.immoprox.io`, sans avoir besoin de lire d'autre fichier.

Copiez tout le bloc ci-dessous (entre les lignes `═══`) et collez-le dans votre session de développement de la plateforme.

═══════════════════════════════════════════════════════════════════════════

# Tâche : Ajouter la page « Intégrations marketing » dans le panneau super admin

## 🎯 Contexte business

Notre site marketing `immoprox.io` doit charger dynamiquement plusieurs pixels et clés d'API (Google Analytics 4, Meta Pixel, TikTok, LinkedIn, Microsoft Clarity, WhatsApp Business API, etc.) **sans qu'on ait à modifier le code à chaque fois**.

Pour cela, **toutes les clés sont déjà stockées dans une table Supabase `site_config`** dans le projet `lbnqccsebwiifxcucflg` (le même projet que celui utilisé par cette plateforme `app.immoprox.io`).

L'objectif : **créer une page admin dans cette plateforme** où je peux :
- Voir toutes les intégrations groupées par catégorie (Analytics, Ads, Communication, CRM, Monitoring)
- Coller / modifier la valeur (ID ou token) de chaque intégration
- Activer / désactiver chacune individuellement
- Tester rapidement le format de la valeur

## ✅ Ce qui existe déjà côté Supabase (NE RIEN RECRÉER)

### Tables (déjà créées dans le projet `lbnqccsebwiifxcucflg`)

```sql
-- Table principale
CREATE TABLE public.site_config (
  key           TEXT        PRIMARY KEY,
  value         TEXT,
  label         TEXT        NOT NULL,
  category      TEXT        NOT NULL,        -- 'analytics' | 'ads' | 'communication' | 'crm' | 'monitoring'
  description   TEXT,
  doc_url       TEXT,                        -- Lien vers la doc fournisseur
  is_secret     BOOLEAN     NOT NULL DEFAULT FALSE,
  enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order    INTEGER     NOT NULL DEFAULT 100,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID        REFERENCES auth.users(id)
);

-- Système de rôles
CREATE TABLE public.user_roles (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

-- Helper RLS — utilisable côté client via supabase.rpc('is_admin')
CREATE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Les RLS sont déjà en place : seuls les users avec le rôle `admin` (dans `user_roles`) peuvent lire/écrire `site_config`.

### Edge Functions (déjà déployées)

**`/admin-config`** (URL : `https://lbnqccsebwiifxcucflg.supabase.co/functions/v1/admin-config`)

Authentification : JWT Bearer token (auto-fourni par le client Supabase de l'utilisateur connecté)

Endpoints :

```
GET  /admin-config
→ Liste TOUTES les intégrations.
   Les valeurs des secrets (is_secret=true) sont masquées : "••••••••XXXX" (4 derniers chars).
   Champ supplémentaire `has_value: boolean` indique si une valeur est définie.

   Response 200 :
   {
     "items": [
       {
         "key": "ga4_id",
         "value": "G-ABC123XYZ4",
         "label": "Google Analytics 4",
         "category": "analytics",
         "description": "Measurement ID format G-XXXXXXXXXX",
         "doc_url": "https://analytics.google.com",
         "is_secret": false,
         "enabled": true,
         "sort_order": 10,
         "has_value": true,
         "updated_at": "2026-05-02T...",
         "updated_by": "uuid..."
       },
       ...
     ]
   }

PATCH /admin-config
   Body : { key: string, value?: string|null, enabled?: boolean }
   Met à jour la valeur et/ou l'état d'une intégration.
   Renvoie l'enregistrement mis à jour.

POST /admin-config/test
   Body : { key: string }
   Vérifie que la valeur respecte un format attendu (regex côté serveur).
   Response : { ok: boolean, message: string }
```

Erreurs possibles : 401 (non connecté), 403 (pas admin), 400 (mauvais payload), 500.

## 📦 Intégrations seedées dans la table (25+ entrées)

| key | label | category | is_secret | doc_url |
|---|---|---|---|---|
| `ga4_id` | Google Analytics 4 | analytics | ❌ | analytics.google.com |
| `gtm_id` | Google Tag Manager | analytics | ❌ | tagmanager.google.com |
| `clarity_id` | Microsoft Clarity | analytics | ❌ | clarity.microsoft.com |
| `hotjar_id` | Hotjar | analytics | ❌ | hotjar.com |
| `gads_conversion_id` | Google Ads Conversion ID | ads | ❌ | ads.google.com |
| `gads_conversion_label` | Google Ads Conversion Label | ads | ❌ | ads.google.com |
| `meta_pixel_id` | Meta Pixel ID | ads | ❌ | business.facebook.com |
| `meta_capi_token` | Meta Conversions API Token | ads | ✅ 🔒 | business.facebook.com |
| `meta_capi_test_code` | Meta CAPI Test Event Code | ads | ❌ | business.facebook.com |
| `tiktok_pixel_id` | TikTok Pixel ID | ads | ❌ | ads.tiktok.com |
| `linkedin_partner_id` | LinkedIn Insight Partner ID | ads | ❌ | campaign.linkedin.com |
| `snapchat_pixel_id` | Snapchat Pixel ID | ads | ❌ | ads.snapchat.com |
| `whatsapp_phone_id` | WhatsApp Business Phone ID | communication | ❌ | business.facebook.com |
| `whatsapp_token` | WhatsApp Business Token | communication | ✅ 🔒 | business.facebook.com |
| `whatsapp_template_lead` | WhatsApp Template (lead) | communication | ❌ | business.facebook.com |
| `sendinblue_api_key` | Brevo API Key | communication | ✅ 🔒 | app.brevo.com |
| `mailchimp_api_key` | Mailchimp API Key | communication | ✅ 🔒 | mailchimp.com |
| `cal_embed_url` | Cal.eu Embed URL | communication | ❌ | cal.com |
| `hubspot_hub_id` | HubSpot Hub ID | crm | ❌ | hubspot.com |
| `intercom_app_id` | Intercom App ID | crm | ❌ | intercom.com |
| `sentry_dsn` | Sentry DSN | monitoring | ❌ | sentry.io |

## 🛠 Stack technique de cette plateforme

- **React + TypeScript + Vite**
- Le client Supabase est déjà initialisé quelque part (probablement `src/lib/supabase.ts` ou similaire) — utilise l'auth de la plateforme
- L'utilisateur est déjà connecté quand il accède au panneau super admin
- Vous avez probablement un router (React Router, TanStack Router…) et un système de routes admin protégées

## 📋 Ce qu'il faut implémenter

### 1. Une page React `IntegrationsPage` à monter sur `/admin/integrations`

**Comportement attendu :**

- Au mount : appeler `supabase.rpc('is_admin')` ; si `false` → afficher « Accès refusé »
- Si admin OK : fetch `GET https://lbnqccsebwiifxcucflg.supabase.co/functions/v1/admin-config` avec le JWT du user connecté (récupéré via `supabase.auth.getSession()`)
- Afficher un **tableau de tabs** par catégorie (Analytics, Ads, Communication, CRM, Monitoring) avec un compteur `activées/total`
- Afficher la **grille des cartes** de la catégorie active

### 2. Carte d'une intégration (`IntegrationCard`)

Chaque carte montre :
- **Titre** (`label`)
- **Description** (`description`)
- **Badge status** :
  - 🟢 « Activé » si `enabled=true`
  - ⚪ « Configuré · inactif » si `has_value=true` mais `enabled=false`
  - ⚪ « Non configuré » si `has_value=false`
  - 🔒 « Secret » si `is_secret=true`
- **Champ input** :
  - Type `password` si `is_secret=true`, sinon `text`
  - Pré-rempli avec `value` (qui peut être `••••XXXX` pour les secrets)
  - Police monospace (`JetBrains Mono` ou similaire)
- **3 boutons** :
  - **Enregistrer** → `PATCH` avec `{ key, value }`
  - **Tester** → `POST /admin-config/test` avec `{ key }` (désactivé si pas de valeur)
  - **Toggle ON/OFF** → `PATCH` avec `{ key, enabled: !enabled }` (désactivé si pas de valeur)
- **Lien doc** vers `doc_url` (target=_blank)

**Logique secrets :**
- Si l'input affiche `••••XXXX` (masque), l'utilisateur doit tout effacer et coller la nouvelle valeur. Si on click Enregistrer avec un masque dedans, afficher un feedback : « Collez la nouvelle valeur pour la modifier. »

### 3. Feedback utilisateur

- Toast / notification après chaque action (succès / erreur)
- Inline feedback dans la carte pour le bouton « Tester »
- Reload automatique de la liste après une mutation réussie

### 4. UX/Design

- Adapter au design system existant de la plateforme (Tailwind / shadcn / MUI / autre selon ce qui est déjà en place)
- Layout responsive : grille à `auto-fill, minmax(360px, 1fr)` desktop, 1 colonne mobile
- Tabs scrollables horizontalement sur mobile

### 5. Routage et permissions

- Route : `/admin/integrations`
- Protégée par votre middleware admin existant (ou via le check `supabase.rpc('is_admin')` dans la page)
- Ajouter un lien dans la sidebar admin : « ⚙️ Intégrations marketing »

## 🔑 Détails d'implémentation

### Helper pour récupérer le JWT

```typescript
async function getAuthHeader() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Non connecté');
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  };
}
```

### Constantes utiles

```typescript
const SUPABASE_URL = 'https://lbnqccsebwiifxcucflg.supabase.co';
const ADMIN_ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-config`;

const CATEGORY_LABELS = {
  analytics: 'Analytics',
  ads: 'Publicité (Ads)',
  communication: 'Communication',
  crm: 'CRM',
  monitoring: 'Monitoring',
} as const;

const CATEGORY_ICONS = {
  analytics: '📊',
  ads: '💰',
  communication: '💬',
  crm: '🤝',
  monitoring: '🛡️',
} as const;
```

### Type TypeScript

```typescript
interface Integration {
  key: string;
  value: string | null;
  label: string;
  category: 'analytics' | 'ads' | 'communication' | 'crm' | 'monitoring';
  description: string | null;
  doc_url: string | null;
  is_secret: boolean;
  enabled: boolean;
  sort_order: number;
  has_value: boolean;
  updated_at: string;
  updated_by: string | null;
}
```

## ✅ Critères d'acceptation

1. La page `/admin/integrations` est accessible aux super admins de la plateforme
2. Je vois les 25+ intégrations groupées par catégorie avec compteurs activés/total
3. Je peux coller une valeur (ex: GA4 `G-ABC123XYZ4`), cliquer Enregistrer, puis activer le toggle ON
4. Les secrets affichent `••••XXXX` après save et ne ré-exposent jamais la valeur complète
5. Le bouton « Tester » donne un retour visuel rapide (format valide / invalide)
6. Si je supprime une valeur (champ vide + Enregistrer), `enabled` repasse à `false` automatiquement
7. Le code respecte les conventions du projet (composants, hooks, services, design system)
8. La page est responsive (desktop + mobile)
9. Les erreurs réseau / 401 / 403 / 500 sont gérées avec feedback clair

## 🚦 À ne pas faire

- ❌ Ne pas créer de nouveau client Supabase — utilise celui qui existe déjà
- ❌ Ne pas re-créer les tables / RLS / edge functions — c'est déjà déployé
- ❌ Ne pas toucher aux secrets dans le navigateur (les tokens API restent côté serveur dans les edge functions)
- ❌ Ne pas exposer le `service_role_key` côté client (c'est un secret server-only)

## 📚 Informations supplémentaires utiles

- Le site marketing `immoprox.io` consomme cette même config via une autre edge function `/config` (publique, ne retourne que les clés non-secrètes activées). C'est pour ça que les modifs faites depuis `/admin/integrations` sont visibles sur le site marketing en moins de 5 minutes.
- L'edge function `/meta-capi` (server-side) lit les secrets `meta_pixel_id` + `meta_capi_token` directement depuis `site_config` via le service role.
- L'edge function `/whatsapp-send` (server-side) lit `whatsapp_phone_id` + `whatsapp_token` + `whatsapp_template_lead`.
- Donc en tant qu'admin, je n'ai qu'à coller mes IDs/tokens dans cette page — tout le reste est automatique.

---

**Implémente cette page maintenant en suivant les conventions du projet. Pose-moi des questions si quelque chose n'est pas clair, sinon vas-y.**

═══════════════════════════════════════════════════════════════════════════

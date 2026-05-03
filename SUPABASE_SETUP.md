# 🔧 Supabase Infrastructure — Setup & Maintenance

Documentation de l'infrastructure Supabase utilisée par le site marketing **et** par la page d'administration des intégrations dans `app.immoprox.io`.

> 💡 **L'UI d'administration des intégrations vit dans `app.immoprox.io/admin/integrations`** (React + TypeScript + Vite). Ce document concerne uniquement l'infrastructure Supabase commune.

---

## 📋 Architecture

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│  app.immoprox.io                │         │  Supabase (lbnqccsebwiifxcucflg) │
│  /admin/integrations            │  fetch  │  Edge Function /admin-config     │
│  (React + TS + Vite)            │ ──────► │  ├─ vérifie is_admin() via RLS  │
│                                 │         │  └─ CRUD sur table site_config  │
└─────────────────────────────────┘         │                                  │
                                            │  Edge Function /config           │
                                            │  └─ retourne clés activées       │
                                            └──────────────────────────────────┘
                                                       │
                                                       ▼
                                            ┌──────────────────────┐
                                            │  immoprox.io         │
                                            │  tracking.js fetch   │
                                            │  /config et active   │
                                            │  GA4, Meta Pixel,    │
                                            │  WhatsApp, etc.      │
                                            └──────────────────────┘
```

---

## 🚀 Installation initiale (une seule fois)

### 1️⃣ Appliquer la migration SQL

```bash
cat supabase/migrations/20260502000000_site_config.sql | pbcopy
```

Aller sur le SQL Editor :
👉 https://supabase.com/dashboard/project/lbnqccsebwiifxcucflg/sql/new

Coller (Cmd+V) → cliquer **Run**.

Ce qui est créé :
- Table `site_config` (toutes les intégrations)
- Table `user_roles` (gestion admin)
- Function `is_admin()` (helper RLS, utilisable côté client via `supabase.rpc('is_admin')`)
- 22+ intégrations pré-seedées (vides, prêtes à recevoir vos IDs)

Vérifier :
```sql
SELECT count(*) FROM public.site_config;
```
→ doit afficher 22 ou plus.

### 2️⃣ Déployer les Edge Functions

```bash
supabase login
supabase link --project-ref lbnqccsebwiifxcucflg
supabase functions deploy config --no-verify-jwt
supabase functions deploy admin-config
supabase functions deploy meta-capi --no-verify-jwt
supabase functions deploy whatsapp-send --no-verify-jwt
```

### 3️⃣ Configurer le secret service_role

Récupérer la clé : Dashboard → **Project Settings → API → service_role** (bouton « Reveal »)

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<coller_la_cle>
```

⚠️ Ne JAMAIS committer cette clé dans git.

### 4️⃣ Donner le rôle admin à votre compte

Dans le SQL Editor, exécuter (en remplaçant l'email) :
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users 
WHERE email = 'VOTRE_EMAIL@example.com'
ON CONFLICT DO NOTHING;
```

Vérifier :
```sql
SELECT u.email, r.role 
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id
WHERE r.role = 'admin';
```

---

## 📦 Edge Functions

### `/config` — public, lecture
URL : `https://lbnqccsebwiifxcucflg.supabase.co/functions/v1/config`

Retourne uniquement les clés **activées** et **non secrètes**. Consommée par `tracking.js` du site marketing.

### `/admin-config` — protégée (admin uniquement)
URL : `https://lbnqccsebwiifxcucflg.supabase.co/functions/v1/admin-config`

CRUD complet sur `site_config`. Consommée par `app.immoprox.io/admin/integrations`.

Méthodes : `GET` (liste), `PATCH` (update), `POST /test` (validation format).

### `/meta-capi` — server-side
URL : `https://lbnqccsebwiifxcucflg.supabase.co/functions/v1/meta-capi`

Reçoit un event de conversion depuis le navigateur, l'enrichit (IP, UA, fbp/fbc) et l'envoie à Meta Conversions API. Permet la déduplication avec le Pixel via `event_id`.

### `/whatsapp-send` — server-side
URL : `https://lbnqccsebwiifxcucflg.supabase.co/functions/v1/whatsapp-send`

Envoie automatiquement un message WhatsApp Business à un nouveau lead. Lit Phone ID + Token + Template depuis `site_config`.

---

## 🔌 Intégrations supportées (22+)

| Catégorie | Intégration | Type | Effet |
|---|---|---|---|
| 📊 Analytics | Google Analytics 4 | Public | Tracking pages + events |
| 📊 Analytics | Google Tag Manager | Public | Container GTM chargé |
| 📊 Analytics | Microsoft Clarity | Public | Heatmaps + session recordings |
| 📊 Analytics | Hotjar | Public | Heatmaps + sondages |
| 💰 Ads | Google Ads Conversion | Public | Suivi conversion SEA |
| 💰 Ads | Meta Pixel | Public | Suivi pages + Lead event |
| 💰 Ads | Meta Conversions API | 🔒 Secret | Server-side dédup iOS 14+ |
| 💰 Ads | Meta CAPI Test Code | Public | Mode debug avant prod |
| 💰 Ads | TikTok Pixel | Public | Suivi TikTok Ads |
| 💰 Ads | LinkedIn Insight | Public | Audience B2B |
| 💰 Ads | Snapchat Pixel | Public | Suivi Snap Ads |
| 💬 Communication | WhatsApp Phone ID | Public | Auto-message au lead |
| 💬 Communication | WhatsApp Token | 🔒 Secret | Auth API WhatsApp |
| 💬 Communication | WhatsApp Template | Public | Template approuvé |
| 💬 Communication | Brevo API Key | 🔒 Secret | Emails transactionnels |
| 💬 Communication | Mailchimp API Key | 🔒 Secret | Newsletters |
| 💬 Communication | Cal.eu Embed URL | Public | Lien booking |
| 🤝 CRM | HubSpot Hub ID | Public | Tracking visiteurs HubSpot |
| 🤝 CRM | Intercom App ID | Public | Chat support |
| 🛡 Monitoring | Sentry DSN | Public | Tracking erreurs JS |

---

## 🔧 Où récupérer chaque ID/token

### Google Analytics 4
1. https://analytics.google.com → Admin → Créer une propriété → Web → URL `https://immoprox.io`
2. Copier le **Measurement ID** `G-XXXXXXXXXX`

### Meta Pixel + Conversions API
**Pixel :**
1. https://business.facebook.com → Events Manager → Connecter une source de données → Web
2. Copier le **Pixel ID** (15 chiffres)

**CAPI :**
1. Events Manager → Settings → Conversions API → **Generate Access Token**
2. Token long (~250 chars)
3. (Optionnel) Generate test event code pour tester avant prod

✨ La déduplication Pixel ↔ CAPI se fait automatiquement via `event_id` partagé.

### WhatsApp Business API
1. https://business.facebook.com → WhatsApp Business → API Setup
2. Copier **Phone Number ID** + **Generate Access Token** long-lived
3. (Recommandé) Créer un **template** approuvé Meta (Settings → Message Templates)

### TikTok Pixel
1. https://ads.tiktok.com → Assets → Events → Web Events → Set up
2. Copier le **Pixel Code**

### Microsoft Clarity (gratuit)
1. https://clarity.microsoft.com → New project → URL `https://immoprox.io`
2. Copier le **Project ID**

### Google Ads Conversion
1. https://ads.google.com → Outils → Conversions → +Action de conversion
2. Choisir « Site web » → Catégorie « Lead »
3. Récupérer l'ID `AW-XXXXXXXXX` et le **Label de conversion**

### LinkedIn Insight Tag
1. https://www.linkedin.com/campaignmanager → Account Assets → Insight Tag
2. Copier le **Partner ID**

---

## 🧪 Tests & validation

### Tester l'edge function `/config`
```bash
curl https://lbnqccsebwiifxcucflg.supabase.co/functions/v1/config
```
Réponse : `{"config": {...}, "fetched_at": ...}`

### Tester GA4 sur le site marketing
1. Saisir l'ID GA4 dans `app.immoprox.io/admin/integrations` → Activer
2. Ouvrir https://immoprox.io en navigation privée
3. Accepter le cookie banner
4. DevTools → Network → filtrer `gtag` → vous devez voir les requêtes
5. GA4 → Reports → Realtime → la visite doit apparaître

### Tester Meta Pixel
- Installer l'extension Chrome **Meta Pixel Helper**
- Visiter le site → l'icône doit s'allumer en vert et lister les events

### Tester Meta CAPI
- Saisir un test code dans `meta_capi_test_code` → Activer
- Soumettre le formulaire contact
- Events Manager → Test Events → l'event doit apparaître
- Une fois validé, désactiver le test code

### Vérifier la déduplication Pixel ⇄ CAPI
- Events Manager → Diagnostics → check « Deduplicated events »
- Doit être > 90% (event_id partagé)

---

## 🔄 Cache & rafraîchissement

`tracking.js` cache la config 5 minutes en localStorage côté navigateur.

Pour forcer un reload immédiat après une modification :
```js
// Dans la console du navigateur sur immoprox.io
localStorage.removeItem('ipx_tracking_config_v1');
location.reload();
```

---

## 🆘 Troubleshooting

### « Forbidden — admin role required »
→ Manque l'INSERT dans `user_roles`. Voir étape 4 du setup.

### Le pixel ne se charge pas sur immoprox.io
→ Vérifier dans `app.immoprox.io/admin/integrations` que la valeur est correcte ET le toggle est ON.
→ Vider le cache local (commande ci-dessus).

### Meta CAPI ne dédupique pas
→ Vérifier que Pixel et CAPI utilisent bien le même Pixel ID.
→ Events Manager → Diagnostics : check les Source URLs.

### Une edge function renvoie 500
→ Vérifier les logs : `supabase functions logs <function-name>`

---

## 📚 Fichiers liés

- **Migration SQL** : `supabase/migrations/20260502000000_site_config.sql`
- **Edge Functions** : `supabase/functions/{config,admin-config,meta-capi,whatsapp-send}/index.ts`
- **Tracking client** : `tracking.js` (chargé sur toutes les pages du site marketing)

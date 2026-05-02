# 🎛 Admin Panel — Guide de mise en route

Vous avez maintenant un **panneau d'administration** sur `https://immoprox.io/admin` qui vous permet de coller vos IDs/tokens d'intégration dans une UI graphique. Tout se connecte automatiquement.

## 📋 Étapes d'installation (une seule fois, ~30 minutes)

### 1️⃣ Appliquer la migration SQL dans Supabase

Connectez-vous à votre dashboard Supabase (`https://supabase.com/dashboard/project/lbnqccsebwiifxcucflg`), puis :

**Option A — Via le SQL Editor (le plus simple) :**
1. Aller dans **SQL Editor** dans la sidebar
2. Coller le contenu de `supabase/migrations/20260502000000_site_config.sql`
3. Cliquer **Run**

**Option B — Via la CLI Supabase :**
```bash
npm install -g supabase
supabase login
supabase link --project-ref lbnqccsebwiifxcucflg
supabase db push
```

Ce qui crée :
- Table `site_config` (toutes vos intégrations)
- Table `user_roles` (gestion admin)
- Function `is_admin()` (helper RLS)
- 25+ intégrations pré-seedées (vides, prêtes à recevoir vos IDs)

### 2️⃣ Déployer les Edge Functions

```bash
cd supabase
supabase functions deploy config
supabase functions deploy admin-config
supabase functions deploy meta-capi
supabase functions deploy whatsapp-send
```

Configurer les secrets pour les functions server-side :
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<copier depuis Project Settings → API>
```

(Le `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont auto-fournis par Supabase aux functions.)

### 3️⃣ Créer votre compte admin

**a) Créer le user dans Supabase Auth** :
1. Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**
2. Email : `votre@email.com`, mot de passe au choix
3. Cocher **Auto Confirm User**

**b) Lui donner le rôle admin** :
Dans le SQL Editor, exécuter :
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'votre@email.com';
```

### 4️⃣ Aller sur le panneau

Ouvrez **`https://immoprox.io/admin`** (ou en local : `http://localhost:8080/admin.html`).
Connectez-vous avec votre email/mot de passe.

🎉 Vous voyez la liste de toutes les intégrations regroupées par catégorie.

---

## 🚀 Utilisation au quotidien

### Activer une intégration

Pour chaque ligne :
1. **Coller la valeur** (ID ou token) dans le champ
2. Cliquer **Enregistrer** (bouton bleu)
3. Cliquer **OFF → ON** (bouton à droite) pour activer
4. (Optionnel) Cliquer **Tester** pour vérifier le format

✨ Les changements sont **actifs en moins de 5 minutes** sur le site (cache navigateur).
Pour forcer la mise à jour : `localStorage.removeItem('ipx_tracking_config_v1')` dans la console du navigateur.

### Sécurité — secrets

- Les valeurs marquées 🔒 **Secret** (Meta CAPI Token, WhatsApp Token, Brevo API Key…) sont **JAMAIS exposées au navigateur**.
- Elles sont lues uniquement par les Edge Functions server-side.
- Dans l'admin, vous voyez un masque `••••••••XXXX` (4 derniers chars).
- Pour les remplacer, il suffit de coller la nouvelle valeur dans le champ et **Enregistrer**.

---

## 📦 Intégrations disponibles

| Catégorie | Intégration | Type | Effet immédiat |
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

## 🔧 Comment chaque intégration s'active

### Google Analytics 4
1. Aller sur https://analytics.google.com
2. Admin → Créer propriété → Web → URL `https://immoprox.io`
3. Copier le **Measurement ID** `G-XXXXXXXXXX`
4. Coller dans Admin → GA4 → Activer
5. Vérifier dans GA4 → Reports → Realtime que les visites apparaissent

### Meta Pixel + Conversions API
**Pixel (côté navigateur) :**
1. https://business.facebook.com → Events Manager → Connecter une source de données → Web
2. Copier le **Pixel ID** (15 chiffres) → coller dans Admin → Activer
3. Tester avec extension Chrome **Meta Pixel Helper**

**Conversions API (server-side) :**
1. Events Manager → Settings → Conversions API → **Generate Access Token**
2. Coller dans Admin → Meta CAPI Token → Activer
3. (Optionnel pour debug) Generate test event code → coller dans Admin → Meta CAPI Test Code → Activer
4. Vérifier dans Events Manager → Test Events que les events apparaissent
5. Quand c'est validé : désactiver Test Code

✨ La déduplication Pixel ↔ CAPI se fait automatiquement via `event_id` partagé.

### WhatsApp Business API (auto-message au lead)
1. https://business.facebook.com → WhatsApp Business → API Setup
2. Copier **Phone Number ID** (longue chaîne numérique)
3. **Generate Access Token** (long-lived recommandé)
4. (Recommandé) Créer un **template** approuvé Meta (Settings → Message Templates)
   - Exemple : `lead_welcome` avec `{{1}} = nom du prospect`
5. Coller les 3 valeurs dans l'Admin → Activer

✨ À chaque soumission de formulaire contact, un message WhatsApp est envoyé automatiquement au prospect.

### TikTok Pixel
1. https://ads.tiktok.com → Assets → Events → Web Events → Set up
2. Copier le **Pixel Code** → Admin → Activer

### Microsoft Clarity (gratuit, fortement recommandé)
1. https://clarity.microsoft.com → New project → URL `https://immoprox.io`
2. Copier le **Project ID** → Admin → Activer
3. Voir les heatmaps et enregistrements de sessions sous 24 h

---

## 🧪 Tester en local

```bash
cd ~/immoprox-marketing-website
git pull origin main
python3 -m http.server 8080
```

Puis ouvrez **http://localhost:8080/admin.html**

Note : en local, le tracking utilise les Edge Functions Supabase déployées en prod.

---

## 🔄 Workflow recommandé pour ajouter un pixel

1. **Activer en mode test** (toggle ON)
2. Soumettre le formulaire contact en mode incognito
3. Vérifier dans le dashboard du provider que l'event est reçu
4. Si OK : laisser activé. Si non : désactiver et debugger.

---

## 📊 Stratégie SEA recommandée (rappel)

| Campaign | Keywords | Budget conseillé | CPC cible |
|---|---|---|---|
| **[Brand]** IMMO PRO-X | immo pro-x | 5€/jour | 0,5€ |
| **[Generic CRM]** | crm immobilier, logiciel agence | 30€/jour | 2-4€ |
| **[Pain]** Gestion Leads | gestion leads immobilier | 20€/jour | 1,5-3€ |
| **[Compétiteurs]** | crm immobilier vs hubspot | 10€/jour | 1-2€ |
| **[Long tail]** | crm pour promoteur | 15€/jour | 1-2€ |

Lancer en **manual CPC**, passer en **Maximize Conversions** une fois 30+ conversions enregistrées.

---

## 🆘 Troubleshooting

### « Forbidden — admin role required » à la connexion
→ Vous n'avez pas exécuté l'INSERT dans `user_roles`. Voir étape 3️⃣.

### Le panneau ne charge pas les intégrations
→ Vérifier que les Edge Functions sont déployées :
```bash
supabase functions list
```

### Un pixel ne se charge pas sur le site
→ Vérifier dans l'Admin que :
- La valeur est correctement collée
- Le toggle est sur **ON**
- Vider le cache local : `localStorage.removeItem('ipx_tracking_config_v1')` dans la console

### Meta CAPI ne dédupique pas
→ Vérifier que le Pixel et CAPI utilisent bien le même Pixel ID (Admin → Meta Pixel ID).
→ Vérifier dans Events Manager → Diagnostics que les events arrivent bien des deux sources.

---

## 🎯 Récapitulatif

✅ Vous avez maintenant un système où :
- **Tous les pixels marketing** se gèrent via une UI sans code
- **Meta CAPI** envoie les conversions server-side (contourne iOS 14+)
- **WhatsApp** envoie un message automatique à chaque lead
- **Tous les secrets** (tokens API) restent côté serveur, jamais exposés au navigateur
- **Cache 5 min** pour ne pas surcharger Supabase
- **Permissions admin** via RLS Supabase

L'ajout d'une nouvelle intégration future = 1 ligne SQL dans `site_config` + 1 fonction de chargement dans `tracking.js`. C'est tout.

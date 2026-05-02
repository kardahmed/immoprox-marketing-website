# 🎛 Page Intégrations — À intégrer dans `app.immoprox.io`

Ce dossier contient un **module React + TypeScript prêt à coller** dans votre plateforme `app.immoprox.io` (React + Vite). Il fournit la page d'administration des intégrations marketing (GA4, Meta Pixel, WhatsApp, etc.).

## 📦 Contenu du package

```
platform-integration/src/
├── pages/
│   └── IntegrationsPage.tsx        ← Page principale à monter sur une route
├── components/
│   └── IntegrationCard.tsx         ← Carte UI d'une intégration
├── hooks/
│   └── useIntegrations.ts          ← Hook React (state + mutations)
├── services/
│   └── integrationsApi.ts          ← Appels aux Edge Functions Supabase
├── types/
│   └── integrations.types.ts       ← Types TypeScript
└── styles/
    └── integrations.module.css     ← Styles CSS modulaires
```

---

## 🚀 Installation (5 minutes)

### Étape 1 — Copier les fichiers dans votre plateforme

Copiez **le contenu de `platform-integration/src/`** dans le `src/` de votre plateforme :

```
app.immoprox.io/src/
├── pages/IntegrationsPage.tsx
├── components/IntegrationCard.tsx
├── hooks/useIntegrations.ts
├── services/integrationsApi.ts
├── types/integrations.types.ts
└── styles/integrations.module.css
```

Adaptez la structure de dossiers à vos conventions (par exemple `features/admin/integrations/`).

### Étape 2 — Adapter le chemin du client Supabase

Dans **`services/integrationsApi.ts`**, modifiez la première ligne :

```typescript
import { supabase } from '../lib/supabase'; // ← REMPLACER par le vrai chemin
```

Par exemple, si votre client Supabase est dans `src/lib/supabaseClient.ts` :

```typescript
import { supabase } from '@/lib/supabaseClient';
```

⚠ **Le module utilise VOTRE client Supabase** — celui qui gère déjà l'authentification de votre plateforme. Aucun nouveau client à créer.

### Étape 3 — Vérifier la variable d'environnement

Dans votre `.env` (ou `.env.local`), assurez-vous d'avoir :

```bash
VITE_SUPABASE_URL=https://lbnqccsebwiifxcucflg.supabase.co
```

(Si vous l'avez déjà — c'est sûrement le cas — rien à faire.)

### Étape 4 — Ajouter la route

Dans votre router (React Router, TanStack Router, etc.), ajoutez :

```tsx
import { IntegrationsPage } from '@/pages/IntegrationsPage';

// React Router exemple :
<Route
  path="/admin/integrations"
  element={
    <ProtectedRoute requireAdmin>
      <IntegrationsPage />
    </ProtectedRoute>
  }
/>
```

(Si vous n'avez pas encore de `ProtectedRoute requireAdmin`, la page elle-même bloque l'accès aux non-admins via `useIntegrations`.)

### Étape 5 — Ajouter un lien dans votre menu admin

Quelque part dans votre sidebar admin :

```tsx
<NavLink to="/admin/integrations">
  ⚙️ Intégrations marketing
</NavLink>
```

C'est tout. Vous pouvez maintenant aller sur `app.immoprox.io/admin/integrations` ✅

---

## 🔐 Pré-requis Supabase (déjà en place)

Si vous avez déjà déployé les edge functions et appliqué la migration SQL depuis le repo marketing, **rien à faire**. Sinon, voir `ADMIN_PANEL_SETUP.md` à la racine du repo marketing.

Récapitulatif :
- ✅ Table `site_config` créée
- ✅ Table `user_roles` créée
- ✅ Function `is_admin()` créée
- ✅ Edge Functions déployées : `config`, `admin-config`, `meta-capi`, `whatsapp-send`
- ✅ Secret `SUPABASE_SERVICE_ROLE_KEY` configuré sur les edge functions
- ✅ Votre user a été assigné au rôle `admin` dans `user_roles`

---

## 🎨 Adapter au design system de votre plateforme

Les styles dans `integrations.module.css` sont **volontairement neutres** pour ne pas casser votre charte. Vous avez 3 options :

### Option A — Garder le CSS module (rapide)
Ne touchez à rien, ça marche tel quel.

### Option B — Adapter les couleurs aux variables de votre plateforme
Remplacez les couleurs en dur par vos variables CSS :

```css
/* avant */
.btnPrimary { background: #0579da; }
/* après */
.btnPrimary { background: var(--color-primary); }
```

### Option C — Réécrire avec votre design system (Tailwind, shadcn, MUI, etc.)
Remplacez les classes `styles.xxx` par vos composants.

Exemple shadcn/ui pour `IntegrationCard.tsx` :

```tsx
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
// … remplacez les <div className={styles.xxx}> par <Card>, <Button>, etc.
```

---

## 🧪 Tester localement

```bash
cd ~/votre-platform/  # le repo de app.immoprox.io
npm install
npm run dev
```

Connectez-vous avec votre compte super admin sur la plateforme, puis allez sur `/admin/integrations`.

Si « Accès refusé » s'affiche → il manque l'INSERT dans `user_roles` (voir guide ADMIN_PANEL_SETUP.md à la racine).

---

## 🔄 Comment ça fonctionne

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│  app.immoprox.io                │         │  Supabase (lbnqccsebwiifxcucflg) │
│                                 │         │                                  │
│  /admin/integrations            │  fetch  │  Edge Function /admin-config     │
│  ├─ IntegrationsPage.tsx       │ ──────► │  ├─ vérifie is_admin() via RLS  │
│  ├─ useIntegrations()          │         │  └─ CRUD sur table site_config  │
│  └─ integrationsApi.ts          │         │                                  │
│                                 │         │  Edge Function /config           │
│                                 │         │  └─ retourne clés activées       │
│                                 │         │     (utilisé par tracking.js     │
│                                 │         │      du site marketing)          │
└─────────────────────────────────┘         └──────────────────────────────────┘
                                                       │
                                                       ▼
                                            ┌──────────────────────┐
                                            │  immoprox.io         │
                                            │  (site marketing)    │
                                            │  tracking.js fetch   │
                                            │  /config et active   │
                                            │  GA4, Meta Pixel,    │
                                            │  WhatsApp, etc.      │
                                            └──────────────────────┘
```

**En résumé :**
- Vous gérez les intégrations depuis `app.immoprox.io/admin/integrations`
- Les valeurs sont stockées dans la table partagée `site_config`
- Le site marketing `immoprox.io` les charge automatiquement via `/config`
- Les outils (GA4, Meta Pixel, WhatsApp…) s'activent en moins de 5 minutes

---

## 🆘 Troubleshooting

### « Accès refusé » à la page
→ Votre user n'a pas le rôle `admin`. Exécutez en SQL Editor Supabase :
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'votre@email.com'
ON CONFLICT DO NOTHING;
```

### Erreur réseau / 401 lors du PATCH
→ Vérifier que les edge functions sont déployées :
```bash
supabase functions list
```
Vous devez voir `admin-config` dans la liste.

### `import { supabase } from '../lib/supabase'` introuvable
→ Vous n'avez pas adapté le chemin dans `services/integrationsApi.ts`. Voir étape 2.

### Le toggle ON/OFF ne s'active pas
→ Le bouton est désactivé tant qu'aucune valeur n'est renseignée. Collez d'abord la valeur, cliquez Enregistrer, puis activez.

### Modifier un secret déjà enregistré
→ Le champ affiche `••••XXXX`. Effacez tout, collez la nouvelle valeur, cliquez Enregistrer.

---

## 📚 Ressources

- **Documentation des IDs** par intégration → voir `ADMIN_PANEL_SETUP.md` à la racine du repo marketing
- **Schéma SQL** → `supabase/migrations/20260502000000_site_config.sql`
- **Edge Functions** → `supabase/functions/`
- **Tracking script** (qui consomme la config) → `tracking.js` à la racine

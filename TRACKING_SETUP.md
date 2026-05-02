# Tracking Setup — IMMO PRO-X

Documentation pour activer **GA4, Google Ads, Meta Pixel + Conversions API, TikTok, LinkedIn, Microsoft Clarity** et GTM.

## 📋 IDs à obtenir

Tous les IDs sont à remplacer dans **`tracking.js`** (variable `CONFIG`).

### 1. Google Analytics 4 (gratuit, indispensable)

1. Aller sur https://analytics.google.com → Admin → Créer une propriété
2. Choisir « Web » comme plateforme → URL `https://immoprox.io`
3. Copier le **Measurement ID** (format `G-XXXXXXXXXX`)
4. Coller dans `tracking.js` → `CONFIG.GA4_ID`

### 2. Google Ads Conversion (pour SEA)

1. Aller sur https://ads.google.com → Outils → Conversions → +Action de conversion
2. Choisir « Site web » → Catégorie « Lead » → Valeur `25 EUR` (ou laisser dynamique)
3. Récupérer l'ID `AW-XXXXXXXXX` et le **Label de conversion**
4. Coller dans `tracking.js` :
   - `CONFIG.GADS_CONVERSION_ID = 'AW-XXXXXXXXX'`
   - `CONFIG.GADS_CONVERSION_LABEL = 'votre_label'`

### 3. Meta Pixel + Conversions API (Facebook / Instagram)

#### A) Pixel (côté navigateur)
1. https://business.facebook.com → Events Manager → Connecter une source de données
2. Choisir « Web » → Donner un nom (ex: « IMMO PRO-X Website »)
3. Copier l'ID Pixel (15 chiffres) → `CONFIG.META_PIXEL_ID`

#### B) Conversions API (server-side, ESSENTIEL pour iOS 14+)
1. Dans Events Manager → Settings → Conversions API → « Generate Access Token »
2. Copier le token (~250 chars) — **ne jamais commit dans git**
3. Déployer l'edge function (voir `api-meta-capi-template.js`) :
   - Option recommandée : **Supabase Edge Function** (vous utilisez déjà Supabase)
   ```bash
   mkdir -p supabase/functions/meta-capi
   cp api-meta-capi-template.js supabase/functions/meta-capi/index.ts
   supabase secrets set META_PIXEL_ID=000000000000000
   supabase secrets set META_ACCESS_TOKEN=EAAxxxxx...
   supabase functions deploy meta-capi
   ```
4. Dans `tracking.js` :
   - `CONFIG.META_CAPI_ENDPOINT = 'https://VOTRE-PROJET.supabase.co/functions/v1/meta-capi'`
   - `CONFIG.ENABLE.meta_capi = true`

### 4. TikTok Pixel (optionnel, mais TikTok Ads = forte audience immobilier)

1. https://ads.tiktok.com → Assets → Events → Web Events → Set up
2. Choisir « Manually install pixel code »
3. Copier le **Pixel ID** → `CONFIG.TIKTOK_PIXEL_ID`
4. `CONFIG.ENABLE.tiktok = true`

### 5. LinkedIn Insight Tag (B2B, pertinent pour cibler agences/promoteurs)

1. https://www.linkedin.com/campaignmanager → Account Assets → Insight Tag
2. Copier le **Partner ID** → `CONFIG.LINKEDIN_PARTNER_ID`
3. `CONFIG.ENABLE.linkedin = true`

### 6. Microsoft Clarity (gratuit, heatmaps + session recordings)

1. https://clarity.microsoft.com → New project → coller URL `https://immoprox.io`
2. Copier le **Project ID** → `CONFIG.CLARITY_ID`
3. `CONFIG.ENABLE.clarity = true`

### 7. GTM (déjà configuré)

L'ID `GTM-NF3G7HXL` est déjà actif. Pour ajouter d'autres tags via GTM, c'est dans l'interface https://tagmanager.google.com.

---

## 🎯 Événements automatiquement trackés

Le script `tracking.js` capture **automatiquement** :

| Événement | Quand | GA4 | Meta | Google Ads |
|---|---|---|---|---|
| `page_view` | Chargement de page | ✅ | ✅ | ✅ |
| `click_cta` | Clic sur tout `[data-cta]` | ✅ | ✅ | — |
| `contact_intent` | Clic WhatsApp / Email / Téléphone | ✅ | ✅ | — |
| `schedule` | Clic sur lien Cal.eu | ✅ | ✅ | — |
| `form_start` | Premier focus dans un formulaire | ✅ | — | — |
| `form_step` | Passage à l'étape 2 du form contact | ✅ | — | — |
| `generate_lead` | Soumission complète du formulaire | ✅ | ✅ | ✅ |

---

## 🔌 Wiring du formulaire de contact

Dans `contact.html`, après soumission réussie du formulaire, appeler :

```javascript
window.IMMOTrack.lead({
  email: form.email.value,
  phone: form.phone.value,
  name: form.full_name.value,
  value: 25,           // valeur estimée d'un lead (à ajuster selon votre LTV)
  currency: 'EUR',
  form_destination: 'contact-2-step',
});
```

Ce code est déjà câblé dans le handler de submit existant — il suffit que `tracking.js` soit chargé avant.

---

## 🧪 Tests & validation

### Tester GA4
- Ouvrir GA4 → Reports → Realtime
- Visiter le site → vérifier que la session apparaît

### Tester Meta Pixel
- Installer l'extension Chrome **« Meta Pixel Helper »**
- Visiter le site → l'icône doit s'allumer en vert et lister les events

### Tester Meta CAPI
- Dans Events Manager → Test Events → Generate test event code
- Mettre `META_TEST_EVENT_CODE=TEST12345` dans les variables d'env de l'edge function
- Soumettre le formulaire → l'event apparaît dans Test Events
- Une fois validé, retirer `META_TEST_EVENT_CODE`

### Vérifier la déduplication Pixel ⇄ CAPI
- Dans Events Manager → Diagnostics → check « Deduplicated events »
- Doit être > 90% si tout est bien câblé (event_id partagé)

---

## 🔒 Cookie consent

Le tracking ne se charge que si `localStorage.getItem('cookie-consent') === 'accepted'`.
Le cookie banner existant (`shared.js`) gère déjà le consentement.

Quand l'utilisateur accepte, déclencher manuellement :
```javascript
window.dispatchEvent(new Event('cookie-consent-given'));
```
(à ajouter dans `shared.js` après `localStorage.setItem('cookie-consent', 'accepted')`)

---

## 📊 Recommandations Google Ads (groupes d'annonces)

Une fois GA4 et Google Ads conversion configurés :

| Campaign | Keywords | Budget conseillé | CPC cible |
|---|---|---|---|
| **[Brand]** IMMO PRO-X | immo pro-x, "immo pro x" | 5€/jour | 0,5€ |
| **[Generic CRM]** Immobilier | crm immobilier, logiciel agence | 30€/jour | 2-4€ |
| **[Pain]** Gestion Leads | gestion leads immobilier, qualification | 20€/jour | 1,5-3€ |
| **[Compétiteurs]** vs HubSpot | crm immobilier vs hubspot | 10€/jour | 1-2€ |
| **[Long tail]** Cas d'usage | crm pour promoteur, crm agence multi-bureaux | 15€/jour | 1-2€ |

Lancer en **manual CPC** au début, passer en **Maximize Conversions** une fois 30+ conversions enregistrées.

---

## ✅ Checklist finale avant prod

- [ ] GA4 ID renseigné dans `tracking.js`
- [ ] GA4 Realtime affiche les visites
- [ ] Google Ads conversion ID + label renseignés
- [ ] Meta Pixel ID renseigné
- [ ] Meta Pixel Helper affiche les events
- [ ] Meta CAPI edge function déployée
- [ ] Meta CAPI dédup > 90% dans Events Manager
- [ ] (Optionnel) TikTok Pixel actif
- [ ] (Optionnel) LinkedIn Insight actif
- [ ] (Optionnel) Microsoft Clarity actif
- [ ] Cookie banner accepte → tracking démarre
- [ ] Form submit déclenche `IMMOTrack.lead()` correctement
- [ ] Test campagne SEA avec 5€/jour pendant 1 semaine pour calibrer

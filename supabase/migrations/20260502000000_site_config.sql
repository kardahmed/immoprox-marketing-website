-- ════════════════════════════════════════════════════════════════════════════
--  Migration : site_config + admin role + RLS
--  Date      : 2026-05-02
--  Description : Crée la table de configuration des intégrations + le système
--                de rôles admin pour le panneau d'administration.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Table : site_config ────────────────────────────────────────────────────
-- Stocke toutes les clés/tokens des intégrations (analytics, ads, comms…).
-- Les valeurs `is_secret = true` ne sont jamais exposées au navigateur.
CREATE TABLE IF NOT EXISTS public.site_config (
  key           TEXT        PRIMARY KEY,
  value         TEXT,
  label         TEXT        NOT NULL,
  category      TEXT        NOT NULL,                          -- analytics | ads | communication | crm
  description   TEXT,
  doc_url       TEXT,                                          -- lien vers la doc fournisseur
  is_secret     BOOLEAN     NOT NULL DEFAULT FALSE,            -- true = ne JAMAIS exposer côté client
  enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order    INTEGER     NOT NULL DEFAULT 100,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_site_config_category ON public.site_config(category);
CREATE INDEX IF NOT EXISTS idx_site_config_enabled  ON public.site_config(enabled) WHERE enabled = TRUE;

-- ─── Trigger : auto-update updated_at + updated_by ──────────────────────────
CREATE OR REPLACE FUNCTION public.tg_site_config_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS site_config_touch ON public.site_config;
CREATE TRIGGER site_config_touch
  BEFORE UPDATE ON public.site_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_site_config_touch();

-- ─── Système de rôles admin ─────────────────────────────────────────────────
-- On utilise un custom claim JWT (préférable à une table) côté Supabase Auth.
-- Pour simplifier, on stocke le rôle dans une table user_roles.
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role     TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

-- Helper : retourne true si l'utilisateur courant est admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── RLS policies ───────────────────────────────────────────────────────────
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles  ENABLE ROW LEVEL SECURITY;

-- site_config : lecture publique des clés non-secrètes ET activées
DROP POLICY IF EXISTS site_config_public_read ON public.site_config;
CREATE POLICY site_config_public_read ON public.site_config
  FOR SELECT
  TO anon, authenticated
  USING (is_secret = FALSE AND enabled = TRUE);

-- site_config : lecture/écriture complète pour les admins
DROP POLICY IF EXISTS site_config_admin_all ON public.site_config;
CREATE POLICY site_config_admin_all ON public.site_config
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- user_roles : seuls les admins peuvent voir/modifier les rôles
DROP POLICY IF EXISTS user_roles_admin_read ON public.user_roles;
CREATE POLICY user_roles_admin_read ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS user_roles_admin_write ON public.user_roles;
CREATE POLICY user_roles_admin_write ON public.user_roles
  FOR INSERT WITH CHECK (public.is_admin());

-- ─── Seed : intégrations supportées ─────────────────────────────────────────
INSERT INTO public.site_config (key, value, label, category, description, doc_url, is_secret, enabled, sort_order) VALUES

-- ANALYTICS
('ga4_id',            NULL, 'Google Analytics 4',  'analytics',     'Measurement ID format G-XXXXXXXXXX',                                  'https://analytics.google.com',    FALSE, FALSE, 10),
('gtm_id',            'GTM-NF3G7HXL', 'Google Tag Manager', 'analytics', 'Container ID format GTM-XXXXXXX',                                'https://tagmanager.google.com',   FALSE, TRUE,  20),
('clarity_id',        NULL, 'Microsoft Clarity',   'analytics',     'Project ID (heatmaps + session recordings, gratuit)',                  'https://clarity.microsoft.com',   FALSE, FALSE, 30),
('hotjar_id',         NULL, 'Hotjar',              'analytics',     'Site ID Hotjar',                                                       'https://www.hotjar.com',          FALSE, FALSE, 40),

-- ADS / PUBLICITÉ
('gads_conversion_id',    NULL, 'Google Ads Conversion ID',    'ads', 'Format AW-XXXXXXXXX',                                              'https://ads.google.com',          FALSE, FALSE, 110),
('gads_conversion_label', NULL, 'Google Ads Conversion Label', 'ads', 'Label de la conversion Lead',                                     'https://ads.google.com',          FALSE, FALSE, 111),
('meta_pixel_id',         NULL, 'Meta Pixel ID',               'ads', '15 chiffres, depuis Events Manager Facebook',                     'https://business.facebook.com',   FALSE, FALSE, 120),
('meta_capi_token',       NULL, 'Meta Conversions API Token',  'ads', 'Access Token (server-side, secret)',                              'https://business.facebook.com',   TRUE,  FALSE, 121),
('meta_capi_test_code',   NULL, 'Meta CAPI Test Event Code',   'ads', 'Optionnel — pour tester avant de passer en prod (TEST12345)',     'https://business.facebook.com',   FALSE, FALSE, 122),
('tiktok_pixel_id',       NULL, 'TikTok Pixel ID',             'ads', 'Pixel Code TikTok Ads',                                           'https://ads.tiktok.com',          FALSE, FALSE, 130),
('linkedin_partner_id',   NULL, 'LinkedIn Insight Partner ID', 'ads', 'Partner ID LinkedIn Campaign Manager',                            'https://campaign.linkedin.com',   FALSE, FALSE, 140),
('snapchat_pixel_id',     NULL, 'Snapchat Pixel ID',           'ads', 'Pixel ID Snap Ads',                                               'https://ads.snapchat.com',        FALSE, FALSE, 150),

-- COMMUNICATION
('whatsapp_phone_id',     NULL, 'WhatsApp Business Phone ID',  'communication', 'Phone Number ID (Meta WhatsApp Business API)',          'https://business.facebook.com',   FALSE, FALSE, 210),
('whatsapp_token',        NULL, 'WhatsApp Business Token',     'communication', 'Access Token long-lived (secret)',                      'https://business.facebook.com',   TRUE,  FALSE, 211),
('whatsapp_template_lead',NULL, 'WhatsApp Template (lead)',    'communication', 'Nom du template approuvé pour message auto au lead',    'https://business.facebook.com',   FALSE, FALSE, 212),
('sendinblue_api_key',    NULL, 'Brevo (Sendinblue) API Key',  'communication', 'API key Brevo pour emails transactionnels (secret)',    'https://app.brevo.com',           TRUE,  FALSE, 220),
('mailchimp_api_key',     NULL, 'Mailchimp API Key',           'communication', 'API key Mailchimp (secret)',                            'https://mailchimp.com',           TRUE,  FALSE, 230),

-- CRM
('hubspot_hub_id',        NULL, 'HubSpot Hub ID',              'crm',           'Pour le tracking script HubSpot (visibilité visiteurs)','https://hubspot.com',             FALSE, FALSE, 310),
('intercom_app_id',       NULL, 'Intercom App ID',             'crm',           'Chat support / messaging',                              'https://www.intercom.com',        FALSE, FALSE, 320),

-- MONITORING
('sentry_dsn',            NULL, 'Sentry DSN',                  'monitoring',    'Tracking des erreurs JS côté client',                   'https://sentry.io',               FALSE, FALSE, 410),

-- BOOKING
('cal_embed_url',         'https://cal.eu/kardahmed/demo-immo-pro-x-30min', 'Cal.eu Embed URL', 'communication', 'URL de booking Cal.eu/Cal.com', 'https://cal.com', FALSE, TRUE, 240)

ON CONFLICT (key) DO NOTHING;

-- ─── Bootstrap : créer un premier admin ─────────────────────────────────────
-- Après avoir créé votre user via l'app, exécutez :
--   INSERT INTO public.user_roles (user_id, role)
--   SELECT id, 'admin' FROM auth.users WHERE email = 'votre@email.com';

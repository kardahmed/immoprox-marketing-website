/**
 * Types TypeScript pour la gestion des intégrations marketing.
 * Ces types correspondent à la table `site_config` dans Supabase.
 */

export type IntegrationCategory =
  | 'analytics'
  | 'ads'
  | 'communication'
  | 'crm'
  | 'monitoring';

export interface Integration {
  key: string;
  value: string | null;          // Masqué (••••XXXX) si is_secret=true et value présente
  label: string;
  category: IntegrationCategory;
  description: string | null;
  doc_url: string | null;
  is_secret: boolean;
  enabled: boolean;
  sort_order: number;
  has_value: boolean;            // Indique si une valeur est définie (utile car value est masquée)
  updated_at: string;
  updated_by: string | null;
}

export interface UpdateIntegrationPayload {
  key: string;
  value?: string | null;
  enabled?: boolean;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  analytics: 'Analytics',
  ads: 'Publicité (Ads)',
  communication: 'Communication',
  crm: 'CRM',
  monitoring: 'Monitoring',
};

export const CATEGORY_ICONS: Record<IntegrationCategory, string> = {
  analytics: '📊',
  ads: '💰',
  communication: '💬',
  crm: '🤝',
  monitoring: '🛡️',
};

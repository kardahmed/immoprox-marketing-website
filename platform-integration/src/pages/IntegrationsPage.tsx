/**
 * Page Intégrations — à monter sur une route admin de votre plateforme
 * (par exemple : /admin/integrations).
 *
 * Usage dans votre router :
 *   import { IntegrationsPage } from './pages/IntegrationsPage';
 *   <Route path="/admin/integrations" element={<IntegrationsPage />} />
 */

import { useMemo, useState } from 'react';
import { useIntegrations } from '../hooks/useIntegrations';
import { IntegrationCard } from '../components/IntegrationCard';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  type IntegrationCategory,
} from '../types/integrations.types';
import styles from '../styles/integrations.module.css';

export function IntegrationsPage() {
  const { items, loading, error, isAdmin, saveValue, toggleEnabled, test } = useIntegrations();
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory | null>(null);

  // Catégories distinctes triées
  const categories = useMemo<IntegrationCategory[]>(() => {
    const set = new Set<IntegrationCategory>();
    items.forEach((i) => set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  // Sélection par défaut de la première catégorie
  const currentCategory = activeCategory ?? categories[0] ?? null;

  // Items filtrés
  const filteredItems = useMemo(
    () =>
      currentCategory ? items.filter((i) => i.category === currentCategory) : [],
    [items, currentCategory]
  );

  // ───────── Loading / Error / Forbidden states
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Chargement des intégrations…</div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className={styles.page}>
        <div className={styles.forbidden}>
          <h2>Accès refusé</h2>
          <p>Vous devez avoir le rôle « admin » pour accéder à cette page.</p>
          <p className={styles.hint}>
            Demandez à un administrateur d'exécuter cette requête SQL :
            <pre>
{`INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'votre@email.com';`}
            </pre>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBox}>
          <strong>Erreur :</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Intégrations</h1>
        <p className={styles.subtitle}>
          Gérez tous vos pixels, tokens et clés d'API depuis cette page. Les modifications sont actives en moins de 5 minutes.
        </p>
      </header>

      {/* ───────── Tabs catégories ───────── */}
      <nav className={styles.tabs} aria-label="Catégories">
        {categories.map((cat) => {
          const total = items.filter((i) => i.category === cat).length;
          const enabled = items.filter((i) => i.category === cat && i.enabled).length;
          const isActive = cat === currentCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            >
              <span className={styles.tabIcon}>{CATEGORY_ICONS[cat]}</span>
              {CATEGORY_LABELS[cat]}
              <span className={styles.tabCount}>
                {enabled}/{total}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ───────── Grille des cartes ───────── */}
      <div className={styles.grid}>
        {filteredItems.map((item) => (
          <IntegrationCard
            key={item.key}
            item={item}
            onSave={saveValue}
            onToggle={toggleEnabled}
            onTest={test}
          />
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className={styles.empty}>Aucune intégration dans cette catégorie.</div>
      )}
    </div>
  );
}

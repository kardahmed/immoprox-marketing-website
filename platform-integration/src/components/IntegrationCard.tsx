/**
 * Carte d'une intégration : input pour la valeur, boutons enregistrer/tester/toggle.
 *
 * 💡 Styling : utilise les classes CSS de `integrations.module.css`.
 *    Adaptez si vous utilisez Tailwind / shadcn / votre propre design system.
 */

import { useEffect, useState } from 'react';
import type { Integration } from '../types/integrations.types';
import styles from '../styles/integrations.module.css';

interface IntegrationCardProps {
  item: Integration;
  onSave: (key: string, value: string) => Promise<void>;
  onToggle: (key: string, enabled: boolean) => Promise<void>;
  onTest: (key: string) => Promise<{ ok: boolean; message: string }>;
}

export function IntegrationCard({ item, onSave, onToggle, onTest }: IntegrationCardProps) {
  const [value, setValue] = useState(item.value ?? '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setValue(item.value ?? '');
  }, [item.value]);

  const isMaskedSecret = item.is_secret && item.has_value && value.startsWith('••••');

  const handleSave = async () => {
    if (isMaskedSecret) {
      setFeedback({ ok: false, message: 'Collez la nouvelle valeur pour la modifier.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await onSave(item.key, value.trim());
      setFeedback({ ok: true, message: 'Enregistré ✓' });
    } catch (e) {
      setFeedback({ ok: false, message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await onToggle(item.key, !item.enabled);
    } catch (e) {
      setFeedback({ ok: false, message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await onTest(item.key);
      setFeedback(result);
    } catch (e) {
      setFeedback({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const statusLabel = item.enabled
    ? 'Activé'
    : item.has_value
    ? 'Configuré · inactif'
    : 'Non configuré';

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          <div className={styles.cardLabel}>{item.label}</div>
          {item.description && <div className={styles.cardDesc}>{item.description}</div>}
        </div>
        <div className={styles.statusGroup}>
          <span
            className={`${styles.status} ${
              item.enabled ? styles.statusOn : styles.statusOff
            }`}
          >
            {statusLabel}
          </span>
          {item.is_secret && <span className={styles.statusSecret}>🔒 Secret</span>}
        </div>
      </div>

      <div className={styles.field}>
        <input
          type={item.is_secret ? 'password' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={item.is_secret ? 'Token / clé secrète' : 'Valeur'}
          autoComplete="off"
          spellCheck={false}
          className={value ? styles.inputFilled : styles.input}
        />
      </div>

      {feedback && (
        <div className={feedback.ok ? styles.feedbackOk : styles.feedbackErr}>
          {feedback.message}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={styles.btnPrimary}
        >
          {saving ? '...' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || !item.has_value}
          className={styles.btnSecondary}
        >
          {testing ? '...' : 'Tester'}
        </button>
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving || !item.has_value}
          className={item.enabled ? styles.btnToggleOn : styles.btnToggleOff}
          title={!item.has_value ? 'Renseignez une valeur d\'abord' : ''}
        >
          {item.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {item.doc_url && (
        <a
          href={item.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.docLink}
        >
          📖 Documentation →
        </a>
      )}
    </div>
  );
}

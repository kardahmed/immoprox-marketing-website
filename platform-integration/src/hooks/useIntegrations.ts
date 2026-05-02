/**
 * Hook React pour gérer la liste des intégrations.
 * Encapsule le fetch initial, les mutations (update/toggle/test) et le state.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  listIntegrations,
  updateIntegration,
  testIntegration,
  checkIsAdmin,
} from '../services/integrationsApi';
import type { Integration } from '../types/integrations.types';

export interface UseIntegrationsReturn {
  items: Integration[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean | null;          // null tant que la vérif n'est pas terminée
  reload: () => Promise<void>;
  saveValue: (key: string, value: string) => Promise<void>;
  toggleEnabled: (key: string, enabled: boolean) => Promise<void>;
  test: (key: string) => Promise<{ ok: boolean; message: string }>;
}

export function useIntegrations(): UseIntegrationsReturn {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const adminCheck = await checkIsAdmin();
      setIsAdmin(adminCheck);
      if (!adminCheck) {
        setItems([]);
        return;
      }
      const data = await listIntegrations();
      setItems(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveValue = useCallback(
    async (key: string, value: string) => {
      await updateIntegration({ key, value: value === '' ? null : value });
      await reload();
    },
    [reload]
  );

  const toggleEnabled = useCallback(
    async (key: string, enabled: boolean) => {
      await updateIntegration({ key, enabled });
      await reload();
    },
    [reload]
  );

  const test = useCallback(async (key: string) => {
    return await testIntegration(key);
  }, []);

  return { items, loading, error, isAdmin, reload, saveValue, toggleEnabled, test };
}

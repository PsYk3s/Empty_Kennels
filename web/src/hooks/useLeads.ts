import { useCallback, useEffect, useState } from 'react';
import { db } from '../storage/db';
import type { Lead } from '../types/lead';

type SyncCycleDetail = { changed?: boolean };

export function useLeads(limit = 100) {
  const [leads, setLeads] = useState<Lead[]>([]);

  const refresh = useCallback(async () => {
    const rows = await db.leads.allList(limit);
    setLeads(rows as Lead[]);
  }, [limit]);

  useEffect(() => {
    void refresh();

    const onCycle = (event: Event) => {
      const detail = (event as CustomEvent<SyncCycleDetail>).detail;
      if (detail?.changed !== false) void refresh();
    };

    window.addEventListener('pb-sync-cycle', onCycle);
    return () => window.removeEventListener('pb-sync-cycle', onCycle);
  }, [refresh]);

  return { leads, refresh };
}

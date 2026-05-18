import { useEffect, useState } from 'react';
import { getSyncHealth, type SyncHealth } from '../sync/syncManager';
import { api } from '../api/index';

type SMTPStatus = { ok: boolean; message: string } | null;

export function useSyncHealth() {
  const [health, setHealth] = useState<SyncHealth>(getSyncHealth());
  const [smtpStatus, setSmtpStatus] = useState<SMTPStatus>(null);
  const [loadingSmtp, setLoadingSmtp] = useState(true);

  useEffect(() => {
    const onHealth = () => setHealth(getSyncHealth());
    window.addEventListener('pb-sync-health', onHealth);
    const timer = window.setInterval(onHealth, 5000);

    void (async () => {
      setLoadingSmtp(true);
      try {
        const result = await api.get<SMTPStatus>('/health/smtp');
        setSmtpStatus(result?.message ? result : null);
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        if (message && !message.includes('HTTP 405')) {
          setSmtpStatus({ ok: false, message });
        }
      } finally {
        setLoadingSmtp(false);
      }
    })();

    return () => {
      window.removeEventListener('pb-sync-health', onHealth);
      window.clearInterval(timer);
    };
  }, []);

  return { health, setHealth, smtpStatus, loadingSmtp };
}

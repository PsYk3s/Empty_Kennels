import { useEffect, useState } from 'react';
import { syncNow } from '../sync/syncManager';
import { useLeads } from '../hooks/useLeads';
import { useSyncHealth } from '../hooks/useSyncHealth';
import { LeadCard } from '../components/LeadCard';

export function SyncPage() {
  const { leads, refresh } = useLeads(100);
  const { health, smtpStatus, loadingSmtp } = useSyncHealth();

  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const changed = await syncNow({ retryDisabledBrevo: true });
    setSyncing(false);
    if (changed) void refresh();
  };

  const syncDisplay = (() => {
    if (syncing) return { label: 'Syncing\u2026', variant: 'syncing' };
    if (health.lastError) return { label: 'Last sync failed', variant: 'failed' };
    return null;
  })();

  const toggleLead = (uuid: string) =>
    setExpandedLead((prev) => (prev === uuid ? null : uuid));

  return (
    <section className='screen'>
      <div className='screen-head'>
        <h2>Leads</h2>
      </div>

      {!loadingSmtp && smtpStatus && !smtpStatus.ok ? (
        <div className='status-message error'>{smtpStatus.message}</div>
      ) : null}

      {!online ? (
        <div className='status-message error'>
          Offline \u2014 leads saved locally, will sync when back online.
        </div>
      ) : null}

      {syncDisplay ? (
        <div className={`sync-status-banner ${syncDisplay.variant}`}>
          <span className='sync-status-text'>{syncDisplay.label}</span>
        </div>
      ) : null}

      {leads.length > 0 ? (
        <div className='lead-queue-list'>
          {leads.map((lead) => (
            <LeadCard
              key={lead.uuid}
              lead={lead}
              expanded={expandedLead === lead.uuid}
              onToggle={() => toggleLead(lead.uuid)}
            />
          ))}
        </div>
      ) : (
        <div className='queue-empty'>
          <p className='queue-empty-icon'>\u25cb</p>
          <p>No leads yet</p>
          <p className='queue-empty-sub'>Captured leads will appear here</p>
        </div>
      )}

      <div className='actions-row'>
        <button
          type='button'
          className='primary-button'
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? 'Syncing\u2026' : 'Sync Now'}
        </button>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api/index';
import { getDeviceId, syncNow } from '../sync/syncManager';
import { useLeads } from '../hooks/useLeads';
import { useSyncHealth } from '../hooks/useSyncHealth';
import { LeadCard } from '../components/LeadCard';

export function SyncPage() {
  const { leads, refresh } = useLeads(100);
  const { health, smtpStatus, loadingSmtp } = useSyncHealth();

  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [expandedHealth, setExpandedHealth] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [notice, setNotice] = useState('');

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
    setNotice('');
    const changed = await syncNow({ retryDisabledBrevo: true });
    setSyncing(false);
    if (changed) void refresh();
  };

  const handleEmailList = async () => {
    setEmailing(true);
    setNotice('');
    try {
      const result = await api.post<{ ok?: boolean; count?: number; message?: string }>(
        '/leads/email-admin-list',
        {},
      );
      setNotice(
        result.ok
          ? result.message || `Lead list emailed to admin (${result.count ?? 0} leads).`
          : result.message || 'Could not email lead list due to SMTP configuration.',
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not email lead list.');
    } finally {
      setEmailing(false);
    }
  };

  const syncDisplay = (() => {
    if (syncing) return { label: 'Syncing…', variant: 'syncing' };
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
          Offline — leads saved locally, will sync when back online.
        </div>
      ) : null}

      {syncDisplay ? (
        <div className={`sync-status-banner ${syncDisplay.variant}`}>
          <span className='sync-status-text'>{syncDisplay.label}</span>
        </div>
      ) : null}

      <article className={`sync-health-accordion${expandedHealth ? ' open' : ''}`}>
        <button
          type='button'
          className='sync-health-toggle'
          onClick={() => setExpandedHealth((v) => !v)}
          aria-expanded={expandedHealth}
        >
          <span className='sync-health-title'>Sync Health</span>
          <span className={`queue-chevron${expandedHealth ? ' open' : ''}`} aria-hidden='true' />
        </button>
        <div className='sync-health-details'>
          <div className='health-inline'>
            <span>ID: <strong>{getDeviceId()}</strong></span>
            <span>Last Run: <strong>{health.lastRunAt ? new Date(health.lastRunAt).toLocaleTimeString() : 'Never'}</strong></span>
            <span>Last Push: <strong>{health.lastPushAt ? new Date(health.lastPushAt).toLocaleTimeString() : 'Never'}</strong></span>
            <span>Last Pull: <strong>{health.lastPullAt ? new Date(health.lastPullAt).toLocaleTimeString() : 'Never'}</strong></span>
          </div>
          {health.lastError ? (
            <div className='sync-health-error'>\u26a0 {health.lastError}</div>
          ) : null}
        </div>
      </article>

      {leads.length > 0 ? (
        <>
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

          <div className='status-legend-inline'>
            <span className='legend-item'><span className='legend-chip-letter'>E</span> Email</span>
            <span className='legend-item'><span className='legend-chip-letter'>D</span> Database</span>
            <span className='legend-item'><span className='legend-chip-letter'>B</span> Brevo</span>
            <span className='legend-item'><span className='legend-dot success' /> Synced</span>
            <span className='legend-item'><span className='legend-dot pending' /> Pending</span>
            <span className='legend-item'><span className='legend-dot syncing' /> Syncing</span>
            <span className='legend-item'><span className='legend-dot failed' /> Failed</span>
            <span className='legend-item'><span className='legend-dot disabled' /> Disabled</span>
          </div>
        </>
      ) : (
        <div className='queue-empty'>
          <p className='queue-empty-icon'>\u2713</p>
          <p>All caught up</p>
          <p className='queue-empty-sub'>New leads will appear here</p>
        </div>
      )}

      <div className='actions-row'>
        <button
          type='button'
          className='secondary-button'
          onClick={handleEmailList}
          disabled={emailing}
        >
          {emailing ? 'Emailing\u2026' : 'Email List to Admin'}
        </button>
        <button
          type='button'
          className='primary-button'
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? 'Syncing\u2026' : 'Sync Now'}
        </button>
      </div>
      {notice ? <p className='feedback'>{notice}</p> : null}

      <article className={`sync-health-accordion${expandedHealth ? ' open' : ''}`}>
        <button
          type='button'
          className='sync-health-toggle'
          onClick={() => setExpandedHealth((v) => !v)}
          aria-expanded={expandedHealth}
        >
          <span className='sync-health-title'>Sync Diagnostics</span>
          <span className={`queue-chevron${expandedHealth ? ' open' : ''}`} aria-hidden='true' />
        </button>
        <div className='sync-health-details'>
          <div className='health-inline'>
            <span>Device: <strong>{getDeviceId()}</strong></span>
            <span>Last Run: <strong>{health.lastRunAt ? new Date(health.lastRunAt).toLocaleTimeString() : 'Never'}</strong></span>
            <span>Last Push: <strong>{health.lastPushAt ? new Date(health.lastPushAt).toLocaleTimeString() : 'Never'}</strong></span>
            <span>Last Pull: <strong>{health.lastPullAt ? new Date(health.lastPullAt).toLocaleTimeString() : 'Never'}</strong></span>
          </div>
          {health.lastError ? (
            <div className='sync-health-error'>⚠ {health.lastError}</div>
          ) : null}
        </div>
      </article>
    </section>
  );
}

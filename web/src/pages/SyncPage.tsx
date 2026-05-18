import { useEffect, useState } from 'react';
import { db } from '../storage/db';
import { api } from '../api/index';
import { getDeviceId, getSyncHealth, syncNow, type SyncHealth } from '../sync/syncManager';

type SMTPStatus = { ok: boolean; message: string } | null;

export function SyncPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [notice, setNotice] = useState('');
  const [smtpStatus, setSmtpStatus] = useState<SMTPStatus>(null);
  const [loadingSmtp, setLoadingSmtp] = useState(true);
  const [syncHealth, setSyncHealth] = useState<SyncHealth>(getSyncHealth());

  useEffect(() => {
    loadLeads();
    checkSmtp();

    const onHealth = () => setSyncHealth(getSyncHealth());
    const onCycle = () => {
      void loadLeads();
      setSyncHealth(getSyncHealth());
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('pb-sync-health', onHealth);
    window.addEventListener('pb-sync-cycle', onCycle);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const timer = window.setInterval(onHealth, 5000);

    return () => {
      window.removeEventListener('pb-sync-health', onHealth);
      window.removeEventListener('pb-sync-cycle', onCycle);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(timer);
    };
  }, []);

  const loadLeads = async () => {
    const recentLeads = await db.leads.allList(100);
    setLeads(recentLeads);
  };

  const checkSmtp = async () => {
    setLoadingSmtp(true);
    try {
      const result = await api.get<SMTPStatus>('/health/smtp');
      if (result && result.message) {
        setSmtpStatus(result);
      } else {
        setSmtpStatus(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not verify SMTP connection';
      if (!message || message.includes('HTTP 405')) {
        setSmtpStatus(null);
        return;
      }
      setSmtpStatus({
        ok: false,
        message
      });
    } finally {
      setLoadingSmtp(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setNotice('');
    await syncNow();
    setSyncing(false);
    setSyncHealth(getSyncHealth());
    await loadLeads();
  };

  const handleEmailList = async () => {
    setEmailing(true);
    setNotice('');
    try {
      const result = await api.post<{ ok?: boolean; count?: number; message?: string }>('/leads/email-admin-list', {});
      if (result.ok) {
        setNotice(result.message || `Lead list emailed to admin (${result.count || 0} leads).`);
      } else {
        setNotice(result.message || 'Could not email lead list due to SMTP configuration.');
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not email lead list.');
    } finally {
      setEmailing(false);
    }
  };

  const iconForStatus = (status: string | undefined) => {
    if (status === 'sent' || status === 'synced') return 'success';
    if (status === 'syncing') return 'syncing';
    if (status === 'pending') return 'pending';
    if (status === 'disabled') return 'disabled';
    return 'failed';
  };

  const statusLabel = (status: string | undefined) => {
    if (!status) return 'pending';
    return status;
  };

  const formatTs = (value: string | undefined) => {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
  };

  return (
    <section className='screen'>
      <div className='screen-head'>
        <h2>Sync Queue</h2>
      </div>

      {!loadingSmtp && smtpStatus && (
        <div className={`status-message ${smtpStatus.ok ? 'success' : 'error'}`}>
          {smtpStatus.ok ? 'Email service ready.' : smtpStatus.message}
        </div>
      )}

      {!online ? (
        <div className='status-message error'>Offline mode active. Leads are saved locally and will auto-retry sync/email when online.</div>
      ) : null}

      <div className='sync-health'>
        <div className='sync-health-title'>Sync Health</div>
        <div className='sync-health-row'>
          <span>Tablet ID</span>
          <strong>{getDeviceId()}</strong>
        </div>
        <div className='sync-health-row'>
          <span>Last Run</span>
          <strong>{syncHealth.lastRunAt ? new Date(syncHealth.lastRunAt).toLocaleString() : 'Never'}</strong>
        </div>
        <div className='sync-health-row'>
          <span>Last Push</span>
          <strong>{syncHealth.lastPushAt ? new Date(syncHealth.lastPushAt).toLocaleString() : 'Never'}</strong>
        </div>
        <div className='sync-health-row'>
          <span>Last Pull</span>
          <strong>{syncHealth.lastPullAt ? new Date(syncHealth.lastPullAt).toLocaleString() : 'Never'}</strong>
        </div>
        <div className='sync-health-row'>
          <span>Last Success</span>
          <strong>{syncHealth.lastSuccessAt ? new Date(syncHealth.lastSuccessAt).toLocaleString() : 'Never'}</strong>
        </div>
        {syncHealth.lastError ? (
          <div className='sync-health-error'>⚠ {syncHealth.lastError}</div>
        ) : null}
      </div>

      {leads.length > 0 ? (
        <>
          <div className='lead-queue-list'>
            {leads.map((lead) => (
              <article key={lead.uuid} className={`queue-item compact ${expandedLead === lead.uuid ? 'open' : ''}`}>
                <button
                  type='button'
                  className='queue-item-toggle'
                  onClick={() => setExpandedLead((prev) => (prev === lead.uuid ? null : lead.uuid))}
                  aria-expanded={expandedLead === lead.uuid}
                  aria-controls={`lead-${lead.uuid}`}
                >
                  <div className='queue-item-header'>
                    <strong>{lead.firstName} {lead.lastName}</strong>
                    <span className='queue-chevron' aria-hidden='true'>{expandedLead === lead.uuid ? '▾' : '▸'}</span>
                  </div>
                  <p className='queue-item-meta'>{lead.email || 'No email'}</p>
                  <div className='status-icons' role='list' aria-label='Lead sync status'>
                    <span
                      className='status-chip'
                      title={`Email: ${statusLabel(lead.emailSentStatus)}`}
                      aria-label={`Email status ${statusLabel(lead.emailSentStatus)}`}
                    >
                      E
                      <span className={`status-dot ${iconForStatus(lead.emailSentStatus)}`} />
                    </span>
                    <span
                      className='status-chip'
                      title={`Database: ${statusLabel(lead.syncStatus)}`}
                      aria-label={`Database status ${statusLabel(lead.syncStatus)}`}
                    >
                      D
                      <span className={`status-dot ${iconForStatus(lead.syncStatus)}`} />
                    </span>
                    <span
                      className='status-chip'
                      title={`Brevo: ${statusLabel(lead.brevoSyncStatus)}`}
                      aria-label={`Brevo status ${statusLabel(lead.brevoSyncStatus)}`}
                    >
                      B
                      <span className={`status-dot ${iconForStatus(lead.brevoSyncStatus)}`} />
                    </span>
                  </div>
                </button>

                <div id={`lead-${lead.uuid}`} className='queue-item-details'>
                  <div className='queue-detail-grid'>
                    <div><span>Phone</span><strong>{lead.phone || 'None'}</strong></div>
                    <div><span>Company</span><strong>{lead.company || 'None'}</strong></div>
                    <div><span>Interest</span><strong>{lead.interestArea || 'None'}</strong></div>
                    <div><span>Updated</span><strong>{formatTs(lead.updatedAt)}</strong></div>
                    <div><span>Last Synced</span><strong>{formatTs(lead.lastSyncedAt)}</strong></div>
                    <div><span>Created</span><strong>{formatTs(lead.createdAt)}</strong></div>
                  </div>
                  {lead.notes ? <p className='queue-item-notes'>{lead.notes}</p> : null}
                </div>
              </article>
            ))}
          </div>

          <div className='status-legend'>
            <div className='legend-title'>Status Legend</div>
            <div className='legend-row'>
              <span className='legend-dot success' />
              <span className='legend-text'>Synced / Sent</span>
            </div>
            <div className='legend-row'>
              <span className='legend-dot pending' />
              <span className='legend-text'>Pending</span>
            </div>
            <div className='legend-row'>
              <span className='legend-dot syncing' />
              <span className='legend-text'>Syncing now</span>
            </div>
            <div className='legend-row'>
              <span className='legend-dot failed' />
              <span className='legend-text'>Failed</span>
            </div>
            <div className='legend-row'>
              <span className='legend-dot disabled' />
              <span className='legend-text'>Disabled</span>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>✓ All synced</p>
          <p style={{ fontSize: '0.95rem' }}>New leads will appear here</p>
        </div>
      )}

      <div className='actions-row'>
        <button
          type='button'
          className='secondary-button'
          onClick={handleEmailList}
          disabled={emailing}
        >
          {emailing ? 'Emailing...' : 'Email Full List to Admin'}
        </button>
        <button
          type='button'
          className='primary-button'
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>
      {notice ? <p className='feedback'>{notice}</p> : null}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { db } from '../storage/db';
import { api } from '../api/index';
import { getDeviceId, getSyncHealth, syncNow, type SyncHealth } from '../sync/syncManager';

type SMTPStatus = { ok: boolean; message: string } | null;

export function SyncPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [expandedHealth, setExpandedHealth] = useState(false);
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
    await syncNow({ retryDisabledBrevo: true });
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

  const reasonForStatus = (
    type: 'email' | 'database' | 'brevo',
    status: string | undefined,
    explicitReason?: string
  ) => {
    if (explicitReason) return explicitReason;

    if (status === 'sent' || status === 'synced') {
      if (type === 'email') return 'Email delivered successfully.';
      if (type === 'database') return 'Lead saved to central database.';
      return 'Contact synced to Brevo list.';
    }
    if (status === 'syncing') return 'Sync currently in progress.';
    if (status === 'pending') return 'Queued for next sync attempt.';
    if (status === 'disabled') return 'Integration disabled in server configuration.';
    return 'Operation failed. Check API/server credentials and try Sync Now.';
  };

  const formatTs = (value: string | undefined) => {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
  };

  const getSyncStatusDisplay = () => {
    if (syncing) return { status: 'Syncing...', icon: '⟳', color: 'syncing' };
    if (syncHealth.lastError) return { status: 'Sync failed', icon: '⚠', color: 'failed' };
    if (syncHealth.lastSuccessAt) {
      const mins = Math.round((Date.now() - new Date(syncHealth.lastSuccessAt).getTime()) / 60000);
      const timeAgo = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
      return { status: `Synced ${timeAgo}`, icon: '✓', color: 'success' };
    }
    return { status: 'No syncs yet', icon: '-', color: 'pending' };
  };

  const syncDisplay = getSyncStatusDisplay();

  return (
    <section className='screen'>
      <div className='screen-head'>
        <h2>Sync Queue</h2>
      </div>

      {!loadingSmtp && smtpStatus && !smtpStatus.ok ? (
        <div className='status-message error'>{smtpStatus.message}</div>
      ) : null}

      {!online ? (
        <div className='status-message error'>Offline mode active. Leads are saved locally and will auto-retry sync/email when online.</div>
      ) : null}

      {syncDisplay.color !== 'success' ? (
        <div className={`sync-status-banner ${syncDisplay.color}`}>
          <span className={`sync-status-icon ${syncDisplay.color}`}>{syncDisplay.icon}</span>
          <span className='sync-status-text'>{syncDisplay.status}</span>
        </div>
      ) : null}

      <article className={`sync-health-accordion ${expandedHealth ? 'open' : ''}`}>
        <button
          type='button'
          className='sync-health-toggle'
          onClick={() => setExpandedHealth(!expandedHealth)}
          aria-expanded={expandedHealth}
        >
          <span className='sync-health-title'>Sync Health</span>
          <span className='accordion-chevron'>{expandedHealth ? '▾' : '▸'}</span>
        </button>
        <div className='sync-health-details'>
          <div className='health-inline'>
            <span>ID: <strong>{getDeviceId()}</strong></span>
            <span>Last Run: <strong>{syncHealth.lastRunAt ? new Date(syncHealth.lastRunAt).toLocaleTimeString() : 'Never'}</strong></span>
            <span>Last Push: <strong>{syncHealth.lastPushAt ? new Date(syncHealth.lastPushAt).toLocaleTimeString() : 'Never'}</strong></span>
            <span>Last Pull: <strong>{syncHealth.lastPullAt ? new Date(syncHealth.lastPullAt).toLocaleTimeString() : 'Never'}</strong></span>
          </div>
          {syncHealth.lastError ? (
            <div className='sync-health-error'>⚠ {syncHealth.lastError}</div>
          ) : null}
        </div>
      </article>

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
                  <div className='queue-item-collapsed'>
                    <div className='queue-item-header'>
                      <strong>{lead.firstName} {lead.lastName}</strong>
                      <span className='queue-chevron' aria-hidden='true'>{expandedLead === lead.uuid ? '▾' : '▸'}</span>
                    </div>
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
                  </div>
                </button>

                <div id={`lead-${lead.uuid}`} className='queue-item-details'>
                  <p className='queue-item-meta'>{lead.email || 'No email'}</p>
                  <div className='queue-status-lines'>
                    <div className='queue-status-item'>
                      <p><strong>Email Status:</strong> {statusLabel(lead.emailSentStatus)}</p>
                      <p className='queue-status-reason'>{reasonForStatus('email', lead.emailSentStatus, lead.emailStatusMessage)}</p>
                    </div>
                    <div className='queue-status-item'>
                      <p><strong>Database Status:</strong> {statusLabel(lead.syncStatus)}</p>
                      <p className='queue-status-reason'>{reasonForStatus('database', lead.syncStatus, lead.databaseStatusMessage)}</p>
                    </div>
                    <div className='queue-status-item'>
                      <p><strong>Brevo Status:</strong> {statusLabel(lead.brevoSyncStatus)}</p>
                      <p className='queue-status-reason'>{reasonForStatus('brevo', lead.brevoSyncStatus, lead.brevoStatusMessage)}</p>
                    </div>
                  </div>
                  <div className='queue-detail-stack'>
                    <p><strong>Phone:</strong> {lead.phone || 'None'}</p>
                    <p><strong>Company:</strong> {lead.company || 'None'}</p>
                    <p><strong>Interest:</strong> {lead.interestArea || 'None'}</p>
                    <p><strong>Updated:</strong> {formatTs(lead.updatedAt)}</p>
                    <p><strong>Last Synced:</strong> {formatTs(lead.lastSyncedAt)}</p>
                    <p><strong>Created:</strong> {formatTs(lead.createdAt)}</p>
                  </div>
                  {lead.notes ? <p className='queue-item-notes'>{lead.notes}</p> : null}
                </div>
              </article>
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

import { useEffect, useState } from 'react';
import { db } from '../storage/db';
import { api } from '../api/index';
import { syncNow } from '../sync/syncManager';

type SMTPStatus = { ok: boolean; message: string } | null;

export function SyncPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [notice, setNotice] = useState('');
  const [smtpStatus, setSmtpStatus] = useState<SMTPStatus>(null);
  const [loadingSmtp, setLoadingSmtp] = useState(true);

  useEffect(() => {
    loadLeads();
    checkSmtp();
  }, []);

  const loadLeads = async () => {
    const recentLeads = await db.leads.allList(100);
    setLeads(recentLeads);
  };

  const checkSmtp = async () => {
    setLoadingSmtp(true);
    try {
      const result = await api.get<SMTPStatus>('/health/smtp');
      setSmtpStatus(result);
    } catch (e) {
      setSmtpStatus({
        ok: false,
        message: e instanceof Error ? e.message : 'Could not verify SMTP connection'
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
    await loadLeads();
  };

  const handleEmailList = async () => {
    setEmailing(true);
    setNotice('');
    try {
      const result = await api.post<{ count: number }>('/leads/email-admin-list', {});
      setNotice(`Lead list emailed to admin (${result.count} leads).`);
    } catch {
      setNotice('Could not email lead list. Check server SMTP settings.');
    } finally {
      setEmailing(false);
    }
  };

  const iconForStatus = (status: string | undefined) => {
    if (status === 'sent' || status === 'synced') return '✓';
    if (status === 'syncing' || status === 'pending') return '…';
    if (status === 'disabled') return '-';
    return '!';
  };

  return (
    <section className='screen'>
      <div className='screen-head'>
        <h2>Sync Queue</h2>
      </div>

      {!loadingSmtp && smtpStatus && (
        <div className={`status-message ${smtpStatus.ok ? 'success' : 'error'}`}>
          {smtpStatus.ok ? '✓' : '⚠'} {smtpStatus.message}
        </div>
      )}

      {leads.length > 0 ? (
        <>
          <div className='lead-queue-list'>
            {leads.map((lead) => (
              <div key={lead.uuid} className='queue-item compact'>
                <div className='queue-item-header'>
                  <strong>{lead.firstName} {lead.lastName}</strong>
                  <div className='status-icons' role='list' aria-label='Lead sync status'>
                    <span className={`status-icon ${lead.emailSentStatus || 'pending'}`} title='Admin Email' aria-label='Admin Email status'>
                      ✉ {iconForStatus(lead.emailSentStatus)}
                    </span>
                    <span className={`status-icon ${lead.syncStatus || 'pending'}`} title='Database Sync' aria-label='Database sync status'>
                      ⛁ {iconForStatus(lead.syncStatus)}
                    </span>
                    <span className={`status-icon ${lead.brevoSyncStatus || 'pending'}`} title='Brevo Sync' aria-label='Brevo sync status'>
                      B {iconForStatus(lead.brevoSyncStatus)}
                    </span>
                  </div>
                </div>
                <p className='queue-item-meta'>{lead.email || 'No email'}</p>
              </div>
            ))}
          </div>

          <div className='status-legend'>
            <div className='legend-title'>Status Legend</div>
            <div className='legend-row'>
              <span className='legend-icon success'>✓</span>
              <span className='legend-text'>Synced / Sent</span>
            </div>
            <div className='legend-row'>
              <span className='legend-icon pending'>…</span>
              <span className='legend-text'>Pending</span>
            </div>
            <div className='legend-row'>
              <span className='legend-icon failed'>!</span>
              <span className='legend-text'>Failed</span>
            </div>
            <div className='legend-row'>
              <span className='legend-icon disabled'>-</span>
              <span className='legend-text'>Disabled</span>
            </div>
          </div>

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
        </>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>✓ All synced</p>
          <p style={{ fontSize: '0.95rem' }}>New leads will appear here</p>
        </div>
      )}
    </section>
  );
}

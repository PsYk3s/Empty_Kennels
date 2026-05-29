import { useEffect, useState } from 'react';
import { api } from '../api/index';
import { db } from '../storage/db';
import { getDeviceId } from '../sync/syncManager';
import { useSyncHealth } from '../hooks/useSyncHealth';
import { formatTs, type Lead, type LeadStatus } from '../types/lead';

const EVENT_NAME_KEY = 'pb_event_name';

type IssueSystem = 'email' | 'database' | 'brevo';

type IssueLogRow = {
  id: string;
  leadUuid: string;
  leadName: string;
  system: IssueSystem;
  status: LeadStatus;
  message: string;
  createdAt: string;
};

function issueLabel(system: IssueSystem) {
  if (system === 'database') return 'Database';
  if (system === 'email') return 'Email';
  return 'Brevo';
}

function defaultIssueMessage(system: IssueSystem, status: LeadStatus) {
  if (system === 'database') {
    return status === 'failed'
      ? 'Database sync failed on the API; lead remains queued for retry.'
      : 'Database sync is not complete yet.';
  }

  if (system === 'email') {
    return status === 'failed'
      ? 'SMTP email delivery failed for this lead.'
      : 'Lead email has not been sent yet.';
  }

  if (status === 'disabled') {
    return 'Brevo integration is disabled in server configuration.';
  }

  return status === 'failed'
    ? 'Brevo contact sync failed; verify API key and list settings.'
    : 'Brevo sync is not complete yet.';
}

function leadIssueRows(lead: Lead): IssueLogRow[] {
  const rows: IssueLogRow[] = [];
  const leadName = `${lead.firstName} ${lead.lastName}`.trim() || lead.email;
  const stamp = lead.updatedAt || lead.createdAt;

  const systems: Array<{
    system: IssueSystem;
    status: LeadStatus;
    message: string | undefined;
  }> = [
    { system: 'database', status: lead.syncStatus, message: lead.databaseStatusMessage },
    { system: 'email', status: lead.emailSentStatus, message: lead.emailStatusMessage },
    { system: 'brevo', status: lead.brevoSyncStatus, message: lead.brevoStatusMessage },
  ];

  for (const item of systems) {
    if (item.status !== 'failed' && item.status !== 'disabled') continue;
    rows.push({
      id: `${lead.uuid}:${item.system}:${item.status}`,
      leadUuid: lead.uuid,
      leadName,
      system: item.system,
      status: item.status,
      message: item.message || defaultIssueMessage(item.system, item.status),
      createdAt: stamp,
    });
  }

  return rows;
}

export function SettingsPage() {
  const { health, smtpStatus, loadingSmtp } = useSyncHealth();

  const [eventName, setEventName] = useState('Main Event');
  const [savingEvent, setSavingEvent] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState('');
  const [expandedHealth, setExpandedHealth] = useState(false);
  const [issueLog, setIssueLog] = useState<IssueLogRow[]>([]);
  const [issueFilter, setIssueFilter] = useState<'all' | 'failed' | 'disabled'>('all');

  useEffect(() => {
    const saved = localStorage.getItem(EVENT_NAME_KEY);
    if (saved && saved.trim()) setEventName(saved);
  }, []);

  const filteredIssueLog = issueLog.filter((item) => {
    if (issueFilter === 'all') return true;
    return item.status === issueFilter;
  });

  useEffect(() => {
    const loadIssues = async () => {
      const rows = (await db.leads.allList(300)) as Lead[];
      const next = rows
        .flatMap(leadIssueRows)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setIssueLog(next);
    };

    void loadIssues();

    const onCycle = () => {
      void loadIssues();
    };

    window.addEventListener('pb-sync-cycle', onCycle);
    return () => window.removeEventListener('pb-sync-cycle', onCycle);
  }, []);

  const saveEventName = () => {
    setSavingEvent(true);
    localStorage.setItem(EVENT_NAME_KEY, eventName.trim() || 'Main Event');
    setNotice('Event name saved.');
    window.setTimeout(() => setSavingEvent(false), 200);
  };

  const handleEmailList = async () => {
    setEmailing(true);
    setNotice('');
    try {
      const result = await api.post<{ ok?: boolean; count?: number; message?: string }>(
        '/leads/email-admin-list',
        { eventName: eventName.trim() || 'Main Event' },
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

  const clearLeadList = async () => {
    const confirmed = window.confirm('Clear all locally stored leads? This cannot be undone.');
    if (!confirmed) return;

    setClearing(true);
    await db.leads.clear();
    window.dispatchEvent(new CustomEvent('pb-sync-cycle', { detail: { changed: true } }));
    setNotice('Local lead list cleared.');
    setClearing(false);
  };

  return (
    <section className='screen'>
      <div className='screen-head'>
        <h2>Settings</h2>
        <p>Manage event details, exports, and diagnostics.</p>
      </div>

      <div className='settings-stack'>
        <label>
          Event Name
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder='Main Event'
          />
        </label>

        <div className='actions-row settings-actions'>
          <button type='button' className='secondary-button' onClick={saveEventName} disabled={savingEvent}>
            {savingEvent ? 'Saving…' : 'Save Event Name'}
          </button>
          <button type='button' className='secondary-button' onClick={handleEmailList} disabled={emailing}>
            {emailing ? 'Emailing…' : 'Export / Email Lead List'}
          </button>
          <button type='button' className='danger-button' onClick={clearLeadList} disabled={clearing}>
            {clearing ? 'Clearing…' : 'Clear Local Leads'}
          </button>
        </div>

        {!loadingSmtp && smtpStatus && !smtpStatus.ok ? (
          <div className='status-message error'>{smtpStatus.message}</div>
        ) : null}

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

        <section className='error-log-block'>
          <h3>Sync Error Log</h3>
          <p className='error-log-sub'>Failed and disabled sync outcomes are recorded here.</p>

          <div className='error-log-filters' role='group' aria-label='Filter sync errors'>
            <button
              type='button'
              className={`error-log-filter${issueFilter === 'all' ? ' active' : ''}`}
              onClick={() => setIssueFilter('all')}
            >
              All ({issueLog.length})
            </button>
            <button
              type='button'
              className={`error-log-filter${issueFilter === 'failed' ? ' active' : ''}`}
              onClick={() => setIssueFilter('failed')}
            >
              Failed ({issueLog.filter((item) => item.status === 'failed').length})
            </button>
            <button
              type='button'
              className={`error-log-filter${issueFilter === 'disabled' ? ' active' : ''}`}
              onClick={() => setIssueFilter('disabled')}
            >
              Disabled ({issueLog.filter((item) => item.status === 'disabled').length})
            </button>
          </div>

          {filteredIssueLog.length ? (
            <div className='error-log-list'>
              {filteredIssueLog.map((item) => (
                <article key={item.id} className='error-log-item'>
                  <div className='error-log-head'>
                    <span className='error-log-lead'>{item.leadName}</span>
                    <span className={`error-log-status ${item.status}`}>{item.status}</span>
                  </div>
                  <p className='error-log-meta'>
                    <strong>{issueLabel(item.system)}</strong> · {formatTs(item.createdAt)}
                  </p>
                  <p className='error-log-message'>{item.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className='error-log-empty'>No {issueFilter === 'all' ? '' : issueFilter + ' '}sync errors logged.</p>
          )}
        </section>
      </div>

      {notice ? <p className='feedback'>{notice}</p> : null}
    </section>
  );
}

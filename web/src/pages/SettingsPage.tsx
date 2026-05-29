import { useEffect, useState } from 'react';
import { api } from '../api/index';
import { db } from '../storage/db';
import { applyLocalClearMarker, getDeviceId, syncNow } from '../sync/syncManager';
import { useSyncHealth } from '../hooks/useSyncHealth';
import { formatTs, type Lead, type LeadStatus } from '../types/lead';

const EVENT_NAME_KEY = 'pb_event_name';
const EVENT_NAME_CHANGED_EVENT = 'pb-event-name-changed';
const EVENT_NAME_SYNC_MS = 30000;

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

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function buildLocalLeadCsv(leads: Lead[]) {
  const headers = [
    'UUID',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Company',
    'Interest Area',
    'Notes',
    'Created At',
    'Updated At',
    'Last Synced At',
    'Database Status',
    'Email Status',
    'Brevo Status'
  ];

  const rows = leads.map((lead) => [
    lead.uuid,
    lead.firstName,
    lead.lastName,
    lead.email,
    lead.phone,
    lead.company,
    lead.interestArea,
    lead.notes,
    lead.createdAt,
    lead.updatedAt || '',
    lead.lastSyncedAt || '',
    lead.syncStatus,
    lead.emailSentStatus,
    lead.brevoSyncStatus
  ]);

  const body = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\r\n');

  // Excel hint + UTF-8 BOM to open columns/cells reliably across locales.
  return `\ufeffsep=,\r\n${body}`;
}

function downloadCsvBackup(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

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

    const syncFromServer = async () => {
      try {
        const response = await api.get<{ name?: string }>('/settings/event-name');
        const remote = String(response?.name || '').trim();
        if (!remote) return;
        setEventName(remote);
        localStorage.setItem(EVENT_NAME_KEY, remote);
        window.dispatchEvent(new CustomEvent(EVENT_NAME_CHANGED_EVENT, { detail: { name: remote } }));
      } catch {
        // One-way best-effort sync only.
      }
    };

    void syncFromServer();
    const timer = window.setInterval(() => {
      void syncFromServer();
    }, EVENT_NAME_SYNC_MS);

    return () => window.clearInterval(timer);
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
    const nextName = eventName.trim() || 'Main Event';
    localStorage.setItem(EVENT_NAME_KEY, nextName);
    window.dispatchEvent(new CustomEvent(EVENT_NAME_CHANGED_EVENT, { detail: { name: nextName } }));

    // Best-effort push; app should continue even if this fails.
    void api.post('/settings/event-name', { name: nextName }).catch(() => undefined);

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
    const pin = window.prompt('Enter PIN to clear all leads across devices:');
    if (pin === null) return;
    if (pin.trim() !== '1050') {
      setNotice('Incorrect PIN. Leads were not deleted.');
      return;
    }

    const confirmed = window.confirm(
      'Create a local CSV backup, email that backup, then clear all leads across devices. Leads are only deleted after the backup email succeeds.'
    );
    if (!confirmed) return;

    setClearing(true);
    setNotice('Preparing backup...');

    try {
      // Best-effort final sync attempt before snapshotting local backup.
      await syncNow({ retryDisabledBrevo: true }).catch(() => false);

      const localLeads = (await db.leads.allList(5000)) as Lead[];
      if (localLeads.length) {
        const csv = buildLocalLeadCsv(localLeads);
        const fileStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const fileName = `local-lead-backup-${fileStamp}.csv`;

        // Save local backup before any delete attempt.
        downloadCsvBackup(csv, fileName);

        // Email the same CSV backup and only clear when email succeeds.
        await api.post<{ ok?: boolean }>('/leads/email-local-backup', {
          csv,
          fileName,
          count: localLeads.length,
          eventName: eventName.trim() || 'Main Event',
          deviceId: getDeviceId()
        });
      }

      const clearResult = await api.post<{ ok?: boolean; clearedAt?: string }>('/leads/clear-all', {
        pin: '1050'
      });

      await db.leads.clear();
      applyLocalClearMarker(clearResult.clearedAt || null);
      window.dispatchEvent(new CustomEvent('pb-sync-cycle', { detail: { changed: true } }));
      setNotice(
        localLeads.length
          ? `Backed up and emailed ${localLeads.length} leads, then cleared leads across all devices.`
          : 'Cleared leads across all devices. There were no local leads to back up on this device.'
      );
    } catch (e) {
      setNotice(`Local leads were not deleted: ${e instanceof Error ? e.message : 'Email backup failed.'}`);
    } finally {
      setClearing(false);
    }
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
            {clearing ? 'Clearing…' : 'Backup and Clear All Leads'}
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

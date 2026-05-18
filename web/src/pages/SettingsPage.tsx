import { useEffect, useState } from 'react';
import { api } from '../api/index';
import { db } from '../storage/db';
import { getDeviceId } from '../sync/syncManager';
import { useSyncHealth } from '../hooks/useSyncHealth';

const EVENT_NAME_KEY = 'pb_event_name';

export function SettingsPage() {
  const { health, smtpStatus, loadingSmtp } = useSyncHealth();

  const [eventName, setEventName] = useState('Main Event');
  const [savingEvent, setSavingEvent] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState('');
  const [expandedHealth, setExpandedHealth] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(EVENT_NAME_KEY);
    if (saved && saved.trim()) setEventName(saved);
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
      </div>

      {notice ? <p className='feedback'>{notice}</p> : null}
    </section>
  );
}

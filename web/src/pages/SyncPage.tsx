import { useEffect, useState } from 'react';
import { db } from '../storage/db';
import { syncNow } from '../sync/syncManager';

export function SyncPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    const unsyncedLeads = await db.leads.pendingList(100);
    setLeads(unsyncedLeads);
  };

  const handleSync = async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
    await loadLeads();
  };

  return (
    <section className='screen'>
      <div className='screen-head'>
        <h2>Sync Queue</h2>
      </div>

      {leads.length > 0 ? (
        <>
          <div className='lead-queue-list'>
            {leads.map((lead) => (
              <div key={lead.uuid} className='queue-item'>
                <div className='queue-item-header'>
                  <strong>{lead.firstName} {lead.lastName}</strong>
                  <span className={`sync-badge ${lead.syncStatus}`}>
                    {lead.syncStatus === 'syncing' ? '↻' : lead.syncStatus === 'pending' ? '⋯' : '✓'}
                  </span>
                </div>
                <p className='queue-item-meta'>{lead.email || 'No email'}</p>
              </div>
            ))}
          </div>

          <div className='actions-row'>
            <button
              type='button'
              className='primary-button'
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
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

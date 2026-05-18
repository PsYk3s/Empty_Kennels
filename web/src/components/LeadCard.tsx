import type { Lead, LeadStatus } from '../types/lead';
import { statusVariant, statusReason, formatTs } from '../types/lead';
import { StatusChip } from './StatusChip';

type Props = {
  lead: Lead;
  expanded: boolean;
  onToggle: () => void;
};

export function LeadCard({ lead, expanded, onToggle }: Props) {
  return (
    <article className={`queue-item${expanded ? ' open' : ''}`}>
      <button
        type='button'
        className='queue-item-toggle'
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`lead-${lead.uuid}`}
      >
        <div className='queue-item-header'>
          <div className='queue-item-identity'>
            <span className='queue-item-name'>{lead.firstName} {lead.lastName}</span>
            <span className='queue-item-sub'>{lead.email || 'No email'}{lead.company ? ` · ${lead.company}` : ''}</span>
          </div>
          <div className='queue-item-right'>
            <div className='status-icons' role='list' aria-label='Sync status'>
              <StatusChip letter='E' status={lead.emailSentStatus} label='Email' />
              <StatusChip letter='D' status={lead.syncStatus} label='Database' />
              <StatusChip letter='B' status={lead.brevoSyncStatus} label='Brevo' />
            </div>
            <span className={`queue-chevron${expanded ? ' open' : ''}`} aria-hidden='true' />
          </div>
        </div>
      </button>

      <div id={`lead-${lead.uuid}`} className='queue-item-details' aria-hidden={!expanded}>
        <div className='queue-status-lines'>
          <StatusRow label='Email' status={lead.emailSentStatus} reason={statusReason('email', lead.emailSentStatus, lead.emailStatusMessage)} />
          <StatusRow label='Database' status={lead.syncStatus} reason={statusReason('database', lead.syncStatus, lead.databaseStatusMessage)} />
          <StatusRow label='Brevo' status={lead.brevoSyncStatus} reason={statusReason('brevo', lead.brevoSyncStatus, lead.brevoStatusMessage)} />
        </div>

        <div className='queue-detail-stack'>
          {lead.phone ? <p><strong>Phone</strong>{lead.phone}</p> : null}
          {lead.company ? <p><strong>Company</strong>{lead.company}</p> : null}
          {lead.interestArea ? <p><strong>Interest</strong>{lead.interestArea}</p> : null}
          <p><strong>Created</strong>{formatTs(lead.createdAt)}</p>
          <p><strong>Last Synced</strong>{formatTs(lead.lastSyncedAt)}</p>
        </div>

        {lead.notes ? <p className='queue-item-notes'>{lead.notes}</p> : null}
      </div>
    </article>
  );
}

function StatusRow({
  label,
  status,
  reason,
}: {
  label: string;
  status: LeadStatus | undefined;
  reason: string;
}) {
  const variant = statusVariant(status);
  return (
    <div className='queue-status-item'>
      <div className='queue-status-header'>
        <span className='queue-status-label'>{label}</span>
        <span className={`queue-status-value status-text-${variant}`}>{status ?? 'pending'}</span>
      </div>
      <p className='queue-status-reason'>{reason}</p>
    </div>
  );
}

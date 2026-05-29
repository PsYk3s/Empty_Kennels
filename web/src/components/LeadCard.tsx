import type { Lead } from '../types/lead';
import { statusVariant, formatTs, maskEmail } from '../types/lead';
import { StatusChip } from './StatusChip';

type Props = {
  lead: Lead;
  expanded: boolean;
  onToggle: () => void;
};

export function LeadCard({ lead, expanded, onToggle }: Props) {
  const systems = [
    { type: 'email' as const, label: 'Email', status: lead.emailSentStatus, message: lead.emailStatusMessage },
    { type: 'database' as const, label: 'Database', status: lead.syncStatus, message: lead.databaseStatusMessage },
    { type: 'brevo' as const, label: 'Brevo', status: lead.brevoSyncStatus, message: lead.brevoStatusMessage },
  ];

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
            <span className='queue-item-name'>
              {lead.firstName} {lead.lastName}
              <span className='queue-item-company'>
                {lead.company?.trim() || 'Private'}
              </span>
            </span>
            <span className='queue-item-sub'>{maskEmail(lead.email)}</span>
          </div>
          <div className='queue-item-right'>
            <span className={`queue-chevron${expanded ? ' open' : ''}`} aria-hidden='true' />
          </div>
        </div>
      </button>

      <div id={`lead-${lead.uuid}`} className='queue-item-details' aria-hidden={!expanded}>
        <div className='status-icons status-icons-inline' role='list' aria-label='Lead sync status'>
          {systems.map(({ label, type, status }) => (
            <StatusChip
              key={type}
              letter={label[0]}
              status={status}
              label={label}
            />
          ))}
        </div>

        <div className='lead-detail-list'>
          {lead.phone ? (
            <p>
              <span className='lead-detail-label'>Phone</span>
              <a href={`tel:${lead.phone}`} className='lead-detail-link'>{lead.phone}</a>
            </p>
          ) : null}

          {lead.company ? (
            <p>
              <span className='lead-detail-label'>Company</span>
              <span>{lead.company}</span>
            </p>
          ) : null}

          {lead.interestArea ? (
            <p>
              <span className='lead-detail-label'>Interests</span>
              <span>{lead.interestArea}</span>
            </p>
          ) : null}

          {lead.notes ? (
            <p>
              <span className='lead-detail-label'>Notes</span>
              <span className='lead-detail-notes'>{lead.notes}</span>
            </p>
          ) : null}
        </div>

        <p className='queue-item-timestamp'>
          <span className='lead-detail-label'>Captured</span>
          <span>{formatTs(lead.createdAt)}</span>
        </p>
      </div>
    </article>
  );
}

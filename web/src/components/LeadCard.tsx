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

        <div className='lead-contact-block'>
          {lead.phone ? (
            <a href={`tel:${lead.phone}`} className='contact-link'>{lead.phone}</a>
          ) : null}
          {lead.company ? <span className='contact-meta'>{lead.company}</span> : null}
          {lead.interestArea ? <span className='contact-meta'>{lead.interestArea}</span> : null}
        </div>

        {lead.notes ? <p className='queue-item-notes'>{lead.notes}</p> : null}

        <p className='queue-item-timestamp'>{formatTs(lead.createdAt)}</p>
      </div>
    </article>
  );
}

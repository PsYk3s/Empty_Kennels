import type { Lead, LeadStatus } from '../types/lead';
import { statusVariant, statusReason, formatTs, maskEmail } from '../types/lead';
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

  const issues = systems.filter(({ status }) => statusVariant(status) !== 'success');

  const hasIssues = issues.length > 0;

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
            <span className='queue-item-sub'>{maskEmail(lead.email)}</span>
          </div>
          <div className='queue-item-right'>
            <div className='status-icons' role='list' aria-label='Lead sync status'>
              {systems.map(({ label, type, status }) => (
                <StatusChip
                  key={type}
                  letter={label[0]}
                  status={status}
                  label={label}
                />
              ))}
            </div>
            <span className={`queue-chevron${expanded ? ' open' : ''}`} aria-hidden='true' />
          </div>
        </div>
      </button>

      <div id={`lead-${lead.uuid}`} className='queue-item-details' aria-hidden={!expanded}>
        <div className='lead-contact-block'>
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className='contact-link'>{lead.email}</a>
          ) : null}
          {lead.phone ? (
            <a href={`tel:${lead.phone}`} className='contact-link'>{lead.phone}</a>
          ) : null}
          {lead.company ? <span className='contact-meta'>{lead.company}</span> : null}
          {lead.interestArea ? <span className='contact-meta'>{lead.interestArea}</span> : null}
        </div>

        {lead.notes ? <p className='queue-item-notes'>{lead.notes}</p> : null}

        {hasIssues ? (
          <div className='queue-status-lines'>
            {issues.map(({ type, label, status, message }) => (
              <StatusRow
                key={type}
                label={label}
                status={status}
                reason={statusReason(type, status, message)}
              />
            ))}
          </div>
        ) : null}

        <p className='queue-item-timestamp'>{formatTs(lead.createdAt)}</p>
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

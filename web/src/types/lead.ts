export type LeadStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'sent'
  | 'failed'
  | 'disabled';

export type Lead = {
  uuid: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  interestArea: string;
  notes: string;
  eventId: number;
  selectedSuppliers: number[];
  createdAt: string;
  updatedAt?: string;
  lastSyncedAt?: string;
  syncStatus: LeadStatus;
  emailSentStatus: LeadStatus;
  brevoSyncStatus: LeadStatus;
  emailStatusMessage?: string;
  brevoStatusMessage?: string;
  databaseStatusMessage?: string;
};

export type StatusVariant = 'success' | 'pending' | 'syncing' | 'failed' | 'disabled';

export function statusVariant(status: LeadStatus | undefined): StatusVariant {
  if (status === 'sent' || status === 'synced') return 'success';
  if (status === 'syncing') return 'syncing';
  if (status === 'pending') return 'pending';
  if (status === 'disabled') return 'disabled';
  return 'failed';
}

export function statusReason(
  type: 'email' | 'database' | 'brevo',
  status: LeadStatus | undefined,
  explicit?: string,
): string {
  if (explicit) return explicit;
  if (status === 'sent' || status === 'synced') {
    if (type === 'email') return 'Email delivered successfully.';
    if (type === 'database') return 'Lead saved to central database.';
    return 'Contact synced to Brevo list.';
  }
  if (status === 'syncing') return 'Sync currently in progress.';
  if (status === 'pending') return 'Queued for next sync attempt.';
  if (status === 'disabled') return 'Integration disabled in server configuration.';
  return 'Failed. Check server credentials and try Sync Now.';
}

export function formatTs(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function maskEmail(value: string | undefined): string {
  if (!value) return 'No email';

  const [localPart, domain] = value.split('@');
  if (!localPart || !domain) return value;

  const first = localPart.slice(0, 1) || '*';
  const masked = '*'.repeat(Math.max(localPart.length - 1, 4));
  return `${first}${masked}@${domain}`;
}

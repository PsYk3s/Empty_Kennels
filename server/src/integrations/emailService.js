import { APP_CONFIG } from '../config.js';

const ADMIN_EMAIL = APP_CONFIG.adminEmail;
const SENDER_EMAIL = APP_CONFIG.smtp.from || ADMIN_EMAIL;

export function smtpErrorMessage(error) {
  const text = error instanceof Error ? error.message : String(error || 'Email request failed');
  if (/401|403|api[- ]?key|unauthor/i.test(text)) {
    return 'Brevo authentication failed. Check that BREVO_API_KEY is a valid API v3 key with transactional email permissions.';
  }
  if (/sender|from.*not.*valid|not.*verified/i.test(text)) {
    return `Brevo rejected the sender address. Verify ${SENDER_EMAIL} as a sender/domain in Brevo (Senders, Domains & Dedicated IPs).`;
  }
  return `Email error: ${text}`;
}

async function sendBrevoEmail({ subject, text, attachments }) {
  const apiKey = String(APP_CONFIG.brevo.apiKey || '').trim();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured; cannot send email.');
  }

  const payload = {
    sender: { email: SENDER_EMAIL },
    to: [{ email: ADMIN_EMAIL }],
    subject,
    textContent: text
  };

  if (attachments && attachments.length) {
    payload.attachment = attachments.map((a) => ({
      name: a.filename,
      content: Buffer.from(String(a.content), 'utf8').toString('base64')
    }));
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Brevo email request failed');
    throw new Error(details || `HTTP ${response.status}`);
  }
}

export async function sendLeadEmail({ lead, eventName }) {
  await sendBrevoEmail({
    subject: `New Lead: ${lead.first_name} ${lead.last_name}`,
    text: `Event: ${eventName}\nName: ${lead.first_name} ${lead.last_name}\nEmail: ${lead.email}\nPhone: ${lead.phone || ''}\nCompany: ${lead.company || ''}\nInterest: ${lead.interest_area || ''}\nNotes: ${lead.notes || ''}`
  });
}

export async function sendFullLeadListEmail({ leads }) {
  const csvEscape = (value) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Company',
    'Interest Area',
    'Created At'
  ];

  const csvRows = leads.map((lead) => [
    lead.first_name || '',
    lead.last_name || '',
    lead.email || '',
    lead.phone || '',
    lead.company || '',
    lead.interest_area || '',
    lead.created_at ? new Date(lead.created_at).toISOString() : ''
  ]);

  const csv = [headers, ...csvRows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  const body = `Lead Export (${new Date().toISOString()})\n\nTotal Leads: ${leads.length}\nAttached: lead-export.csv`;

  await sendBrevoEmail({
    subject: `Lead List Export (${leads.length})`,
    text: body,
    attachments: [
      {
        filename: `lead-export-${new Date().toISOString().slice(0, 10)}.csv`,
        content: csv
      }
    ]
  });
}

export async function sendCsvBackupEmail({ csv, fileName, count, eventName, deviceId }) {
  const safeName = String(fileName || `lead-backup-${new Date().toISOString().slice(0, 10)}.csv`)
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  const bodyLines = [
    `Local Lead Backup (${new Date().toISOString()})`,
    '',
    `Leads: ${Number.isFinite(count) ? count : 'Unknown'}`,
    `Event: ${eventName || 'Main Event'}`,
    `Device: ${deviceId || 'Unknown'}`,
    '',
    'Attached: local lead backup CSV'
  ];

  await sendBrevoEmail({
    subject: `Local Lead Backup (${Number.isFinite(count) ? count : 'Unknown'})`,
    text: bodyLines.join('\n'),
    attachments: [
      {
        filename: safeName,
        content: csv
      }
    ]
  });
}

export async function verifySmtpConnection() {
  const apiKey = String(APP_CONFIG.brevo.apiKey || '').trim();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured.');
  }

  const response = await fetch('https://api.brevo.com/v3/account', {
    headers: { accept: 'application/json', 'api-key': apiKey }
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Brevo account check failed');
    throw new Error(details || `HTTP ${response.status}`);
  }
}


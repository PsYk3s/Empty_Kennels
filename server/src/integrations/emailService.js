import nodemailer from 'nodemailer';
import { APP_CONFIG } from '../config.js';

const ADMIN_EMAIL = APP_CONFIG.adminEmail;

const transporter = nodemailer.createTransport({
  host: APP_CONFIG.smtp.host,
  port: APP_CONFIG.smtp.port,
  secure: APP_CONFIG.smtp.secure,
  auth: APP_CONFIG.smtp.user ? { user: APP_CONFIG.smtp.user, pass: APP_CONFIG.smtp.pass } : undefined
});

export async function sendLeadEmail({ lead, eventName }) {
  await transporter.sendMail({
    from: APP_CONFIG.smtp.from || APP_CONFIG.smtp.user || ADMIN_EMAIL,
    to: ADMIN_EMAIL,
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

  await transporter.sendMail({
    from: APP_CONFIG.smtp.from || APP_CONFIG.smtp.user || ADMIN_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Lead List Export (${leads.length})`,
    text: body,
    attachments: [
      {
        filename: `lead-export-${new Date().toISOString().slice(0, 10)}.csv`,
        content: csv,
        contentType: 'text/csv; charset=utf-8'
      }
    ]
  });
}

export async function verifySmtpConnection() {
  await transporter.verify();
}

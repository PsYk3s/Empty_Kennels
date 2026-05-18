import nodemailer from 'nodemailer';
import { APP_CONFIG } from '../config.js';

const ADMIN_EMAIL = APP_CONFIG.adminEmail;

const transporter = nodemailer.createTransport({
  host: APP_CONFIG.smtp.host,
  port: APP_CONFIG.smtp.port,
  secure: APP_CONFIG.smtp.secure,
  auth: APP_CONFIG.smtp.user ? { user: APP_CONFIG.smtp.user, pass: APP_CONFIG.smtp.pass } : undefined
});

function uniqueEmails(values = []) {
  return [...new Set(values.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))];
}

export async function sendLeadEmail({ lead, suppliers, eventName }) {
  const cc = uniqueEmails(suppliers.map((s) => s.supplier_email)).filter((email) => email !== ADMIN_EMAIL);
  await transporter.sendMail({
    from: APP_CONFIG.smtp.from || APP_CONFIG.smtp.user || ADMIN_EMAIL,
    to: ADMIN_EMAIL,
    cc,
    subject: `New Lead: ${lead.first_name} ${lead.last_name}`,
    text: `Event: ${eventName}\nName: ${lead.first_name} ${lead.last_name}\nEmail: ${lead.email}\nPhone: ${lead.phone || ''}\nCompany: ${lead.company || ''}\nInterest: ${lead.interest_area || ''}\nNotes: ${lead.notes || ''}`
  });
}

export async function sendFullLeadListEmail({ leads }) {
  const rows = leads
    .map((lead) => {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
      return `${name || 'Unknown'} | ${lead.email || ''} | ${lead.phone || ''} | ${lead.company || ''} | ${lead.interest_area || ''}`;
    })
    .join('\n');

  const body = `Lead Export (${new Date().toISOString()})\n\nTotal Leads: ${leads.length}\n\n${rows || 'No leads found.'}`;

  await transporter.sendMail({
    from: APP_CONFIG.smtp.from || APP_CONFIG.smtp.user || ADMIN_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Lead List Export (${leads.length})`,
    text: body
  });
}

export async function verifySmtpConnection() {
  await transporter.verify();
}

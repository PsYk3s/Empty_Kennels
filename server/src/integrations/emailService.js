import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
});
export async function sendLeadEmail({ lead, suppliers, eventName }) {
  const cc = suppliers.map((s) => s.supplier_email).filter(Boolean);
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.ADMIN_NOTIFICATION_EMAIL || 'warrenb@pienaarbros.co.za',
    cc,
    subject: `New Lead: ${lead.first_name} ${lead.last_name}`,
    text: `Event: ${eventName}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nInterest: ${lead.interest_area}`
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
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ADMIN_NOTIFICATION_EMAIL || 'warrenb@pienaarbros.co.za',
    subject: `Lead List Export (${leads.length})`,
    text: body
  });
}

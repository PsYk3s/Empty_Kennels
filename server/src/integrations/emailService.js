import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 1025),
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

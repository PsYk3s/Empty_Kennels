import 'dotenv/config';

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

export const APP_CONFIG = {
  port: Number(process.env.PORT || 4000),
  corsOrigins: (process.env.CORS_ORIGIN || '*').split(',').map((v) => v.trim()).filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || '',
  adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'warrenb@pienaarbros.co.za',
  smtp: {
    from: process.env.SMTP_FROM || process.env.ADMIN_NOTIFICATION_EMAIL || 'warrenb@pienaarbros.co.za'
  },
  brevo: {
    enabled: parseBoolean(process.env.BREVO_ENABLED, false),
    apiKey: String(process.env.BREVO_API_KEY || process.env.BREVO_KEY || '').trim(),
    listId: Number(process.env.BREVO_LIST_ID || 26)
  }
};

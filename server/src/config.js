export const APP_CONFIG = {
  port: 4000,
  corsOrigins: ['*'],
  databaseUrl: process.env.DATABASE_URL || '',
  adminEmail: 'warrenb@pienaarbros.co.za',
  smtp: {
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    user: 'warrenb@pienaarbros.co.za',
    pass: '',
    from: 'warrenb@pienaarbros.co.za'
  },
  brevo: {
    enabled: false,
    apiKey: '',
    listId: 26
  }
};

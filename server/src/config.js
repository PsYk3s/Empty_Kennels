export const APP_CONFIG = {
  port: 4000,
  corsOrigins: ['*'],
  databaseUrl: 'postgresql://postgres:postgres@localhost:5432/pb_app',
  adminEmail: 'warrenb@pienaarbros.co.za',
  smtp: {
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    user: 'warrenb@pienaarbros.co.za',
    pass: 'SrR5zKz6VqNZ2pJ',
    from: 'warrenb@pienaarbros.co.za'
  },
  brevo: {
    enabled: false,
    apiKey: '',
    listId: 26
  }
};

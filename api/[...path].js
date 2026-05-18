const { Pool } = require('pg');
const nodemailer = require('nodemailer');

try {
  require('dotenv').config({ path: '.env' });
} catch {
  // In some runtimes dotenv may be unavailable; Vercel env vars still work.
}

const CONFIG = {
  databaseUrl: process.env.DATABASE_URL || '',
  adminEmail: 'warrenb@pienaarbros.co.za',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    user: process.env.SMTP_LOGIN || '',
    pass: process.env.SMTP_KEY || '',
    from: process.env.SMTP_FROM || 'warrenb@pienaarbros.co.za'
  }
};

const pool = new Pool({ connectionString: CONFIG.databaseUrl });
let schemaReadyPromise = null;

const transporter = nodemailer.createTransport({
  host: CONFIG.smtp.host,
  port: CONFIG.smtp.port,
  secure: CONFIG.smtp.secure,
  auth: CONFIG.smtp.user ? { user: CONFIG.smtp.user, pass: CONFIG.smtp.pass } : undefined
});

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function uniqueEmails(values) {
  return [...new Set((values || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))];
}

function smtpErrorMessage(error) {
  const text = error instanceof Error ? error.message : String(error || 'SMTP request failed');
  if (/auth|login|535|invalid/i.test(text)) {
    return 'SMTP authentication failed. Check SMTP_LOGIN and SMTP_KEY in your environment variables.';
  }
  return `SMTP error: ${text}`;
}

async function sendLeadEmail({ lead, suppliers, eventName }) {
  const cc = uniqueEmails((suppliers || []).map((s) => s.supplier_email)).filter((email) => email !== CONFIG.adminEmail);
  await transporter.sendMail({
    from: CONFIG.smtp.from || CONFIG.smtp.user || CONFIG.adminEmail,
    to: CONFIG.adminEmail,
    cc,
    subject: `New Lead: ${lead.first_name} ${lead.last_name}`,
    text: `Event: ${eventName}\nName: ${lead.first_name} ${lead.last_name}\nEmail: ${lead.email}\nPhone: ${lead.phone || ''}\nCompany: ${lead.company || ''}\nInterest: ${lead.interest_area || ''}\nNotes: ${lead.notes || ''}`
  });
}

async function sendFullLeadListEmail(leads) {
  const rows = leads
    .map((lead) => {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
      return `${name || 'Unknown'} | ${lead.email || ''} | ${lead.phone || ''} | ${lead.company || ''} | ${lead.interest_area || ''}`;
    })
    .join('\n');

  const body = `Lead Export (${new Date().toISOString()})\n\nTotal Leads: ${leads.length}\n\n${rows || 'No leads found.'}`;
  await transporter.sendMail({
    from: CONFIG.smtp.from || CONFIG.smtp.user || CONFIG.adminEmail,
    to: CONFIG.adminEmail,
    subject: `Lead List Export (${leads.length})`,
    text: body
  });
}

function mapRowToLead(row) {
  return {
    uuid: row.uuid,
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company || '',
    email: row.email,
    phone: row.phone || '',
    interestArea: row.interest_area || '',
    notes: row.notes || '',
    eventId: row.event_id,
    selectedSuppliers: [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at || row.created_at).toISOString(),
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
    syncStatus: row.sync_status || 'synced',
    emailSentStatus: row.email_sent_status || 'pending',
    brevoSyncStatus: row.brevo_sync_status || 'disabled'
  };
}

function isVercelHost(req) {
  const host = String((req && req.headers && req.headers.host) || '').toLowerCase();
  return host.includes('vercel.app') || host.includes('.now.sh');
}

function dbConfigErrorForRequest(req) {
  if (!CONFIG.databaseUrl) {
    return 'DATABASE_URL is not configured. Add it in Vercel Project Settings -> Environment Variables.';
  }
  if (isVercelHost(req) && CONFIG.databaseUrl.includes('localhost')) {
    return 'DATABASE_URL points to localhost. Use your hosted Postgres URL in Vercel environment variables.';
  }
  return null;
}

function resolveRoute(req) {
  const partsRaw = req.query && req.query.path;
  if (Array.isArray(partsRaw) && partsRaw.length) {
    return `/${partsRaw.join('/')}`;
  }
  if (typeof partsRaw === 'string' && partsRaw) {
    return `/${partsRaw}`;
  }

  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const pathname = parsed.pathname || '/';
    if (pathname === '/api') return '/';
    if (pathname.startsWith('/api/')) return pathname.slice(4);
    return pathname;
  } catch {
    return '/';
  }
}

async function ensureSchema() {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        starts_at TIMESTAMP,
        ends_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        supplier_name TEXT NOT NULL,
        supplier_email TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS catalogues (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        file_url TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_identifier TEXT UNIQUE NOT NULL,
        event_id INTEGER REFERENCES events(id),
        last_seen_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        uuid TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        company TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        interest_area TEXT,
        notes TEXT,
        event_id INTEGER REFERENCES events(id),
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP,
        last_synced_at TIMESTAMP,
        sync_status TEXT,
        email_sent_status TEXT,
        brevo_sync_status TEXT
      );
    `);

    await pool.query(`
      INSERT INTO events (name)
      SELECT 'Trade Show 2026'
      WHERE NOT EXISTS (SELECT 1 FROM events);
    `);

    await pool.query(`
      INSERT INTO suppliers (supplier_name, supplier_email, is_active)
      SELECT 'Supplier A', 'a@supplier.com', TRUE
      WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_email = 'a@supplier.com');
    `);

    await pool.query(`
      INSERT INTO suppliers (supplier_name, supplier_email, is_active)
      SELECT 'Supplier B', 'b@supplier.com', TRUE
      WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_email = 'b@supplier.com');
    `);
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const route = resolveRoute(req);
  const dbConfigError = dbConfigErrorForRequest(req);

  try {
    if (route !== '/health/smtp') {
      if (dbConfigError) {
        return json(res, 500, { error: dbConfigError });
      }
      await ensureSchema();
    }

    if (req.method === 'GET' && route === '/health') {
      return json(res, 200, {
        ok: true,
        dbConfigured: !dbConfigError,
        dbMessage: dbConfigError || 'Database configuration looks valid.'
      });
    }

    if (req.method === 'GET' && route === '/health/db') {
      await pool.query('SELECT 1');
      return json(res, 200, { ok: true, message: 'Database connection is healthy' });
    }

    if ((req.method === 'GET' || req.method === 'POST') && route === '/health/smtp') {
      try {
        await transporter.verify();
        return json(res, 200, { ok: true, message: 'SMTP credentials are valid' });
      } catch (smtpError) {
        return json(res, 200, { ok: false, message: smtpErrorMessage(smtpError) });
      }
    }

    if (req.method === 'GET' && route === '/suppliers') {
      const result = await pool.query('SELECT * FROM suppliers WHERE is_active=true');
      return json(res, 200, result.rows);
    }

    if (req.method === 'GET' && route === '/catalogues') {
      const result = await pool.query('SELECT * FROM catalogues WHERE is_active=true');
      return json(res, 200, result.rows);
    }

    if (req.method === 'GET' && route === '/sync/status') {
      const result = await pool.query("SELECT COUNT(*) FILTER (WHERE sync_status!='synced') AS pending, MAX(updated_at) AS last_sync FROM leads");
      return json(res, 200, result.rows[0] || { pending: 0, last_sync: null });
    }

    if (req.method === 'GET' && route === '/leads/changes') {
      const since = typeof req.query.since === 'string' ? req.query.since : null;
      const parsedLimit = Number(req.query.limit || 200);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 200;

      const rows = (
        await pool.query(
          `SELECT uuid, first_name, last_name, company, email, phone, interest_area, notes,
                  event_id, created_at, updated_at, sync_status, email_sent_status,
                  brevo_sync_status, last_synced_at
           FROM leads
           WHERE ($1::timestamptz IS NULL OR COALESCE(updated_at, created_at) > $1::timestamptz)
           ORDER BY COALESCE(updated_at, created_at) ASC
           LIMIT $2`,
          [since || null, limit]
        )
      ).rows;

      const nextCursor = rows.length
        ? new Date(rows[rows.length - 1].updated_at || rows[rows.length - 1].created_at).toISOString()
        : since;

      return json(res, 200, { leads: rows.map(mapRowToLead), nextCursor });
    }

    if (req.method === 'POST' && route === '/device/register') {
      const body = parseBody(req);
      const deviceIdentifier = String(body.deviceIdentifier || '').trim();
      const eventId = Number(body.eventId || 1);
      if (!deviceIdentifier) {
        return json(res, 400, { error: 'deviceIdentifier is required' });
      }

      await pool.query(
        'INSERT INTO devices(device_identifier,event_id,last_seen_at) VALUES($1,$2,NOW()) ON CONFLICT (device_identifier) DO UPDATE SET event_id=EXCLUDED.event_id,last_seen_at=NOW()',
        [deviceIdentifier, eventId]
      );
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && route === '/leads/email-admin-list') {
      const rows = (
        await pool.query('SELECT first_name, last_name, email, phone, company, interest_area, created_at FROM leads ORDER BY created_at DESC')
      ).rows;
      try {
        await sendFullLeadListEmail(rows);
        return json(res, 200, { ok: true, count: rows.length, message: `Lead list emailed (${rows.length} leads).` });
      } catch (smtpError) {
        return json(res, 200, { ok: false, count: rows.length, message: smtpErrorMessage(smtpError) });
      }
    }

    if (req.method === 'POST' && route === '/leads/batch') {
      const body = parseBody(req);
      const leads = Array.isArray(body.leads) ? body.leads : [];
      const result = [];

      for (const lead of leads) {
        try {
          if (!lead.uuid || !lead.firstName || !lead.email) {
            throw new Error('Invalid lead payload');
          }

          const inserted = await pool.query(
            `INSERT INTO leads (uuid,first_name,last_name,company,email,phone,interest_area,notes,event_id,created_at,updated_at,sync_status,email_sent_status,brevo_sync_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),'synced','pending','disabled')
             ON CONFLICT (uuid) DO UPDATE SET
               first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name,
               company = EXCLUDED.company,
               email = EXCLUDED.email,
               phone = EXCLUDED.phone,
               interest_area = EXCLUDED.interest_area,
               notes = EXCLUDED.notes,
               event_id = EXCLUDED.event_id,
               updated_at = NOW(),
               sync_status = 'synced'
             RETURNING *`,
            [
              lead.uuid,
              lead.firstName,
              lead.lastName || '',
              lead.company || null,
              lead.email,
              lead.phone || null,
              lead.interestArea || null,
              lead.notes || null,
              Number(lead.eventId || 1),
              lead.createdAt || new Date().toISOString()
            ]
          );

          const row = inserted.rows[0];
          let emailSentStatus = row.email_sent_status || 'pending';
          let emailError = null;

          try {
            if (emailSentStatus !== 'sent') {
              const selectedSuppliers = Array.isArray(lead.selectedSuppliers) ? lead.selectedSuppliers : [];
              const supplierRows = selectedSuppliers.length
                ? (await pool.query('SELECT * FROM suppliers WHERE id = ANY($1::int[])', [selectedSuppliers.map((id) => Number(id))])).rows
                : [];

              await sendLeadEmail({ lead: row, suppliers: supplierRows, eventName: `Event ${Number(lead.eventId || 1)}` });
              emailSentStatus = 'sent';
            }
          } catch (emailSendError) {
            emailSentStatus = 'failed';
            emailError = emailSendError instanceof Error ? emailSendError.message : 'Email send failed';
          }

          await pool.query(
            'UPDATE leads SET sync_status=$2, email_sent_status=$3, brevo_sync_status=$4, last_synced_at=NOW(), updated_at=NOW() WHERE uuid=$1',
            [lead.uuid, 'synced', emailSentStatus, 'disabled']
          );

          result.push({
            uuid: lead.uuid,
            syncStatus: 'synced',
            emailSentStatus,
            brevoSyncStatus: 'disabled',
            error: emailError
          });
        } catch (leadError) {
          result.push({
            uuid: lead.uuid,
            syncStatus: 'failed',
            emailSentStatus: 'failed',
            brevoSyncStatus: 'disabled',
            error: leadError instanceof Error ? leadError.message : 'Lead sync failed'
          });
        }
      }

      return json(res, 200, { synced: result });
    }

    return json(res, 404, { error: `Unknown route: ${req.method} ${route}` });
  } catch (e) {
    return json(res, 500, { error: e.message || 'Server error' });
  }
};

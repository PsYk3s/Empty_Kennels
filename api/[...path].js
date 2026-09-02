const { Pool } = require('pg');

try {
  require('dotenv').config({ path: '.env' });
} catch {
  // In some runtimes dotenv may be unavailable; Vercel env vars still work.
}

const CONFIG = {
  databaseUrl: process.env.DATABASE_URL || '',
  adminEmail: 'warrenb@pienaarbros.co.za',
  smtp: {
    from: process.env.SMTP_FROM || 'warrenb@pienaarbros.co.za'
  },
  brevo: {
    enabled: String(process.env.BREVO_ENABLED || 'true').toLowerCase() !== 'false',
    apiKey: String(process.env.BREVO_API_KEY || process.env.BREVO_KEY || '').trim(),
    listId: Number(process.env.BREVO_LIST_ID || 26)
  }
};

const pool = new Pool({ connectionString: CONFIG.databaseUrl });
let schemaReadyPromise = null;

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

function smtpErrorMessage(error) {
  const text = error instanceof Error ? error.message : String(error || 'Email request failed');
  if (/401|403|api[- ]?key|unauthor/i.test(text)) {
    return 'Brevo authentication failed. Check that BREVO_API_KEY is a valid API v3 key with transactional email permissions.';
  }
  if (/sender|from.*not.*valid|not.*verified/i.test(text)) {
    return `Brevo rejected the sender address. Verify ${CONFIG.smtp.from} as a sender/domain in Brevo (Senders, Domains & Dedicated IPs).`;
  }
  return `Email error: ${text}`;
}

function brevoErrorMessage(error) {
  const text = error instanceof Error ? error.message : String(error || 'Brevo request failed');
  if (/401|403|api[- ]?key|unauthor/i.test(text)) {
    return 'Brevo authentication failed. Use BREVO_API_KEY (API v3 key, usually starts with xkeysib-) and not SMTP credentials.';
  }
  return `Brevo error: ${text}`;
}

async function syncLeadToBrevoList(lead) {
  if (!CONFIG.brevo.enabled) {
    return { status: 'disabled', error: null };
  }
  if (!CONFIG.brevo.apiKey || !CONFIG.brevo.listId) {
    throw new Error('Brevo is enabled but BREVO_API_KEY or BREVO_LIST_ID is missing');
  }
  const requestBrevo = async (includeSms) => {
    const attributes = {
      FIRSTNAME: String(lead.first_name || '').trim(),
      LASTNAME: String(lead.last_name || '').trim(),
      COMPANY: String(lead.company || '').trim() || undefined
    };
    if (includeSms) {
      attributes.SMS = String(lead.phone || '').trim() || undefined;
    }

    return fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': CONFIG.brevo.apiKey
      },
      body: JSON.stringify({
        email: String(lead.email || '').trim(),
        attributes,
        listIds: [CONFIG.brevo.listId],
        updateEnabled: true
      })
    });
  };

  const hasPhone = Boolean(String(lead.phone || '').trim());
  const firstAttempt = await requestBrevo(hasPhone);
  if (firstAttempt.ok) {
    return { status: 'synced', error: null };
  }

  const firstError = await firstAttempt.text().catch(() => 'Brevo request failed');
  if (hasPhone) {
    const secondAttempt = await requestBrevo(false);
    if (secondAttempt.ok) {
      return { status: 'synced', error: null };
    }

    const secondError = await secondAttempt.text().catch(() => 'Brevo request failed');
    throw new Error(`${secondError || `HTTP ${secondAttempt.status}`}. Brevo retry without phone also failed. Initial error: ${firstError || `HTTP ${firstAttempt.status}`}`);
  }

  throw new Error(`${firstError || `HTTP ${firstAttempt.status}`}. Verify BREVO_API_KEY, BREVO_LIST_ID, and contacts permissions.`);
}

async function sendBrevoEmail({ subject, text, attachments }) {
  if (!CONFIG.brevo.apiKey) {
    throw new Error('BREVO_API_KEY is not configured; cannot send email.');
  }

  const payload = {
    sender: { email: CONFIG.smtp.from || CONFIG.adminEmail },
    to: [{ email: CONFIG.adminEmail }],
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
      'api-key': CONFIG.brevo.apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Brevo email request failed');
    throw new Error(details || `HTTP ${response.status}`);
  }
}

async function sendLeadEmail({ lead, eventName }) {
  await sendBrevoEmail({
    subject: `New Lead: ${lead.first_name} ${lead.last_name}`,
    text: `Event: ${eventName}\nName: ${lead.first_name} ${lead.last_name}\nEmail: ${lead.email}\nPhone: ${lead.phone || ''}\nCompany: ${lead.company || ''}\nInterest: ${lead.interest_area || ''}\nNotes: ${lead.notes || ''}`
  });
}

async function sendFullLeadListEmail(leads) {
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

  const csvBody = [headers, ...csvRows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\r\n');

  const csv = `\ufeffsep=,\r\n${csvBody}`;

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

async function sendCsvBackupEmail({ csv, fileName, count, eventName, deviceId }) {
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
    brevoSyncStatus: row.brevo_sync_status || (CONFIG.brevo.enabled ? 'pending' : 'disabled')
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

function parseIsoTimestamp(value, fallback = new Date().toISOString()) {
  const text = String(value || '').trim();
  const stamp = text || fallback;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toISOString();
}

// Compound cursor (timestamp + uuid tie-break) so leads sharing a timestamp are never skipped.
function buildChangesCursor(row) {
  const ts = new Date(row.updated_at || row.created_at).toISOString();
  return `${ts}::${row.uuid}`;
}

function parseChangesCursor(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const separatorIndex = text.lastIndexOf('::');
  const tsPart = separatorIndex >= 0 ? text.slice(0, separatorIndex) : text;
  const uuidPart = separatorIndex >= 0 ? text.slice(separatorIndex + 2) : '';
  const date = new Date(tsPart);
  if (Number.isNaN(date.getTime())) return null;

  return { ts: date.toISOString(), uuid: uuidPart };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const compact = trimmed.replace(/[\s().-]/g, '');
  if (compact.startsWith('00')) {
    return `+${compact.slice(2)}`;
  }
  return compact;
}

async function getEventName(fallback = 'Main Event') {
  const row = (
    await pool.query("SELECT value FROM app_settings WHERE key='event_name' LIMIT 1")
  ).rows[0];
  return String(row?.value || fallback).trim() || fallback;
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

      CREATE INDEX IF NOT EXISTS idx_leads_sync_cursor ON leads (COALESCE(updated_at, created_at), uuid);

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
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
        if (!CONFIG.brevo.apiKey) {
          throw new Error('BREVO_API_KEY is not configured.');
        }
        const accountResp = await fetch('https://api.brevo.com/v3/account', {
          headers: { accept: 'application/json', 'api-key': CONFIG.brevo.apiKey }
        });
        if (!accountResp.ok) {
          const details = await accountResp.text().catch(() => 'Brevo account check failed');
          throw new Error(details || `HTTP ${accountResp.status}`);
        }
        return json(res, 200, { ok: true, message: 'Brevo API key is valid for sending email.' });
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

    if (req.method === 'GET' && route === '/sync/clear-marker') {
      const row = (
        await pool.query("SELECT value FROM app_settings WHERE key='leads_cleared_at' LIMIT 1")
      ).rows[0];
      return json(res, 200, { clearedAt: row?.value || null });
    }

    if (req.method === 'GET' && route === '/settings/event-name') {
      const row = (
        await pool.query("SELECT value, updated_at FROM app_settings WHERE key='event_name' LIMIT 1")
      ).rows[0];
      return json(res, 200, {
        name: row?.value || '',
        updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null
      });
    }

    if (req.method === 'POST' && route === '/settings/event-name') {
      const body = parseBody(req);
      const name = String(body.name || '').trim();
      if (!name) return json(res, 400, { ok: false, message: 'Name is required' });

      const row = (
        await pool.query(
          `INSERT INTO app_settings(key, value, updated_at)
           VALUES('event_name',$1,NOW())
           ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
           RETURNING value, updated_at`,
          [name]
        )
      ).rows[0];

      return json(res, 200, {
        ok: true,
        name: row.value,
        updatedAt: new Date(row.updated_at).toISOString()
      });
    }

    if (req.method === 'GET' && route === '/leads/changes') {
      const since = typeof req.query.since === 'string' ? req.query.since : null;
      const parsedLimit = Number(req.query.limit || 200);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 200;
      const cursor = parseChangesCursor(since);

      const rows = (
        await pool.query(
          `SELECT uuid, first_name, last_name, company, email, phone, interest_area, notes,
                  event_id, created_at, updated_at, sync_status, email_sent_status,
                  brevo_sync_status, last_synced_at
           FROM leads
           WHERE $1::timestamptz IS NULL
              OR (COALESCE(updated_at, created_at), uuid) > ($1::timestamptz, $2)
           ORDER BY COALESCE(updated_at, created_at) ASC, uuid ASC
           LIMIT $3`,
          [cursor?.ts || null, cursor?.uuid || '', limit]
        )
      ).rows;

      const nextCursor = rows.length
        ? buildChangesCursor(rows[rows.length - 1])
        : since;

      return json(res, 200, { leads: rows.map(mapRowToLead), nextCursor });
    }

    if (req.method === 'GET' && route === '/leads/manifest') {
      const rows = (
        await pool.query('SELECT uuid FROM leads ORDER BY uuid ASC')
      ).rows;
      return json(res, 200, { uuids: rows.map((row) => row.uuid) });
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
      const body = parseBody(req);
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

    if (req.method === 'POST' && route === '/leads/email-local-backup') {
      const body = parseBody(req);
      const csv = String(body.csv || '');
      if (!csv.trim()) {
        return json(res, 400, { error: 'csv is required' });
      }

      await sendCsvBackupEmail({
        csv,
        fileName: body.fileName,
        count: Number(body.count || 0),
        eventName: body.eventName,
        deviceId: body.deviceId
      });

      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && route === '/leads/clear-all') {
      const body = parseBody(req);
      const pin = String(body.pin || '').trim();
      if (pin !== '1050') {
        return json(res, 403, { ok: false, message: 'Invalid PIN' });
      }

      const clearedAt = new Date().toISOString();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM leads');
        await client.query(
          `INSERT INTO app_settings(key, value, updated_at)
           VALUES('leads_cleared_at',$1,NOW())
           ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
          [clearedAt]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return json(res, 200, { ok: true, clearedAt });
    }

    if (req.method === 'POST' && route === '/leads/batch') {
      const body = parseBody(req);
      const leads = Array.isArray(body.leads) ? body.leads : [];
      const result = [];

      for (const lead of leads) {
        try {
          const email = normalizeEmail(lead.email);
          const phone = normalizePhone(lead.phone);

          if (!lead.uuid || !lead.firstName || !email) {
            throw new Error('Invalid lead payload');
          }

          if (!isValidEmail(email)) {
            throw new Error('Invalid email address. Use a standard email format such as name@company.com.');
          }

          const createdAt = parseIsoTimestamp(lead.createdAt);
          const updatedAt = parseIsoTimestamp(lead.updatedAt || lead.createdAt || createdAt, createdAt);

          const inserted = await pool.query(
            `INSERT INTO leads (uuid,first_name,last_name,company,email,phone,interest_area,notes,event_id,created_at,updated_at,sync_status,email_sent_status,brevo_sync_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'synced','pending',CASE WHEN $12 THEN 'pending' ELSE 'disabled' END)
             ON CONFLICT (uuid) DO UPDATE SET
               first_name = CASE WHEN COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at) >= COALESCE(leads.updated_at, leads.created_at) THEN EXCLUDED.first_name ELSE leads.first_name END,
               last_name = CASE WHEN COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at) >= COALESCE(leads.updated_at, leads.created_at) THEN EXCLUDED.last_name ELSE leads.last_name END,
               company = CASE WHEN COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at) >= COALESCE(leads.updated_at, leads.created_at) THEN EXCLUDED.company ELSE leads.company END,
               email = CASE WHEN COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at) >= COALESCE(leads.updated_at, leads.created_at) THEN EXCLUDED.email ELSE leads.email END,
               phone = CASE WHEN COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at) >= COALESCE(leads.updated_at, leads.created_at) THEN EXCLUDED.phone ELSE leads.phone END,
               interest_area = CASE WHEN COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at) >= COALESCE(leads.updated_at, leads.created_at) THEN EXCLUDED.interest_area ELSE leads.interest_area END,
               notes = CASE WHEN COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at) >= COALESCE(leads.updated_at, leads.created_at) THEN EXCLUDED.notes ELSE leads.notes END,
               event_id = CASE WHEN COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at) >= COALESCE(leads.updated_at, leads.created_at) THEN EXCLUDED.event_id ELSE leads.event_id END,
               created_at = LEAST(leads.created_at, EXCLUDED.created_at),
               updated_at = GREATEST(COALESCE(leads.updated_at, leads.created_at), COALESCE(EXCLUDED.updated_at, EXCLUDED.created_at)),
               sync_status = 'synced',
               brevo_sync_status = CASE WHEN leads.brevo_sync_status = 'synced' THEN 'synced' WHEN $12 THEN 'pending' ELSE 'disabled' END
             RETURNING *`,
            [
              lead.uuid,
              lead.firstName,
              lead.lastName || '',
              lead.company || null,
              email,
              phone || null,
              lead.interestArea || null,
              lead.notes || null,
              Number(lead.eventId || 1),
              createdAt,
              updatedAt,
              CONFIG.brevo.enabled
            ]
          );

          const row = inserted.rows[0];
          let emailSentStatus = row.email_sent_status || 'pending';
          let emailError = null;
          let brevoSyncStatus = row.brevo_sync_status || (CONFIG.brevo.enabled ? 'pending' : 'disabled');
          let brevoError = null;

          try {
            if (emailSentStatus !== 'sent') {
              await sendLeadEmail({ lead: row, eventName: await getEventName(`Event ${Number(lead.eventId || 1)}`) });
              emailSentStatus = 'sent';
            }
          } catch (emailSendError) {
            emailSentStatus = 'failed';
            emailError = smtpErrorMessage(emailSendError);
          }

          try {
            if (brevoSyncStatus !== 'synced') {
              const brevoResult = await syncLeadToBrevoList(row);
              brevoSyncStatus = brevoResult.status;
            }
          } catch (brevoSyncError) {
            brevoSyncStatus = 'failed';
            brevoError = brevoSyncError instanceof Error ? brevoSyncError.message : 'Brevo sync failed';
          }

          await pool.query(
            'UPDATE leads SET sync_status=$2, email_sent_status=$3, brevo_sync_status=$4, last_synced_at=NOW() WHERE uuid=$1',
            [lead.uuid, 'synced', emailSentStatus, brevoSyncStatus]
          );

          result.push({
            uuid: lead.uuid,
            syncStatus: 'synced',
            emailSentStatus,
            brevoSyncStatus,
            emailError,
            brevoError,
            syncError: null,
            error: [emailError, brevoError].filter(Boolean).join(' | ') || null
          });
        } catch (leadError) {
          result.push({
            uuid: lead.uuid,
            syncStatus: 'failed',
            emailSentStatus: 'failed',
            brevoSyncStatus: CONFIG.brevo.enabled ? 'failed' : 'disabled',
            emailError: null,
            brevoError: null,
            syncError: leadError instanceof Error ? leadError.message : 'Lead sync failed',
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

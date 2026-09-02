import { z } from 'zod';
import { pool } from '../database/db.js';
import { sendCsvBackupEmail, sendFullLeadListEmail, sendLeadEmail, smtpErrorMessage } from '../integrations/emailService.js';
import { syncLeadToBrevo } from '../integrations/brevoService.js';
import { APP_CONFIG } from '../config.js';

const leadSchema = z.object({ uuid: z.string(), firstName: z.string(), lastName: z.string(), company: z.string().optional(), email: z.string().email(), phone: z.string().optional(), interestArea: z.string().optional(), notes: z.string().optional(), eventId: z.number(), selectedSuppliers: z.array(z.number()).default([]), createdAt: z.string() });

const syncQuerySchema = z.object({
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

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

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

const localBackupSchema = z.object({
  csv: z.string().min(1),
  fileName: z.string().min(1).max(160).optional(),
  count: z.number().int().min(0).optional(),
  eventName: z.string().optional(),
  deviceId: z.string().optional()
});

export async function batchCreateLeads(req, res, next) {
  try {
    const leads = z.array(leadSchema).parse(req.body.leads || []);
    const result = [];

    for (const lead of leads) {
      try {
        const inserted = await pool.query(`INSERT INTO leads (uuid,first_name,last_name,company,email,phone,interest_area,notes,event_id,created_at,updated_at,sync_status,email_sent_status,brevo_sync_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),'synced','pending','pending')
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
        RETURNING *`, [lead.uuid, lead.firstName, lead.lastName, lead.company || null, lead.email, lead.phone || null, lead.interestArea || null, lead.notes || null, lead.eventId, lead.createdAt]);

        const row = inserted.rows[0];
        let emailSentStatus = row.email_sent_status || 'pending';
        let brevoSyncStatus = row.brevo_sync_status || 'pending';
        let emailError = null;
        let brevoError = null;

        try {
          if (emailSentStatus !== 'sent') {
            await sendLeadEmail({ lead: row, eventName: `Event ${lead.eventId}` });
            emailSentStatus = 'sent';
          }
        } catch (emailSendError) {
          emailSentStatus = 'failed';
          emailError = smtpErrorMessage(emailSendError);
        }

        try {
          const brevoResult = await syncLeadToBrevo(lead);
          if (brevoResult.skipped) {
            brevoSyncStatus = APP_CONFIG.brevo.enabled ? 'pending' : 'disabled';
          } else {
            brevoSyncStatus = 'synced';
          }
        } catch (brevoSyncError) {
          brevoSyncStatus = 'failed';
          brevoError = brevoSyncError instanceof Error ? brevoSyncError.message : 'Brevo sync failed';
        }

        await pool.query(
          'UPDATE leads SET sync_status=$2, email_sent_status=$3, brevo_sync_status=$4, last_synced_at=NOW(), updated_at=NOW() WHERE uuid=$1',
          [lead.uuid, 'synced', emailSentStatus, brevoSyncStatus]
        );

        result.push({
          uuid: lead.uuid,
          syncStatus: 'synced',
          emailSentStatus,
          brevoSyncStatus,
          emailError,
          brevoError,
          syncError: null
        });
      } catch (leadError) {
        await pool.query(
          'UPDATE leads SET sync_status=$2, email_sent_status=COALESCE(email_sent_status,$3), brevo_sync_status=COALESCE(brevo_sync_status,$4), updated_at=NOW() WHERE uuid=$1',
          [lead.uuid, 'failed', 'failed', 'failed']
        ).catch(() => {});

        result.push({
          uuid: lead.uuid,
          syncStatus: 'failed',
          emailSentStatus: 'failed',
          brevoSyncStatus: 'failed',
          emailError: null,
          brevoError: null,
          syncError: leadError instanceof Error ? leadError.message : 'Lead sync failed'
        });
      }
    }

    res.json({ synced: result });
  } catch (e) { next(e); }
}

export async function emailLeadListToAdmin(req, res, next) {
  try {
    const rows = (await pool.query(
      'SELECT first_name, last_name, email, phone, company, interest_area, created_at FROM leads ORDER BY created_at DESC'
    )).rows;

    await sendFullLeadListEmail({ leads: rows });
    res.json({ ok: true, count: rows.length });
  } catch (e) {
    next(e);
  }
}

export async function emailLocalLeadBackupToAdmin(req, res, next) {
  try {
    const payload = localBackupSchema.parse(req.body || {});
    await sendCsvBackupEmail({
      csv: payload.csv,
      fileName: payload.fileName,
      count: payload.count,
      eventName: payload.eventName,
      deviceId: payload.deviceId
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function clearAllLeads(req, res, next) {
  try {
    const pin = String(req.body?.pin || '').trim();
    if (pin !== '1050') {
      return res.status(403).json({ ok: false, message: 'Invalid PIN' });
    }

    await ensureSettingsTable();
    const clearedAt = new Date().toISOString();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM lead_suppliers WHERE lead_id IN (SELECT id FROM leads)');
      await client.query('DELETE FROM leads');
      await client.query('DELETE FROM sync_logs').catch(() => undefined);
      await client.query('DELETE FROM email_logs').catch(() => undefined);
      await client.query('DELETE FROM brevo_logs').catch(() => undefined);
      await client.query(
        `INSERT INTO app_settings(key, value, updated_at)
         VALUES($1,$2,NOW())
         ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        ['leads_cleared_at', clearedAt]
      );
      await client.query('COMMIT');
      res.json({ ok: true, clearedAt });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
}

export async function getClearMarker(req, res, next) {
  try {
    await ensureSettingsTable();
    const row = (
      await pool.query('SELECT value FROM app_settings WHERE key=$1 LIMIT 1', ['leads_cleared_at'])
    ).rows[0];

    res.json({ clearedAt: row?.value || null });
  } catch (e) {
    next(e);
  }
}

export async function getLeadManifest(req, res, next) {
  try {
    const rows = (await pool.query('SELECT uuid FROM leads ORDER BY uuid ASC')).rows;
    res.json({ uuids: rows.map((row) => row.uuid) });
  } catch (e) {
    next(e);
  }
}

export async function getLeadChanges(req, res, next) {
  try {
    const parsed = syncQuerySchema.parse(req.query);
    const since = parsed.since;
    const limit = parsed.limit || 200;
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
      : since || null;

    res.json({
      leads: rows.map((row) => ({
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
        brevoSyncStatus: row.brevo_sync_status || 'pending'
      })),
      nextCursor
    });
  } catch (e) {
    next(e);
  }
}

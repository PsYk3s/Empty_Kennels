import { z } from 'zod';
import { pool } from '../database/db.js';
import { sendFullLeadListEmail, sendLeadEmail } from '../integrations/emailService.js';
import { syncLeadToBrevo } from '../integrations/brevoService.js';
import { APP_CONFIG } from '../config.js';

const leadSchema = z.object({ uuid: z.string(), firstName: z.string(), lastName: z.string(), company: z.string().optional(), email: z.string().email(), phone: z.string().optional(), interestArea: z.string().optional(), notes: z.string().optional(), eventId: z.number(), selectedSuppliers: z.array(z.number()).default([]), createdAt: z.string() });

const syncQuerySchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
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
          emailError = emailSendError instanceof Error ? emailSendError.message : 'Email send failed';
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

export async function getLeadChanges(req, res, next) {
  try {
    const parsed = syncQuerySchema.parse(req.query);
    const since = parsed.since;
    const limit = parsed.limit || 200;

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

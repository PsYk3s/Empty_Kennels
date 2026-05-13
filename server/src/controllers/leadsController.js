import { z } from 'zod';
import { pool } from '../database/db.js';
import { sendFullLeadListEmail, sendLeadEmail } from '../integrations/emailService.js';
import { syncLeadToBrevo } from '../integrations/brevoService.js';

const leadSchema = z.object({ uuid: z.string(), firstName: z.string(), lastName: z.string(), company: z.string().optional(), email: z.string().email(), phone: z.string().optional(), interestArea: z.string().optional(), notes: z.string().optional(), eventId: z.number(), selectedSuppliers: z.array(z.number()).default([]), createdAt: z.string() });

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

        try {
          if (emailSentStatus !== 'sent') {
            const supplierRows = lead.selectedSuppliers.length
              ? (await pool.query('SELECT * FROM suppliers WHERE id = ANY($1::int[])', [lead.selectedSuppliers])).rows
              : [];

            await sendLeadEmail({ lead: row, suppliers: supplierRows, eventName: `Event ${lead.eventId}` });
            emailSentStatus = 'sent';
          }
        } catch {
          emailSentStatus = 'failed';
        }

        try {
          const brevoResult = await syncLeadToBrevo(lead);
          if (brevoResult.skipped) {
            brevoSyncStatus = process.env.BREVO_ENABLED === 'true' ? 'pending' : 'disabled';
          } else {
            brevoSyncStatus = 'synced';
          }
        } catch {
          brevoSyncStatus = 'failed';
        }

        await pool.query(
          'UPDATE leads SET sync_status=$2, email_sent_status=$3, brevo_sync_status=$4, last_synced_at=NOW(), updated_at=NOW() WHERE uuid=$1',
          [lead.uuid, 'synced', emailSentStatus, brevoSyncStatus]
        );

        result.push({
          uuid: lead.uuid,
          syncStatus: 'synced',
          emailSentStatus,
          brevoSyncStatus
        });
      } catch {
        await pool.query(
          'UPDATE leads SET sync_status=$2, email_sent_status=COALESCE(email_sent_status,$3), brevo_sync_status=COALESCE(brevo_sync_status,$4), updated_at=NOW() WHERE uuid=$1',
          [lead.uuid, 'failed', 'failed', 'failed']
        ).catch(() => {});

        result.push({
          uuid: lead.uuid,
          syncStatus: 'failed',
          emailSentStatus: 'failed',
          brevoSyncStatus: 'failed'
        });
      }
    }

    res.json({ synced: result });
  } catch (e) { next(e); }
}

export async function emailLeadListToAdmin(req, res, next) {
  try {
    const rows = (await pool.query(
      'SELECT first_name, last_name, email, phone, company, interest_area, created_at FROM leads ORDER BY created_at DESC LIMIT 5000'
    )).rows;

    await sendFullLeadListEmail({ leads: rows });
    res.json({ ok: true, count: rows.length });
  } catch (e) {
    next(e);
  }
}

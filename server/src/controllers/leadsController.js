import { z } from 'zod';
import { pool } from '../database/db.js';
import { sendLeadEmail } from '../integrations/emailService.js';
import { syncLeadToBrevo } from '../integrations/brevoService.js';

const leadSchema = z.object({ uuid: z.string(), firstName: z.string(), lastName: z.string(), company: z.string().optional(), email: z.string().email(), phone: z.string().optional(), interestArea: z.string().optional(), notes: z.string().optional(), eventId: z.number(), selectedSuppliers: z.array(z.number()).default([]), createdAt: z.string() });

export async function batchCreateLeads(req, res, next) {
  try {
    const leads = z.array(leadSchema).parse(req.body.leads || []);
    const result = [];
    for (const lead of leads) {
      const inserted = await pool.query(`INSERT INTO leads (uuid,first_name,last_name,company,email,phone,interest_area,notes,event_id,created_at,updated_at,sync_status,email_sent_status,brevo_sync_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),'synced','pending','pending')
      ON CONFLICT (uuid) DO UPDATE SET updated_at=NOW() RETURNING *`, [lead.uuid, lead.firstName, lead.lastName, lead.company || null, lead.email, lead.phone || null, lead.interestArea || null, lead.notes || null, lead.eventId, lead.createdAt]);
      const row = inserted.rows[0];
      if (row.email_sent_status !== 'sent') {
        const supplierRows = lead.selectedSuppliers.length ? (await pool.query('SELECT * FROM suppliers WHERE id = ANY($1::int[])', [lead.selectedSuppliers])).rows : [];
        await sendLeadEmail({ lead: row, suppliers: supplierRows, eventName: `Event ${lead.eventId}` });
        await pool.query("UPDATE leads SET email_sent_status='sent' WHERE uuid=$1", [lead.uuid]);
      }
      await syncLeadToBrevo(lead);
      result.push({ uuid: lead.uuid, status: 'synced' });
    }
    res.json({ synced: result });
  } catch (e) { next(e); }
}

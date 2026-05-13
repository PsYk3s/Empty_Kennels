import { Router } from 'express';
import { batchCreateLeads, emailLeadListToAdmin } from '../controllers/leadsController.js';
import { pool } from '../database/db.js';
import nodemailer from 'nodemailer';
const router = Router();
router.post('/leads/batch', batchCreateLeads);
router.post('/leads/email-admin-list', emailLeadListToAdmin);
router.get('/health/smtp', async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });
    await transporter.verify();
    res.json({ ok: true, message: 'SMTP credentials are valid' });
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: `SMTP Error: ${e.message || 'Connection failed'}`
    });
  }
});
router.get('/catalogues', async (req,res)=>{ const r=await pool.query('SELECT * FROM catalogues WHERE is_active=true'); res.json(r.rows);});
router.get('/suppliers', async (req,res)=>{ const r=await pool.query('SELECT * FROM suppliers WHERE is_active=true'); res.json(r.rows);});
router.get('/sync/status', async (req,res)=>{ const r=await pool.query("SELECT COUNT(*) FILTER (WHERE sync_status!='synced') AS pending, MAX(updated_at) AS last_sync FROM leads"); res.json(r.rows[0]);});
router.post('/device/register', async (req,res)=>{ const {deviceIdentifier,eventId}=req.body; await pool.query('INSERT INTO devices(device_identifier,event_id,last_seen_at) VALUES($1,$2,NOW()) ON CONFLICT (device_identifier) DO UPDATE SET event_id=EXCLUDED.event_id,last_seen_at=NOW()', [deviceIdentifier,eventId]); res.json({ok:true});});
export default router;

import { Router } from 'express';
import { batchCreateLeads, emailLeadListToAdmin, getLeadChanges } from '../controllers/leadsController.js';
import { pool } from '../database/db.js';
import { verifySmtpConnection } from '../integrations/emailService.js';
const router = Router();
router.post('/leads/batch', batchCreateLeads);
router.post('/leads/email-admin-list', emailLeadListToAdmin);
router.get('/leads/changes', getLeadChanges);
router.get('/health/smtp', async (req, res) => {
  try {
    await verifySmtpConnection();
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

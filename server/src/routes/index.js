import { Router } from 'express';
import { batchCreateLeads, clearAllLeads, emailLeadListToAdmin, emailLocalLeadBackupToAdmin, getClearMarker, getLeadChanges } from '../controllers/leadsController.js';
import { pool } from '../database/db.js';
import { verifySmtpConnection } from '../integrations/emailService.js';
const router = Router();

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

router.post('/leads/batch', batchCreateLeads);
router.post('/leads/email-admin-list', emailLeadListToAdmin);
router.post('/leads/email-local-backup', emailLocalLeadBackupToAdmin);
router.post('/leads/clear-all', clearAllLeads);
router.get('/leads/changes', getLeadChanges);
router.get('/sync/clear-marker', getClearMarker);
router.get('/settings/event-name', async (req, res) => {
  await ensureSettingsTable();
  const row = (
    await pool.query(
      'SELECT value, updated_at FROM app_settings WHERE key=$1 LIMIT 1',
      ['event_name']
    )
  ).rows[0];

  res.json({
    name: row?.value || '',
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null
  });
});
router.post('/settings/event-name', async (req, res) => {
  await ensureSettingsTable();
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ ok: false, message: 'Name is required' });

  const row = (
    await pool.query(
      `INSERT INTO app_settings(key, value, updated_at)
       VALUES($1,$2,NOW())
       ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
       RETURNING value, updated_at`,
      ['event_name', name]
    )
  ).rows[0];

  res.json({
    ok: true,
    name: row.value,
    updatedAt: new Date(row.updated_at).toISOString()
  });
});
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

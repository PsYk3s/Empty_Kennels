import { APP_CONFIG } from '../config.js';

export async function syncLeadToBrevo(lead) {
  if (!APP_CONFIG.brevo.enabled) {
    return { skipped: true, synced: false };
  }

  const apiKey = String(APP_CONFIG.brevo.apiKey || '').trim();
  const listId = Number(APP_CONFIG.brevo.listId || 0);

  if (!apiKey || !listId) {
    throw new Error('Missing BREVO_API_KEY or BREVO_LIST_ID. Use Brevo API v3 credentials for contacts sync.');
  }

  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      email: lead.email,
      attributes: {
        FIRSTNAME: lead.firstName,
        LASTNAME: lead.lastName,
        COMPANY: lead.company || '',
        SMS: lead.phone || '',
        NOTES: lead.notes || '',
        INTEREST: lead.interestArea || ''
      },
      listIds: [listId],
      updateEnabled: true
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Unknown Brevo error');
    throw new Error(`Brevo sync failed: ${response.status} ${details}. Verify BREVO_API_KEY, BREVO_LIST_ID, and that the key has contacts permissions.`);
  }

  return { skipped: false, synced: true };
}

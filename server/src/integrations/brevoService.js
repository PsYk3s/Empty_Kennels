export async function syncLeadToBrevo(lead) {
  if (process.env.BREVO_ENABLED !== 'true') {
    return { skipped: true, synced: false };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID || 0);

  if (!apiKey || !listId) {
    throw new Error('Missing BREVO_API_KEY or BREVO_LIST_ID');
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
    throw new Error(`Brevo sync failed: ${response.status} ${details}`);
  }

  return { skipped: false, synced: true };
}

export async function syncLeadToBrevo() {
  if (process.env.BREVO_ENABLED !== 'true') return { skipped: true };
  return { skipped: false, synced: true };
}

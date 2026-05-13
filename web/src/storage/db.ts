const KEY = 'pb_leads';

function readLeads() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}
function writeLeads(leads: any[]) {
  localStorage.setItem(KEY, JSON.stringify(leads));
}

export const db = {
  leads: {
    async put(lead: any) {
      const leads = readLeads();
      const idx = leads.findIndex((l: any) => l.uuid === lead.uuid);
      if (idx >= 0) leads[idx] = lead; else leads.push(lead);
      writeLeads(leads);
    },
    async bulkPut(items: any[]) { for (const i of items) await this.put(i); },
    async pendingList(limit = 25) { return readLeads().filter((l: any) => ['pending', 'failed'].includes(l.syncStatus)).slice(0, limit); },
    async syncingList() { return readLeads().filter((l: any) => l.syncStatus === 'syncing'); },
    async pendingCount() { return readLeads().filter((l: any) => l.syncStatus !== 'synced').length; }
  }
};

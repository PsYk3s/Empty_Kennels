const KEY = 'pb_leads';

function readLeads() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}
function writeLeads(leads: any[]) {
  localStorage.setItem(KEY, JSON.stringify(leads));
}

export const db = {
  leads: {
    async get(uuid: string) {
      return readLeads().find((l: any) => l.uuid === uuid) || null;
    },
    async put(lead: any) {
      const leads = readLeads();
      const idx = leads.findIndex((l: any) => l.uuid === lead.uuid);
      if (idx >= 0) leads[idx] = lead; else leads.push(lead);
      writeLeads(leads);
    },
    async bulkPut(items: any[]) { for (const i of items) await this.put(i); },
    async allList(limit = 100) {
      return readLeads()
        .slice()
        .sort((a: any, b: any) => {
          const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bt - at;
        })
        .slice(0, limit);
    },
    async pendingList(limit = 25) {
      return readLeads()
        .filter((l: any) => {
          const syncRetry = ['pending', 'failed'].includes(l.syncStatus);
          const emailRetry = ['pending', 'failed'].includes(l.emailSentStatus);
          const brevoRetry = ['pending', 'failed'].includes(l.brevoSyncStatus);
          return syncRetry || emailRetry || brevoRetry;
        })
        .sort((a: any, b: any) => {
          const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return at - bt;
        })
        .slice(0, limit);
    },
    async brevoDisabledList(limit = 25) {
      return readLeads()
        .filter((l: any) => l.brevoSyncStatus === 'disabled' && l.syncStatus === 'synced')
        .sort((a: any, b: any) => {
          const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return at - bt;
        })
        .slice(0, limit);
    },
    async syncingList() { return readLeads().filter((l: any) => l.syncStatus === 'syncing'); },
    async pendingCount() { return readLeads().filter((l: any) => l.syncStatus !== 'synced').length; }
  }
};

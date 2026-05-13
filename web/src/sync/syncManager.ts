import { db } from '../storage/db';
import { api } from '../api/index';
let running=false;
export async function syncNow(){
	if(running||!navigator.onLine) return;
	running=true;
	try{
		const leads = await db.leads.pendingList(25);
		if(!leads.length)return;

		await db.leads.bulkPut(leads.map(l=>({...l,syncStatus:'syncing'})));

		const resp = await api.post('/leads/batch',{leads});
		const byId = new Map((resp.synced || []).map((s:any)=>[s.uuid,s]));
		const now = new Date().toISOString();

		await db.leads.bulkPut(leads.map((l:any)=>{
			const remote = byId.get(l.uuid);
			return {
				...l,
				syncStatus: remote?.syncStatus || 'failed',
				emailSentStatus: remote?.emailSentStatus || l.emailSentStatus || 'failed',
				brevoSyncStatus: remote?.brevoSyncStatus || l.brevoSyncStatus || 'failed',
				lastSyncedAt: now,
				updatedAt: now
			};
		}));
	} catch {
		const queued=await db.leads.syncingList();
		await db.leads.bulkPut(queued.map((l:any)=>({
			...l,
			syncStatus:'failed',
			emailSentStatus: l.emailSentStatus || 'failed',
			brevoSyncStatus: l.brevoSyncStatus || 'failed',
			updatedAt: new Date().toISOString()
		})));
	} finally{
		running=false;
	}
}
export function startSyncLoop(){ syncNow(); window.addEventListener('online',syncNow); setInterval(syncNow,600000); }

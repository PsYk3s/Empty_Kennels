import { db } from '../storage/db';
import { api } from '../api/index';

type SyncItem = {
	uuid: string;
	syncStatus?: string;
	emailSentStatus?: string;
	brevoSyncStatus?: string;
};

type LocalLead = {
	uuid: string;
	createdAt?: string;
	updatedAt?: string;
	syncStatus?: string;
	emailSentStatus?: string;
	brevoSyncStatus?: string;
	[key: string]: unknown;
};

type ChangesResponse = {
	leads?: LocalLead[];
	nextCursor?: string | null;
};

const SYNC_CURSOR_KEY = 'pb_sync_cursor_v1';
const SYNC_INTERVAL_MS = 15000;

let running = false;
let loopStarted = false;
let intervalId: number | null = null;

function getSyncCursor(): string | null {
	return localStorage.getItem(SYNC_CURSOR_KEY);
}

function setSyncCursor(value: string | null) {
	if (!value) return;
	localStorage.setItem(SYNC_CURSOR_KEY, value);
}

async function pushPendingLeads() {
	const leads = await db.leads.pendingList(25);
	if (!leads.length) return;

	await db.leads.bulkPut(leads.map((l: LocalLead) => ({ ...l, syncStatus: 'syncing' })));

	const resp = await api.post<{ synced?: SyncItem[] }>('/leads/batch', { leads });
	const byId = new Map((resp.synced || []).map((s) => [s.uuid, s]));
	const now = new Date().toISOString();

	await db.leads.bulkPut(
		leads.map((l: LocalLead) => {
			const remote = byId.get(l.uuid);
			return {
				...l,
				syncStatus: remote?.syncStatus || 'failed',
				emailSentStatus: remote?.emailSentStatus || l.emailSentStatus || 'failed',
				brevoSyncStatus: remote?.brevoSyncStatus || l.brevoSyncStatus || 'failed',
				lastSyncedAt: now,
				updatedAt: now
			};
		})
	);
}

async function pullRemoteChanges() {
	const cursor = getSyncCursor();
	const query = cursor ? `?since=${encodeURIComponent(cursor)}` : '';
	const response = await api.get<ChangesResponse>(`/leads/changes${query}`);
	const remoteLeads = response.leads || [];

	for (const remote of remoteLeads) {
		const local = await db.leads.get(remote.uuid);
		if (
			local &&
			(local.syncStatus === 'pending' || local.syncStatus === 'syncing') &&
			new Date(local.updatedAt || local.createdAt || 0).getTime() >
				new Date(remote.updatedAt || remote.createdAt || 0).getTime()
		) {
			continue;
		}

		await db.leads.put({
			...remote,
			syncStatus: remote.syncStatus || 'synced',
			emailSentStatus: remote.emailSentStatus || 'pending',
			brevoSyncStatus: remote.brevoSyncStatus || 'pending',
			updatedAt: remote.updatedAt || remote.createdAt || new Date().toISOString()
		});
	}

	if (response.nextCursor) {
		setSyncCursor(response.nextCursor);
	}
}

export async function syncNow() {
	if (running || !navigator.onLine) return;

	running = true;
	try {
		await pushPendingLeads();
		await pullRemoteChanges();
	} catch {
		const queued = await db.leads.syncingList();
		await db.leads.bulkPut(
			queued.map((l: LocalLead) => ({
				...l,
				syncStatus: 'failed',
				emailSentStatus: (l.emailSentStatus as string) || 'failed',
				brevoSyncStatus: (l.brevoSyncStatus as string) || 'failed',
				updatedAt: new Date().toISOString()
			}))
		);
	} finally {
		running = false;
	}
}

export function startSyncLoop() {
	if (loopStarted) {
		return () => undefined;
	}

	loopStarted = true;
	const onOnline = () => {
		void syncNow();
	};
	const onVisibility = () => {
		if (document.visibilityState === 'visible') {
			void syncNow();
		}
	};

	void syncNow();
	window.addEventListener('online', onOnline);
	document.addEventListener('visibilitychange', onVisibility);
	intervalId = window.setInterval(() => {
		void syncNow();
	}, SYNC_INTERVAL_MS);

	return () => {
		window.removeEventListener('online', onOnline);
		document.removeEventListener('visibilitychange', onVisibility);
		if (intervalId !== null) {
			window.clearInterval(intervalId);
			intervalId = null;
		}
		loopStarted = false;
	};
}

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

export type SyncHealth = {
	deviceId: string;
	lastRunAt: string | null;
	lastPushAt: string | null;
	lastPullAt: string | null;
	lastSuccessAt: string | null;
	lastError: string | null;
};

const SYNC_CURSOR_KEY = 'pb_sync_cursor_v1';
const DEVICE_ID_KEY = 'pb_device_id_v1';
const SYNC_HEALTH_KEY = 'pb_sync_health_v1';
const SYNC_INTERVAL_MS = 15000;
const HEALTH_EVENT = 'pb-sync-health';

let running = false;
let loopStarted = false;
let intervalId: number | null = null;
let deviceRegistered = false;

function makeDeviceId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `tablet-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function getDeviceId() {
	let value = localStorage.getItem(DEVICE_ID_KEY);
	if (!value) {
		value = makeDeviceId();
		localStorage.setItem(DEVICE_ID_KEY, value);
	}
	return value;
}

function defaultSyncHealth(): SyncHealth {
	return {
		deviceId: getDeviceId(),
		lastRunAt: null,
		lastPushAt: null,
		lastPullAt: null,
		lastSuccessAt: null,
		lastError: null
	};
}

export function getSyncHealth(): SyncHealth {
	try {
		const raw = localStorage.getItem(SYNC_HEALTH_KEY);
		if (!raw) return defaultSyncHealth();
		const parsed = JSON.parse(raw) as Partial<SyncHealth>;
		return {
			...defaultSyncHealth(),
			...parsed,
			deviceId: parsed.deviceId || getDeviceId()
		};
	} catch {
		return defaultSyncHealth();
	}
}

function setSyncHealth(patch: Partial<SyncHealth>) {
	const merged = { ...getSyncHealth(), ...patch };
	localStorage.setItem(SYNC_HEALTH_KEY, JSON.stringify(merged));
	window.dispatchEvent(new CustomEvent(HEALTH_EVENT, { detail: merged }));
}

async function registerDevice() {
	if (deviceRegistered || !navigator.onLine) return;

	await api.post('/device/register', {
		deviceIdentifier: getDeviceId(),
		eventId: 1
	});
	deviceRegistered = true;
}

function getSyncCursor(): string | null {
	return localStorage.getItem(SYNC_CURSOR_KEY);
}

function setSyncCursor(value: string | null) {
	if (!value) return;
	localStorage.setItem(SYNC_CURSOR_KEY, value);
}

async function pushPendingLeads() {
	const leads = await db.leads.pendingList(25);
	if (!leads.length) {
		setSyncHealth({ lastPushAt: new Date().toISOString() });
		return;
	}

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

	setSyncHealth({ lastPushAt: new Date().toISOString() });
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

	setSyncHealth({ lastPullAt: new Date().toISOString() });
}

export async function syncNow() {
	if (running || !navigator.onLine) return;

	running = true;
	setSyncHealth({ lastRunAt: new Date().toISOString() });
	try {
		await registerDevice();
		await pushPendingLeads();
		await pullRemoteChanges();
		setSyncHealth({
			lastSuccessAt: new Date().toISOString(),
			lastError: null
		});
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
		setSyncHealth({
			lastError: 'Sync failed. Check network or API health endpoints.'
		});
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
		void registerDevice();
		void syncNow();
	};
	const onVisibility = () => {
		if (document.visibilityState === 'visible') {
			void syncNow();
		}
	};

	void syncNow();
	void registerDevice();
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

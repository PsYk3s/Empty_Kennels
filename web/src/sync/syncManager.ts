import { db } from '../storage/db';
import { api } from '../api/index';

type SyncItem = {
	uuid: string;
	syncStatus?: string;
	emailSentStatus?: string;
	brevoSyncStatus?: string;
	emailError?: string | null;
	brevoError?: string | null;
	syncError?: string | null;
};

type LocalLead = {
	uuid: string;
	createdAt?: string;
	updatedAt?: string;
	syncStatus?: string;
	emailSentStatus?: string;
	brevoSyncStatus?: string;
	emailStatusMessage?: string;
	brevoStatusMessage?: string;
	databaseStatusMessage?: string;
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

type SyncOptions = {
	retryDisabledBrevo?: boolean;
};

const SYNC_CURSOR_KEY = 'pb_sync_cursor_v1';
const CLEAR_MARKER_KEY = 'pb_leads_cleared_at_v1';
const DEVICE_ID_KEY = 'pb_device_id_v1';
const SYNC_HEALTH_KEY = 'pb_sync_health_v1';
const SYNC_INTERVAL_MS = 15000;
const HEALTH_EVENT = 'pb-sync-health';
const CYCLE_EVENT = 'pb-sync-cycle';

const SYNC_STATE_FIELDS = [
	'syncStatus',
	'emailSentStatus',
	'brevoSyncStatus',
	'emailStatusMessage',
	'brevoStatusMessage',
	'databaseStatusMessage'
] as const;

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

export function applyLocalClearMarker(value: string | null) {
	if (!value) {
		localStorage.removeItem(CLEAR_MARKER_KEY);
		localStorage.removeItem(SYNC_CURSOR_KEY);
		return;
	}
	setLocalClearMarker(value);
	setSyncCursor(null);
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

	try {
		await api.post('/device/register', {
			deviceIdentifier: getDeviceId(),
			eventId: 1
		});
		deviceRegistered = true;
	} catch {
		// Keep sync flow alive even if registration is temporarily unavailable.
		deviceRegistered = false;
	}
}

function getSyncCursor(): string | null {
	return localStorage.getItem(SYNC_CURSOR_KEY);
}

function setSyncCursor(value: string | null) {
	if (!value) {
		localStorage.removeItem(SYNC_CURSOR_KEY);
		return;
	}
	localStorage.setItem(SYNC_CURSOR_KEY, value);
}

function getLocalClearMarker(): string | null {
	return localStorage.getItem(CLEAR_MARKER_KEY);
}

function setLocalClearMarker(value: string) {
	localStorage.setItem(CLEAR_MARKER_KEY, value);
}

function hasNewClearMarker(remote: string | null | undefined, local: string | null) {
	if (!remote) return false;
	if (!local) return true;

	const remoteTs = new Date(remote).getTime();
	const localTs = new Date(local).getTime();

	if (Number.isNaN(remoteTs) || Number.isNaN(localTs)) {
		return remote !== local;
	}

	return remoteTs > localTs;
}

function hasSyncStateChanged(before: LocalLead | null | undefined, after: LocalLead) {
	return SYNC_STATE_FIELDS.some((field) => {
		const beforeValue = before?.[field] ?? null;
		const afterValue = after[field] ?? null;
		return beforeValue !== afterValue;
	});
}

async function pushPendingLeads(options: SyncOptions = {}) {
	const baseLeads = await db.leads.pendingList(25);
	const disabledBrevoLeads = options.retryDisabledBrevo ? await db.leads.brevoDisabledList(25) : [];
	const leadMap = new Map<string, LocalLead>();

	for (const lead of baseLeads) {
		leadMap.set(lead.uuid, lead as LocalLead);
	}
	for (const lead of disabledBrevoLeads) {
		leadMap.set(lead.uuid, {
			...(lead as LocalLead),
			brevoSyncStatus: 'pending'
		});
	}

	const leads = Array.from(leadMap.values()).slice(0, 25);
	if (!leads.length) {
		setSyncHealth({ lastPushAt: new Date().toISOString() });
		return 0;
	}

	let changedCount = 0;

	for (const lead of leads) {
		try {
			await db.leads.put({
				...lead,
				syncStatus: 'syncing'
			});
			const resp = await api.post<{ synced?: SyncItem[] }>('/leads/batch', { leads: [lead] });
			const remote = (resp.synced || [])[0];
			const now = new Date().toISOString();
			const nextLead = {
				...lead,
				syncStatus: remote?.syncStatus || 'failed',
				emailSentStatus: remote?.emailSentStatus || lead.emailSentStatus || 'pending',
				brevoSyncStatus: remote?.brevoSyncStatus || lead.brevoSyncStatus || 'disabled',
				databaseStatusMessage:
					remote?.syncError || (remote?.syncStatus === 'synced' ? 'Saved to server database.' : 'Database sync failed.'),
				emailStatusMessage:
					remote?.emailError || (remote?.emailSentStatus === 'sent' ? 'Email sent successfully.' : undefined),
				brevoStatusMessage:
					remote?.brevoError
					|| (remote?.brevoSyncStatus === 'synced'
						? 'Synced to Brevo contact list.'
						: remote?.brevoSyncStatus === 'disabled'
							? 'Brevo integration is disabled on the API.'
							: undefined)
			} as LocalLead;

			if (hasSyncStateChanged(lead as LocalLead, nextLead)) {
				await db.leads.put({
					...nextLead,
					lastSyncedAt: now,
					updatedAt: lead.updatedAt || lead.createdAt
				});
				changedCount += 1;
			}
		} catch (error) {
			const nextLead = {
				...lead,
				syncStatus: 'failed',
				emailSentStatus: lead.emailSentStatus || 'pending',
				brevoSyncStatus: lead.brevoSyncStatus || 'disabled',
				databaseStatusMessage: error instanceof Error ? error.message : 'Could not reach API during sync.'
			} as LocalLead;

			if (hasSyncStateChanged(lead as LocalLead, nextLead)) {
				await db.leads.put({
					...nextLead,
					updatedAt: lead.updatedAt || lead.createdAt
				});
				changedCount += 1;
			}
		}
	}

	setSyncHealth({ lastPushAt: new Date().toISOString() });
	return changedCount;
}

async function pullRemoteChanges() {
	const clearMarkerResp = await api.get<{ clearedAt?: string | null }>('/sync/clear-marker').catch(() => ({ clearedAt: null }));
	const remoteClearMarker = clearMarkerResp?.clearedAt || null;
	const localClearMarker = getLocalClearMarker();
	let changedCount = 0;

	if (hasNewClearMarker(remoteClearMarker, localClearMarker)) {
		await db.leads.clear();
		setSyncCursor(null);
		setLocalClearMarker(remoteClearMarker as string);
		changedCount += 1;
	}

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

		const nextLead = {
			...remote,
			syncStatus: remote.syncStatus || 'synced',
			emailSentStatus: remote.emailSentStatus || 'pending',
			brevoSyncStatus: remote.brevoSyncStatus || 'pending',
			emailStatusMessage: (remote as LocalLead).emailStatusMessage,
			brevoStatusMessage: (remote as LocalLead).brevoStatusMessage,
			databaseStatusMessage: (remote as LocalLead).databaseStatusMessage,
			updatedAt: remote.updatedAt || remote.createdAt || new Date().toISOString()
		} as LocalLead;

		if (!local || hasSyncStateChanged(local as LocalLead, nextLead)) {
			await db.leads.put(nextLead);
			changedCount += 1;
		}
	}

	if (response.nextCursor) {
		setSyncCursor(response.nextCursor);
	}

	setSyncHealth({ lastPullAt: new Date().toISOString() });
	return changedCount;
}

export async function syncNow(options: SyncOptions = {}) {
	if (running) return false;
	if (!navigator.onLine) {
		setSyncHealth({
			lastRunAt: new Date().toISOString(),
			lastError: 'Offline. Leads are queued and will retry when back online.'
		});
		window.dispatchEvent(new CustomEvent(CYCLE_EVENT, { detail: { changed: false } }));
		return false;
	}

	running = true;
	let hasChanges = false;
	setSyncHealth({ lastRunAt: new Date().toISOString() });
	try {
		await registerDevice();
		const pushChanges = await pushPendingLeads(options);
		const pullChanges = await pullRemoteChanges();
		hasChanges = (pushChanges + pullChanges) > 0;
		setSyncHealth({
			lastSuccessAt: new Date().toISOString(),
			lastError: null
		});
	} catch (error) {
		const queued = await db.leads.syncingList();
		hasChanges = queued.length > 0;
		await db.leads.bulkPut(
			queued.map((l: LocalLead) => ({
				...l,
				syncStatus: 'failed',
				emailSentStatus: (l.emailSentStatus as string) || 'pending',
				brevoSyncStatus: (l.brevoSyncStatus as string) || 'disabled',
				updatedAt: l.updatedAt || l.createdAt
			}))
		);
		setSyncHealth({
			lastError: error instanceof Error
				? error.message
				: 'Sync failed. Check network or API health endpoints.'
		});
	} finally {
		running = false;
		window.dispatchEvent(new CustomEvent(CYCLE_EVENT, { detail: { changed: hasChanges } }));
	}

	return hasChanges;
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

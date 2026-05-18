const base = '/api';

async function parseResponse(r: Response) {
	const contentType = r.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		return r.json().catch(() => ({}));
	}
	return r.text().catch(() => '');
}

export const api = {
	get: async (p: string) => {
		const r = await fetch(`${base}${p}`);
		const body = await parseResponse(r);
		if (!r.ok) throw new Error(typeof body === 'string' ? body || `HTTP ${r.status}` : `HTTP ${r.status}`);
		return body;
	},
	post: async (p: string, b: any) => {
		const r = await fetch(`${base}${p}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(b)
		});
		const body = await parseResponse(r);
		if (!r.ok) throw new Error(typeof body === 'string' ? body || `HTTP ${r.status}` : `HTTP ${r.status}`);
		return body;
	}
};

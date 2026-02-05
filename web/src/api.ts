export async function apiGet<T>(url: string, opts?: { devPhone?: string }): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts?.devPhone) headers["x-dev-phone"] = opts.devPhone;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(
  url: string,
  body: unknown,
  opts?: { devPhone?: string }
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.devPhone) headers["x-dev-phone"] = opts.devPhone;

  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

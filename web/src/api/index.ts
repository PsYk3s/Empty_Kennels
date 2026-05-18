const BASE_URL = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public url: string,
    message?: string
  ) {
    super(message || `API Error: ${status}`);
  }
}

async function fetchWithErrorHandling(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => '');

    if (!response.ok) {
      throw new ApiError(
        response.status,
        url,
        (isJson && typeof body === 'object' && body && 'error' in body
          ? String((body as { error?: string }).error)
          : typeof body === 'string' && body.trim()
            ? body
            : `HTTP ${response.status}`)
      );
    }

    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

export const api = {
  get: <T = any>(url: string) => fetchWithErrorHandling(url) as Promise<T>,

  post: <T = any>(url: string, body: any) =>
    fetchWithErrorHandling(url, {
      method: 'POST',
      body: JSON.stringify(body),
    }) as Promise<T>,

  patch: <T = any>(url: string, body: any) =>
    fetchWithErrorHandling(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }) as Promise<T>,
};

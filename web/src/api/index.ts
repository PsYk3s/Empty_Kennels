const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        url,
        errorData.error || `HTTP ${response.status}`
      );
    }

    return response.json();
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

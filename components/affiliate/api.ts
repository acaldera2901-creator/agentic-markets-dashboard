// components/affiliate/api.ts — #AFFILIATE-V2-UI-1015
// fetch con esito uniforme: mai un'eccezione al chiamante. status 0 = rete/parse.
export type ApiResult<T> = { status: number; ok: boolean; data: T | null };

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
      headers: init?.body ? { "content-type": "application/json", ...(init.headers ?? {}) } : init?.headers,
    });
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    return { status: res.status, ok: res.ok, data };
  } catch {
    return { status: 0, ok: false, data: null };
  }
}

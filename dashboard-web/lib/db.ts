import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = getClient();
  if (!db) return [];
  try {
    const { data, error } = await db.rpc("exec_sql", { query: interpolate(sql, params) });
    if (error) throw error;
    return (data as T[]) ?? [];
  } catch (e) {
    console.error("[db] query error:", String(e));
    return [];
  }
}

function interpolate(sql: string, params: unknown[]): string {
  if (!params.length) return sql;
  return sql.replace(/\$(\d+)/g, (_, n) => {
    const val = params[Number(n) - 1];
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "number") return String(val);
    if (typeof val === "boolean") return val ? "true" : "false";
    return "'" + String(val).replace(/'/g, "''") + "'";
  });
}

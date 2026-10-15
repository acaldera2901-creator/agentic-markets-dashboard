// lib/affiliate/rpc.ts — #AFFILIATE-V2-CRYPTO-1007
// Chiamata alle funzioni SQL del programma affiliati (migration 20261015*).
// Servono dove `exec_sql` non basta: transazioni su più tabelle con lock e un
// esito da leggere (exec_sql non restituisce né RETURNING né il rowcount).
// Fail-loud come dbExecute: un errore del DB non diventa mai un "ok".

import { getSupabaseAdminClient } from "@/lib/db";

export type RpcResult = { ok: boolean; error?: string; [k: string]: unknown };

export async function affiliateRpc<T extends RpcResult = RpcResult>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("[affiliate-rpc] Supabase admin client not configured");
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`[affiliate-rpc] ${fn}: ${error.message ?? String(error)}`);
  if (!data || typeof data !== "object" || typeof (data as RpcResult).ok !== "boolean") {
    throw new Error(`[affiliate-rpc] ${fn}: unexpected result`);
  }
  return data as T;
}

import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkspaceStateRow = {
  user_id: string;
  state: Record<string, unknown>;
  revision: number;
  updated_at: string;
};

export async function fetchMyWorkspaceState(client: SupabaseClient) {
  const { data, error } = await client.rpc('get_my_workspace_state');
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as WorkspaceStateRow | null;
  return row;
}

export async function upsertMyWorkspaceState(
  client: SupabaseClient,
  state: Record<string, unknown>,
) {
  const { data, error } = await client.rpc('upsert_my_workspace_state', { p_state: state });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as WorkspaceStateRow;
}

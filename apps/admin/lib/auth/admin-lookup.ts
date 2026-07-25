import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminLookupRow {
  id: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

/** True when the error is Postgres complaining about a column we asked for. */
function isMissingColumn(message: string | undefined, column: string): boolean {
  return !!message && message.includes(column) && /column|does not exist/i.test(message);
}

/**
 * Look an admin up by email for the password-reset flow.
 *
 * Matched case-insensitively — `admin_users.email` is stored as typed, and
 * people don't retype their address with the same casing.
 *
 * Degrades gracefully until migration 067 adds `admin_users.phone`: without the
 * column every admin simply reads as having no mobile, so resets fall back to
 * the email recovery link instead of the endpoint 500ing.
 */
export async function findAdminByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<AdminLookupRow | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, phone, is_active')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (!error) return (data as AdminLookupRow | null) ?? null;

  if (!isMissingColumn(error.message, 'phone')) return null;

  console.warn('[admin-lookup] admin_users.phone missing (apply migration 067):', error.message);

  const { data: fallback } = await supabase
    .from('admin_users')
    .select('id, email, is_active')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  return fallback ? { ...(fallback as Omit<AdminLookupRow, 'phone'>), phone: null } : null;
}

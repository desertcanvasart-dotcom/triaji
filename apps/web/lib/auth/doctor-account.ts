import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface DoctorAccountRow {
  id: string;
  doctor_id: string | null;
  name_ar: string;
  clinic_mode: 'independent' | 'own_clinic' | 'existing_clinic' | null;
  verification_status: 'pending' | 'verified' | 'rejected' | 'suspended';
}

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Resolve the signed-in doctor from the session cookie (or bearer header).
 *
 * Unlike the older per-route helpers this does NOT require a verified account:
 * document upload is exactly the thing a *pending* doctor needs to do. Pass
 * `requireVerified` when a route should stay closed until approval.
 */
export async function authenticateDoctorAccount(
  request: NextRequest,
  opts: { requireVerified?: boolean } = {}
): Promise<DoctorAccountRow | null> {
  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const {
    data: { user },
    error,
  } = await getAnonClient().auth.getUser(accessToken);
  if (error || !user) return null;

  const { data: account } = await getServiceClient()
    .from('doctor_accounts')
    .select('id, doctor_id, name_ar, clinic_mode, verification_status')
    .eq('id', user.id)
    .single();

  if (!account) return null;
  if (opts.requireVerified && account.verification_status !== 'verified') return null;

  return account as DoctorAccountRow;
}

export { getServiceClient as getDoctorServiceClient };

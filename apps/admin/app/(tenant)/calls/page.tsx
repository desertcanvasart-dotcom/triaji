import { requireAdmin } from '@/lib/auth/session';
import { isPlatformAdmin } from '@/lib/auth/types';
import { createAdminClient } from '@/lib/supabase/server';
import CallLogClient from './CallLogClient';
import CallbacksPanel from './CallbacksPanel';
import EnglishToggle from './EnglishToggle';

export interface CallbackRow {
  id: string;
  tenant_id: string | null;
  patient_phone: string;
  trigger_reason: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  scheduled_for: string;
  last_attempted_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface CallRow {
  id: string;
  session_start: string;
  call_duration_seconds: number | null;
  status: string;
  emergency_triggered: boolean;
  handoff_triggered: boolean;
  handoff_reason: string | null;
  recording_url: string | null;
  transcript_full: string | null;
  booking_id: string | null;
  chief_complaint_ar: string | null;
  call_sid: string | null;
  phone_number: string | null;
  specialty_name_ar: string | null;
  specialty_name_en: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
}

interface TenantOption {
  id: string;
  name: string;
}

export default async function CallLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();
  const isGlobalAdmin = isPlatformAdmin(admin.role);

  const params = await searchParams;
  const tenantFilter = typeof params['tenant'] === 'string' ? params['tenant'] : undefined;

  // Determine which tenant(s) to query
  const activeTenantId = isGlobalAdmin ? tenantFilter : admin.tenant_id;

  // Fetch tenants list for platform admin filter
  let tenants: TenantOption[] = [];
  if (isGlobalAdmin) {
    const { data: tenantRows } = await supabase
      .from('tenants')
      .select('id, name')
      .order('name');
    tenants = (tenantRows ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
    }));
  }

  // Build the call log query
  let query = supabase
    .from('triage_sessions')
    .select(`
      id,
      session_start,
      call_duration_seconds,
      status,
      emergency_triggered,
      handoff_triggered,
      handoff_reason,
      recording_url,
      transcript_full,
      booking_id,
      chief_complaint_ar,
      call_sid,
      tenant_id,
      patients!left ( phone_number ),
      specialties!left ( name_ar, name_en )
    `)
    .eq('channel', 'phone_call')
    .order('session_start', { ascending: false })
    .limit(50);

  if (activeTenantId) {
    query = query.eq('tenant_id', activeTenantId);
  }

  const { data: rawCalls } = await query;

  // If platform admin, also fetch tenant names for display
  let tenantNameMap: Record<string, string> = {};
  if (isGlobalAdmin && rawCalls && rawCalls.length > 0) {
    const tenantIds = [...new Set(rawCalls.map((c) => c.tenant_id).filter(Boolean))];
    if (tenantIds.length > 0) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds);
      if (tenantData) {
        tenantNameMap = Object.fromEntries(
          tenantData.map((t) => [t.id, t.name as string])
        );
      }
    }
  }

  // Fetch callback queue
  let callbackQuery = supabase
    .from('callback_queue')
    .select('id, tenant_id, patient_phone, trigger_reason, status, attempt_count, max_attempts, scheduled_for, last_attempted_at, completed_at, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (activeTenantId) {
    callbackQuery = callbackQuery.eq('tenant_id', activeTenantId);
  }

  const { data: rawCallbacks } = await callbackQuery;

  const callbacks: CallbackRow[] = (rawCallbacks ?? []).map((row) => ({
    id: row.id as string,
    tenant_id: row.tenant_id as string | null,
    patient_phone: row.patient_phone as string,
    trigger_reason: row.trigger_reason as string,
    status: row.status as string,
    attempt_count: row.attempt_count as number,
    max_attempts: row.max_attempts as number,
    scheduled_for: row.scheduled_for as string,
    last_attempted_at: row.last_attempted_at as string | null,
    completed_at: row.completed_at as string | null,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
  }));

  const pendingCallbackCount = callbacks.filter(
    (cb) => cb.status === 'scheduled' || cb.status === 'attempting'
  ).length;

  // Fetch english_enabled for the active tenant (only for tenant-scoped view)
  let englishEnabled = false;
  if (activeTenantId) {
    const { data: tenantConfig } = await supabase
      .from('tenant_config')
      .select('english_enabled')
      .eq('tenant_id', activeTenantId)
      .single();
    englishEnabled = (tenantConfig?.english_enabled as boolean) ?? false;
  }

  // Normalize the joined data into flat rows
  const calls: CallRow[] = (rawCalls ?? []).map((row) => {
    const patient = row.patients as { phone_number: string } | null;
    const specialty = row.specialties as { name_ar: string; name_en: string } | null;

    return {
      id: row.id as string,
      session_start: row.session_start as string,
      call_duration_seconds: row.call_duration_seconds as number | null,
      status: row.status as string,
      emergency_triggered: (row.emergency_triggered as boolean) ?? false,
      handoff_triggered: (row.handoff_triggered as boolean) ?? false,
      handoff_reason: row.handoff_reason as string | null,
      recording_url: row.recording_url as string | null,
      transcript_full: row.transcript_full as string | null,
      booking_id: row.booking_id as string | null,
      chief_complaint_ar: row.chief_complaint_ar as string | null,
      call_sid: row.call_sid as string | null,
      phone_number: patient?.phone_number ?? null,
      specialty_name_ar: specialty?.name_ar ?? null,
      specialty_name_en: specialty?.name_en ?? null,
      tenant_id: row.tenant_id as string | null,
      tenant_name: tenantNameMap[row.tenant_id as string] ?? null,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Call Log</h1>
        {pendingCallbackCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
            {pendingCallbackCount} callback{pendingCallbackCount > 1 ? 's' : ''} pending
          </span>
        )}
      </div>
      {activeTenantId && (
        <EnglishToggle tenantId={activeTenantId} initialEnabled={englishEnabled} />
      )}
      <CallbacksPanel callbacks={callbacks} />
      <CallLogClient
        calls={calls}
        isGlobalAdmin={isGlobalAdmin}
        tenants={tenants}
        currentTenantFilter={tenantFilter ?? ''}
      />
    </div>
  );
}

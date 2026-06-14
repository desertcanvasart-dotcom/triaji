import { createAdminClient } from '../supabase/server';

export async function assignQueueNumber(
  tenantId: string,
  doctorId: string,
  date?: string
): Promise<number> {
  const supabase = createAdminClient();
  const queueDate = date ?? new Date().toISOString().split('T')[0];

  // Get next number via RPC
  const { data, error } = await supabase.rpc('next_queue_number', {
    p_tenant_id: tenantId,
    p_doctor_id: doctorId,
    p_date: queueDate,
  });

  if (error) throw new Error(`Failed to get queue number: ${error.message}`);
  return data as number;
}

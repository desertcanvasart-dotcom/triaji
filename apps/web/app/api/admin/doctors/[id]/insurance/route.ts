import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

// POST /api/admin/doctors/[id]/insurance — set accepted insurance providers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: doctorId } = await params;
  const body = (await request.json()) as { providerCodes?: string[] };

  if (!body.providerCodes || !Array.isArray(body.providerCodes)) {
    return NextResponse.json({ error: 'providerCodes array is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Get provider IDs for the given codes
  const { data: providers } = await supabase
    .from('insurance_providers')
    .select('id, code')
    .in('code', body.providerCodes)
    .eq('is_active', true);

  if (!providers) {
    return NextResponse.json({ error: 'No valid providers found' }, { status: 400 });
  }

  // Delete existing doctor insurance records
  await supabase
    .from('doctor_insurance')
    .delete()
    .eq('doctor_id', doctorId);

  // Insert new records (skip no_insurance)
  const records = providers
    .filter((p) => (p.code as string) !== 'no_insurance')
    .map((p) => ({
      doctor_id: doctorId,
      insurance_provider_id: p.id as string,
      is_active: true,
    }));

  if (records.length > 0) {
    const { error } = await supabase
      .from('doctor_insurance')
      .insert(records);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Also update the legacy insurance_providers text array on the doctor
  await supabase
    .from('doctors')
    .update({
      accepts_insurance: records.length > 0,
      insurance_providers: body.providerCodes.filter((c) => c !== 'no_insurance'),
    })
    .eq('id', doctorId);

  return NextResponse.json({ success: true, count: records.length });
}

// GET /api/admin/doctors/[id]/insurance — get accepted insurance providers
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: doctorId } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('doctor_insurance')
    .select('insurance_provider_id, insurance_providers(code, name_ar, name_en, type)')
    .eq('doctor_id', doctorId)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    providers: (data ?? []).map((d) => d.insurance_providers),
  });
}

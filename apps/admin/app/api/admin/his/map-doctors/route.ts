/**
 * POST /api/admin/his/map-doctors — Save doctor ID mappings
 * Maps Triajji doctor IDs to HIS doctor IDs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface DoctorMapping {
  doctorId: string;
  hisDoctorId: string | null;
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;

  if (!admin.tenant_id) {
    return NextResponse.json(
      { error: 'Platform admins must specify a tenant context' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const mappings = body['mappings'] as DoctorMapping[] | undefined;

  if (!mappings || !Array.isArray(mappings)) {
    return NextResponse.json(
      { error: 'Missing required field: mappings (array of {doctorId, hisDoctorId})' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let updated = 0;
  const errors: string[] = [];

  for (const mapping of mappings) {
    if (!mapping.doctorId) {
      errors.push('Missing doctorId in mapping');
      continue;
    }

    const { error } = await supabase
      .from('doctors')
      .update({ his_doctor_id: mapping.hisDoctorId })
      .eq('id', mapping.doctorId)
      .eq('tenant_id', admin.tenant_id);

    if (error) {
      errors.push(`Failed to map doctor ${mapping.doctorId}: ${error.message}`);
    } else {
      updated++;
    }
  }

  return NextResponse.json({
    message: `${updated} doctor(s) mapped successfully`,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  });
}

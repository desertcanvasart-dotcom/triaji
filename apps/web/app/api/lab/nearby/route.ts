import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

export const dynamic = 'force-dynamic';

// ─── GET /api/lab/nearby ────────────────────────────────────────────────────
// Public endpoint — returns nearby labs/radiology centers
// Query params: service_type (lab_test|radiology), governorate_id (optional)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('service_type');
    const governorateId = searchParams.get('governorate_id');

    // Map service_type to tenant tier
    let tierFilter: string[];
    if (serviceType === 'lab_test') {
      tierFilter = ['lab'];
    } else if (serviceType === 'radiology') {
      tierFilter = ['radiology'];
    } else {
      // Return both if not specified
      tierFilter = ['lab', 'radiology'];
    }

    const supabase = createServerClient();

    // Build query for tenants
    let query = supabase
      .from('tenants')
      .select(`
        id,
        name_ar,
        name_en,
        slug,
        logo_url,
        tier,
        address_ar,
        address_en,
        phone,
        governorate_id,
        tenant_config (
          accepts_walk_ins,
          turnaround_hours,
          home_collection,
          home_collection_fee_egp,
          opening_time,
          closing_time,
          lab_type,
          accreditation_number
        )
      `)
      .in('tier', tierFilter)
      .eq('is_active', true);

    if (governorateId) {
      query = query.eq('governorate_id', governorateId);
    }

    const { data: labs, error } = await query.order('name_ar', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'فشل في جلب المعامل' },
        { status: 500 }
      );
    }

    return NextResponse.json({ labs: labs ?? [] });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

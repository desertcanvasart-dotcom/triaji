import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * The signed-in admin's own profile.
 *
 * Deliberately takes no id — every read and write is scoped to
 * `authResult.admin.id`, so any admin role can manage their own mobile without
 * this becoming a way to touch someone else's. Editing another user's number
 * stays platform-admin only, on /api/admin/users.
 */

interface ProfileBody {
  phone?: string | null;
}

/** GET /api/admin/auth/profile — own name, email, role and mobile */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('admin_users')
    .select('phone')
    .eq('id', admin.id)
    .maybeSingle();

  // Degrades until migration 067 adds the column.
  const phone = error ? null : ((data?.phone as string | null) ?? null);
  if (error && !/phone/.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    phone,
    migration_pending: !!error,
  });
}

/** PATCH /api/admin/auth/profile — set or clear own mobile */
export async function PATCH(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;

  let body: ProfileBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.phone === undefined) {
    return NextResponse.json({ error: 'phone is required.' }, { status: 400 });
  }

  const phone = body.phone?.trim() || null;
  if (phone && !/^01[0125]\d{8}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Mobile must be an Egyptian number starting 010, 011, 012 or 015.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from('admin_users')
    .update({ phone })
    .eq('id', admin.id)
    .select('phone')
    .maybeSingle();

  if (error) {
    if (/phone/.test(error.message)) {
      return NextResponse.json(
        { error: 'Mobile numbers need migration 067 applied to the database first.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, phone: updated?.phone ?? null });
}

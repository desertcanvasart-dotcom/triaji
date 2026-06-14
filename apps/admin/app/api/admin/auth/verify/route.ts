import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = await authenticateAdmin(request);

  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.json({
    role: result.admin.role,
    name: result.admin.name,
    tenant_id: result.admin.tenant_id,
  });
}

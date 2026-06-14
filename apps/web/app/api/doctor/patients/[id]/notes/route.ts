import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Supabase helpers ───────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
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

async function authenticateDoctor(request: NextRequest): Promise<DoctorAccount | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── GET /api/doctor/patients/[id]/notes ────────────────────────────────────
// Fetch GP freestanding notes for a patient.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: patientId } = await params;
    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Verify GP relationship
    const { data: gpRel } = await supabase
      .from('gp_relationships')
      .select('id')
      .eq('doctor_account_id', doctorAccount.id)
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .maybeSingle();

    if (!gpRel) {
      return NextResponse.json({ error: 'No GP relationship with this patient' }, { status: 403 });
    }

    const { data: notes, error: notesError } = await supabase
      .from('gp_notes')
      .select('id, note_ar, note_en, created_at, doctor_account_id')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (notesError) {
      console.error('[doctor/patients/notes] Query error:', notesError.message);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({ notes: notes ?? [] });
  } catch (err) {
    console.error('[doctor/patients/notes] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/doctor/patients/[id]/notes ───────────────────────────────────
// Create a GP freestanding note. Body: { note_ar, note_en? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: patientId } = await params;
    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    let body: { note_ar?: string; note_en?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { note_ar, note_en } = body;

    if (!note_ar || note_ar.trim().length === 0) {
      return NextResponse.json({ error: 'note_ar is required' }, { status: 400 });
    }

    if (note_ar.trim().length > 5000) {
      return NextResponse.json({ error: 'Note too long (max 5000 characters)' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Verify GP relationship
    const { data: gpRel } = await supabase
      .from('gp_relationships')
      .select('id')
      .eq('doctor_account_id', doctorAccount.id)
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .maybeSingle();

    if (!gpRel) {
      return NextResponse.json({ error: 'No GP relationship with this patient' }, { status: 403 });
    }

    // Insert the note
    const { data: note, error: insertError } = await supabase
      .from('gp_notes')
      .insert({
        patient_id: patientId,
        doctor_account_id: doctorAccount.id,
        note_ar: note_ar.trim(),
        note_en: note_en?.trim() || null,
        created_at: new Date().toISOString(),
      })
      .select('id, note_ar, note_en, created_at')
      .single();

    if (insertError) {
      console.error('[doctor/patients/notes] Insert error:', insertError.message);
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
    }

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (err) {
    console.error('[doctor/patients/notes] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

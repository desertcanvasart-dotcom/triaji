/**
 * POST /api/lab/chains/[code]/book
 *
 * Books an appointment slot at a lab chain.
 *
 * Body:
 *   - orderId: lab_order_routing ID (optional)
 *   - slotId: slot ID from getAvailableSlots()
 *   - patientName: patient display name
 *   - patientPhone: phone number (e.g. 01xxxxxxxxx)
 *   - patientDOB?: date of birth (ISO date)
 *   - patientSex?: 'male' | 'female'
 *
 * Creates a lab_appointments record and sends WhatsApp confirmation.
 *
 * Auth: patient (via cookie or Authorization header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getLabChainAdapter,
  isChainApiAvailable,
  type LabChainCode,
} from '@triaji/lab-chain-adapters';
import { notifyPatientChainBooking } from '@/lib/lab/chain-notifications';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticatePatient(request: NextRequest): Promise<string | null> {
  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;
  return user.id;
}

const VALID_CHAIN_CODES = new Set<string>(['alborg', 'almokhtabar', 'alfa']);

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookRequestBody {
  orderId?: string;
  slotId: string;
  patientName: string;
  patientPhone: string;
  patientDOB?: string;
  patientSex?: 'male' | 'female';
  testCodes?: string[];
  lang?: 'ar' | 'en';
}

// ─── POST ───────────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Authenticate patient
    const userId = await authenticatePatient(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Validate chain code
    const { code } = await context.params;
    if (!VALID_CHAIN_CODES.has(code)) {
      return NextResponse.json(
        { error: `Invalid chain code: ${code}` },
        { status: 400 }
      );
    }

    const chainCode = code as LabChainCode;

    // 3. Check API availability
    if (!isChainApiAvailable(chainCode)) {
      return NextResponse.json(
        { error: 'Chain API is not available' },
        { status: 503 }
      );
    }

    // 4. Parse body
    const body = (await request.json()) as BookRequestBody;

    if (!body.slotId || !body.patientName || !body.patientPhone) {
      return NextResponse.json(
        { error: 'slotId, patientName, and patientPhone are required' },
        { status: 400 }
      );
    }

    // 5. Call adapter to book
    const adapter = getLabChainAdapter(chainCode);
    const bookingResult = await adapter.bookAppointment({
      slotId: body.slotId,
      patient: {
        name: body.patientName,
        phone: body.patientPhone,
        dateOfBirth: body.patientDOB,
        gender: body.patientSex,
      },
      testCodes: body.testCodes ?? [],
      orderId: body.orderId,
    });

    if (!bookingResult.success) {
      return NextResponse.json(
        { error: bookingResult.error ?? 'Booking failed at the lab chain' },
        { status: 502 }
      );
    }

    // 6. Create lab_appointments record
    const supabase = getServiceClient();

    const { data: appointment, error: dbError } = await supabase
      .from('lab_appointments')
      .insert({
        user_id: userId,
        chain_code: chainCode,
        chain_booking_id: bookingResult.bookingId,
        chain_confirmation_code: bookingResult.confirmationCode,
        slot_id: body.slotId,
        patient_name: body.patientName,
        patient_phone: body.patientPhone,
        patient_dob: body.patientDOB ?? null,
        patient_sex: body.patientSex ?? null,
        order_id: body.orderId ?? null,
        test_codes: body.testCodes ?? [],
        branch_name: bookingResult.branchName ?? null,
        appointment_date: bookingResult.date ?? null,
        appointment_time: bookingResult.time ?? null,
        home_collection: false,
        status: 'confirmed',
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[lab-chain-book] db error:', dbError.message);
      // Booking was successful at chain level even if DB fails.
      // Log but don't fail — the patient has a confirmation code.
    }

    // 7. Send WhatsApp confirmation
    const lang = body.lang ?? 'ar';
    try {
      await notifyPatientChainBooking(body.patientPhone, lang, {
        chainCode,
        confirmationCode: bookingResult.confirmationCode ?? bookingResult.bookingId ?? '',
        branchName: bookingResult.branchName,
        date: bookingResult.date ?? new Date().toISOString(),
        time: bookingResult.time,
        homeCollection: false,
        testNames: body.testCodes,
      });
    } catch (whatsappErr) {
      console.error('[lab-chain-book] WhatsApp error:', whatsappErr);
      // Non-blocking — booking is still valid
    }

    return NextResponse.json({
      success: true,
      bookingId: bookingResult.bookingId,
      confirmationCode: bookingResult.confirmationCode,
      branchName: bookingResult.branchName,
      appointmentDate: bookingResult.date,
      appointmentTime: bookingResult.time,
      homeCollection: false,
      appointmentId: appointment?.id ?? null,
    });
  } catch (err) {
    console.error('[lab-chain-book] unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to book appointment' },
      { status: 500 }
    );
  }
}

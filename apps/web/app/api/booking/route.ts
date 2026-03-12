import { NextRequest, NextResponse } from 'next/server';
import { createBooking, SlotTakenError, SlotNotFoundError } from '@/lib/booking/engine';

interface BookingRequestBody {
  sessionId: string;
  doctorId: string;
  slotId: string;
  patientName: string;
  phoneNumber: string;
  notes?: string;
}

/**
 * Validate Egyptian phone number format: 010/011/012/015 + 8 digits = 11 digits
 */
function isValidEgyptianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(010|011|012|015)\d{8}$/.test(cleaned);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BookingRequestBody;
    const { sessionId, doctorId, slotId, patientName, phoneNumber, notes } = body;

    // Validate required fields
    if (!sessionId || !doctorId || !slotId || !patientName || !phoneNumber) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة: sessionId, doctorId, slotId, patientName, phoneNumber' },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!isValidEgyptianPhone(phoneNumber)) {
      return NextResponse.json(
        { error: 'من فضلك أدخل رقم موبايل مصري صحيح' },
        { status: 400 }
      );
    }

    // Validate patient name
    if (patientName.trim().length < 2) {
      return NextResponse.json(
        { error: 'من فضلك أدخل اسمك بالكامل' },
        { status: 400 }
      );
    }

    const result = await createBooking({
      sessionId,
      doctorId,
      slotId,
      patientName: patientName.trim(),
      phoneNumber: phoneNumber.trim(),
      notes,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof SlotNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }

    console.error('[POST /api/booking] Error:', err);
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

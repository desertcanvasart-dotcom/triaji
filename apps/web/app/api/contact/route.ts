import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, subject, message, email } = body as {
      name: string;
      phone: string;
      subject: string;
      message: string;
      email?: string;
    };

    if (!name || !phone || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Log the contact form submission
    console.log('[Contact] New message:', { name, phone, email, subject, message: message.slice(0, 100) });

    // In production, this would:
    // 1. Send email to support@triajji.com
    // 2. Send WhatsApp acknowledgement to the patient
    // 3. Store in a contact_messages table

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to process contact form' }, { status: 500 });
  }
}

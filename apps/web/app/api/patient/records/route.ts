/**
 * GET  /api/patient/records — list patient's health records
 * POST /api/patient/records — upload + trigger analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { createServerClient } from '@triaji/shared/supabase';
import { analyseHealthRecord } from '@/lib/records/analyser';
import type { RecordType } from '@/lib/records/types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ─── GET: List records ──────────────────────────────────────────────────────

export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('health_records')
    .select('*')
    .eq('patient_id', patient.patientId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ records: data ?? [] });
}

// ─── POST: Upload + analyse ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const recordType = formData.get('recordType') as RecordType | null;
  const sessionId = formData.get('sessionId') as string | null;

  if (!file || !recordType) {
    return NextResponse.json(
      { error: 'file and recordType are required' },
      { status: 400 }
    );
  }

  // Validate file
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'يُسمح فقط بصور JPEG/PNG/WebP أو ملفات PDF' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'حجم الملف أكبر من 20 ميجابايت' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Generate unique storage path
  const ext = file.name.split('.').pop() ?? 'bin';
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const storagePath = `${patient.patientId}/${recordType}/${timestamp}-${randomId}.${ext}`;

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('health-records')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `فشل رفع الملف: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Create health_records row
  const { data: record, error: insertError } = await supabase
    .from('health_records')
    .insert({
      patient_id: patient.patientId,
      session_id: sessionId ?? null,
      record_type: recordType,
      file_url: storagePath,
      file_name: file.name,
      mime_type: file.type,
    })
    .select()
    .single();

  if (insertError || !record) {
    return NextResponse.json(
      { error: `فشل حفظ السجل: ${insertError?.message ?? 'unknown'}` },
      { status: 500 }
    );
  }

  // Trigger AI analysis in background
  analyseHealthRecord(record.id as string).catch((err) => {
    console.error('[Records] Analysis failed:', err);
  });

  return NextResponse.json({ record }, { status: 201 });
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/doctors/csv-template — download CSV template */
export function GET() {
  const headers = [
    'name_ar',
    'name_en',
    'specialty',
    'governorate',
    'consultation_fee_egp',
    'languages',
    'bio_ar',
    'title_ar',
    'latitude',
    'longitude',
  ];

  const exampleRow = [
    'د. أحمد محمد علي حسن',
    'Dr. Ahmed Mohamed',
    'Cardiology',
    'Cairo',
    '400',
    'ar,en',
    'استشاري أمراض القلب والأوعية الدموية',
    'د.',
    '30.0444',
    '31.2357',
  ];

  const csv = [headers.join(','), exampleRow.join(',')].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="doctors-template.csv"',
    },
  });
}

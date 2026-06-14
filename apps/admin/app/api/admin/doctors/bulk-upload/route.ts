import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface CsvRow {
  name_ar: string;
  name_en?: string;
  specialty: string;
  governorate: string;
  consultation_fee_egp?: string;
  languages?: string;
  bio_ar?: string;
  title_ar?: string;
  latitude?: string;
  longitude?: string;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]!).map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '')
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] ?? '';
    });
    return row as unknown as CsvRow;
  });
}

/** POST /api/admin/doctors/bulk-upload — upload doctors via CSV */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const supabase = createAdminClient();

  const tenantId =
    admin.role === 'platform_admin' ? null : admin.tenant_id;

  // Parse form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json(
      { error: 'No file provided.' },
      { status: 400 }
    );
  }

  if (!file.name.endsWith('.csv')) {
    return NextResponse.json(
      { error: 'Only CSV files are accepted.' },
      { status: 400 }
    );
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'CSV file is empty or has no data rows.' },
      { status: 400 }
    );
  }

  if (rows.length > 500) {
    return NextResponse.json(
      { error: 'Maximum 500 doctors per upload. Please split into smaller files.' },
      { status: 400 }
    );
  }

  // Fetch reference data for name → ID mapping
  const [specialtiesRes, governoratesRes] = await Promise.all([
    supabase.from('specialties').select('id, name_ar, name_en').eq('is_active', true),
    supabase.from('governorates').select('id, name_ar, name_en, code'),
  ]);

  const specialties = specialtiesRes.data ?? [];
  const governorates = governoratesRes.data ?? [];

  // Build lookup maps (lowercase for case-insensitive matching)
  const specialtyMap = new Map<string, string>();
  for (const s of specialties) {
    specialtyMap.set(s.name_en.toLowerCase(), s.id);
    specialtyMap.set(s.name_ar.toLowerCase(), s.id);
    specialtyMap.set(s.id.toLowerCase(), s.id);
  }

  const governorateMap = new Map<string, string>();
  for (const g of governorates) {
    governorateMap.set(g.name_en.toLowerCase(), g.id);
    governorateMap.set(g.name_ar.toLowerCase(), g.id);
    governorateMap.set(g.code.toLowerCase(), g.id);
    governorateMap.set(g.id.toLowerCase(), g.id);
  }

  // Validate and transform rows
  const errors: RowError[] = [];
  const validDoctors: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2; // +2 for header row + 0-index

    // Required: name_ar
    if (!row.name_ar || row.name_ar.trim().length === 0) {
      errors.push({ row: rowNum, field: 'name_ar', message: 'Arabic name is required.' });
      continue;
    }

    if (row.name_ar.trim().length < 10) {
      errors.push({
        row: rowNum,
        field: 'name_ar',
        message: `Arabic name must be at least 10 characters (got ${row.name_ar.trim().length}).`,
      });
      continue;
    }

    // Required: specialty
    if (!row.specialty || row.specialty.trim().length === 0) {
      errors.push({ row: rowNum, field: 'specialty', message: 'Specialty is required.' });
      continue;
    }

    const specialtyId = specialtyMap.get(row.specialty.trim().toLowerCase());
    if (!specialtyId) {
      errors.push({
        row: rowNum,
        field: 'specialty',
        message: `Unknown specialty "${row.specialty}". Use English or Arabic name.`,
      });
      continue;
    }

    // Required: governorate
    if (!row.governorate || row.governorate.trim().length === 0) {
      errors.push({ row: rowNum, field: 'governorate', message: 'Governorate is required.' });
      continue;
    }

    const governorateId = governorateMap.get(row.governorate.trim().toLowerCase());
    if (!governorateId) {
      errors.push({
        row: rowNum,
        field: 'governorate',
        message: `Unknown governorate "${row.governorate}". Use English name, Arabic name, or 3-letter code.`,
      });
      continue;
    }

    // Optional: consultation_fee_egp
    let fee: number | null = null;
    if (row.consultation_fee_egp && row.consultation_fee_egp.trim()) {
      fee = parseFloat(row.consultation_fee_egp.trim());
      if (isNaN(fee) || fee <= 0) {
        errors.push({
          row: rowNum,
          field: 'consultation_fee_egp',
          message: 'Consultation fee must be a positive number.',
        });
        continue;
      }
    }

    // Optional: languages
    let languages = ['ar'];
    if (row.languages && row.languages.trim()) {
      languages = row.languages
        .split(/[,;|]/)
        .map((l) => l.trim().toLowerCase())
        .filter((l) => ['ar', 'en', 'fr'].includes(l));
      if (languages.length === 0) languages = ['ar'];
    }

    // Optional: location
    let locationData: Record<string, string> = {};
    if (row.latitude && row.longitude) {
      const lat = parseFloat(row.latitude.trim());
      const lng = parseFloat(row.longitude.trim());
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        locationData = {
          location: `SRID=4326;POINT(${lng} ${lat})`,
        };
      }
    }

    validDoctors.push({
      name_ar: row.name_ar.trim(),
      name_en: row.name_en?.trim() || null,
      title_ar: row.title_ar?.trim() || 'د.',
      specialty_id: specialtyId,
      governorate_id: governorateId,
      consultation_fee_egp: fee,
      languages,
      bio_ar: row.bio_ar?.trim() || null,
      ...locationData,
      tenant_id: tenantId,
      is_active: true,
      accepts_new_patients: true,
      available_for_booking: true,
    });
  }

  // Insert valid doctors in batches of 50
  let inserted = 0;
  const insertErrors: string[] = [];

  for (let i = 0; i < validDoctors.length; i += 50) {
    const batch = validDoctors.slice(i, i + 50);
    const { data, error } = await supabase
      .from('doctors')
      .insert(batch)
      .select('id');

    if (error) {
      insertErrors.push(`Batch ${Math.floor(i / 50) + 1}: ${error.message}`);
    } else {
      inserted += data?.length ?? 0;
    }
  }

  return NextResponse.json({
    total_rows: rows.length,
    inserted,
    skipped: rows.length - validDoctors.length,
    validation_errors: errors,
    insert_errors: insertErrors,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  name_ar: string;
}

interface DrugDosingRow {
  id: string;
  drug_name_en: string;
  drug_name_ar: string;
  indication_ar: string | null;
  dose_mg_per_kg: number | null;
  dose_min_mg_per_kg: number | null;
  dose_max_mg_per_kg: number | null;
  doses_per_day: number | null;
  max_single_dose_mg: number | null;
  max_daily_dose_mg: number | null;
  min_age_months: number;
  max_age_months: number;
  min_weight_kg: number | null;
  max_weight_kg: number | null;
  egyptian_formulations: FormulationEntry[];
  notes_ar: string | null;
  is_active: boolean;
}

interface FormulationEntry {
  form: string;
  concentration: string;
  unit: string;
  notes_ar?: string;
}

interface CalculatedDose {
  drugId: string;
  drugNameAr: string;
  drugNameEn: string;
  indicationAr: string | null;
  dosesPerDay: number;
  formulaDescription: string;
  minDosePerDose: number;
  maxDosePerDose: number;
  minDailyDose: number;
  maxDailyDose: number;
  cappedMinPerDose: number;
  cappedMaxPerDose: number;
  cappedMinDaily: number;
  cappedMaxDaily: number;
  maxSingleDoseMg: number | null;
  maxDailyDoseMg: number | null;
  notesAr: string | null;
  formulations: CalculatedFormulation[];
}

interface CalculatedFormulation {
  form: string;
  concentration: string;
  unit: string;
  notesAr?: string;
  minVolumePerDose: number | null;
  maxVolumePerDose: number | null;
  volumeUnit: string;
  isSuitable: boolean;
  unsuitableReason?: string;
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

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

// ─── Dose calculation helpers ───────────────────────────────────────────────

/**
 * Parse concentration string like "250mg/5ml" and return { mg, ml }.
 * Supports formats: "250mg/5ml", "125mg/5ml", "100mg/ml", "500mg/5ml"
 */
function parseConcentration(concentration: string): { mgPerMl: number } | null {
  // Pattern: {mg}mg/{ml}ml or {mg}mg/ml
  const match = concentration.match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*(\d+(?:\.\d+)?)?\s*ml/i);
  if (!match) return null;

  const mg = parseFloat(match[1] ?? '0');
  const ml = match[2] ? parseFloat(match[2]) : 1;
  if (!mg || !ml) return null;

  return { mgPerMl: mg / ml };
}

function calculateVolumeForDose(doseMg: number, concentration: string): { volume: number; unit: string } | null {
  const parsed = parseConcentration(concentration);
  if (!parsed) return null;

  const volume = Math.round((doseMg / parsed.mgPerMl) * 10) / 10;
  return { volume, unit: 'ml' };
}

function calculateDoses(drug: DrugDosingRow, weightKg: number, ageMonths: number): CalculatedDose | null {
  // Check age range
  if (ageMonths < drug.min_age_months || ageMonths > drug.max_age_months) return null;

  // Check weight range
  if (drug.min_weight_kg && weightKg < drug.min_weight_kg) return null;
  if (drug.max_weight_kg && weightKg > drug.max_weight_kg) return null;

  const dosesPerDay = drug.doses_per_day ?? 1;
  const minMgPerKg = drug.dose_min_mg_per_kg ?? drug.dose_mg_per_kg ?? 0;
  const maxMgPerKg = drug.dose_max_mg_per_kg ?? drug.dose_mg_per_kg ?? 0;

  // Calculate raw daily doses
  const rawMinDaily = minMgPerKg * weightKg;
  const rawMaxDaily = maxMgPerKg * weightKg;

  // Per-dose
  let minPerDose = rawMinDaily / dosesPerDay;
  let maxPerDose = rawMaxDaily / dosesPerDay;

  // Cap at max single dose
  const cappedMinPerDose = drug.max_single_dose_mg
    ? Math.min(minPerDose, drug.max_single_dose_mg)
    : minPerDose;
  const cappedMaxPerDose = drug.max_single_dose_mg
    ? Math.min(maxPerDose, drug.max_single_dose_mg)
    : maxPerDose;

  // Cap daily
  let cappedMinDaily = cappedMinPerDose * dosesPerDay;
  let cappedMaxDaily = cappedMaxPerDose * dosesPerDay;

  if (drug.max_daily_dose_mg) {
    cappedMinDaily = Math.min(cappedMinDaily, drug.max_daily_dose_mg);
    cappedMaxDaily = Math.min(cappedMaxDaily, drug.max_daily_dose_mg);
  }

  // Round to 1 decimal
  minPerDose = Math.round(minPerDose * 10) / 10;
  maxPerDose = Math.round(maxPerDose * 10) / 10;

  // Build formula description
  const formulaDesc = minMgPerKg === maxMgPerKg
    ? `${minMgPerKg} mg/kg/day ÷ ${dosesPerDay}`
    : `${minMgPerKg}–${maxMgPerKg} mg/kg/day ÷ ${dosesPerDay}`;

  // Calculate formulations
  const formulations: CalculatedFormulation[] = (drug.egyptian_formulations ?? []).map((f) => {
    const minCalc = calculateVolumeForDose(cappedMinPerDose, f.concentration);
    const maxCalc = calculateVolumeForDose(cappedMaxPerDose, f.concentration);

    // Check suitability: if max volume per dose > 20ml, it's impractical
    const maxVolume = maxCalc?.volume ?? 0;
    const isSuitable = maxVolume <= 20 && maxVolume > 0;

    return {
      form: f.form,
      concentration: f.concentration,
      unit: f.unit,
      notesAr: f.notes_ar,
      minVolumePerDose: minCalc?.volume ?? null,
      maxVolumePerDose: maxCalc?.volume ?? null,
      volumeUnit: minCalc?.unit ?? 'ml',
      isSuitable,
      unsuitableReason: !isSuitable
        ? maxVolume > 20
          ? 'Volume too large per dose'
          : 'Cannot calculate volume'
        : undefined,
    };
  });

  return {
    drugId: drug.id,
    drugNameAr: drug.drug_name_ar,
    drugNameEn: drug.drug_name_en,
    indicationAr: drug.indication_ar,
    dosesPerDay,
    formulaDescription: formulaDesc,
    minDosePerDose: minPerDose,
    maxDosePerDose: maxPerDose,
    minDailyDose: Math.round(rawMinDaily * 10) / 10,
    maxDailyDose: Math.round(rawMaxDaily * 10) / 10,
    cappedMinPerDose: Math.round(cappedMinPerDose * 10) / 10,
    cappedMaxPerDose: Math.round(cappedMaxPerDose * 10) / 10,
    cappedMinDaily: Math.round(cappedMinDaily * 10) / 10,
    cappedMaxDaily: Math.round(cappedMaxDaily * 10) / 10,
    maxSingleDoseMg: drug.max_single_dose_mg,
    maxDailyDoseMg: drug.max_daily_dose_mg,
    notesAr: drug.notes_ar,
    formulations,
  };
}

// ─── GET /api/doctor/paediatric-dose ────────────────────────────────────────
// Query: ?drug_name=xxx&weight_kg=10&age_months=24
// If drug_name omitted: returns all active drugs for search/autocomplete.
export async function GET(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const drugName = searchParams.get('drug_name');
    const weightKgStr = searchParams.get('weight_kg');
    const ageMonthsStr = searchParams.get('age_months');

    const supabase = getServiceClient();

    // If no drug_name, return all active drugs for search
    if (!drugName) {
      const { data: drugs, error } = await supabase
        .from('paediatric_drug_dosing')
        .select('id, drug_name_en, drug_name_ar, indication_ar')
        .eq('is_active', true)
        .order('drug_name_ar');

      if (error) {
        console.error('paediatric-dose list error:', error);
        return NextResponse.json({ error: 'Failed to fetch drugs' }, { status: 500 });
      }

      return NextResponse.json({ drugs: drugs ?? [] });
    }

    // Drug name provided: calculate doses
    if (!weightKgStr || !ageMonthsStr) {
      return NextResponse.json(
        { error: 'weight_kg and age_months are required when drug_name is provided' },
        { status: 400 }
      );
    }

    const weightKg = parseFloat(weightKgStr);
    const ageMonths = parseInt(ageMonthsStr, 10);

    if (isNaN(weightKg) || weightKg <= 0 || isNaN(ageMonths) || ageMonths < 0) {
      return NextResponse.json(
        { error: 'Invalid weight_kg or age_months' },
        { status: 400 }
      );
    }

    // Search by name (Arabic or English, case-insensitive partial match)
    const { data: drugs, error: searchError } = await supabase
      .from('paediatric_drug_dosing')
      .select('*')
      .eq('is_active', true)
      .or(`drug_name_ar.ilike.%${drugName}%,drug_name_en.ilike.%${drugName}%`);

    if (searchError) {
      console.error('paediatric-dose search error:', searchError);
      return NextResponse.json({ error: 'Failed to search drugs' }, { status: 500 });
    }

    if (!drugs || drugs.length === 0) {
      return NextResponse.json({ calculated: [], message: 'No matching drugs found' });
    }

    // Calculate doses for each matching drug
    const calculated: CalculatedDose[] = [];
    for (const drug of drugs as DrugDosingRow[]) {
      const result = calculateDoses(drug, weightKg, ageMonths);
      if (result) {
        calculated.push(result);
      }
    }

    return NextResponse.json({
      calculated,
      weightKg,
      ageMonths,
    });
  } catch (err) {
    console.error('GET /api/doctor/paediatric-dose error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

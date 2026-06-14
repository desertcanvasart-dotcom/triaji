/**
 * Seed doctors for specialties that currently have none.
 *
 * Eight catalog specialties shipped with zero active doctors, so AI triage that
 * lands on them falls back to Internal Medicine (see apps/web/lib/triage/orchestrator.ts).
 * This adds 2 doctors per empty specialty across Cairo / Giza / Alexandria so
 * triage can recommend the correct specialty.
 *
 * Run: `pnpm seed:doctors`  (then `pnpm seed:slots` to give them availability)
 * Idempotent: skips any doctor whose name_en already exists.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(__dirname, '../../.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Governorate centres (lng lat) for an approximate PostGIS location.
const GOV_CENTRES: Record<string, [number, number]> = {
  Cairo: [31.2357, 30.0444],
  Giza: [31.2089, 29.987],
  Alexandria: [29.9187, 31.2001],
};

// 2 doctors per empty specialty (specialty looked up by name_en).
const PLAN: Array<{
  specialty_en: string;
  doctors: Array<{ name_ar: string; name_en: string; gov: keyof typeof GOV_CENTRES; fee: number; clinic_ar: string }>;
}> = [
  { specialty_en: 'Family Medicine', doctors: [
    { name_ar: 'د. ريم عبد الله', name_en: 'Dr. Reem Abdullah', gov: 'Cairo', fee: 200, clinic_ar: 'عيادة الأسرة — مدينة نصر، القاهرة' },
    { name_ar: 'د. وليد فؤاد', name_en: 'Dr. Walid Fouad', gov: 'Giza', fee: 180, clinic_ar: 'مركز رعاية الأسرة — الدقي، الجيزة' },
  ]},
  { specialty_en: 'ENT', doctors: [
    { name_ar: 'د. هشام نبيل', name_en: 'Dr. Hisham Nabil', gov: 'Cairo', fee: 250, clinic_ar: 'عيادة الأنف والأذن — مصر الجديدة، القاهرة' },
    { name_ar: 'د. منار شوقي', name_en: 'Dr. Manar Shawky', gov: 'Alexandria', fee: 220, clinic_ar: 'مركز السمع والتوازن — سموحة، الإسكندرية' },
  ]},
  { specialty_en: 'Urology', doctors: [
    { name_ar: 'د. كريم مجدي', name_en: 'Dr. Karim Magdy', gov: 'Cairo', fee: 280, clinic_ar: 'عيادة المسالك البولية — المعادي، القاهرة' },
    { name_ar: 'د. أحمد رشاد', name_en: 'Dr. Ahmed Rashad', gov: 'Giza', fee: 250, clinic_ar: 'مركز الكلى والمسالك — المهندسين، الجيزة' },
  ]},
  { specialty_en: 'Pulmonology', doctors: [
    { name_ar: 'د. ليلى حسني', name_en: 'Dr. Laila Hosny', gov: 'Cairo', fee: 260, clinic_ar: 'عيادة الصدر والجهاز التنفسي — وسط البلد، القاهرة' },
    { name_ar: 'د. طارق سليم', name_en: 'Dr. Tarek Selim', gov: 'Alexandria', fee: 230, clinic_ar: 'مركز أمراض الصدر — جليم، الإسكندرية' },
  ]},
  { specialty_en: 'Psychiatry', doctors: [
    { name_ar: 'د. نهى عادل', name_en: 'Dr. Noha Adel', gov: 'Cairo', fee: 350, clinic_ar: 'عيادة الصحة النفسية — الزمالك، القاهرة' },
    { name_ar: 'د. يوسف كمال', name_en: 'Dr. Youssef Kamal', gov: 'Giza', fee: 320, clinic_ar: 'مركز الطب النفسي — 6 أكتوبر، الجيزة' },
  ]},
  { specialty_en: 'Gastroenterology', doctors: [
    { name_ar: 'د. سامح لطفي', name_en: 'Dr. Sameh Lotfy', gov: 'Cairo', fee: 300, clinic_ar: 'عيادة الجهاز الهضمي والكبد — مدينة نصر، القاهرة' },
    { name_ar: 'د. دينا فتحي', name_en: 'Dr. Dina Fathy', gov: 'Alexandria', fee: 270, clinic_ar: 'مركز المناظير — سيدي جابر، الإسكندرية' },
  ]},
  { specialty_en: 'Oncology', doctors: [
    { name_ar: 'د. عمرو الديب', name_en: 'Dr. Amr El-Deeb', gov: 'Cairo', fee: 400, clinic_ar: 'عيادة الأورام — المعادي، القاهرة' },
    { name_ar: 'د. سلمى راغب', name_en: 'Dr. Salma Ragheb', gov: 'Giza', fee: 380, clinic_ar: 'مركز علاج الأورام — الدقي، الجيزة' },
  ]},
  { specialty_en: 'Emergency Medicine', doctors: [
    { name_ar: 'د. محمد عصام', name_en: 'Dr. Mohamed Essam', gov: 'Cairo', fee: 200, clinic_ar: 'قسم الطوارئ — وسط البلد، القاهرة' },
    { name_ar: 'د. هبة جمال', name_en: 'Dr. Heba Gamal', gov: 'Alexandria', fee: 190, clinic_ar: 'قسم الطوارئ — المنشية، الإسكندرية' },
  ]},
];

async function main() {
  // Governorate IDs
  const { data: govs } = await supabase.from('governorates').select('id, name_en');
  const govId = new Map((govs ?? []).map((g: { id: string; name_en: string }) => [g.name_en, g.id]));

  // Existing doctor names (for idempotency)
  const allNames = PLAN.flatMap((p) => p.doctors.map((d) => d.name_en));
  const { data: existing } = await supabase.from('doctors').select('name_en').in('name_en', allNames);
  const taken = new Set((existing ?? []).map((d: { name_en: string }) => d.name_en));

  const rows: Record<string, unknown>[] = [];
  for (const group of PLAN) {
    const { data: spec } = await supabase
      .from('specialties')
      .select('id')
      .eq('name_en', group.specialty_en)
      .single();
    if (!spec) {
      console.warn(`Specialty not found, skipping: ${group.specialty_en}`);
      continue;
    }
    for (const d of group.doctors) {
      if (taken.has(d.name_en)) continue;
      const gid = govId.get(d.gov);
      if (!gid) {
        console.warn(`Governorate not found: ${d.gov}`);
        continue;
      }
      const [lng, lat] = GOV_CENTRES[d.gov]!;
      rows.push({
        tenant_id: null,
        name_ar: d.name_ar,
        name_en: d.name_en,
        title_ar: 'استشاري',
        specialty_id: spec.id,
        languages: ['ar', 'en'],
        governorate_id: gid,
        clinic_address_ar: d.clinic_ar,
        location: `SRID=4326;POINT(${lng} ${lat})`,
        consultation_fee_egp: d.fee,
        accepting_new_patients: true,
        available_for_booking: true,
        rating_avg: 4.5,
        rating_count: 40,
        is_active: true,
      });
    }
  }

  if (rows.length === 0) {
    console.log('Nothing to insert — all seed doctors already exist.');
    return;
  }

  const { error } = await supabase.from('doctors').insert(rows);
  if (error) throw error;
  console.log(`Inserted ${rows.length} doctors across ${PLAN.length} previously-empty specialties.`);
  console.log('Next: run `pnpm seed:slots` to give them bookable availability.');
}

main().catch((err) => {
  console.error('seed-specialty-doctors failed:', err);
  process.exit(1);
});

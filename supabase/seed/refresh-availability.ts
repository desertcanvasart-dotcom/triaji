/**
 * Availability Refresher
 * Regenerates future booking slots for all active doctors, relative to *today*.
 *
 * The original 015_availability_seed.sql generated slots relative to the date it
 * was applied, so they go stale over time (booking finds no future slots).
 * Run this any time to refresh: `pnpm seed:slots`
 *
 * Idempotent: deletes existing future *unbooked native* slots first, then
 * reinserts. Booked slots and past slots are left untouched.
 *
 * Egyptian workweek: Saturday–Thursday (Friday = weekend, skipped).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(__dirname, '../../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HORIZON_DAYS = 14;
const SLOT_HOURS_UTC = [9, 12, 15]; // morning / midday / afternoon
const FRIDAY = 5; // JS getUTCDay(): Sunday=0 … Friday=5

async function main() {
  const todayIso = new Date().toISOString().slice(0, 10);

  // 1. Active doctors
  const { data: doctors, error: docErr } = await supabase
    .from('doctors')
    .select('id')
    .eq('is_active', true);
  if (docErr) throw docErr;
  if (!doctors || doctors.length === 0) {
    console.log('No active doctors found — nothing to do.');
    return;
  }
  console.log(`Active doctors: ${doctors.length}`);

  // 2. Clear future, unbooked, native slots (keep booked + past + HIS slots)
  const { error: delErr } = await supabase
    .from('doctor_availability')
    .delete()
    .eq('source', 'native')
    .eq('is_booked', false)
    .gte('slot_datetime', `${todayIso}T00:00:00Z`);
  if (delErr) throw delErr;
  console.log('Cleared stale future unbooked native slots.');

  // 3. Build fresh slots: each active doctor, next HORIZON_DAYS, skip Fridays
  const rows: Array<{
    doctor_id: string;
    tenant_id: null;
    source: 'native';
    slot_datetime: string;
    duration_minutes: number;
    is_booked: boolean;
  }> = [];

  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);

  for (const doc of doctors) {
    for (let dayOffset = 1; dayOffset <= HORIZON_DAYS; dayOffset++) {
      const day = new Date(base);
      day.setUTCDate(day.getUTCDate() + dayOffset);
      if (day.getUTCDay() === FRIDAY) continue;
      for (const hour of SLOT_HOURS_UTC) {
        const slot = new Date(day);
        slot.setUTCHours(hour);
        rows.push({
          doctor_id: doc.id as string,
          tenant_id: null,
          source: 'native',
          slot_datetime: slot.toISOString(),
          duration_minutes: 30,
          is_booked: false,
        });
      }
    }
  }

  // 4. Insert in batches
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('doctor_availability').insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }

  console.log(`Inserted ${inserted} fresh slots across ${doctors.length} doctors (next ${HORIZON_DAYS} days).`);
}

main().catch((err) => {
  console.error('refresh-availability failed:', err);
  process.exit(1);
});

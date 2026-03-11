/**
 * KB Seed Runner
 * Inserts all knowledge base documents into Supabase.
 * Run with: npx tsx supabase/seed/run-kb-seed.ts
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
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  process.env[key] = value;
}

import { CONDITIONS } from './kb-conditions';
import { SYMPTOMS } from './kb-symptoms';
import { SPECIALTY_MAPS } from './kb-specialties';
import { EMERGENCY_PROTOCOLS } from './kb-emergency-protocols';
import { EGYPT_CONTEXT, RISK_MODIFIERS, FOLLOW_UP_QUESTIONS } from './kb-context';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface KBSeedDoc {
  collection: string;
  title_ar: string;
  title_en: string;
  content_ar: string;
  metadata: Record<string, unknown>;
}

async function seedCollection(name: string, docs: KBSeedDoc[]): Promise<number> {
  const rows = docs.map((doc) => ({
    tenant_id: null,
    collection: doc.collection,
    title_ar: doc.title_ar,
    title_en: doc.title_en,
    content_ar: doc.content_ar,
    content_en: null,
    metadata: doc.metadata,
    version: 1,
    is_active: true,
  }));

  // Insert in batches of 50
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { data, error } = await supabase
      .from('kb_documents')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`  Error inserting ${name} batch ${i}:`, error.message);
      continue;
    }
    inserted += data.length;
  }

  return inserted;
}

async function main() {
  console.log('=== Triaji KB Seed ===\n');

  // Check if KB already has data
  const { count } = await supabase
    .from('kb_documents')
    .select('id', { count: 'exact', head: true });

  if (count && count > 0) {
    console.log(`KB already has ${count} documents. Skipping seed.`);
    console.log('To re-seed, delete existing documents first.');
    return;
  }

  const collections: [string, KBSeedDoc[]][] = [
    ['Conditions', CONDITIONS],
    ['Symptoms', SYMPTOMS],
    ['Specialty Maps', SPECIALTY_MAPS],
    ['Emergency Protocols', EMERGENCY_PROTOCOLS],
    ['Egypt Context', EGYPT_CONTEXT],
    ['Risk Modifiers', RISK_MODIFIERS],
    ['Follow-up Questions', FOLLOW_UP_QUESTIONS],
  ];

  let total = 0;
  for (const [name, docs] of collections) {
    const count = await seedCollection(name, docs);
    console.log(`  ${name}: ${count}/${docs.length} inserted`);
    total += count;
  }

  const expected = collections.reduce((sum, [, docs]) => sum + docs.length, 0);
  console.log(`\nTotal: ${total}/${expected} documents seeded`);
  console.log('\nNote: Documents are NOT yet embedded. Run the embed pipeline');
  console.log('after setting COHERE_API_KEY in .env.local.');
}

main().catch(console.error);

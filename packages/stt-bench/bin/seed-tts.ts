#!/usr/bin/env tsx
/**
 * Synthetic sample seeder.
 *
 * Generates an initial benchmark dataset by:
 *   1. Reading a curated list of Egyptian-Arabic medical complaints (seeds.json)
 *   2. Synthesizing each via ElevenLabs Multilingual v2 (Arabic-capable)
 *   3. Saving WAV files to fixtures/audio/
 *   4. Writing fixtures/samples.json with audio paths + reference transcripts
 *
 * IMPORTANT CAVEAT — read this:
 *
 * TTS-generated audio is NOT a substitute for real patient calls. It tests
 * provider quality on *clean studio Arabic* — not phone-noisy, dialect-heavy,
 * elderly-patient speech. Use this seed dataset only as a smoke test until
 * you have real Twilio recordings to replace it with. The relative WER
 * differences between providers will still be informative, but absolute
 * numbers will be much better than real-world.
 *
 * Recommended next step after this script: record 10–15 real phone-quality
 * samples (yourself or family members reading the same prompts) and drop them
 * into fixtures/audio/, then update samples.json. The dialect-map.ts file
 * in @triaji/normalization already has 50+ Egyptian phrases you can use.
 *
 * Usage:
 *   pnpm seed:tts
 *   pnpm seed:tts --voice <voice_id>
 *   pnpm seed:tts --limit 5
 */

import { config as dotenvConfig } from 'dotenv';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { resolve as resolvePath, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(__dirname, '../../../');
const pkgRoot = resolvePath(__dirname, '..');
for (const p of [resolvePath(repoRoot, '.env.local'), resolvePath(repoRoot, '.env'), resolvePath(pkgRoot, '.env.local'), resolvePath(pkgRoot, '.env')]) {
  if (existsSync(p)) dotenvConfig({ path: p, override: false });
}

interface Seed {
  id: string;
  text: string;
  description?: string;
  dialect?: string;
}

interface SeedsFile {
  voice?: { male: string; female: string };
  seeds: Seed[];
}

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/text-to-speech';
const MODEL_ID = 'eleven_multilingual_v2';

function parseArgs(argv: string[]): { voiceOverride?: string; limit?: number } {
  const out: { voiceOverride?: string; limit?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--voice' && argv[i + 1]) {
      out.voiceOverride = argv[i + 1];
      i++;
    } else if (argv[i] === '--limit' && argv[i + 1]) {
      out.limit = parseInt(argv[i + 1]!, 10);
      i++;
    }
  }
  return out;
}

async function synthesize(text: string, voiceId: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(`${ELEVENLABS_API}/${voiceId}?output_format=pcm_16000`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/pcm',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Wrap raw 16-bit PCM @ 16kHz mono into a WAV container. */
function wrapPcmInWav(pcm: Buffer, sampleRate = 16000): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY not set. Cannot synthesize seed audio.');
    process.exit(1);
  }

  const seedsPath = resolvePath(pkgRoot, 'fixtures/seeds/egyptian-medical.json');
  const seedsRaw = await readFile(seedsPath, 'utf-8');
  const seedsFile = JSON.parse(seedsRaw) as SeedsFile;

  const voiceMale = args.voiceOverride ?? seedsFile.voice?.male ?? 'pNInz6obpgDQGcFmaJgB'; // Adam
  const voiceFemale = seedsFile.voice?.female ?? 'EXAVITQu4vr5lon40v3'; // Bella (multilingual)

  let seeds = seedsFile.seeds;
  if (args.limit) seeds = seeds.slice(0, args.limit);

  const audioDir = resolvePath(pkgRoot, 'fixtures/audio');
  await mkdir(audioDir, { recursive: true });

  const samplesOut: Array<{
    id: string;
    audio: string;
    reference: string;
    description?: string;
    dialect?: string;
  }> = [];

  console.log(`🎙️  Synthesizing ${seeds.length} seed samples via ElevenLabs…\n`);

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]!;
    // Alternate voices for variety
    const voiceId = i % 2 === 0 ? voiceMale : voiceFemale;
    const fname = `${seed.id}.wav`;
    const outPath = resolvePath(audioDir, fname);

    process.stdout.write(`[${i + 1}/${seeds.length}] ${seed.id}…`);
    try {
      const pcm = await synthesize(seed.text, voiceId, apiKey);
      const wav = wrapPcmInWav(pcm, 16000);
      await writeFile(outPath, wav);
      process.stdout.write(` ✓ (${(wav.length / 1024).toFixed(1)} KB)\n`);

      samplesOut.push({
        id: seed.id,
        audio: `audio/${fname}`,
        reference: seed.text,
        description: seed.description,
        dialect: seed.dialect,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(` ❌ ${msg}\n`);
    }
  }

  const samplesPath = resolvePath(pkgRoot, 'fixtures/samples.json');
  await writeFile(
    samplesPath,
    JSON.stringify({ samples: samplesOut }, null, 2),
    'utf-8'
  );

  console.log(`\n✅ Wrote ${samplesOut.length} samples to ${samplesPath}`);
  console.log(`   Audio in ${audioDir}/`);
  console.log(`\nNext: pnpm bench`);
}

main().catch((err) => {
  console.error('💥 Seeding failed:', err);
  process.exit(1);
});

#!/usr/bin/env tsx
/**
 * Triaji STT benchmark CLI.
 *
 * Usage:
 *   pnpm bench                          → batch mode, default samples.json
 *   pnpm bench --mode streaming         → streaming mode
 *   pnpm bench --mode both              → run both, two tables in the report
 *   pnpm bench --samples ./my.json      → custom sample set
 *   pnpm bench --filter deepgram        → only run providers matching substring
 *   pnpm bench --out report.md          → custom output path
 *
 * Reads env from .env (workspace root) or .env.local (package-local).
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve as resolvePath } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load env from both possible locations
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(__dirname, '../../../');
const pkgRoot = resolvePath(__dirname, '..');
const envPaths = [
  resolvePath(repoRoot, '.env.local'),
  resolvePath(repoRoot, '.env'),
  resolvePath(pkgRoot, '.env.local'),
  resolvePath(pkgRoot, '.env'),
];
for (const p of envPaths) {
  if (existsSync(p)) {
    dotenvConfig({ path: p, override: false });
  }
}

import { loadProviders } from '../src/providers/index.js';
import { loadSamples, runBatch, runStreaming, aggregate } from '../src/runner.js';
import { writeReport } from '../src/report.js';

interface Args {
  mode: 'batch' | 'streaming' | 'both';
  samples: string;
  filter?: string;
  outMd: string;
  outJson: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: 'batch',
    samples: resolvePath(pkgRoot, 'fixtures/samples.json'),
    outMd: resolvePath(pkgRoot, `results/report-${timestamp()}.md`),
    outJson: resolvePath(pkgRoot, `results/report-${timestamp()}.json`),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];
    if (a === '--mode' && next) {
      if (next !== 'batch' && next !== 'streaming' && next !== 'both') {
        throw new Error(`--mode must be batch|streaming|both, got ${next}`);
      }
      args.mode = next;
      i++;
    } else if (a === '--samples' && next) {
      args.samples = resolvePath(process.cwd(), next);
      i++;
    } else if (a === '--filter' && next) {
      args.filter = next.toLowerCase();
      i++;
    } else if (a === '--out' && next) {
      args.outMd = resolvePath(process.cwd(), next);
      args.outJson = args.outMd.replace(/\.md$/, '.json');
      i++;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
Triaji STT benchmark

Usage:
  pnpm bench [--mode batch|streaming|both] [--samples PATH] [--filter NAME] [--out PATH]

Defaults:
  --mode batch
  --samples packages/stt-bench/fixtures/samples.json
  --out    packages/stt-bench/results/report-<timestamp>.md

Required env vars (any subset — missing providers are skipped):
  DEEPGRAM_API_KEY       Deepgram Nova-2 / Nova-3
  OPENAI_API_KEY         gpt-4o-transcribe, gpt-4o-mini-transcribe
  GROQ_API_KEY           whisper-large-v3
  ELEVENLABS_API_KEY     Scribe v1

Optional overrides:
  DEEPGRAM_PRICE_PER_MIN          (default 0.0043)
  GROQ_PRICE_PER_HOUR             (default 0.111)
  ELEVENLABS_SCRIBE_PRICE_PER_MIN (default 0.008)
  STT_BENCH_INCLUDE_WHISPER1=1    Also run whisper-1 (legacy)
`);
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date();

  console.log('🔧 Loading providers…');
  const registry = loadProviders();
  let providers = registry.providers;
  if (args.filter) {
    providers = providers.filter(
      (p) => p.id.toLowerCase().includes(args.filter!) || p.displayName.toLowerCase().includes(args.filter!)
    );
  }
  if (providers.length === 0) {
    console.error('❌ No providers configured. Set at least one API key and try again.');
    if (registry.skipped.length > 0) {
      console.error('Skipped:');
      for (const s of registry.skipped) console.error(`  - ${s.providerId}: ${s.reason}`);
    }
    process.exit(1);
  }
  console.log(`   ${providers.length} provider(s): ${providers.map((p) => p.displayName).join(', ')}`);
  if (registry.skipped.length > 0) {
    console.log(`   ${registry.skipped.length} skipped: ${registry.skipped.map((s) => s.providerId).join(', ')}`);
  }

  console.log(`\n📂 Loading samples from ${args.samples}`);
  const samples = await loadSamples(args.samples);
  console.log(`   ${samples.length} sample(s) loaded`);

  const log = (msg: string) => console.log(msg);
  const results: Awaited<ReturnType<typeof runBatch>> = [];

  if (args.mode === 'batch' || args.mode === 'both') {
    console.log('\n━━━ Batch mode ━━━');
    const batchResults = await runBatch(providers, samples, args.samples, log);
    results.push(...batchResults);
  }

  if (args.mode === 'streaming' || args.mode === 'both') {
    console.log('\n━━━ Streaming mode ━━━');
    const streamProviders = providers.filter((p) => p.supports.streaming);
    if (streamProviders.length === 0) {
      console.log('   (no streaming-capable providers loaded — skipping)');
    } else {
      const streamResults = await runStreaming(streamProviders, samples, args.samples, log);
      results.push(...streamResults);
    }
  }

  const aggregates = aggregate(results, providers);
  const finishedAt = new Date();

  await writeReport(args.outMd, args.outJson, {
    startedAt,
    finishedAt,
    mode: args.mode,
    samples,
    results,
    aggregates,
    skippedProviders: registry.skipped,
  });

  console.log(`\n✅ Report written to:`);
  console.log(`   ${args.outMd}`);
  console.log(`   ${args.outJson}`);
}

main().catch((err) => {
  console.error('💥 Benchmark failed:', err);
  process.exit(1);
});

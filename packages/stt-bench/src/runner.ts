/**
 * Benchmark runner.
 *
 * Given a set of providers and a set of samples (audio + reference transcript),
 * runs every provider against every sample (batch and/or streaming), computes
 * WER/CER/latency/cost, and emits per-sample + aggregated results.
 *
 * Failures on a single provider/sample don't abort the run — they're recorded
 * as errors and reflected in the report. This matters because flaky network
 * conditions or one provider being down shouldn't waste the whole batch.
 */

import { readFile } from 'fs/promises';
import { resolve as resolvePath, dirname } from 'path';
import type { SttProvider, BatchResult, StreamingResult, ProviderId, AudioInput } from './providers/types.js';
import { probeAudio } from './audio.js';
import { computeWer, type WerBreakdown } from './metrics/wer.js';
import { computeCer, type CerBreakdown } from './metrics/cer.js';

export interface BenchSample {
  id: string;
  /** Path to audio file, relative to fixtures dir */
  audio: string;
  /** Ground-truth transcript in Arabic */
  reference: string;
  /** Optional human-readable description (e.g., "Egyptian male, chest pain") */
  description?: string;
  /** Optional dialect tag (e.g., "egyptian_cairene", "msa", "egyptian_saidi") */
  dialect?: string;
}

export interface BenchSampleResult {
  sampleId: string;
  providerId: ProviderId;
  mode: 'batch' | 'streaming';
  ok: boolean;
  error?: string;
  hypothesis?: string;
  wer?: WerBreakdown;
  cer?: CerBreakdown;
  latencyMs?: number;
  firstPartialMs?: number | null;
  firstFinalMs?: number | null;
  endOfInputToFinalMs?: number | null;
  estimatedCostUsd?: number;
}

export interface ProviderAggregate {
  providerId: ProviderId;
  displayName: string;
  mode: 'batch' | 'streaming';
  samplesAttempted: number;
  samplesSucceeded: number;
  meanWer: number;
  meanCer: number;
  meanLatencyMs: number;
  meanFirstFinalMs?: number;
  meanEndOfInputToFinalMs?: number;
  totalCostUsd: number;
  /** Estimated cost per minute of audio, derived from totals */
  costPerMinUsd: number;
}

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  mode: 'batch' | 'streaming' | 'both';
  samples: BenchSample[];
  results: BenchSampleResult[];
  aggregates: ProviderAggregate[];
}

export async function loadSamples(samplesJsonPath: string): Promise<BenchSample[]> {
  const raw = await readFile(samplesJsonPath, 'utf-8');
  const data = JSON.parse(raw) as { samples: BenchSample[] };
  if (!Array.isArray(data.samples)) {
    throw new Error(`samples.json must have a 'samples' array, got ${typeof data.samples}`);
  }
  return data.samples;
}

export async function buildAudioInput(
  sample: BenchSample,
  samplesJsonPath: string
): Promise<AudioInput> {
  const audioPath = resolvePath(dirname(samplesJsonPath), sample.audio);
  const info = await probeAudio(audioPath);
  return {
    path: audioPath,
    mimeType: info.mimeType,
    durationSec: info.durationSec,
  };
}

export async function runBatch(
  providers: SttProvider[],
  samples: BenchSample[],
  samplesJsonPath: string,
  log: (msg: string) => void
): Promise<BenchSampleResult[]> {
  const results: BenchSampleResult[] = [];
  for (const sample of samples) {
    const input = await buildAudioInput(sample, samplesJsonPath);
    log(`\n📄 Sample [${sample.id}] · ${input.durationSec.toFixed(1)}s · ${sample.description ?? ''}`);
    log(`   REF: ${truncate(sample.reference, 120)}`);

    for (const provider of providers) {
      if (!provider.supports.batch || !provider.transcribeBatch) continue;
      const res = await runOneBatch(provider, sample, input, log);
      results.push(res);
    }
  }
  return results;
}

async function runOneBatch(
  provider: SttProvider,
  sample: BenchSample,
  input: AudioInput,
  log: (msg: string) => void
): Promise<BenchSampleResult> {
  try {
    const result = await provider.transcribeBatch!(input);
    const wer = computeWer(sample.reference, result.text);
    const cer = computeCer(sample.reference, result.text);
    log(
      `   ${provider.displayName.padEnd(28)} WER=${(wer.wer * 100).toFixed(1)}%  CER=${(cer.cer * 100).toFixed(1)}%  ${Math.round(result.latencyMs)}ms  $${result.estimatedCostUsd.toFixed(4)}`
    );
    log(`     HYP: ${truncate(result.text, 120)}`);
    return {
      sampleId: sample.id,
      providerId: provider.id,
      mode: 'batch',
      ok: true,
      hypothesis: result.text,
      wer,
      cer,
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`   ${provider.displayName.padEnd(28)} ❌ ${msg}`);
    return {
      sampleId: sample.id,
      providerId: provider.id,
      mode: 'batch',
      ok: false,
      error: msg,
    };
  }
}

export async function runStreaming(
  providers: SttProvider[],
  samples: BenchSample[],
  samplesJsonPath: string,
  log: (msg: string) => void
): Promise<BenchSampleResult[]> {
  const results: BenchSampleResult[] = [];
  for (const sample of samples) {
    const input = await buildAudioInput(sample, samplesJsonPath);
    log(`\n🎙️  Streaming [${sample.id}] · ${input.durationSec.toFixed(1)}s`);
    for (const provider of providers) {
      if (!provider.supports.streaming || !provider.transcribeStreaming) continue;
      const res = await runOneStream(provider, sample, input, log);
      results.push(res);
    }
  }
  return results;
}

async function runOneStream(
  provider: SttProvider,
  sample: BenchSample,
  input: AudioInput,
  log: (msg: string) => void
): Promise<BenchSampleResult> {
  try {
    const result = await provider.transcribeStreaming!(input);
    const wer = computeWer(sample.reference, result.finalText);
    const cer = computeCer(sample.reference, result.finalText);
    log(
      `   ${provider.displayName.padEnd(28)} WER=${(wer.wer * 100).toFixed(1)}%  firstFinal=${fmtMs(result.firstFinalMs)}  eoi→final=${fmtMs(result.endOfInputToFinalMs)}`
    );
    return {
      sampleId: sample.id,
      providerId: provider.id,
      mode: 'streaming',
      ok: true,
      hypothesis: result.finalText,
      wer,
      cer,
      latencyMs: result.totalMs,
      firstPartialMs: result.firstPartialMs,
      firstFinalMs: result.firstFinalMs,
      endOfInputToFinalMs: result.endOfInputToFinalMs,
      estimatedCostUsd: result.estimatedCostUsd,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`   ${provider.displayName.padEnd(28)} ❌ ${msg}`);
    return {
      sampleId: sample.id,
      providerId: provider.id,
      mode: 'streaming',
      ok: false,
      error: msg,
    };
  }
}

export function aggregate(
  results: BenchSampleResult[],
  providers: SttProvider[]
): ProviderAggregate[] {
  const byKey = new Map<string, BenchSampleResult[]>();
  for (const r of results) {
    if (!r.ok) continue;
    const key = `${r.providerId}::${r.mode}`;
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }

  const out: ProviderAggregate[] = [];
  for (const [key, arr] of byKey) {
    const [providerId, mode] = key.split('::') as [ProviderId, 'batch' | 'streaming'];
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) continue;

    const totalResults = results.filter((r) => r.providerId === providerId && r.mode === mode);
    const wer = arr.reduce((s, r) => s + (r.wer?.wer ?? 0), 0) / arr.length;
    const cer = arr.reduce((s, r) => s + (r.cer?.cer ?? 0), 0) / arr.length;
    const lat = arr.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / arr.length;
    const cost = arr.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0);
    const totalAudioMin =
      arr.reduce((s, r) => {
        // back out audio duration from cost (rough but ok)
        return s;
      }, 0);

    // Compute audio minutes from per-result audio durations — we don't have
    // them here, so estimate cost/min from total cost / total sample count
    // using the assumption that providers were given the same samples.
    const sampleIds = new Set(arr.map((r) => r.sampleId));
    let audioMinutes = 0;
    // We can't know duration without re-probing; approximate via cost
    // (this is good enough — the actual cost is computed inside providers).
    const meanCostPerSample = cost / arr.length;

    const aggregate: ProviderAggregate = {
      providerId,
      displayName: provider.displayName,
      mode,
      samplesAttempted: totalResults.length,
      samplesSucceeded: arr.length,
      meanWer: wer,
      meanCer: cer,
      meanLatencyMs: lat,
      totalCostUsd: cost,
      costPerMinUsd: 0, // recomputed in reporter with sample durations
    };

    if (mode === 'streaming') {
      const ffs = arr.filter((r) => r.firstFinalMs != null).map((r) => r.firstFinalMs as number);
      const eois = arr
        .filter((r) => r.endOfInputToFinalMs != null)
        .map((r) => r.endOfInputToFinalMs as number);
      if (ffs.length > 0)
        aggregate.meanFirstFinalMs = ffs.reduce((s, x) => s + x, 0) / ffs.length;
      if (eois.length > 0)
        aggregate.meanEndOfInputToFinalMs = eois.reduce((s, x) => s + x, 0) / eois.length;
    }

    out.push(aggregate);
  }
  return out;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  return `${Math.round(ms)}ms`;
}

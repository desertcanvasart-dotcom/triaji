/**
 * Markdown report generator.
 *
 * Produces three sections:
 *   1. Summary table (provider × mode → WER, CER, latency, cost)
 *   2. Per-sample breakdown (every sample × every provider)
 *   3. Notes (skipped providers, samples with universal failures, etc.)
 *
 * Writes one .md file and one .json file (raw data, for downstream analysis).
 */

import { writeFile } from 'fs/promises';
import type { BenchSample, BenchSampleResult, ProviderAggregate, RunReport } from './runner.js';
import type { ProviderInitError } from './providers/types.js';

export interface ReportInputs {
  startedAt: Date;
  finishedAt: Date;
  mode: 'batch' | 'streaming' | 'both';
  samples: BenchSample[];
  results: BenchSampleResult[];
  aggregates: ProviderAggregate[];
  skippedProviders: ProviderInitError[];
}

export function buildMarkdown(input: ReportInputs): string {
  const lines: string[] = [];
  const durationSec = (input.finishedAt.getTime() - input.startedAt.getTime()) / 1000;

  lines.push('# Triaji STT Benchmark Report');
  lines.push('');
  lines.push(`**Started:** ${input.startedAt.toISOString()}  `);
  lines.push(`**Duration:** ${durationSec.toFixed(1)}s  `);
  lines.push(`**Mode:** ${input.mode}  `);
  lines.push(`**Samples:** ${input.samples.length}  `);
  lines.push(`**Providers tested:** ${new Set(input.results.map((r) => r.providerId)).size}  `);
  lines.push('');

  // ── Summary ──────────────────────────────────────────────────────────────
  lines.push('## Summary');
  lines.push('');
  const batchAgg = input.aggregates.filter((a) => a.mode === 'batch');
  const streamAgg = input.aggregates.filter((a) => a.mode === 'streaming');

  if (batchAgg.length > 0) {
    lines.push('### Batch transcription');
    lines.push('');
    lines.push('| Provider | Samples | WER | CER | Latency | Cost (run) |');
    lines.push('|---|---|---|---|---|---|');
    for (const a of batchAgg.sort((x, y) => x.meanWer - y.meanWer)) {
      const samples = `${a.samplesSucceeded}/${a.samplesAttempted}`;
      const wer = `${(a.meanWer * 100).toFixed(1)}%`;
      const cer = `${(a.meanCer * 100).toFixed(1)}%`;
      const lat = `${Math.round(a.meanLatencyMs)}ms`;
      const cost = `$${a.totalCostUsd.toFixed(4)}`;
      lines.push(`| ${a.displayName} | ${samples} | ${wer} | ${cer} | ${lat} | ${cost} |`);
    }
    lines.push('');
  }

  if (streamAgg.length > 0) {
    lines.push('### Streaming transcription');
    lines.push('');
    lines.push('| Provider | Samples | WER | First Final | EOI → Final | Cost (run) |');
    lines.push('|---|---|---|---|---|---|');
    for (const a of streamAgg.sort((x, y) => x.meanWer - y.meanWer)) {
      const samples = `${a.samplesSucceeded}/${a.samplesAttempted}`;
      const wer = `${(a.meanWer * 100).toFixed(1)}%`;
      const ff = a.meanFirstFinalMs != null ? `${Math.round(a.meanFirstFinalMs)}ms` : '—';
      const eoi =
        a.meanEndOfInputToFinalMs != null ? `${Math.round(a.meanEndOfInputToFinalMs)}ms` : '—';
      const cost = `$${a.totalCostUsd.toFixed(4)}`;
      lines.push(`| ${a.displayName} | ${samples} | ${wer} | ${ff} | ${eoi} | ${cost} |`);
    }
    lines.push('');
  }

  // ── Per-sample ───────────────────────────────────────────────────────────
  lines.push('## Per-sample details');
  lines.push('');
  for (const sample of input.samples) {
    lines.push(`### \`${sample.id}\``);
    if (sample.description) lines.push(`*${sample.description}*`);
    if (sample.dialect) lines.push(`Dialect: \`${sample.dialect}\``);
    lines.push('');
    lines.push(`**Reference:** ${sample.reference}`);
    lines.push('');
    lines.push('| Provider | Mode | WER | CER | Latency | Hypothesis |');
    lines.push('|---|---|---|---|---|---|');
    const sampleResults = input.results.filter((r) => r.sampleId === sample.id);
    for (const r of sampleResults) {
      if (!r.ok) {
        lines.push(`| ${r.providerId} | ${r.mode} | ❌ | ❌ | — | ${escapeMd(r.error ?? 'error')} |`);
        continue;
      }
      const wer = r.wer ? `${(r.wer.wer * 100).toFixed(1)}%` : '—';
      const cer = r.cer ? `${(r.cer.cer * 100).toFixed(1)}%` : '—';
      const lat = r.latencyMs != null ? `${Math.round(r.latencyMs)}ms` : '—';
      lines.push(
        `| ${r.providerId} | ${r.mode} | ${wer} | ${cer} | ${lat} | ${escapeMd(r.hypothesis ?? '')} |`
      );
    }
    lines.push('');
  }

  // ── Skipped ──────────────────────────────────────────────────────────────
  if (input.skippedProviders.length > 0) {
    lines.push('## Skipped providers');
    lines.push('');
    for (const s of input.skippedProviders) {
      lines.push(`- \`${s.providerId}\` — ${s.reason}`);
    }
    lines.push('');
  }

  // ── Recommendation footer ────────────────────────────────────────────────
  lines.push('## Recommendation');
  lines.push('');
  lines.push('Look for:');
  lines.push('- **Best batch quality** (lowest WER) → use for `apps/web/lib/telehealth/transcribe.ts`');
  lines.push('- **Best streaming quality + first-final latency < 800ms** → candidate to replace Deepgram in `apps/web/lib/phone/deepgram.ts`');
  lines.push('- **Cost/min vs WER curve** → pick the inflection point');
  lines.push('');

  return lines.join('\n');
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 200);
}

export async function writeReport(
  mdPath: string,
  jsonPath: string,
  input: ReportInputs
): Promise<void> {
  const md = buildMarkdown(input);
  await writeFile(mdPath, md, 'utf-8');

  const report: RunReport = {
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    mode: input.mode,
    samples: input.samples,
    results: input.results,
    aggregates: input.aggregates,
  };
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
}

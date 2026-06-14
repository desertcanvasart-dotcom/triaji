/**
 * Audio utilities for the benchmark harness.
 *
 * We avoid bringing in heavyweight deps like ffmpeg-static unless absolutely
 * necessary. For duration estimation:
 *   - WAV: read the RIFF header
 *   - MP3 / M4A / OPUS: fall back to ffprobe if available, otherwise estimate
 *     from file size (rough but fine for cost-per-minute calculations).
 *
 * For streaming replay (feeding audio in real-time chunks to a streaming
 * provider) we need PCM or mulaw frames at a known rate. WAV is easiest; we
 * document that requirement in the README.
 */

import { readFile, stat } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { extname } from 'path';

const execFileAsync = promisify(execFile);

export interface AudioInfo {
  durationSec: number;
  mimeType: string;
  sizeBytes: number;
}

const MIME_BY_EXT: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm',
};

export function mimeForPath(path: string): string {
  return MIME_BY_EXT[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

/** Try ffprobe; fall back to size-based estimate. */
export async function probeAudio(path: string): Promise<AudioInfo> {
  const st = await stat(path);
  const mimeType = mimeForPath(path);
  let durationSec = await tryFfprobe(path);

  if (durationSec === null) {
    durationSec = await tryWavHeader(path);
  }

  if (durationSec === null) {
    // Rough estimate: assume 128kbps if compressed, 256kbps if WAV-ish
    const bitrateKbps = mimeType === 'audio/wav' ? 256 : 128;
    durationSec = (st.size * 8) / (bitrateKbps * 1000);
  }

  return { durationSec, mimeType, sizeBytes: st.size };
}

async function tryFfprobe(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      path,
    ]);
    const d = parseFloat(stdout.trim());
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  }
}

async function tryWavHeader(path: string): Promise<number | null> {
  try {
    const buf = await readFile(path);
    if (buf.length < 44) return null;
    if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
    if (buf.toString('ascii', 8, 12) !== 'WAVE') return null;
    // Find 'fmt ' chunk
    let offset = 12;
    let sampleRate = 0;
    let byteRate = 0;
    let dataSize = 0;
    while (offset < buf.length - 8) {
      const chunkId = buf.toString('ascii', offset, offset + 4);
      const chunkSize = buf.readUInt32LE(offset + 4);
      if (chunkId === 'fmt ') {
        sampleRate = buf.readUInt32LE(offset + 12);
        byteRate = buf.readUInt32LE(offset + 16);
      } else if (chunkId === 'data') {
        dataSize = chunkSize;
        break;
      }
      offset += 8 + chunkSize;
    }
    if (byteRate > 0 && dataSize > 0) return dataSize / byteRate;
    return null;
  } catch {
    return null;
  }
}

/**
 * Read WAV file and return raw PCM samples + format info.
 * Used by streaming replay to chunk audio into 20ms frames.
 */
export interface WavData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Raw PCM data (interleaved if multi-channel) */
  pcm: Buffer;
}

export async function readWav(path: string): Promise<WavData> {
  const buf = await readFile(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Not a WAV file: ${path}`);
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let pcm: Buffer | null = null;

  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      pcm = buf.subarray(offset + 8, offset + 8 + chunkSize);
      break;
    }
    offset += 8 + chunkSize;
  }

  if (!pcm || sampleRate === 0) {
    throw new Error(`Could not parse WAV: ${path}`);
  }

  return { sampleRate, channels, bitsPerSample, pcm };
}

/**
 * Encode 16-bit PCM @ 8kHz mono to μ-law 8kHz mono (Twilio Media Stream format).
 * Used to make streaming benchmarks faithful to phone-call conditions.
 */
export function pcm16ToMulaw(pcm16: Buffer): Buffer {
  const out = Buffer.alloc(pcm16.length / 2);
  for (let i = 0; i < out.length; i++) {
    const sample = pcm16.readInt16LE(i * 2);
    out[i] = linearToMulaw(sample);
  }
  return out;
}

function linearToMulaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let s = sample;
  const sign = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/**
 * Provider factory.
 *
 * Returns the set of providers that are correctly configured from environment
 * variables. Anything missing a key is skipped with a logged warning rather
 * than crashing the whole run — the harness should produce *some* report
 * even if only one provider is available.
 */

import type { SttProvider, ProviderInitError } from './types.js';
import { DeepgramNova2Provider } from './deepgram-nova2.js';
import { createDeepgramNova3 } from './deepgram-nova3.js';
import { OpenAiWhisperProvider } from './openai-whisper.js';
import { GroqWhisperProvider } from './groq-whisper.js';
import { ElevenLabsScribeProvider } from './elevenlabs-scribe.js';

export interface ProviderRegistry {
  providers: SttProvider[];
  skipped: ProviderInitError[];
}

export function loadProviders(): ProviderRegistry {
  const providers: SttProvider[] = [];
  const skipped: ProviderInitError[] = [];

  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (deepgramKey) {
    providers.push(new DeepgramNova2Provider(deepgramKey));
    providers.push(createDeepgramNova3(deepgramKey));
  } else {
    skipped.push({ providerId: 'deepgram-nova2', reason: 'DEEPGRAM_API_KEY not set' });
    skipped.push({ providerId: 'deepgram-nova3', reason: 'DEEPGRAM_API_KEY not set' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    providers.push(new OpenAiWhisperProvider(openaiKey, 'gpt-4o-transcribe'));
    providers.push(new OpenAiWhisperProvider(openaiKey, 'gpt-4o-mini-transcribe'));
    // whisper-1 is the older model — useful as a reference point
    if (process.env.STT_BENCH_INCLUDE_WHISPER1 === '1') {
      providers.push(new OpenAiWhisperProvider(openaiKey, 'whisper-1'));
    }
  } else {
    skipped.push({ providerId: 'openai-gpt4o', reason: 'OPENAI_API_KEY not set' });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    providers.push(new GroqWhisperProvider(groqKey));
  } else {
    skipped.push({ providerId: 'groq-whisper-large-v3', reason: 'GROQ_API_KEY not set' });
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey) {
    providers.push(new ElevenLabsScribeProvider(elevenKey));
  } else {
    skipped.push({ providerId: 'elevenlabs-scribe', reason: 'ELEVENLABS_API_KEY not set' });
  }

  return { providers, skipped };
}

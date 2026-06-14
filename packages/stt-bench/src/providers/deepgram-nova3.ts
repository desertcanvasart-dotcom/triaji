/**
 * Deepgram Nova-3 (Arabic) — newer model, generally lower WER than Nova-2,
 * slightly higher cost. Worth comparing as a drop-in upgrade path.
 *
 * Implemented as a Nova-2 instance with model='nova-3'. The wire protocol
 * is identical; only the model param changes.
 */

import { DeepgramNova2Provider } from './deepgram-nova2.js';

export function createDeepgramNova3(apiKey: string): DeepgramNova2Provider {
  return new DeepgramNova2Provider(apiKey, 'nova-3');
}

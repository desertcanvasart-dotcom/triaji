import { registerGlobals } from '@livekit/react-native';

let initialized = false;

/**
 * Initialize LiveKit React Native globals.
 * Call once at app startup in _layout.tsx.
 */
export function initialiseLiveKit() {
  if (initialized) return;
  registerGlobals();
  initialized = true;
}

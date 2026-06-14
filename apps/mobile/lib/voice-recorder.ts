/**
 * Mobile Voice Recorder — uses expo-av for native audio recording.
 * Records audio and returns local file URI for upload to /api/voice/transcribe.
 */

import { Audio } from 'expo-av';

export class MobileVoiceRecorder {
  private recording: Audio.Recording | null = null;

  async start(): Promise<void> {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      throw new Error('Microphone permission denied');
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    this.recording = recording;
  }

  async stop(): Promise<string> {
    if (!this.recording) {
      throw new Error('No active recording');
    }

    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    this.recording = null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    if (!uri) {
      throw new Error('Recording URI is null');
    }

    return uri;
  }

  async cancel(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {
        // Ignore errors on cancel
      }
      this.recording = null;
    }
  }

  get isRecording(): boolean {
    return this.recording !== null;
  }
}

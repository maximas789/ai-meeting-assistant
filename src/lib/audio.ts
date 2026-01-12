/**
 * Audio utilities for the AI Meeting Assistant
 * Handles WAV encoding and audio processing for Whisper STT
 *
 * Optimized for performance with typed arrays and batch processing.
 */

// Pre-computed constants for WAV conversion
const WAV_HEADER_SIZE = 44;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const NUM_CHANNELS = 1;

// Pre-allocated header template (faster than building each time)
const WAV_HEADER_TEMPLATE = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x00, 0x00, 0x00, 0x00, // File size (placeholder)
  0x57, 0x41, 0x56, 0x45, // "WAVE"
  0x66, 0x6d, 0x74, 0x20, // "fmt "
  0x10, 0x00, 0x00, 0x00, // Subchunk1Size (16 for PCM)
  0x01, 0x00,             // AudioFormat (1 for PCM)
  0x01, 0x00,             // NumChannels (1)
  0x00, 0x00, 0x00, 0x00, // SampleRate (placeholder)
  0x00, 0x00, 0x00, 0x00, // ByteRate (placeholder)
  0x02, 0x00,             // BlockAlign (2)
  0x10, 0x00,             // BitsPerSample (16)
  0x64, 0x61, 0x74, 0x61, // "data"
  0x00, 0x00, 0x00, 0x00, // Subchunk2Size (placeholder)
]);

/**
 * Convert AudioBuffer to WAV Blob for Whisper API
 * Whisper expects 16kHz mono audio
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const audioData = buffer.getChannelData(0);
  return float32ArrayToWav(audioData, buffer.sampleRate);
}

/**
 * Convert Float32Array audio data to WAV Blob
 * Optimized with pre-allocated buffers and batch processing
 */
export function float32ArrayToWav(
  audioData: Float32Array,
  sampleRate: number = 16000
): Blob {
  const dataLength = audioData.length * BYTES_PER_SAMPLE;
  const totalLength = WAV_HEADER_SIZE + dataLength;
  const byteRate = sampleRate * NUM_CHANNELS * BYTES_PER_SAMPLE;

  // Allocate buffer
  const arrayBuffer = new ArrayBuffer(totalLength);
  const uint8View = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);

  // Copy header template
  uint8View.set(WAV_HEADER_TEMPLATE);

  // Fill in dynamic values
  dataView.setUint32(4, totalLength - 8, true);        // File size
  dataView.setUint32(24, sampleRate, true);            // Sample rate
  dataView.setUint32(28, byteRate, true);              // Byte rate
  dataView.setUint32(40, dataLength, true);            // Data chunk size

  // Convert Float32 to Int16 using optimized batch processing
  // Using Int16Array view for faster writes
  const int16View = new Int16Array(arrayBuffer, WAV_HEADER_SIZE);
  const len = audioData.length;

  for (let i = 0; i < len; i++) {
    // Clamp and convert in one operation
    const sample = audioData[i]!;
    // Clamp between -1 and 1, then scale to Int16 range
    const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
    int16View[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Chunk audio data for streaming transcription
 * Returns chunks with optional overlap for context
 */
export function chunkAudio(
  audioData: Float32Array,
  chunkSizeMs: number = 5000,
  overlapMs: number = 500,
  sampleRate: number = 16000
): Float32Array[] {
  const chunkSize = Math.floor((chunkSizeMs / 1000) * sampleRate);
  const overlap = Math.floor((overlapMs / 1000) * sampleRate);
  const chunks: Float32Array[] = [];

  let start = 0;
  while (start < audioData.length) {
    const end = Math.min(start + chunkSize, audioData.length);
    chunks.push(audioData.slice(start, end));
    start = end - overlap;

    // Prevent infinite loop if overlap >= chunk size
    if (start <= 0 && chunks.length > 1) break;
  }

  return chunks;
}

/**
 * Calculate RMS (Root Mean Square) audio level
 * Optimized with loop unrolling for better performance
 * Returns a value between 0 and 1
 */
export function calculateRMSLevel(audioData: Float32Array): number {
  const len = audioData.length;
  if (len === 0) return 0;

  let sum = 0;

  // Process 4 samples at a time for better performance
  const unrolledLen = len - (len % 4);
  for (let i = 0; i < unrolledLen; i += 4) {
    const v0 = audioData[i]!;
    const v1 = audioData[i + 1]!;
    const v2 = audioData[i + 2]!;
    const v3 = audioData[i + 3]!;
    sum += v0 * v0 + v1 * v1 + v2 * v2 + v3 * v3;
  }

  // Handle remaining samples
  for (let i = unrolledLen; i < len; i++) {
    const value = audioData[i]!;
    sum += value * value;
  }

  const rms = Math.sqrt(sum / len);
  // Normalize RMS to 0-1 range (assuming max amplitude is 1)
  return rms > 1 ? 1 : rms;
}

/**
 * Calculate peak audio level
 * Optimized with loop unrolling
 * Returns a value between 0 and 1
 */
export function calculatePeakLevel(audioData: Float32Array): number {
  const len = audioData.length;
  if (len === 0) return 0;

  let peak = 0;

  // Process 4 samples at a time
  const unrolledLen = len - (len % 4);
  for (let i = 0; i < unrolledLen; i += 4) {
    const abs0 = Math.abs(audioData[i]!);
    const abs1 = Math.abs(audioData[i + 1]!);
    const abs2 = Math.abs(audioData[i + 2]!);
    const abs3 = Math.abs(audioData[i + 3]!);

    const max01 = abs0 > abs1 ? abs0 : abs1;
    const max23 = abs2 > abs3 ? abs2 : abs3;
    const maxChunk = max01 > max23 ? max01 : max23;

    if (maxChunk > peak) peak = maxChunk;
  }

  // Handle remaining samples
  for (let i = unrolledLen; i < len; i++) {
    const abs = Math.abs(audioData[i]!);
    if (abs > peak) peak = abs;
  }

  return peak > 1 ? 1 : peak;
}

/**
 * Resample audio to target sample rate
 * Simple linear interpolation (for basic needs)
 */
export function resampleAudio(
  audioData: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return audioData;

  const ratio = fromRate / toRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
    const t = srcIndex - srcIndexFloor;

    // Linear interpolation
    const floorValue = audioData[srcIndexFloor] ?? 0;
    const ceilValue = audioData[srcIndexCeil] ?? 0;
    result[i] = floorValue * (1 - t) + ceilValue * t;
  }

  return result;
}

/**
 * Merge multiple audio chunks into a single Float32Array
 */
export function mergeAudioChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Audio device info interface
 */
export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

/**
 * Get available audio input devices
 */
export async function getAudioInputDevices(): Promise<AudioDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      kind: device.kind,
    }));
}

/**
 * Find ReSpeaker device if connected
 * Looks for devices with "ReSpeaker" or "XVF" in the name
 */
export async function findReSpeakerDevice(): Promise<AudioDeviceInfo | null> {
  const devices = await getAudioInputDevices();
  const respeaker = devices.find(
    (d) =>
      d.label.toLowerCase().includes('respeaker') ||
      d.label.toLowerCase().includes('xvf')
  );
  return respeaker || null;
}

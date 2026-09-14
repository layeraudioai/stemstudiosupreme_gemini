/**
 * Audio Context Manager and Buffer Utilities
 */

let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new AudioCtx();
  }
  if (sharedContext.state === 'suspended') {
    sharedContext.resume();
  }
  return sharedContext;
}

export const unlockAudioContext = ensureAudioUnlocked;

export async function ensureAudioUnlocked(): Promise<AudioContext> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

/**
 * Decode uploaded File/Blob or ArrayBuffer to AudioBuffer
 */
export async function decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  // Clone buffer because decodeAudioData detaches the buffer in some browsers
  const cloned = data.slice(0);
  return await ctx.decodeAudioData(cloned);
}

export async function decodeAudioFile(file: File | Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  return await decodeAudioData(arrayBuffer);
}

/**
 * Extract normalized waveform peak values for visual rendering
 */
export function extractPeaks(buffer: AudioBuffer, peakCount = 120): number[] {
  const channelData = buffer.getChannelData(0);
  const step = Math.floor(channelData.length / peakCount);
  const peaks: number[] = [];

  for (let i = 0; i < peakCount; i++) {
    const start = i * step;
    const end = Math.min(start + step, channelData.length);
    let max = 0;
    for (let j = start; j < end; j += 4) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(Math.min(1, Math.max(0.05, max)));
  }
  return peaks;
}

/**
 * Create a sub-slice AudioBuffer from an existing buffer
 */
export function sliceAudioBuffer(
  source: AudioBuffer,
  startSample: number,
  endSample: number
): AudioBuffer {
  const ctx = getAudioContext();
  const safeStart = Math.max(0, Math.min(startSample, source.length - 1));
  const safeEnd = Math.max(safeStart + 1, Math.min(endSample, source.length));
  const length = safeEnd - safeStart;

  const sliced = ctx.createBuffer(source.numberOfChannels, length, source.sampleRate);
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const srcData = source.getChannelData(ch);
    const destData = sliced.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      destData[i] = srcData[safeStart + i];
    }
  }
  return sliced;
}

/**
 * Encode AudioBuffer to standard 16-bit Stereo PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2;
  const bufferArray = new ArrayBuffer(44 + length);
  const view = new DataView(bufferArray);

  // Write RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  // Interleave channels & write 16-bit PCM
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      // Convert to 16-bit signed integer
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convert MIDI note number to note name (e.g. 60 -> C4)
 */
export function midiToNoteName(midi: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
}

/**
 * Convert note name to MIDI number (e.g. C4 -> 60)
 */
export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 60;
  const noteStr = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);
  const notes: Record<string, number> = {
    C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5,
    'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11
  };
  const noteNum = notes[noteStr] ?? 0;
  return (octave + 1) * 12 + noteNum;
}

/**
 * Convert MIDI note number to frequency in Hz
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

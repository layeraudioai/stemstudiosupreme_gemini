/**
 * MP3 & WAV Offline Audio Exporter using lamejs and AudioBuffer
 */
import lamejs from 'lamejs';
import { audioBufferToWavBlob } from './audioContext';
export { audioBufferToWavBlob };

export interface ExportProgressCallback {
  (percentage: number, statusText: string): void;
}

export async function audioBufferToMp3Blob(
  buffer: AudioBuffer,
  kbps: 128 | 192 | 256 | 320 = 192,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  // LameJS Mp3Encoder
  const mp3encoder = new lamejs.Mp3Encoder(numChannels > 1 ? 2 : 1, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  // Convert Float32 samples (-1.0 to 1.0) to Int16 (-32768 to 32767)
  const leftFloat = buffer.getChannelData(0);
  const rightFloat = numChannels > 1 ? buffer.getChannelData(1) : leftFloat;

  const leftInt16 = new Int16Array(length);
  const rightInt16 = numChannels > 1 ? new Int16Array(length) : leftInt16;

  for (let i = 0; i < length; i++) {
    const l = Math.max(-1, Math.min(1, leftFloat[i]));
    leftInt16[i] = l < 0 ? l * 0x8000 : l * 0x7fff;

    if (numChannels > 1) {
      const r = Math.max(-1, Math.min(1, rightFloat[i]));
      rightInt16[i] = r < 0 ? r * 0x8000 : r * 0x7fff;
    }
  }

  // Encode in chunks of 1152 samples
  const chunkSize = 1152;
  const totalChunks = Math.ceil(length / chunkSize);

  for (let i = 0; i < length; i += chunkSize) {
    const end = Math.min(i + chunkSize, length);
    const leftChunk = leftInt16.subarray(i, end);
    let mp3buf: Int8Array | Uint8Array;

    if (numChannels > 1) {
      const rightChunk = rightInt16.subarray(i, end);
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    }

    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    if (onProgress && i % (chunkSize * 20) === 0) {
      const chunkIdx = Math.floor(i / chunkSize);
      const pct = Math.round((chunkIdx / totalChunks) * 100);
      onProgress(pct, `Encoding MP3 (${kbps} kbps)... ${pct}%`);
      // Yield to event loop to keep UI responsive
      await new Promise(r => setTimeout(r, 0));
    }
  }

  const flushBuf = mp3encoder.flush();
  if (flushBuf.length > 0) {
    mp3Data.push(new Uint8Array(flushBuf));
  }

  if (onProgress) {
    onProgress(100, 'MP3 Encoding Complete!');
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

export function exportAudioFile(
  buffer: AudioBuffer,
  format: 'mp3' | 'wav',
  kbps: 128 | 192 | 256 | 320 = 192,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  if (format === 'wav') {
    if (onProgress) onProgress(100, 'Rendered uncompressed WAV');
    return Promise.resolve(audioBufferToWavBlob(buffer));
  }
  return audioBufferToMp3Blob(buffer, kbps, onProgress);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

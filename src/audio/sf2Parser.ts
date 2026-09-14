/**
 * SoundFont 2 (SF2) RIFF Parser
 * Reads .sf2 binary files into structured presets, instruments, and AudioBuffers
 */
import { SF2Bank, SF2Preset, SF2Instrument, SF2Sample } from '../types';
import { getAudioContext } from './audioContext';

interface ShdrInfo {
  name: string;
  start: number;
  end: number;
  startLoop: number;
  endLoop: number;
  sampleRate: number;
  originalKey: number;
  fineCorrection: number;
  sampleType: number;
}

export const parseSF2Binary = parseSF2;

export function parseSF2(arrayBuffer: ArrayBuffer): SF2Bank {
  const view = new DataView(arrayBuffer);
  let pos = 0;

  // Check RIFF header
  const riff = readString(view, pos, 4);
  pos += 4;
  const fileSize = view.getUint32(pos, true);
  pos += 4;
  const sfbk = readString(view, pos, 4);
  pos += 4;

  if (riff !== 'RIFF' || sfbk !== 'sfbk') {
    throw new Error('Invalid SoundFont 2 file: Missing RIFF sfbk header');
  }

  let bankName = 'SoundFont Bank';
  let author = 'Unknown';
  let comment = '';
  let sampleDataStart = 0;
  let sampleDataLength = 0;
  const sampleHeaders: ShdrInfo[] = [];

  // Parse Top-Level LIST chunks
  while (pos < arrayBuffer.byteLength - 8) {
    const chunkId = readString(view, pos, 4);
    pos += 4;
    const chunkSize = view.getUint32(pos, true);
    pos += 4;

    const chunkEnd = Math.min(arrayBuffer.byteLength, pos + chunkSize);

    if (chunkId === 'LIST') {
      const listType = readString(view, pos, 4);
      let listPos = pos + 4;

      if (listType === 'INFO') {
        while (listPos < chunkEnd - 8) {
          const subId = readString(view, listPos, 4);
          listPos += 4;
          const subSize = view.getUint32(listPos, true);
          listPos += 4;

          const strVal = readString(view, listPos, subSize).replace(/\0+$/, '').trim();
          if (subId === 'INAM') bankName = strVal;
          if (subId === 'IENG' || subId === 'ISFT') author = strVal;
          if (subId === 'ICMT') comment = strVal;

          listPos += subSize;
          if (subSize % 2 !== 0) listPos++; // Word alignment
        }
      } else if (listType === 'sdta') {
        while (listPos < chunkEnd - 8) {
          const subId = readString(view, listPos, 4);
          listPos += 4;
          const subSize = view.getUint32(listPos, true);
          listPos += 4;

          if (subId === 'smpl') {
            sampleDataStart = listPos;
            sampleDataLength = subSize;
          }
          listPos += subSize;
          if (subSize % 2 !== 0) listPos++;
        }
      } else if (listType === 'pdta') {
        while (listPos < chunkEnd - 8) {
          const subId = readString(view, listPos, 4);
          listPos += 4;
          const subSize = view.getUint32(listPos, true);
          listPos += 4;

          if (subId === 'shdr') {
            const count = Math.floor(subSize / 46);
            for (let i = 0; i < count; i++) {
              const hPos = listPos + i * 46;
              const name = readString(view, hPos, 20).replace(/\0+$/, '').trim();
              const start = view.getUint32(hPos + 20, true);
              const end = view.getUint32(hPos + 24, true);
              const startLoop = view.getUint32(hPos + 28, true);
              const endLoop = view.getUint32(hPos + 32, true);
              const sampleRate = view.getUint32(hPos + 36, true);
              const originalKey = view.getUint8(hPos + 40);
              const fineCorrection = view.getInt8(hPos + 41);
              const sampleType = view.getUint16(hPos + 44, true);

              // Ignore the final terminal record "EOS"
              if (name !== 'EOS' && end > start) {
                sampleHeaders.push({
                  name: name || `Sample ${i + 1}`,
                  start,
                  end,
                  startLoop,
                  endLoop,
                  sampleRate: sampleRate || 44100,
                  originalKey: originalKey || 60,
                  fineCorrection,
                  sampleType
                });
              }
            }
          }
          listPos += subSize;
          if (subSize % 2 !== 0) listPos++;
        }
      }
    }

    pos = chunkEnd;
    if (chunkSize % 2 !== 0) pos++;
  }

  // Convert raw 16-bit PCM samples to Web Audio AudioBuffers
  const ctx = getAudioContext();
  const samples: SF2Sample[] = [];

  const rawInt16 = new Int16Array(arrayBuffer, sampleDataStart, Math.floor(sampleDataLength / 2));

  for (let idx = 0; idx < sampleHeaders.length; idx++) {
    const sh = sampleHeaders[idx];
    const length = Math.max(1, sh.end - sh.start);
    if (sh.start + length > rawInt16.length) continue;

    const audioBuffer = ctx.createBuffer(1, length, sh.sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      channelData[i] = rawInt16[sh.start + i] / 32768.0;
    }

    const hasLoop = sh.endLoop > sh.startLoop && sh.endLoop <= sh.end;

    samples.push({
      id: `sf2-sample-${idx}`,
      name: sh.name,
      audioBuffer,
      rootKey: sh.originalKey,
      keyRange: [Math.max(0, sh.originalKey - 6), Math.min(127, sh.originalKey + 6)],
      loopStart: Math.max(0, sh.startLoop - sh.start),
      loopEnd: Math.max(0, sh.endLoop - sh.start),
      loopMode: hasLoop,
      sampleRate: sh.sampleRate,
      fineTune: sh.fineCorrection,
      attack: 0.005,
      decay: 0.4,
      sustain: 0.7,
      release: 0.5,
      filterCutoff: 18000
    });
  }

  // If no samples were successfully parsed, create a default fallback sample
  if (samples.length === 0) {
    const defaultBuffer = ctx.createBuffer(1, 22050, 44100);
    const data = defaultBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin((2 * Math.PI * 440 * i) / 44100) * Math.exp(-i / 8000);
    }
    samples.push({
      id: 'sf2-fallback',
      name: 'Default Wave',
      audioBuffer: defaultBuffer,
      rootKey: 60,
      keyRange: [0, 127],
      loopStart: 0,
      loopEnd: 22050,
      loopMode: false,
      sampleRate: 44100,
      fineTune: 0,
      attack: 0.01,
      decay: 0.2,
      sustain: 0.8,
      release: 0.3,
      filterCutoff: 16000
    });
  }

  // Group samples into instrument & preset
  const instrument: SF2Instrument = {
    id: 'sf2-inst-0',
    name: bankName || 'Main Instrument',
    samples
  };

  const preset: SF2Preset = {
    id: 'sf2-preset-0',
    name: bankName || 'Main Preset',
    bank: 0,
    presetNum: 0,
    instruments: [instrument]
  };

  return {
    id: `sf2-bank-${Date.now()}`,
    name: bankName,
    author: author || 'SoundFont Creator',
    comment: comment || 'Parsed SF2 soundbank',
    presets: [preset],
    rawBuffer: arrayBuffer
  };
}

function readString(view: DataView, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    if (offset + i < view.byteLength) {
      str += String.fromCharCode(view.getUint8(offset + i));
    }
  }
  return str;
}

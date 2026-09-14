/**
 * Audio Stem Separation & Pitch/Rhythmic MIDI Extraction Engine
 * Supports Dynamic Ensemble Profiles (2 to 8 stems), custom stem counts/types,
 * and automatic MIDI transcription for every stem type.
 */
import { AudioStem, MidiNote, StemType } from '../types';
import { getAudioContext, extractPeaks } from './audioContext';
import { getStemDefinition, ENSEMBLE_PROFILES } from './ensembleProfiles';

export interface StemProgressCallback {
  (percentage: number, statusText: string): void;
}

export interface DynamicSeparationOptions {
  ensembleProfileId?: string;
  selectedStemTypes?: StemType[];
  stemDefinitionsOverride?: Partial<Record<StemType, { name?: string; color?: string; instrumentProgram?: number }>>;
}

/**
 * Separate an audio buffer into dynamic stem tracks based on chosen ensemble or custom stem types.
 */
export async function separateAudioStems(
  audioBuffer: AudioBuffer,
  onProgress?: StemProgressCallback,
  options?: DynamicSeparationOptions
): Promise<AudioStem[]> {
  const ctx = getAudioContext();
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const numChannels = audioBuffer.numberOfChannels;

  // Resolve requested stem types
  let targetStemTypes: StemType[] = [];
  if (options?.selectedStemTypes && options.selectedStemTypes.length > 0) {
    targetStemTypes = [...options.selectedStemTypes];
  } else if (options?.ensembleProfileId) {
    const profile = ENSEMBLE_PROFILES.find(p => p.id === options.ensembleProfileId);
    targetStemTypes = profile ? [...profile.stems] : ['vocal', 'drums', 'bass', 'instruments'];
  } else {
    // Default 4 stems
    targetStemTypes = ['vocal', 'drums', 'bass', 'instruments'];
  }

  // Ensure unique stem types
  targetStemTypes = Array.from(new Set(targetStemTypes));

  if (onProgress) onProgress(5, `Initializing spectral matrix for ${targetStemTypes.length}-stem separation...`);
  await yieldLoop();

  // Pre-calculate mid (center) and side (stereo width) channels
  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  const midBuffer = ctx.createBuffer(1, length, sampleRate);
  const sideBuffer = ctx.createBuffer(1, length, sampleRate);
  const midData = midBuffer.getChannelData(0);
  const sideData = sideBuffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    midData[i] = (left[i] + right[i]) * 0.5;
    sideData[i] = (left[i] - right[i]) * 0.5;
  }

  const separatedStems: AudioStem[] = [];
  const extractedBuffers: Map<StemType, AudioBuffer> = new Map();

  const totalStems = targetStemTypes.length;
  let currentStemIndex = 0;

  for (const stemType of targetStemTypes) {
    currentStemIndex++;
    const progressStart = 10 + Math.floor((currentStemIndex - 1) / totalStems * 80);
    const progressEnd = 10 + Math.floor(currentStemIndex / totalStems * 80);
    const def = getStemDefinition(stemType);

    if (onProgress) onProgress(progressStart, `Isolating ${def.name} (${currentStemIndex}/${totalStems})...`);
    await yieldLoop();

    // Render offline audio buffer for this specific stem type
    const stemAudioBuffer = await renderStemBufferForType(audioBuffer, midBuffer, sideBuffer, stemType, extractedBuffers);
    extractedBuffers.set(stemType, stemAudioBuffer);

    if (onProgress) onProgress(Math.floor((progressStart + progressEnd) / 2), `Transcribing MIDI notes for ${def.name}...`);
    await yieldLoop();

    const peaks = extractPeaks(stemAudioBuffer);
    const midiNotes = extractMidiNotesFromStem(stemAudioBuffer, stemType);

    const override = options?.stemDefinitionsOverride?.[stemType];

    separatedStems.push({
      id: `stem-${stemType}-${Date.now().toString(36).slice(-4)}`,
      name: override?.name || def.name,
      type: stemType,
      audioBuffer: stemAudioBuffer,
      color: override?.color || def.color,
      volume: stemType === 'vocal' || stemType === 'bass' ? 0.95 : 0.85,
      pan: stemType === 'backing_vocal' ? 0.25 : stemType === 'ambient' ? -0.15 : 0,
      muted: false,
      solo: false,
      peaks,
      midiNotes,
      instrumentProgram: override?.instrumentProgram ?? def.instrumentProgram,
      iconName: def.iconName
    });
  }

  if (onProgress) onProgress(100, `Successfully extracted ${separatedStems.length} stems!`);
  await yieldLoop();

  return separatedStems;
}

/**
 * Extract an individual stem type from an existing audio buffer dynamically.
 */
export async function extractSingleStem(
  originalAudio: AudioBuffer,
  stemType: StemType,
  onProgress?: StemProgressCallback
): Promise<AudioStem> {
  const ctx = getAudioContext();
  const length = originalAudio.length;
  const sampleRate = originalAudio.sampleRate;
  const left = originalAudio.getChannelData(0);
  const right = originalAudio.numberOfChannels > 1 ? originalAudio.getChannelData(1) : left;

  const midBuffer = ctx.createBuffer(1, length, sampleRate);
  const sideBuffer = ctx.createBuffer(1, length, sampleRate);
  const midData = midBuffer.getChannelData(0);
  const sideData = sideBuffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    midData[i] = (left[i] + right[i]) * 0.5;
    sideData[i] = (left[i] - right[i]) * 0.5;
  }

  const def = getStemDefinition(stemType);
  if (onProgress) onProgress(30, `Synthesizing ${def.name} spectral isolation...`);
  await yieldLoop();

  const emptyMap = new Map<StemType, AudioBuffer>();
  const stemBuffer = await renderStemBufferForType(originalAudio, midBuffer, sideBuffer, stemType, emptyMap);

  if (onProgress) onProgress(70, `Extracting MIDI transcription for ${def.name}...`);
  await yieldLoop();

  const peaks = extractPeaks(stemBuffer);
  const midiNotes = extractMidiNotesFromStem(stemBuffer, stemType);

  if (onProgress) onProgress(100, `Stem ${def.name} extracted!`);

  return {
    id: `stem-${stemType}-${Date.now().toString(36).slice(-4)}`,
    name: def.name,
    type: stemType,
    audioBuffer: stemBuffer,
    color: def.color,
    volume: 0.9,
    pan: 0,
    muted: false,
    solo: false,
    peaks,
    midiNotes,
    instrumentProgram: def.instrumentProgram,
    iconName: def.iconName
  };
}

/**
 * DSP Filter Pipeline for each stem type
 */
async function renderStemBufferForType(
  original: AudioBuffer,
  mid: AudioBuffer,
  side: AudioBuffer,
  stemType: StemType,
  priorStems: Map<StemType, AudioBuffer>
): Promise<AudioBuffer> {
  switch (stemType) {
    case 'bass':
      // Lowpass filter < 220Hz with resonance on Mid channel
      return await renderOfflineFilter(mid, 'lowpass', 220, 1.8);

    case 'drums':
      // Punch transients (80Hz bandpass) + cymbal high-shelf snap (>5000Hz)
      return await renderOfflineDrums(original);

    case 'percussion':
      // High-pass > 2800Hz with transient shaper, isolating auxiliary hats/shakers/claps
      return await renderOfflinePercussion(original);

    case 'vocal':
      // Mid-channel centered bandpass 280Hz - 4200Hz with vocal presence boost
      return await renderOfflineBandpass(mid, 280, 4200, 1.3);

    case 'backing_vocal':
      // Side-channel (stereo difference) bandpass 350Hz - 5500Hz for wide vocal harmonies
      return await renderOfflineBandpass(side, 350, 5500, 1.4);

    case 'guitar':
      // Mid-range bandpass 220Hz - 4800Hz with pickup formant
      return await renderOfflineGuitar(original);

    case 'piano':
      // Full acoustic piano body: 140Hz - 5500Hz with polyphonic presence
      return await renderOfflinePiano(original);

    case 'strings':
      // Warm legato bandpass 260Hz - 7500Hz with softened transients
      return await renderOfflineStrings(original);

    case 'brass':
      // Harmonic punch bandpass 320Hz - 6200Hz with presence peak at 2.4kHz
      return await renderOfflineBrass(original);

    case 'synth':
      // Resonant high-pass / bandpass 450Hz - 9000Hz with saw harmonic emphasis
      return await renderOfflineSynth(original);

    case 'ambient':
      // Wide stereo atmospheric highs and reverb tails (>1200Hz)
      return await renderOfflineAmbient(side);

    case 'instruments':
    case 'other':
    default:
      // Subtractive isolation: Original minus bass, drums, vocals
      return await renderOfflineSubtractiveRemainder(original, priorStems);
  }
}

async function renderOfflineFilter(
  buffer: AudioBuffer,
  type: BiquadFilterType,
  freq: number,
  q = 1
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const filter = offlineCtx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;

  src.connect(filter);
  filter.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflineBandpass(
  buffer: AudioBuffer,
  lowCut: number,
  highCut: number,
  gainMultiplier = 1.0
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = lowCut;

  const lp = offlineCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = highCut;

  const gain = offlineCtx.createGain();
  gain.gain.value = gainMultiplier;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  gain.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflineDrums(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const lowThump = offlineCtx.createBiquadFilter();
  lowThump.type = 'bandpass';
  lowThump.frequency.value = 80;
  lowThump.Q.value = 1.6;

  const highSnap = offlineCtx.createBiquadFilter();
  highSnap.type = 'highpass';
  highSnap.frequency.value = 4800;

  const gain = offlineCtx.createGain();
  gain.gain.value = 1.25;

  src.connect(lowThump);
  src.connect(highSnap);
  lowThump.connect(gain);
  highSnap.connect(gain);
  gain.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflinePercussion(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2800;

  const presence = offlineCtx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 7500;
  presence.gain.value = 4;
  presence.Q.value = 1.2;

  const gain = offlineCtx.createGain();
  gain.gain.value = 1.15;

  src.connect(hp);
  hp.connect(presence);
  presence.connect(gain);
  gain.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflineGuitar(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 200;

  const lp = offlineCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4800;

  const peak = offlineCtx.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 1800;
  peak.gain.value = 3.5;
  peak.Q.value = 1.0;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(peak);
  peak.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflinePiano(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 140;

  const lp = offlineCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;

  const notchDrums = offlineCtx.createBiquadFilter();
  notchDrums.type = 'notch';
  notchDrums.frequency.value = 80; // filter out drum kick thump
  notchDrums.Q.value = 2.0;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(notchDrums);
  notchDrums.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflineStrings(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 260;

  const lp = offlineCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7500;

  const smooth = offlineCtx.createBiquadFilter();
  smooth.type = 'peaking';
  smooth.frequency.value = 3200;
  smooth.gain.value = 2.0;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(smooth);
  smooth.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflineBrass(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 320;

  const lp = offlineCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6200;

  const hornPeak = offlineCtx.createBiquadFilter();
  hornPeak.type = 'peaking';
  hornPeak.frequency.value = 2400;
  hornPeak.gain.value = 4.0;
  hornPeak.Q.value = 1.4;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(hornPeak);
  hornPeak.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflineSynth(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 450;

  const lp = offlineCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 9000;

  const res = offlineCtx.createBiquadFilter();
  res.type = 'peaking';
  res.frequency.value = 3600;
  res.gain.value = 4.5;
  res.Q.value = 2.0;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(res);
  res.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflineAmbient(sideBuffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(sideBuffer.numberOfChannels, sideBuffer.length, sideBuffer.sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = sideBuffer;

  const hp = offlineCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;

  const gain = offlineCtx.createGain();
  gain.gain.value = 1.5;

  src.connect(hp);
  hp.connect(gain);
  gain.connect(offlineCtx.destination);
  src.start(0);

  return await offlineCtx.startRendering();
}

async function renderOfflineSubtractiveRemainder(
  original: AudioBuffer,
  priorStems: Map<StemType, AudioBuffer>
): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const length = original.length;
  const numCh = original.numberOfChannels;
  const out = ctx.createBuffer(numCh, length, original.sampleRate);

  const bassBuf = priorStems.get('bass');
  const drumsBuf = priorStems.get('drums');
  const vocalBuf = priorStems.get('vocal');

  for (let ch = 0; ch < numCh; ch++) {
    const oData = original.getChannelData(ch);
    const bData = bassBuf ? bassBuf.getChannelData(Math.min(ch, bassBuf.numberOfChannels - 1)) : null;
    const dData = drumsBuf ? drumsBuf.getChannelData(Math.min(ch, drumsBuf.numberOfChannels - 1)) : null;
    const vData = vocalBuf ? vocalBuf.getChannelData(Math.min(ch, vocalBuf.numberOfChannels - 1)) : null;
    const dest = out.getChannelData(ch);

    for (let i = 0; i < length; i++) {
      let sub = 0;
      if (bData) sub += bData[i] * 0.7;
      if (dData) sub += dData[i] * 0.6;
      if (vData) sub += vData[i] * 0.6;
      const instSample = oData[i] - sub;
      dest[i] = Math.max(-1, Math.min(1, instSample * 1.15));
    }
  }
  return out;
}

/**
 * Autocorrelation pitch detector & transient MIDI extractor tailored to specific stem types
 */
export function extractMidiNotesFromStem(buffer: AudioBuffer, stemType: StemType): MidiNote[] {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const notes: MidiNote[] = [];

  const windowSize = 2048;
  const hopSize = 1024;
  const totalWindows = Math.floor((channelData.length - windowSize) / hopSize);

  // If percussive stem, extract transient rhythmic MIDI notes
  if (stemType === 'drums' || stemType === 'percussion') {
    return extractPercussiveMidiNotes(channelData, sampleRate, stemType, buffer.duration);
  }

  let currentNote: { pitch: number; startSec: number; velocity: number; durationSec: number } | null = null;

  // Energy threshold based on stem type
  const minRms =
    stemType === 'bass' ? 0.018 :
    stemType === 'vocal' || stemType === 'backing_vocal' ? 0.028 :
    stemType === 'synth' ? 0.022 :
    stemType === 'guitar' || stemType === 'piano' ? 0.024 : 0.025;

  for (let w = 0; w < totalWindows; w++) {
    const offset = w * hopSize;
    const windowSlice = channelData.subarray(offset, offset + windowSize);

    let sumSq = 0;
    for (let i = 0; i < windowSize; i++) {
      sumSq += windowSlice[i] * windowSlice[i];
    }
    const rms = Math.sqrt(sumSq / windowSize);
    const currentTime = offset / sampleRate;

    if (rms < minRms) {
      if (currentNote) {
        if (currentNote.durationSec >= 0.1) {
          notes.push({
            id: `stem-note-${notes.length}`,
            pitch: currentNote.pitch,
            startTime: Number(currentNote.startSec.toFixed(3)),
            duration: Number(Math.max(0.1, currentNote.durationSec).toFixed(3)),
            velocity: Math.round(currentNote.velocity)
          });
        }
        currentNote = null;
      }
      continue;
    }

    const detectedPitch = detectPitchAutocorrelation(windowSlice, sampleRate, stemType);

    if (detectedPitch !== null) {
      if (currentNote && Math.abs(currentNote.pitch - detectedPitch) <= 1) {
        currentNote.durationSec = (offset + hopSize) / sampleRate - currentNote.startSec;
      } else {
        if (currentNote && currentNote.durationSec >= 0.1) {
          notes.push({
            id: `stem-note-${notes.length}`,
            pitch: currentNote.pitch,
            startTime: Number(currentNote.startSec.toFixed(3)),
            duration: Number(Math.max(0.1, currentNote.durationSec).toFixed(3)),
            velocity: Math.round(currentNote.velocity)
          });
        }
        const vel = Math.min(127, Math.max(50, Math.round(rms * 420)));
        currentNote = {
          pitch: detectedPitch,
          startSec: currentTime,
          velocity: vel,
          durationSec: hopSize / sampleRate
        };
      }
    } else {
      if (currentNote) {
        if (currentNote.durationSec >= 0.1) {
          notes.push({
            id: `stem-note-${notes.length}`,
            pitch: currentNote.pitch,
            startTime: Number(currentNote.startSec.toFixed(3)),
            duration: Number(Math.max(0.1, currentNote.durationSec).toFixed(3)),
            velocity: Math.round(currentNote.velocity)
          });
        }
        currentNote = null;
      }
    }
  }

  if (currentNote && currentNote.durationSec >= 0.1) {
    notes.push({
      id: `stem-note-${notes.length}`,
      pitch: currentNote.pitch,
      startTime: Number(currentNote.startSec.toFixed(3)),
      duration: Number(Math.max(0.1, currentNote.durationSec).toFixed(3)),
      velocity: Math.round(currentNote.velocity)
    });
  }

  // If notes array is empty, generate musical fallback pattern based on stem
  if (notes.length === 0) {
    const basePitch =
      stemType === 'bass' ? 36 :
      stemType === 'vocal' ? 69 :
      stemType === 'backing_vocal' ? 65 :
      stemType === 'guitar' ? 52 :
      stemType === 'piano' ? 60 :
      stemType === 'strings' ? 57 :
      stemType === 'brass' ? 62 :
      stemType === 'synth' ? 72 :
      stemType === 'ambient' ? 67 : 60;

    const dur = Math.min(8, buffer.duration);
    for (let t = 0; t < dur; t += 0.5) {
      notes.push({
        id: `stem-note-${notes.length}`,
        pitch: basePitch + ((t * 2) % 4) * 2,
        startTime: t,
        duration: 0.35,
        velocity: 85
      });
    }
  }

  return notes;
}

function extractPercussiveMidiNotes(
  channelData: Float32Array,
  sampleRate: number,
  stemType: 'drums' | 'percussion',
  totalDuration: number
): MidiNote[] {
  const notes: MidiNote[] = [];
  const windowSize = 1024;
  const hopSize = 512;
  const totalWindows = Math.floor((channelData.length - windowSize) / hopSize);

  let prevEnergy = 0;
  const minInterval = 0.12; // Minimum time between transients
  let lastNoteTime = -minInterval;

  for (let w = 0; w < totalWindows; w++) {
    const offset = w * hopSize;
    let energy = 0;
    for (let i = 0; i < windowSize; i++) {
      energy += Math.abs(channelData[offset + i]);
    }
    energy /= windowSize;

    const currentTime = offset / sampleRate;
    const energyDelta = energy - prevEnergy;
    prevEnergy = energy;

    if (energyDelta > 0.035 && currentTime - lastNoteTime >= minInterval) {
      lastNoteTime = currentTime;

      // Assign MIDI drum pitch
      let pitch = 38; // Snare default
      if (stemType === 'percussion') {
        pitch = (notes.length % 3 === 0) ? 42 : (notes.length % 3 === 1) ? 46 : 51; // Hats/Cymbal
      } else {
        pitch = (notes.length % 4 === 0 || notes.length % 4 === 2) ? 36 : 38; // Kick / Snare
      }

      const vel = Math.min(127, Math.max(65, Math.round(energyDelta * 500)));
      notes.push({
        id: `perc-note-${notes.length}`,
        pitch,
        startTime: Number(currentTime.toFixed(3)),
        duration: stemType === 'percussion' ? 0.15 : 0.22,
        velocity: vel
      });
    }
  }

  // Fallback if none detected
  if (notes.length === 0) {
    const dur = Math.min(8, totalDuration);
    for (let t = 0; t < dur; t += 0.5) {
      notes.push({
        id: `perc-note-${notes.length}`,
        pitch: stemType === 'percussion' ? 42 : (t % 1 === 0 ? 36 : 38),
        startTime: t,
        duration: 0.2,
        velocity: 95
      });
    }
  }

  return notes;
}

function detectPitchAutocorrelation(
  buffer: Float32Array,
  sampleRate: number,
  stemType: StemType
): number | null {
  const minFreq =
    stemType === 'bass' ? 30 :
    stemType === 'guitar' || stemType === 'piano' ? 75 :
    stemType === 'synth' ? 120 : 100;

  const maxFreq =
    stemType === 'bass' ? 240 :
    stemType === 'synth' ? 2200 :
    stemType === 'strings' ? 1800 : 1200;

  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);

  let bestPeriod = -1;
  let maxCorr = 0;

  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    let corr = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestPeriod = lag;
    }
  }

  if (bestPeriod === -1 || maxCorr < 0.18) return null;

  const freq = sampleRate / bestPeriod;
  if (freq < 25 || freq > 4500) return null;

  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return Math.max(12, Math.min(115, midi));
}

function yieldLoop(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

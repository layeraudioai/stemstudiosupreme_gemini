/**
 * Offline Audio Renderer
 * Renders MIDI songs + SoundFont / General MIDI synthesis into WAV or MP3
 */
import { MidiSong, SF2Bank } from '../types';
import { midiToFrequency } from './audioContext';
import { audioBufferToMp3Blob, audioBufferToWavBlob, ExportProgressCallback } from './mp3Encoder';

export interface RenderOptions {
  format: 'mp3' | 'wav';
  kbps?: 128 | 192 | 256 | 320;
  soundfont?: SF2Bank | null;
  onProgress?: ExportProgressCallback;
}

export async function renderMidiSongToAudio(
  song: MidiSong,
  options: RenderOptions
): Promise<{ blob: Blob; audioBuffer: AudioBuffer }> {
  const sampleRate = 44100;
  const duration = Math.max(1, song.duration + 1.5); // Add 1.5s reverb decay
  const totalSamples = Math.floor(sampleRate * duration);

  const onProgress = options.onProgress;
  if (onProgress) onProgress(5, 'Initializing Offline Synthesizer context...');

  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  // Master Gain and Limiter
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.85;

  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1.5;
  limiter.ratio.value = 16;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;

  // Simple algorithmic reverb
  const reverb = offlineCtx.createConvolver();
  const revLen = sampleRate * 1.2;
  const revBuf = offlineCtx.createBuffer(2, revLen, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = revBuf.getChannelData(ch);
    for (let i = 0; i < revLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.35));
    }
  }
  reverb.buffer = revBuf;

  const reverbGain = offlineCtx.createGain();
  reverbGain.gain.value = 0.15;

  masterGain.connect(limiter);
  masterGain.connect(reverb);
  reverb.connect(reverbGain);
  reverbGain.connect(limiter);
  limiter.connect(offlineCtx.destination);

  if (onProgress) onProgress(20, 'Scheduling MIDI note events across tracks...');

  // Schedule notes
  for (let tIdx = 0; tIdx < song.tracks.length; tIdx++) {
    const track = song.tracks[tIdx];
    if (track.muted) continue;

    const trackVol = track.volume ?? 0.85;
    const trackPan = track.pan ?? 0;
    const isDrum = track.isDrumTrack || track.channel === 9;

    const panner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
    if (panner) panner.pan.value = Math.max(-1, Math.min(1, trackPan));

    for (const note of track.notes) {
      if (note.startTime >= duration) continue;

      const noteGain = offlineCtx.createGain();
      const normVel = Math.max(0.1, Math.min(1, note.velocity / 127));
      const gainVal = normVel * trackVol * 0.5;

      if (panner) {
        noteGain.connect(panner);
        panner.connect(masterGain);
      } else {
        noteGain.connect(masterGain);
      }

      const st = Math.max(0, note.startTime);
      const dur = Math.max(0.05, note.duration);
      const et = st + dur;

      if (isDrum) {
        scheduleDrumNote(offlineCtx, note.pitch, st, gainVal, noteGain);
      } else {
        scheduleMelodicNote(offlineCtx, note.pitch, track.program, st, dur, gainVal, noteGain);
      }
    }
  }

  if (onProgress) onProgress(50, 'Rendering high-resolution audio graph...');

  const renderedBuffer = await offlineCtx.startRendering();

  if (onProgress) onProgress(75, options.format === 'mp3' ? 'Encoding MP3 stream...' : 'Packaging WAV format...');

  let blob: Blob;
  if (options.format === 'wav') {
    blob = audioBufferToWavBlob(renderedBuffer);
  } else {
    blob = await audioBufferToMp3Blob(renderedBuffer, options.kbps || 192, onProgress);
  }

  if (onProgress) onProgress(100, 'Rendering finished!');

  return { blob, audioBuffer: renderedBuffer };
}

function scheduleMelodicNote(
  ctx: OfflineAudioContext,
  pitch: number,
  program: number,
  startTime: number,
  duration: number,
  gain: number,
  destGain: GainNode
): void {
  const freq = midiToFrequency(pitch);
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc2Gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  let oscType1: OscillatorType = 'triangle';
  let oscType2: OscillatorType = 'sawtooth';
  let detune = 5;
  let filterFreq = 4500;
  let attack = 0.01;
  let decay = 0.3;
  let sustain = 0.4;
  let release = 0.2;

  if (program >= 0 && program <= 7) {
    // Piano
    oscType1 = 'triangle';
    oscType2 = 'sawtooth';
    filterFreq = 5000;
    attack = 0.005;
    decay = 0.6;
    sustain = 0.3;
  } else if (program >= 32 && program <= 39) {
    // Bass
    oscType1 = 'sawtooth';
    oscType2 = 'sine';
    detune = -1200;
    filterFreq = 1400;
    attack = 0.005;
    decay = 0.25;
    sustain = 0.7;
    release = 0.1;
  } else if (program >= 80 && program <= 87) {
    // Synth Lead
    oscType1 = 'sawtooth';
    oscType2 = 'square';
    detune = 8;
    filterFreq = 6500;
    attack = 0.01;
    decay = 0.2;
    sustain = 0.8;
  } else if (program >= 88 && program <= 95) {
    // Pad
    oscType1 = 'sawtooth';
    oscType2 = 'sine';
    detune = 12;
    filterFreq = 3000;
    attack = 0.2;
    decay = 0.5;
    sustain = 0.8;
    release = 0.5;
  }

  osc1.type = oscType1;
  osc1.frequency.setValueAtTime(freq, startTime);
  osc2.type = oscType2;
  osc2.frequency.setValueAtTime(freq, startTime);
  osc2.detune.setValueAtTime(detune, startTime);
  osc2Gain.gain.value = 0.4;

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, startTime);

  // Envelope
  destGain.gain.setValueAtTime(0.0001, startTime);
  destGain.gain.linearRampToValueAtTime(gain, startTime + attack);
  destGain.gain.linearRampToValueAtTime(gain * sustain, startTime + attack + decay);
  destGain.gain.setValueAtTime(gain * sustain, startTime + duration);
  destGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release);

  osc1.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(destGain);

  osc1.start(startTime);
  osc2.start(startTime);
  osc1.stop(startTime + duration + release + 0.05);
  osc2.stop(startTime + duration + release + 0.05);
}

function scheduleDrumNote(
  ctx: OfflineAudioContext,
  pitch: number,
  startTime: number,
  gain: number,
  destGain: GainNode
): void {
  if (pitch === 35 || pitch === 36) {
    // Kick
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, startTime);
    osc.frequency.exponentialRampToValueAtTime(38, startTime + 0.1);

    destGain.gain.setValueAtTime(gain * 1.4, startTime);
    destGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);

    osc.connect(destGain);
    osc.start(startTime);
    osc.stop(startTime + 0.26);
  } else if (pitch === 38 || pitch === 40) {
    // Snare
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, startTime);
    osc.frequency.exponentialRampToValueAtTime(100, startTime + 0.08);

    destGain.gain.setValueAtTime(gain * 1.1, startTime);
    destGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);

    osc.connect(destGain);
    osc.start(startTime);
    osc.stop(startTime + 0.22);
  } else {
    // Hat
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, startTime);

    destGain.gain.setValueAtTime(gain * 0.7, startTime);
    destGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.08);

    osc.connect(destGain);
    osc.start(startTime);
    osc.stop(startTime + 0.1);
  }
}

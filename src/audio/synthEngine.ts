/**
 * Web Audio Polyphonic Synthesizer Engine
 * Supports both General MIDI synthesis and SoundFont 2 (SF2) multi-sample playback
 */
import { SF2Bank, SF2Sample } from '../types';
import { getAudioContext, midiToFrequency } from './audioContext';

interface ActiveVoice {
  stop: (time?: number) => void;
  node: AudioNode;
}

export class SynthEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private compressor: DynamicsCompressorNode;
  private reverbNode: ConvolverNode;
  private reverbGain: GainNode;
  private activeVoices = new Map<string, ActiveVoice>();
  private currentSF2Bank: SF2Bank | null = null;
  private onNoteActiveCallback?: (note: number, channel: number, isActive: boolean) => void;

  constructor() {
    this.ctx = getAudioContext();

    // Master chain: limiter/compressor -> masterGain -> destination
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-3, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(4, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    // Algorithmic impulse response for reverb
    this.reverbNode = this.ctx.createConvolver();
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    this.initReverbImpulse();

    // Connect
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
  }

  private initReverbImpulse(): void {
    const rate = this.ctx.sampleRate;
    const length = rate * 1.5; // 1.5s decay
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (rate * 0.4));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.reverbNode.buffer = impulse;
  }

  public setMasterVolume(vol: number): void {
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.05);
  }

  public setSoundFont(bank: SF2Bank | null): void {
    this.currentSF2Bank = bank;
  }

  public loadSoundFont(bank: SF2Bank | null): void {
    this.setSoundFont(bank);
  }

  public getSoundFont(): SF2Bank | null {
    return this.currentSF2Bank;
  }

  public setNoteCallback(cb?: (note: number, channel: number, isActive: boolean) => void): void {
    this.onNoteActiveCallback = cb;
  }

  /**
   * Play a note
   */
  public noteOn(
    pitch: number,
    velocity = 90,
    program = 0,
    channel = 0,
    isDrum = false,
    options?: { volume?: number; pan?: number; time?: number }
  ): void {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const key = `${channel}-${pitch}`;
    this.noteOff(pitch, channel);

    const startTime = options?.time ?? this.ctx.currentTime;
    const normVel = Math.max(0.1, Math.min(1, velocity / 127));
    const trackVol = options?.volume ?? 1;
    const trackPan = options?.pan ?? 0;

    // Route voice through stereo panner & gain
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, trackPan)), startTime);
    }

    const voiceGain = this.ctx.createGain();
    const finalGain = normVel * trackVol * 0.7;

    if (panner) {
      voiceGain.connect(panner);
      panner.connect(this.masterGain);
      panner.connect(this.reverbNode);
    } else {
      voiceGain.connect(this.masterGain);
      voiceGain.connect(this.reverbNode);
    }

    let activeVoice: ActiveVoice;

    // Check if we can play from the loaded SF2 Bank
    const sf2Sample = this.findMatchingSF2Sample(pitch, program);
    if (sf2Sample && !isDrum) {
      activeVoice = this.playSF2Sample(sf2Sample, pitch, finalGain, voiceGain, startTime);
    } else if (isDrum || channel === 9) {
      activeVoice = this.playDrumSound(pitch, finalGain, voiceGain, startTime);
    } else {
      activeVoice = this.playGeneralMidiSynth(pitch, program, finalGain, voiceGain, startTime);
    }

    this.activeVoices.set(key, activeVoice);
    if (this.onNoteActiveCallback) {
      this.onNoteActiveCallback(pitch, channel, true);
    }
  }

  /**
   * Stop a note
   */
  public noteOff(pitch: number, channel = 0, time?: number): void {
    const key = `${channel}-${pitch}`;
    const voice = this.activeVoices.get(key);
    if (voice) {
      const stopTime = time ?? this.ctx.currentTime;
      voice.stop(stopTime);
      this.activeVoices.delete(key);
    }
    if (this.onNoteActiveCallback) {
      this.onNoteActiveCallback(pitch, channel, false);
    }
  }

  public stopAllNotes(): void {
    const now = this.ctx.currentTime;
    this.activeVoices.forEach(voice => {
      try {
        voice.stop(now);
      } catch {
        // ignore already stopped
      }
    });
    this.activeVoices.clear();
  }

  public allNotesOff(): void {
    this.stopAllNotes();
  }

  private findMatchingSF2Sample(pitch: number, _program: number): SF2Sample | null {
    if (!this.currentSF2Bank || this.currentSF2Bank.presets.length === 0) return null;
    // Find sample in active preset
    const preset = this.currentSF2Bank.presets[0];
    if (!preset || preset.instruments.length === 0) return null;
    const inst = preset.instruments[0];
    if (!inst || inst.samples.length === 0) return null;

    // Find best matching key range or closest rootKey
    let bestMatch: SF2Sample | null = null;
    let minDistance = 999;

    for (const sample of inst.samples) {
      if (pitch >= sample.keyRange[0] && pitch <= sample.keyRange[1]) {
        return sample;
      }
      const dist = Math.abs(sample.rootKey - pitch);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = sample;
      }
    }
    return bestMatch;
  }

  private playSF2Sample(
    sample: SF2Sample,
    pitch: number,
    finalGain: number,
    voiceGain: GainNode,
    startTime: number
  ): ActiveVoice {
    const source = this.ctx.createBufferSource();
    source.buffer = sample.audioBuffer;

    // Calculate resample playback rate
    const semitoneDiff = pitch - sample.rootKey + (sample.fineTune || 0) / 100;
    const rateMultiplier = Math.pow(2, semitoneDiff / 12);
    source.playbackRate.setValueAtTime(rateMultiplier, startTime);

    if (sample.loopMode && sample.loopEnd > sample.loopStart) {
      source.loop = true;
      source.loopStart = sample.loopStart / sample.audioBuffer.sampleRate;
      source.loopEnd = sample.loopEnd / sample.audioBuffer.sampleRate;
    }

    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(sample.filterCutoff || 18000, startTime);

    // Envelope
    const attack = Math.max(0.005, sample.attack || 0.01);
    const decay = Math.max(0.01, sample.decay || 0.2);
    const sustain = Math.max(0.1, sample.sustain || 0.7);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(finalGain, startTime + attack);
    voiceGain.gain.linearRampToValueAtTime(finalGain * sustain, startTime + attack + decay);

    source.connect(filter);
    filter.connect(voiceGain);

    source.start(startTime);

    return {
      node: source,
      stop: (stopTime = this.ctx.currentTime) => {
        const release = Math.max(0.05, sample.release || 0.3);
        voiceGain.gain.cancelScheduledValues(stopTime);
        voiceGain.gain.setValueAtTime(voiceGain.gain.value, stopTime);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + release);
        source.stop(stopTime + release + 0.05);
      }
    };
  }

  private playGeneralMidiSynth(
    pitch: number,
    program: number,
    finalGain: number,
    voiceGain: GainNode,
    startTime: number
  ): ActiveVoice {
    const freq = midiToFrequency(pitch);

    // Configure oscillators based on General MIDI Program families
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc2Gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    let oscType1: OscillatorType = 'sine';
    let oscType2: OscillatorType = 'triangle';
    let detune2 = 0;
    let filterFreq = 6000;
    let attack = 0.01;
    let decay = 0.3;
    let sustain = 0.5;
    let release = 0.3;

    if (program >= 0 && program <= 7) {
      // Pianos
      oscType1 = 'triangle';
      oscType2 = program === 4 || program === 5 ? 'sine' : 'sawtooth'; // E-Piano vs Grand
      detune2 = 4;
      osc2Gain.gain.value = 0.25;
      filterFreq = program === 1 ? 7500 : 4500;
      attack = 0.005;
      decay = 0.6;
      sustain = 0.3;
      release = 0.4;
    } else if (program >= 16 && program <= 23) {
      // Organs
      oscType1 = 'sine';
      oscType2 = 'triangle';
      detune2 = 3;
      osc2Gain.gain.value = 0.5;
      filterFreq = 8000;
      attack = 0.01;
      decay = 0.1;
      sustain = 0.9;
      release = 0.1;
    } else if (program >= 24 && program <= 31) {
      // Guitars
      oscType1 = program >= 28 ? 'sawtooth' : 'triangle';
      oscType2 = 'sawtooth';
      detune2 = 6;
      osc2Gain.gain.value = program >= 28 ? 0.6 : 0.2;
      filterFreq = program >= 28 ? 5000 : 3500;
      attack = 0.008;
      decay = 0.4;
      sustain = 0.35;
      release = 0.25;
    } else if (program >= 32 && program <= 39) {
      // Basses
      oscType1 = program >= 38 ? 'sawtooth' : 'triangle';
      oscType2 = 'sine';
      detune2 = -1200; // sub-octave
      osc2Gain.gain.value = 0.7;
      filterFreq = program >= 38 ? 2200 : 1200;
      attack = 0.005;
      decay = 0.3;
      sustain = 0.6;
      release = 0.15;
    } else if (program >= 40 && program <= 55) {
      // Strings & Ensemble
      oscType1 = 'sawtooth';
      oscType2 = 'sawtooth';
      detune2 = 12; // rich chorus detune
      osc2Gain.gain.value = 0.5;
      filterFreq = 4000;
      attack = 0.12;
      decay = 0.5;
      sustain = 0.8;
      release = 0.6;
    } else if (program >= 56 && program <= 63) {
      // Brass
      oscType1 = 'sawtooth';
      oscType2 = 'triangle';
      detune2 = 8;
      osc2Gain.gain.value = 0.4;
      filterFreq = 3000;
      attack = 0.04;
      decay = 0.3;
      sustain = 0.75;
      release = 0.2;
    } else if (program >= 64 && program <= 79) {
      // Reeds & Pipes
      oscType1 = 'triangle';
      oscType2 = 'sine';
      detune2 = 5;
      osc2Gain.gain.value = 0.4;
      filterFreq = 3500;
      attack = 0.03;
      decay = 0.2;
      sustain = 0.8;
      release = 0.15;
    } else if (program >= 80 && program <= 87) {
      // Synth Leads
      oscType1 = program % 2 === 0 ? 'square' : 'sawtooth';
      oscType2 = 'sawtooth';
      detune2 = 10;
      osc2Gain.gain.value = 0.5;
      filterFreq = 5500;
      attack = 0.01;
      decay = 0.2;
      sustain = 0.8;
      release = 0.25;
    } else if (program >= 88 && program <= 95) {
      // Synth Pads
      oscType1 = 'sawtooth';
      oscType2 = 'sine';
      detune2 = 15;
      osc2Gain.gain.value = 0.6;
      filterFreq = 2800;
      attack = 0.25;
      decay = 0.8;
      sustain = 0.85;
      release = 0.8;
    } else {
      // Default GM Instrument
      oscType1 = 'triangle';
      oscType2 = 'sine';
      detune2 = 5;
      osc2Gain.gain.value = 0.3;
      filterFreq = 4000;
      attack = 0.01;
      decay = 0.3;
      sustain = 0.5;
      release = 0.3;
    }

    osc1.type = oscType1;
    osc1.frequency.setValueAtTime(freq, startTime);

    osc2.type = oscType2;
    osc2.frequency.setValueAtTime(freq, startTime);
    osc2.detune.setValueAtTime(detune2, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);

    // Apply Envelope
    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(finalGain, startTime + attack);
    voiceGain.gain.linearRampToValueAtTime(finalGain * sustain, startTime + attack + decay);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(voiceGain);

    osc1.start(startTime);
    osc2.start(startTime);

    return {
      node: filter,
      stop: (stopTime = this.ctx.currentTime) => {
        voiceGain.gain.cancelScheduledValues(stopTime);
        voiceGain.gain.setValueAtTime(voiceGain.gain.value, stopTime);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + release);
        osc1.stop(stopTime + release + 0.05);
        osc2.stop(stopTime + release + 0.05);
      }
    };
  }

  private playDrumSound(
    pitch: number,
    finalGain: number,
    voiceGain: GainNode,
    startTime: number
  ): ActiveVoice {
    // General MIDI Drum mapping
    if (pitch === 35 || pitch === 36) {
      // Bass / Kick Drum
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, startTime);
      osc.frequency.exponentialRampToValueAtTime(38, startTime + 0.12);

      voiceGain.gain.setValueAtTime(finalGain * 1.3, startTime);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);

      osc.connect(voiceGain);
      osc.start(startTime);
      osc.stop(startTime + 0.32);

      return {
        node: osc,
        stop: (t = this.ctx.currentTime) => osc.stop(t)
      };
    }

    if (pitch === 38 || pitch === 40) {
      // Snare Drum (tonal body + noise snap)
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, startTime);
      osc.frequency.exponentialRampToValueAtTime(100, startTime + 0.1);

      const bufferSize = this.ctx.sampleRate * 0.2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(1200, startTime);

      voiceGain.gain.setValueAtTime(finalGain * 1.1, startTime);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

      osc.connect(voiceGain);
      noise.connect(noiseFilter);
      noiseFilter.connect(voiceGain);

      osc.start(startTime);
      noise.start(startTime);
      osc.stop(startTime + 0.25);
      noise.stop(startTime + 0.25);

      return {
        node: osc,
        stop: (t = this.ctx.currentTime) => {
          osc.stop(t);
          noise.stop(t);
        }
      };
    }

    // Hi-hats and Cymbals (pitch 42, 44, 46, 49, 51, etc.)
    const isCymbal = pitch >= 49;
    const dur = isCymbal ? 0.6 : 0.08;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(isCymbal ? 5500 : 7000, startTime);

    voiceGain.gain.setValueAtTime(finalGain * 0.9, startTime);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    noise.connect(filter);
    filter.connect(voiceGain);

    noise.start(startTime);
    noise.stop(startTime + dur + 0.02);

    return {
      node: noise,
      stop: (t = this.ctx.currentTime) => noise.stop(t)
    };
  }
}

let sharedSynth: SynthEngine | null = null;
export function getSynthEngine(): SynthEngine {
  if (!sharedSynth) {
    sharedSynth = new SynthEngine();
  }
  return sharedSynth;
}

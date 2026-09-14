/**
 * Seeded SF2 SoundFont Instrument Generator & Randomizer
 * Procedurally generates realistic, playable multi-sample SF2 instruments and presets.
 */
import { SF2Instrument, SF2Preset, SF2Sample } from '../types';
import { SeededPRNG } from './seededRandom';
import { getAudioContext } from './audioContext';

export type SF2SynthArchetype =
  | 'supersaw'
  | 'fm_bell'
  | 'sub_bass'
  | 'chiptune'
  | 'ambient_pad'
  | 'analog_pluck'
  | 'organ'
  | 'percussion';

export interface SeededSF2GenOptions {
  seed: string | number;
  archetype: SF2SynthArchetype;
  name?: string;
  rootKey?: number;
}

export interface SeededSF2MutateOptions {
  seed: string | number;
  intensity?: 'subtle' | 'moderate' | 'wild';
  mutateEnvelope?: boolean;
  mutateFilter?: boolean;
  mutateTuning?: boolean;
  mutateLoops?: boolean;
}

/**
 * Generate a complete SF2 Instrument & Preset from scratch using a deterministic seed.
 */
export function generateSeededSF2Instrument(options: SeededSF2GenOptions): {
  preset: SF2Preset;
  instrument: SF2Instrument;
  sample: SF2Sample;
} {
  const prng = new SeededPRNG(options.seed);
  const archetype = options.archetype;
  const ctx = getAudioContext();
  const sampleRate = 44100;

  // Set default root key based on archetype
  const defaultRoot = archetype === 'sub_bass' ? 36 : archetype === 'percussion' ? 36 : 60;
  const rootKey = options.rootKey ?? defaultRoot;
  const f0 = 440 * Math.pow(2, (rootKey - 69) / 12);

  // Determine duration and loop behavior
  const isLooping = archetype === 'ambient_pad' || archetype === 'supersaw' || archetype === 'organ';
  const duration = isLooping ? 2.5 : archetype === 'percussion' ? 0.6 : archetype === 'analog_pluck' ? 1.4 : 2.0;
  const totalSamples = Math.floor(sampleRate * duration);

  const audioBuffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = audioBuffer.getChannelData(0);

  // Synthesis parameters seeded deterministically
  const fmRatio = prng.choice([1.414, 2.0, 2.75, 3.14, 0.5, 3.0]);
  const fmModIndex = prng.nextFloat(1.5, 4.5);
  const detuneSpread = prng.nextFloat(0.003, 0.012);
  const organHarmonics = [1.0, prng.nextFloat(0.4, 0.9), prng.nextFloat(0.2, 0.6), prng.nextFloat(0.1, 0.4)];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    switch (archetype) {
      case 'supersaw': {
        // 5-oscillator detuned saw
        const env = Math.min(1, t * 20); // quick attack
        const s1 = 2 * ((t * f0) % 1) - 1;
        const s2 = 2 * ((t * f0 * (1 + detuneSpread)) % 1) - 1;
        const s3 = 2 * ((t * f0 * (1 - detuneSpread)) % 1) - 1;
        const s4 = 2 * ((t * f0 * (1 + detuneSpread * 2)) % 1) - 1;
        const s5 = 2 * ((t * f0 * (1 - detuneSpread * 2)) % 1) - 1;
        s = ((s1 + s2 + s3 + s4 + s5) / 5) * env;
        break;
      }

      case 'fm_bell': {
        // 2-Operator FM with decaying modulation index
        const envCarrier = Math.exp(-t * 2.2);
        const envMod = Math.exp(-t * 4.5);
        const mod = Math.sin(2 * Math.PI * (f0 * fmRatio) * t) * (fmModIndex * envMod);
        s = Math.sin(2 * Math.PI * f0 * t + mod) * envCarrier;
        break;
      }

      case 'sub_bass': {
        // 808 Sub-Bass with exponential pitch drop
        const pitchDrop = 40 * Math.exp(-t * 30);
        const env = Math.exp(-t * 2.0);
        const currentF = f0 + pitchDrop;
        s = (Math.sin(2 * Math.PI * currentF * t) * 0.7 +
             Math.sin(4 * Math.PI * currentF * t) * 0.2 +
             Math.sin(6 * Math.PI * currentF * t) * 0.1) * env;
        break;
      }

      case 'chiptune': {
        // Authentic retro pulse wave (25% or 50% duty cycle)
        const duty = prng.choice([0.25, 0.5, 0.125]);
        const cycle = (t * f0) % 1;
        const square = cycle < duty ? 0.7 : -0.7;
        const env = Math.exp(-t * 1.8);
        s = square * env;
        break;
      }

      case 'ambient_pad': {
        // Lush warm detuned sine + soft triangle
        const lfo = Math.sin(2 * Math.PI * 1.5 * t) * 0.2;
        const ph1 = 2 * Math.PI * f0 * t;
        const ph2 = 2 * Math.PI * (f0 * 1.004) * t;
        const s1 = Math.sin(ph1);
        const s2 = Math.sin(ph2);
        const env = Math.min(1, t * 1.5);
        s = ((s1 + s2) * 0.45) * env * (1 + lfo);
        break;
      }

      case 'analog_pluck': {
        // Karplus-Strong / fast decay pluck
        const env = Math.exp(-t * 4.5);
        const harmonic = Math.sin(2 * Math.PI * f0 * t) +
                         0.5 * Math.sin(4 * Math.PI * f0 * t) +
                         0.25 * Math.sin(6 * Math.PI * f0 * t);
        s = harmonic * env;
        break;
      }

      case 'organ': {
        // Multi-drawbar additive organ
        s = (Math.sin(2 * Math.PI * f0 * t) * organHarmonics[0] +
             Math.sin(2 * Math.PI * (f0 * 2) * t) * organHarmonics[1] +
             Math.sin(2 * Math.PI * (f0 * 3) * t) * organHarmonics[2] +
             Math.sin(2 * Math.PI * (f0 * 4) * t) * organHarmonics[3]) * 0.35;
        break;
      }

      case 'percussion': {
        // Percussive hit
        const kf = 160 * Math.exp(-t * 40) + 45;
        const kick = Math.sin(2 * Math.PI * kf * t) * Math.exp(-t * 18);
        const noise = (prng.next() * 2 - 1) * Math.exp(-t * 28) * 0.3;
        s = kick * 0.8 + noise;
        break;
      }
    }

    data[i] = Math.max(-1, Math.min(1, s));
  }

  // Find natural zero-crossing for loop points if looping
  let loopStart = Math.floor(sampleRate * 0.5);
  let loopEnd = Math.floor(sampleRate * (duration - 0.2));

  if (isLooping) {
    // Snap to positive-going zero crossing
    for (let j = loopStart; j < loopStart + 1000; j++) {
      if (data[j] <= 0 && data[j + 1] > 0) {
        loopStart = j;
        break;
      }
    }
    for (let j = loopEnd; j > loopEnd - 1000; j--) {
      if (data[j] <= 0 && data[j + 1] > 0) {
        loopEnd = j;
        break;
      }
    }
  }

  // Envelope Generator defaults based on archetype
  const adsrSettings = {
    supersaw: { attack: 0.02, decay: 0.8, sustain: 0.85, release: 0.4, filter: 16000 },
    fm_bell: { attack: 0.005, decay: 1.2, sustain: 0.2, release: 0.8, filter: 18000 },
    sub_bass: { attack: 0.01, decay: 0.4, sustain: 0.6, release: 0.25, filter: 4500 },
    chiptune: { attack: 0.005, decay: 0.3, sustain: 0.7, release: 0.15, filter: 20000 },
    ambient_pad: { attack: 0.5, decay: 1.5, sustain: 0.9, release: 1.2, filter: 8500 },
    analog_pluck: { attack: 0.008, decay: 0.5, sustain: 0.15, release: 0.3, filter: 12000 },
    organ: { attack: 0.01, decay: 0.2, sustain: 0.95, release: 0.1, filter: 19000 },
    percussion: { attack: 0.002, decay: 0.3, sustain: 0.0, release: 0.15, filter: 14000 }
  }[archetype];

  const cleanName = options.name || `${archetype.replace('_', ' ').toUpperCase()} [${String(options.seed).slice(0, 6)}]`;
  const sampleId = `sample-gen-${prng.nextInt(100000, 999999)}`;
  const instId = `inst-gen-${prng.nextInt(100000, 999999)}`;
  const presetId = `preset-gen-${prng.nextInt(100000, 999999)}`;

  const sample: SF2Sample = {
    id: sampleId,
    name: cleanName,
    audioBuffer,
    rootKey,
    keyRange: [0, 127],
    loopStart,
    loopEnd,
    loopMode: isLooping,
    sampleRate,
    fineTune: prng.nextInt(-10, 10),
    attack: adsrSettings.attack,
    decay: adsrSettings.decay,
    sustain: adsrSettings.sustain,
    release: adsrSettings.release,
    filterCutoff: adsrSettings.filter
  };

  const instrument: SF2Instrument = {
    id: instId,
    name: cleanName,
    samples: [sample]
  };

  const preset: SF2Preset = {
    id: presetId,
    name: cleanName,
    bank: archetype === 'percussion' ? 128 : 0,
    presetNum: prng.nextInt(1, 127),
    instruments: [instrument]
  };

  return { preset, instrument, sample };
}

/**
 * Deterministically randomizes / mutates an existing SF2Sample using a seed.
 */
export function randomizeSF2SampleWithSeed(
  sample: SF2Sample,
  seed: string | number,
  options: SeededSF2MutateOptions = { seed }
): SF2Sample {
  const prng = new SeededPRNG(seed);
  const intensity = options.intensity || 'moderate';

  let attack = sample.attack;
  let decay = sample.decay;
  let sustain = sample.sustain;
  let release = sample.release;
  let filterCutoff = sample.filterCutoff;
  let fineTune = sample.fineTune;
  let loopStart = sample.loopStart;
  let loopEnd = sample.loopEnd;

  if (options.mutateEnvelope ?? true) {
    const factor = intensity === 'subtle' ? 0.25 : intensity === 'moderate' ? 0.6 : 1.2;
    attack = Math.max(0.002, Math.min(2.0, attack * (1 + prng.nextFloat(-factor, factor))));
    decay = Math.max(0.05, Math.min(3.5, decay * (1 + prng.nextFloat(-factor, factor))));
    sustain = Math.max(0.0, Math.min(1.0, sustain + prng.nextFloat(-factor * 0.4, factor * 0.4)));
    release = Math.max(0.05, Math.min(4.0, release * (1 + prng.nextFloat(-factor, factor))));
  }

  if (options.mutateFilter ?? true) {
    const filterDelta = intensity === 'subtle' ? 1500 : intensity === 'moderate' ? 4000 : 9000;
    filterCutoff = Math.max(400, Math.min(20000, filterCutoff + prng.nextInt(-filterDelta, filterDelta)));
  }

  if (options.mutateTuning ?? true) {
    const tuneDelta = intensity === 'subtle' ? 8 : intensity === 'moderate' ? 25 : 50;
    fineTune = Math.max(-99, Math.min(99, fineTune + prng.nextInt(-tuneDelta, tuneDelta)));
  }

  if (options.mutateLoops ?? true) {
    if (sample.loopMode && sample.audioBuffer) {
      const maxLen = sample.audioBuffer.length;
      const quarter = Math.floor(maxLen * 0.25);
      loopStart = prng.nextInt(0, quarter);
      loopEnd = prng.nextInt(Math.floor(maxLen * 0.75), maxLen - 100);
    }
  }

  return {
    ...sample,
    attack,
    decay,
    sustain,
    release,
    filterCutoff,
    fineTune,
    loopStart,
    loopEnd
  };
}

/**
 * Procedural Seeded Audio Stem Generator & Seeded Randomizer
 * Generates and mutates multitrack stems (AudioBuffer + MIDI notes) deterministically.
 */
import { AudioStem, MidiNote, StemType } from '../types';
import { SeededPRNG, MUSICAL_SCALES } from './seededRandom';
import { getAudioContext, extractPeaks } from './audioContext';
import { getStemDefinition } from './ensembleProfiles';

export interface SeededStemGenOptions {
  seed: string | number;
  type: StemType;
  bpm?: number;
  duration?: number;
  scaleKey?: keyof typeof MUSICAL_SCALES;
  rootPitch?: number; // Root MIDI note (e.g. 60 for C4, 36 for C2)
  name?: string;
}

export interface SeededStemMutateOptions {
  seed: string | number;
  intensity?: 'subtle' | 'moderate' | 'wild';
  mutateNotes?: boolean;
  mutateVelocities?: boolean;
  mutateTiming?: boolean;
  mutateSound?: boolean;
}

/**
 * Generate a complete AudioStem from scratch using a deterministic seed.
 */
export function generateSeededStem(options: SeededStemGenOptions): AudioStem {
  const prng = new SeededPRNG(options.seed);
  const bpm = options.bpm || 120;
  const duration = options.duration || 8.0;
  const scaleDef = MUSICAL_SCALES[options.scaleKey || 'minor_pentatonic'] || MUSICAL_SCALES.minor_pentatonic;
  const rootPitch = options.rootPitch ?? (options.type === 'bass' ? 36 : options.type === 'drums' ? 36 : 60);

  const stemId = `stem-gen-${prng.nextInt(100000, 999999)}`;
  const beatSec = 60 / bpm;
  const totalBeats = Math.floor(duration / beatSec);

  // 1. Generate procedural MIDI notes based on stem type and seed
  const midiNotes: MidiNote[] = [];

  if (options.type === 'drums') {
    // Drum pattern generation
    // Kick styles: 4-on-the-floor, breakbeat, or syncopated
    const kickPatternType = prng.nextInt(0, 2);
    for (let beat = 0; beat < totalBeats; beat++) {
      const beatPos = beat % 4;

      // Kick drum (MIDI 36)
      let hasKick = false;
      if (kickPatternType === 0) {
        hasKick = true; // 4-on-the-floor
      } else if (kickPatternType === 1) {
        hasKick = beatPos === 0 || (beatPos === 2 && prng.chance(0.8)) || (beatPos === 1 && prng.chance(0.3));
      } else {
        hasKick = beatPos === 0 || (beat % 2 === 0) || (prng.chance(0.25));
      }

      if (hasKick) {
        midiNotes.push({
          id: `kick-${beat}`,
          pitch: 36,
          startTime: beat * beatSec,
          duration: 0.2,
          velocity: prng.nextInt(100, 125)
        });
      }

      // Snare drum (MIDI 38) on 2 and 4 (beatPos 1 and 3)
      if (beatPos === 1 || beatPos === 3) {
        midiNotes.push({
          id: `snare-${beat}`,
          pitch: 38,
          startTime: beat * beatSec,
          duration: 0.25,
          velocity: prng.nextInt(95, 120)
        });
      }

      // Hi-Hats: 8th or 16th notes
      const hatDivisions = prng.choice([2, 4]); // 8ths or 16ths
      for (let h = 0; h < hatDivisions; h++) {
        const time = beat * beatSec + (h * beatSec) / hatDivisions;
        const isAccent = h === 0;
        const vel = isAccent ? prng.nextInt(85, 105) : prng.nextInt(60, 85);
        // Closed hat 42, open hat 46 occasionally
        const isCup = h === hatDivisions - 1 && prng.chance(0.2);
        midiNotes.push({
          id: `hat-${beat}-${h}`,
          pitch: isCup ? 46 : 42,
          startTime: time,
          duration: isCup ? 0.35 : 0.1,
          velocity: vel
        });
      }
    }
  } else if (options.type === 'bass') {
    // Bassline Generation: Root chord changes every 2 or 4 beats
    const chordRoots = [0, prng.choice([5, 7, 8]), prng.choice([3, 5, 10]), prng.choice([7, 5, 2])];
    const rhythmStyle = prng.choice(['driving8ths', 'syncopated', 'sustained', 'arpeggiated']);

    for (let beat = 0; beat < totalBeats; beat++) {
      const chordIdx = Math.floor(beat / 2) % chordRoots.length;
      const currentRoot = rootPitch + chordRoots[chordIdx];

      if (rhythmStyle === 'driving8ths') {
        for (let sub = 0; sub < 2; sub++) {
          const startTime = beat * beatSec + (sub * beatSec) / 2;
          const pitch = sub === 1 && prng.chance(0.3)
            ? currentRoot + prng.choice(scaleDef.intervals)
            : currentRoot;
          midiNotes.push({
            id: `bass-${beat}-${sub}`,
            pitch: Math.min(55, Math.max(28, pitch)),
            startTime,
            duration: (beatSec / 2) * 0.85,
            velocity: sub === 0 ? prng.nextInt(95, 115) : prng.nextInt(80, 100)
          });
        }
      } else if (rhythmStyle === 'syncopated') {
        if (beat % 2 === 0 || prng.chance(0.6)) {
          const octave = prng.chance(0.3) ? 12 : 0;
          midiNotes.push({
            id: `bass-${beat}`,
            pitch: Math.min(55, Math.max(28, currentRoot + octave)),
            startTime: beat * beatSec + (prng.chance(0.2) ? beatSec / 2 : 0),
            duration: beatSec * 0.7,
            velocity: prng.nextInt(90, 115)
          });
        }
      } else {
        // Sustained / 808 Style
        if (beat % 2 === 0) {
          midiNotes.push({
            id: `bass-${beat}`,
            pitch: Math.min(55, Math.max(28, currentRoot)),
            startTime: beat * beatSec,
            duration: beatSec * 1.8,
            velocity: prng.nextInt(100, 120)
          });
        }
      }
    }
  } else if (options.type === 'instruments') {
    // Instruments / Poly Chords / Arpeggios
    const chordRoots = [0, prng.choice([5, 7, 8]), prng.choice([3, 5, 10]), prng.choice([7, 5, 2])];
    const isArp = prng.chance(0.5);

    if (isArp) {
      // Arpeggio pattern
      for (let beat = 0; beat < totalBeats; beat++) {
        const chordIdx = Math.floor(beat / 2) % chordRoots.length;
        const currentRoot = rootPitch + chordRoots[chordIdx];
        const chordPitches = [currentRoot, currentRoot + 3, currentRoot + 7, currentRoot + 10];

        for (let sub = 0; sub < 4; sub++) {
          const p = chordPitches[sub % chordPitches.length];
          midiNotes.push({
            id: `arp-${beat}-${sub}`,
            pitch: p,
            startTime: beat * beatSec + (sub * beatSec) / 4,
            duration: (beatSec / 4) * 0.9,
            velocity: prng.nextInt(75, 100)
          });
        }
      }
    } else {
      // Sustained Chords (triads / 7ths)
      for (let beat = 0; beat < totalBeats; beat += 2) {
        const chordIdx = Math.floor(beat / 2) % chordRoots.length;
        const currentRoot = rootPitch + chordRoots[chordIdx];
        const chordIntervals = prng.choice([
          [0, 3, 7],      // Minor triad
          [0, 4, 7],      // Major triad
          [0, 3, 7, 10],  // Min 7
          [0, 4, 7, 11]   // Maj 7
        ]);

        chordIntervals.forEach((interval, idx) => {
          midiNotes.push({
            id: `chord-${beat}-${idx}`,
            pitch: currentRoot + interval,
            startTime: beat * beatSec,
            duration: beatSec * 1.85,
            velocity: prng.nextInt(70, 95)
          });
        });
      }
    }
  } else {
    // Vocals / Lead Melody
    let currentBeat = 0;
    while (currentBeat < totalBeats) {
      // Seeded phrasing: Note duration 0.5 to 2 beats
      const noteBeats = prng.choice([0.5, 0.5, 1.0, 1.0, 1.5, 2.0]);
      if (prng.chance(0.2)) {
        // Rest
        currentBeat += noteBeats;
        continue;
      }

      const interval = prng.choice(scaleDef.intervals);
      const octave = prng.choice([0, 12]);
      const pitch = rootPitch + 12 + interval + octave; // Higher register

      midiNotes.push({
        id: `lead-${currentBeat}`,
        pitch: Math.min(88, Math.max(55, pitch)),
        startTime: currentBeat * beatSec,
        duration: noteBeats * beatSec * prng.nextFloat(0.75, 0.95),
        velocity: prng.nextInt(85, 115)
      });

      currentBeat += noteBeats;
    }
  }

  // 2. Synthesize Real AudioBuffer matching the seeded stem
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.floor(sampleRate * duration);
  const audioBuffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);

  // Render notes into audio buffer
  midiNotes.forEach(note => {
    const startSample = Math.floor(note.startTime * sampleRate);
    const endSample = Math.min(totalSamples, startSample + Math.floor(note.duration * sampleRate));
    const velNorm = (note.velocity / 127);
    const f0 = 440 * Math.pow(2, (note.pitch - 69) / 12);

    for (let s = startSample; s < endSample; s++) {
      const t = (s - startSample) / sampleRate;
      const progress = (s - startSample) / (endSample - startSample);
      let sampleVal = 0;

      if (options.type === 'drums') {
        if (note.pitch === 36) {
          // Kick
          const kFreq = 150 * Math.exp(-t * 32) + 42;
          sampleVal = Math.sin(2 * Math.PI * kFreq * t) * Math.exp(-t * 14) * 1.2;
        } else if (note.pitch === 38) {
          // Snare
          const noise = (prng.next() * 2 - 1) * Math.exp(-t * 22);
          const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 28);
          sampleVal = (noise * 0.7 + tone * 0.4);
        } else {
          // Hi-Hat
          const noise = (prng.next() * 2 - 1) * Math.exp(-t * 60);
          sampleVal = noise * 0.45;
        }
      } else if (options.type === 'bass') {
        // Bass Synth
        const env = Math.exp(-t * 3.5);
        sampleVal = (
          Math.sin(2 * Math.PI * f0 * t) * 0.6 +
          Math.sin(4 * Math.PI * f0 * t) * 0.3 +
          Math.sin(6 * Math.PI * f0 * t) * 0.1
        ) * env * 0.8;
      } else if (options.type === 'instruments') {
        // Warm Poly / Arp Saw
        const env = Math.sin(Math.PI * Math.min(1, progress * 1.1)) * Math.exp(-t * 0.8);
        sampleVal = (
          Math.sin(2 * Math.PI * f0 * t) * 0.5 +
          Math.sin(2 * Math.PI * (f0 * 1.003) * t) * 0.3 +
          Math.sin(2 * Math.PI * (f0 * 0.997) * t) * 0.3
        ) * env * 0.35;
      } else {
        // Vocal / Lead
        const vibrato = Math.sin(2 * Math.PI * 5.5 * t) * 3;
        const env = Math.sin(Math.PI * Math.min(1, progress * 1.2));
        sampleVal = (
          Math.sin(2 * Math.PI * (f0 + vibrato) * t) * 0.5 +
          Math.sin(4 * Math.PI * (f0 + vibrato) * t) * 0.25
        ) * env * 0.4;
      }

      const finalVal = sampleVal * velNorm;
      left[s] += finalVal;
      right[s] += finalVal;
    }
  });

  // Normalize audio buffer slightly if loud
  let maxAmp = 0;
  for (let i = 0; i < totalSamples; i++) {
    const aL = Math.abs(left[i]);
    const aR = Math.abs(right[i]);
    if (aL > maxAmp) maxAmp = aL;
    if (aR > maxAmp) maxAmp = aR;
  }
  if (maxAmp > 0.95) {
    const scale = 0.95 / maxAmp;
    for (let i = 0; i < totalSamples; i++) {
      left[i] *= scale;
      right[i] *= scale;
    }
  }

  // Precompute peaks for visualizer
  const peaks = extractPeaks(audioBuffer);

  const def = getStemDefinition(options.type);
  const cleanName = options.name || `${def.name} (Seed: ${String(options.seed).slice(0, 8)})`;

  return {
    id: stemId,
    name: cleanName,
    type: options.type,
    audioBuffer,
    color: def.color,
    volume: 0.9,
    pan: prng.nextFloat(-0.25, 0.25),
    muted: false,
    solo: false,
    peaks,
    midiNotes,
    instrumentProgram: def.instrumentProgram,
    iconName: def.iconName
  };
}

/**
 * Deterministically randomizes / mutates an existing AudioStem using a seed.
 */
export function randomizeStemWithSeed(
  stem: AudioStem,
  seed: string | number,
  options: SeededStemMutateOptions = { seed }
): AudioStem {
  const prng = new SeededPRNG(seed);
  const intensity = options.intensity || 'moderate';
  const velJitter = intensity === 'subtle' ? 8 : intensity === 'moderate' ? 20 : 35;
  const timeJitter = intensity === 'subtle' ? 0.015 : intensity === 'moderate' ? 0.04 : 0.08;

  // 1. Mutate MIDI Notes deterministically
  const mutatedNotes: MidiNote[] = stem.midiNotes.map((note) => {
    let newPitch = note.pitch;
    let newStartTime = note.startTime;
    let newDuration = note.duration;
    let newVel = note.velocity;

    if (options.mutateNotes ?? true) {
      if (stem.type !== 'drums' && prng.chance(intensity === 'subtle' ? 0.15 : 0.35)) {
        // Minor interval shift or octave jump
        const shift = prng.choice(intensity === 'wild' ? [-12, -7, -5, 5, 7, 12] : [-2, -1, 1, 2]);
        newPitch = Math.min(108, Math.max(24, newPitch + shift));
      }
    }

    if (options.mutateVelocities ?? true) {
      const deltaVel = prng.nextInt(-velJitter, velJitter);
      newVel = Math.min(127, Math.max(40, newVel + deltaVel));
    }

    if (options.mutateTiming ?? true) {
      const deltaT = prng.nextFloat(-timeJitter, timeJitter);
      newStartTime = Math.max(0, newStartTime + deltaT);
      const deltaDur = prng.nextFloat(-timeJitter, timeJitter);
      newDuration = Math.max(0.08, newDuration + deltaDur);
    }

    return {
      ...note,
      pitch: newPitch,
      startTime: newStartTime,
      duration: newDuration,
      velocity: newVel
    };
  });

  // 2. Sound & Mix Adjustments
  let newPan = stem.pan;
  let newVolume = stem.volume;
  let newProgram = stem.instrumentProgram;

  if (options.mutateSound ?? true) {
    newPan = Math.max(-1, Math.min(1, stem.pan + prng.nextFloat(-0.2, 0.2)));
    newVolume = Math.max(0.4, Math.min(1.0, stem.volume + prng.nextFloat(-0.08, 0.08)));

    // GM variation within instrument family
    if (stem.type === 'bass') {
      newProgram = prng.choice([32, 33, 34, 35, 38, 39]); // Bass family
    } else if (stem.type === 'vocal') {
      newProgram = prng.choice([54, 80, 81, 84, 85]);     // Lead / Synth
    } else if (stem.type === 'instruments') {
      newProgram = prng.choice([0, 4, 5, 48, 50, 88, 89]); // Piano / Strings / Pad
    }
  }

  // 3. AudioBuffer processing (DSP volume & subtle modulation)
  let newBuffer = stem.audioBuffer;
  let newPeaks = stem.peaks;

  if (stem.audioBuffer) {
    const ctx = getAudioContext();
    const channels = stem.audioBuffer.numberOfChannels;
    const length = stem.audioBuffer.length;
    const sampleRate = stem.audioBuffer.sampleRate;

    newBuffer = ctx.createBuffer(channels, length, sampleRate);
    const panGainL = Math.cos(((newPan + 1) * Math.PI) / 4);
    const panGainR = Math.sin(((newPan + 1) * Math.PI) / 4);

    for (let c = 0; c < channels; c++) {
      const src = stem.audioBuffer.getChannelData(c);
      const dst = newBuffer.getChannelData(c);
      const panFactor = c === 0 ? panGainL : panGainR;

      for (let i = 0; i < length; i++) {
        dst[i] = src[i] * panFactor;
      }
    }
    newPeaks = extractPeaks(newBuffer);
  }

  return {
    ...stem,
    audioBuffer: newBuffer,
    peaks: newPeaks,
    midiNotes: mutatedNotes,
    volume: newVolume,
    pan: newPan,
    instrumentProgram: newProgram
  };
}

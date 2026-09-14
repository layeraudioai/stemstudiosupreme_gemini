/**
 * Seeded MIDI Track Generator & Seeded MIDI Track Randomizer
 * Enables procedural generation and deterministic mutation of standard MIDI tracks.
 */
import { MidiTrack, MidiNote } from '../types';
import { SeededPRNG, MUSICAL_SCALES } from './seededRandom';

export type MidiTrackRole = 'lead' | 'chords' | 'bass' | 'arp' | 'drums';

export interface SeededMidiTrackGenOptions {
  seed: string | number;
  role: MidiTrackRole;
  name?: string;
  bpm?: number;
  duration?: number;
  scaleKey?: keyof typeof MUSICAL_SCALES;
  rootPitch?: number;
  channel?: number;
}

export interface SeededMidiTrackMutateOptions {
  seed: string | number;
  intensity?: 'subtle' | 'moderate' | 'wild';
  mutatePitch?: boolean;
  mutateVelocity?: boolean;
  mutateRhythm?: boolean;
  mutateProgram?: boolean;
}

/**
 * Generate a brand-new MidiTrack from scratch using a deterministic seed.
 */
export function generateSeededMidiTrack(options: SeededMidiTrackGenOptions): MidiTrack {
  const prng = new SeededPRNG(options.seed);
  const bpm = options.bpm || 120;
  const duration = options.duration || 8.0;
  const beatSec = 60 / bpm;
  const totalBeats = Math.floor(duration / beatSec);

  const scaleDef = MUSICAL_SCALES[options.scaleKey || 'dorian'] || MUSICAL_SCALES.dorian;
  const rootPitch = options.rootPitch ?? (options.role === 'bass' ? 36 : options.role === 'drums' ? 36 : 60);
  const trackId = `track-gen-${prng.nextInt(100000, 999999)}`;

  const notes: MidiNote[] = [];

  // 1. Generate Notes by Role
  if (options.role === 'drums') {
    for (let beat = 0; beat < totalBeats; beat++) {
      const beatInMeasure = beat % 4;

      // Kick (36)
      if (beatInMeasure === 0 || (beatInMeasure === 2 && prng.chance(0.85)) || prng.chance(0.2)) {
        notes.push({
          id: `drum-k-${beat}`,
          pitch: 36,
          startTime: beat * beatSec,
          duration: 0.18,
          velocity: prng.nextInt(105, 127)
        });
      }

      // Snare (38)
      if (beatInMeasure === 1 || beatInMeasure === 3) {
        notes.push({
          id: `drum-s-${beat}`,
          pitch: 38,
          startTime: beat * beatSec,
          duration: 0.22,
          velocity: prng.nextInt(95, 120)
        });
      }

      // Closed Hat (42) / Open Hat (46)
      for (let sub = 0; sub < 2; sub++) {
        const time = beat * beatSec + (sub * beatSec) / 2;
        const isOpen = sub === 1 && prng.chance(0.15);
        notes.push({
          id: `drum-h-${beat}-${sub}`,
          pitch: isOpen ? 46 : 42,
          startTime: time,
          duration: isOpen ? 0.3 : 0.1,
          velocity: sub === 0 ? prng.nextInt(85, 105) : prng.nextInt(65, 85)
        });
      }
    }
  } else if (options.role === 'bass') {
    const chordProgressions = [0, prng.choice([5, 7]), prng.choice([3, 10]), prng.choice([7, 5, 2])];

    for (let beat = 0; beat < totalBeats; beat++) {
      const chordIdx = Math.floor(beat / 2) % chordProgressions.length;
      const root = rootPitch + chordProgressions[chordIdx];

      // 8th-note driving groove or syncopated
      const isSyncopated = prng.chance(0.4);
      if (isSyncopated) {
        notes.push({
          id: `bass-n-${beat}`,
          pitch: root,
          startTime: beat * beatSec + (prng.chance(0.3) ? beatSec / 2 : 0),
          duration: beatSec * 0.7,
          velocity: prng.nextInt(90, 115)
        });
      } else {
        for (let sub = 0; sub < 2; sub++) {
          notes.push({
            id: `bass-n-${beat}-${sub}`,
            pitch: sub === 1 && prng.chance(0.3) ? root + prng.choice(scaleDef.intervals) : root,
            startTime: beat * beatSec + (sub * beatSec) / 2,
            duration: (beatSec / 2) * 0.8,
            velocity: sub === 0 ? prng.nextInt(95, 115) : prng.nextInt(80, 95)
          });
        }
      }
    }
  } else if (options.role === 'chords') {
    const chordProgressions = [0, prng.choice([5, 7]), prng.choice([3, 10]), prng.choice([7, 5, 2])];
    for (let beat = 0; beat < totalBeats; beat += 2) {
      const chordIdx = Math.floor(beat / 2) % chordProgressions.length;
      const root = rootPitch + chordProgressions[chordIdx];
      const intervals = prng.choice([
        [0, 3, 7, 10], // Min 7
        [0, 4, 7, 11], // Maj 7
        [0, 2, 7, 9],  // Sus2/6
        [0, 3, 7]      // Triad
      ]);

      intervals.forEach((interval, idx) => {
        notes.push({
          id: `chord-${beat}-${idx}`,
          pitch: root + interval,
          startTime: beat * beatSec,
          duration: beatSec * 1.9,
          velocity: prng.nextInt(70, 90)
        });
      });
    }
  } else if (options.role === 'arp') {
    const chordProgressions = [0, prng.choice([5, 7]), prng.choice([3, 10]), prng.choice([7, 5, 2])];
    for (let beat = 0; beat < totalBeats; beat++) {
      const chordIdx = Math.floor(beat / 2) % chordProgressions.length;
      const root = rootPitch + chordProgressions[chordIdx];
      const pitches = [root, root + 3, root + 7, root + 12, root + 15, root + 12, root + 7, root + 3];

      for (let step = 0; step < 4; step++) {
        const p = pitches[(beat * 4 + step) % pitches.length];
        notes.push({
          id: `arp-${beat}-${step}`,
          pitch: p,
          startTime: beat * beatSec + (step * beatSec) / 4,
          duration: (beatSec / 4) * 0.85,
          velocity: prng.nextInt(75, 95)
        });
      }
    }
  } else {
    // Lead Melody
    let currentBeat = 0;
    while (currentBeat < totalBeats) {
      const durBeats = prng.choice([0.5, 0.5, 1.0, 1.0, 1.5, 2.0]);
      if (prng.chance(0.18)) {
        currentBeat += durBeats;
        continue;
      }
      const interval = prng.choice(scaleDef.intervals);
      const octave = prng.choice([0, 12]);
      const pitch = rootPitch + 12 + interval + octave;

      notes.push({
        id: `lead-${currentBeat}`,
        pitch: Math.min(92, Math.max(50, pitch)),
        startTime: currentBeat * beatSec,
        duration: durBeats * beatSec * prng.nextFloat(0.7, 0.95),
        velocity: prng.nextInt(85, 115)
      });
      currentBeat += durBeats;
    }
  }

  // 2. Program Selection
  const programMap: Record<MidiTrackRole, number[]> = {
    drums: [118],
    bass: [33, 34, 38, 39],
    chords: [0, 4, 5, 48, 88, 89],
    arp: [80, 81, 82],
    lead: [80, 81, 84, 54, 73]
  };
  const program = prng.choice(programMap[options.role] || [0]);

  // Color selection
  const colorMap: Record<MidiTrackRole, string> = {
    drums: '#f59e0b',
    bass: '#6366f1',
    chords: '#10b981',
    arp: '#06b6d4',
    lead: '#ec4899'
  };

  const name = options.name || `${options.role.toUpperCase()} (Seed: ${String(options.seed).slice(0, 8)})`;

  return {
    id: trackId,
    name,
    channel: options.channel ?? (options.role === 'drums' ? 9 : 0),
    program,
    notes,
    volume: 0.85,
    pan: prng.nextFloat(-0.3, 0.3),
    muted: false,
    solo: false,
    color: colorMap[options.role] || '#6366f1',
    isDrumTrack: options.role === 'drums'
  };
}

/**
 * Deterministically randomizes / mutates an existing MidiTrack using a seed.
 */
export function randomizeMidiTrackWithSeed(
  track: MidiTrack,
  seed: string | number,
  options: SeededMidiTrackMutateOptions = { seed }
): MidiTrack {
  const prng = new SeededPRNG(seed);
  const intensity = options.intensity || 'moderate';
  const velJitter = intensity === 'subtle' ? 10 : intensity === 'moderate' ? 22 : 36;
  const timeJitter = intensity === 'subtle' ? 0.015 : intensity === 'moderate' ? 0.035 : 0.07;

  // 1. Mutate Notes
  const mutatedNotes: MidiNote[] = track.notes.map((note) => {
    let newPitch = note.pitch;
    let newStart = note.startTime;
    let newDur = note.duration;
    let newVel = note.velocity;

    if (options.mutatePitch ?? true) {
      if (!track.isDrumTrack && track.channel !== 9) {
        if (prng.chance(intensity === 'subtle' ? 0.15 : intensity === 'moderate' ? 0.35 : 0.6)) {
          const shift = prng.choice(
            intensity === 'wild'
              ? [-12, -7, -5, -3, 3, 5, 7, 12]
              : [-2, -1, 1, 2]
          );
          newPitch = Math.min(108, Math.max(24, newPitch + shift));
        }
      }
    }

    if (options.mutateVelocity ?? true) {
      const deltaVel = prng.nextInt(-velJitter, velJitter);
      newVel = Math.min(127, Math.max(35, newVel + deltaVel));
    }

    if (options.mutateRhythm ?? true) {
      const deltaT = prng.nextFloat(-timeJitter, timeJitter);
      newStart = Math.max(0, newStart + deltaT);
      const deltaDur = prng.nextFloat(-timeJitter, timeJitter);
      newDur = Math.max(0.08, newDur + deltaDur);
    }

    return {
      ...note,
      pitch: newPitch,
      startTime: newStart,
      duration: newDur,
      velocity: newVel
    };
  });

  // 2. Mutate Program & Panning
  let newProg = track.program;
  let newPan = track.pan;
  let newVolume = track.volume;

  if (options.mutateProgram ?? true) {
    if (!track.isDrumTrack && track.channel !== 9) {
      // Pick a variation within general family
      const category = Math.floor(track.program / 8);
      const startProg = category * 8;
      newProg = prng.nextInt(startProg, startProg + 7);
    }
  }

  newPan = Math.max(-1, Math.min(1, (track.pan || 0) + prng.nextFloat(-0.2, 0.2)));
  newVolume = Math.max(0.4, Math.min(1.0, (track.volume ?? 0.85) + prng.nextFloat(-0.06, 0.06)));

  return {
    ...track,
    notes: mutatedNotes,
    program: newProg,
    pan: newPan,
    volume: newVolume
  };
}

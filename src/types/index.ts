/**
 * Unified types for StemStudio DAW (daw.66ghz.com),
 * SoundFont Studio (sf2.2kool4u.net), and
 * MIDI to MP3 Converter (midi.2kool4u.net).
 */

export type StudioTab = 'daw' | 'sf2' | 'midi';

export type PlaybackMode = 'stems' | 'gm_synth' | 'sf2_render';

export type StemType =
  | 'vocal'
  | 'backing_vocal'
  | 'drums'
  | 'percussion'
  | 'bass'
  | 'guitar'
  | 'piano'
  | 'strings'
  | 'brass'
  | 'synth'
  | 'ambient'
  | 'instruments'
  | 'other';

export interface StemDefinition {
  type: StemType;
  name: string;
  color: string;
  iconName: string;
  instrumentProgram: number;
  description: string;
  freqRange: string;
}

export interface EnsembleProfile {
  id: string;
  name: string;
  shortDesc: string;
  stemCount: number;
  badge: string;
  stems: StemType[];
}

export interface MidiNote {
  id: string;
  pitch: number; // 0 - 127
  startTime: number; // seconds
  duration: number; // seconds
  velocity: number; // 0 - 127
  channel?: number; // 0 - 15
}

export interface AudioStem {
  id: string;
  name: string;
  type: StemType;
  audioBuffer: AudioBuffer | null;
  color: string;
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
  peaks: number[]; // precomputed waveform peaks 0 to 1
  midiNotes: MidiNote[];
  instrumentProgram: number; // 0 to 127 GM
  iconName: string;
}

export interface MidiTrack {
  id: string;
  name: string;
  channel: number;
  program: number; // GM instrument index 0-127
  notes: MidiNote[];
  volume: number; // 0 - 1
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
  color: string;
  isDrumTrack?: boolean;
}

export interface MidiSong {
  name: string;
  bpm: number;
  timeSignature: [number, number];
  duration: number; // seconds
  tracks: MidiTrack[];
}

export interface SF2Sample {
  id: string;
  name: string;
  audioBuffer: AudioBuffer;
  rootKey: number; // MIDI key (0 - 127), e.g. 60 for C4
  keyRange: [number, number]; // [minKey, maxKey]
  loopStart: number;
  loopEnd: number;
  loopMode: boolean;
  sampleRate: number;
  fineTune: number; // cents -99 to +99
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0 - 1
  release: number; // seconds
  filterCutoff: number; // Hz (200 - 20000)
}

export interface SF2Instrument {
  id: string;
  name: string;
  samples: SF2Sample[];
}

export interface SF2Preset {
  id: string;
  name: string;
  bank: number;
  presetNum: number;
  instruments: SF2Instrument[];
}

export interface SF2Bank {
  id: string;
  name: string;
  author: string;
  comment: string;
  presets: SF2Preset[];
  isBuiltIn?: boolean;
  rawBuffer?: ArrayBuffer;
}

export interface SampleSlice {
  id: string;
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
  rootKey: number;
  name: string;
  audioBuffer?: AudioBuffer;
}

export interface TransportState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bpm: number;
  isLooping: boolean;
  masterVolume: number;
}

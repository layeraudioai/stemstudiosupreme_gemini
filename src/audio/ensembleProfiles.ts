/**
 * Dynamic Ensemble Profiles & Stem Definitions
 * Configurable stem counts (2 to 8 stems) and genre-specific instrument ensembles
 */
import { EnsembleProfile, StemDefinition, StemType } from '../types';

export const STEM_DEFINITIONS: Record<StemType, StemDefinition> = {
  vocal: {
    type: 'vocal',
    name: 'Lead Vocals',
    color: '#ec4899', // Pink
    iconName: 'Mic',
    instrumentProgram: 54, // Synth Voice / GM 54
    description: 'Center-channel lead vocal formants and main topline',
    freqRange: '280 Hz – 4.2 kHz (Mid-Center)'
  },
  backing_vocal: {
    type: 'backing_vocal',
    name: 'Backing Vocals',
    color: '#fb7185', // Rose
    iconName: 'Users',
    instrumentProgram: 52, // Choir Aahs / GM 52
    description: 'Stereo-panned harmonies, choir layers and ad-libs',
    freqRange: '350 Hz – 5.5 kHz (Stereo Sides)'
  },
  drums: {
    type: 'drums',
    name: 'Drums / Beat',
    color: '#f59e0b', // Amber
    iconName: 'Drum',
    instrumentProgram: 118, // Synth Drum
    description: 'Rhythmic kick thump, snare snap and main transient beat',
    freqRange: '60 Hz – 180 Hz & > 4.5 kHz'
  },
  percussion: {
    type: 'percussion',
    name: 'Percussion & Hats',
    color: '#fb923c', // Orange
    iconName: 'Sparkles',
    instrumentProgram: 116, // Taiko Drum / Woodblock
    description: 'Hi-hats, shakers, tambourine, claps and aux percussion',
    freqRange: '2.5 kHz – 16 kHz (High-Transients)'
  },
  bass: {
    type: 'bass',
    name: 'Bass & Sub-808',
    color: '#6366f1', // Indigo
    iconName: 'Activity',
    instrumentProgram: 33, // Electric Bass (finger)
    description: 'Sub-bass fundamental frequencies, 808s and groove root notes',
    freqRange: '30 Hz – 220 Hz (Mono Sub)'
  },
  guitar: {
    type: 'guitar',
    name: 'Guitars',
    color: '#0ea5e9', // Sky
    iconName: 'Music',
    instrumentProgram: 27, // Electric Guitar (clean)
    description: 'Acoustic strumming, electric riffing and rhythm chords',
    freqRange: '200 Hz – 4.8 kHz'
  },
  piano: {
    type: 'piano',
    name: 'Piano & Keys',
    color: '#10b981', // Emerald
    iconName: 'Piano',
    instrumentProgram: 0, // Acoustic Grand Piano
    description: 'Acoustic piano, electric piano, clavinet and organ keys',
    freqRange: '120 Hz – 5.2 kHz (Polyphonic)'
  },
  strings: {
    type: 'strings',
    name: 'Strings Ensemble',
    color: '#8b5cf6', // Violet
    iconName: 'Waves',
    instrumentProgram: 48, // String Ensemble 1
    description: 'Violin, cello, orchestral sweeps and lush legato string beds',
    freqRange: '250 Hz – 8.0 kHz'
  },
  brass: {
    type: 'brass',
    name: 'Brass & Horns',
    color: '#eab308', // Yellow
    iconName: 'Radio',
    instrumentProgram: 61, // Brass Section
    description: 'Trumpets, trombones, saxophones and punchy horn stabs',
    freqRange: '320 Hz – 6.5 kHz'
  },
  synth: {
    type: 'synth',
    name: 'Lead Synth & Arp',
    color: '#d946ef', // Fuchsia
    iconName: 'Zap',
    instrumentProgram: 81, // Lead 2 (sawtooth)
    description: 'Modern synthesizer hooks, arpeggiated riffs and saw leads',
    freqRange: '450 Hz – 9.0 kHz'
  },
  ambient: {
    type: 'ambient',
    name: 'Ambient & FX',
    color: '#14b8a6', // Teal
    iconName: 'Wind',
    instrumentProgram: 89, // Pad 2 (warm)
    description: 'Atmospheric sweeps, reverbs, delays, risers and texture beds',
    freqRange: '1.2 kHz – 18 kHz (Wide Stereo)'
  },
  instruments: {
    type: 'instruments',
    name: 'Poly Instruments',
    color: '#059669', // Deep Emerald
    iconName: 'Sliders',
    instrumentProgram: 4, // Electric Piano 1
    description: 'Full harmonic polyphonic blend and mid-range instrumentation',
    freqRange: '180 Hz – 7.5 kHz'
  },
  other: {
    type: 'other',
    name: 'Residual / Other',
    color: '#94a3b8', // Slate
    iconName: 'Layers',
    instrumentProgram: 0, // Piano
    description: 'Subtractive residual audio and auxiliary harmonic remainder',
    freqRange: 'Full Spectrum Residual'
  }
};

export const ENSEMBLE_PROFILES: EnsembleProfile[] = [
  {
    id: 'karaoke_2',
    name: '2-Stem (Karaoke & Acapella)',
    shortDesc: 'Vocals + Complete Instrumental',
    stemCount: 2,
    badge: '2 Stems',
    stems: ['vocal', 'instruments']
  },
  {
    id: 'standard_4',
    name: '4-Stem (Standard Studio)',
    shortDesc: 'Vocals, Drums, Bass, Instruments',
    stemCount: 4,
    badge: '4 Stems',
    stems: ['vocal', 'drums', 'bass', 'instruments']
  },
  {
    id: 'pop_rock_5',
    name: '5-Stem (Pop & Rock Band)',
    shortDesc: 'Vocals, Drums, Bass, Guitars, Piano & Keys',
    stemCount: 5,
    badge: '5 Stems',
    stems: ['vocal', 'drums', 'bass', 'guitar', 'piano']
  },
  {
    id: 'hiphop_5',
    name: '5-Stem (Hip-Hop & Urban 808)',
    shortDesc: 'Vocals, 808 Bass, Beat Drums, Percussion, Melody Synth',
    stemCount: 5,
    badge: '5 Stems',
    stems: ['vocal', 'bass', 'drums', 'percussion', 'synth']
  },
  {
    id: 'orchestral_5',
    name: '5-Stem (Orchestral Ensemble)',
    shortDesc: 'Lead, Strings Section, Brass & Horns, Piano, Percussion',
    stemCount: 5,
    badge: '5 Stems',
    stems: ['vocal', 'strings', 'brass', 'piano', 'percussion']
  },
  {
    id: 'edm_6',
    name: '6-Stem (EDM & Producer Suite)',
    shortDesc: 'Vocals, Drums, Percussion, Sub-Bass, Lead Synth, Ambient FX',
    stemCount: 6,
    badge: '6 Stems',
    stems: ['vocal', 'drums', 'percussion', 'bass', 'synth', 'ambient']
  },
  {
    id: 'master_8',
    name: '8-Stem (Mastering & Deconstruction)',
    shortDesc: 'Lead Vocals, Backing Vocals, Drums, Percussion, Bass, Guitars, Piano, Ambient FX',
    stemCount: 8,
    badge: '8 Stems',
    stems: ['vocal', 'backing_vocal', 'drums', 'percussion', 'bass', 'guitar', 'piano', 'ambient']
  }
];

export function getStemDefinition(type: StemType): StemDefinition {
  return STEM_DEFINITIONS[type] || STEM_DEFINITIONS.other;
}

export function getEnsembleProfile(id: string): EnsembleProfile {
  return ENSEMBLE_PROFILES.find(p => p.id === id) || ENSEMBLE_PROFILES[1]; // default 4-stem
}

export function getAllStemTypes(): StemType[] {
  return [
    'vocal',
    'backing_vocal',
    'drums',
    'percussion',
    'bass',
    'guitar',
    'piano',
    'strings',
    'brass',
    'synth',
    'ambient',
    'instruments',
    'other'
  ];
}

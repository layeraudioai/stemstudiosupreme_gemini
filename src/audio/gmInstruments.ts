/**
 * General MIDI (GM) Standard 128 Instruments and Categories
 */

export interface GMInstrumentDef {
  program: number;
  name: string;
  category: string;
}

export const GM_INSTRUMENTS: GMInstrumentDef[] = [
  // 0-7: Piano
  { program: 0, name: 'Acoustic Grand Piano', category: 'Piano' },
  { program: 1, name: 'Bright Acoustic Piano', category: 'Piano' },
  { program: 2, name: 'Electric Grand Piano', category: 'Piano' },
  { program: 3, name: 'Honky-tonk Piano', category: 'Piano' },
  { program: 4, name: 'Electric Piano 1 (Rhodes)', category: 'Piano' },
  { program: 5, name: 'Electric Piano 2 (DX7)', category: 'Piano' },
  { program: 6, name: 'Harpsichord', category: 'Piano' },
  { program: 7, name: 'Clavinet', category: 'Piano' },

  // 8-15: Chromatic Percussion
  { program: 8, name: 'Celesta', category: 'Chromatic Percussion' },
  { program: 9, name: 'Glockenspiel', category: 'Chromatic Percussion' },
  { program: 10, name: 'Music Box', category: 'Chromatic Percussion' },
  { program: 11, name: 'Vibraphone', category: 'Chromatic Percussion' },
  { program: 12, name: 'Marimba', category: 'Chromatic Percussion' },
  { program: 13, name: 'Xylophone', category: 'Chromatic Percussion' },
  { program: 14, name: 'Tubular Bells', category: 'Chromatic Percussion' },
  { program: 15, name: 'Dulcimer', category: 'Chromatic Percussion' },

  // 16-23: Organ
  { program: 16, name: 'Drawbar Organ', category: 'Organ' },
  { program: 17, name: 'Percussive Organ', category: 'Organ' },
  { program: 18, name: 'Rock Organ', category: 'Organ' },
  { program: 19, name: 'Church Organ', category: 'Organ' },
  { program: 20, name: 'Reed Organ', category: 'Organ' },
  { program: 21, name: 'Accordion', category: 'Organ' },
  { program: 22, name: 'Harmonica', category: 'Organ' },
  { program: 23, name: 'Tango Accordion', category: 'Organ' },

  // 24-31: Guitar
  { program: 24, name: 'Acoustic Guitar (nylon)', category: 'Guitar' },
  { program: 25, name: 'Acoustic Guitar (steel)', category: 'Guitar' },
  { program: 26, name: 'Electric Guitar (jazz)', category: 'Guitar' },
  { program: 27, name: 'Electric Guitar (clean)', category: 'Guitar' },
  { program: 28, name: 'Electric Guitar (muted)', category: 'Guitar' },
  { program: 29, name: 'Overdriven Guitar', category: 'Guitar' },
  { program: 30, name: 'Distortion Guitar', category: 'Guitar' },
  { program: 31, name: 'Guitar Harmonics', category: 'Guitar' },

  // 32-39: Bass
  { program: 32, name: 'Acoustic Bass', category: 'Bass' },
  { program: 33, name: 'Electric Bass (finger)', category: 'Bass' },
  { program: 34, name: 'Electric Bass (pick)', category: 'Bass' },
  { program: 35, name: 'Fretless Bass', category: 'Bass' },
  { program: 36, name: 'Slap Bass 1', category: 'Bass' },
  { program: 37, name: 'Slap Bass 2', category: 'Bass' },
  { program: 38, name: 'Synth Bass 1 (808/Moog)', category: 'Bass' },
  { program: 39, name: 'Synth Bass 2', category: 'Bass' },

  // 40-47: Strings
  { program: 40, name: 'Violin', category: 'Strings' },
  { program: 41, name: 'Viola', category: 'Strings' },
  { program: 42, name: 'Cello', category: 'Strings' },
  { program: 43, name: 'Contrabass', category: 'Strings' },
  { program: 44, name: 'Tremolo Strings', category: 'Strings' },
  { program: 45, name: 'Pizzicato Strings', category: 'Strings' },
  { program: 46, name: 'Orchestral Harp', category: 'Strings' },
  { program: 47, name: 'Timpani', category: 'Strings' },

  // 48-55: Ensemble
  { program: 48, name: 'String Ensemble 1', category: 'Ensemble' },
  { program: 49, name: 'String Ensemble 2', category: 'Ensemble' },
  { program: 50, name: 'Synth Strings 1', category: 'Ensemble' },
  { program: 51, name: 'Synth Strings 2', category: 'Ensemble' },
  { program: 52, name: 'Choir Aahs', category: 'Ensemble' },
  { program: 53, name: 'Voice Oohs', category: 'Ensemble' },
  { program: 54, name: 'Synth Choir', category: 'Ensemble' },
  { program: 55, name: 'Orchestra Hit', category: 'Ensemble' },

  // 56-63: Brass
  { program: 56, name: 'Trumpet', category: 'Brass' },
  { program: 57, name: 'Trombone', category: 'Brass' },
  { program: 58, name: 'Tuba', category: 'Brass' },
  { program: 59, name: 'Muted Trumpet', category: 'Brass' },
  { program: 60, name: 'French Horn', category: 'Brass' },
  { program: 61, name: 'Brass Section', category: 'Brass' },
  { program: 62, name: 'Synth Brass 1', category: 'Brass' },
  { program: 63, name: 'Synth Brass 2', category: 'Brass' },

  // 64-71: Reed
  { program: 64, name: 'Soprano Sax', category: 'Reed' },
  { program: 65, name: 'Alto Sax', category: 'Reed' },
  { program: 66, name: 'Tenor Sax', category: 'Reed' },
  { program: 67, name: 'Baritone Sax', category: 'Reed' },
  { program: 68, name: 'Oboe', category: 'Reed' },
  { program: 69, name: 'English Horn', category: 'Reed' },
  { program: 70, name: 'Bassoon', category: 'Reed' },
  { program: 71, name: 'Clarinet', category: 'Reed' },

  // 72-79: Pipe
  { program: 72, name: 'Piccolo', category: 'Pipe' },
  { program: 73, name: 'Flute', category: 'Pipe' },
  { program: 74, name: 'Recorder', category: 'Pipe' },
  { program: 75, name: 'Pan Flute', category: 'Pipe' },
  { program: 76, name: 'Blown Bottle', category: 'Pipe' },
  { program: 77, name: 'Shakuhachi', category: 'Pipe' },
  { program: 78, name: 'Whistle', category: 'Pipe' },
  { program: 79, name: 'Ocarina', category: 'Pipe' },

  // 80-87: Synth Lead
  { program: 80, name: 'Lead 1 (square)', category: 'Synth Lead' },
  { program: 81, name: 'Lead 2 (sawtooth)', category: 'Synth Lead' },
  { program: 82, name: 'Lead 3 (calliope)', category: 'Synth Lead' },
  { program: 83, name: 'Lead 4 (chiff)', category: 'Synth Lead' },
  { program: 84, name: 'Lead 5 (charang)', category: 'Synth Lead' },
  { program: 85, name: 'Lead 6 (voice)', category: 'Synth Lead' },
  { program: 86, name: 'Lead 7 (fifths)', category: 'Synth Lead' },
  { program: 87, name: 'Lead 8 (bass + lead)', category: 'Synth Lead' },

  // 88-95: Synth Pad
  { program: 88, name: 'Pad 1 (new age)', category: 'Synth Pad' },
  { program: 89, name: 'Pad 2 (warm pad)', category: 'Synth Pad' },
  { program: 90, name: 'Pad 3 (polysynth)', category: 'Synth Pad' },
  { program: 91, name: 'Pad 4 (choir)', category: 'Synth Pad' },
  { program: 92, name: 'Pad 5 (bowed)', category: 'Synth Pad' },
  { program: 93, name: 'Pad 6 (metallic)', category: 'Synth Pad' },
  { program: 94, name: 'Pad 7 (halo)', category: 'Synth Pad' },
  { program: 95, name: 'Pad 8 (sweep)', category: 'Synth Pad' },

  // 112-119: Percussive & Drums
  { program: 118, name: 'Synth / Drum Kit', category: 'Percussive' }
];

export function getInstrumentName(prog = 0, isDrum = false): string {
  if (isDrum) return 'Standard GM Drum Kit';
  const found = GM_INSTRUMENTS.find(i => i.program === prog);
  return found ? found.name : `GM Instrument ${prog}`;
}

/**
 * Embedded Demo Data for DAW, SoundFont Studio, and MIDI Converter
 * Ready-to-play multi-track audio, MIDI files, and SF2 SoundFonts
 */
import { AudioStem, MidiSong, SF2Bank, SF2Sample } from '../types';
import { getAudioContext, extractPeaks } from './audioContext';

/**
 * Generate high-quality procedural multitrack audio buffer
 */
export function createDemoAudioTrack(style: 'synthwave' | 'funk' | 'acoustic' = 'synthwave'): {
  mixed: AudioBuffer;
  stems: AudioStem[];
} {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const duration = 8.0; // 8 seconds loop
  const totalSamples = Math.floor(sampleRate * duration);
  const bpm = style === 'synthwave' ? 120 : style === 'funk' ? 112 : 96;
  const beatSec = 60 / bpm;

  // Create buffers for each stem
  const vocalBuf = ctx.createBuffer(2, totalSamples, sampleRate);
  const drumsBuf = ctx.createBuffer(2, totalSamples, sampleRate);
  const bassBuf = ctx.createBuffer(2, totalSamples, sampleRate);
  const instBuf = ctx.createBuffer(2, totalSamples, sampleRate);
  const mixedBuf = ctx.createBuffer(2, totalSamples, sampleRate);

  const vL = vocalBuf.getChannelData(0);
  const vR = vocalBuf.getChannelData(1);
  const dL = drumsBuf.getChannelData(0);
  const dR = drumsBuf.getChannelData(1);
  const bL = bassBuf.getChannelData(0);
  const bR = bassBuf.getChannelData(1);
  const iL = instBuf.getChannelData(0);
  const iR = instBuf.getChannelData(1);

  // Synthesize Drums (Kick on 1, 2, 3, 4; Snare on 2, 4; Hi-hat on 8ths)
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beatPos = (t % beatSec) / beatSec;
    const measurePos = (t % (beatSec * 4)) / (beatSec * 4);
    const beatIdx = Math.floor((t / beatSec) % 4);

    let dVal = 0;

    // Kick on beat 0 and 2
    if (beatIdx === 0 || beatIdx === 2) {
      if (beatPos < 0.25) {
        const kFreq = 140 * Math.exp(-beatPos * 30) + 45;
        dVal += Math.sin(2 * Math.PI * kFreq * beatPos) * Math.exp(-beatPos * 12) * 0.8;
      }
    }

    // Snare on beat 1 and 3
    if (beatIdx === 1 || beatIdx === 3) {
      if (beatPos < 0.25) {
        const noise = (Math.random() * 2 - 1) * Math.exp(-beatPos * 16);
        const tone = Math.sin(2 * Math.PI * 180 * beatPos) * Math.exp(-beatPos * 20);
        dVal += (noise * 0.6 + tone * 0.4) * 0.7;
      }
    }

    // Hi-hat every 8th note
    const subPos = (t % (beatSec / 2)) / (beatSec / 2);
    if (subPos < 0.08) {
      dVal += (Math.random() * 2 - 1) * Math.exp(-subPos * 50) * 0.25;
    }

    dL[i] = dVal * 0.7;
    dR[i] = dVal * 0.7;

    // Synthesize Bass (Driving root notes C2, G1, A1, F1)
    const chordIdx = Math.floor(t / (beatSec * 2)) % 4;
    const bassFreqs = [65.4, 49.0, 55.0, 43.6]; // C2, G1, A1, F1
    const bFreq = bassFreqs[chordIdx];
    const bassBeatPos = (t % (beatSec / 2)) / (beatSec / 2); // 8th notes
    if (bassBeatPos < 0.4) {
      const env = Math.exp(-bassBeatPos * 5);
      const bTone = (Math.sin(2 * Math.PI * bFreq * t) + 0.5 * Math.sin(4 * Math.PI * bFreq * t)) * env * 0.6;
      bL[i] = bTone;
      bR[i] = bTone;
    }

    // Synthesize Instruments (Warm Pad / Arpeggio Chords)
    const chordNotes = [
      [261.6, 329.6, 392.0], // C major
      [196.0, 246.9, 293.7], // G major
      [220.0, 261.6, 329.6], // A minor
      [174.6, 220.0, 261.6]  // F major
    ][chordIdx];

    let iValL = 0;
    let iValR = 0;
    for (let c = 0; c < chordNotes.length; c++) {
      const f = chordNotes[c];
      const ph = 2 * Math.PI * f * t;
      iValL += Math.sin(ph) * 0.12;
      iValR += Math.sin(ph + 0.3) * 0.12;
    }
    iL[i] = iValL;
    iR[i] = iValR;

    // Synthesize Vocal / Lead Melody
    const leadNotes = [523.2, 587.3, 659.2, 783.9, 659.2, 587.3, 523.2, 440.0];
    const leadIdx = Math.floor(t / beatSec) % leadNotes.length;
    const leadFreq = leadNotes[leadIdx];
    const leadEnv = Math.sin(Math.PI * ((t % beatSec) / beatSec));
    const vVal = (Math.sin(2 * Math.PI * leadFreq * t) + 0.25 * Math.sin(4 * Math.PI * leadFreq * t)) * leadEnv * 0.35;
    vL[i] = vVal;
    vR[i] = vVal;

    // Mixdown
    const mL = (dL[i] * 0.8 + bL[i] * 0.8 + iL[i] * 0.7 + vL[i] * 0.6);
    const mR = (dR[i] * 0.8 + bR[i] * 0.8 + iR[i] * 0.7 + vR[i] * 0.6);
    mixedBuf.getChannelData(0)[i] = Math.max(-1, Math.min(1, mL));
    mixedBuf.getChannelData(1)[i] = Math.max(-1, Math.min(1, mR));
  }

  // Build Stems with precomputed MIDI notes
  const stems: AudioStem[] = [
    {
      id: 'stem-vocal',
      name: 'Vocals / Lead',
      type: 'vocal',
      audioBuffer: vocalBuf,
      color: '#ec4899',
      volume: 0.9,
      pan: 0,
      muted: false,
      solo: false,
      peaks: extractPeaks(vocalBuf),
      midiNotes: [
        { id: 'v-0', pitch: 72, startTime: 0, duration: 0.9, velocity: 95 },
        { id: 'v-1', pitch: 74, startTime: 1, duration: 0.9, velocity: 90 },
        { id: 'v-2', pitch: 76, startTime: 2, duration: 0.9, velocity: 100 },
        { id: 'v-3', pitch: 79, startTime: 3, duration: 0.9, velocity: 95 },
        { id: 'v-4', pitch: 76, startTime: 4, duration: 0.9, velocity: 90 },
        { id: 'v-5', pitch: 74, startTime: 5, duration: 0.9, velocity: 85 },
        { id: 'v-6', pitch: 72, startTime: 6, duration: 0.9, velocity: 95 },
        { id: 'v-7', pitch: 69, startTime: 7, duration: 0.9, velocity: 90 }
      ],
      instrumentProgram: 80,
      iconName: 'Mic'
    },
    {
      id: 'stem-drums',
      name: 'Drums / Percussion',
      type: 'drums',
      audioBuffer: drumsBuf,
      color: '#f59e0b',
      volume: 0.9,
      pan: 0,
      muted: false,
      solo: false,
      peaks: extractPeaks(drumsBuf),
      midiNotes: [
        { id: 'd-0', pitch: 36, startTime: 0, duration: 0.2, velocity: 110 },
        { id: 'd-1', pitch: 38, startTime: 0.5, duration: 0.2, velocity: 100 },
        { id: 'd-2', pitch: 36, startTime: 1.0, duration: 0.2, velocity: 110 },
        { id: 'd-3', pitch: 38, startTime: 1.5, duration: 0.2, velocity: 100 },
        { id: 'd-4', pitch: 36, startTime: 2.0, duration: 0.2, velocity: 110 },
        { id: 'd-5', pitch: 38, startTime: 2.5, duration: 0.2, velocity: 100 },
        { id: 'd-6', pitch: 36, startTime: 3.0, duration: 0.2, velocity: 110 },
        { id: 'd-7', pitch: 38, startTime: 3.5, duration: 0.2, velocity: 100 }
      ],
      instrumentProgram: 118,
      iconName: 'Drum'
    },
    {
      id: 'stem-bass',
      name: 'Bass Players',
      type: 'bass',
      audioBuffer: bassBuf,
      color: '#6366f1',
      volume: 0.95,
      pan: 0,
      muted: false,
      solo: false,
      peaks: extractPeaks(bassBuf),
      midiNotes: [
        { id: 'b-0', pitch: 36, startTime: 0.0, duration: 0.4, velocity: 105 },
        { id: 'b-1', pitch: 36, startTime: 0.5, duration: 0.4, velocity: 95 },
        { id: 'b-2', pitch: 43, startTime: 1.0, duration: 0.4, velocity: 100 },
        { id: 'b-3', pitch: 43, startTime: 1.5, duration: 0.4, velocity: 90 },
        { id: 'b-4', pitch: 45, startTime: 2.0, duration: 0.4, velocity: 105 },
        { id: 'b-5', pitch: 45, startTime: 2.5, duration: 0.4, velocity: 95 },
        { id: 'b-6', pitch: 41, startTime: 3.0, duration: 0.4, velocity: 100 },
        { id: 'b-7', pitch: 41, startTime: 3.5, duration: 0.4, velocity: 90 }
      ],
      instrumentProgram: 33,
      iconName: 'Activity'
    },
    {
      id: 'stem-inst',
      name: 'Instruments / Poly',
      type: 'instruments',
      audioBuffer: instBuf,
      color: '#10b981',
      volume: 0.85,
      pan: 0,
      muted: false,
      solo: false,
      peaks: extractPeaks(instBuf),
      midiNotes: [
        { id: 'p-0', pitch: 60, startTime: 0, duration: 1.9, velocity: 85 },
        { id: 'p-1', pitch: 64, startTime: 0, duration: 1.9, velocity: 85 },
        { id: 'p-2', pitch: 67, startTime: 0, duration: 1.9, velocity: 85 },
        { id: 'p-3', pitch: 55, startTime: 2, duration: 1.9, velocity: 85 },
        { id: 'p-4', pitch: 59, startTime: 2, duration: 1.9, velocity: 85 },
        { id: 'p-5', pitch: 62, startTime: 2, duration: 1.9, velocity: 85 }
      ],
      instrumentProgram: 0,
      iconName: 'Piano'
    }
  ];

  return { mixed: mixedBuf, stems };
}

/**
 * Built-in Demo MIDI Songs
 */
export function getDemoMidiSongs(): MidiSong[] {
  return [
    {
      name: 'Synthwave Horizon',
      bpm: 120,
      timeSignature: [4, 4],
      duration: 8,
      tracks: [
        {
          id: 't-lead',
          name: 'Lead Saw Synth',
          channel: 0,
          program: 81, // Lead 2 (sawtooth)
          notes: [
            { id: 'sw-0', pitch: 72, startTime: 0.0, duration: 0.4, velocity: 95 },
            { id: 'sw-1', pitch: 75, startTime: 0.5, duration: 0.4, velocity: 90 },
            { id: 'sw-2', pitch: 79, startTime: 1.0, duration: 0.8, velocity: 100 },
            { id: 'sw-3', pitch: 77, startTime: 2.0, duration: 0.4, velocity: 90 },
            { id: 'sw-4', pitch: 75, startTime: 2.5, duration: 0.4, velocity: 85 },
            { id: 'sw-5', pitch: 72, startTime: 3.0, duration: 1.0, velocity: 95 },
            { id: 'sw-6', pitch: 75, startTime: 4.0, duration: 0.5, velocity: 90 },
            { id: 'sw-7', pitch: 79, startTime: 4.5, duration: 0.5, velocity: 95 },
            { id: 'sw-8', pitch: 82, startTime: 5.0, duration: 1.0, velocity: 105 },
            { id: 'sw-9', pitch: 84, startTime: 6.0, duration: 1.8, velocity: 100 }
          ],
          volume: 0.9,
          pan: -0.15,
          muted: false,
          solo: false,
          color: '#ec4899'
        },
        {
          id: 't-bass',
          name: 'Rolling 80s Bass',
          channel: 1,
          program: 38, // Synth Bass 1
          notes: [
            { id: 'b-0', pitch: 36, startTime: 0.0, duration: 0.22, velocity: 100 },
            { id: 'b-1', pitch: 36, startTime: 0.25, duration: 0.22, velocity: 95 },
            { id: 'b-2', pitch: 36, startTime: 0.5, duration: 0.22, velocity: 100 },
            { id: 'b-3', pitch: 36, startTime: 0.75, duration: 0.22, velocity: 95 },
            { id: 'b-4', pitch: 36, startTime: 1.0, duration: 0.22, velocity: 100 },
            { id: 'b-5', pitch: 36, startTime: 1.25, duration: 0.22, velocity: 95 },
            { id: 'b-6', pitch: 36, startTime: 1.5, duration: 0.22, velocity: 100 },
            { id: 'b-7', pitch: 36, startTime: 1.75, duration: 0.22, velocity: 95 },
            { id: 'b-8', pitch: 41, startTime: 2.0, duration: 0.22, velocity: 100 },
            { id: 'b-9', pitch: 41, startTime: 2.5, duration: 0.22, velocity: 95 },
            { id: 'b-10', pitch: 43, startTime: 3.0, duration: 0.22, velocity: 100 },
            { id: 'b-11', pitch: 43, startTime: 3.5, duration: 0.22, velocity: 95 }
          ],
          volume: 0.95,
          pan: 0,
          muted: false,
          solo: false,
          color: '#6366f1'
        },
        {
          id: 't-pad',
          name: 'Lush Poly Synth Pad',
          channel: 2,
          program: 89, // Warm Pad
          notes: [
            { id: 'pd-0', pitch: 60, startTime: 0.0, duration: 1.9, velocity: 80 },
            { id: 'pd-1', pitch: 63, startTime: 0.0, duration: 1.9, velocity: 80 },
            { id: 'pd-2', pitch: 67, startTime: 0.0, duration: 1.9, velocity: 80 },
            { id: 'pd-3', pitch: 65, startTime: 2.0, duration: 1.9, velocity: 80 },
            { id: 'pd-4', pitch: 68, startTime: 2.0, duration: 1.9, velocity: 80 },
            { id: 'pd-5', pitch: 72, startTime: 2.0, duration: 1.9, velocity: 80 }
          ],
          volume: 0.8,
          pan: 0.25,
          muted: false,
          solo: false,
          color: '#10b981'
        },
        {
          id: 't-drums',
          name: 'Electronic Drum Kit',
          channel: 9,
          program: 118,
          isDrumTrack: true,
          notes: [
            { id: 'dk-0', pitch: 36, startTime: 0.0, duration: 0.2, velocity: 110 },
            { id: 'dk-1', pitch: 42, startTime: 0.25, duration: 0.1, velocity: 85 },
            { id: 'dk-2', pitch: 38, startTime: 0.5, duration: 0.2, velocity: 105 },
            { id: 'dk-3', pitch: 42, startTime: 0.75, duration: 0.1, velocity: 85 },
            { id: 'dk-4', pitch: 36, startTime: 1.0, duration: 0.2, velocity: 110 },
            { id: 'dk-5', pitch: 42, startTime: 1.25, duration: 0.1, velocity: 85 },
            { id: 'dk-6', pitch: 38, startTime: 1.5, duration: 0.2, velocity: 105 },
            { id: 'dk-7', pitch: 42, startTime: 1.75, duration: 0.1, velocity: 85 }
          ],
          volume: 0.85,
          pan: 0,
          muted: false,
          solo: false,
          color: '#f59e0b'
        }
      ]
    },
    {
      name: 'Für Elise (Beethoven)',
      bpm: 132,
      timeSignature: [3, 8],
      duration: 10,
      tracks: [
        {
          id: 'fe-rh',
          name: 'Piano Right Hand',
          channel: 0,
          program: 0, // Acoustic Grand Piano
          notes: [
            { id: 'fe-0', pitch: 76, startTime: 0.0, duration: 0.25, velocity: 90 }, // E5
            { id: 'fe-1', pitch: 75, startTime: 0.25, duration: 0.25, velocity: 90 }, // D#5
            { id: 'fe-2', pitch: 76, startTime: 0.5, duration: 0.25, velocity: 90 }, // E5
            { id: 'fe-3', pitch: 75, startTime: 0.75, duration: 0.25, velocity: 90 }, // D#5
            { id: 'fe-4', pitch: 76, startTime: 1.0, duration: 0.25, velocity: 90 }, // E5
            { id: 'fe-5', pitch: 71, startTime: 1.25, duration: 0.25, velocity: 85 }, // B4
            { id: 'fe-6', pitch: 74, startTime: 1.5, duration: 0.25, velocity: 85 }, // D5
            { id: 'fe-7', pitch: 72, startTime: 1.75, duration: 0.25, velocity: 85 }, // C5
            { id: 'fe-8', pitch: 69, startTime: 2.0, duration: 0.75, velocity: 95 }, // A4
            { id: 'fe-9', pitch: 60, startTime: 2.75, duration: 0.25, velocity: 80 }, // C4
            { id: 'fe-10', pitch: 64, startTime: 3.0, duration: 0.25, velocity: 80 }, // E4
            { id: 'fe-11', pitch: 69, startTime: 3.25, duration: 0.25, velocity: 85 }, // A4
            { id: 'fe-12', pitch: 71, startTime: 3.5, duration: 0.75, velocity: 95 }  // B4
          ],
          volume: 0.9,
          pan: 0,
          muted: false,
          solo: false,
          color: '#6366f1'
        },
        {
          id: 'fe-lh',
          name: 'Piano Left Hand',
          channel: 1,
          program: 0,
          notes: [
            { id: 'lh-0', pitch: 45, startTime: 2.0, duration: 0.8, velocity: 75 }, // A2
            { id: 'lh-1', pitch: 52, startTime: 2.25, duration: 0.5, velocity: 70 }, // E3
            { id: 'lh-2', pitch: 57, startTime: 2.5, duration: 0.5, velocity: 70 }, // A3
            { id: 'lh-3', pitch: 40, startTime: 3.5, duration: 0.8, velocity: 75 }, // E2
            { id: 'lh-4', pitch: 52, startTime: 3.75, duration: 0.5, velocity: 70 }, // E3
            { id: 'lh-5', pitch: 56, startTime: 4.0, duration: 0.5, velocity: 70 }  // G#3
          ],
          volume: 0.85,
          pan: 0,
          muted: false,
          solo: false,
          color: '#10b981'
        }
      ]
    },
    {
      name: 'Chiptune Quest (Retro 8-Bit)',
      bpm: 140,
      timeSignature: [4, 4],
      duration: 7,
      tracks: [
        {
          id: 'chip-lead',
          name: 'Square Pulse Lead',
          channel: 0,
          program: 80, // Square Lead
          notes: [
            { id: 'cp-0', pitch: 72, startTime: 0.0, duration: 0.18, velocity: 100 },
            { id: 'cp-1', pitch: 76, startTime: 0.21, duration: 0.18, velocity: 95 },
            { id: 'cp-2', pitch: 79, startTime: 0.42, duration: 0.18, velocity: 100 },
            { id: 'cp-3', pitch: 84, startTime: 0.63, duration: 0.35, velocity: 110 },
            { id: 'cp-4', pitch: 83, startTime: 1.05, duration: 0.18, velocity: 95 },
            { id: 'cp-5', pitch: 79, startTime: 1.26, duration: 0.18, velocity: 90 },
            { id: 'cp-6', pitch: 76, startTime: 1.47, duration: 0.35, velocity: 100 }
          ],
          volume: 0.85,
          pan: -0.2,
          muted: false,
          solo: false,
          color: '#06b6d4'
        },
        {
          id: 'chip-bass',
          name: 'Triangle Bass',
          channel: 1,
          program: 38,
          notes: [
            { id: 'cb-0', pitch: 48, startTime: 0.0, duration: 0.2, velocity: 105 },
            { id: 'cb-1', pitch: 48, startTime: 0.42, duration: 0.2, velocity: 95 },
            { id: 'cb-2', pitch: 55, startTime: 0.84, duration: 0.2, velocity: 100 },
            { id: 'cb-3', pitch: 53, startTime: 1.26, duration: 0.2, velocity: 95 }
          ],
          volume: 0.95,
          pan: 0,
          muted: false,
          solo: false,
          color: '#8b5cf6'
        }
      ]
    }
  ];
}

/**
 * Procedural SF2 SoundFont Samples Generator
 * Generates rich sampled AudioBuffers for pianos, woodwinds, 808 bass, and drums
 */
export function createDemoSoundFonts(): SF2Bank[] {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;

  // 1. Acoustic Grand Piano Samples
  const pianoSamples: SF2Sample[] = [
    createSampleBuffer(ctx, 'Piano_C3', 48, [36, 54], 'piano'),
    createSampleBuffer(ctx, 'Piano_C4', 60, [55, 66], 'piano'),
    createSampleBuffer(ctx, 'Piano_C5', 72, [67, 78], 'piano'),
    createSampleBuffer(ctx, 'Piano_C6', 84, [79, 96], 'piano')
  ];

  // 2. 808 / Synth Bass Samples
  const bassSamples: SF2Sample[] = [
    createSampleBuffer(ctx, 'Sub_Bass_C1', 36, [24, 42], 'bass'),
    createSampleBuffer(ctx, 'Punch_Bass_C2', 48, [43, 60], 'bass')
  ];

  // 3. Woodwind Flute Samples
  const fluteSamples: SF2Sample[] = [
    createSampleBuffer(ctx, 'Flute_G4', 67, [55, 71], 'flute'),
    createSampleBuffer(ctx, 'Flute_C5', 72, [72, 88], 'flute')
  ];

  // 4. Multi-Sample Drum Kit
  const drumSamples: SF2Sample[] = [
    createSampleBuffer(ctx, 'Acoustic_Kick', 36, [35, 37], 'drum_kick'),
    createSampleBuffer(ctx, 'Snare_Wood', 38, [38, 40], 'drum_snare'),
    createSampleBuffer(ctx, 'Closed_Hat', 42, [41, 43], 'drum_hat'),
    createSampleBuffer(ctx, 'Open_Cymbal', 46, [44, 52], 'drum_cymbal')
  ];

  return [
    {
      id: 'bank-essential-gm',
      name: 'Essential GM SoundFont 2',
      author: 'xbcx / StemStudio',
      comment: 'Multi-sample General MIDI 2.04 soundbank with Piano, Bass, Flute, and Drums',
      isBuiltIn: true,
      presets: [
        {
          id: 'p-0',
          name: 'Acoustic Grand Piano',
          bank: 0,
          presetNum: 0,
          instruments: [{ id: 'i-piano', name: 'Grand Piano', samples: pianoSamples }]
        },
        {
          id: 'p-1',
          name: '808 / Synth Bass',
          bank: 0,
          presetNum: 38,
          instruments: [{ id: 'i-bass', name: 'Synth Bass', samples: bassSamples }]
        },
        {
          id: 'p-2',
          name: 'Sustained Woodwind Flute',
          bank: 0,
          presetNum: 73,
          instruments: [{ id: 'i-flute', name: 'Concert Flute', samples: fluteSamples }]
        },
        {
          id: 'p-3',
          name: 'Standard Drum Kit',
          bank: 128,
          presetNum: 0,
          instruments: [{ id: 'i-drum', name: 'Drum Kit', samples: drumSamples }]
        }
      ]
    },
    {
      id: 'bank-chiptune',
      name: 'Chiptune Retro 8-Bit SF2',
      author: 'StemStudio Retro',
      comment: 'Authentic 8-bit pulse & triangle wave soundbank',
      isBuiltIn: true,
      presets: [
        {
          id: 'p-chip-lead',
          name: 'Square Wave Lead',
          bank: 0,
          presetNum: 80,
          instruments: [{
            id: 'i-chip',
            name: 'Pulse 50%',
            samples: [
              createSampleBuffer(ctx, 'Pulse_C4', 60, [0, 127], 'chiptune')
            ]
          }]
        }
      ]
    },
    {
      id: 'bank-concert-piano',
      name: 'Concert Piano & Strings SF2',
      author: 'Steinway & Orchestral Master',
      comment: 'Rich resonance acoustic concert grand piano soundfont',
      isBuiltIn: true,
      presets: [
        {
          id: 'p-concert-grand',
          name: 'Concert Grand Piano',
          bank: 0,
          presetNum: 0,
          instruments: [{ id: 'i-c-grand', name: 'Concert Grand', samples: pianoSamples }]
        }
      ]
    }
  ];
}

function createSampleBuffer(
  ctx: AudioContext,
  name: string,
  rootKey: number,
  keyRange: [number, number],
  type: 'piano' | 'bass' | 'flute' | 'chiptune' | 'drum_kick' | 'drum_snare' | 'drum_hat' | 'drum_cymbal'
): SF2Sample {
  const sampleRate = 44100;
  const isLooping = type === 'flute' || type === 'chiptune';
  const duration = isLooping ? 1.5 : type.startsWith('drum') ? 0.4 : 2.0;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const f0 = 440 * Math.pow(2, (rootKey - 69) / 12);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let s = 0;

    if (type === 'piano') {
      const decay = Math.exp(-t * 2.5);
      // Piano hammer strike + harmonics
      s = (Math.sin(2 * Math.PI * f0 * t) +
           0.5 * Math.sin(4 * Math.PI * f0 * t) +
           0.25 * Math.sin(6 * Math.PI * f0 * t)) * decay;
    } else if (type === 'bass') {
      const decay = Math.exp(-t * 3.0);
      s = (Math.sin(2 * Math.PI * f0 * t) + 0.3 * Math.sin(4 * Math.PI * f0 * t)) * decay;
    } else if (type === 'flute') {
      // Breath tone + pure fundamental
      const vibrato = Math.sin(2 * Math.PI * 5 * t) * 2;
      s = Math.sin(2 * Math.PI * (f0 + vibrato) * t) * 0.7 + (Math.random() * 2 - 1) * 0.05;
    } else if (type === 'chiptune') {
      // 50% square wave
      s = Math.sin(2 * Math.PI * f0 * t) >= 0 ? 0.6 : -0.6;
    } else if (type === 'drum_kick') {
      const kf = 130 * Math.exp(-t * 35) + 40;
      s = Math.sin(2 * Math.PI * kf * t) * Math.exp(-t * 15);
    } else if (type === 'drum_snare') {
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 20);
      const tone = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 25);
      s = noise * 0.7 + tone * 0.3;
    } else if (type === 'drum_hat' || type === 'drum_cymbal') {
      const decay = type === 'drum_hat' ? 50 : 12;
      s = (Math.random() * 2 - 1) * Math.exp(-t * decay);
    }

    data[i] = Math.max(-1, Math.min(1, s));
  }

  return {
    id: `demo-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    audioBuffer: buffer,
    rootKey,
    keyRange,
    loopStart: isLooping ? Math.floor(sampleRate * 0.3) : 0,
    loopEnd: isLooping ? Math.floor(sampleRate * 1.2) : length,
    loopMode: isLooping,
    sampleRate,
    fineTune: 0,
    attack: type === 'flute' ? 0.05 : 0.005,
    decay: 0.3,
    sustain: isLooping ? 0.8 : 0.2,
    release: 0.3,
    filterCutoff: type === 'bass' ? 3000 : 18000
  };
}

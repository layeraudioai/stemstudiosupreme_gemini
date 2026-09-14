/**
 * Deterministic Seeded Pseudo-Random Number Generator (PRNG)
 * Uses cyrb53 / FNV-1a string hashing + Mulberry32 PRNG algorithm.
 * Guarantees identical outputs across sessions given the same seed.
 */

export class SeededPRNG {
  private state: number;

  constructor(seed: string | number) {
    if (typeof seed === 'number') {
      this.state = (Math.floor(seed) >>> 0) || 1337;
    } else {
      this.state = SeededPRNG.hashString(String(seed || 'stemstudio'));
    }
  }

  /**
   * Hashes string into a 32-bit unsigned integer using cyrb53 algorithm
   */
  public static hashString(str: string): number {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c64e6d;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)) >>> 0;
  }

  /**
   * Mulberry32 step function
   * Returns float in range [0, 1)
   */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns integer between min and max (inclusive)
   */
  public nextInt(min: number, max: number): number {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }

  /**
   * Returns float between min and max
   */
  public nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Picks a random element from an array
   */
  public choice<T>(array: readonly T[]): T {
    if (!array || array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const idx = this.nextInt(0, array.length - 1);
    return array[idx];
  }

  /**
   * Shuffles an array in place using seeded Fisher-Yates
   */
  public shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  /**
   * Returns true with given probability [0, 1]
   */
  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Approximate normal/gaussian distribution via Box-Muller
   */
  public gaussian(mean = 0, stdev = 1): number {
    let u = 1 - this.next();
    let v = this.next();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
  }
}

/**
 * Generate human-friendly descriptive seed tokens
 */
export function generateSeedPhrase(prefix = ''): string {
  const adjectives = [
    'neon', 'cyber', 'cosmic', 'retro', 'analog', 'lofi', 'solar', 'velvet',
    'quantum', 'subtle', 'hyper', 'astral', 'dark', 'crystal', 'pulse', 'sonic',
    'echo', 'glitch', 'drift', 'vapor', 'synth', 'prism', 'deep', 'amber'
  ];
  const nouns = [
    'groove', 'horizon', 'pulse', 'wave', 'drift', 'matrix', 'echo', 'bass',
    'prism', 'shiver', 'spark', 'flux', 'circuit', 'aurora', 'glide', 'phase',
    'dimension', 'reverb', 'rhythm', 'sub', 'cadence', 'frequency', 'core'
  ];
  const num = Math.floor(Math.random() * 900) + 100;
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return prefix ? `${prefix}-${adj}-${noun}-${num}` : `${adj}-${noun}-${num}`;
}

/**
 * Musical Scale Presets (Pitch Classes 0 = C, 1 = C#, etc.)
 */
export const MUSICAL_SCALES: Record<string, { name: string; intervals: number[]; description: string }> = {
  minor_pentatonic: {
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
    description: 'Blues, rock, funk, & synthwave soloing'
  },
  dorian: {
    name: 'Dorian Modal',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: 'Smooth, nostalgic synthwave and jazz'
  },
  natural_minor: {
    name: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: 'Dark, driving, cinematic EDM and trap'
  },
  harmonic_minor: {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    description: 'Neoclassical, dramatic, eastern-flavored'
  },
  major: {
    name: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: 'Bright, uplifting pop and disco'
  },
  phrygian_dominant: {
    name: 'Phrygian Dominant',
    intervals: [0, 1, 4, 5, 7, 8, 10],
    description: 'Exotic, dark, heavy bass and techno'
  },
  blues: {
    name: 'Blues Scale',
    intervals: [0, 3, 5, 6, 7, 10],
    description: 'Soulful grit and expressiveness'
  },
  japanese_insen: {
    name: 'Japanese Insen',
    intervals: [0, 1, 5, 7, 10],
    description: 'Ethereal ambient and retro video game music'
  }
};

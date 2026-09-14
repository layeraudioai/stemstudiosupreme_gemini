/**
 * Standard MIDI File (.mid) Parser and Generator
 * Supports Format 0 and Format 1 files
 */
import { MidiSong, MidiTrack, MidiNote } from '../types';

export function parseMidiFile(arrayBuffer: ArrayBuffer, fileName = 'Imported Song'): MidiSong {
  const bytes = new Uint8Array(arrayBuffer);
  let pos = 0;

  // Check MThd
  const headerId = readString(bytes, pos, 4);
  pos += 4;
  if (headerId !== 'MThd') {
    throw new Error('Not a valid MIDI file (missing MThd chunk)');
  }

  const headerLength = readUint32(bytes, pos);
  pos += 4;
  const format = readUint16(bytes, pos);
  pos += 2;
  const numTracks = readUint16(bytes, pos);
  pos += 2;
  const division = readUint16(bytes, pos);
  pos += 2;

  // division is ticks per quarter note (usually 96, 120, 240, 384, 480)
  const ticksPerBeat = division & 0x7fff;

  let globalBpm = 120;
  let timeSignature: [number, number] = [4, 4];
  let microsecondsPerQuarter = 500000; // 120 BPM default

  const tracks: MidiTrack[] = [];
  const trackColors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6'];

  // Parse each MTrk chunk
  for (let t = 0; t < numTracks && pos < bytes.length; t++) {
    const trackId = readString(bytes, pos, 4);
    pos += 4;
    if (trackId !== 'MTrk') {
      // Skip unknown chunk
      const chunkSize = readUint32(bytes, pos);
      pos += 4 + chunkSize;
      continue;
    }

    const trackLength = readUint32(bytes, pos);
    pos += 4;
    const trackEnd = pos + trackLength;

    let trackName = `Track ${t + 1}`;
    let trackProgram = 0;
    let trackChannel = t % 16;
    let isDrum = false;

    let currentTick = 0;
    let runningStatus = 0;

    const activeNotes = new Map<number, { pitch: number; startTick: number; velocity: number; channel: number }>();
    const finishedNotes: MidiNote[] = [];

    while (pos < trackEnd) {
      // Read variable-length delta time
      const delta = readVarInt();
      currentTick += delta;

      let status = bytes[pos];
      if (status >= 0x80) {
        runningStatus = status;
        pos++;
      } else {
        status = runningStatus;
      }

      const eventType = status & 0xf0;
      const channel = status & 0x0f;
      if (channel === 9) isDrum = true; // Channel 10 (0-indexed 9) is GM drum channel

      if (eventType === 0x80) {
        // Note Off
        const note = bytes[pos++];
        pos++; // velocity
        const key = (channel << 8) | note;
        const noteStart = activeNotes.get(key);
        if (noteStart) {
          const durationTicks = Math.max(1, currentTick - noteStart.startTick);
          finishedNotes.push({
            id: `note-${t}-${finishedNotes.length}`,
            pitch: note,
            startTime: ticksToSeconds(noteStart.startTick, ticksPerBeat, microsecondsPerQuarter),
            duration: Math.max(0.05, ticksToSeconds(durationTicks, ticksPerBeat, microsecondsPerQuarter)),
            velocity: noteStart.velocity,
            channel
          });
          activeNotes.delete(key);
        }
      } else if (eventType === 0x90) {
        // Note On
        const note = bytes[pos++];
        const velocity = bytes[pos++];
        const key = (channel << 8) | note;

        if (velocity === 0) {
          // Note On with velocity 0 is Note Off
          const noteStart = activeNotes.get(key);
          if (noteStart) {
            const durationTicks = Math.max(1, currentTick - noteStart.startTick);
            finishedNotes.push({
              id: `note-${t}-${finishedNotes.length}`,
              pitch: note,
              startTime: ticksToSeconds(noteStart.startTick, ticksPerBeat, microsecondsPerQuarter),
              duration: Math.max(0.05, ticksToSeconds(durationTicks, ticksPerBeat, microsecondsPerQuarter)),
              velocity: noteStart.velocity,
              channel
            });
            activeNotes.delete(key);
          }
        } else {
          // If previous note still held on same key, close it
          const existing = activeNotes.get(key);
          if (existing) {
            finishedNotes.push({
              id: `note-${t}-${finishedNotes.length}`,
              pitch: note,
              startTime: ticksToSeconds(existing.startTick, ticksPerBeat, microsecondsPerQuarter),
              duration: Math.max(0.05, ticksToSeconds(currentTick - existing.startTick, ticksPerBeat, microsecondsPerQuarter)),
              velocity: existing.velocity,
              channel
            });
          }
          activeNotes.set(key, { pitch: note, startTick: currentTick, velocity, channel });
        }
      } else if (eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0) {
        // Polyphonic aftertouch, CC, Pitch bend (2 data bytes)
        pos += 2;
      } else if (eventType === 0xc0) {
        // Program Change (1 data byte)
        const prog = bytes[pos++];
        trackProgram = prog;
        trackChannel = channel;
      } else if (eventType === 0xd0) {
        // Channel Pressure (1 data byte)
        pos++;
      } else if (status === 0xff) {
        // Meta Event
        const metaType = bytes[pos++];
        const metaLength = readVarInt();
        const metaStart = pos;

        if (metaType === 0x03) {
          // Track Name
          trackName = readString(bytes, metaStart, metaLength).trim() || trackName;
        } else if (metaType === 0x51 && metaLength === 3) {
          // Set Tempo
          microsecondsPerQuarter = (bytes[metaStart] << 16) | (bytes[metaStart + 1] << 8) | bytes[metaStart + 2];
          globalBpm = Math.round(60000000 / microsecondsPerQuarter);
        } else if (metaType === 0x58 && metaLength >= 2) {
          // Time Signature
          const num = bytes[metaStart];
          const denom = Math.pow(2, bytes[metaStart + 1]);
          timeSignature = [num, denom];
        }

        pos = metaStart + metaLength;
      } else if (status === 0xf0 || status === 0xf7) {
        // SysEx event
        const sysexLength = readVarInt();
        pos += sysexLength;
      }
    }

    // Flush any remaining active notes
    activeNotes.forEach((noteStart, key) => {
      const note = key & 0xff;
      const durationTicks = Math.max(ticksPerBeat / 2, currentTick - noteStart.startTick);
      finishedNotes.push({
        id: `note-${t}-${finishedNotes.length}`,
        pitch: note,
        startTime: ticksToSeconds(noteStart.startTick, ticksPerBeat, microsecondsPerQuarter),
        duration: Math.max(0.05, ticksToSeconds(durationTicks, ticksPerBeat, microsecondsPerQuarter)),
        velocity: noteStart.velocity,
        channel: noteStart.channel
      });
    });

    if (finishedNotes.length > 0 || trackName !== `Track ${t + 1}`) {
      tracks.push({
        id: `track-${t}`,
        name: trackName,
        channel: trackChannel,
        program: trackProgram,
        notes: finishedNotes.sort((a, b) => a.startTime - b.startTime),
        volume: 0.85,
        pan: 0,
        muted: false,
        solo: false,
        color: trackColors[tracks.length % trackColors.length],
        isDrumTrack: isDrum || trackChannel === 9
      });
    }
  }

  // Calculate total song duration
  let maxDuration = 4;
  for (const trk of tracks) {
    for (const note of trk.notes) {
      const end = note.startTime + note.duration;
      if (end > maxDuration) maxDuration = end;
    }
  }

  // Fallback if empty
  if (tracks.length === 0) {
    tracks.push({
      id: 'track-0',
      name: 'Piano Track',
      channel: 0,
      program: 0,
      notes: [
        { id: 'n-0', pitch: 60, startTime: 0, duration: 0.5, velocity: 90 },
        { id: 'n-1', pitch: 64, startTime: 0.5, duration: 0.5, velocity: 90 },
        { id: 'n-2', pitch: 67, startTime: 1.0, duration: 0.5, velocity: 90 },
        { id: 'n-3', pitch: 72, startTime: 1.5, duration: 1.0, velocity: 95 }
      ],
      volume: 0.85,
      pan: 0,
      muted: false,
      solo: false,
      color: '#6366f1'
    });
    maxDuration = 2.5;
  }

  return {
    name: fileName.replace(/\.[^/.]+$/, ''),
    bpm: globalBpm,
    timeSignature,
    duration: Math.ceil(maxDuration),
    tracks
  };

  function readVarInt(): number {
    let value = 0;
    let byte = 0;
    do {
      byte = bytes[pos++];
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80);
    return value;
  }
}

function ticksToSeconds(ticks: number, ticksPerBeat: number, microsecondsPerQuarter: number): number {
  const beats = ticks / ticksPerBeat;
  return (beats * microsecondsPerQuarter) / 1000000;
}

function secondsToTicks(seconds: number, bpm: number, ticksPerBeat: number): number {
  const beats = (seconds * bpm) / 60;
  return Math.round(beats * ticksPerBeat);
}

/**
 * Encode MidiSong or MidiTrack array into standard binary MIDI (.mid) ArrayBuffer
 */
export const buildMidiFile = (song: MidiSong): Uint8Array => new Uint8Array(encodeMidiFile(song));

export function encodeMidiFile(song: MidiSong): ArrayBuffer {
  const ticksPerBeat = 480;
  const bpm = song.bpm || 120;
  const microsecondsPerQuarter = Math.round(60000000 / bpm);

  const trackBuffers: Uint8Array[] = [];

  // Track 0: Conductor Track (Tempo & Time Signature)
  const conductorEvents: number[] = [];
  // Delta 0, Time Sig 4/4
  conductorEvents.push(0x00, 0xff, 0x58, 0x04, song.timeSignature[0] || 4, Math.round(Math.log2(song.timeSignature[1] || 4)), 24, 8);
  // Delta 0, Tempo
  conductorEvents.push(0x00, 0xff, 0x51, 0x03, (microsecondsPerQuarter >> 16) & 0xff, (microsecondsPerQuarter >> 8) & 0xff, microsecondsPerQuarter & 0xff);
  // Delta 0, Song Name
  const songNameBytes = Array.from(song.name || 'Exported Song').map(c => c.charCodeAt(0));
  conductorEvents.push(0x00, 0xff, 0x03, songNameBytes.length, ...songNameBytes);
  // End of Track
  conductorEvents.push(0x00, 0xff, 0x2f, 0x00);
  trackBuffers.push(createTrackChunk(new Uint8Array(conductorEvents)));

  // Tracks for each instrument
  for (let tIdx = 0; tIdx < song.tracks.length; tIdx++) {
    const track = song.tracks[tIdx];
    const ch = track.isDrumTrack ? 9 : (track.channel ?? (tIdx % 16));
    const events: { tick: number; bytes: number[] }[] = [];

    // Track name event at tick 0
    const trkNameBytes = Array.from(track.name).map(c => c.charCodeAt(0));
    events.push({ tick: 0, bytes: [0xff, 0x03, trkNameBytes.length, ...trkNameBytes] });

    // Program change event at tick 0
    events.push({ tick: 0, bytes: [0xc0 | ch, track.program || 0] });

    // Note On & Note Off events
    for (const note of track.notes) {
      const startTick = secondsToTicks(note.startTime, bpm, ticksPerBeat);
      const endTick = secondsToTicks(note.startTime + note.duration, bpm, ticksPerBeat);
      const vel = Math.max(1, Math.min(127, note.velocity || 90));

      events.push({
        tick: startTick,
        bytes: [0x90 | ch, note.pitch, vel]
      });
      events.push({
        tick: endTick,
        bytes: [0x80 | ch, note.pitch, 0]
      });
    }

    // Sort all events by absolute tick
    events.sort((a, b) => a.tick - b.tick);

    // Convert to delta ticks
    const trkData: number[] = [];
    let lastTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - lastTick);
      lastTick = ev.tick;
      writeVarIntBytes(trkData, delta);
      trkData.push(...ev.bytes);
    }

    // End of track meta event
    writeVarIntBytes(trkData, 0);
    trkData.push(0xff, 0x2f, 0x00);

    trackBuffers.push(createTrackChunk(new Uint8Array(trkData)));
  }

  // Header chunk (MThd, length: 6, format: 1, numTracks, ticksPerBeat)
  const headerBytes = new Uint8Array(14);
  const hView = new DataView(headerBytes.buffer);
  writeAscii(hView, 0, 'MThd');
  hView.setUint32(4, 6, false); // Big endian length
  hView.setUint16(8, 1, false); // Format 1
  hView.setUint16(10, trackBuffers.length, false);
  hView.setUint16(12, ticksPerBeat, false);

  // Merge all chunks
  let totalLength = headerBytes.length;
  for (const b of trackBuffers) totalLength += b.length;

  const result = new Uint8Array(totalLength);
  result.set(headerBytes, 0);
  let offset = headerBytes.length;
  for (const b of trackBuffers) {
    result.set(b, offset);
    offset += b.length;
  }

  return result.buffer as ArrayBuffer;
}

function createTrackChunk(trackData: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(8 + trackData.length);
  const view = new DataView(chunk.buffer);
  writeAscii(view, 0, 'MTrk');
  view.setUint32(4, trackData.length, false); // Big endian length
  chunk.set(trackData, 8);
  return chunk;
}

function writeVarIntBytes(array: number[], value: number): void {
  const buffer: number[] = [];
  buffer.push(value & 0x7f);
  value >>= 7;
  while (value > 0) {
    buffer.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  array.push(...buffer);
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(bytes[offset + i]);
  }
  return str;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

import React, { useState, useEffect, useCallback } from 'react';
import { Volume2, ChevronLeft, ChevronRight, Keyboard as KeyboardIcon } from 'lucide-react';
import { midiToNoteName } from '../../audio/audioContext';
import { getSynthEngine } from '../../audio/synthEngine';
import { SF2Bank, SF2Preset } from '../../types';

interface VirtualKeyboardProps {
  activeBank: SF2Bank | null;
  activePreset: SF2Preset | null;
  volume: number;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  activeBank,
  activePreset,
  volume
}) => {
  const [octaveOffset, setOctaveOffset] = useState(0); // -2 to +2
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [pitchBend, setPitchBend] = useState(0); // -1 to +1
  const [modWheel, setModWheel] = useState(0); // 0 to 1

  const synth = getSynthEngine();

  // 61 Keys range: starting at C2 (36) + (octaveOffset * 12)
  const baseMidi = 36 + octaveOffset * 12;
  const numKeys = 49; // 4 octaves + 1 note

  const triggerNoteOn = useCallback((pitch: number) => {
    setActiveNotes(prev => new Set(prev).add(pitch));
    if (activeBank && activePreset) {
      synth.noteOn(pitch, 100, activePreset.presetNum, activePreset.bank);
    } else {
      synth.noteOn(pitch, 100, 0, 0);
    }
  }, [activeBank, activePreset, synth]);

  const triggerNoteOff = useCallback((pitch: number) => {
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(pitch);
      return next;
    });
    synth.noteOff(pitch, activePreset?.bank || 0);
  }, [activePreset, synth]);

  // Keyboard hotkey mappings (Z-M row for lower octave, Q-U row for upper octave)
  useEffect(() => {
    const keyMap: Record<string, number> = {
      // Lower octave (C to B)
      'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11,
      // Upper octave (C to E)
      'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16, 'r': 17, '5': 18, 't': 19, '6': 20, 'y': 21, '7': 22, 'u': 23, 'i': 24
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const offset = keyMap[e.key.toLowerCase()];
      if (offset !== undefined) {
        const pitch = baseMidi + 12 + offset;
        triggerNoteOn(pitch);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const offset = keyMap[e.key.toLowerCase()];
      if (offset !== undefined) {
        const pitch = baseMidi + 12 + offset;
        triggerNoteOff(pitch);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [baseMidi, triggerNoteOn, triggerNoteOff]);

  return (
    <div id="sf2-virtual-keyboard" className="bg-[#121622] border border-[#232a3d] rounded-2xl p-4 shadow-xl select-none">
      {/* Top Toolbar: Octave Shift, Pitch Bend & Mod Wheels, Active Preset */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-[#232a3d] gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#171c2a] border border-[#293246] px-2.5 py-1 rounded-xl">
            <span className="text-[11px] font-mono text-slate-400">OCTAVE:</span>
            <button
              onClick={() => setOctaveOffset(prev => Math.max(-2, prev - 1))}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-800"
              title="Octave Down"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold text-indigo-400 w-4 text-center">
              {octaveOffset > 0 ? `+${octaveOffset}` : octaveOffset}
            </span>
            <button
              onClick={() => setOctaveOffset(prev => Math.min(2, prev + 1))}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-slate-800"
              title="Octave Up"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono hidden md:flex items-center gap-1.5">
            <KeyboardIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Computer Keys: </span>
            <span className="text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded font-bold">Z-M</span>
            <span>&amp;</span>
            <span className="text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded font-bold">Q-U</span>
          </div>
        </div>

        {/* Real-time Wheels: Pitch Bend & Modulation */}
        <div className="flex items-center gap-4">
          {/* Pitch Bend */}
          <div className="flex items-center gap-1.5 bg-[#171c2a] px-2.5 py-1 rounded-xl border border-[#293246]">
            <span className="text-[10px] font-mono text-slate-400">BEND</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={pitchBend}
              onChange={(e) => setPitchBend(parseFloat(e.target.value))}
              onMouseUp={() => setPitchBend(0)} // Springs back to center
              className="w-16 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded"
              title="Pitch Bend (Springs to center)"
            />
          </div>

          {/* Modulation */}
          <div className="flex items-center gap-1.5 bg-[#171c2a] px-2.5 py-1 rounded-xl border border-[#293246]">
            <span className="text-[10px] font-mono text-slate-400">MOD</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={modWheel}
              onChange={(e) => setModWheel(parseFloat(e.target.value))}
              className="w-16 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded"
              title="Modulation Wheel"
            />
          </div>
        </div>
      </div>

      {/* Piano Keys Visual Deck */}
      <div className="relative h-44 flex overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
        {/* Render White and Black Keys */}
        {Array.from({ length: numKeys }).map((_, i) => {
          const pitch = baseMidi + i;
          const noteInOctave = pitch % 12;
          const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);
          const isPressed = activeNotes.has(pitch);
          const noteName = midiToNoteName(pitch);

          if (isBlack) {
            // Black keys are absolutely positioned or layered between white keys
            return (
              <button
                key={pitch}
                id={`vkey-${pitch}`}
                onMouseDown={() => triggerNoteOn(pitch)}
                onMouseUp={() => triggerNoteOff(pitch)}
                onMouseLeave={() => isPressed && triggerNoteOff(pitch)}
                className={`w-6 h-28 -mx-3 z-10 rounded-b-md transition-all cursor-pointer shadow-md ${
                  isPressed
                    ? 'bg-gradient-to-b from-indigo-500 to-indigo-700 scale-y-95 shadow-indigo-500/50'
                    : 'bg-gradient-to-b from-[#1c2233] to-[#0b0e17] hover:from-slate-700 hover:to-slate-900 border border-black'
                }`}
                title={`${noteName} (${pitch})`}
              >
                <span className="text-[8px] font-mono text-slate-400 block pt-16">
                  {noteName}
                </span>
              </button>
            );
          }

          return (
            <button
              key={pitch}
              id={`vkey-${pitch}`}
              onMouseDown={() => triggerNoteOn(pitch)}
              onMouseUp={() => triggerNoteOff(pitch)}
              onMouseLeave={() => isPressed && triggerNoteOff(pitch)}
              className={`flex-1 min-w-[32px] max-w-[42px] h-40 rounded-b-lg border border-[#cbd5e1]/40 transition-all flex flex-col justify-end pb-2.5 items-center cursor-pointer shadow-md ${
                isPressed
                  ? 'bg-gradient-to-b from-indigo-100 to-indigo-300 scale-y-98 shadow-inner'
                  : 'bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0] hover:bg-slate-100'
              }`}
              title={`${noteName} (${pitch})`}
            >
              <span className={`text-[9px] font-mono font-bold ${isPressed ? 'text-indigo-900' : 'text-slate-600'}`}>
                {noteName}
              </span>
              {noteInOctave === 0 && (
                <span className="w-1 h-1 rounded-full bg-indigo-600 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

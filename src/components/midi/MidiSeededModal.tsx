import React, { useState, useEffect } from 'react';
import {
  X,
  Dices,
  Sparkles,
  Music,
  Activity,
  Drum,
  Wand2,
  RefreshCw,
  Check
} from 'lucide-react';
import { MidiTrack } from '../../types';
import { generateSeedPhrase, MUSICAL_SCALES } from '../../audio/seededRandom';
import {
  generateSeededMidiTrack,
  randomizeMidiTrackWithSeed,
  MidiTrackRole
} from '../../audio/midiGenerator';

interface MidiSeededModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'generate' | 'randomize';
  targetTrack?: MidiTrack | null;
  bpm: number;
  duration: number;
  onGenerateTrack: (track: MidiTrack) => void;
  onRandomizeTrack: (mutated: MidiTrack) => void;
}

export const MidiSeededModal: React.FC<MidiSeededModalProps> = ({
  isOpen,
  onClose,
  mode,
  targetTrack,
  bpm,
  duration,
  onGenerateTrack,
  onRandomizeTrack
}) => {
  const [seed, setSeed] = useState<string>('');
  const [role, setRole] = useState<MidiTrackRole>('lead');
  const [scaleKey, setScaleKey] = useState<string>('dorian');
  const [trackName, setTrackName] = useState<string>('');
  const [intensity, setIntensity] = useState<'subtle' | 'moderate' | 'wild'>('moderate');
  const [mutatePitch, setMutatePitch] = useState(true);
  const [mutateVelocity, setMutateVelocity] = useState(true);
  const [mutateRhythm, setMutateRhythm] = useState(true);
  const [mutateProgram, setMutateProgram] = useState(true);
  const [appliedNotice, setAppliedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialSeed = generateSeedPhrase(mode === 'generate' ? 'midi' : 'rand');
      setSeed(initialSeed);
      if (mode === 'randomize' && targetTrack) {
        setTrackName(targetTrack.name);
      } else {
        setTrackName('');
      }
      setAppliedNotice(false);
    }
  }, [isOpen, mode, targetTrack]);

  if (!isOpen) return null;

  const handleRollSeed = () => {
    setSeed(generateSeedPhrase(mode === 'generate' ? 'midi' : 'rand'));
  };

  const handleExecute = () => {
    if (mode === 'generate') {
      const newTrack = generateSeededMidiTrack({
        seed,
        role,
        bpm,
        duration: duration > 0 ? duration : 8.0,
        scaleKey: scaleKey as any,
        name: trackName.trim() || undefined
      });
      onGenerateTrack(newTrack);
      onClose();
    } else if (mode === 'randomize' && targetTrack) {
      const mutated = randomizeMidiTrackWithSeed(targetTrack, seed, {
        seed,
        intensity,
        mutatePitch,
        mutateVelocity,
        mutateRhythm,
        mutateProgram
      });
      onRandomizeTrack(mutated);
      setAppliedNotice(true);
      setTimeout(() => {
        setAppliedNotice(false);
        onClose();
      }, 400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121622] border border-[#273147] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232a3d] bg-[#161c2b]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              {mode === 'generate' ? <Wand2 className="w-5 h-5" /> : <Dices className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {mode === 'generate' ? 'Seeded MIDI Track Generation' : `Randomize Track: ${targetTrack?.name || 'MIDI'}`}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'generate'
                  ? 'Procedurally generate algorithmic MIDI phrases, chords, or beats'
                  : 'Mutate MIDI note pitches, velocities, groove swing, and sound presets'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#20273a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Seed Input with Randomize Button */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
              <span>Deterministic Seed</span>
              <span className="text-[10px] text-purple-400 font-normal">Deterministic PRNG seed</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="midi-seed-input"
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Enter string or numeric seed..."
                className="flex-1 bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
              <button
                id="midi-roll-seed-btn"
                type="button"
                onClick={handleRollSeed}
                title="Roll New Seed"
                className="flex items-center gap-1.5 bg-[#20273a] hover:bg-[#2a344d] text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-[#33405c] transition-colors"
              >
                <Dices className="w-4 h-4 text-purple-400" />
                <span>Roll</span>
              </button>
            </div>
          </div>

          {mode === 'generate' ? (
            <>
              {/* Role Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Track Musical Role
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'lead', label: 'Lead', icon: Music, color: 'text-pink-400' },
                    { id: 'chords', label: 'Chords', icon: Music, color: 'text-emerald-400' },
                    { id: 'arp', label: 'Arpeggio', icon: Activity, color: 'text-cyan-400' },
                    { id: 'bass', label: 'Bassline', icon: Activity, color: 'text-indigo-400' },
                    { id: 'drums', label: 'Drums', icon: Drum, color: 'text-amber-400' }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = role === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setRole(item.id as MidiTrackRole)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold gap-1 transition-all ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                            : 'bg-[#181e2e] border-[#293245] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${item.color}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Musical Scale */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Scale &amp; Modal Key
                </label>
                <select
                  value={scaleKey}
                  onChange={(e) => setScaleKey(e.target.value)}
                  className="w-full bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-purple-500"
                >
                  {Object.entries(MUSICAL_SCALES).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.name} — {s.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Track Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Track Name (Optional)
                </label>
                <input
                  type="text"
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  placeholder={`e.g. ${role.toUpperCase()} Track`}
                  className="w-full bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-purple-500"
                />
              </div>
            </>
          ) : (
            <>
              {/* Randomization Intensity */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Mutation Intensity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['subtle', 'moderate', 'wild'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIntensity(lvl)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                        intensity === lvl
                          ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                          : 'bg-[#181e2e] border-[#293245] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mutation Options Checkboxes */}
              <div className="space-y-2 bg-[#171d2b] p-3 rounded-xl border border-[#273247]">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono block">
                  Elements to Mutate with Seed:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutatePitch}
                      onChange={(e) => setMutatePitch(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>Pitch Intervals &amp; Octaves</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateVelocity}
                      onChange={(e) => setMutateVelocity(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>Velocity Dynamics</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateRhythm}
                      onChange={(e) => setMutateRhythm(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>Timing Groove &amp; Swing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateProgram}
                      onChange={(e) => setMutateProgram(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>GM Sound &amp; Pan Position</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-[#232a3d] bg-[#161c2b]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#20273a] transition-colors"
          >
            Cancel
          </button>
          <button
            id="midi-modal-submit-btn"
            type="button"
            onClick={handleExecute}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
          >
            {appliedNotice ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Applied!</span>
              </>
            ) : mode === 'generate' ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Seeded Track</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Apply Seeded Randomization</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

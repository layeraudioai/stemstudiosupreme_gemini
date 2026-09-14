import React, { useState, useEffect } from 'react';
import {
  X,
  Dices,
  Sparkles,
  Sliders,
  Music,
  Activity,
  Drum,
  Mic,
  Volume2,
  Wand2,
  RefreshCw,
  Check,
  Waves,
  Zap,
  Wind,
  Piano,
  Users,
  Radio
} from 'lucide-react';
import { AudioStem, StemType } from '../../types';
import { generateSeedPhrase, MUSICAL_SCALES } from '../../audio/seededRandom';
import {
  generateSeededStem,
  randomizeStemWithSeed,
  SeededStemGenOptions,
  SeededStemMutateOptions
} from '../../audio/stemGenerator';

interface StemSeededModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'generate' | 'randomize';
  targetStem?: AudioStem | null;
  bpm: number;
  duration: number;
  onGenerateStem: (stem: AudioStem) => void;
  onRandomizeStem: (mutated: AudioStem) => void;
}

export const StemSeededModal: React.FC<StemSeededModalProps> = ({
  isOpen,
  onClose,
  mode,
  targetStem,
  bpm,
  duration,
  onGenerateStem,
  onRandomizeStem
}) => {
  const [seed, setSeed] = useState<string>('');
  const [stemType, setStemType] = useState<StemType>('bass');
  const [scaleKey, setScaleKey] = useState<string>('minor_pentatonic');
  const [stemName, setStemName] = useState<string>('');
  const [intensity, setIntensity] = useState<'subtle' | 'moderate' | 'wild'>('moderate');
  const [mutateNotes, setMutateNotes] = useState(true);
  const [mutateVelocities, setMutateVelocities] = useState(true);
  const [mutateTiming, setMutateTiming] = useState(true);
  const [mutateSound, setMutateSound] = useState(true);
  const [appliedNotice, setAppliedNotice] = useState(false);

  // Initialize seed when opening
  useEffect(() => {
    if (isOpen) {
      const initialSeed = generateSeedPhrase(mode === 'generate' ? 'gen' : 'rand');
      setSeed(initialSeed);
      if (mode === 'randomize' && targetStem) {
        setStemType(targetStem.type);
        setStemName(targetStem.name);
      } else {
        setStemName('');
      }
      setAppliedNotice(false);
    }
  }, [isOpen, mode, targetStem]);

  if (!isOpen) return null;

  const handleRollSeed = () => {
    setSeed(generateSeedPhrase(mode === 'generate' ? 'gen' : 'rand'));
  };

  const handleExecute = () => {
    if (mode === 'generate') {
      const newStem = generateSeededStem({
        seed,
        type: stemType,
        bpm,
        duration: duration > 0 ? duration : 8.0,
        scaleKey: scaleKey as any,
        name: stemName.trim() || undefined
      });
      onGenerateStem(newStem);
      onClose();
    } else if (mode === 'randomize' && targetStem) {
      const mutated = randomizeStemWithSeed(targetStem, seed, {
        seed,
        intensity,
        mutateNotes,
        mutateVelocities,
        mutateTiming,
        mutateSound
      });
      onRandomizeStem(mutated);
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
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              {mode === 'generate' ? <Wand2 className="w-5 h-5" /> : <Dices className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {mode === 'generate' ? 'Seeded Stem Generation' : `Randomize Stem: ${targetStem?.name || 'Track'}`}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'generate'
                  ? 'Procedurally synthesize a brand new audio stem with deterministic seed'
                  : 'Mutate MIDI notes, timing, velocities, and sound using reproducible PRNG seed'}
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
              <span className="text-[10px] text-indigo-400 font-normal">Identical seed = Identical output</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="stem-seed-input"
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Enter string or numeric seed..."
                className="flex-1 bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                id="stem-roll-seed-btn"
                type="button"
                onClick={handleRollSeed}
                title="Roll New Seed"
                className="flex items-center gap-1.5 bg-[#20273a] hover:bg-[#2a344d] text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-[#33405c] transition-colors"
              >
                <Dices className="w-4 h-4 text-indigo-400" />
                <span>Roll</span>
              </button>
            </div>
          </div>

          {mode === 'generate' ? (
            <>
              {/* Stem Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Stem Archetype
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'drums', label: 'Drums', icon: Drum, color: 'text-amber-400' },
                    { id: 'bass', label: 'Bassline', icon: Activity, color: 'text-indigo-400' },
                    { id: 'instruments', label: 'Poly / Chords', icon: Music, color: 'text-emerald-400' },
                    { id: 'vocal', label: 'Lead / Vocal', icon: Mic, color: 'text-pink-400' },
                    { id: 'guitar', label: 'Guitar', icon: Music, color: 'text-sky-400' },
                    { id: 'piano', label: 'Piano / Keys', icon: Piano, color: 'text-emerald-400' },
                    { id: 'strings', label: 'Strings', icon: Waves, color: 'text-violet-400' },
                    { id: 'synth', label: 'Lead Synth', icon: Zap, color: 'text-fuchsia-400' },
                    { id: 'ambient', label: 'Ambient FX', icon: Wind, color: 'text-teal-400' },
                    { id: 'backing_vocal', label: 'Backing Vocals', icon: Users, color: 'text-rose-400' },
                    { id: 'brass', label: 'Brass / Horns', icon: Radio, color: 'text-yellow-400' },
                    { id: 'other', label: 'Experimental', icon: Sparkles, color: 'text-cyan-400' }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = stemType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setStemType(item.id as StemType)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                            : 'bg-[#181e2e] border-[#293245] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${item.color}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Musical Scale */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Musical Scale / Harmony
                </label>
                <select
                  value={scaleKey}
                  onChange={(e) => setScaleKey(e.target.value)}
                  className="w-full bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-indigo-500"
                >
                  {Object.entries(MUSICAL_SCALES).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.name} — {s.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Custom Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Stem Name (Optional)
                </label>
                <input
                  type="text"
                  value={stemName}
                  onChange={(e) => setStemName(e.target.value)}
                  placeholder={`e.g. ${stemType.toUpperCase()} ${seed.slice(0, 6)}`}
                  className="w-full bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-indigo-500"
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
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
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
                      checked={mutateNotes}
                      onChange={(e) => setMutateNotes(e.target.checked)}
                      className="rounded accent-indigo-500"
                    />
                    <span>Note Pitches / Intervals</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateVelocities}
                      onChange={(e) => setMutateVelocities(e.target.checked)}
                      className="rounded accent-indigo-500"
                    />
                    <span>Velocity Dynamics</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateTiming}
                      onChange={(e) => setMutateTiming(e.target.checked)}
                      className="rounded accent-indigo-500"
                    />
                    <span>Micro-Timing &amp; Swing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateSound}
                      onChange={(e) => setMutateSound(e.target.checked)}
                      className="rounded accent-indigo-500"
                    />
                    <span>GM Sound &amp; Stereo Pan</span>
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
            id="stem-modal-submit-btn"
            type="button"
            onClick={handleExecute}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all"
          >
            {appliedNotice ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Applied!</span>
              </>
            ) : mode === 'generate' ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Seeded Stem</span>
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

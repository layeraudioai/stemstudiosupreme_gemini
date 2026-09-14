import React, { useState, useEffect } from 'react';
import {
  X,
  Dices,
  Sparkles,
  Sliders,
  Music,
  Activity,
  Wand2,
  RefreshCw,
  Check,
  Disc
} from 'lucide-react';
import { SF2Instrument, SF2Preset, SF2Sample } from '../../types';
import { generateSeedPhrase } from '../../audio/seededRandom';
import {
  generateSeededSF2Instrument,
  randomizeSF2SampleWithSeed,
  SF2SynthArchetype
} from '../../audio/sf2Generator';

interface Sf2SeededModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'generate' | 'randomize';
  targetSample?: SF2Sample | null;
  onGenerateInstrument: (preset: SF2Preset, instrument: SF2Instrument, sample: SF2Sample) => void;
  onRandomizeSample: (mutated: SF2Sample) => void;
}

export const Sf2SeededModal: React.FC<Sf2SeededModalProps> = ({
  isOpen,
  onClose,
  mode,
  targetSample,
  onGenerateInstrument,
  onRandomizeSample
}) => {
  const [seed, setSeed] = useState<string>('');
  const [archetype, setArchetype] = useState<SF2SynthArchetype>('supersaw');
  const [instrumentName, setInstrumentName] = useState<string>('');
  const [rootKey, setRootKey] = useState<number>(60);
  const [intensity, setIntensity] = useState<'subtle' | 'moderate' | 'wild'>('moderate');
  const [mutateEnvelope, setMutateEnvelope] = useState(true);
  const [mutateFilter, setMutateFilter] = useState(true);
  const [mutateTuning, setMutateTuning] = useState(true);
  const [mutateLoops, setMutateLoops] = useState(true);
  const [appliedNotice, setAppliedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialSeed = generateSeedPhrase(mode === 'generate' ? 'sf2' : 'rand');
      setSeed(initialSeed);
      if (mode === 'randomize' && targetSample) {
        setInstrumentName(targetSample.name);
        setRootKey(targetSample.rootKey);
      } else {
        setInstrumentName('');
        setRootKey(60);
      }
      setAppliedNotice(false);
    }
  }, [isOpen, mode, targetSample]);

  if (!isOpen) return null;

  const handleRollSeed = () => {
    setSeed(generateSeedPhrase(mode === 'generate' ? 'sf2' : 'rand'));
  };

  const handleExecute = () => {
    if (mode === 'generate') {
      const { preset, instrument, sample } = generateSeededSF2Instrument({
        seed,
        archetype,
        name: instrumentName.trim() || undefined,
        rootKey
      });
      onGenerateInstrument(preset, instrument, sample);
      onClose();
    } else if (mode === 'randomize' && targetSample) {
      const mutated = randomizeSF2SampleWithSeed(targetSample, seed, {
        seed,
        intensity,
        mutateEnvelope,
        mutateFilter,
        mutateTuning,
        mutateLoops
      });
      onRandomizeSample(mutated);
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
                {mode === 'generate' ? 'Seeded SF2 Instrument Generator' : `Randomize SF2: ${targetSample?.name || 'Sample'}`}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'generate'
                  ? 'Procedurally synthesize a complete SoundFont 2 multi-sample instrument'
                  : 'Mutate ADSR envelopes, filter cutoff, fine tuning, and loop regions'}
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
              <span className="text-[10px] text-purple-400 font-normal">Identical seed = Identical timbre</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="sf2-seed-input"
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Enter string or numeric seed..."
                className="flex-1 bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
              <button
                id="sf2-roll-seed-btn"
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
              {/* Archetype Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  SoundFont Synthesis Archetype
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'supersaw', label: 'SuperSaw Lead' },
                    { id: 'fm_bell', label: 'FM Bell' },
                    { id: 'sub_bass', label: '808 Sub-Bass' },
                    { id: 'ambient_pad', label: 'Ambient Pad' },
                    { id: 'analog_pluck', label: 'Analog Pluck' },
                    { id: 'chiptune', label: '8-Bit Chip' },
                    { id: 'organ', label: 'Drawbar Organ' },
                    { id: 'percussion', label: 'Percussion Kit' }
                  ].map((item) => {
                    const isSelected = archetype === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setArchetype(item.id as SF2SynthArchetype);
                          if (item.id === 'sub_bass' || item.id === 'percussion') {
                            setRootKey(36);
                          } else {
                            setRootKey(60);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                          isSelected
                            ? 'bg-purple-600/25 border-purple-500 text-white shadow-sm'
                            : 'bg-[#181e2e] border-[#293245] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Root Key & Instrument Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Root Key (MIDI)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="127"
                    value={rootKey}
                    onChange={(e) => setRootKey(Number(e.target.value))}
                    className="w-full bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Instrument Name
                  </label>
                  <input
                    type="text"
                    value={instrumentName}
                    onChange={(e) => setInstrumentName(e.target.value)}
                    placeholder={`e.g. ${archetype.toUpperCase()}`}
                    className="w-full bg-[#181e2e] border border-[#2c374f] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-purple-500"
                  />
                </div>
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
                  SF2 Generator Parameters to Mutate:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateEnvelope}
                      onChange={(e) => setMutateEnvelope(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>ADSR Envelope Times</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateFilter}
                      onChange={(e) => setMutateFilter(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>Filter Cutoff Frequency</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateTuning}
                      onChange={(e) => setMutateTuning(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>Fine Tuning (Cents)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mutateLoops}
                      onChange={(e) => setMutateLoops(e.target.checked)}
                      className="rounded accent-purple-500"
                    />
                    <span>Loop Start &amp; End Region</span>
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
            id="sf2-modal-submit-btn"
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
                <span>Generate Seeded Instrument</span>
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

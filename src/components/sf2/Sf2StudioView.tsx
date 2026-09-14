import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Music,
  Download,
  Upload,
  Layers,
  Sparkles,
  Sliders,
  FileCode,
  Check,
  Plus,
  Wand2,
  Dices
} from 'lucide-react';
import { SF2Bank, SF2Preset, SF2Sample, SF2Instrument, AudioStem } from '../../types';
import { VirtualKeyboard } from './VirtualKeyboard';
import { KeyZoneMap } from './KeyZoneMap';
import { SampleSliceEditor } from './SampleSliceEditor';
import { Sf2Inspector } from './Sf2Inspector';
import { Sf2SeededModal } from './Sf2SeededModal';
import { buildSF2Binary } from '../../audio/sf2Builder';
import { parseSF2Binary } from '../../audio/sf2Parser';
import { downloadBlob } from '../../audio/mp3Encoder';
import { getSynthEngine } from '../../audio/synthEngine';

interface Sf2StudioViewProps {
  banks: SF2Bank[];
  setBanks: React.Dispatch<React.SetStateAction<SF2Bank[]>>;
  activeBank: SF2Bank | null;
  setActiveBank: (bank: SF2Bank) => void;
  stems: AudioStem[];
  onUseInDAW: () => void;
  onUseInMidiConverter: () => void;
}

export const Sf2StudioView: React.FC<Sf2StudioViewProps> = ({
  banks,
  setBanks,
  activeBank,
  setActiveBank,
  stems,
  onUseInDAW,
  onUseInMidiConverter
}) => {
  const currentBank = activeBank || banks[0];
  const [selectedPresetId, setSelectedPresetId] = useState<string>(currentBank?.presets[0]?.id || '');
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'keyboard' | 'slicer' | 'inspector'>('keyboard');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const synth = getSynthEngine();

  const [isSeededSf2ModalOpen, setIsSeededSf2ModalOpen] = useState(false);
  const [seededSf2ModalMode, setSeededSf2ModalMode] = useState<'generate' | 'randomize'>('generate');
  const [targetSampleForSeeded, setTargetSampleForSeeded] = useState<SF2Sample | null>(null);

  const activePreset = currentBank?.presets.find(p => p.id === selectedPresetId) || currentBank?.presets[0] || null;
  const currentSamples = activePreset?.instruments.flatMap(i => i.samples) || [];
  const selectedSample = currentSamples.find(s => s.id === selectedSampleId) || currentSamples[0] || null;

  const handleOpenGenerateInstrument = () => {
    setSeededSf2ModalMode('generate');
    setTargetSampleForSeeded(null);
    setIsSeededSf2ModalOpen(true);
  };

  const handleOpenRandomizeSample = (sample: SF2Sample) => {
    setSeededSf2ModalMode('randomize');
    setTargetSampleForSeeded(sample);
    setIsSeededSf2ModalOpen(true);
  };

  const handleApplyGeneratedInstrument = (preset: SF2Preset, instrument: SF2Instrument, sample: SF2Sample) => {
    if (!currentBank) return;
    const nextPresetNum = currentBank.presets.length;
    const newPreset: SF2Preset = {
      ...preset,
      bank: 0,
      presetNum: nextPresetNum
    };
    const updatedBank: SF2Bank = {
      ...currentBank,
      presets: [...currentBank.presets, newPreset]
    };
    setBanks(prev => prev.map(b => b.id === updatedBank.id ? updatedBank : b));
    setActiveBank(updatedBank);
    setSelectedPresetId(newPreset.id);
    setSelectedSampleId(sample.id);
    synth.loadSoundFont(updatedBank);
  };

  const handleApplyRandomizedSample = (mutated: SF2Sample) => {
    handleUpdateSample(mutated);
  };

  // Upload external .sf2 file
  const handleUploadSf2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsedBank = parseSF2Binary(buffer);
      parsedBank.name = file.name.replace(/\.sf2$/i, '');
      setBanks(prev => [parsedBank, ...prev]);
      setActiveBank(parsedBank);
      synth.loadSoundFont(parsedBank);
      if (parsedBank.presets.length > 0) {
        setSelectedPresetId(parsedBank.presets[0].id);
      }
    } catch (err) {
      console.error('Failed to parse SF2 file:', err);
    }
  };

  // Export current active bank as binary .sf2
  const handleExportSF2 = () => {
    if (!currentBank) return;
    const uint8 = buildSF2Binary(currentBank);
    const blob = new Blob([uint8], { type: 'application/octet-stream' });
    downloadBlob(blob, `${currentBank.name.toLowerCase().replace(/\s+/g, '_')}.sf2`);
  };

  // Update sample in bank
  const handleUpdateSample = (updated: SF2Sample) => {
    if (!currentBank || !activePreset) return;

    const newPresets = currentBank.presets.map(p => {
      if (p.id !== activePreset.id) return p;
      return {
        ...p,
        instruments: p.instruments.map(inst => ({
          ...inst,
          samples: inst.samples.map(s => s.id === updated.id ? updated : s)
        }))
      };
    });

    const updatedBank = { ...currentBank, presets: newPresets };
    setBanks(prev => prev.map(b => b.id === updatedBank.id ? updatedBank : b));
    setActiveBank(updatedBank);
    synth.loadSoundFont(updatedBank);
  };

  // Convert Stem into SF2 Preset
  const handleImportStemAsPreset = (stem: AudioStem) => {
    if (!currentBank || !stem.audioBuffer) return;

    const newSample: SF2Sample = {
      id: `sample-stem-${Date.now()}`,
      name: stem.name,
      audioBuffer: stem.audioBuffer,
      rootKey: stem.type === 'bass' ? 36 : 60,
      keyRange: [0, 127],
      loopStart: 0,
      loopEnd: stem.audioBuffer.length,
      loopMode: true,
      sampleRate: stem.audioBuffer.sampleRate,
      fineTune: 0,
      attack: 0.01,
      decay: 0.4,
      sustain: 0.7,
      release: 0.3,
      filterCutoff: 18000
    };

    const newPreset: SF2Preset = {
      id: `preset-stem-${Date.now()}`,
      name: `${stem.name} (Stem)`,
      bank: stem.type === 'drums' ? 128 : 0,
      presetNum: currentBank.presets.length,
      instruments: [
        {
          id: `inst-${Date.now()}`,
          name: stem.name,
          samples: [newSample]
        }
      ]
    };

    const updatedBank = {
      ...currentBank,
      presets: [...currentBank.presets, newPreset]
    };

    setBanks(prev => prev.map(b => b.id === updatedBank.id ? updatedBank : b));
    setActiveBank(updatedBank);
    setSelectedPresetId(newPreset.id);
    setSelectedSampleId(newSample.id);
    synth.loadSoundFont(updatedBank);
  };

  return (
    <div id="sf2-studio-view" className="space-y-5 animate-in fade-in duration-150">
      {/* Top Banner: Bank Selector, Preset Switcher, Import/Export */}
      <div className="bg-[#121622] border border-[#232a3d] rounded-2xl p-4 shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: SoundFont Banks & Presets dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Bank Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">SoundFont:</span>
            <select
              id="sf2-bank-select"
              value={currentBank?.id || ''}
              onChange={(e) => {
                const b = banks.find(item => item.id === e.target.value);
                if (b) {
                  setActiveBank(b);
                  synth.loadSoundFont(b);
                  if (b.presets.length > 0) setSelectedPresetId(b.presets[0].id);
                }
              }}
              className="bg-[#181d2c] text-sm font-bold text-white border border-[#29344c] rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {banks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isBuiltIn ? '(Built-in)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Preset Select */}
          {currentBank && currentBank.presets.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 font-mono">Preset:</span>
              <select
                id="sf2-preset-select"
                value={activePreset?.id || ''}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="bg-[#181d2c] text-xs font-bold text-indigo-300 border border-[#29344c] rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {currentBank.presets.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (B:{p.bank} P:{p.presetNum})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Import SF2 File */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-[#181d2c] hover:bg-[#252f47] text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#29344c] transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load SF2</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sf2"
            onChange={handleUploadSf2}
            className="hidden"
          />
        </div>

        {/* Right: Export .sf2, Seeded Generation, & Sync buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="sf2-generate-instrument-btn"
            onClick={handleOpenGenerateInstrument}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md shadow-purple-600/20 cursor-pointer transition-all"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>+ Generate Instrument (Seeded)</span>
          </button>

          {selectedSample && (
            <button
              id="sf2-randomize-sample-btn"
              onClick={() => handleOpenRandomizeSample(selectedSample)}
              className="flex items-center gap-1.5 bg-[#181d2c] hover:bg-[#252f47] text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#29344c] transition-colors cursor-pointer"
              title="Randomize selected sample with deterministic seed"
            >
              <Dices className="w-3.5 h-3.5 text-purple-400" />
              <span>Randomize Sample</span>
            </button>
          )}

          <button
            id="sf2-export-btn"
            onClick={handleExportSF2}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md shadow-purple-600/20 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .SF2 Binary</span>
          </button>
        </div>
      </div>

      {/* Convert DAW Stems into SoundFont Presets prompt if stems available */}
      {stems.length > 0 && (
        <div className="bg-[#151928] border border-[#242d44] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Add separated stem from DAW directly into this SoundFont bank:</span>
          </div>
          <div className="flex items-center gap-2">
            {stems.map((st) => (
              <button
                key={st.id}
                onClick={() => handleImportStemAsPreset(st)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] transition-all bg-[#1c2235] hover:bg-[#26304a] text-slate-200 border border-[#2d3854]"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>+ {st.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#232a3d] pb-2">
        <button
          onClick={() => setActiveTab('keyboard')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'keyboard'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-[#181d2c]'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Virtual Keyboard &amp; Key Zones</span>
        </button>

        <button
          onClick={() => setActiveTab('slicer')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'slicer'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-[#181d2c]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Sample Slicer &amp; ADSR</span>
        </button>

        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'inspector'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-[#181d2c]'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>SF2 Binary RIFF Inspector</span>
        </button>
      </div>

      {/* Sub-Views */}
      {activeTab === 'keyboard' && (
        <div className="space-y-4">
          <VirtualKeyboard
            activeBank={currentBank}
            activePreset={activePreset}
            volume={0.9}
          />
          <KeyZoneMap
            samples={currentSamples}
            selectedSampleId={selectedSample?.id || null}
            onSelectSample={setSelectedSampleId}
            onUpdateKeyRange={(id, low, high, root) => {
              const target = currentSamples.find(s => s.id === id);
              if (target) {
                handleUpdateSample({ ...target, keyRange: [low, high], rootKey: root });
              }
            }}
          />
        </div>
      )}

      {activeTab === 'slicer' && (
        <SampleSliceEditor
          sample={selectedSample}
          onUpdateSample={handleUpdateSample}
          onAutoSliceStem={(samp, sens) => {
            console.log('Auto slicing sample with sensitivity:', sens);
          }}
          onOpenSeededRandomize={handleOpenRandomizeSample}
        />
      )}

      {activeTab === 'inspector' && currentBank && (
        <Sf2Inspector bank={currentBank} />
      )}

      {/* Seeded SF2 Instrument Generator & Randomizer Modal */}
      <Sf2SeededModal
        isOpen={isSeededSf2ModalOpen}
        onClose={() => setIsSeededSf2ModalOpen(false)}
        mode={seededSf2ModalMode}
        targetSample={targetSampleForSeeded}
        onGenerateInstrument={handleApplyGeneratedInstrument}
        onRandomizeSample={handleApplyRandomizedSample}
      />
    </div>
  );
};

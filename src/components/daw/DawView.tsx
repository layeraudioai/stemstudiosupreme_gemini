import React, { useState, useRef } from 'react';
import {
  Upload,
  Layers,
  Sparkles,
  Volume2,
  Music,
  FileAudio,
  Radio,
  Sliders,
  Scissors,
  Check,
  Disc,
  Dices,
  Wand2
} from 'lucide-react';
import { AudioStem, MidiNote, PlaybackMode, SF2Bank } from '../../types';
import { StemMixerItem } from './StemMixerItem';
import { PianoRollEditor } from './PianoRollEditor';
import { DawExportModal } from './DawExportModal';
import { StemSeededModal } from './StemSeededModal';
import { StemExtractionModal } from './StemExtractionModal';
import { separateAudioStems } from '../../audio/stemSeparator';
import { createDemoAudioTrack } from '../../audio/demoData';
import { decodeAudioFile } from '../../audio/audioContext';
import { ENSEMBLE_PROFILES } from '../../audio/ensembleProfiles';

interface DawViewProps {
  stems: AudioStem[];
  setStems: React.Dispatch<React.SetStateAction<AudioStem[]>>;
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;
  activeSF2Bank: SF2Bank | null;
  currentTime: number;
  duration: number;
  bpm: number;
  onSendToSF2Studio: (stem: AudioStem) => void;
  onSendMidiToConverter: () => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;
  activeDemoName: string;
  setActiveDemoName: (name: string) => void;
  isExtractionModalOpen: boolean;
  setIsExtractionModalOpen: (open: boolean) => void;
  isSeparating: boolean;
  separationProgress: { percent: number; status: string } | null;
  onApplySeparation: (newStems: AudioStem[], trackName: string) => void;
}

export const DawView: React.FC<DawViewProps> = ({
  stems,
  setStems,
  playbackMode,
  setPlaybackMode,
  activeSF2Bank,
  currentTime,
  duration,
  bpm,
  onSendToSF2Studio,
  onSendMidiToConverter,
  isExportModalOpen,
  setIsExportModalOpen,
  activeDemoName,
  setActiveDemoName,
  isExtractionModalOpen,
  setIsExtractionModalOpen,
  isSeparating,
  separationProgress,
  onApplySeparation
}) => {
  const [selectedStemId, setSelectedStemId] = useState<string>(stems[0]?.id || 'stem-vocal');
  const [isSeededModalOpen, setIsSeededModalOpen] = useState(false);
  const [seededModalMode, setSeededModalMode] = useState<'generate' | 'randomize'>('generate');
  const [targetStemForSeeded, setTargetStemForSeeded] = useState<AudioStem | null>(null);

  const selectedStem = stems.find(s => s.id === selectedStemId) || stems[0];

  const handleOpenGenerateStem = () => {
    setSeededModalMode('generate');
    setTargetStemForSeeded(null);
    setIsSeededModalOpen(true);
  };

  const handleOpenRandomizeStem = (stem: AudioStem) => {
    setSeededModalMode('randomize');
    setTargetStemForSeeded(stem);
    setIsSeededModalOpen(true);
  };

  const handleApplyGeneratedStem = (newStem: AudioStem) => {
    setStems(prev => [...prev, newStem]);
    setSelectedStemId(newStem.id);
  };

  const handleApplyRandomizedStem = (mutated: AudioStem) => {
    setStems(prev => prev.map(s => s.id === mutated.id ? mutated : s));
  };

  const handleRemoveStem = (stemId: string) => {
    setStems(prev => {
      const updated = prev.filter(s => s.id !== stemId);
      if (selectedStemId === stemId && updated.length > 0) {
        setSelectedStemId(updated[0].id);
      }
      return updated;
    });
  };

  const handleLocalApplySeparation = (newStems: AudioStem[], trackName: string) => {
    onApplySeparation(newStems, trackName);
    if (newStems.length > 0) {
      setSelectedStemId(newStems[0].id);
    }
  };

  // Stem Controls Handlers
  const handleVolumeChange = (id: string, vol: number) => {
    setStems(prev => prev.map(s => s.id === id ? { ...s, volume: vol } : s));
  };

  const handlePanChange = (id: string, pan: number) => {
    setStems(prev => prev.map(s => s.id === id ? { ...s, pan: pan } : s));
  };

  const handleMuteToggle = (id: string) => {
    setStems(prev => prev.map(s => s.id === id ? { ...s, muted: !s.muted } : s));
  };

  const handleSoloToggle = (id: string) => {
    setStems(prev => {
      const target = prev.find(s => s.id === id);
      const isSoloing = target ? !target.solo : false;
      return prev.map(s => s.id === id ? { ...s, solo: isSoloing } : { ...s, solo: false });
    });
  };

  const handleInstrumentChange = (id: string, prog: number) => {
    setStems(prev => prev.map(s => s.id === id ? { ...s, instrumentProgram: prog } : s));
  };

  const handleUpdateNotes = (stemId: string, notes: MidiNote[]) => {
    setStems(prev => prev.map(s => s.id === stemId ? { ...s, midiNotes: notes } : s));
  };

  return (
    <div id="daw-studio-view" className="space-y-5 animate-in fade-in duration-150">
      {/* Separation Progress Banner */}
      {isSeparating && separationProgress && (
        <div className="bg-indigo-950/70 border border-indigo-800/80 rounded-2xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-indigo-200">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              {separationProgress.status}
            </span>
            <span className="font-bold">{Math.round(separationProgress.percent)}%</span>
          </div>
          <div className="w-full h-2 bg-indigo-950 rounded-full overflow-hidden border border-indigo-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-200"
              style={{ width: `${separationProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Multi-Track Stem Mixer List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
              Stem Mixer Tracks ({stems.length})
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="daw-generate-stem-btn"
              onClick={handleOpenGenerateStem}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>+ Generate Stem (Seeded)</span>
            </button>
            <button
              onClick={onSendMidiToConverter}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Send Extracted MIDI to Converter &rarr;</span>
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {stems.map((stem) => (
            <StemMixerItem
              key={stem.id}
              stem={stem}
              currentTime={currentTime}
              duration={duration}
              onVolumeChange={handleVolumeChange}
              onPanChange={handlePanChange}
              onMuteToggle={handleMuteToggle}
              onSoloToggle={handleSoloToggle}
              onInstrumentChange={handleInstrumentChange}
              onSelectForPianoRoll={setSelectedStemId}
              onSendToSF2Slicer={onSendToSF2Studio}
              onOpenSeededRandomize={handleOpenRandomizeStem}
              onRemoveStem={handleRemoveStem}
              canRemove={stems.length > 1}
              isSelectedInPianoRoll={selectedStem.id === stem.id}
            />
          ))}
        </div>
      </div>

      {/* Interactive Piano Roll Editor for Selected Stem */}
      {selectedStem && (
        <PianoRollEditor
          selectedStem={selectedStem}
          allStems={stems}
          onUpdateNotes={handleUpdateNotes}
          currentTime={currentTime}
          duration={duration}
          bpm={bpm}
        />
      )}

      {/* Dynamic Ensemble & Stem Extraction Modal */}
      <StemExtractionModal
        isOpen={isExtractionModalOpen}
        onClose={() => setIsExtractionModalOpen(false)}
        currentStems={stems}
        onApplySeparation={handleLocalApplySeparation}
      />

      {/* DAW Export Modal */}
      <DawExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        stems={stems}
        bpm={bpm}
        duration={duration}
      />

      {/* Seeded Stem Generator & Randomizer Modal */}
      <StemSeededModal
        isOpen={isSeededModalOpen}
        onClose={() => setIsSeededModalOpen(false)}
        mode={seededModalMode}
        targetStem={targetStemForSeeded}
        bpm={bpm}
        duration={duration}
        onGenerateStem={handleApplyGeneratedStem}
        onRandomizeStem={handleApplyRandomizedStem}
      />
    </div>
  );
};

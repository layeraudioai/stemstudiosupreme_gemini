import React, { useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  VolumeX,
  Sliders,
  FolderOpen,
  Music,
  Disc3,
  Layers,
  Sparkles,
  Download,
  Upload,
  FileAudio,
  Wand2,
  Dices
} from 'lucide-react';
import { StudioTab, TransportState, PlaybackMode, SF2Bank, MidiSong } from '../types';

interface StudioHeaderProps {
  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;
  transport: TransportState;
  onPlayToggle: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onLoopToggle: () => void;
  onMasterVolumeChange: (vol: number) => void;
  onOpenExportModal?: () => void;
  dawActiveStemsCount: number;

  // Row 2: DAW props
  activeDemoName?: string;
  onLoadDemo?: (style: 'synthwave' | 'funk' | 'acoustic', name: string) => void;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenExtractionModal?: () => void;
  playbackMode?: PlaybackMode;
  onPlaybackModeChange?: (mode: PlaybackMode) => void;

  // Row 2: SF2 props
  banks?: SF2Bank[];
  activeBank?: SF2Bank | null;
  onSelectBank?: (bankId: string) => void;
  selectedPresetId?: string;
  onSelectPreset?: (presetId: string) => void;
  onUploadSf2?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenGenerateInstrument?: () => void;
  onOpenRandomizeSample?: () => void;
  onExportSf2?: () => void;

  // Row 2: MIDI props
  currentMidiSong?: MidiSong;
  onSelectMidiDemo?: (demoName: string) => void;
  onUploadMidi?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportDawStems?: () => void;
  onSelectMidiSF2Bank?: (bankId: string) => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  setActiveTab,
  transport,
  onPlayToggle,
  onStop,
  onBpmChange,
  onLoopToggle,
  onMasterVolumeChange,
  onOpenExportModal,
  dawActiveStemsCount,
  activeDemoName,
  onLoadDemo,
  onFileUpload,
  onOpenExtractionModal,
  playbackMode,
  onPlaybackModeChange,
  banks,
  activeBank,
  onSelectBank,
  selectedPresetId,
  onSelectPreset,
  onUploadSf2,
  onOpenGenerateInstrument,
  onOpenRandomizeSample,
  onExportSf2,
  currentMidiSong,
  onSelectMidiDemo,
  onUploadMidi,
  onImportDawStems,
  onSelectMidiSF2Bank
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sf2FileInputRef = useRef<HTMLInputElement | null>(null);
  const midiFileInputRef = useRef<HTMLInputElement | null>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0f121a]/95 backdrop-blur-md border-b border-[#232938] text-slate-200 select-none shadow-lg">
      <div className="w-full px-3 py-2 flex items-center justify-between gap-3 flex-nowrap overflow-x-auto">
        {/* Brand & Unified Suite Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-900/30 shrink-0">
            <Disc3 className="w-4 h-4 text-white animate-spin-slow" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide font-['Plus_Jakarta_Sans',sans-serif] whitespace-nowrap">
                StemStudio <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">Supreme</span>
              </h1>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 whitespace-nowrap">
                DAW + SF2 + MIDI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 whitespace-nowrap hidden xl:block">
              Merged Suite: daw.66ghz.com • sf2.2kool4u.net • midi.2kool4u.net
            </p>
          </div>
        </div>

        {/* Unified 3-Website Module Switcher */}
        <nav className="flex items-center bg-[#161a26] p-1 rounded-xl border border-[#2b3347] shrink-0 gap-1">
          <button
            id="nav-tab-daw"
            onClick={() => setActiveTab('daw')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'daw'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#202738]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>DAW & Stems</span>
            <span className="text-[10px] opacity-70 hidden md:inline">(daw.66ghz)</span>
          </button>

          <button
            id="nav-tab-sf2"
            onClick={() => setActiveTab('sf2')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'sf2'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#202738]'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>SF2 Studio</span>
            <span className="text-[10px] opacity-70 hidden md:inline">(sf2.2kool4u)</span>
          </button>

          <button
            id="nav-tab-midi"
            onClick={() => setActiveTab('midi')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'midi'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#202738]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>MIDI to MP3</span>
            <span className="text-[10px] opacity-70 hidden md:inline">(midi.2kool4u)</span>
          </button>
        </nav>

        {/* Unified Master Transport Bar & Export Hub */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Playback Controls */}
          <div className="flex items-center bg-[#161a26] border border-[#2b3347] rounded-xl p-1 gap-1">
            <button
              id="transport-play-btn"
              onClick={onPlayToggle}
              title={transport.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className={`p-1.5 rounded-lg transition-all ${
                transport.isPlaying
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/40'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
              }`}
            >
              {transport.isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              id="transport-stop-btn"
              onClick={onStop}
              title="Stop"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#202738] transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              id="transport-loop-btn"
              onClick={onLoopToggle}
              title="Loop playback"
              className={`p-1.5 rounded-lg transition-colors ${
                transport.isLooping
                  ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#202738]'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Time Display */}
          <div className="bg-[#161a26] border border-[#2b3347] px-2 py-1 rounded-xl font-mono text-xs text-center min-w-[80px]">
            <div className="text-emerald-400 font-bold tracking-wider leading-tight">
              {formatTime(transport.currentTime)}
            </div>
            <div className="text-[10px] text-slate-400 leading-tight">
              / {formatTime(transport.duration || 8)}
            </div>
          </div>

          {/* BPM Tap / Control */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#161a26] border border-[#2b3347] px-2 py-1.5 rounded-xl">
            <span className="text-[10px] font-mono text-slate-400 uppercase">BPM</span>
            <input
              id="transport-bpm-input"
              type="number"
              min="40"
              max="240"
              value={transport.bpm}
              onChange={(e) => onBpmChange(Math.max(40, Math.min(240, Number(e.target.value) || 120)))}
              className="w-10 bg-transparent text-xs font-mono text-white text-center border-b border-indigo-500/50 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          {/* Master Volume */}
          <div className="hidden md:flex items-center bg-[#161a26] border border-[#2b3347] px-2 py-1.5 rounded-xl gap-1.5">
            {transport.masterVolume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            )}
            <input
              id="transport-master-vol"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={transport.masterVolume}
              onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
              title="Master Volume"
              className="w-14 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
          </div>

          {/* Export / Hub Button */}
          {onOpenExportModal && (
            <button
              id="global-export-hub-btn"
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Hub</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: DAW Track Presets, File Loader, Ensemble Extraction & Engine Modes */}
      {activeTab === 'daw' && (
        <div className="w-full px-3 py-1.5 bg-[#121622]/95 border-t border-[#1f2638] flex items-center justify-between gap-2.5 flex-nowrap overflow-x-auto text-xs">
          {/* Left: Current Track Info & Audio Sources */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Track:</span>
              <span className="text-xs font-bold text-white bg-indigo-950/90 px-2 py-0.5 rounded-lg border border-indigo-700/50 whitespace-nowrap">
                {activeDemoName || 'Synthwave Horizon'}
              </span>
            </div>

            {/* Quick Demos */}
            <div className="flex items-center gap-1 bg-[#171c2b] p-0.5 rounded-xl border border-[#273147] shrink-0">
              <button
                id="header-demo-synthwave"
                onClick={() => onLoadDemo?.('synthwave', 'Synthwave Horizon')}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  activeDemoName === 'Synthwave Horizon' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Synthwave
              </button>
              <button
                id="header-demo-funk"
                onClick={() => onLoadDemo?.('funk', 'Retro Funk')}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  activeDemoName === 'Retro Funk' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Funk
              </button>
              <button
                id="header-demo-acoustic"
                onClick={() => onLoadDemo?.('acoustic', 'Acoustic Pop')}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  activeDemoName === 'Acoustic Pop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Acoustic
              </button>
            </div>

            {/* Custom Audio Upload Button */}
            <button
              id="header-import-audio-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold px-2.5 py-1 rounded-xl shadow-sm cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Audio (MP3/WAV)</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={onFileUpload}
              className="hidden"
            />

            {/* Dynamic Ensemble Extraction Modal Button */}
            <button
              id="header-daw-ensemble-extract-btn"
              onClick={onOpenExtractionModal}
              className="flex items-center gap-1.5 bg-[#1e2538] hover:bg-indigo-950/80 hover:text-indigo-200 text-slate-200 border border-[#2f3a55] text-xs font-semibold px-2.5 py-1 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Configure dynamic ensemble profiles (2 to 8 stems) and separate audio"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ensemble Extraction ({dawActiveStemsCount} Stems)</span>
            </button>
          </div>

          {/* Right: Triple Playback Engine Modes */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 font-mono hidden sm:inline uppercase">Engine:</span>
            <div className="flex items-center bg-[#171c2b] p-0.5 rounded-xl border border-[#273147] shrink-0">
              <button
                id="header-engine-mode-stems"
                onClick={() => onPlaybackModeChange?.('stems')}
                title="Play isolated audio stem buffers"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playbackMode === 'stems'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio Stems</span>
              </button>

              <button
                id="header-engine-mode-midi"
                onClick={() => onPlaybackModeChange?.('gm_synth')}
                title="Synthesize extracted MIDI with General MIDI instruments"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playbackMode === 'gm_synth'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>GM Synth</span>
              </button>

              <button
                id="header-engine-mode-sf2"
                onClick={() => onPlaybackModeChange?.('sf2_render')}
                title="Synthesize extracted MIDI using active SF2 SoundFont"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playbackMode === 'sf2_render'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileAudio className="w-3.5 h-3.5" />
                <span>SF2 SoundFont</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: SoundFont Studio Controls */}
      {activeTab === 'sf2' && (
        <div id="header-row-sf2" className="w-full px-3 py-1.5 bg-[#121622]/95 border-t border-[#1f2638] flex items-center justify-between gap-2.5 flex-nowrap overflow-x-auto text-xs">
          {/* Left: SoundFont and Preset Dropdowns */}
          <div className="flex items-center gap-2 shrink-0">
            {/* SoundFont Bank Select */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">SoundFont:</span>
              <select
                id="header-sf2-bank-select"
                value={activeBank?.id || ''}
                onChange={(e) => onSelectBank?.(e.target.value)}
                className="bg-[#171c2b] text-xs font-bold text-white border border-[#273147] rounded-xl px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[240px] truncate"
              >
                {banks?.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.isBuiltIn ? '(Built-in)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Preset Select */}
            {activeBank && activeBank.presets && activeBank.presets.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Preset:</span>
                <select
                  id="header-sf2-preset-select"
                  value={selectedPresetId || activeBank.presets[0]?.id || ''}
                  onChange={(e) => onSelectPreset?.(e.target.value)}
                  className="bg-[#171c2b] text-xs font-bold text-indigo-300 border border-[#273147] rounded-xl px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[220px] truncate"
                >
                  {activeBank.presets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (B:{p.bank} P:{p.presetNum})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Load SF2 File */}
            <button
              id="header-load-sf2-btn"
              onClick={() => sf2FileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-[#181d2c] hover:bg-[#252f47] text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-xl border border-[#29344c] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load SF2</span>
            </button>
            <input
              ref={sf2FileInputRef}
              type="file"
              accept=".sf2"
              onChange={onUploadSf2}
              className="hidden"
            />
          </div>

          {/* Right: + Generate Instrument (Seeded), Randomize Sample, Download SF2 */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="header-sf2-generate-instrument-btn"
              onClick={onOpenGenerateInstrument}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold px-2.5 py-1 rounded-xl shadow-sm cursor-pointer transition-all whitespace-nowrap shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>+ Generate Instrument (Seeded)</span>
            </button>

            <button
              id="header-sf2-randomize-sample-btn"
              onClick={onOpenRandomizeSample}
              className="flex items-center gap-1.5 bg-[#181d2c] hover:bg-[#252f47] text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-xl border border-[#29344c] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Randomize selected sample with deterministic seed"
            >
              <Dices className="w-3.5 h-3.5 text-purple-400" />
              <span>Randomize Sample</span>
            </button>

            {onExportSf2 && (
              <button
                id="header-sf2-export-btn"
                onClick={onExportSf2}
                className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-xl border border-indigo-700/60 cursor-pointer whitespace-nowrap shrink-0"
                title="Download .SF2 Binary"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download SF2</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Row 2: MIDI Converter Controls */}
      {activeTab === 'midi' && (
        <div id="header-row-midi" className="w-full px-3 py-1.5 bg-[#121622]/95 border-t border-[#1f2638] flex items-center justify-between gap-2.5 flex-nowrap overflow-x-auto text-xs">
          {/* Left: MIDI File Name, Quick Presets, File Upload, Import DAW */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">MIDI File:</span>
              <span className="text-xs font-bold text-white bg-indigo-950/90 px-2 py-0.5 rounded-lg border border-indigo-700/50 whitespace-nowrap max-w-[180px] truncate">
                {currentMidiSong?.name || 'Synthwave Horizon'}
              </span>
            </div>

            {/* Quick Demo Buttons */}
            <div className="flex items-center gap-1 bg-[#171c2b] p-0.5 rounded-xl border border-[#273147] shrink-0">
              <button
                id="header-midi-preset-synthwave"
                onClick={() => onSelectMidiDemo?.('Synthwave Horizon')}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  currentMidiSong?.name === 'Synthwave Horizon' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Synthwave
              </button>
              <button
                id="header-midi-preset-fur"
                onClick={() => onSelectMidiDemo?.('Für Elise (Beethoven)')}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  currentMidiSong?.name.startsWith('Für') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Für
              </button>
              <button
                id="header-midi-preset-chiptune"
                onClick={() => onSelectMidiDemo?.('Chiptune Quest (Retro 8-Bit)')}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  currentMidiSong?.name.startsWith('Chiptune') ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Chiptune
              </button>
            </div>

            {/* Custom MIDI Upload Button */}
            <button
              id="header-upload-midi-btn"
              onClick={() => midiFileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-[#181d2c] hover:bg-[#252f47] text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-xl border border-[#29344c] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Upload .MID</span>
            </button>
            <input
              ref={midiFileInputRef}
              type="file"
              accept=".mid,.midi"
              onChange={onUploadMidi}
              className="hidden"
            />

            {/* Load from DAW stems */}
            {dawActiveStemsCount > 0 && onImportDawStems && (
              <button
                id="header-import-daw-stems-btn"
                onClick={onImportDawStems}
                className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-xl border border-indigo-700/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Import transcribed MIDI from DAW stems"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Import DAW Stems</span>
              </button>
            )}
          </div>

          {/* Right: SoundFont Bank Selection for Conversion */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 font-mono hidden sm:inline uppercase">Synth SoundFont:</span>
            <select
              id="header-midi-sf2-select"
              value={activeBank?.id || ''}
              onChange={(e) => onSelectMidiSF2Bank?.(e.target.value)}
              className="bg-[#171c2b] text-xs font-bold text-indigo-300 border border-[#273147] rounded-xl px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[200px] truncate shrink-0"
            >
              {banks?.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isBuiltIn ? '(Built-in)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </header>
  );
};

import React, { useState, useRef } from 'react';
import {
  Upload,
  Music,
  Download,
  FileAudio,
  Sparkles,
  Sliders,
  Layers,
  Play,
  Square,
  CheckCircle2,
  Loader2,
  Disc,
  Wand2,
  Dices
} from 'lucide-react';
import { MidiSong, MidiTrack, SF2Bank, AudioStem } from '../../types';
import { FallingVisualizer } from './FallingVisualizer';
import { MidiTrackList } from './MidiTrackList';
import { MidiSeededModal } from './MidiSeededModal';
import { parseMidiFile, buildMidiFile } from '../../audio/midiParser';
import { renderMidiSongToAudio } from '../../audio/offlineRenderer';
import { getDemoMidiSongs } from '../../audio/demoData';
import { downloadBlob } from '../../audio/mp3Encoder';
import { getSynthEngine } from '../../audio/synthEngine';

interface MidiConverterViewProps {
  currentSong: MidiSong;
  setCurrentSong: React.Dispatch<React.SetStateAction<MidiSong>>;
  banks: SF2Bank[];
  activeSF2Bank: SF2Bank | null;
  setActiveSF2Bank: (bank: SF2Bank) => void;
  stems: AudioStem[];
  currentTime: number;
  bpm: number;
  onImportDawStems: () => void;
}

export const MidiConverterView: React.FC<MidiConverterViewProps> = ({
  currentSong,
  setCurrentSong,
  banks,
  activeSF2Bank,
  setActiveSF2Bank,
  stems,
  currentTime,
  bpm,
  onImportDawStems
}) => {
  const [demoSongs] = useState<MidiSong[]>(getDemoMidiSongs());
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [kbps, setKbps] = useState<128 | 192 | 256 | 320>(192);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ percent: number; status: string } | null>(null);

  // Rendered Audio Result
  const [renderedResult, setRenderedResult] = useState<{
    blob: Blob;
    url: string;
    format: string;
    sizeKb: number;
  } | null>(null);

  const [isSeededMidiModalOpen, setIsSeededMidiModalOpen] = useState(false);
  const [seededMidiModalMode, setSeededMidiModalMode] = useState<'generate' | 'randomize'>('generate');
  const [targetTrackForSeeded, setTargetTrackForSeeded] = useState<MidiTrack | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const synth = getSynthEngine();

  const handleOpenGenerateTrack = () => {
    setSeededMidiModalMode('generate');
    setTargetTrackForSeeded(null);
    setIsSeededMidiModalOpen(true);
  };

  const handleOpenRandomizeTrack = (track: MidiTrack) => {
    setSeededMidiModalMode('randomize');
    setTargetTrackForSeeded(track);
    setIsSeededMidiModalOpen(true);
  };

  const handleApplyGeneratedTrack = (newTrack: MidiTrack) => {
    setCurrentSong(prev => {
      const trackMaxTime = newTrack.notes.reduce((max, n) => Math.max(max, n.startTime + n.duration), 0);
      return {
        ...prev,
        tracks: [...prev.tracks, newTrack],
        duration: Math.max(prev.duration, trackMaxTime)
      };
    });
  };

  const handleApplyRandomizedTrack = (mutated: MidiTrack) => {
    setCurrentSong(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === mutated.id ? mutated : t)
    }));
  };

  // Load custom .mid file
  const handleUploadMidi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMidiFile(buffer);
      parsed.name = file.name.replace(/\.midi?$/i, '');
      setCurrentSong(parsed);
      setRenderedResult(null);
    } catch (err) {
      console.error('Failed to parse MIDI file:', err);
    }
  };

  // Update a track's properties
  const handleUpdateTrack = (trackId: string, partial: Partial<MidiTrack>) => {
    setCurrentSong(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, ...partial } : t)
    }));
  };

  // Solo toggle
  const handleSoloToggle = (trackId: string) => {
    setCurrentSong(prev => {
      const target = prev.tracks.find(t => t.id === trackId);
      const isSoloing = target ? !target.solo : false;
      return {
        ...prev,
        tracks: prev.tracks.map(t =>
          t.id === trackId ? { ...t, solo: isSoloing } : { ...t, solo: false }
        )
      };
    });
  };

  // Convert MIDI to MP3 / WAV via Offline Renderer
  const handleConvertMidi = async () => {
    setIsRendering(true);
    setRenderProgress({ percent: 5, status: 'Initializing render engine...' });

    try {
      const { blob } = await renderMidiSongToAudio(currentSong, {
        format,
        kbps,
        soundfont: activeSF2Bank,
        onProgress: (percent, status) => {
          setRenderProgress({ percent, status });
        }
      });

      const url = URL.createObjectURL(blob);
      setRenderedResult({
        blob,
        url,
        format,
        sizeKb: Math.round(blob.size / 1024)
      });

      setTimeout(() => {
        setIsRendering(false);
        setRenderProgress(null);
      }, 600);
    } catch (err) {
      console.error('Offline rendering error:', err);
      setIsRendering(false);
      setRenderProgress(null);
    }
  };

  const handleDownloadRendered = () => {
    if (!renderedResult) return;
    const cleanName = currentSong.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    downloadBlob(renderedResult.blob, `${cleanName}.${renderedResult.format}`);
  };

  const handleDownloadMidi = () => {
    const uint8 = buildMidiFile(currentSong);
    const blob = new Blob([uint8], { type: 'audio/midi' });
    const cleanName = currentSong.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    downloadBlob(blob, `${cleanName}.mid`);
  };

  return (
    <div id="midi-converter-view" className="space-y-5 animate-in fade-in duration-150">
      {/* Top Banner: Preset MIDIs, Custom File Uploader, SoundFont Selector */}
      <div className="bg-[#121622] border border-[#232a3d] rounded-2xl p-4 shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: MIDI song presets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">MIDI File:</span>
            <span className="text-sm font-bold text-white bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-700/50">
              {currentSong.name}
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 bg-[#171c2b] p-1 rounded-xl border border-[#273147]">
            {demoSongs.map(demo => (
              <button
                key={demo.name}
                onClick={() => {
                  setCurrentSong(demo);
                  setRenderedResult(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  currentSong.name === demo.name ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {demo.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Custom MIDI Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-[#181d2c] hover:bg-[#252f47] text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#29344c] transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Upload .MID</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi"
            onChange={handleUploadMidi}
            className="hidden"
          />

          {/* Load from DAW stems */}
          {stems.length > 0 && (
            <button
              onClick={onImportDawStems}
              className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-xl border border-indigo-700/60 transition-colors cursor-pointer"
              title="Import transcribed MIDI from DAW stems"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Import DAW Stems</span>
            </button>
          )}
        </div>

        {/* Right: SoundFont Bank Selection for Conversion */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 font-mono hidden sm:inline">Synth SoundFont:</span>
          <select
            value={activeSF2Bank?.id || ''}
            onChange={(e) => {
              const found = banks.find(b => b.id === e.target.value);
              if (found) {
                setActiveSF2Bank(found);
                synth.loadSoundFont(found);
              }
            }}
            className="bg-[#171c2b] text-xs font-bold text-indigo-300 border border-[#273147] rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {banks.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time Cascading / Falling Piano Roll Visualizer */}
      <FallingVisualizer song={currentSong} currentTime={currentTime} />

      {/* Conversion Settings & Offline Audio Exporter Bar */}
      <div className="bg-[#121622] border border-[#232a3d] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <FileAudio className="w-4 h-4 text-pink-400" />
              <span>Convert MIDI to Audio (MP3 / WAV)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              High-speed synthesis using Web Audio &amp; LameJS MP3 encoder
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Format toggle */}
            <div className="flex items-center bg-[#181d2c] p-1 rounded-xl border border-[#29344c]">
              <button
                onClick={() => setFormat('mp3')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  format === 'mp3' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                MP3
              </button>
              <button
                onClick={() => setFormat('wav')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  format === 'wav' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                WAV
              </button>
            </div>

            {/* MP3 Bitrate */}
            {format === 'mp3' && (
              <select
                value={kbps}
                onChange={(e) => setKbps(Number(e.target.value) as any)}
                className="bg-[#181d2c] text-xs text-slate-200 border border-[#29344c] rounded-xl px-2.5 py-1.5 focus:outline-none"
              >
                <option value={128}>128 kbps</option>
                <option value={192}>192 kbps</option>
                <option value={256}>256 kbps</option>
                <option value={320}>320 kbps</option>
              </select>
            )}

            {/* Convert Button */}
            <button
              id="midi-convert-action-btn"
              onClick={handleConvertMidi}
              disabled={isRendering}
              className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-pink-600/20 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Convert Now</span>
            </button>

            {/* Download MIDI file directly */}
            <button
              onClick={handleDownloadMidi}
              className="p-2 bg-[#181d2c] hover:bg-[#252f47] text-slate-400 hover:text-white rounded-xl border border-[#29344c] transition-colors"
              title="Download Standard MIDI File (.mid)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar when rendering */}
        {isRendering && renderProgress && (
          <div className="space-y-1.5 pt-2 border-t border-[#232a3d]">
            <div className="flex justify-between text-xs font-mono text-slate-300">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-pink-400 animate-spin" />
                {renderProgress.status}
              </span>
              <span className="font-bold">{Math.round(renderProgress.percent)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 transition-all duration-200"
                style={{ width: `${renderProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Rendered Audio Preview Player & Download */}
        {renderedResult && !isRendering && (
          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Conversion Complete!</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300 uppercase">
                    {renderedResult.format} • {renderedResult.sizeKb} KB
                  </span>
                </div>
                <audio
                  src={renderedResult.url}
                  controls
                  className="h-7 mt-1 w-64 accent-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleDownloadRendered}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download {renderedResult.format.toUpperCase()}</span>
            </button>
          </div>
        )}
      </div>

      {/* Multi-Track Channel Mixer List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
              MIDI Tracks ({currentSong.tracks.length})
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="midi-generate-track-btn"
              onClick={handleOpenGenerateTrack}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>+ Generate Track (Seeded)</span>
            </button>
            <span className="text-xs text-slate-400 font-mono">
              {currentSong.duration}s • {currentSong.bpm} BPM
            </span>
          </div>
        </div>

        <MidiTrackList
          tracks={currentSong.tracks}
          onUpdateTrack={handleUpdateTrack}
          onSoloToggle={handleSoloToggle}
          onOpenSeededRandomize={handleOpenRandomizeTrack}
        />
      </div>

      {/* Seeded MIDI Track Generator & Randomizer Modal */}
      <MidiSeededModal
        isOpen={isSeededMidiModalOpen}
        onClose={() => setIsSeededMidiModalOpen(false)}
        mode={seededMidiModalMode}
        targetTrack={targetTrackForSeeded}
        bpm={bpm || currentSong.bpm || 120}
        duration={currentSong.duration || 8.0}
        onGenerateTrack={handleApplyGeneratedTrack}
        onRandomizeTrack={handleApplyRandomizedTrack}
      />
    </div>
  );
};

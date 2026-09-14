import React, { useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Download,
  Eye,
  Scissors,
  Music,
  Mic,
  Drum,
  Activity,
  Dices,
  Users,
  Sparkles,
  Piano,
  Waves,
  Radio,
  Zap,
  Wind,
  Sliders,
  Layers,
  Trash2
} from 'lucide-react';
import { AudioStem } from '../../types';
import { GM_INSTRUMENTS } from '../../audio/gmInstruments';
import { audioBufferToWavBlob, downloadBlob } from '../../audio/mp3Encoder';
import { getStemDefinition } from '../../audio/ensembleProfiles';

interface StemMixerItemProps {
  stem: AudioStem;
  currentTime: number;
  duration: number;
  onVolumeChange: (id: string, vol: number) => void;
  onPanChange: (id: string, pan: number) => void;
  onMuteToggle: (id: string) => void;
  onSoloToggle: (id: string) => void;
  onInstrumentChange: (id: string, prog: number) => void;
  onSelectForPianoRoll: (id: string) => void;
  onSendToSF2Slicer: (stem: AudioStem) => void;
  onOpenSeededRandomize?: (stem: AudioStem) => void;
  onRemoveStem?: (id: string) => void;
  canRemove?: boolean;
  isSelectedInPianoRoll: boolean;
}

export const StemMixerItem: React.FC<StemMixerItemProps> = ({
  stem,
  currentTime,
  duration,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onInstrumentChange,
  onSelectForPianoRoll,
  onSendToSF2Slicer,
  onOpenSeededRandomize,
  onRemoveStem,
  canRemove = false,
  isSelectedInPianoRoll
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render waveform peaks with playhead
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const peaks = stem.peaks || [];
    if (peaks.length === 0) return;

    const barWidth = Math.max(1, width / peaks.length);
    const midY = height / 2;

    // Draw waveform bars
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const barH = Math.max(2, peak * (height - 8));
      const x = i * barWidth;
      const progressRatio = currentTime / (duration || 1);
      const isPast = (i / peaks.length) <= progressRatio;

      ctx.fillStyle = stem.muted
        ? '#334155'
        : isPast
        ? stem.color
        : `${stem.color}66`;

      ctx.fillRect(x, midY - barH / 2, barWidth - 1, barH);
    }

    // Draw Playhead cursor
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [stem.peaks, currentTime, duration, stem.color, stem.muted]);

  const handleDownloadWav = () => {
    if (!stem.audioBuffer) return;
    const blob = audioBufferToWavBlob(stem.audioBuffer);
    downloadBlob(blob, `${stem.name.toLowerCase().replace(/\s+/g, '_')}_stem.wav`);
  };

  const getStemIcon = () => {
    switch (stem.type) {
      case 'vocal': return <Mic className="w-4 h-4 text-pink-400" />;
      case 'backing_vocal': return <Users className="w-4 h-4 text-rose-400" />;
      case 'drums': return <Drum className="w-4 h-4 text-amber-400" />;
      case 'percussion': return <Sparkles className="w-4 h-4 text-orange-400" />;
      case 'bass': return <Activity className="w-4 h-4 text-indigo-400" />;
      case 'guitar': return <Music className="w-4 h-4 text-sky-400" />;
      case 'piano': return <Piano className="w-4 h-4 text-emerald-400" />;
      case 'strings': return <Waves className="w-4 h-4 text-violet-400" />;
      case 'brass': return <Radio className="w-4 h-4 text-yellow-400" />;
      case 'synth': return <Zap className="w-4 h-4 text-fuchsia-400" />;
      case 'ambient': return <Wind className="w-4 h-4 text-teal-400" />;
      case 'instruments': return <Sliders className="w-4 h-4 text-emerald-400" />;
      default: return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  const def = getStemDefinition(stem.type);

  return (
    <div
      id={`stem-track-${stem.id}`}
      className={`bg-[#141824] border rounded-xl p-3.5 transition-all ${
        isSelectedInPianoRoll
          ? 'border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/40'
          : 'border-[#23293a] hover:border-[#2f384f]'
      }`}
    >
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Track Title, Instrument & Mode Badges */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
            style={{ backgroundColor: `${stem.color}18`, borderColor: `${stem.color}40` }}
            title={`${def.description} • ${def.freqRange}`}
          >
            {getStemIcon()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">{stem.name}</h3>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold"
                style={{ backgroundColor: `${stem.color}25`, color: stem.color }}
                title={def.freqRange}
              >
                {stem.type.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {/* General MIDI Mapping selector */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-slate-400 font-mono">GM:</span>
              <select
                id={`stem-gm-select-${stem.id}`}
                value={stem.instrumentProgram}
                onChange={(e) => onInstrumentChange(stem.id, Number(e.target.value))}
                className="bg-[#1b2030] text-[11px] text-slate-200 border border-[#2e374d] rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 max-w-[150px] truncate"
              >
                {GM_INSTRUMENTS.map((inst) => (
                  <option key={inst.program} value={inst.program}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Solo, Mute, Volume & Pan Controls */}
        <div className="flex items-center gap-2.5">
          {/* Solo Button */}
          <button
            id={`stem-solo-${stem.id}`}
            onClick={() => onSoloToggle(stem.id)}
            title="Solo Track"
            className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
              stem.solo
                ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30'
                : 'bg-[#1c2233] text-slate-400 hover:text-slate-200 hover:bg-[#252d42]'
            }`}
          >
            S
          </button>

          {/* Mute Button */}
          <button
            id={`stem-mute-${stem.id}`}
            onClick={() => onMuteToggle(stem.id)}
            title="Mute Track"
            className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
              stem.muted
                ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                : 'bg-[#1c2233] text-slate-400 hover:text-slate-200 hover:bg-[#252d42]'
            }`}
          >
            M
          </button>

          {/* Volume Fader */}
          <div className="flex items-center gap-1.5 bg-[#1a2030] px-2 py-1 rounded-lg border border-[#2b344a]">
            {stem.volume === 0 || stem.muted ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            )}
            <input
              id={`stem-volume-${stem.id}`}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={stem.volume}
              onChange={(e) => onVolumeChange(stem.id, parseFloat(e.target.value))}
              className="w-16 accent-indigo-500 cursor-pointer h-1 bg-slate-700 rounded"
              title={`Volume: ${Math.round(stem.volume * 100)}%`}
            />
            <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
              {Math.round(stem.volume * 100)}%
            </span>
          </div>

          {/* Pan Knob Slider */}
          <div className="flex items-center gap-1 bg-[#1a2030] px-2 py-1 rounded-lg border border-[#2b344a]">
            <span className="text-[10px] font-mono text-slate-400">PAN</span>
            <input
              id={`stem-pan-${stem.id}`}
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={stem.pan}
              onChange={(e) => onPanChange(stem.id, parseFloat(e.target.value))}
              className="w-12 accent-indigo-500 cursor-pointer h-1 bg-slate-700 rounded"
              title={`Pan: ${stem.pan === 0 ? 'C' : stem.pan < 0 ? `L${Math.round(-stem.pan * 50)}` : `R${Math.round(stem.pan * 50)}`}`}
            />
            <span className="text-[10px] font-mono text-slate-400 w-5 text-right">
              {stem.pan === 0 ? 'C' : stem.pan < 0 ? `L${Math.round(-stem.pan * 50)}` : `R${Math.round(stem.pan * 50)}`}
            </span>
          </div>
        </div>

        {/* Interactive Waveform Canvas */}
        <div className="flex-1 w-full lg:w-auto h-12 bg-[#0c0e15] rounded-lg border border-[#202738] overflow-hidden relative">
          <canvas
            ref={canvasRef}
            width={400}
            height={48}
            className="w-full h-full block cursor-pointer"
          />
        </div>

        {/* Stem Quick Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id={`stem-pianoroll-btn-${stem.id}`}
            onClick={() => onSelectForPianoRoll(stem.id)}
            title="Edit extracted MIDI in Piano Roll"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              isSelectedInPianoRoll
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-[#1b2131] hover:bg-[#252d42] text-slate-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Piano Roll</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/40 text-indigo-300">
              {stem.midiNotes.length}n
            </span>
          </button>

          <button
            id={`stem-randomize-btn-${stem.id}`}
            onClick={() => onOpenSeededRandomize?.(stem)}
            title="Randomize & mutate stem with deterministic seed"
            className="flex items-center gap-1.5 bg-[#1b2131] hover:bg-indigo-950 hover:text-indigo-200 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Randomize</span>
          </button>

          <button
            id={`stem-send-sf2-btn-${stem.id}`}
            onClick={() => onSendToSF2Slicer(stem)}
            title="Slice stem into SoundFont (SF2) multi-sample bank"
            className="flex items-center gap-1.5 bg-[#1b2131] hover:bg-purple-950 hover:text-purple-200 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">SF2</span>
          </button>

          <button
            id={`stem-download-wav-${stem.id}`}
            onClick={handleDownloadWav}
            title="Download Stem WAV"
            className="p-1.5 bg-[#1b2131] hover:bg-[#252d42] text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {canRemove && onRemoveStem && (
            <button
              id={`stem-remove-${stem.id}`}
              onClick={() => onRemoveStem(stem.id)}
              title="Remove Stem Track"
              className="p-1.5 bg-[#1b2131] hover:bg-rose-950 hover:text-rose-300 text-slate-400 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

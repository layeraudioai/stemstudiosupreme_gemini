import React, { useRef, useEffect, useState } from 'react';
import { Play, Square, Scissors, Sliders, Repeat, Sparkles, Volume2, Dices } from 'lucide-react';
import { SF2Sample } from '../../types';
import { midiToNoteName, extractPeaks } from '../../audio/audioContext';
import { getSynthEngine } from '../../audio/synthEngine';

interface SampleSliceEditorProps {
  sample: SF2Sample | null;
  onUpdateSample: (updated: SF2Sample) => void;
  onAutoSliceStem?: (sample: SF2Sample, sensitivity: number) => void;
  onOpenSeededRandomize?: (sample: SF2Sample) => void;
}

export const SampleSliceEditor: React.FC<SampleSliceEditorProps> = ({
  sample,
  onUpdateSample,
  onAutoSliceStem,
  onOpenSeededRandomize
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliceSensitivity, setSliceSensitivity] = useState(0.5);

  const synth = getSynthEngine();

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sample || !sample.audioBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const peaks = extractPeaks(sample.audioBuffer, 256);
    const midY = height / 2;
    const barWidth = Math.max(1, width / peaks.length);

    // Draw waveform bars
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const barH = Math.max(2, p * (height - 12));
      const x = i * barWidth;

      ctx.fillStyle = '#6366f1';
      ctx.fillRect(x, midY - barH / 2, barWidth - 1, barH);
    }

    // Draw Loop region if enabled
    if (sample.loopMode && sample.audioBuffer.length > 0) {
      const loopStartX = (sample.loopStart / sample.audioBuffer.length) * width;
      const loopEndX = (sample.loopEnd / sample.audioBuffer.length) * width;

      ctx.fillStyle = '#10b98125';
      ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, height);

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(loopStartX, 0);
      ctx.lineTo(loopStartX, height);
      ctx.moveTo(loopEndX, 0);
      ctx.lineTo(loopEndX, height);
      ctx.stroke();
    }
  }, [sample]);

  if (!sample) {
    return (
      <div className="bg-[#121622] border border-[#232a3d] rounded-2xl p-8 text-center text-slate-400 font-mono text-xs">
        Select a sample in the Key Zone Map or Presets to edit parameters.
      </div>
    );
  }

  const handlePlaySample = () => {
    setIsPlaying(true);
    synth.noteOn(sample.rootKey, 100, 0, 0);
    setTimeout(() => {
      synth.noteOff(sample.rootKey, 0);
      setIsPlaying(false);
    }, 1200);
  };

  return (
    <div id="sf2-sample-slice-editor" className="bg-[#121622] border border-[#232a3d] rounded-2xl p-5 shadow-xl space-y-5">
      {/* Sample Header & Play Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#232a3d]">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlaySample}
            className={`p-2 rounded-xl text-white font-bold transition-all ${
              isPlaying
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20'
            }`}
            title="Audition Sample (Space)"
          >
            {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>
          <div>
            <input
              type="text"
              value={sample.name}
              onChange={(e) => onUpdateSample({ ...sample, name: e.target.value })}
              className="text-sm font-bold text-white bg-transparent border-b border-transparent hover:border-slate-600 focus:border-indigo-500 focus:outline-none"
            />
            <div className="text-[11px] font-mono text-slate-400">
              Root: <span className="text-amber-400 font-bold">{midiToNoteName(sample.rootKey)}</span> ({sample.rootKey}) • Rate: {sample.sampleRate} Hz
            </div>
          </div>
        </div>

        {/* Transient Slicer tool */}
        {onAutoSliceStem && (
          <div className="flex items-center gap-2 bg-[#171c2a] px-3 py-1.5 rounded-xl border border-[#273147]">
            <Scissors className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-mono text-slate-300">Slice Sensitivity:</span>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={sliceSensitivity}
              onChange={(e) => setSliceSensitivity(parseFloat(e.target.value))}
              className="w-16 accent-purple-500 cursor-pointer h-1.5 bg-slate-700 rounded"
            />
            <button
              onClick={() => onAutoSliceStem(sample, sliceSensitivity)}
              className="text-xs font-bold text-purple-300 hover:text-white bg-purple-950/80 px-2 py-1 rounded-lg border border-purple-700/50 hover:bg-purple-900 transition-colors cursor-pointer"
            >
              Auto Slice
            </button>
          </div>
        )}

        {/* Seeded Randomize Sample */}
        {onOpenSeededRandomize && sample && (
          <button
            id={`sf2-sample-randomize-btn-${sample.id}`}
            onClick={() => onOpenSeededRandomize(sample)}
            title="Randomize sample ADSR, tuning, and filter using deterministic seed"
            className="flex items-center gap-1.5 bg-[#171c2a] hover:bg-purple-950 hover:text-purple-200 text-slate-300 px-3 py-1.5 rounded-xl border border-[#273147] text-xs font-bold transition-colors cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5 text-purple-400" />
            <span>Randomize (Seeded)</span>
          </button>
        )}
      </div>

      {/* Waveform Canvas */}
      <div className="h-28 bg-[#0b0e16] rounded-xl border border-[#202738] overflow-hidden p-1">
        <canvas ref={canvasRef} width={600} height={104} className="w-full h-full block" />
      </div>

      {/* Parameter Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pitch & Root Key */}
        <div className="bg-[#171c2b] p-3.5 rounded-xl border border-[#252f44] space-y-2">
          <div className="text-xs font-bold text-slate-300 font-mono flex items-center justify-between">
            <span>Root Key:</span>
            <span className="text-amber-400">{midiToNoteName(sample.rootKey)} ({sample.rootKey})</span>
          </div>
          <input
            type="range"
            min="0"
            max="127"
            value={sample.rootKey}
            onChange={(e) => onUpdateSample({ ...sample, rootKey: Number(e.target.value) })}
            className="w-full accent-amber-400 h-1.5 bg-slate-700 rounded cursor-pointer"
          />

          <div className="pt-2 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Fine Tune:</span>
            <span className="text-slate-200">{sample.fineTune || 0} cents</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            value={sample.fineTune || 0}
            onChange={(e) => onUpdateSample({ ...sample, fineTune: Number(e.target.value) })}
            className="w-full accent-indigo-400 h-1.5 bg-slate-700 rounded cursor-pointer"
          />
        </div>

        {/* Key Zone Range */}
        <div className="bg-[#171c2b] p-3.5 rounded-xl border border-[#252f44] space-y-2">
          <div className="text-xs font-bold text-slate-300 font-mono">
            Key Range: [{midiToNoteName(sample.keyRange[0])} - {midiToNoteName(sample.keyRange[1])}]
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-[10px] text-slate-400 block font-mono">Low Key</span>
              <input
                type="number"
                min="0"
                max={sample.keyRange[1]}
                value={sample.keyRange[0]}
                onChange={(e) =>
                  onUpdateSample({
                    ...sample,
                    keyRange: [Number(e.target.value), sample.keyRange[1]]
                  })
                }
                className="w-full bg-[#10131d] text-xs font-mono text-white p-1 rounded border border-[#2e374f]"
              />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-slate-400 block font-mono">High Key</span>
              <input
                type="number"
                min={sample.keyRange[0]}
                max="127"
                value={sample.keyRange[1]}
                onChange={(e) =>
                  onUpdateSample({
                    ...sample,
                    keyRange: [sample.keyRange[0], Number(e.target.value)]
                  })
                }
                className="w-full bg-[#10131d] text-xs font-mono text-white p-1 rounded border border-[#2e374f]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Filter Cutoff:</span>
            <span className="text-slate-200">{sample.filterCutoff || 18000} Hz</span>
          </div>
          <input
            type="range"
            min="200"
            max="20000"
            step="100"
            value={sample.filterCutoff || 18000}
            onChange={(e) => onUpdateSample({ ...sample, filterCutoff: Number(e.target.value) })}
            className="w-full accent-emerald-400 h-1.5 bg-slate-700 rounded cursor-pointer"
          />
        </div>

        {/* Loop Region */}
        <div className="bg-[#171c2b] p-3.5 rounded-xl border border-[#252f44] space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 font-mono">
            <span>Loop Mode:</span>
            <button
              onClick={() => onUpdateSample({ ...sample, loopMode: !sample.loopMode })}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                sample.loopMode ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {sample.loopMode ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          <div className="text-[10px] font-mono text-slate-400">
            Start: {sample.loopStart} spl • End: {sample.loopEnd} spl
          </div>
          <input
            type="range"
            min="0"
            max={sample.audioBuffer?.length || 44100}
            value={sample.loopStart}
            onChange={(e) => onUpdateSample({ ...sample, loopStart: Number(e.target.value) })}
            className="w-full accent-emerald-400 h-1.5 bg-slate-700 rounded cursor-pointer"
          />
          <input
            type="range"
            min="0"
            max={sample.audioBuffer?.length || 44100}
            value={sample.loopEnd}
            onChange={(e) => onUpdateSample({ ...sample, loopEnd: Number(e.target.value) })}
            className="w-full accent-emerald-400 h-1.5 bg-slate-700 rounded cursor-pointer"
          />
        </div>

        {/* ADSR Envelope */}
        <div className="bg-[#171c2b] p-3.5 rounded-xl border border-[#252f44] space-y-1.5">
          <div className="text-xs font-bold text-slate-300 font-mono mb-1">
            ADSR Volume Envelope
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Attack: {sample.attack ?? 0.01}s</span>
            <input
              type="range"
              min="0.001"
              max="2.0"
              step="0.01"
              value={sample.attack ?? 0.01}
              onChange={(e) => onUpdateSample({ ...sample, attack: parseFloat(e.target.value) })}
              className="w-20 accent-indigo-400 h-1 bg-slate-700 rounded"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Decay: {sample.decay ?? 0.3}s</span>
            <input
              type="range"
              min="0.01"
              max="2.0"
              step="0.01"
              value={sample.decay ?? 0.3}
              onChange={(e) => onUpdateSample({ ...sample, decay: parseFloat(e.target.value) })}
              className="w-20 accent-indigo-400 h-1 bg-slate-700 rounded"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Sustain: {Math.round((sample.sustain ?? 0.7) * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.05"
              value={sample.sustain ?? 0.7}
              onChange={(e) => onUpdateSample({ ...sample, sustain: parseFloat(e.target.value) })}
              className="w-20 accent-indigo-400 h-1 bg-slate-700 rounded"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Release: {sample.release ?? 0.3}s</span>
            <input
              type="range"
              min="0.01"
              max="3.0"
              step="0.01"
              value={sample.release ?? 0.3}
              onChange={(e) => onUpdateSample({ ...sample, release: parseFloat(e.target.value) })}
              className="w-20 accent-indigo-400 h-1 bg-slate-700 rounded"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

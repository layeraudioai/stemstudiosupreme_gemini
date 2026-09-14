import React from 'react';
import { SF2Sample } from '../../types';
import { midiToNoteName } from '../../audio/audioContext';

interface KeyZoneMapProps {
  samples: SF2Sample[];
  selectedSampleId: string | null;
  onSelectSample: (id: string) => void;
  onUpdateKeyRange: (id: string, lowKey: number, highKey: number, rootKey: number) => void;
}

export const KeyZoneMap: React.FC<KeyZoneMapProps> = ({
  samples,
  selectedSampleId,
  onSelectSample,
  onUpdateKeyRange
}) => {
  const totalMidiKeys = 128; // 0 to 127
  const octaves = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div id="sf2-key-zone-map" className="bg-[#121622] border border-[#232a3d] rounded-2xl p-4 shadow-xl select-none space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">Key Zone Mapping (MIDI 0 - 127)</h3>
          <p className="text-[11px] text-slate-400">Click a sample zone to inspect parameters, root key, and envelope</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" /> Zone Range
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            ◆ Root Key (Center Pitch)
          </span>
        </div>
      </div>

      {/* Octave Markers Bar */}
      <div className="relative h-6 bg-[#0d1017] rounded-lg border border-[#212738] flex items-center overflow-hidden">
        {octaves.map((oct, idx) => {
          const cMidi = (oct + 1) * 12;
          if (cMidi > 127) return null;
          const leftPercent = (cMidi / 127) * 100;

          return (
            <div
              key={oct}
              style={{ left: `${leftPercent}%` }}
              className="absolute top-0 bottom-0 border-l border-slate-700/60 pl-1 flex items-center"
            >
              <span className="text-[9px] font-mono text-slate-400 font-bold">
                C{oct} ({cMidi})
              </span>
            </div>
          );
        })}
      </div>

      {/* Samples Zones Stack */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
        {samples.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500 font-mono">
            No samples in this instrument. Add or slice a stem!
          </div>
        ) : (
          samples.map((sample, idx) => {
            const isSelected = sample.id === selectedSampleId;
            const [low, high] = sample.keyRange || [0, 127];
            const leftPercent = (low / 127) * 100;
            const widthPercent = Math.max(3, ((high - low + 1) / 127) * 100);
            const rootPercent = (sample.rootKey / 127) * 100;

            const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'];
            const color = colors[idx % colors.length];

            return (
              <div
                key={sample.id}
                onClick={() => onSelectSample(sample.id)}
                className={`group relative h-8 rounded-lg border transition-all cursor-pointer bg-[#0e111a] flex items-center px-2 overflow-hidden ${
                  isSelected
                    ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-md'
                    : 'border-[#22283a] hover:border-[#323c56]'
                }`}
              >
                {/* Active Zone Bar */}
                <div
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: `${color}35`,
                    borderColor: color
                  }}
                  className="absolute top-0.5 bottom-0.5 border rounded-md transition-all flex items-center justify-between px-2 overflow-hidden"
                >
                  <span className="text-[10px] font-mono font-bold truncate" style={{ color }}>
                    {sample.name}
                  </span>

                  {/* Root Key Diamond Indicator */}
                  <div
                    style={{
                      left: `${((sample.rootKey - low) / Math.max(1, high - low)) * 100}%`
                    }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-amber-400 font-bold text-xs"
                    title={`Root Key: ${midiToNoteName(sample.rootKey)} (${sample.rootKey})`}
                  >
                    ◆
                  </div>
                </div>

                {/* Left Label Info */}
                <div className="z-10 text-[11px] font-mono text-slate-300 pointer-events-none flex items-center gap-2">
                  <span className="font-bold text-white">{sample.name}</span>
                  <span className="text-slate-400 text-[10px]">
                    [{midiToNoteName(low)} - {midiToNoteName(high)}] • Root: {midiToNoteName(sample.rootKey)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

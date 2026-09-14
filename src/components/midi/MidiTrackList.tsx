import React from 'react';
import { Volume2, VolumeX, Music, Drum, Dices } from 'lucide-react';
import { MidiTrack } from '../../types';
import { GM_INSTRUMENTS } from '../../audio/gmInstruments';

interface MidiTrackListProps {
  tracks: MidiTrack[];
  onUpdateTrack: (trackId: string, partial: Partial<MidiTrack>) => void;
  onSoloToggle: (trackId: string) => void;
  onOpenSeededRandomize?: (track: MidiTrack) => void;
}

export const MidiTrackList: React.FC<MidiTrackListProps> = ({
  tracks,
  onUpdateTrack,
  onSoloToggle,
  onOpenSeededRandomize
}) => {
  return (
    <div className="space-y-2.5">
      {tracks.map((track) => {
        const isDrum = track.isDrumTrack || track.channel === 9;

        return (
          <div
            key={track.id}
            id={`midi-track-${track.id}`}
            className="bg-[#141824] border border-[#23293a] hover:border-[#2d364c] rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors"
          >
            {/* Track Info & GM Mapping */}
            <div className="flex items-center gap-3 min-w-[240px]">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center border"
                style={{ backgroundColor: `${track.color || '#6366f1'}20`, borderColor: `${track.color || '#6366f1'}40` }}
              >
                {isDrum ? (
                  <Drum className="w-4 h-4 text-amber-400" />
                ) : (
                  <Music className="w-4 h-4" style={{ color: track.color || '#6366f1' }} />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-100">{track.name}</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                    Ch {track.channel + 1}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {track.notes.length} notes
                  </span>
                </div>

                {/* GM Instrument selector */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-400 font-mono">Sound:</span>
                  <select
                    value={track.program}
                    onChange={(e) => onUpdateTrack(track.id, { program: Number(e.target.value) })}
                    disabled={isDrum}
                    className="bg-[#1b2030] text-[11px] text-slate-200 border border-[#2e374d] rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 max-w-[170px] truncate disabled:opacity-60"
                  >
                    {isDrum ? (
                      <option>Standard GM Drum Kit</option>
                    ) : (
                      GM_INSTRUMENTS.map((inst) => (
                        <option key={inst.program} value={inst.program}>
                          {inst.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Solo, Mute, Volume, Pan */}
            <div className="flex items-center gap-2.5">
              {/* Solo */}
              <button
                onClick={() => onSoloToggle(track.id)}
                className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-colors ${
                  track.solo
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-[#1c2233] text-slate-400 hover:text-slate-200 hover:bg-[#252d42]'
                }`}
              >
                S
              </button>

              {/* Mute */}
              <button
                onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-colors ${
                  track.muted
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-[#1c2233] text-slate-400 hover:text-slate-200 hover:bg-[#252d42]'
                }`}
              >
                M
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 bg-[#1a2030] px-2 py-1 rounded-lg border border-[#2b344a]">
                {track.volume === 0 || track.muted ? (
                  <VolumeX className="w-3 h-3 text-rose-400" />
                ) : (
                  <Volume2 className="w-3 h-3 text-indigo-400" />
                )}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume ?? 0.85}
                  onChange={(e) => onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })}
                  className="w-16 accent-indigo-500 cursor-pointer h-1 bg-slate-700 rounded"
                  title={`Volume: ${Math.round((track.volume ?? 0.85) * 100)}%`}
                />
                <span className="text-[10px] font-mono text-slate-400 w-6 text-right">
                  {Math.round((track.volume ?? 0.85) * 100)}
                </span>
              </div>

              {/* Pan Slider */}
              <div className="flex items-center gap-1 bg-[#1a2030] px-2 py-1 rounded-lg border border-[#2b344a]">
                <span className="text-[10px] font-mono text-slate-400">PAN</span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={track.pan ?? 0}
                  onChange={(e) => onUpdateTrack(track.id, { pan: parseFloat(e.target.value) })}
                  className="w-12 accent-indigo-500 cursor-pointer h-1 bg-slate-700 rounded"
                />
              </div>

              {/* Seeded Randomize Track */}
              <button
                id={`midi-randomize-track-${track.id}`}
                onClick={() => onOpenSeededRandomize?.(track)}
                title="Randomize & mutate MIDI track with deterministic seed"
                className="flex items-center gap-1 bg-[#1b2131] hover:bg-purple-950 hover:text-purple-200 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border border-[#2e374d]"
              >
                <Dices className="w-3.5 h-3.5 text-purple-400" />
                <span>Randomize</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileCode, Layers, Info, Disc } from 'lucide-react';
import { SF2Bank } from '../../types';

interface Sf2InspectorProps {
  bank: SF2Bank;
}

export const Sf2Inspector: React.FC<Sf2InspectorProps> = ({ bank }) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    root: true,
    info: true,
    sdta: true,
    pdta: true
  });

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const totalSamples = bank.presets.reduce(
    (acc, p) => acc + p.instruments.reduce((iAcc, inst) => iAcc + inst.samples.length, 0),
    0
  );

  return (
    <div id="sf2-binary-inspector" className="bg-[#121622] border border-[#232a3d] rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#232a3d]">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-white tracking-wide">SoundFont 2.04 RIFF Binary Structure</h3>
        </div>
        <span className="text-[11px] text-slate-400">
          Format: RIFF / sfbk • Presets: {bank.presets.length} • Samples: {totalSamples}
        </span>
      </div>

      <div className="space-y-2 bg-[#0c0e17] p-4 rounded-xl border border-[#1e2436] text-slate-300">
        {/* RIFF Root */}
        <div>
          <button
            onClick={() => toggleSection('root')}
            className="flex items-center gap-1.5 font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            {openSections['root'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Folder className="w-3.5 h-3.5" />
            <span>RIFF 'sfbk' (SoundFont Bank)</span>
          </button>

          {openSections['root'] && (
            <div className="pl-6 pt-2 space-y-2 border-l border-[#242b3e] ml-2">
              {/* LIST 'INFO' */}
              <div>
                <button
                  onClick={() => toggleSection('info')}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  {openSections['info'] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <Info className="w-3.5 h-3.5" />
                  <span>LIST 'INFO' (Bank Metadata Chunk)</span>
                </button>

                {openSections['info'] && (
                  <div className="pl-6 pt-1.5 space-y-1 text-[11px] text-slate-400 border-l border-[#242b3e] ml-2">
                    <div>• ifil: 2.04 (SF2 Specification Version)</div>
                    <div>• isng: EMU8000 (Sound Engine Target)</div>
                    <div>• INAM: "{bank.name}" (Bank Name)</div>
                    <div>• IENG: "{bank.author || 'StemStudio'}" (Author / Engineer)</div>
                    <div>• ICMT: "{bank.comment || 'Multi-sample soundfont'}"</div>
                  </div>
                )}
              </div>

              {/* LIST 'sdta' */}
              <div>
                <button
                  onClick={() => toggleSection('sdta')}
                  className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  {openSections['sdta'] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <Disc className="w-3.5 h-3.5" />
                  <span>LIST 'sdta' (Sample Audio Data Chunk)</span>
                </button>

                {openSections['sdta'] && (
                  <div className="pl-6 pt-1.5 space-y-1 text-[11px] text-slate-400 border-l border-[#242b3e] ml-2">
                    <div>• smpl: 16-bit linear PCM audio sample pool</div>
                    <div>• Total Sample Entries: {totalSamples}</div>
                    <div>• Guard Buffers: 46-sample zero-padding (SF2 2.04 compliant)</div>
                  </div>
                )}
              </div>

              {/* LIST 'pdta' */}
              <div>
                <button
                  onClick={() => toggleSection('pdta')}
                  className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  {openSections['pdta'] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <Layers className="w-3.5 h-3.5" />
                  <span>LIST 'pdta' (Preset, Instrument &amp; Sample Header Subchunks)</span>
                </button>

                {openSections['pdta'] && (
                  <div className="pl-6 pt-1.5 space-y-1 text-[11px] text-slate-400 border-l border-[#242b3e] ml-2">
                    <div>• phdr: {bank.presets.length + 1} Preset Headers (including EOP terminator)</div>
                    <div>• pbag / pgen: Preset bags &amp; Zone generators</div>
                    <div>• inst / ibag / igen: Instrument structures &amp; Key zone generators</div>
                    <div>• shdr: {totalSamples + 1} Sample Headers (with loop endpoints, root keys &amp; sample rates)</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  Download,
  FileAudio,
  Music,
  Layers,
  CheckCircle2,
  Loader2,
  Disc,
  Archive,
  FolderArchive,
  FileText,
  Package,
  Sparkles,
  Check
} from 'lucide-react';
import JSZip from 'jszip';
import { AudioStem, MidiSong } from '../../types';
import { audioBufferToMp3Blob, audioBufferToWavBlob, downloadBlob } from '../../audio/mp3Encoder';
import { buildMidiFile } from '../../audio/midiParser';
import { buildSF2Binary } from '../../audio/sf2Builder';
import { getAudioContext } from '../../audio/audioContext';

interface DawExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stems: AudioStem[];
  bpm: number;
  duration: number;
}

export const DawExportModal: React.FC<DawExportModalProps> = ({
  isOpen,
  onClose,
  stems,
  bpm,
  duration
}) => {
  const [activeExportType, setActiveExportType] = useState<'aio' | 'mixdown' | 'stems' | 'midi' | 'sf2'>('aio');
  const [mp3Bitrate, setMp3Bitrate] = useState<128 | 192 | 256 | 320>(192);
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'wav'>('mp3');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percent: number; status: string } | null>(null);

  if (!isOpen) return null;

  // Helper: Render master mixdown buffer
  const renderMasterMixBuffer = () => {
    const ctx = getAudioContext();
    const sampleRate = 44100;
    const totalSamples = Math.floor(sampleRate * duration);
    const mixed = ctx.createBuffer(2, totalSamples, sampleRate);
    const outL = mixed.getChannelData(0);
    const outR = mixed.getChannelData(1);

    // Sum stems according to volume and pan
    for (const stem of stems) {
      if (stem.muted || !stem.audioBuffer) continue;
      const vol = stem.volume;
      const pan = stem.pan;
      const sL = stem.audioBuffer.getChannelData(0);
      const sR = stem.audioBuffer.numberOfChannels > 1 ? stem.audioBuffer.getChannelData(1) : sL;

      const panL = Math.cos(((pan + 1) * Math.PI) / 4);
      const panR = Math.sin(((pan + 1) * Math.PI) / 4);

      const len = Math.min(totalSamples, stem.audioBuffer.length);
      for (let i = 0; i < len; i++) {
        outL[i] += sL[i] * vol * panL;
        outR[i] += sR[i] * vol * panR;
      }
    }

    // Hard clip guard
    for (let i = 0; i < totalSamples; i++) {
      outL[i] = Math.max(-1, Math.min(1, outL[i]));
      outR[i] = Math.max(-1, Math.min(1, outR[i]));
    }

    return mixed;
  };

  // 1. ALL-IN-ONE (AIO) ZIP Export
  const handleExportAIOZip = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 5, status: 'Initializing All-In-One (AIO) ZIP archive...' });

    try {
      const zip = new JSZip();

      // Step 1: Render Master Mixdown (WAV and MP3)
      setExportProgress({ percent: 15, status: 'Rendering multi-track master mixdown...' });
      const mixed = renderMasterMixBuffer();

      setExportProgress({ percent: 25, status: 'Encoding master mixdown WAV & MP3...' });
      const masterWavBlob = audioBufferToWavBlob(mixed);
      zip.file('mixdown/master_mixdown.wav', masterWavBlob);

      const masterMp3Blob = await audioBufferToMp3Blob(mixed, mp3Bitrate);
      zip.file('mixdown/master_mixdown.mp3', masterMp3Blob);

      // Step 2: Individual Stems (WAVs & individual MIDIs)
      const stemsFolder = zip.folder('stems');
      const stemMidiFolder = zip.folder('midi/individual_stems');

      for (let idx = 0; idx < stems.length; idx++) {
        const stem = stems[idx];
        const numPrefix = String(idx + 1).padStart(2, '0');
        const cleanStemName = stem.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

        setExportProgress({
          percent: 30 + Math.floor((idx / stems.length) * 35),
          status: `Adding stem ${idx + 1}/${stems.length}: ${stem.name}...`
        });

        if (stem.audioBuffer && stemsFolder) {
          const stemWavBlob = audioBufferToWavBlob(stem.audioBuffer);
          stemsFolder.file(`${numPrefix}_${cleanStemName}.wav`, stemWavBlob);
        }

        if (stem.midiNotes.length > 0 && stemMidiFolder) {
          const stemMidiSong: MidiSong = {
            name: `${stem.name} Stem`,
            bpm: bpm || 120,
            timeSignature: [4, 4],
            duration: duration,
            tracks: [
              {
                id: stem.id,
                name: stem.name,
                channel: stem.type === 'drums' ? 9 : 0,
                program: stem.instrumentProgram,
                notes: stem.midiNotes,
                volume: stem.volume,
                pan: stem.pan,
                muted: false,
                solo: false,
                color: stem.color,
                isDrumTrack: stem.type === 'drums'
              }
            ]
          };
          stemMidiFolder.file(`${numPrefix}_${cleanStemName}.mid`, buildMidiFile(stemMidiSong));
        }
      }

      // Step 3: Multi-Track Project Standard MIDI File
      setExportProgress({ percent: 70, status: 'Building synchronized multi-track MIDI file...' });
      const fullMidiSong: MidiSong = {
        name: 'StemStudio Transcribed Project',
        bpm: bpm || 120,
        timeSignature: [4, 4],
        duration: duration,
        tracks: stems.map((st, idx) => ({
          id: st.id,
          name: st.name,
          channel: st.type === 'drums' ? 9 : idx % 16,
          program: st.instrumentProgram,
          notes: st.midiNotes,
          volume: st.volume,
          pan: st.pan,
          muted: st.muted,
          solo: st.solo,
          color: st.color,
          isDrumTrack: st.type === 'drums'
        }))
      };
      zip.file('midi/full_project_transcription.mid', buildMidiFile(fullMidiSong));

      // Step 4: SoundFont 2 Bank
      setExportProgress({ percent: 80, status: 'Compiling SoundFont 2 (.sf2) bank...' });
      const bank = {
        id: 'bank-exported',
        name: 'StemStudio SoundFont 2',
        author: 'StemStudio DAW',
        comment: 'Multi-sampled SF2 generated from separated audio stems',
        presets: stems.map((st, idx) => ({
          id: `preset-${st.id}`,
          name: st.name,
          bank: st.type === 'drums' ? 128 : 0,
          presetNum: idx,
          instruments: [
            {
              id: `inst-${st.id}`,
              name: st.name,
              samples: [
                {
                  id: `sample-${st.id}`,
                  name: `${st.name.substring(0, 16)}`,
                  audioBuffer: st.audioBuffer,
                  rootKey: st.type === 'bass' ? 36 : 60,
                  keyRange: [0, 127] as [number, number],
                  loopStart: 0,
                  loopEnd: st.audioBuffer ? st.audioBuffer.length : 44100,
                  loopMode: true,
                  sampleRate: 44100,
                  fineTune: 0,
                  attack: 0.01,
                  decay: 0.4,
                  sustain: 0.6,
                  release: 0.3,
                  filterCutoff: 18000
                }
              ]
            }
          ]
        }))
      };
      zip.file('soundfont/stemstudio_soundbank.sf2', buildSF2Binary(bank));

      // Step 5: Manifest & Documentation
      setExportProgress({ percent: 88, status: 'Generating project manifest & documentation...' });
      const manifest = {
        projectName: 'StemStudio Project',
        exportedAt: new Date().toISOString(),
        tempoBpm: bpm,
        timeSignature: '4/4',
        durationSeconds: duration,
        stemsCount: stems.length,
        stems: stems.map((s, i) => ({
          trackNumber: i + 1,
          name: s.name,
          type: s.type,
          color: s.color,
          gmProgram: s.instrumentProgram,
          volume: s.volume,
          pan: s.pan,
          noteCount: s.midiNotes.length
        }))
      };
      zip.file('project_manifest.json', JSON.stringify(manifest, null, 2));

      const readme = `StemStudio All-In-One (AIO) Production Package
======================================================
Exported: ${new Date().toLocaleString()}
Tempo: ${bpm} BPM
Time Signature: 4/4
Duration: ${duration.toFixed(2)} seconds
Total Stems: ${stems.length}

PACKAGE CONTENTS:
-----------------
1. /mixdown/
   - master_mixdown.wav (44.1kHz 16-bit PCM broadcast master)
   - master_mixdown.mp3 (${mp3Bitrate}kbps high-quality MP3)

2. /stems/
${stems.map((s, i) => `   - ${String(i + 1).padStart(2, '0')}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.wav (${s.type.toUpperCase()})`).join('\n')}

3. /midi/
   - full_project_transcription.mid (SMF Type 1 multi-track MIDI file with all tracks synchronized)
   - /individual_stems/
${stems.map((s, i) => `     - ${String(i + 1).padStart(2, '0')}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.mid (${s.midiNotes.length} notes)`).join('\n')}

4. /soundfont/
   - stemstudio_soundbank.sf2 (SoundFont 2.04 binary soundbank with all multi-sample instruments)

5. project_manifest.json
   - Full technical JSON metadata for automated DAW and asset tracking

DAW COMPATIBILITY:
------------------
- Compatible with Ableton Live, FL Studio, Logic Pro, Pro Tools, Studio One, Reaper, Cubase, Bitwig
- SF2 SoundFont works with sfz, Sforzando, SoundFont players, hardware samplers
`;
      zip.file('README.txt', readme);

      // Step 6: Compress into ZIP
      setExportProgress({ percent: 92, status: 'Compressing AIO ZIP archive...' });
      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        },
        (meta) => {
          setExportProgress({
            percent: 92 + Math.floor(meta.percent * 0.08),
            status: `Compressing ZIP archive (${Math.round(meta.percent)}%)...`
          });
        }
      );

      downloadBlob(zipBlob, `stemstudio_aio_project_${bpm}bpm_${Date.now()}.zip`);
      setExportProgress({ percent: 100, status: 'AIO ZIP downloaded successfully!' });
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(null);
      }, 1500);
    } catch (err) {
      console.error('AIO ZIP generation error:', err);
      setIsExporting(false);
      setExportProgress({ percent: 0, status: 'Export failed. Please retry.' });
    }
  };

  // 2. Export Master Mixdown
  const handleExportMixdown = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 10, status: 'Rendering multi-track mixdown...' });

    try {
      const mixed = renderMasterMixBuffer();

      setExportProgress({ percent: 50, status: `Encoding ${audioFormat.toUpperCase()}...` });

      let blob: Blob;
      if (audioFormat === 'wav') {
        blob = audioBufferToWavBlob(mixed);
      } else {
        blob = await audioBufferToMp3Blob(mixed, mp3Bitrate, (percent, status) => {
          setExportProgress({ percent: 50 + percent * 0.5, status });
        });
      }

      downloadBlob(blob, `stemstudio_master_mixdown.${audioFormat}`);
      setExportProgress({ percent: 100, status: 'Mixdown exported!' });
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(null);
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // 3. Export Individual Stems (WAVs)
  const handleExportStems = () => {
    for (const stem of stems) {
      if (!stem.audioBuffer) continue;
      const blob = audioBufferToWavBlob(stem.audioBuffer);
      downloadBlob(blob, `${stem.name.toLowerCase().replace(/\s+/g, '_')}_stem.wav`);
    }
  };

  // 4. Export Transcribed Multi-track Standard MIDI (.mid)
  const handleExportMidi = () => {
    const midiSong: MidiSong = {
      name: 'StemStudio Transcribed Project',
      bpm: bpm || 120,
      timeSignature: [4, 4],
      duration: duration,
      tracks: stems.map((st, idx) => ({
        id: st.id,
        name: st.name,
        channel: st.type === 'drums' ? 9 : idx % 16,
        program: st.instrumentProgram,
        notes: st.midiNotes,
        volume: st.volume,
        pan: st.pan,
        muted: st.muted,
        solo: st.solo,
        color: st.color,
        isDrumTrack: st.type === 'drums'
      }))
    };

    const uint8 = buildMidiFile(midiSong);
    const blob = new Blob([uint8], { type: 'audio/midi' });
    downloadBlob(blob, 'stemstudio_transcription.mid');
  };

  // 5. Export Spec-compliant SoundFont 2 (.sf2)
  const handleExportSF2 = () => {
    const bank = {
      id: 'bank-exported',
      name: 'StemStudio SoundFont 2',
      author: 'StemStudio DAW',
      comment: 'Multi-sampled SF2 generated from separated audio stems',
      presets: stems.map((st, idx) => ({
        id: `preset-${st.id}`,
        name: st.name,
        bank: st.type === 'drums' ? 128 : 0,
        presetNum: idx,
        instruments: [
          {
            id: `inst-${st.id}`,
            name: st.name,
            samples: [
              {
                id: `sample-${st.id}`,
                name: `${st.name.substring(0, 16)}`,
                audioBuffer: st.audioBuffer,
                rootKey: st.type === 'bass' ? 36 : 60,
                keyRange: [0, 127] as [number, number],
                loopStart: 0,
                loopEnd: st.audioBuffer ? st.audioBuffer.length : 44100,
                loopMode: true,
                sampleRate: 44100,
                fineTune: 0,
                attack: 0.01,
                decay: 0.4,
                sustain: 0.6,
                release: 0.3,
                filterCutoff: 18000
              }
            ]
          }
        ]
      }))
    };

    const uint8 = buildSF2Binary(bank);
    const blob = new Blob([uint8], { type: 'application/octet-stream' });
    downloadBlob(blob, 'stemstudio_soundbank.sf2');
  };

  // Total estimated files in AIO
  const totalAioFiles = 2 + stems.length + (stems.filter(s => s.midiNotes.length > 0).length + 1) + 1 + 2;

  return (
    <div
      id="daw-export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div className="bg-[#141824] border border-[#262e42] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232a3d] bg-[#181d2c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400/40 flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Export Hub</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  {stems.length} Stems • {bpm} BPM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Download AIO ZIP, mixdown audio, stem WAVs, multi-track MIDI, and SF2 SoundFont
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Header AIO ZIP Button */}
            <button
              id="aio-download-zip-btn-header"
              onClick={handleExportAIOZip}
              disabled={isExporting}
              title="One-click download complete All-In-One ZIP package"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>AIO Download ZIP</span>
            </button>

            <button
              onClick={onClose}
              disabled={isExporting}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-[#232a3d] bg-[#111522] overflow-x-auto">
          <button
            id="export-tab-aio"
            onClick={() => setActiveExportType('aio')}
            className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeExportType === 'aio'
                ? 'text-amber-400 border-b-2 border-amber-500 bg-[#171e2e]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-4 h-4 text-amber-400" />
            <span>AIO ZIP Bundle</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold hidden sm:inline">
              ALL-IN-ONE
            </span>
          </button>

          <button
            id="export-tab-mixdown"
            onClick={() => setActiveExportType('mixdown')}
            className={`flex-1 py-3 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeExportType === 'mixdown'
                ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#161c2c]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Disc className="w-4 h-4" />
            <span>Master Mix</span>
          </button>

          <button
            id="export-tab-stems"
            onClick={() => setActiveExportType('stems')}
            className={`flex-1 py-3 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeExportType === 'stems'
                ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#161c2c]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Stems WAVs</span>
          </button>

          <button
            id="export-tab-midi"
            onClick={() => setActiveExportType('midi')}
            className={`flex-1 py-3 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeExportType === 'midi'
                ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#161c2c]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>MIDI (.mid)</span>
          </button>

          <button
            id="export-tab-sf2"
            onClick={() => setActiveExportType('sf2')}
            className={`flex-1 py-3 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeExportType === 'sf2'
                ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#161c2c]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileAudio className="w-4 h-4" />
            <span>SoundFont (.sf2)</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Progress Bar Display */}
          {exportProgress && (
            <div className="bg-indigo-950/80 border border-indigo-800/80 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-150">
              <div className="flex justify-between text-xs font-mono text-indigo-200">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  {exportProgress.status}
                </span>
                <span className="font-bold">{Math.round(exportProgress.percent)}%</span>
              </div>
              <div className="w-full h-2 bg-indigo-950 rounded-full overflow-hidden border border-indigo-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-purple-500 transition-all duration-200"
                  style={{ width: `${exportProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* TAB 1: ALL-IN-ONE (AIO) ZIP */}
          {activeExportType === 'aio' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-950/40 via-[#181e2e] to-[#121622] border border-amber-500/30 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                      <Archive className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        All-In-One (AIO) Project Bundle
                        <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                          ZIP Archive
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Packages all session stems, master mixdown, MIDI files, SoundFont, and manifest into a single organized archive.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono bg-black/40 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    ~{totalAioFiles} Files
                  </span>
                </div>

                {/* Package Contents Breakdown Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#2a3652]">
                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#131724]/80 p-2 rounded-lg border border-[#232d42]">
                    <Disc className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <strong className="text-white">Master Mixdown:</strong> WAV & MP3
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#131724]/80 p-2 rounded-lg border border-[#232d42]">
                    <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <div className="truncate">
                      <strong className="text-white">{stems.length} Stems:</strong> Broadcast 44.1kHz WAV
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#131724]/80 p-2 rounded-lg border border-[#232d42]">
                    <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <div className="truncate">
                      <strong className="text-white">MIDI:</strong> Multi-Track + Stem MIDIs
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#131724]/80 p-2 rounded-lg border border-[#232d42]">
                    <FileAudio className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <div className="truncate">
                      <strong className="text-white">SoundFont:</strong> SoundFont 2 (.sf2) Bank
                    </div>
                  </div>
                </div>

                {/* Included MP3 Bitrate Config */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400">Included MP3 Quality:</span>
                  <select
                    value={mp3Bitrate}
                    onChange={(e) => setMp3Bitrate(Number(e.target.value) as any)}
                    className="bg-[#121622] text-slate-200 border border-[#334161] rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value={128}>128 kbps (Standard)</option>
                    <option value={192}>192 kbps (High Quality)</option>
                    <option value={256}>256 kbps (Studio)</option>
                    <option value={320}>320 kbps (Maximum)</option>
                  </select>
                </div>
              </div>

              {/* Main AIO Download Button */}
              <button
                id="aio-download-zip-btn-main"
                onClick={handleExportAIOZip}
                disabled={isExporting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:via-orange-400 hover:to-pink-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Packaging AIO ZIP Archive...</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 stroke-[2.5]" />
                    <span>AIO Download ZIP (All-In-One Archive)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: MASTER MIXDOWN */}
          {activeExportType === 'mixdown' && (
            <div className="space-y-4">
              <div className="bg-[#192030] p-4 rounded-xl border border-[#27324c] space-y-3">
                <div className="text-xs font-semibold text-slate-300">Format Selection</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      checked={audioFormat === 'mp3'}
                      onChange={() => setAudioFormat('mp3')}
                      className="accent-indigo-500 cursor-pointer"
                    />
                    <span>MP3 Compressed (using lamejs)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      checked={audioFormat === 'wav'}
                      onChange={() => setAudioFormat('wav')}
                      className="accent-indigo-500 cursor-pointer"
                    />
                    <span>WAV Uncompressed (16-bit PCM)</span>
                  </label>
                </div>

                {audioFormat === 'mp3' && (
                  <div className="pt-2 border-t border-[#2a3652] flex items-center justify-between text-xs">
                    <span className="text-slate-400">Bitrate:</span>
                    <select
                      value={mp3Bitrate}
                      onChange={(e) => setMp3Bitrate(Number(e.target.value) as any)}
                      className="bg-[#121622] text-slate-200 border border-[#334161] rounded px-2 py-1 text-xs"
                    >
                      <option value={128}>128 kbps (Standard)</option>
                      <option value={192}>192 kbps (High Quality)</option>
                      <option value={256}>256 kbps (Studio)</option>
                      <option value={320}>320 kbps (Maximum)</option>
                    </select>
                  </div>
                )}
              </div>

              <button
                onClick={handleExportMixdown}
                disabled={isExporting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Render & Download Mixdown</span>
              </button>
            </div>
          )}

          {/* TAB 3: STEMS WAVS */}
          {activeExportType === 'stems' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Exports all {stems.length} isolated audio stem files as individual broadcast-quality 44.1kHz WAV files.
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {stems.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 bg-[#192030] rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-semibold text-slate-200">{s.name}</span>
                    </div>
                    <span className="font-mono text-slate-400">44.1kHz WAV</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleExportStems}
                disabled={isExporting}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download All {stems.length} Stems (WAVs)</span>
              </button>
            </div>
          )}

          {/* TAB 4: MIDI (.mid) */}
          {activeExportType === 'midi' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Exports all transcribed melodic and rhythmic stem tracks as a standard multi-track MIDI file (.mid, Type 1) with tempo markers, General MIDI programs, and time signatures. Compatible with any DAW or music notation software.
              </p>
              <div className="p-3 bg-[#192030] rounded-lg text-xs space-y-1.5 font-mono text-slate-300">
                <div>Format: Standard MIDI File (SMF 1)</div>
                <div>Tempo: {bpm} BPM • Time Signature: 4/4</div>
                <div>Total Tracks: {stems.length}</div>
              </div>
              <button
                onClick={handleExportMidi}
                disabled={isExporting}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                <Music className="w-4 h-4" />
                <span>Download Standard MIDI (.mid)</span>
              </button>
            </div>
          )}

          {/* TAB 5: SOUNDFONT (.sf2) */}
          {activeExportType === 'sf2' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Packages your audio stems into an authentic SoundFont 2.04 binary (.sf2) soundbank with RIFF chunks (INFO, sdta, pdta). Usable in SF2 Studio, SoundFont players, hardware samplers, and DAWs!
              </p>
              <div className="p-3 bg-[#192030] rounded-lg text-xs space-y-1.5 font-mono text-slate-300">
                <div>Format: SoundFont 2.04 (RIFF sfbk)</div>
                <div>Presets: {stems.length} instrument presets</div>
                <div>Sample Resolution: 16-bit linear PCM</div>
              </div>
              <button
                onClick={handleExportSF2}
                disabled={isExporting}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                <FileAudio className="w-4 h-4" />
                <span>Build & Download SoundFont (.sf2)</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Persistent Footer (Quick AIO Action) */}
        {activeExportType !== 'aio' && (
          <div className="px-6 py-3 bg-[#111520] border-t border-[#232a3d] flex items-center justify-between">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Need everything? Get the complete package in one download.</span>
            </div>
            <button
              onClick={handleExportAIOZip}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              <Archive className="w-3 h-3" />
              <span>AIO Download ZIP</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

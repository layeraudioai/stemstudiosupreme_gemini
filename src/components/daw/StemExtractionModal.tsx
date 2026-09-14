import React, { useState, useRef } from 'react';
import {
  X,
  Layers,
  Upload,
  Sparkles,
  Sliders,
  Check,
  Music,
  FileAudio,
  Radio,
  Drum,
  Activity,
  Mic,
  Users,
  Piano,
  Waves,
  Zap,
  Wind,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Info
} from 'lucide-react';
import { AudioStem, StemType } from '../../types';
import {
  ENSEMBLE_PROFILES,
  STEM_DEFINITIONS,
  getAllStemTypes,
  getStemDefinition
} from '../../audio/ensembleProfiles';
import { separateAudioStems } from '../../audio/stemSeparator';
import { decodeAudioFile } from '../../audio/audioContext';

interface StemExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStems: AudioStem[];
  onApplySeparation: (newStems: AudioStem[], trackName: string) => void;
}

export const StemExtractionModal: React.FC<StemExtractionModalProps> = ({
  isOpen,
  onClose,
  currentStems,
  onApplySeparation
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('pop_rock_5');
  const [selectedStemTypes, setSelectedStemTypes] = useState<StemType[]>([
    'vocal',
    'drums',
    'bass',
    'guitar',
    'piano'
  ]);
  const [sourceMode, setSourceMode] = useState<'current' | 'file'>('file');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; status: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle choosing preset ensemble profile
  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    const profile = ENSEMBLE_PROFILES.find(p => p.id === profileId);
    if (profile) {
      setSelectedStemTypes([...profile.stems]);
    }
  };

  // Toggle individual stem type
  const handleToggleStem = (type: StemType) => {
    setSelectedStemTypes(prev => {
      let updated: StemType[];
      if (prev.includes(type)) {
        if (prev.length <= 2) return prev; // Keep at least 2 stems
        updated = prev.filter(t => t !== type);
      } else {
        if (prev.length >= 8) return prev; // Cap at 8 stems for optimal DSP headroom
        updated = [...prev, type];
      }
      setSelectedProfileId('custom');
      return updated;
    });
  };

  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name)) {
        setUploadedFile(file);
        setSourceMode('file');
      }
    }
  };

  // Run dynamic separation
  const handleStartExtraction = async () => {
    setIsProcessing(true);
    setProgress({ percent: 5, status: 'Preparing audio source buffer...' });

    try {
      let audioBuffer: AudioBuffer | null = null;
      let trackName = 'Extracted Mix';

      if (sourceMode === 'file' && uploadedFile) {
        setProgress({ percent: 10, status: `Decoding ${uploadedFile.name}...` });
        audioBuffer = await decodeAudioFile(uploadedFile);
        trackName = uploadedFile.name.replace(/\.[^/.]+$/, '');
      } else {
        // Use composite of existing stems
        const primaryStem = currentStems.find(s => s.audioBuffer);
        if (primaryStem?.audioBuffer) {
          audioBuffer = primaryStem.audioBuffer;
          trackName = primaryStem.name.replace(/\s*(vocal|stem).*$/i, '').trim() || 'Session Project';
        }
      }

      if (!audioBuffer) {
        throw new Error('No valid audio buffer available for separation');
      }

      const separated = await separateAudioStems(
        audioBuffer,
        (percent, status) => {
          setProgress({ percent, status });
        },
        {
          selectedStemTypes: selectedStemTypes,
          ensembleProfileId: selectedProfileId !== 'custom' ? selectedProfileId : undefined
        }
      );

      setIsProcessing(false);
      setProgress(null);
      onApplySeparation(separated, trackName);
      onClose();
    } catch (err) {
      console.error('Dynamic extraction failed:', err);
      setIsProcessing(false);
      setProgress({ percent: 0, status: 'Extraction failed: Audio format unreadable' });
    }
  };

  const allStemTypes = getAllStemTypes();
  const activeProfile = ENSEMBLE_PROFILES.find(p => p.id === selectedProfileId);

  const getStemIcon = (type: StemType) => {
    switch (type) {
      case 'vocal': return <Mic className="w-3.5 h-3.5" />;
      case 'backing_vocal': return <Users className="w-3.5 h-3.5" />;
      case 'drums': return <Drum className="w-3.5 h-3.5" />;
      case 'percussion': return <Sparkles className="w-3.5 h-3.5" />;
      case 'bass': return <Activity className="w-3.5 h-3.5" />;
      case 'guitar': return <Music className="w-3.5 h-3.5" />;
      case 'piano': return <Piano className="w-3.5 h-3.5" />;
      case 'strings': return <Waves className="w-3.5 h-3.5" />;
      case 'brass': return <Radio className="w-3.5 h-3.5" />;
      case 'synth': return <Zap className="w-3.5 h-3.5" />;
      case 'ambient': return <Wind className="w-3.5 h-3.5" />;
      case 'instruments': return <Sliders className="w-3.5 h-3.5" />;
      default: return <Layers className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      id="stem-extraction-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#121624] border border-[#263147] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#20293d] flex items-center justify-between sticky top-0 bg-[#121624]/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Dynamic Ensemble & Stem Extraction
                <span className="text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {selectedStemTypes.length} Stems
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure target ensemble profiles, stem counts (2 to 8), and spectral instrument models with MIDI transcription.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-[#1a2030] hover:bg-[#252f47] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* 1. Audio Source Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-indigo-400" />
                1. Select Audio Source
              </label>
              <div className="flex items-center gap-1 bg-[#171d2c] p-1 rounded-xl border border-[#273248]">
                <button
                  type="button"
                  onClick={() => setSourceMode('file')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sourceMode === 'file'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Upload New Audio
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('current')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sourceMode === 'current'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Current Session Mix
                </button>
              </div>
            </div>

            {sourceMode === 'file' ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-950/40'
                    : uploadedFile
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-[#2d374e] hover:border-indigo-500/60 bg-[#161b2a]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => e.target.files?.[0] && setUploadedFile(e.target.files[0])}
                  className="hidden"
                />
                {uploadedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{uploadedFile.name}</p>
                      <p className="text-xs text-slate-400">
                        {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for dynamic spectral splitting
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Upload className="w-8 h-8 text-indigo-400 mx-auto" />
                    <p className="text-sm font-semibold text-white">
                      Drop MP3, WAV, FLAC or OGG audio file here
                    </p>
                    <p className="text-xs text-slate-400">or click to browse from your device</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#171d2c] border border-[#273248] rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Music className="w-5 h-5 text-indigo-400" />
                  <div>
                    <p className="text-sm font-bold text-white">Active Session Stems Mixdown</p>
                    <p className="text-xs text-slate-400">
                      Re-decompose current {currentStems.length}-stem project into a new ensemble configuration
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono bg-indigo-950 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-800">
                  {currentStems.length} Stems Loaded
                </span>
              </div>
            )}
          </div>

          {/* 2. Ensemble Profile Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                2. Choose Ensemble Profile ({ENSEMBLE_PROFILES.length} Presets)
              </label>
              {selectedProfileId === 'custom' && (
                <span className="text-xs font-bold font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60">
                  Custom Ensemble
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ENSEMBLE_PROFILES.map((profile) => {
                const isSelected = selectedProfileId === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleSelectProfile(profile.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/50'
                        : 'bg-[#151a28] border-[#222b3f] hover:border-[#323d58]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-white leading-tight">{profile.name}</span>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 shrink-0">
                        {profile.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {profile.shortDesc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Stem Count & Stem Types Matrix (Customizable) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  3. Stem Count & Spectral Models ({selectedStemTypes.length} Selected)
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click any stem chip below to toggle it on/off (2 to 8 stems supported).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectProfile('master_8')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 bg-[#171d2c] rounded-lg border border-[#273248] cursor-pointer"
                >
                  All 8 Stems
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectProfile('standard_4')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 font-medium px-2 py-1 bg-[#171d2c] rounded-lg border border-[#273248] cursor-pointer"
                >
                  Standard 4
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {allStemTypes.map((type) => {
                const def = getStemDefinition(type);
                const isSelected = selectedStemTypes.includes(type);

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleToggleStem(type)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-indigo-500 bg-[#191f33] shadow-sm'
                        : 'border-[#202738] bg-[#121622]/60 opacity-60 hover:opacity-100 hover:border-[#2f3950]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center border"
                        style={{
                          backgroundColor: `${def.color}20`,
                          borderColor: `${def.color}50`,
                          color: def.color
                        }}
                      >
                        {getStemIcon(type)}
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center border text-[10px] ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>

                    <p className="text-xs font-bold text-white truncate">{def.name}</p>
                    <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{def.freqRange}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress Bar Display */}
          {isProcessing && progress && (
            <div className="bg-indigo-950/80 border border-indigo-800 rounded-2xl p-4 shadow-xl space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-mono text-indigo-200">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                  {progress.status}
                </span>
                <span className="font-bold text-sm">{Math.round(progress.percent)}%</span>
              </div>
              <div className="w-full h-2.5 bg-indigo-950 rounded-full overflow-hidden border border-indigo-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-[#20293d] flex items-center justify-between sticky bottom-0 bg-[#121624]/95 backdrop-blur-sm">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" />
            <span>
              Target: <strong className="text-white">{selectedStemTypes.length} Stems</strong> with polyphonic MIDI transcription
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-[#171d2b] hover:bg-[#20283b] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartExtraction}
              disabled={isProcessing || (sourceMode === 'file' && !uploadedFile)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer ${
                isProcessing || (sourceMode === 'file' && !uploadedFile)
                  ? 'bg-slate-700 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 shadow-indigo-600/30'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Extracting Ensembles...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Extract {selectedStemTypes.length}-Stem Ensemble</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

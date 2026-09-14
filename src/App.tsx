/**
 * StemStudio Supreme - Merged Suite
 * daw.66ghz.com • sf2.2kool4u.net • midi.2kool4u.net
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StudioTab, AudioStem, SF2Bank, SF2Sample, MidiSong, PlaybackMode, TransportState } from './types';
import { StudioHeader } from './components/StudioHeader';
import { DawView } from './components/daw/DawView';
import { Sf2StudioView } from './components/sf2/Sf2StudioView';
import { MidiConverterView } from './components/midi/MidiConverterView';
import { createDemoAudioTrack, createDemoSoundFonts, getDemoMidiSongs } from './audio/demoData';
import { getAudioContext, unlockAudioContext, decodeAudioFile } from './audio/audioContext';
import { separateAudioStems } from './audio/stemSeparator';
import { getSynthEngine } from './audio/synthEngine';
import { parseSF2Binary } from './audio/sf2Parser';
import { buildSF2Binary } from './audio/sf2Builder';
import { parseMidiFile } from './audio/midiParser';
import { downloadBlob } from './audio/mp3Encoder';

export default function App() {
  // Master Active Tab ('daw' | 'sf2' | 'midi')
  const [activeTab, setActiveTab] = useState<StudioTab>('daw');

  // Shared Suite State
  const [stems, setStems] = useState<AudioStem[]>(() => createDemoAudioTrack('synthwave').stems);
  const [banks, setBanks] = useState<SF2Bank[]>(() => createDemoSoundFonts());
  const [activeSF2Bank, setActiveSF2Bank] = useState<SF2Bank | null>(() => banks[0]);
  const [currentMidiSong, setCurrentMidiSong] = useState<MidiSong>(() => getDemoMidiSongs()[0]);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('stems');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeDemoName, setActiveDemoName] = useState<string>('Synthwave Horizon');
  const [isExtractionModalOpen, setIsExtractionModalOpen] = useState(false);
  const [isSeparating, setIsSeparating] = useState(false);
  const [separationProgress, setSeparationProgress] = useState<{ percent: number; status: string } | null>(null);

  // SF2 Active Selection & Modal State
  const [sf2SelectedPresetId, setSf2SelectedPresetId] = useState<string>(() => banks[0]?.presets[0]?.id || '');
  const [sf2SelectedSampleId, setSf2SelectedSampleId] = useState<string | null>(null);
  const [isSeededSf2ModalOpen, setIsSeededSf2ModalOpen] = useState(false);
  const [seededSf2ModalMode, setSeededSf2ModalMode] = useState<'generate' | 'randomize'>('generate');
  const [targetSampleForSeeded, setTargetSampleForSeeded] = useState<SF2Sample | null>(null);

  // Unified Transport State
  const [transport, setTransport] = useState<TransportState>({
    isPlaying: false,
    currentTime: 0,
    duration: 8.0,
    bpm: 120,
    isLooping: true,
    masterVolume: 0.85
  });

  // Web Audio Buffers & Synthesizer references
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const synth = getSynthEngine();
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Initialize synth soundfont on mount
  useEffect(() => {
    if (activeSF2Bank) {
      synth.loadSoundFont(activeSF2Bank);
    }
  }, [activeSF2Bank, synth]);

  // Set duration based on current stems or active MIDI song
  useEffect(() => {
    if (activeTab === 'daw') {
      const maxStemDur = stems.reduce((max, s) => Math.max(max, s.audioBuffer?.duration || 8), 8);
      setTransport(prev => ({ ...prev, duration: maxStemDur }));
    } else if (activeTab === 'midi') {
      setTransport(prev => ({ ...prev, duration: currentMidiSong.duration || 8, bpm: currentMidiSong.bpm || 120 }));
    }
  }, [activeTab, stems, currentMidiSong]);

  // Stop all active audio buffer sources
  const stopAudioBufferSources = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {
        // Source might already have ended
      }
    }
    activeSourcesRef.current = [];
    synth.allNotesOff();
  }, [synth]);

  // Play audio stems via Web Audio API
  const playAudioStems = useCallback((startOffset: number) => {
    stopAudioBufferSources();
    const ctx = getAudioContext();
    const anySolo = stems.some(s => s.solo);

    for (const stem of stems) {
      if (!stem.audioBuffer) continue;
      const isMuted = stem.muted || (anySolo && !stem.solo);
      if (isMuted) continue;

      const source = ctx.createBufferSource();
      source.buffer = stem.audioBuffer;
      source.loop = transport.isLooping;

      // Track Gain
      const gainNode = ctx.createGain();
      gainNode.gain.value = stem.volume * transport.masterVolume;

      // Track Pan
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, stem.pan));
        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(ctx.destination);
      } else {
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
      }

      const offsetClamped = Math.max(0, startOffset % stem.audioBuffer.duration);
      source.start(0, offsetClamped);
      activeSourcesRef.current.push(source);
    }
  }, [stems, transport.isLooping, transport.masterVolume, stopAudioBufferSources]);

  // Playback Loop Runner
  useEffect(() => {
    if (!transport.isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopAudioBufferSources();
      return;
    }

    const ctx = getAudioContext();
    playbackStartTimeRef.current = ctx.currentTime - playbackOffsetRef.current;

    // If DAW in Stems mode, start Web Audio source nodes
    if (activeTab === 'daw' && playbackMode === 'stems') {
      playAudioStems(playbackOffsetRef.current);
    }

    // Schedule Synth notes when in GM or SF2 mode, or MIDI view
    const scheduledNoteIds = new Set<string>();

    const updateLoop = () => {
      const now = ctx.currentTime;
      let currentPos = now - playbackStartTimeRef.current;

      const totalDur = transport.duration || 8;

      if (currentPos >= totalDur) {
        if (transport.isLooping) {
          currentPos = currentPos % totalDur;
          playbackOffsetRef.current = currentPos;
          playbackStartTimeRef.current = now - currentPos;
          scheduledNoteIds.clear();

          if (activeTab === 'daw' && playbackMode === 'stems') {
            playAudioStems(currentPos);
          }
        } else {
          // Playback finished
          setTransport(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
          playbackOffsetRef.current = 0;
          stopAudioBufferSources();
          return;
        }
      }

      setTransport(prev => ({ ...prev, currentTime: currentPos }));

      // Synth note scheduling for GM / SF2 modes
      if (
        (activeTab === 'daw' && (playbackMode === 'gm_synth' || playbackMode === 'sf2_render')) ||
        activeTab === 'midi'
      ) {
        const lookAhead = 0.15;
        const tracksToPlay = activeTab === 'daw'
          ? stems.map(s => ({
              id: s.id,
              program: s.instrumentProgram,
              isDrumTrack: s.type === 'drums',
              channel: s.type === 'drums' ? 9 : 0,
              muted: s.muted || (stems.some(item => item.solo) && !s.solo),
              notes: s.midiNotes
            }))
          : currentMidiSong.tracks.map(t => ({
              id: t.id,
              program: t.program,
              isDrumTrack: t.isDrumTrack || t.channel === 9,
              channel: t.channel,
              muted: t.muted || (currentMidiSong.tracks.some(item => item.solo) && !t.solo),
              notes: t.notes
            }));

        for (const tr of tracksToPlay) {
          if (tr.muted) continue;
          for (const note of tr.notes) {
            const nKey = `${tr.id}-${note.id}`;
            if (
              note.startTime >= currentPos &&
              note.startTime < currentPos + lookAhead &&
              !scheduledNoteIds.has(nKey)
            ) {
              scheduledNoteIds.add(nKey);
              const delaySec = Math.max(0, note.startTime - currentPos);
              setTimeout(() => {
                synth.noteOn(note.pitch, note.velocity, tr.program, tr.channel, tr.isDrumTrack);
                setTimeout(() => {
                  synth.noteOff(note.pitch, tr.channel);
                }, note.duration * 1000);
              }, delaySec * 1000);
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopAudioBufferSources();
    };
  }, [
    transport.isPlaying,
    transport.duration,
    transport.isLooping,
    activeTab,
    playbackMode,
    playAudioStems,
    stems,
    currentMidiSong,
    stopAudioBufferSources,
    synth
  ]);

  // Play / Pause Toggle
  const handlePlayToggle = async () => {
    await unlockAudioContext();
    setTransport(prev => {
      if (prev.isPlaying) {
        playbackOffsetRef.current = prev.currentTime;
        return { ...prev, isPlaying: false };
      } else {
        return { ...prev, isPlaying: true };
      }
    });
  };

  // Stop Playback
  const handleStop = () => {
    playbackOffsetRef.current = 0;
    setTransport(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    stopAudioBufferSources();
  };

  // Spacebar global listener for Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        handlePlayToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Bridge 1: Send DAW stem to SF2 Slicer
  const handleSendStemToSF2 = (stem: AudioStem) => {
    setActiveTab('sf2');
  };

  // Bridge 2: Send extracted DAW MIDI to Converter
  const handleSendMidiToConverter = () => {
    const newSong: MidiSong = {
      name: 'Transcribed DAW Stems',
      bpm: transport.bpm,
      timeSignature: [4, 4],
      duration: transport.duration,
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
    setCurrentMidiSong(newSong);
    setActiveTab('midi');
  };

  // Bridge 3: Use SoundFont in DAW
  const handleUseSoundFontInDAW = () => {
    setPlaybackMode('sf2_render');
    setActiveTab('daw');
  };

  // DAW Demos, Upload & Separation Handlers
  const handleLoadDemo = (style: 'synthwave' | 'funk' | 'acoustic', name: string) => {
    setActiveDemoName(name);
    const { stems: demoStems } = createDemoAudioTrack(style);
    setStems(demoStems);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSeparating(true);
      setSeparationProgress({ percent: 5, status: `Decoding ${file.name}...` });

      const decodedBuffer = await decodeAudioFile(file);
      setSeparationProgress({ percent: 20, status: 'Performing spectral stem analysis...' });

      const separated = await separateAudioStems(decodedBuffer, (percent, status) => {
        setSeparationProgress({ percent, status });
      });

      setStems(separated);
      setActiveDemoName(file.name.replace(/\.[^/.]+$/, ''));

      setTimeout(() => {
        setIsSeparating(false);
        setSeparationProgress(null);
      }, 500);
    } catch (err) {
      console.error('Stem separation failed:', err);
      setIsSeparating(false);
      setSeparationProgress(null);
    }
  };

  const handleApplySeparation = (newStems: AudioStem[], trackName: string) => {
    setStems(newStems);
    setActiveDemoName(trackName);
  };

  // SF2 Bank Selection, Preset, Upload & Export
  const handleSelectBank = (bankId: string) => {
    const found = banks.find(b => b.id === bankId);
    if (found) {
      setActiveSF2Bank(found);
      synth.loadSoundFont(found);
      if (found.presets.length > 0) {
        setSf2SelectedPresetId(found.presets[0].id);
        const firstSample = found.presets[0].instruments[0]?.samples[0];
        setSf2SelectedSampleId(firstSample ? firstSample.id : null);
      }
    }
  };

  const handleUploadSf2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsedBank = parseSF2Binary(buffer);
      parsedBank.name = file.name.replace(/\.sf2$/i, '');
      setBanks(prev => [parsedBank, ...prev]);
      setActiveSF2Bank(parsedBank);
      synth.loadSoundFont(parsedBank);
      if (parsedBank.presets.length > 0) {
        setSf2SelectedPresetId(parsedBank.presets[0].id);
        const firstSample = parsedBank.presets[0].instruments[0]?.samples[0];
        setSf2SelectedSampleId(firstSample ? firstSample.id : null);
      }
    } catch (err) {
      console.error('Failed to parse SF2 file:', err);
    }
  };

  const handleExportSf2 = () => {
    const currentBank = activeSF2Bank || banks[0];
    if (!currentBank) return;
    const uint8 = buildSF2Binary(currentBank);
    const blob = new Blob([uint8], { type: 'application/octet-stream' });
    downloadBlob(blob, `${currentBank.name.toLowerCase().replace(/\s+/g, '_')}.sf2`);
  };

  const handleOpenGenerateInstrument = () => {
    setSeededSf2ModalMode('generate');
    setTargetSampleForSeeded(null);
    setIsSeededSf2ModalOpen(true);
  };

  const handleOpenRandomizeSample = () => {
    const currentBank = activeSF2Bank || banks[0];
    const activePreset = currentBank?.presets.find(p => p.id === sf2SelectedPresetId) || currentBank?.presets[0];
    const currentSamples = activePreset?.instruments.flatMap(i => i.samples) || [];
    const sample = currentSamples.find(s => s.id === sf2SelectedSampleId) || currentSamples[0] || null;
    if (sample) {
      setSeededSf2ModalMode('randomize');
      setTargetSampleForSeeded(sample);
      setIsSeededSf2ModalOpen(true);
    }
  };

  // MIDI Demo Selection, Upload & SoundFont switch
  const handleSelectMidiDemo = (demoName: string) => {
    const demos = getDemoMidiSongs();
    const found = demos.find(d => d.name === demoName || d.name.startsWith(demoName));
    if (found) {
      setCurrentMidiSong(found);
    }
  };

  const handleUploadMidi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMidiFile(buffer);
      parsed.name = file.name.replace(/\.midi?$/i, '');
      setCurrentMidiSong(parsed);
    } catch (err) {
      console.error('Failed to parse MIDI file:', err);
    }
  };

  const handleSelectMidiSF2Bank = (bankId: string) => {
    const found = banks.find(b => b.id === bankId);
    if (found) {
      setActiveSF2Bank(found);
      synth.loadSoundFont(found);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c12] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Studio Master Header & Transport Bar */}
      <StudioHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        transport={transport}
        onPlayToggle={handlePlayToggle}
        onStop={handleStop}
        onBpmChange={(bpm) => setTransport(prev => ({ ...prev, bpm }))}
        onLoopToggle={() => setTransport(prev => ({ ...prev, isLooping: !prev.isLooping }))}
        onMasterVolumeChange={(vol) => setTransport(prev => ({ ...prev, masterVolume: vol }))}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        dawActiveStemsCount={stems.length}
        activeDemoName={activeDemoName}
        onLoadDemo={handleLoadDemo}
        onFileUpload={handleFileUpload}
        onOpenExtractionModal={() => setIsExtractionModalOpen(true)}
        playbackMode={playbackMode}
        onPlaybackModeChange={setPlaybackMode}
        banks={banks}
        activeBank={activeSF2Bank}
        onSelectBank={handleSelectBank}
        selectedPresetId={sf2SelectedPresetId}
        onSelectPreset={setSf2SelectedPresetId}
        onUploadSf2={handleUploadSf2}
        onOpenGenerateInstrument={handleOpenGenerateInstrument}
        onOpenRandomizeSample={handleOpenRandomizeSample}
        onExportSf2={handleExportSf2}
        currentMidiSong={currentMidiSong}
        onSelectMidiDemo={handleSelectMidiDemo}
        onUploadMidi={handleUploadMidi}
        onImportDawStems={handleSendMidiToConverter}
        onSelectMidiSF2Bank={handleSelectMidiSF2Bank}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'daw' && (
          <DawView
            stems={stems}
            setStems={setStems}
            playbackMode={playbackMode}
            setPlaybackMode={setPlaybackMode}
            activeSF2Bank={activeSF2Bank}
            currentTime={transport.currentTime}
            duration={transport.duration}
            bpm={transport.bpm}
            onSendToSF2Studio={handleSendStemToSF2}
            onSendMidiToConverter={handleSendMidiToConverter}
            isExportModalOpen={isExportModalOpen}
            setIsExportModalOpen={setIsExportModalOpen}
            activeDemoName={activeDemoName}
            setActiveDemoName={setActiveDemoName}
            isExtractionModalOpen={isExtractionModalOpen}
            setIsExtractionModalOpen={setIsExtractionModalOpen}
            isSeparating={isSeparating}
            separationProgress={separationProgress}
            onApplySeparation={handleApplySeparation}
          />
        )}

        {activeTab === 'sf2' && (
          <Sf2StudioView
            banks={banks}
            setBanks={setBanks}
            activeBank={activeSF2Bank}
            setActiveBank={setActiveSF2Bank}
            stems={stems}
            onUseInDAW={handleUseSoundFontInDAW}
            onUseInMidiConverter={() => setActiveTab('midi')}
            selectedPresetId={sf2SelectedPresetId}
            setSelectedPresetId={setSf2SelectedPresetId}
            selectedSampleId={sf2SelectedSampleId}
            setSelectedSampleId={setSf2SelectedSampleId}
            isSeededSf2ModalOpen={isSeededSf2ModalOpen}
            setIsSeededSf2ModalOpen={setIsSeededSf2ModalOpen}
            seededSf2ModalMode={seededSf2ModalMode}
            setSeededSf2ModalMode={setSeededSf2ModalMode}
            targetSampleForSeeded={targetSampleForSeeded}
            setTargetSampleForSeeded={setTargetSampleForSeeded}
          />
        )}

        {activeTab === 'midi' && (
          <MidiConverterView
            currentSong={currentMidiSong}
            setCurrentSong={setCurrentMidiSong}
            banks={banks}
            activeSF2Bank={activeSF2Bank}
            setActiveSF2Bank={setActiveSF2Bank}
            stems={stems}
            currentTime={transport.currentTime}
            bpm={transport.bpm}
            onImportDawStems={handleSendMidiToConverter}
          />
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-[#1c2233] bg-[#0c0e16] py-3 text-center text-xs text-slate-500 font-mono">
        StemStudio Supreme • Unified Web Audio Suite (daw.66ghz.com + sf2.2kool4u.net + midi.2kool4u.net)
      </footer>
    </div>
  );
}

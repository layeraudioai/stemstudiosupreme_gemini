import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Grid,
  Sparkles,
  Plus,
  Trash2,
  Volume2,
  Copy,
  ArrowUp,
  ArrowDown,
  X,
  Sliders,
  CheckSquare,
  ChevronsUp,
  ChevronsDown
} from 'lucide-react';
import { MidiNote, AudioStem } from '../../types';
import { midiToNoteName } from '../../audio/audioContext';
import { getSynthEngine } from '../../audio/synthEngine';

interface NoteSnapshot {
  id: string;
  startTime: number;
  pitch: number;
  duration: number;
  velocity: number;
}

type DragState =
  | {
      type: 'select';
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      isAdditive: boolean;
      initialSelectedIds: string[];
    }
  | {
      type: 'move';
      startX: number;
      startY: number;
      snapshots: NoteSnapshot[];
      primaryNoteId: string;
    }
  | {
      type: 'resize';
      startX: number;
      startY: number;
      snapshots: NoteSnapshot[];
      primaryNoteId: string;
    };

interface PianoRollEditorProps {
  selectedStem: AudioStem;
  allStems: AudioStem[];
  onUpdateNotes: (stemId: string, notes: MidiNote[]) => void;
  currentTime: number;
  duration: number;
  bpm: number;
}

export const PianoRollEditor: React.FC<PianoRollEditorProps> = ({
  selectedStem,
  allStems,
  onUpdateNotes,
  currentTime,
  duration,
  bpm
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Piano roll view state
  const [pixelsPerSecond, setPixelsPerSecond] = useState(120);
  const [noteHeight, setNoteHeight] = useState(18);
  const [snapDivision, setSnapDivision] = useState<number>(16); // 16th notes
  const [showAllStemsOverlay, setShowAllStemsOverlay] = useState(false);

  // Batch Selection State
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // Visible MIDI range (e.g. C2 to C7 = 36 to 88)
  const minMidi = 36;
  const maxMidi = 88;
  const totalKeys = maxMidi - minMidi + 1;

  const beatDuration = 60 / (bpm || 120);
  const snapSeconds = beatDuration * (4 / snapDivision);

  // Dragging / Selection state
  const [dragState, setDragState] = useState<DragState | null>(null);

  const synth = getSynthEngine();

  // Reset selection when switching active stem
  useEffect(() => {
    setSelectedNoteIds([]);
  }, [selectedStem.id]);

  // Clean up selection when notes are removed externally
  useEffect(() => {
    const existingIds = new Set(selectedStem.midiNotes.map(n => n.id));
    setSelectedNoteIds(prev => prev.filter(id => existingIds.has(id)));
  }, [selectedStem.midiNotes]);

  // Audition note when key clicked
  const handleKeyAudition = (pitch: number) => {
    synth.noteOn(pitch, 90, selectedStem.instrumentProgram, 0, selectedStem.type === 'drums');
    setTimeout(() => synth.noteOff(pitch, 0), 300);
  };

  // Batch Deletion
  const handleDeleteSelected = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    const toDelete = new Set(selectedNoteIds);
    const updated = selectedStem.midiNotes.filter(n => !toDelete.has(n.id));
    onUpdateNotes(selectedStem.id, updated);
    setSelectedNoteIds([]);
  }, [selectedNoteIds, selectedStem.id, selectedStem.midiNotes, onUpdateNotes]);

  // Batch Transposition
  const handleBatchTranspose = useCallback((semitones: number) => {
    if (selectedNoteIds.length === 0) return;
    const toTranspose = new Set(selectedNoteIds);

    // Calculate maximum allowable semitones to stay within bounds
    let clampedSemitones = semitones;
    for (const note of selectedStem.midiNotes) {
      if (toTranspose.has(note.id)) {
        const target = note.pitch + clampedSemitones;
        if (target < minMidi) {
          clampedSemitones = Math.max(clampedSemitones, minMidi - note.pitch);
        } else if (target > maxMidi) {
          clampedSemitones = Math.min(clampedSemitones, maxMidi - note.pitch);
        }
      }
    }

    if (clampedSemitones === 0 && semitones !== 0) return;

    const updated = selectedStem.midiNotes.map(n => {
      if (toTranspose.has(n.id)) {
        const newPitch = Math.max(minMidi, Math.min(maxMidi, n.pitch + clampedSemitones));
        return { ...n, pitch: newPitch };
      }
      return n;
    });

    onUpdateNotes(selectedStem.id, updated);
  }, [selectedNoteIds, selectedStem.id, selectedStem.midiNotes, onUpdateNotes, minMidi, maxMidi]);

  // Batch Nudge in Time
  const handleBatchNudge = useCallback((deltaTime: number) => {
    if (selectedNoteIds.length === 0) return;
    const toNudge = new Set(selectedNoteIds);

    // Ensure no note goes before 0s
    let clampedDelta = deltaTime;
    for (const note of selectedStem.midiNotes) {
      if (toNudge.has(note.id)) {
        if (note.startTime + clampedDelta < 0) {
          clampedDelta = -note.startTime;
        }
      }
    }

    const updated = selectedStem.midiNotes.map(n => {
      if (toNudge.has(n.id)) {
        const newStart = Math.max(0, Number((n.startTime + clampedDelta).toFixed(3)));
        return { ...n, startTime: newStart };
      }
      return n;
    });

    onUpdateNotes(selectedStem.id, updated);
  }, [selectedNoteIds, selectedStem.id, selectedStem.midiNotes, onUpdateNotes]);

  // Batch Velocity Change
  const handleBatchVelocityChange = useCallback((deltaVelocity: number) => {
    if (selectedNoteIds.length === 0) return;
    const toChange = new Set(selectedNoteIds);
    const updated = selectedStem.midiNotes.map(n => {
      if (toChange.has(n.id)) {
        const currentVel = n.velocity ?? 90;
        const newVel = Math.max(1, Math.min(127, Math.round(currentVel + deltaVelocity)));
        return { ...n, velocity: newVel };
      }
      return n;
    });
    onUpdateNotes(selectedStem.id, updated);
  }, [selectedNoteIds, selectedStem.id, selectedStem.midiNotes, onUpdateNotes]);

  // Batch Quantize Selected Notes
  const handleBatchQuantizeSelected = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    const toQuantize = new Set(selectedNoteIds);
    const updated = selectedStem.midiNotes.map(n => {
      if (toQuantize.has(n.id)) {
        const snappedStart = Math.round(n.startTime / snapSeconds) * snapSeconds;
        const snappedDur = Math.max(snapSeconds, Math.round(n.duration / snapSeconds) * snapSeconds);
        return {
          ...n,
          startTime: Number(snappedStart.toFixed(3)),
          duration: Number(snappedDur.toFixed(3))
        };
      }
      return n;
    });
    onUpdateNotes(selectedStem.id, updated);
  }, [selectedNoteIds, selectedStem.id, selectedStem.midiNotes, onUpdateNotes, snapSeconds]);

  // Batch Duplicate Selected Notes
  const handleBatchDuplicate = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    const toDup = selectedStem.midiNotes.filter(n => selectedNoteIds.includes(n.id));
    if (toDup.length === 0) return;

    // Shift duplicates by 1 bar (or 4 beats)
    const shiftTime = beatDuration * 4;
    const now = Date.now();
    const duplicates: MidiNote[] = toDup.map((n, idx) => ({
      ...n,
      id: `note-dup-${now}-${idx}`,
      startTime: Number((n.startTime + shiftTime).toFixed(3))
    }));

    onUpdateNotes(selectedStem.id, [...selectedStem.midiNotes, ...duplicates]);
    setSelectedNoteIds(duplicates.map(d => d.id));
  }, [selectedNoteIds, selectedStem.id, selectedStem.midiNotes, onUpdateNotes, beatDuration]);

  // Select All Notes
  const handleSelectAll = useCallback(() => {
    setSelectedNoteIds(selectedStem.midiNotes.map(n => n.id));
  }, [selectedStem.midiNotes]);

  // Global Keyboard listener for Piano Roll shortcuts (Delete, Esc, Ctrl+A, Ctrl+D, Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNoteIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === 'Escape') {
        setSelectedNoteIds([]);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedNoteIds.length > 0) {
          e.preventDefault();
          handleBatchDuplicate();
        }
      } else if (e.key === 'ArrowUp') {
        if (selectedNoteIds.length > 0) {
          e.preventDefault();
          handleBatchTranspose(e.shiftKey ? 12 : 1);
        }
      } else if (e.key === 'ArrowDown') {
        if (selectedNoteIds.length > 0) {
          e.preventDefault();
          handleBatchTranspose(e.shiftKey ? -12 : -1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (selectedNoteIds.length > 0) {
          e.preventDefault();
          handleBatchNudge(-snapSeconds);
        }
      } else if (e.key === 'ArrowRight') {
        if (selectedNoteIds.length > 0) {
          e.preventDefault();
          handleBatchNudge(snapSeconds);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNoteIds,
    handleDeleteSelected,
    handleSelectAll,
    handleBatchDuplicate,
    handleBatchTranspose,
    handleBatchNudge,
    snapSeconds
  ]);

  // Draw Piano Roll Canvas
  const drawPianoRoll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalWidth = Math.max(800, duration * pixelsPerSecond);
    const totalHeight = totalKeys * noteHeight;

    if (canvas.width !== totalWidth || canvas.height !== totalHeight) {
      canvas.width = totalWidth;
      canvas.height = totalHeight;
    }

    ctx.clearRect(0, 0, totalWidth, totalHeight);

    // 1. Draw Grid Lines and Key rows
    for (let i = 0; i < totalKeys; i++) {
      const pitch = maxMidi - i;
      const y = i * noteHeight;
      const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);

      // Row background
      ctx.fillStyle = isBlack ? '#111520' : '#161b28';
      ctx.fillRect(0, y, totalWidth, noteHeight);

      // Subtle horizontal divider
      ctx.strokeStyle = '#1d2334';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + noteHeight);
      ctx.lineTo(totalWidth, y + noteHeight);
      ctx.stroke();
    }

    // 2. Draw Vertical Beat & Measure Lines
    const numBeats = Math.ceil(duration / beatDuration);
    for (let b = 0; b <= numBeats; b++) {
      const x = b * beatDuration * pixelsPerSecond;
      const isMeasure = b % 4 === 0;

      ctx.strokeStyle = isMeasure ? '#3b455e' : '#232a3d';
      ctx.lineWidth = isMeasure ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalHeight);
      ctx.stroke();

      // Measure number tag on top
      if (isMeasure) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText(`Bar ${Math.floor(b / 4) + 1}`, x + 4, 12);
      }
    }

    // 3. Draw Inactive Stems Overlay (ghost notes)
    if (showAllStemsOverlay) {
      for (const st of allStems) {
        if (st.id === selectedStem.id) continue;
        for (const note of st.midiNotes) {
          if (note.pitch < minMidi || note.pitch > maxMidi) continue;
          const y = (maxMidi - note.pitch) * noteHeight;
          const x = note.startTime * pixelsPerSecond;
          const w = Math.max(4, note.duration * pixelsPerSecond);

          ctx.fillStyle = `${st.color}25`;
          ctx.strokeStyle = `${st.color}50`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x, y + 2, w - 1, noteHeight - 4, 3);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    const selectedSet = new Set(selectedNoteIds);

    // 4. Draw Active Notes for Selected Stem
    for (const note of selectedStem.midiNotes) {
      if (note.pitch < minMidi || note.pitch > maxMidi) continue;
      const y = (maxMidi - note.pitch) * noteHeight;
      const x = note.startTime * pixelsPerSecond;
      const w = Math.max(5, note.duration * pixelsPerSecond);
      const isSelected = selectedSet.has(note.id);

      // Note body
      ctx.fillStyle = selectedStem.color;
      ctx.beginPath();
      ctx.roundRect(x, y + 1.5, w - 1, noteHeight - 3, 3);
      ctx.fill();

      // Border & Selection Indicator
      if (isSelected) {
        // High visibility bright cyan selection outline & glow
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner white highlight bar for selected notes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y + 3, Math.max(2, w - 5), 2);
      } else {
        ctx.strokeStyle = '#ffffffaa';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Note label
      if (w > 25) {
        ctx.fillStyle = isSelected ? '#ffffff' : '#f1f5f9';
        ctx.font = isSelected ? 'bold 10px monospace' : '9px monospace';
        ctx.fillText(midiToNoteName(note.pitch), x + 4, y + noteHeight - 5.5);
      }

      // Resize handle on the right edge
      ctx.fillStyle = isSelected ? '#38bdf8' : '#ffffff88';
      ctx.fillRect(x + w - (isSelected ? 5 : 4), y + 3, isSelected ? 3 : 2, noteHeight - 6);
    }

    // 5. Draw Marquee Selection Bounding Box (Rubberband Drag)
    if (dragState && dragState.type === 'select') {
      const boxX = Math.min(dragState.startX, dragState.currentX);
      const boxY = Math.min(dragState.startY, dragState.currentY);
      const boxW = Math.abs(dragState.currentX - dragState.startX);
      const boxH = Math.abs(dragState.currentY - dragState.startY);

      if (boxW > 3 || boxH > 3) {
        // Semi-transparent selection fill
        ctx.fillStyle = 'rgba(99, 102, 241, 0.22)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // Dashed border
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.setLineDash([]);

        // Real-time selected count pill
        const count = selectedNoteIds.length;
        const badgeText = `${count} note${count === 1 ? '' : 's'}`;
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(boxX + 4, boxY + 4, 76, 18);
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX + 4, boxY + 4, 76, 18);
        ctx.fillStyle = '#c7d2fe';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(badgeText, boxX + 8, boxY + 16);
      }
    }

    // 6. Draw Playhead
    const playheadX = currentTime * pixelsPerSecond;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, totalHeight);
    ctx.stroke();

    // Playhead head
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, 0);
    ctx.lineTo(playheadX + 6, 0);
    ctx.lineTo(playheadX, 10);
    ctx.closePath();
    ctx.fill();
  }, [
    duration,
    pixelsPerSecond,
    totalKeys,
    noteHeight,
    beatDuration,
    showAllStemsOverlay,
    allStems,
    selectedStem,
    currentTime,
    selectedNoteIds,
    dragState
  ]);

  useEffect(() => {
    drawPianoRoll();
  }, [drawPianoRoll]);

  // Quantize all notes to current grid snap
  const handleQuantizeAll = () => {
    const quantized = selectedStem.midiNotes.map(n => {
      const snappedStart = Math.round(n.startTime / snapSeconds) * snapSeconds;
      const snappedDur = Math.max(snapSeconds, Math.round(n.duration / snapSeconds) * snapSeconds);
      return {
        ...n,
        startTime: Number(snappedStart.toFixed(3)),
        duration: Number(snappedDur.toFixed(3))
      };
    });
    onUpdateNotes(selectedStem.id, quantized);
  };

  // Clear all notes for this stem
  const handleClearAllNotes = () => {
    onUpdateNotes(selectedStem.id, []);
    setSelectedNoteIds([]);
  };

  // Add a sample 4-note chord or arpeggio
  const handleAddDemoNotes = () => {
    const base = selectedStem.type === 'bass' ? 48 : 60;
    const now = Date.now();
    const newNotes: MidiNote[] = [
      { id: `add-${now}-0`, pitch: base, startTime: 0, duration: 0.5, velocity: 90 },
      { id: `add-${now}-1`, pitch: base + 4, startTime: 0.5, duration: 0.5, velocity: 90 },
      { id: `add-${now}-2`, pitch: base + 7, startTime: 1.0, duration: 0.5, velocity: 90 },
      { id: `add-${now}-3`, pitch: base + 12, startTime: 1.5, duration: 1.0, velocity: 95 }
    ];
    onUpdateNotes(selectedStem.id, [...selectedStem.midiNotes, ...newNotes]);
  };

  // Mouse event handling on the canvas for:
  // 1. Clicking off of a note & dragging -> BATCH MARQUEE SELECTION
  // 2. Dragging selected notes -> BATCH MOVE & TRANSPOSE
  // 3. Resizing selected notes -> BATCH DURATION RESIZE
  // 4. Right-clicking -> BATCH DELETE
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clickedPitch = maxMidi - Math.floor(mouseY / noteHeight);
    const clickedTime = mouseX / pixelsPerSecond;

    // Check if clicked an existing note
    let clickedNote: MidiNote | undefined;
    let isResize = false;

    for (const note of selectedStem.midiNotes) {
      if (note.pitch === clickedPitch) {
        const nStart = note.startTime;
        const nEnd = note.startTime + note.duration;
        if (clickedTime >= nStart && clickedTime <= nEnd) {
          clickedNote = note;
          const noteEndX = nEnd * pixelsPerSecond;
          if (Math.abs(mouseX - noteEndX) <= 8) {
            isResize = true;
          }
          break;
        }
      }
    }

    // Right-click or Alt-click to delete
    if (e.button === 2 || e.altKey) {
      if (clickedNote) {
        if (selectedNoteIds.includes(clickedNote.id)) {
          // Delete all selected notes!
          handleDeleteSelected();
        } else {
          // Delete just this clicked note
          onUpdateNotes(selectedStem.id, selectedStem.midiNotes.filter(n => n.id !== clickedNote?.id));
        }
      } else {
        // Right-clicking empty space clears selection
        setSelectedNoteIds([]);
      }
      return;
    }

    // Left Click on an EXISTING Note:
    if (clickedNote) {
      handleKeyAudition(clickedNote.pitch);

      let targetSelectedIds = selectedNoteIds;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        // Toggle note in selection
        if (selectedNoteIds.includes(clickedNote.id)) {
          targetSelectedIds = selectedNoteIds.filter(id => id !== clickedNote!.id);
        } else {
          targetSelectedIds = [...selectedNoteIds, clickedNote.id];
        }
        setSelectedNoteIds(targetSelectedIds);
      } else {
        // If clicking a note not yet selected, select only it
        if (!selectedNoteIds.includes(clickedNote.id)) {
          targetSelectedIds = [clickedNote.id];
          setSelectedNoteIds(targetSelectedIds);
        }
      }

      // Snapshot all notes in selection for synchronized batch moving/resizing
      const targetIdsSet = new Set(targetSelectedIds);
      const snapshots: NoteSnapshot[] = selectedStem.midiNotes
        .filter(n => targetIdsSet.has(n.id))
        .map(n => ({
          id: n.id,
          startTime: n.startTime,
          pitch: n.pitch,
          duration: n.duration,
          velocity: n.velocity ?? 90
        }));

      setDragState({
        type: isResize ? 'resize' : 'move',
        startX: mouseX,
        startY: mouseY,
        primaryNoteId: clickedNote.id,
        snapshots
      });
    } else {
      // Left Click OFF OF A NOTE (Empty Space):
      // Initialize rubberband marquee selection drag!
      const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;
      setDragState({
        type: 'select',
        startX: mouseX,
        startY: mouseY,
        currentX: mouseX,
        currentY: mouseY,
        isAdditive,
        initialSelectedIds: isAdditive ? [...selectedNoteIds] : []
      });

      if (!isAdditive) {
        setSelectedNoteIds([]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 1. MARQUEE BATCH SELECTION DRAG
    if (dragState.type === 'select') {
      const boxLeft = Math.min(dragState.startX, mouseX);
      const boxRight = Math.max(dragState.startX, mouseX);
      const boxTop = Math.min(dragState.startY, mouseY);
      const boxBottom = Math.max(dragState.startY, mouseY);

      // Compute intersecting notes
      const intersectingIds: string[] = [];
      for (const note of selectedStem.midiNotes) {
        const nx = note.startTime * pixelsPerSecond;
        const nw = Math.max(5, note.duration * pixelsPerSecond);
        const ny = (maxMidi - note.pitch) * noteHeight;
        const nh = noteHeight;

        // Rectangle overlap test
        const overlap = !(nx + nw < boxLeft || nx > boxRight || ny + nh < boxTop || ny > boxBottom);
        if (overlap) {
          intersectingIds.push(note.id);
        }
      }

      const newSelection = dragState.isAdditive
        ? Array.from(new Set([...dragState.initialSelectedIds, ...intersectingIds]))
        : intersectingIds;

      setSelectedNoteIds(newSelection);
      setDragState(prev => (prev && prev.type === 'select' ? { ...prev, currentX: mouseX, currentY: mouseY } : prev));
      return;
    }

    // 2. BATCH RESIZE (ALL SELECTED NOTES)
    const deltaX = mouseX - dragState.startX;
    const deltaTime = deltaX / pixelsPerSecond;

    if (dragState.type === 'resize') {
      const snappedDeltaTime = Math.round(deltaTime / snapSeconds) * snapSeconds;
      const snapshotMap = new Map<string, NoteSnapshot>(dragState.snapshots.map(s => [s.id, s]));

      const updated = selectedStem.midiNotes.map(n => {
        const snap = snapshotMap.get(n.id);
        if (snap) {
          const newDur = Math.max(snapSeconds, snap.duration + snappedDeltaTime);
          return { ...n, duration: Number(newDur.toFixed(3)) };
        }
        return n;
      });

      onUpdateNotes(selectedStem.id, updated);
      return;
    }

    // 3. BATCH MOVE & TRANSPOSE (ALL SELECTED NOTES)
    if (dragState.type === 'move') {
      const deltaY = mouseY - dragState.startY;
      const rawPitchOffset = -Math.round(deltaY / noteHeight);
      const snappedDeltaTime = Math.round(deltaTime / snapSeconds) * snapSeconds;

      // Ensure no note goes negative on time
      let clampedDeltaTime = snappedDeltaTime;
      for (const snap of dragState.snapshots) {
        if (snap.startTime + clampedDeltaTime < 0) {
          clampedDeltaTime = -snap.startTime;
        }
      }

      // Ensure all notes remain within [minMidi, maxMidi]
      let clampedPitchOffset = rawPitchOffset;
      for (const snap of dragState.snapshots) {
        if (snap.pitch + clampedPitchOffset < minMidi) {
          clampedPitchOffset = Math.max(clampedPitchOffset, minMidi - snap.pitch);
        } else if (snap.pitch + clampedPitchOffset > maxMidi) {
          clampedPitchOffset = Math.min(clampedPitchOffset, maxMidi - snap.pitch);
        }
      }

      const snapshotMap = new Map<string, NoteSnapshot>(dragState.snapshots.map(s => [s.id, s]));
      const updated = selectedStem.midiNotes.map(n => {
        const snap = snapshotMap.get(n.id);
        if (snap) {
          const newStart = Math.max(0, snap.startTime + clampedDeltaTime);
          const newPitch = Math.max(minMidi, Math.min(maxMidi, snap.pitch + clampedPitchOffset));
          return { ...n, startTime: Number(newStart.toFixed(3)), pitch: newPitch };
        }
        return n;
      });

      onUpdateNotes(selectedStem.id, updated);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragState && dragState.type === 'select') {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const dist = Math.hypot(mouseX - dragState.startX, mouseY - dragState.startY);

        // If user just single-clicked on empty space without dragging:
        // If there were already notes selected, simply deselect.
        // If nothing was selected, create a new single note at the clicked location!
        if (dist < 5) {
          if (dragState.initialSelectedIds.length === 0 && !dragState.isAdditive) {
            const clickedPitch = maxMidi - Math.floor(dragState.startY / noteHeight);
            const clickedTime = dragState.startX / pixelsPerSecond;
            const snappedStart = Math.floor(clickedTime / snapSeconds) * snapSeconds;
            const newNote: MidiNote = {
              id: `note-${Date.now()}`,
              pitch: clickedPitch,
              startTime: Number(snappedStart.toFixed(3)),
              duration: Number(snapSeconds.toFixed(3)),
              velocity: 90
            };
            handleKeyAudition(clickedPitch);
            onUpdateNotes(selectedStem.id, [...selectedStem.midiNotes, newNote]);
            setSelectedNoteIds([newNote.id]);
          } else {
            setSelectedNoteIds([]);
          }
        }
      }
    }
    setDragState(null);
  };

  return (
    <div id="piano-roll-editor-container" className="bg-[#121622] border border-[#232a3d] rounded-2xl overflow-hidden shadow-xl">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#171c2b] border-b border-[#242b3e] gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3.5 h-3.5 rounded-full shadow-sm"
            style={{ backgroundColor: selectedStem.color }}
          />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Piano Roll: <span style={{ color: selectedStem.color }}>{selectedStem.name}</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
            {selectedStem.midiNotes.length} notes
          </span>
        </div>

        {/* Controls: Grid Snap, Zoom, Quantize All, Clear */}
        <div className="flex items-center gap-2">
          {/* Snap Selector */}
          <div className="flex items-center gap-1 bg-[#1e2538] px-2.5 py-1 rounded-lg text-xs font-mono text-slate-300 border border-[#2c364e]">
            <Grid className="w-3.5 h-3.5 text-indigo-400" />
            <span>Snap:</span>
            <select
              id="piano-roll-snap-select"
              value={snapDivision}
              onChange={(e) => setSnapDivision(Number(e.target.value))}
              className="bg-transparent text-indigo-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value={4} className="bg-slate-900">1/4 Beat</option>
              <option value={8} className="bg-slate-900">1/8 Beat</option>
              <option value={16} className="bg-slate-900">1/16 Beat</option>
              <option value={32} className="bg-slate-900">1/32 Beat</option>
            </select>
          </div>

          {/* Stems Ghost Notes Overlay Toggle */}
          <button
            id="piano-roll-overlay-toggle"
            onClick={() => setShowAllStemsOverlay(!showAllStemsOverlay)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
              showAllStemsOverlay
                ? 'bg-indigo-600/80 text-white border-indigo-500'
                : 'bg-[#1e2538] text-slate-400 hover:text-slate-200 border-[#2c364e]'
            }`}
            title="Overlay ghost notes from other stems"
          >
            All Stems Overlay
          </button>

          {/* Quantize All Button */}
          <button
            id="piano-roll-quantize-btn"
            onClick={handleQuantizeAll}
            title="Snap all notes to active grid"
            className="flex items-center gap-1 bg-[#1e2538] hover:bg-[#283149] text-slate-300 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border border-[#2c364e]"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Quantize All</span>
          </button>

          {/* Add Sample Pattern */}
          <button
            id="piano-roll-add-pattern-btn"
            onClick={handleAddDemoNotes}
            title="Add note pattern"
            className="p-1 bg-[#1e2538] hover:bg-[#283149] text-slate-300 rounded-lg transition-colors border border-[#2c364e]"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Select All */}
          <button
            id="piano-roll-select-all-btn"
            onClick={handleSelectAll}
            title="Select all notes (Ctrl+A)"
            className="flex items-center gap-1 bg-[#1e2538] hover:bg-[#283149] text-slate-300 px-2 py-1 rounded-lg text-xs font-medium transition-colors border border-[#2c364e]"
          >
            <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>All</span>
          </button>

          {/* Clear All Notes */}
          <button
            id="piano-roll-clear-btn"
            onClick={handleClearAllNotes}
            title="Clear all notes"
            className="p-1 bg-[#1e2538] hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-lg transition-colors border border-[#2c364e]"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 bg-[#1e2538] p-1 rounded-lg border border-[#2c364e]">
            <button
              onClick={() => setPixelsPerSecond(prev => Math.max(60, prev - 30))}
              title="Zoom Out"
              className="p-1 text-slate-400 hover:text-slate-200"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPixelsPerSecond(prev => Math.min(260, prev + 30))}
              title="Zoom In"
              className="p-1 text-slate-400 hover:text-slate-200"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* DEDICATED BATCH ACTION BAR (Appears when notes are batch selected) */}
      {selectedNoteIds.length > 0 && (
        <div
          id="piano-roll-batch-bar"
          className="px-4 py-2 bg-gradient-to-r from-indigo-950/90 via-[#181d2c] to-purple-950/90 border-b border-indigo-500/40 flex flex-wrap items-center justify-between gap-2.5 animate-in slide-in-from-top-2 duration-150"
        >
          {/* Batch Status Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold font-mono bg-sky-500/20 text-sky-300 border border-sky-400/40">
              {selectedNoteIds.length} Note{selectedNoteIds.length === 1 ? '' : 's'} Selected
            </span>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Drag notes to batch move/transpose • Drag right edge to batch resize
            </span>
          </div>

          {/* Batch Actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Batch Transposition: Octaves & Semitones */}
            <div className="flex items-center gap-1 bg-[#131724] px-1.5 py-0.5 rounded-lg border border-[#2d374f]">
              <span className="text-[10px] font-mono text-slate-400 px-1">PITCH:</span>
              <button
                id="batch-octave-down"
                onClick={() => handleBatchTranspose(-12)}
                title="Batch Octave Down (-12 semitones)"
                className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-[#1c2235] hover:bg-[#252f4a] text-slate-200"
              >
                -12
              </button>
              <button
                id="batch-semi-down"
                onClick={() => handleBatchTranspose(-1)}
                title="Batch Semitone Down (-1 semitone)"
                className="p-1 rounded text-slate-300 hover:bg-[#252f4a]"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
              <button
                id="batch-semi-up"
                onClick={() => handleBatchTranspose(1)}
                title="Batch Semitone Up (+1 semitone)"
                className="p-1 rounded text-slate-300 hover:bg-[#252f4a]"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                id="batch-octave-up"
                onClick={() => handleBatchTranspose(12)}
                title="Batch Octave Up (+12 semitones)"
                className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-[#1c2235] hover:bg-[#252f4a] text-slate-200"
              >
                +12
              </button>
            </div>

            {/* Batch Velocity Controls */}
            <div className="flex items-center gap-1 bg-[#131724] px-1.5 py-0.5 rounded-lg border border-[#2d374f]">
              <Volume2 className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] font-mono text-slate-400">VEL:</span>
              <button
                id="batch-vel-down"
                onClick={() => handleBatchVelocityChange(-10)}
                title="Decrease velocity of all selected notes (-10)"
                className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#1c2235] hover:bg-[#252f4a] text-slate-200"
              >
                -10
              </button>
              <button
                id="batch-vel-up"
                onClick={() => handleBatchVelocityChange(10)}
                title="Increase velocity of all selected notes (+10)"
                className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#1c2235] hover:bg-[#252f4a] text-slate-200"
              >
                +10
              </button>
            </div>

            {/* Batch Quantize Selected */}
            <button
              id="batch-quantize-selected-btn"
              onClick={handleBatchQuantizeSelected}
              title="Snap selected notes to active grid"
              className="flex items-center gap-1 bg-[#131724] hover:bg-[#222a3e] text-amber-300 px-2 py-1 rounded-lg text-xs font-semibold border border-[#2d374f] transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>Quantize Selected</span>
            </button>

            {/* Batch Duplicate */}
            <button
              id="batch-duplicate-btn"
              onClick={handleBatchDuplicate}
              title="Duplicate selected notes (Ctrl+D)"
              className="flex items-center gap-1 bg-[#131724] hover:bg-[#222a3e] text-slate-200 px-2 py-1 rounded-lg text-xs font-semibold border border-[#2d374f] transition-colors"
            >
              <Copy className="w-3 h-3 text-indigo-400" />
              <span>Duplicate</span>
            </button>

            {/* Batch Delete Selected (Highlighted Red) */}
            <button
              id="batch-delete-selected-btn"
              onClick={handleDeleteSelected}
              title="Delete selected notes (Delete / Backspace)"
              className="flex items-center gap-1 bg-rose-950/80 hover:bg-rose-900 text-rose-200 px-2.5 py-1 rounded-lg text-xs font-bold border border-rose-800 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete Selected</span>
            </button>

            {/* Deselect All */}
            <button
              id="batch-deselect-btn"
              onClick={() => setSelectedNoteIds([])}
              title="Deselect all (Esc)"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Body: Left Keys Sidebar + Right Scrollable Grid Canvas */}
      <div
        ref={containerRef}
        tabIndex={0}
        className="flex max-h-[380px] overflow-auto select-none relative scrollbar-thin scrollbar-thumb-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/50"
      >
        {/* Piano Keys Sidebar */}
        <div className="sticky left-0 z-20 w-16 bg-[#0e121a] border-r border-[#242b3e] shrink-0">
          {Array.from({ length: totalKeys }).map((_, i) => {
            const pitch = maxMidi - i;
            const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
            const isC = pitch % 12 === 0;

            return (
              <div
                key={pitch}
                onClick={() => handleKeyAudition(pitch)}
                style={{ height: `${noteHeight}px` }}
                className={`flex items-center justify-between px-1.5 text-[9px] font-mono cursor-pointer border-b border-[#1b2131] transition-colors ${
                  isBlack
                    ? 'bg-[#151924] text-slate-400 hover:bg-indigo-950'
                    : 'bg-[#22293b] text-slate-200 hover:bg-indigo-900 font-bold'
                }`}
                title={`Note ${midiToNoteName(pitch)} (MIDI: ${pitch})`}
              >
                <span>{midiToNoteName(pitch)}</span>
                {isC && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </div>
            );
          })}
        </div>

        {/* Notes Grid Canvas */}
        <div className="relative flex-1 bg-[#10141f]">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
            className="block cursor-crosshair"
          />
        </div>
      </div>

      {/* Piano Roll Hint Bar */}
      <div className="px-4 py-1.5 bg-[#0f121a] border-t border-[#1e2536] flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span><strong className="text-indigo-400">Click &amp; Drag Empty Space:</strong> Marquee Batch Select</span>
          <span>•</span>
          <span><strong className="text-indigo-400">Drag Selected Notes:</strong> Batch Move &amp; Transpose</span>
          <span>•</span>
          <span><strong className="text-indigo-400">Drag Edge:</strong> Batch Resize</span>
          <span>•</span>
          <span><strong className="text-rose-400">Delete / Backspace:</strong> Batch Delete</span>
        </div>
        <div>
          <span>Pitch Range: <strong className="text-slate-200">{midiToNoteName(minMidi)} - {midiToNoteName(maxMidi)}</strong></span>
        </div>
      </div>
    </div>
  );
};


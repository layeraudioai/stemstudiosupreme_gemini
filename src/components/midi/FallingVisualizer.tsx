import React, { useRef, useEffect } from 'react';
import { MidiSong } from '../../types';

interface FallingVisualizerProps {
  song: MidiSong | null;
  currentTime: number;
}

export const FallingVisualizer: React.FC<FallingVisualizerProps> = ({ song, currentTime }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !song) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Visible key range: 24 to 96 (C1 to C7 = 72 keys)
    const minPitch = 24;
    const maxPitch = 96;
    const totalKeys = maxPitch - minPitch + 1;
    const keyWidth = width / totalKeys;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a0d14');
    grad.addColorStop(1, '#0e121b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Look-ahead window (seconds of future notes to display)
    const timeWindow = 2.5;
    const bottomY = height - 20;

    // Draw keyboard baseline
    ctx.fillStyle = '#1e2538';
    ctx.fillRect(0, bottomY, width, 20);
    ctx.strokeStyle = '#38435d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, bottomY);
    ctx.lineTo(width, bottomY);
    ctx.stroke();

    // Draw notes from all active tracks
    for (const track of song.tracks) {
      if (track.muted) continue;
      const color = track.color || '#6366f1';

      for (const note of track.notes) {
        if (note.pitch < minPitch || note.pitch > maxPitch) continue;

        const noteStart = note.startTime;
        const noteEnd = note.startTime + note.duration;

        // Is note currently within the lookahead window?
        if (noteEnd >= currentTime && noteStart <= currentTime + timeWindow) {
          const x = (note.pitch - minPitch) * keyWidth;
          const w = Math.max(3, keyWidth - 1);

          // Calculate Y positions (falling downwards towards bottomY)
          const startDist = (noteStart - currentTime) / timeWindow;
          const endDist = (noteEnd - currentTime) / timeWindow;

          const yBottom = bottomY - startDist * bottomY;
          const yTop = bottomY - endDist * bottomY;
          const barHeight = Math.max(4, yBottom - yTop);

          // Is note currently hitting the baseline?
          const isHitting = currentTime >= noteStart && currentTime <= noteEnd;

          // Note body
          ctx.fillStyle = isHitting ? '#ffffff' : color;
          ctx.beginPath();
          ctx.roundRect(x, Math.max(0, yTop), w, barHeight, 3);
          ctx.fill();

          if (isHitting) {
            // Glow effect on baseline
            ctx.fillStyle = `${color}cc`;
            ctx.fillRect(x - 2, bottomY, w + 4, 18);
          }
        }
      }
    }
  }, [song, currentTime]);

  return (
    <div className="w-full h-48 bg-[#0a0d14] rounded-2xl border border-[#21283a] overflow-hidden relative shadow-inner">
      <canvas
        ref={canvasRef}
        width={800}
        height={192}
        className="w-full h-full block"
      />
      <div className="absolute top-2 right-3 text-[10px] font-mono text-slate-400 bg-black/50 px-2 py-0.5 rounded-full border border-white/10 pointer-events-none">
        Cascading Visualizer (60 FPS)
      </div>
    </div>
  );
};

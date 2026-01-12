'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type VisualizerStyle = 'bars' | 'waveform' | 'circle';

export interface AudioVisualizerProps {
  /** Current audio level (0-1) */
  audioLevel: number;
  /** Whether the visualizer is active */
  isActive?: boolean;
  /** Visual style */
  style?: VisualizerStyle;
  /** Primary color for the visualization */
  color?: string;
  /** Width of the visualizer */
  width?: number;
  /** Height of the visualizer */
  height?: number;
  /** Number of bars (for bars style) */
  barCount?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Audio visualizer component that displays real-time audio levels
 * Supports multiple visualization styles: bars, waveform, and circle
 */
export function AudioVisualizer({
  audioLevel,
  isActive = true,
  style = 'bars',
  color = '#22c55e',
  width = 200,
  height = 60,
  barCount = 20,
  className,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize history for waveform
    if (historyRef.current.length === 0) {
      historyRef.current = new Array(width).fill(0);
    }

    const draw = () => {
      // Update history
      historyRef.current.push(audioLevel);
      if (historyRef.current.length > width) {
        historyRef.current.shift();
      }

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        // Draw inactive state
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(0, height / 2 - 1, width, 2);
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      switch (style) {
        case 'bars':
          drawBars(ctx, audioLevel, width, height, barCount, color);
          break;
        case 'waveform':
          drawWaveform(ctx, historyRef.current, width, height, color);
          break;
        case 'circle':
          drawCircle(ctx, audioLevel, width, height, color);
          break;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, isActive, style, color, width, height, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn('rounded-md', className)}
    />
  );
}

/**
 * Draw bar-style visualization
 */
function drawBars(
  ctx: CanvasRenderingContext2D,
  level: number,
  width: number,
  height: number,
  barCount: number,
  color: string
) {
  const barWidth = (width / barCount) * 0.7;
  const gap = (width / barCount) * 0.3;

  for (let i = 0; i < barCount; i++) {
    // Add some randomness for more natural look
    const variance = Math.random() * 0.3 + 0.7;
    const barLevel = Math.min(1, level * variance);

    // Calculate bar height with minimum visibility
    const minHeight = 4;
    const maxHeight = height - 4;
    const barHeight = Math.max(minHeight, barLevel * maxHeight);

    // Position
    const x = i * (barWidth + gap) + gap / 2;
    const y = (height - barHeight) / 2;

    // Draw bar with gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, adjustColor(color, -30));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 2);
    ctx.fill();
  }
}

/**
 * Draw waveform-style visualization
 */
function drawWaveform(
  ctx: CanvasRenderingContext2D,
  history: number[],
  width: number,
  height: number,
  color: string
) {
  const centerY = height / 2;

  // Draw waveform line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(0, centerY);

  for (let i = 0; i < history.length; i++) {
    const x = (i / history.length) * width;
    const amplitude = (history[i] ?? 0) * (height / 2 - 4);
    // Add slight wave effect
    const wave = Math.sin(i * 0.1) * 2;
    const y = centerY + amplitude * Math.sin(i * 0.05) + wave;
    ctx.lineTo(x, y);
  }

  ctx.stroke();

  // Draw mirrored waveform (reflection)
  ctx.strokeStyle = adjustColor(color, -20);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, centerY);

  for (let i = 0; i < history.length; i++) {
    const x = (i / history.length) * width;
    const amplitude = (history[i] ?? 0) * (height / 2 - 4);
    const wave = Math.sin(i * 0.1) * 2;
    const y = centerY - amplitude * Math.sin(i * 0.05) - wave;
    ctx.lineTo(x, y);
  }

  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Draw circle-style visualization
 */
function drawCircle(
  ctx: CanvasRenderingContext2D,
  level: number,
  width: number,
  height: number,
  color: string
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const minRadius = Math.min(width, height) / 4;
  const maxRadius = Math.min(width, height) / 2 - 4;
  const radius = minRadius + level * (maxRadius - minRadius);

  // Draw outer glow
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    radius * 0.5,
    centerX,
    centerY,
    radius * 1.2
  );
  gradient.addColorStop(0, adjustColor(color, 0, 0.4));
  gradient.addColorStop(0.7, adjustColor(color, 0, 0.1));
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Draw main circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Draw inner highlight
  const innerGradient = ctx.createRadialGradient(
    centerX - radius * 0.3,
    centerY - radius * 0.3,
    0,
    centerX,
    centerY,
    radius
  );
  innerGradient.addColorStop(0, adjustColor(color, 50, 0.3));
  innerGradient.addColorStop(1, 'transparent');

  ctx.fillStyle = innerGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Adjust color brightness and/or opacity
 */
function adjustColor(
  color: string,
  brightnessChange: number = 0,
  opacity?: number
): string {
  // Parse hex color
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Adjust brightness
  const newR = Math.max(0, Math.min(255, r + brightnessChange));
  const newG = Math.max(0, Math.min(255, g + brightnessChange));
  const newB = Math.max(0, Math.min(255, b + brightnessChange));

  if (opacity !== undefined) {
    return `rgba(${newR}, ${newG}, ${newB}, ${opacity})`;
  }

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Simple audio level meter component
 * Lighter weight alternative to the canvas visualizer
 */
export function AudioLevelMeter({
  audioLevel,
  isActive = true,
  color = '#22c55e',
  className,
}: {
  audioLevel: number;
  isActive?: boolean;
  color?: string;
  className?: string;
}) {
  const segments = 10;
  const activeSegments = Math.round(audioLevel * segments);

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role="meter"
      aria-valuenow={Math.round(audioLevel * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Audio level"
    >
      {Array.from({ length: segments }).map((_, i) => {
        const isSegmentActive = isActive && i < activeSegments;
        const segmentColor =
          i < segments * 0.6
            ? color
            : i < segments * 0.8
              ? '#eab308' // yellow
              : '#ef4444'; // red

        return (
          <div
            key={i}
            className={cn(
              'w-2 h-6 rounded-sm transition-all duration-75',
              isSegmentActive ? 'opacity-100' : 'opacity-20'
            )}
            style={{
              backgroundColor: isSegmentActive ? segmentColor : '#4b5563',
            }}
          />
        );
      })}
    </div>
  );
}

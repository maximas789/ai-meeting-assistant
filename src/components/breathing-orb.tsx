'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'muted';

interface BreathingOrbProps {
  /** Current state of the orb */
  state: OrbState;
  /** Audio level from 0-1, used in listening state */
  audioLevel?: number;
  /** Base size of the orb in pixels */
  size?: number;
  /** Optional className for container */
  className?: string;
  /** Accessible label for the orb (for screen readers) */
  ariaLabel?: string;
}

// State descriptions for screen readers
const stateDescriptions: Record<OrbState, string> = {
  idle: 'Assistant is idle and ready',
  listening: 'Assistant is listening to your voice',
  processing: 'Assistant is processing your request',
  speaking: 'Assistant is speaking a response',
  muted: 'Microphone is muted',
};

/**
 * A breathing orb component that visualizes the AI assistant's state.
 *
 * States:
 * - idle: Slow, calm breathing animation (blue)
 * - listening: Responsive to audio levels (green)
 * - processing: Faster pulsing animation (yellow)
 * - speaking: Active, dynamic animation (purple)
 * - muted: Dim and reduced (red)
 */
function BreathingOrbComponent({
  state,
  audioLevel = 0,
  size = 200,
  className,
  ariaLabel,
}: BreathingOrbProps) {
  // Calculate scale based on state and audio level
  const getScale = () => {
    if (state === 'listening') {
      return 1 + audioLevel * 0.3;
    }
    if (state === 'muted') {
      return 0.85;
    }
    return 1;
  };

  // State-specific styling
  const stateConfig = {
    idle: {
      color: 'from-blue-400 to-blue-600',
      glowColor: 'bg-blue-500/30',
      shadow: 'shadow-blue-500/50',
    },
    listening: {
      color: 'from-green-400 to-green-600',
      glowColor: 'bg-green-500/40',
      shadow: 'shadow-green-500/50',
    },
    processing: {
      color: 'from-yellow-400 to-amber-500',
      glowColor: 'bg-yellow-500/30',
      shadow: 'shadow-yellow-500/50',
    },
    speaking: {
      color: 'from-purple-400 to-purple-600',
      glowColor: 'bg-purple-500/40',
      shadow: 'shadow-purple-500/50',
    },
    muted: {
      color: 'from-red-400/50 to-red-600/50',
      glowColor: 'bg-red-500/20',
      shadow: 'shadow-red-500/30',
    },
  };

  // Animation variants for each state
  const getAnimation = () => {
    switch (state) {
      case 'idle':
        return {
          scale: [1, 1.08, 1],
          opacity: [0.8, 1, 0.8],
        };
      case 'listening':
        return {
          scale: getScale(),
          opacity: 0.9 + audioLevel * 0.1,
        };
      case 'processing':
        return {
          scale: [1, 1.15, 1],
          opacity: [0.7, 1, 0.7],
        };
      case 'speaking':
        return {
          scale: [1, 1.12, 1.05, 1.15, 1],
          opacity: [0.85, 1, 0.9, 1, 0.85],
        };
      case 'muted':
        return {
          scale: 0.85,
          opacity: 0.4,
        };
    }
  };

  // Transition config for each state
  const getTransition = () => {
    switch (state) {
      case 'idle':
        return {
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        };
      case 'listening':
        return {
          duration: 0.1,
          ease: 'linear' as const,
        };
      case 'processing':
        return {
          duration: 0.8,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        };
      case 'speaking':
        return {
          duration: 0.6,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        };
      case 'muted':
        return {
          duration: 0.3,
          ease: 'easeOut' as const,
        };
    }
  };

  const config = stateConfig[state];
  const glowSize = size * 1.6;

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size * 2, height: size * 2 }}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel || stateDescriptions[state]}
      aria-busy={state === 'processing'}
    >
      {/* Outer glow layer */}
      <motion.div
        className={cn(
          'absolute rounded-full blur-3xl',
          config.glowColor
        )}
        style={{ width: glowSize, height: glowSize }}
        animate={getAnimation()}
        transition={getTransition()}
      />

      {/* Middle glow layer */}
      <motion.div
        className={cn(
          'absolute rounded-full blur-xl',
          config.glowColor
        )}
        style={{ width: size * 1.3, height: size * 1.3 }}
        animate={getAnimation()}
        transition={{
          ...getTransition(),
          delay: 0.1,
        }}
      />

      {/* Main orb */}
      <motion.div
        className={cn(
          'relative rounded-full bg-gradient-to-br shadow-2xl',
          config.color,
          config.shadow
        )}
        style={{ width: size, height: size }}
        animate={getAnimation()}
        transition={getTransition()}
      >
        {/* Inner highlight */}
        <div
          className="absolute top-4 left-4 w-1/3 h-1/3 rounded-full bg-white/30 blur-sm"
        />

        {/* Center bright spot */}
        <div
          className="absolute top-1/4 left-1/4 w-1/4 h-1/4 rounded-full bg-white/20 blur-md"
        />
      </motion.div>

      {/* State label (optional, for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute -bottom-8 text-xs text-muted-foreground capitalize">
          {state}
        </div>
      )}

      {/* Screen reader only text for state changes */}
      <span className="sr-only">
        {stateDescriptions[state]}
        {state === 'listening' && audioLevel > 0.5 && ' - Voice detected'}
      </span>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const BreathingOrb = memo(BreathingOrbComponent);

/**
 * Helper hook to get the appropriate orb state based on app state
 */
export function getOrbState(options: {
  isMuted: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
}): OrbState {
  const { isMuted, isRecording, isTranscribing, isSpeaking } = options;

  if (isMuted) return 'muted';
  if (isSpeaking) return 'speaking';
  if (isTranscribing) return 'processing';
  if (isRecording) return 'listening';
  return 'idle';
}

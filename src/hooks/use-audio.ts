'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  float32ArrayToWav,
  calculateRMSLevel,
  mergeAudioChunks,
  findReSpeakerDevice,
  type AudioDeviceInfo,
} from '@/lib/audio';

export type AudioState = 'idle' | 'requesting' | 'recording' | 'error';

export interface UseAudioOptions {
  /** Target sample rate for Whisper (default: 16000) */
  sampleRate?: number;
  /** Preferred device ID (optional) */
  deviceId?: string;
  /** Use ReSpeaker hardware processing if available */
  useReSpeakerOptimizations?: boolean;
  /** Audio level update interval in ms (default: 50) */
  levelUpdateInterval?: number;
}

export interface UseAudioReturn {
  /** Current audio state */
  state: AudioState;
  /** Current audio level (0-1) */
  audioLevel: number;
  /** Error message if state is 'error' */
  error: string | null;
  /** Whether recording is active */
  isRecording: boolean;
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and get audio blob */
  stopRecording: () => Promise<Blob | null>;
  /** Get current audio data without stopping */
  getAudioData: () => Float32Array | null;
  /** Available audio devices */
  devices: AudioDeviceInfo[];
  /** Currently selected device */
  selectedDevice: AudioDeviceInfo | null;
  /** Select a different device */
  selectDevice: (deviceId: string) => void;
  /** Refresh device list */
  refreshDevices: () => Promise<void>;
}

export function useAudio(options: UseAudioOptions = {}): UseAudioReturn {
  const {
    sampleRate = 16000,
    deviceId,
    useReSpeakerOptimizations = true,
    levelUpdateInterval = 50,
  } = options;

  const [state, setState] = useState<AudioState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<AudioDeviceInfo | null>(
    null
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
    deviceId
  );

  // Refs for audio processing
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const levelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Refresh available audio devices
   */
  const refreshDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: d.kind as MediaDeviceKind,
        }));
      setDevices(audioInputs);

      // Auto-select ReSpeaker if available and enabled
      if (useReSpeakerOptimizations && !selectedDeviceId) {
        const respeaker = await findReSpeakerDevice();
        if (respeaker) {
          setSelectedDevice(respeaker);
          setSelectedDeviceId(respeaker.deviceId);
        }
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }, [useReSpeakerOptimizations, selectedDeviceId]);

  /**
   * Select a different audio device
   */
  const selectDevice = useCallback(
    (newDeviceId: string) => {
      const device = devices.find((d) => d.deviceId === newDeviceId);
      if (device) {
        setSelectedDevice(device);
        setSelectedDeviceId(newDeviceId);
      }
    },
    [devices]
  );

  /**
   * Start audio level monitoring
   */
  const startLevelMonitoring = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Float32Array(analyser.fftSize);

    const updateLevel = () => {
      analyser.getFloatTimeDomainData(dataArray);
      const level = calculateRMSLevel(dataArray);
      // Apply some smoothing and scaling for better visual feedback
      setAudioLevel((prev) => prev * 0.7 + level * 0.3 * 3);
    };

    levelIntervalRef.current = setInterval(updateLevel, levelUpdateInterval);
  }, [levelUpdateInterval]);

  /**
   * Stop audio level monitoring
   */
  const stopLevelMonitoring = useCallback(() => {
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    if (state === 'recording') return;

    setState('requesting');
    setError(null);
    audioChunksRef.current = [];

    try {
      // Determine if we should use ReSpeaker optimizations
      const isReSpeaker =
        selectedDevice?.label.toLowerCase().includes('respeaker') ||
        selectedDevice?.label.toLowerCase().includes('xvf');

      // Configure audio constraints
      // ReSpeaker XVF3800 handles echo cancellation/noise suppression in hardware
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: !isReSpeaker, // Disable if ReSpeaker handles it
        noiseSuppression: !isReSpeaker,
        autoGainControl: !isReSpeaker,
        channelCount: 1,
        sampleRate: { ideal: sampleRate },
      };

      // Only add deviceId if we have one selected
      if (selectedDeviceId) {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }

      const constraints: MediaStreamConstraints = {
        audio: audioConstraints,
      };

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate });
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Create analyser for visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      // Use ScriptProcessorNode for audio capture (simpler than AudioWorklet)
      // Note: ScriptProcessorNode is deprecated but widely supported
      // For production, consider migrating to AudioWorkletNode
      const bufferSize = 4096;
      const scriptProcessor = audioContextRef.current.createScriptProcessor(
        bufferSize,
        1,
        1
      );

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        // Clone the data since the buffer gets reused
        const chunk = new Float32Array(inputData.length);
        chunk.set(inputData);
        audioChunksRef.current.push(chunk);
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContextRef.current.destination);

      // Start level monitoring
      startLevelMonitoring();

      setState('recording');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      setState('error');
      console.error('Audio recording error:', err);
    }
  }, [
    state,
    selectedDeviceId,
    selectedDevice,
    sampleRate,
    startLevelMonitoring,
  ]);

  /**
   * Stop recording and return audio as WAV blob
   */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (state !== 'recording') return null;

    stopLevelMonitoring();

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Merge all audio chunks
    const allAudio = mergeAudioChunks(audioChunksRef.current);
    audioChunksRef.current = [];

    setState('idle');

    if (allAudio.length === 0) {
      return null;
    }

    // Convert to WAV
    return float32ArrayToWav(allAudio, sampleRate);
  }, [state, sampleRate, stopLevelMonitoring]);

  /**
   * Get current audio data without stopping recording
   */
  const getAudioData = useCallback((): Float32Array | null => {
    if (audioChunksRef.current.length === 0) return null;
    return mergeAudioChunks(audioChunksRef.current);
  }, []);

  // Initialize devices on mount
  useEffect(() => {
    let mounted = true;

    const initDevices = async () => {
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        if (!mounted) return;

        const audioInputs = deviceList
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
            kind: d.kind as MediaDeviceKind,
          }));
        setDevices(audioInputs);

        // Auto-select ReSpeaker if available and enabled
        if (useReSpeakerOptimizations && !selectedDeviceId) {
          const respeaker = audioInputs.find(
            (d) =>
              d.label.toLowerCase().includes('respeaker') ||
              d.label.toLowerCase().includes('xvf')
          );
          if (respeaker) {
            setSelectedDevice(respeaker);
            setSelectedDeviceId(respeaker.deviceId);
          }
        }
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }
    };

    initDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      if (mounted) {
        initDevices();
      }
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        handleDeviceChange
      );
    };
  }, [useReSpeakerOptimizations, selectedDeviceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLevelMonitoring();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopLevelMonitoring]);

  return {
    state,
    audioLevel,
    error,
    isRecording: state === 'recording',
    startRecording,
    stopRecording,
    getAudioData,
    devices,
    selectedDevice,
    selectDevice,
    refreshDevices,
  };
}

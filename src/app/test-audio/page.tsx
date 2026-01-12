'use client';

import {
  AudioVisualizer,
  AudioLevelMeter,
} from '@/components/audio-visualizer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAudio } from '@/hooks/use-audio';

export default function TestAudioPage() {
  const {
    state,
    audioLevel,
    error,
    isRecording,
    startRecording,
    stopRecording,
    devices,
    selectedDevice,
    selectDevice,
  } = useAudio();

  const handleToggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Audio Capture Test</h1>

      <div className="grid gap-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Current audio capture state</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="font-medium">State:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    state === 'recording'
                      ? 'bg-green-100 text-green-800'
                      : state === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {state}
                </span>
              </div>
              {error && (
                <div className="text-red-600 text-sm">Error: {error}</div>
              )}
              <div className="flex items-center gap-4">
                <span className="font-medium">Audio Level:</span>
                <span>{(audioLevel * 100).toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Device Selection</CardTitle>
            <CardDescription>Choose your microphone</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedDevice?.deviceId || 'default'}
              onValueChange={(val) => val !== 'default' && selectDevice(val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a microphone" />
              </SelectTrigger>
              <SelectContent>
                {devices
                  .filter((device) => device.deviceId) // Filter out empty deviceIds
                  .map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                {devices.filter((d) => d.deviceId).length === 0 && (
                  <SelectItem value="default" disabled>
                    No devices available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {devices.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No devices found. Click &quot;Start Recording&quot; to request
                microphone permission.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleToggleRecording}
              variant={isRecording ? 'destructive' : 'default'}
              size="lg"
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Button>
          </CardContent>
        </Card>

        {/* Visualizers */}
        <Card>
          <CardHeader>
            <CardTitle>Visualizers</CardTitle>
            <CardDescription>Real-time audio level display</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Level Meter */}
              <div>
                <h3 className="text-sm font-medium mb-2">Level Meter</h3>
                <AudioLevelMeter audioLevel={audioLevel} isActive={isRecording} />
              </div>

              {/* Bars Visualizer */}
              <div>
                <h3 className="text-sm font-medium mb-2">Bars Style</h3>
                <AudioVisualizer
                  audioLevel={audioLevel}
                  isActive={isRecording}
                  style="bars"
                  width={300}
                  height={60}
                  barCount={20}
                  className="bg-zinc-900 p-2"
                />
              </div>

              {/* Waveform Visualizer */}
              <div>
                <h3 className="text-sm font-medium mb-2">Waveform Style</h3>
                <AudioVisualizer
                  audioLevel={audioLevel}
                  isActive={isRecording}
                  style="waveform"
                  width={300}
                  height={60}
                  className="bg-zinc-900 p-2"
                />
              </div>

              {/* Circle Visualizer */}
              <div>
                <h3 className="text-sm font-medium mb-2">Circle Style</h3>
                <AudioVisualizer
                  audioLevel={audioLevel}
                  isActive={isRecording}
                  style="circle"
                  width={120}
                  height={120}
                  className="bg-zinc-900 p-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

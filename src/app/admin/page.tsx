"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LockKeyhole,
  Settings,
  Volume2,
  Clock,
  Mic,
  LogOut,
  Save,
  RotateCcw,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface SettingsData {
  responseLength: string;
  voiceSpeed: string;
  wakeWord: string;
  retentionDays: string;
  ttsEnabled: string;
  autoTranscribe: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  responseLength: "detailed",
  voiceSpeed: "normal",
  wakeWord: "hey assistant",
  retentionDays: "90",
  ttsEnabled: "true",
  autoTranscribe: "true",
};

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(DEFAULT_SETTINGS);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin");
        const data = await response.json();
        setIsAuthenticated(data.authenticated);

        if (data.authenticated) {
          await loadSettings();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setOriginalSettings(data);
        setHasChanges(false);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings");
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(true);
        setPin("");
        await loadSettings();
        toast.success("Welcome to Admin Settings");
      } else {
        setPinError(data.error || "Invalid PIN");
      }
    } catch {
      setPinError("Authentication failed");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin", { method: "DELETE" });
      setIsAuthenticated(false);
      setSettings(DEFAULT_SETTINGS);
      router.refresh();
      toast.success("Logged out successfully");
    } catch {
      toast.error("Logout failed");
    }
  };

  const updateSetting = useCallback((key: keyof SettingsData, value: string) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };
      setHasChanges(JSON.stringify(newSettings) !== JSON.stringify(originalSettings));
      return newSettings;
    });
  }, [originalSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setOriginalSettings(settings);
        setHasChanges(false);
        toast.success("Settings saved successfully");
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const response = await fetch("/api/settings", { method: "DELETE" });
      if (response.ok) {
        const data = await response.json();
        setSettings(data.defaults);
        setOriginalSettings(data.defaults);
        setHasChanges(false);
        toast.success("Settings reset to defaults");
      } else {
        throw new Error("Failed to reset");
      }
    } catch {
      toast.error("Failed to reset settings");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // PIN Entry Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <LockKeyhole className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter your PIN to access settings</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ""));
                    setPinError("");
                  }}
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
                {pinError && (
                  <p className="text-sm text-destructive">{pinError}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={pin.length < 4}>
                <Shield className="mr-2 h-4 w-4" />
                Unlock
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Settings Dashboard
  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Admin Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure your AI Meeting Assistant
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Response Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Response Settings
            </CardTitle>
            <CardDescription>
              Control how the AI responds to questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="responseLength">Response Length</Label>
                <Select
                  value={settings.responseLength}
                  onValueChange={(value) => updateSetting("responseLength", value)}
                >
                  <SelectTrigger id="responseLength">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Brief</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Brief: 2-3 sentences. Detailed: comprehensive responses.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoTranscribe">Auto Transcribe</Label>
                <Select
                  value={settings.autoTranscribe}
                  onValueChange={(value) => updateSetting("autoTranscribe", value)}
                >
                  <SelectTrigger id="autoTranscribe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Automatically transcribe audio when recording.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Voice Settings
            </CardTitle>
            <CardDescription>
              Configure text-to-speech and wake word
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ttsEnabled">Text-to-Speech</Label>
                <Select
                  value={settings.ttsEnabled}
                  onValueChange={(value) => updateSetting("ttsEnabled", value)}
                >
                  <SelectTrigger id="ttsEnabled">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Speak AI responses aloud.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voiceSpeed">Voice Speed</Label>
                <Select
                  value={settings.voiceSpeed}
                  onValueChange={(value) => updateSetting("voiceSpeed", value)}
                >
                  <SelectTrigger id="voiceSpeed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow (0.8x)</SelectItem>
                    <SelectItem value="normal">Normal (1.0x)</SelectItem>
                    <SelectItem value="fast">Fast (1.2x)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Adjust the speech rate for TTS.
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="wakeWord" className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Wake Word
              </Label>
              <Input
                id="wakeWord"
                value={settings.wakeWord}
                onChange={(e) => updateSetting("wakeWord", e.target.value)}
                placeholder="hey assistant"
              />
              <p className="text-xs text-muted-foreground">
                The phrase that activates the assistant. Requires Porcupine
                configuration.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Data & Privacy
            </CardTitle>
            <CardDescription>
              Manage data retention and storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="retentionDays">Recording Retention (Days)</Label>
              <Input
                id="retentionDays"
                type="number"
                min="1"
                max="365"
                value={settings.retentionDays}
                onChange={(e) => updateSetting("retentionDays", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Automatically delete meeting recordings older than this many
                days. Set to 0 for indefinite retention.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {hasChanges && (
          <p className="text-sm text-muted-foreground text-center">
            You have unsaved changes
          </p>
        )}
      </div>
    </div>
  );
}

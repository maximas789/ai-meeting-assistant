import { db } from "@/lib/db";
import { settings } from "@/lib/schema";

// Settings types
export interface SettingsValues {
  responseLength: "brief" | "detailed";
  voiceSpeed: "slow" | "normal" | "fast";
  wakeWord: string;
  retentionDays: number;
  ttsEnabled: boolean;
  autoTranscribe: boolean;
}

// Default settings values
export const DEFAULT_SETTINGS: SettingsValues = {
  responseLength: "detailed",
  voiceSpeed: "normal",
  wakeWord: "hey assistant",
  retentionDays: 90,
  ttsEnabled: true,
  autoTranscribe: true,
};

export type SettingsKey = keyof SettingsValues;

// Settings cache for improved performance
// Cache expires after 30 seconds to balance performance and freshness
const CACHE_TTL_MS = 30 * 1000;
let settingsCache: SettingsValues | null = null;
let cacheTimestamp = 0;

/**
 * Check if the cache is still valid
 */
function isCacheValid(): boolean {
  return settingsCache !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

/**
 * Get all settings from the database, merged with defaults.
 * Uses caching for improved performance.
 */
export async function getSettings(): Promise<SettingsValues> {
  // Return cached settings if still valid
  if (isCacheValid() && settingsCache) {
    return settingsCache;
  }

  try {
    const allSettings = await db.select().from(settings);
    const result: SettingsValues = { ...DEFAULT_SETTINGS };

    for (const setting of allSettings) {
      const key = setting.key as SettingsKey;
      const value = setting.value;

      if (value === null) continue;

      switch (key) {
        case "responseLength":
          if (value === "brief" || value === "detailed") {
            result.responseLength = value;
          }
          break;
        case "voiceSpeed":
          if (value === "slow" || value === "normal" || value === "fast") {
            result.voiceSpeed = value;
          }
          break;
        case "wakeWord":
          result.wakeWord = value;
          break;
        case "retentionDays": {
          const days = parseInt(value, 10);
          if (!isNaN(days) && days > 0) {
            result.retentionDays = days;
          }
          break;
        }
        case "ttsEnabled":
          result.ttsEnabled = value === "true";
          break;
        case "autoTranscribe":
          result.autoTranscribe = value === "true";
          break;
      }
    }

    // Update cache
    settingsCache = result;
    cacheTimestamp = Date.now();

    return result;
  } catch (error) {
    console.error("Failed to get settings, using defaults:", error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Invalidate the settings cache.
 * Call this after updating settings.
 */
export function invalidateSettingsCache(): void {
  settingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Get a specific setting value
 */
export async function getSetting<K extends SettingsKey>(
  key: K
): Promise<SettingsValues[K]> {
  const allSettings = await getSettings();
  return allSettings[key];
}

/**
 * Get the system prompt modifier based on response length setting
 */
export function getResponseLengthPrompt(length: "brief" | "detailed"): string {
  if (length === "brief") {
    return "Keep your responses concise and to the point. Use bullet points when appropriate. Aim for 2-3 sentences maximum unless more detail is explicitly requested.";
  }
  return "Provide detailed and comprehensive responses. Include relevant context and examples when helpful.";
}

/**
 * Get the voice speed multiplier for TTS
 */
export function getVoiceSpeedMultiplier(speed: "slow" | "normal" | "fast"): number {
  switch (speed) {
    case "slow":
      return 0.8;
    case "fast":
      return 1.2;
    default:
      return 1.0;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { settings } from "@/lib/schema";
import { invalidateSettingsCache } from "@/lib/settings";

// Default settings values
const DEFAULT_SETTINGS: Record<string, string> = {
  responseLength: "detailed",
  voiceSpeed: "normal",
  wakeWord: "hey assistant",
  retentionDays: "90",
  ttsEnabled: "true",
  autoTranscribe: "true",
};

/**
 * GET /api/settings - Get all settings
 * Returns settings merged with defaults
 */
export async function GET() {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const allSettings = await db.select().from(settings);
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };

    for (const setting of allSettings) {
      if (setting.value !== null) {
        settingsMap[setting.key] = setting.value;
      }
    }

    return NextResponse.json(settingsMap);
  } catch (error) {
    console.error("Failed to get settings:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings - Update settings
 * Accepts a JSON object with key-value pairs to update
 */
export async function PUT(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const updates = await request.json();

    if (typeof updates !== "object" || updates === null) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Validate and update each setting
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        continue;
      }

      const stringValue = String(value);

      // Check if setting exists
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (existing.length > 0) {
        // Update existing setting
        await db
          .update(settings)
          .set({ value: stringValue, updatedAt: new Date() })
          .where(eq(settings.key, key));
      } else {
        // Insert new setting
        await db.insert(settings).values({
          key,
          value: stringValue,
        });
      }
    }

    // Invalidate cache after updating settings
    invalidateSettingsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings - Reset settings to defaults
 */
export async function DELETE() {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Delete all custom settings
    await db.delete(settings);

    // Invalidate cache after resetting settings
    invalidateSettingsCache();

    return NextResponse.json({ success: true, defaults: DEFAULT_SETTINGS });
  } catch (error) {
    console.error("Failed to reset settings:", error);
    return NextResponse.json(
      { error: "Failed to reset settings" },
      { status: 500 }
    );
  }
}

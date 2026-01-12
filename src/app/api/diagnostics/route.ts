import { NextResponse } from "next/server";

type StatusLevel = "ok" | "warn" | "error";

interface DiagnosticsResponse {
  timestamp: string;
  env: {
    POSTGRES_URL: boolean;
    OLLAMA_BASE_URL: boolean;
    OLLAMA_MODEL: boolean;
    NEXT_PUBLIC_APP_URL: boolean;
  };
  database: {
    connected: boolean;
    schemaApplied: boolean;
    error?: string;
  };
  ollama: {
    configured: boolean;
    reachable: boolean | null;
  };
  overallStatus: StatusLevel;
}

// This endpoint is intentionally public (no auth required) because it's used
// by the setup checklist on the homepage.
// It only returns boolean flags about configuration status, not sensitive data.
export async function GET() {
  const env = {
    POSTGRES_URL: Boolean(process.env.POSTGRES_URL),
    OLLAMA_BASE_URL: Boolean(process.env.OLLAMA_BASE_URL),
    OLLAMA_MODEL: Boolean(process.env.OLLAMA_MODEL),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  } as const;

  // Database checks with timeout
  let dbConnected = false;
  let schemaApplied = false;
  let dbError: string | undefined;
  if (env.POSTGRES_URL) {
    try {
      // Add timeout to prevent hanging on unreachable database
      const dbCheckPromise = (async () => {
        const [{ db }, { sql }, schema] = await Promise.all([
          import("@/lib/db"),
          import("drizzle-orm"),
          import("@/lib/schema"),
        ]);

        // Ping DB - this will actually attempt to connect
        const result = await db.execute(sql`SELECT 1 as ping`);
        if (!result) {
          throw new Error("Database query returned no result");
        }
        dbConnected = true;

        try {
          // Touch a known table to verify migrations
          await db.select().from(schema.meetings).limit(1);
          schemaApplied = true;
        } catch {
          schemaApplied = false;
          // If we can't query the meetings table, it's likely migrations haven't run
          if (!dbError) {
            dbError = "Schema not applied. Run: pnpm run db:migrate";
          }
        }
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Database connection timeout (5s)")),
          5000
        )
      );

      await Promise.race([dbCheckPromise, timeoutPromise]);
    } catch {
      dbConnected = false;
      schemaApplied = false;

      // Provide user-friendly error messages
      dbError =
        "Database not connected. Please start your PostgreSQL database and verify your POSTGRES_URL in .env";
    }
  } else {
    dbConnected = false;
    schemaApplied = false;
    dbError = "POSTGRES_URL is not set";
  }

  // Check if Ollama is reachable
  let ollamaReachable: boolean | null = null;
  const ollamaBaseUrl =
    process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  try {
    const res = await fetch(`${ollamaBaseUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
    });
    ollamaReachable = res.ok;
  } catch {
    ollamaReachable = false;
  }

  const ollamaConfigured = env.OLLAMA_BASE_URL || ollamaReachable === true;

  const overallStatus: StatusLevel = (() => {
    if (!env.POSTGRES_URL || !dbConnected || !schemaApplied) return "error";
    // Ollama is important but not strictly required for basic operation
    if (!ollamaReachable) return "warn";
    return "ok";
  })();

  const body: DiagnosticsResponse = {
    timestamp: new Date().toISOString(),
    env,
    database: {
      connected: dbConnected,
      schemaApplied,
      ...(dbError !== undefined && { error: dbError }),
    },
    ollama: {
      configured: ollamaConfigured,
      reachable: ollamaReachable,
    },
    overallStatus,
  };

  return NextResponse.json(body, {
    status: 200,
  });
}

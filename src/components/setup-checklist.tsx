"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type DiagnosticsResponse = {
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
  overallStatus: "ok" | "warn" | "error";
};

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <div title="ok">
      <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="ok" />
    </div>
  ) : (
    <div title="not ok">
      <XCircle className="h-4 w-4 text-red-600" aria-label="not-ok" />
    </div>
  );
}

export function SetupChecklist() {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnostics", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DiagnosticsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const steps = [
    {
      key: "env",
      label: "Environment variables",
      ok: !!data?.env.POSTGRES_URL,
      detail: "Requires POSTGRES_URL for database connection",
    },
    {
      key: "db",
      label: "Database connected & schema",
      ok: !!data?.database.connected && !!data?.database.schemaApplied,
      detail: data?.database.error
        ? `Error: ${data.database.error}`
        : undefined,
    },
    {
      key: "ollama",
      label: "Ollama LLM",
      ok: !!data?.ollama.reachable,
      detail: !data?.ollama.reachable
        ? "Start Ollama with: ollama serve"
        : "Ollama is running",
    },
  ] as const;

  const completed = steps.filter((s) => s.ok).length;

  return (
    <div className="p-6 border rounded-lg text-left">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Setup checklist</h3>
          <p className="text-sm text-muted-foreground">
            {completed}/{steps.length} completed
          </p>
        </div>
        <Button size="sm" onClick={load} disabled={loading}>
          {loading ? "Checking..." : "Re-check"}
        </Button>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-2">
            <div className="mt-0.5">
              <StatusIcon ok={Boolean(s.ok)} />
            </div>
            <div>
              <div className="font-medium">{s.label}</div>
              {s.detail ? (
                <div className="text-sm text-muted-foreground">{s.detail}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {data ? (
        <div className="mt-4 text-xs text-muted-foreground">
          Last checked: {new Date(data.timestamp).toLocaleString()}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

type ServiceStatus = {
  whisper: boolean;
  piper: boolean;
  chromadb: boolean;
  ollama: boolean;
  database: boolean;
};

type UseDiagnosticsOptions = {
  /** Enable automatic polling for service status */
  autoReconnect?: boolean;
  /** Polling interval in milliseconds (default: 30000) */
  pollInterval?: number;
  /** Faster polling interval when services are down (default: 5000) */
  reconnectInterval?: number;
  /** Callback when a service recovers */
  onServiceRecovered?: (serviceName: keyof ServiceStatus) => void;
  /** Callback when a service goes down */
  onServiceDown?: (serviceName: keyof ServiceStatus) => void;
};

export function useDiagnostics(options: UseDiagnosticsOptions = {}) {
  const {
    autoReconnect = false,
    pollInterval = 30000,
    reconnectInterval = 5000,
    onServiceRecovered,
    onServiceDown,
  } = options;

  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    whisper: true,
    piper: true,
    chromadb: true,
    ollama: true,
    database: true,
  });
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Track previous service status for change detection
  const prevStatusRef = useRef<ServiceStatus | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnostics", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DiagnosticsResponse;
      setData(json);
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diagnostics");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check individual service health
   */
  const checkServiceHealth = useCallback(async (): Promise<ServiceStatus> => {
    const status: ServiceStatus = {
      whisper: false,
      piper: false,
      chromadb: false,
      ollama: false,
      database: false,
    };

    // Check all services in parallel
    const checks = await Promise.allSettled([
      // Whisper
      fetch("/api/transcribe", { method: "GET" })
        .then((r) => r.ok)
        .catch(() => false),
      // Piper
      fetch("/api/speak", { method: "GET" })
        .then((r) => r.ok)
        .catch(() => false),
      // Diagnostics for Ollama and Database
      fetchDiagnostics(),
    ]);

    // Whisper
    if (checks[0].status === "fulfilled") {
      status.whisper = checks[0].value as boolean;
    }

    // Piper
    if (checks[1].status === "fulfilled") {
      status.piper = checks[1].value as boolean;
    }

    // Ollama and Database from diagnostics
    if (checks[2].status === "fulfilled" && checks[2].value) {
      const diagData = checks[2].value;
      status.ollama = Boolean(diagData.ollama?.reachable);
      status.database = Boolean(
        diagData.database?.connected && diagData.database?.schemaApplied
      );
      // ChromaDB is checked via documents API
      try {
        const chromaRes = await fetch("/api/documents", { method: "GET" });
        status.chromadb = chromaRes.ok;
      } catch {
        status.chromadb = false;
      }
    }

    return status;
  }, [fetchDiagnostics]);

  /**
   * Update service status and trigger callbacks
   */
  const updateServiceStatus = useCallback(
    (newStatus: ServiceStatus) => {
      const prevStatus = prevStatusRef.current;

      if (prevStatus) {
        // Check for status changes
        for (const key of Object.keys(newStatus) as (keyof ServiceStatus)[]) {
          if (!prevStatus[key] && newStatus[key]) {
            // Service recovered
            onServiceRecovered?.(key);
          } else if (prevStatus[key] && !newStatus[key]) {
            // Service went down
            onServiceDown?.(key);
          }
        }
      }

      prevStatusRef.current = newStatus;
      setServiceStatus(newStatus);
    },
    [onServiceRecovered, onServiceDown]
  );

  /**
   * Poll for service status
   */
  const pollServices = useCallback(async () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    setIsReconnecting(true);
    const status = await checkServiceHealth();
    updateServiceStatus(status);
    setIsReconnecting(false);

    // Determine next poll interval
    const anyServiceDown = Object.values(status).some((s) => !s);
    const interval = anyServiceDown ? reconnectInterval : pollInterval;

    if (autoReconnect) {
      pollTimeoutRef.current = setTimeout(pollServices, interval);
    }
  }, [
    autoReconnect,
    pollInterval,
    reconnectInterval,
    checkServiceHealth,
    updateServiceStatus,
  ]);

  /**
   * Manually trigger reconnection check
   */
  const checkAndReconnect = useCallback(async () => {
    setIsReconnecting(true);
    const status = await checkServiceHealth();
    updateServiceStatus(status);
    setIsReconnecting(false);
    return status;
  }, [checkServiceHealth, updateServiceStatus]);

  // Initial fetch and start polling
  useEffect(() => {
    fetchDiagnostics().then(() => {
      if (autoReconnect) {
        pollServices();
      }
    });

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [fetchDiagnostics, autoReconnect, pollServices]);

  const isDatabaseReady =
    data?.database.connected && data?.database.schemaApplied;
  const isOllamaReady = data?.ollama.reachable;

  // Check if all critical services are available
  const allServicesReady =
    serviceStatus.ollama && serviceStatus.database && serviceStatus.whisper;

  return {
    data,
    loading,
    error,
    refetch: fetchDiagnostics,
    isDatabaseReady: Boolean(isDatabaseReady),
    isOllamaReady: Boolean(isOllamaReady),
    // Service status
    serviceStatus,
    allServicesReady,
    isReconnecting,
    checkAndReconnect,
    // Legacy compatibility
    isAuthReady: Boolean(isDatabaseReady),
    isAiReady: Boolean(isOllamaReady),
  };
}

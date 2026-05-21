import { useEffect, useRef, useState } from "react";

interface Options {
  token?: string;
  onMessage?: (data: unknown) => void;
  fallback?: () => void;
}

export type WSStatus = "connecting" | "open" | "closed" | "fallback";

/**
 * useWebSocket — connects to ws://localhost:8080/api/ws/flights
 * Adds Bearer token via Sec-WebSocket-Protocol (browser-safe handshake auth).
 * Auto-falls back to simulation mode if the socket cannot be reached.
 */
export function useWebSocket(url: string, opts: Options = {}) {
  const [status, setStatus] = useState<WSStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(opts.onMessage);
  const fallbackRef = useRef(opts.fallback);
  onMessageRef.current = opts.onMessage;
  fallbackRef.current = opts.fallback;

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const protocols = opts.token
        ? ["bearer", opts.token]
        : undefined;
      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;

      // If we don't connect within 1.5s, drop into fallback mode
      fallbackTimer = setTimeout(() => {
        if (!cancelled && ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setStatus("fallback");
          fallbackRef.current?.();
        }
      }, 1500);

      ws.onopen = () => {
        if (cancelled) return;
        setStatus("open");
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
      ws.onmessage = (ev) => {
        try {
          onMessageRef.current?.(JSON.parse(ev.data));
        } catch {
          onMessageRef.current?.(ev.data);
        }
      };
      ws.onerror = () => {
        if (cancelled) return;
        setStatus("fallback");
        fallbackRef.current?.();
      };
      ws.onclose = () => {
        if (cancelled) return;
        if (status !== "fallback") setStatus("closed");
      };
    } catch {
      setStatus("fallback");
      fallbackRef.current?.();
    }

    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, opts.token]);

  return { status };
}

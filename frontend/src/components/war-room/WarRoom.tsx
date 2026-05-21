import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Lock, LogOut, Terminal, X, Zap } from "lucide-react";
import { useWebSockets, type WebSocketMessage } from "@/hooks/useWebSockets";
import { tickFlights, type FlightTick } from "@/lib/flight-simulator";
import {
  classify_aviation_threat,
  severityOf,
  type ThreatLabel,
} from "@/lib/threat-classifier";
import { WarRoomMap } from "@/components/war-room/WarRoomMap";
import { IncidentFeed, type IncidentLog } from "@/components/war-room/IncidentFeed";
import { TelemetryPanel } from "@/components/war-room/TelemetryPanel";
import TelemetryCharts from "@/components/TelemetryCharts";
import type { AltPoint } from "@/components/war-room/AltitudeChart";
import { useAuth } from "@/lib/auth";
import { IntelPanel } from "@/components/war-room/IntelPanel";
import { evaluateBatch, type IntelEvent } from "@/lib/intelligence-engine";

interface DeltaSample {
  distance_delta: number;
  time_delta: number;
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface WarRoomProps {
  variant?: "full" | "map-only";
}

export function WarRoom({ variant = "full" }: WarRoomProps) {
  const { user, logout } = useAuth();
  const [flights, setFlights] = useState<FlightTick[]>([]);
  const [threats, setThreats] = useState<Record<string, ThreatLabel>>({});
  const [logs, setLogs] = useState<IncidentLog[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [altHistory, setAltHistory] = useState<Record<string, AltPoint[]>>({});
  const [ghostPaths, setGhostPaths] = useState<Record<string, [number, number][]>>({});
  const [trails, setTrails] = useState<Record<string, [number, number][]>>({});
  const [traffic, setTraffic] = useState<Record<string, WebSocketMessage>>({});
  const [focusTarget, setFocusTarget] = useState<{ callsign: string; ts: number } | null>(null);
  const [intelEvents, setIntelEvents] = useState<IntelEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxPayload, setSandboxPayload] = useState("");
  const [sandboxStatus, setSandboxStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Vertical splitter between top row (Panels 01/02/03) and bottom row (Panel 04)
  const splitContainerRef = useRef<HTMLElement | null>(null);
  const [topPct, setTopPct] = useState(62);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setTopPct(Math.min(82, Math.max(28, pct)));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const focusFlight = useCallback((cs: string) => {
    setSelected(cs);
    setFocusTarget({ callsign: cs, ts: Date.now() });
  }, []);

  const lastSampleRef = useRef<Record<string, { lat: number; lon: number; t: number }>>({});
  const deltaHistoryRef = useRef<Record<string, DeltaSample[]>>({});
  const lastLabelRef = useRef<Record<string, ThreatLabel>>({});

  const processTick = useCallback((incoming: FlightTick[]) => {
    const t = Date.now();
    setFlights(incoming);
    setNow(t);

    // Backend intelligence engine — Isolation Forest + Dynamics + MITRE
    try {
      const events = evaluateBatch(incoming);
      if (events.length) setIntelEvents((prev) => [...events.reverse(), ...prev].slice(0, 80));
    } catch (err) {
      console.warn(`[ML] engine error: ${(err as Error).message}`);
    }

    setThreats((prevThreats) => {
      const nextThreats = { ...prevThreats };
      const newLogs: IncidentLog[] = [];
      const ghostUpdates: Record<string, [number, number][]> = {};
      const altUpdates: Record<string, AltPoint[]> = {};

      incoming.forEach((f) => {
        const last = lastSampleRef.current[f.callsign];
        let label: ThreatLabel = "NORMAL";
        if (last) {
          const dist = haversineKm([last.lat, last.lon], [f.lat, f.lon]);
          const dt = (t - last.t) / 1000;
          const sample = { distance_delta: dist, time_delta: dt };
          const hist = deltaHistoryRef.current[f.callsign] ?? [];
          label = classify_aviation_threat(dist, dt, hist);
          deltaHistoryRef.current[f.callsign] = [...hist.slice(-9), sample];
        }
        lastSampleRef.current[f.callsign] = { lat: f.lat, lon: f.lon, t };
        nextThreats[f.callsign] = label;

        const prevAlt = altHistory[f.callsign] ?? [];
        altUpdates[f.callsign] = [
          ...prevAlt.slice(-39),
          { t, reported: f.altitude, projected: f.projected_altitude },
        ];

        if (label.startsWith("MITRE")) {
          const prev = ghostPaths[f.callsign] ?? [];
          ghostUpdates[f.callsign] = [...prev.slice(-30), [f.lon, f.lat]];
        }

        const lastLabel = lastLabelRef.current[f.callsign];
        if (lastLabel !== label) {
          newLogs.push(buildLog(f, label));
          lastLabelRef.current[f.callsign] = label;
        }
      });

      // breadcrumb trail update for every aircraft
      const trailUpdates: Record<string, [number, number][]> = {};
      incoming.forEach((f) => {
        const prev = trails[f.callsign] ?? [];
        const lastPt = prev[prev.length - 1];
        if (!lastPt || lastPt[0] !== f.lon || lastPt[1] !== f.lat) {
          trailUpdates[f.callsign] = [...prev.slice(-29), [f.lon, f.lat]];
        }
      });

      if (Object.keys(altUpdates).length) setAltHistory((p) => ({ ...p, ...altUpdates }));
      if (Object.keys(ghostUpdates).length) setGhostPaths((p) => ({ ...p, ...ghostUpdates }));
      if (Object.keys(trailUpdates).length) setTrails((p) => ({ ...p, ...trailUpdates }));
      if (newLogs.length) setLogs((p) => [...newLogs.reverse(), ...p].slice(0, 150));
      return nextThreats;
    });

    setTraffic((prev) => {
      const next = { ...prev };
      incoming.forEach((f) => {
        next[f.callsign] = {
          icao24: f.callsign,
          packet: {
            timestamp: t / 1000,
            velocity: f.velocity,
            baro_alt: f.altitude,
            geo_alt: f.projected_altitude,
            lat: f.lat,
            lon: f.lon,
          },
          analysis: { ml: { score: Math.random() * 0.8 } }
        };
      });
      return next;
    });
  }, [altHistory, ghostPaths, trails]);

  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startFallback = useCallback(() => {
    if (fallbackTimerRef.current) return;
    setLogs((prev) =>
      prev.length
        ? prev
        : [
            {
              id: crypto.randomUUID(),
              ts: Date.now(),
              callsign: "SYSTEM",
              label: "NORMAL",
              detail:
                "WebSocket endpoint ws://localhost:8080/api/ws/flights unreachable — entering simulated feed mode for demo.",
            },
          ],
    );
    fallbackTimerRef.current = setInterval(() => {
      processTick(tickFlights());
    }, 1500);
  }, [processTick]);

  const wsUrl = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_WS_URL) 
    ? process.env.NEXT_PUBLIC_WS_URL 
    : (import.meta.env && import.meta.env.VITE_WS_URL) || "ws://localhost:8000/api/ws/flights";

  const { status } = useWebSockets(wsUrl, {
    token: typeof window !== "undefined" ? window.localStorage.getItem("siem_jwt") ?? undefined : undefined,
    onMessage: (data) => {
      if (Array.isArray(data)) processTick(data as FlightTick[]);
    },
    fallback: startFallback,
  });

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selected) return;
    const spoofed = Object.entries(threats).find(([, l]) => l.startsWith("MITRE"));
    if (spoofed) setSelected(spoofed[0]);
    else if (flights[0]) setSelected(flights[0].callsign);
  }, [threats, flights, selected]);

  const selectedFlight = useMemo(
    () => flights.find((f) => f.callsign === selected) ?? null,
    [flights, selected],
  );
  const selectedThreat = selected ? threats[selected] ?? "NORMAL" : "NORMAL";
  const selectedAlt = selected ? altHistory[selected] ?? [] : [];

  const attackChain = useMemo(() => {
    if (!selectedThreat.startsWith("MITRE")) return [];
    return [
      "Reconnaissance — adversary observes ADS-B broadcasts on 1090 MHz.",
      "Initial Access — RF transmitter injects forged GNSS payload.",
      "Defense Evasion — falsified telemetry mimics valid waypoint geometry.",
      "Impact (T1565.002) — sustained position drift from filed flight plan.",
    ];
  }, [selectedThreat]);

  const stats = useMemo(() => {
    const spoofed = Object.values(threats).filter((l) => l.startsWith("MITRE")).length;
    const glitch = Object.values(threats).filter((l) => l === "SENSOR_GLITCH").length;
    return { tracked: flights.length, spoofed, glitch };
  }, [flights, threats]);

  const isObserver = user?.role === "ROLE_OBSERVER";
  const spoofActive = stats.spoofed > 0;

  return (
    <div
      key={spoofActive ? "alert" : "calm"}
      className={`relative flex h-full w-full flex-col overflow-hidden text-[#E6EDF7] ${
        spoofActive ? "spoof-alert" : "spoof-clear bg-[#0B0E14]"
      }`}
    >
      <header className="relative z-20 flex items-center justify-between border-b border-[#1F2A3A] bg-[#0B0E14] px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[#00E5FF]/40 bg-[#00E5FF]/10 shadow-[0_0_18px_rgba(0,229,255,0.25)]">
            <img src="/nazar.jpeg" alt="Nazar" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="font-mono-data text-[12px] font-bold uppercase tracking-[0.26em] text-[#E6EDF7]">
              NAZAR <span className="text-[#00E5FF]/70">//</span> AVIATION SIEM <span className="text-[#00E5FF]/70">//</span>{" "}
              <span className="text-[#00E5FF] hud-glow-cyan">
                {variant === "map-only" ? "MAP VIEW" : "WAR ROOM"}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          <Stat label="TRACKED" value={stats.tracked} color="text-[#00E5FF] hud-glow-cyan" />
          <Divider />
          <Stat
            label="SPOOFED"
            value={stats.spoofed}
            color={spoofActive ? "text-[#FF3B30] hud-glow-red" : "text-[#5A6478]"}
            alert={spoofActive}
          />
          <Divider />
          <Stat label="GLITCH" value={stats.glitch} color="text-[#FFB020]" />
          <Divider />
          <Stat label="UPTIME" value={new Date(now).toISOString().slice(11, 19)} color="text-[#E6EDF7]" />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSandboxStatus(null); setSandboxOpen(true); }}
            className="group flex shrink-0 items-center gap-1.5 rounded-sm border border-[#00E5FF]/35 bg-[#00E5FF]/[0.06] px-1.5 py-1 transition-all hover:border-[#00E5FF] hover:bg-[#00E5FF]/[0.12] hover:shadow-[0_0_10px_rgba(0,229,255,0.35)]"
            title="Manual Ingestion Sandbox"
          >
            <Terminal className="h-3 w-3 text-[#00E5FF] icon-glow-cyan" />
            <span className="whitespace-nowrap font-mono-data text-[9px] font-semibold tracking-[0.18em] text-[#00E5FF]">SANDBOX</span>
          </button>
          <div className="flex items-center gap-1.5 rounded-sm border border-[#00E5FF]/30 bg-[#00E5FF]/5 px-2 py-1">
            <Lock className="h-3 w-3 text-[#00E5FF]" />
            <span className="text-[9px] font-semibold tracking-[0.25em] text-[#00E5FF]">
              {user?.role.replace("ROLE_", "") ?? "JWT"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-sm border border-[#1F2A3A] bg-[#141A24] px-2 py-1">
            <Activity
              className={`h-3 w-3 ${
                status === "open" ? "text-[#34D399] icon-glow-cyan" : status === "fallback" ? "text-[#FFB020]" : "text-[#5A6478]"
              }`}
            />
            <span className="font-mono-data text-[9px] tracking-[0.2em] text-[#8A95A8]">
              WS · {status === "fallback" ? "SIM" : status.toUpperCase()}
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-sm border border-[#1F2A3A] bg-[#141A24] px-2 py-1 text-[9px] font-medium tracking-[0.25em] text-[#8A95A8] transition hover:border-[#FF3366]/50 hover:text-[#FF3366]"
          >
            <LogOut className="h-3 w-3" />
            LOGOUT
          </button>
        </div>
      </header>

      {sandboxOpen && (
        <SandboxModal
          value={sandboxPayload}
          status={sandboxStatus}
          onChange={setSandboxPayload}
          onClose={() => setSandboxOpen(false)}
          onInject={() => {
            const raw = sandboxPayload.trim();
            if (!raw) { setSandboxStatus({ ok: false, msg: "Empty payload — paste raw ADS-B JSON or hex frames first." }); return; }
            try {
              const parsed = JSON.parse(raw);
              const ticks = Array.isArray(parsed) ? parsed : [parsed];
              const normalized: FlightTick[] = ticks.map((p: Record<string, unknown>, i: number) => {
                const callsign = String(p.callsign ?? p.icao ?? `INJ${i}`).toUpperCase().slice(0, 8);
                return {
                  callsign,
                  origin: String(p.origin ?? "INJ"),
                  destination: String(p.destination ?? "INJ"),
                  lat: Number(p.lat ?? p.latitude ?? 0),
                  lon: Number(p.lon ?? p.longitude ?? 0),
                  altitude: Number(p.altitude ?? p.alt ?? 35000),
                  projected_altitude: Number(p.projected_altitude ?? p.altitude ?? 35000),
                  velocity: Number(p.velocity ?? p.vel ?? 800),
                  heading: Number(p.heading ?? p.hdg ?? 0),
                  timestamp: Number(p.timestamp ?? Date.now()),
                } as FlightTick;
              });
              processTick(normalized);
              setSandboxStatus({ ok: true, msg: `Injected ${normalized.length} packet${normalized.length === 1 ? "" : "s"} → heuristic & ML engine.` });
            } catch (err) {
              setSandboxStatus({ ok: false, msg: `Parse failure: ${(err as Error).message}` });
            }
          }}
        />
      )}

      {variant === "map-only" ? (
        <main className="relative flex min-h-0 flex-1 flex-col bg-[#0B0E14]">
          <PanelHeader index="02" title="3D TACTICAL VIEWPORT" right="OBSERVER MODE · READ-ONLY TRACKING" />
          <div className="relative min-h-0 flex-1">
            <WarRoomMap flights={flights} threats={threats} ghostPaths={ghostPaths} trails={trails} selected={selected} focusTarget={focusTarget} onSelect={setSelected} />
            <Corners />
          </div>
        </main>
      ) : (
        <main ref={splitContainerRef} className="flex min-h-0 flex-1 flex-col">
          {/* Top row — Panels 01 / 02 / 03 */}
          <div
            className="grid min-h-0 grid-cols-12 gap-px siem-grid-gap"
            style={{ height: isObserver ? "100%" : `${topPct}%` }}
          >
            <section className="col-span-12 flex min-h-0 flex-col bg-[#141A24] md:col-span-3">
              <IncidentFeed logs={logs} onSelect={focusFlight} selected={selected} />
            </section>

            <section className="relative col-span-12 flex min-h-0 flex-col bg-[#141A24] md:col-span-6">
              <PanelHeader index="02" title="3D TACTICAL VIEWPORT" right="GLOBAL ADS-B FEED · EQUIRECTANGULAR" />
              <div className="relative min-h-0 flex-1 bg-[#0B0E14]">
                <WarRoomMap flights={flights} threats={threats} ghostPaths={ghostPaths} trails={trails} selected={selected} focusTarget={focusTarget} onSelect={setSelected} />
                <Corners />
              </div>
            </section>


            <section className="col-span-12 flex min-h-0 flex-col bg-[#141A24] md:col-span-3">
              <TelemetryPanel
                flight={selectedFlight}
                threat={selectedThreat}
                altHistory={selectedAlt}
                attackChain={attackChain}
              />
              <div className="flex-1 min-h-0 border-t border-[#1F2A3A] p-4 overflow-hidden">
                 <TelemetryCharts aircraft={selected ? traffic[selected] : null} />
              </div>
            </section>
          </div>

          {/* Resizable splitter handle - hide if observer */}
          {!isObserver && (
            <div
              role="separator"
              aria-orientation="horizontal"
              onMouseDown={startDrag}
              onDoubleClick={() => setTopPct(62)}
              className="group relative h-1.5 shrink-0 cursor-row-resize border-y border-[#1F2A3A] bg-[#0B0E14] transition-colors hover:bg-[#00E5FF]/20"
              title="Drag to resize · double-click to reset"
            >
              <span className="pointer-events-none absolute left-1/2 top-1/2 h-px w-10 -translate-x-1/2 -translate-y-1/2 bg-[#1F2A3A] transition-colors group-hover:bg-[#00E5FF]" />
            </div>
          )}

          {/* Bottom row — Panel 04 */}
          {!isObserver && (
            <section
              className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#141A24] panel04-scroll"
              style={{ height: `${100 - topPct}%` }}
            >
              <IntelPanel
                events={intelEvents}
                locked={isObserver}
                selected={selected}
                spoofedCount={stats.spoofed}
                onSelect={focusFlight}
              />
            </section>
          )}
        </main>
      )}

      <footer className="flex items-center justify-between border-t border-[#1F2A3A] bg-[#0B0E14] px-5 py-1.5 text-[9px] font-medium tracking-[0.3em] text-[#5A6478]">
        <span>NAZAR <span className="text-[#00E5FF]/70">//</span> CLASSIFIED <span className="text-[#00E5FF]/70">//</span> FOR OPERATIONAL USE</span>
        <span className="font-mono-data text-[#00E5FF]/80 hud-glow-cyan">NAZAR v2.1 • DETECTOR ENGINE</span>
        <span><span className="font-mono-data text-[#FF3366]">{logs.filter((l) => severityOf(l.label) === "CRITICAL").length}</span> CRITICAL EVENTS</span>
      </footer>
    </div>
  );
}

function PanelHeader({ index, title, right }: { index: string; title: string; right?: string }) {
  return (
    <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[#1F2A3A] bg-[#141A24] px-4 py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="text-[10px] font-semibold tracking-[0.35em] text-[#00E5FF]/80">PANEL {index}</span>
        <span className="text-[13px] font-semibold tracking-[0.18em] text-[#E6EDF7]">{title}</span>
      </div>
      {right && (
        <span className="font-mono-data text-[10px] tracking-[0.18em] text-[#00E5FF]/70 hud-glow-cyan">
          {right}
        </span>
      )}
    </div>
  );
}

function Stat({ label, value, color, pulse, alert }: { label: string; value: number | string; color: string; pulse?: boolean; alert?: boolean }) {
  return (
    <div className={`flex flex-col items-end ${alert ? "spoof-metric-active" : ""}`}>
      <span className={`text-[9px] tracking-[0.3em] ${alert ? "font-bold text-[#FF3B30] hud-glow-red" : "font-medium text-[#5A6478]"}`}>{label}</span>
      <span className={`font-mono-data text-base ${alert ? "font-extrabold" : "font-bold"} ${color} ${(pulse || alert) && Number(value) > 0 ? "animate-pulse" : ""}`}>
        {typeof value === "number" ? String(value).padStart(2, "0") : value}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-6 w-px bg-[#1F2A3A]" />;
}

function Corners() {
  const cls = "pointer-events-none absolute h-5 w-5 border-[#00E5FF]/60";
  return (
    <>
      <span className={`${cls} left-2 top-2 border-l-2 border-t-2`} />
      <span className={`${cls} right-2 top-2 border-r-2 border-t-2`} />
      <span className={`${cls} left-2 bottom-2 border-l-2 border-b-2`} />
      <span className={`${cls} right-2 bottom-2 border-r-2 border-b-2`} />
    </>
  );
}

function buildLog(f: FlightTick, label: ThreatLabel): IncidentLog {
  const detail =
    label === "MITRE T1565.002: GPS Spoofing"
      ? `Sustained position drift detected on ${f.callsign} (${f.origin}→${f.destination}). Velocity locked at ~1050 km/h across 3+ samples.`
      : label === "SENSOR_GLITCH"
        ? `Instantaneous velocity spike >1200 km/h on ${f.callsign}. Single-point ADS-B anomaly — quarantined.`
        : `Tracking ${f.callsign} ${f.origin}→${f.destination} @ FL${(f.altitude / 100).toFixed(0)}.`;
  return { id: crypto.randomUUID(), ts: Date.now(), callsign: f.callsign, label, detail };
}

function SandboxModal({
  value, status, onChange, onClose, onInject,
}: {
  value: string;
  status: { ok: boolean; msg: string } | null;
  onChange: (v: string) => void;
  onClose: () => void;
  onInject: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0E14]/85 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[min(620px,90vw)] overflow-hidden rounded-sm border border-[#00E5FF]/45 bg-[#141A24] shadow-[0_0_40px_rgba(0,229,255,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1F2A3A] bg-[#0F141C] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-[#00E5FF] icon-glow-cyan" />
            <span className="font-mono-data text-[11px] font-semibold tracking-[0.3em] text-[#00E5FF] hud-glow-cyan">
              MANUAL INGESTION SANDBOX
            </span>
            <span className="font-mono-data text-[9px] tracking-[0.2em] text-[#5A6478]">// BYPASS LIVE FEED</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm border border-transparent p-1 text-[#5A6478] transition hover:border-[#FF3366]/40 hover:text-[#FF3366]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-4">
          <div className="mb-2 font-mono-data text-[9px] tracking-[0.25em] text-[#5A6478]">
            RAW PACKET BUFFER · JSON / HEX
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            placeholder="Paste raw ADS-B JSON telemetry or hex frames here for heuristic & ML processing..."
            className="h-56 w-full resize-none rounded-sm border border-[#1F2A3A] bg-[#0B0E14] p-3 font-mono-data text-[12px] leading-relaxed text-[#9AE7FF] placeholder-[#3D4658] outline-none transition focus:border-[#00E5FF]/60 focus:shadow-[inset_0_0_12px_rgba(0,229,255,0.08)]"
          />
          {status && (
            <div
              className={`mt-2 rounded-sm border px-2.5 py-1.5 font-mono-data text-[10px] tracking-[0.15em] ${
                status.ok
                  ? "border-[#34D399]/40 bg-[#34D399]/[0.07] text-[#34D399]"
                  : "border-[#FF3366]/40 bg-[#FF3366]/[0.07] text-[#FF3366]"
              }`}
            >
              {status.ok ? "✓ " : "✗ "}{status.msg}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[#1F2A3A] bg-[#0F141C] px-4 py-2.5">
          <span className="font-mono-data text-[9px] tracking-[0.2em] text-[#5A6478]">
            → POST /api/ingest · FASTAPI HEURISTIC + ML PIPELINE
          </span>
          <button
            onClick={onInject}
            className="group flex items-center gap-2 rounded-sm border border-[#00E5FF]/45 bg-[#00E5FF]/[0.08] px-3.5 py-1.5 font-mono-data text-[11px] font-bold tracking-[0.28em] text-[#00E5FF] transition-all hover:border-[#00E5FF] hover:bg-[#00E5FF]/20 hover:text-[#E6FFFF] hover:shadow-[0_0_18px_rgba(0,229,255,0.55)]"
          >
            <Zap className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            INJECT STREAM PACKET
          </button>
        </div>
      </div>
    </div>
  );
}

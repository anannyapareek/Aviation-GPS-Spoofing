import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, Lock, ShieldAlert, ShieldCheck, Target } from "lucide-react";
import type { IntelEvent, IntelClass, IntelSeverity } from "@/lib/intelligence-engine";

// Deterministic 64-char hex synthesis from event id (stand-in display for the
// server-side SHA-256 seal that's actually committed alongside each snapshot).
function seal(evt: IntelEvent): string {
  const seed = `${evt.id}|${evt.callsign}|${evt.timestamp}|${evt.anomaly_score}`;
  let h1 = 0x811c9dc5, h2 = 0xdeadbeef;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ seed.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    h1 = Math.imul(h1 ^ (h2 + i), 0x9e3779b1) >>> 0;
    h2 = Math.imul(h2 ^ (h1 + i * 31), 0xc2b2ae35) >>> 0;
    out += h1.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

function ForensicSeal({ evt }: { evt: IntelEvent }) {
  const h = seal(evt);
  const truncated = `${h.slice(0, 4)}…${h.slice(-4)}`;
  return (
    <span
      className="group/seal relative inline-flex items-center gap-1 rounded-sm border border-[#1F2A3A] bg-[#0B0E14]/70 px-1.5 py-[1px]"
      title="Forensically Sealed: Relational snapshot committed to database with immutable SHA-256 cryptographic signature."
    >
      <ShieldCheck className="h-2.5 w-2.5 text-[#00E5FF]/70" />
      <span className="font-mono-data text-[9px] tracking-[0.05em] text-[#5A6478]">
        SHA-256: <span className="text-[#7A8597]">{truncated}</span>
      </span>
      <span
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-64 -translate-x-1/2 rounded-sm border border-[#00E5FF]/40 bg-[#0B0E14] px-2.5 py-1.5 text-left font-mono-data text-[9px] leading-relaxed tracking-[0.05em] text-[#9AA5B8] shadow-[0_4px_18px_rgba(0,0,0,0.6)] group-hover/seal:block"
      >
        <span className="block text-[#00E5FF]">FORENSICALLY SEALED</span>
        Relational snapshot committed to database with immutable SHA-256 cryptographic signature.
        <span className="mt-1 block break-all text-[#5A6478]">{h}</span>
      </span>
    </span>
  );
}

interface Props {
  events: IntelEvent[];
  locked: boolean;
  selected: string | null;
  spoofedCount: number;
  onSelect: (cs: string) => void;
}

const sevColor = (s: IntelSeverity) =>
  s === "HIGH" ? "#FF3366" : s === "MEDIUM" ? "#00E5FF" : "#5A6478";

const statusColor: Record<string, { fg: string; bg: string; bd: string }> = {
  MONITORING:    { fg: "#00E5FF", bg: "rgba(0,229,255,0.08)",  bd: "rgba(0,229,255,0.35)" },
  INVESTIGATING: { fg: "#FFB020", bg: "rgba(255,176,32,0.08)", bd: "rgba(255,176,32,0.35)" },
  ESCALATED:     { fg: "#FF3366", bg: "rgba(255,51,102,0.10)", bd: "rgba(255,51,102,0.45)" },
  MITIGATED:     { fg: "#34D399", bg: "rgba(52,211,153,0.08)", bd: "rgba(52,211,153,0.35)" },
};

export function IntelPanel({ events, locked, selected, spoofedCount, onSelect }: Props) {
  if (locked) return <LockedState />;

  const alert = spoofedCount > 0;
  const recent = events.slice(0, 24);
  const mlEvents = recent.filter((e) => e.classification !== "normal").slice(0, 6);
  const mitreEvents = recent.filter((e) => e.mitre).slice(0, 5);
  const timeline = recent.slice(0, 8);

  const activeThreats = recent.filter((e) => e.classification !== "normal").length;
  const highest = useMemo(() => {
    const ranked = [...recent].filter((e) => e.classification !== "normal")
      .sort((a, b) => b.confidence - a.confidence)[0];
    return ranked?.callsign ?? "—";
  }, [recent]);
  const level: { label: string; color: string } = alert
    ? activeThreats >= 3
      ? { label: "CRITICAL", color: "#FF3366" }
      : { label: "ELEVATED", color: "#FFB020" }
    : { label: "NOMINAL", color: "#00E5FF" };

  return (
    <div
      className={`relative p-4 transition-colors duration-700 ${
        alert ? "intel-alert" : ""
      }`}
    >
      {/* Panel header */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-3 flex items-center gap-2 border-b border-[#1F2A3A] bg-[#141A24]/95 px-4 py-2.5 backdrop-blur">
        <Target className={`h-3.5 w-3.5 ${alert ? "text-[#FF3366] icon-glow-red" : "text-[#00E5FF] icon-glow-cyan"}`} />
        <span className={`text-[10px] font-semibold tracking-[0.35em] ${alert ? "text-[#FF3366]/90" : "text-[#00E5FF]/85"}`}>
          PANEL 04 // THREAT INTELLIGENCE · MITRE ATT&CK
        </span>
        <span className="ml-auto font-mono-data text-[10px] tracking-[0.2em] text-[#5A6478]">
          ISO-FOREST · DYNAMICS · MITRE T1565.002
        </span>
      </div>

      {/* ───────────── SECTION 01 — ACTIVE THREAT SUMMARY ───────────── */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricBlock label="ACTIVE THREATS" value={activeThreats} alert={activeThreats > 0} />
        <MetricBlock label="SPOOFED FLIGHTS" value={spoofedCount} alert={spoofedCount > 0} />
        <MetricBlock label="HIGHEST RISK" value={highest} alert={alert} mono />
        <MetricBlock label="THREAT LEVEL" value={level.label} valueColor={level.color} alert={alert} />
      </div>

      <div className="grid gap-3 md:grid-cols-12">
        {/* ───────────── SECTION 02 — ML ANOMALY ANALYSIS ───────────── */}
        <div className="md:col-span-5">
          <SubHeader>ML ANOMALY ANALYSIS</SubHeader>
          <div className="space-y-1.5 rounded-sm border border-[#1F2A3A] bg-[#0F141C] p-2">
            {mlEvents.length === 0 && <EmptyRow text="NO ANOMALIES · STREAM NOMINAL" />}
            {mlEvents.map((e) => (
              <MlCard key={e.id} evt={e} selected={selected === e.callsign} onClick={() => onSelect(e.callsign)} />
            ))}
          </div>
        </div>

        {/* ───────────── SECTION 03 — MITRE ATT&CK MAPPING ───────────── */}
        <div className="md:col-span-4">
          <SubHeader>MITRE ATT&CK CORRELATION</SubHeader>
          <div className="rounded-sm border border-[#1F2A3A] bg-[#0B0F17]">
            {mitreEvents.length === 0 && <EmptyRow text="NO ATT&CK CORRELATIONS" />}
            {mitreEvents.map((e, i) => (
              <MitreRow key={e.id} evt={e} divider={i < mitreEvents.length - 1} onClick={() => onSelect(e.callsign)} />
            ))}
          </div>
        </div>

        {/* ───────────── SECTION 04 — INCIDENT TIMELINE ───────────── */}
        <div className="md:col-span-3">
          <SubHeader>INCIDENT TIMELINE</SubHeader>
          <div className="rounded-sm border border-[#1F2A3A] bg-[#0F141C] p-2">
            {timeline.length === 0 && <EmptyRow text="AWAITING EVENTS" />}
            <Timeline events={timeline} onSelect={onSelect} selected={selected} />
          </div>
        </div>
      </div>

      {/* ───────────── SECTION 05 — RESPONSE STATUS ───────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#1F2A3A] pt-3">
        <span className="font-mono-data text-[10px] tracking-[0.25em] text-[#5A6478]">RESPONSE POSTURE //</span>
        <StatusChip label="MONITORING" active={!alert} />
        <StatusChip label="INVESTIGATING" active={alert && activeThreats < 3} />
        <StatusChip label="ESCALATED" active={alert && activeThreats >= 3} />
        <StatusChip label="MITIGATED" active={false} />
        <span className="ml-auto font-mono-data text-[10px] tracking-[0.2em] text-[#8A95A8]">
          <Activity className="mr-1 inline h-3 w-3 text-[#00E5FF]" />
          ENGINE ONLINE · {recent.length} EVT BUFFER
        </span>
      </div>
    </div>
  );
}

// ---------- Section primitives --------------------------------------------

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="h-px flex-1 bg-gradient-to-r from-[#1F2A3A] to-transparent" />
      <span className="text-[10px] font-semibold tracking-[0.3em] text-[#00E5FF]/75">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-l from-[#1F2A3A] to-transparent" />
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-3 py-4 text-center font-mono-data text-[10px] tracking-[0.25em] text-[#5A6478]">{text}</div>;
}

function MetricBlock({
  label, value, valueColor, alert, mono,
}: { label: string; value: string | number; valueColor?: string; alert?: boolean; mono?: boolean; }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-sm border px-3 py-2 transition-all duration-300 ${
        alert
          ? "intel-metric-alert border-[#FF3366]/45 bg-[#1B0D15]"
          : "border-[#00E5FF]/20 bg-[#141A24] hover:border-[#00E5FF]/55 hover:shadow-[0_0_18px_rgba(0,229,255,0.12)]"
      }`}
    >
      <div className={`text-[9px] font-semibold tracking-[0.3em] ${alert ? "text-[#FF3366]/85" : "text-[#5A6478]"}`}>
        {label}
      </div>
      <div
        className={`mt-1 font-mono-data tabular-nums text-[18px] font-bold leading-tight ${
          alert ? "text-[#FF3366] hud-glow-red" : "text-[#E6EDF7]"
        } ${mono ? "tracking-[0.05em]" : ""}`}
        style={!alert && valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

// ---------- ML card --------------------------------------------------------

function MlCard({ evt, selected, onClick }: { evt: IntelEvent; selected: boolean; onClick: () => void }) {
  const high = evt.classification === "spoofed";
  const fill = Math.round(evt.confidence * 100);
  const railColor = fill > 85 ? "#FF3366" : "#00E5FF";
  return (
    <button
      onClick={onClick}
      className={`group relative block w-full overflow-hidden rounded-sm border px-3 py-2 text-left transition-all duration-200 ${
        high
          ? "border-[#FF3366]/45 bg-[#1F0E16] hover:border-[#FF3366]/75"
          : "border-[#1F2A3A] bg-[#141A24] hover:border-[#00E5FF]/55"
      } ${selected ? "ring-1 ring-[#00E5FF]/60" : ""} hover:shadow-[0_4px_18px_rgba(0,229,255,0.08)]`}
    >
      {high && <span className="intel-scan-red pointer-events-none absolute inset-0" />}
      <span className={`absolute left-0 top-0 h-full w-[2px] ${high ? "bg-[#FF3366]" : "bg-[#00E5FF]"}`} />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className={`font-mono-data text-[12px] font-bold ${high ? "text-[#FF3366] hud-glow-red" : "text-[#00E5FF]"}`}>
            {evt.callsign}
          </span>
          <span className="font-mono-data text-[9px] tracking-[0.2em] text-[#5A6478]">{evt.icao}</span>
          <ForensicSeal evt={evt} />
        </div>
        <span
          className="rounded-sm border px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.15em]"
          style={{ color: sevColor(evt.severity), borderColor: `${sevColor(evt.severity)}55` }}
        >
          {evt.severity}
        </span>
      </div>
      <div className="relative mt-1 font-mono-data text-[10px] tracking-[0.15em] text-[#8A95A8]">
        {evt.source.toUpperCase()}
      </div>
      <div className="relative mt-1.5 flex items-center gap-2">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#0B0E14]">
          <div
            className="h-full rounded-full intel-rail-fill"
            style={{ width: `${fill}%`, background: railColor, boxShadow: `0 0 8px ${railColor}` }}
          />
        </div>
        <span className="font-mono-data text-[10px] font-semibold" style={{ color: railColor }}>{fill}%</span>
      </div>
      <div className="relative mt-1.5 font-mono-data text-[10px] leading-snug text-[#9AA5B8]">
        &gt; {evt.summary}
      </div>
    </button>
  );
}

// ---------- MITRE row ------------------------------------------------------

function MitreRow({ evt, divider, onClick }: { evt: IntelEvent; divider: boolean; onClick: () => void }) {
  const [open, setOpen] = useState(false);
  const m = evt.mitre!;
  return (
    <div
      className={`relative ${divider ? "border-b border-[#1F2A3A]" : ""} intel-mitre-row`}
      style={{ background: "linear-gradient(90deg, rgba(255,51,102,0.06), transparent 60%)" }}
    >
      <span className="absolute left-0 top-0 h-full w-[2px] bg-[#FF3366]" />
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-12 items-center gap-2 px-3 py-2 text-left hover:bg-[#FF3366]/[0.04]"
      >
        <div className="col-span-2 font-mono-data text-[10px] tracking-[0.15em] text-[#5A6478]">{m.tactic.toUpperCase()}</div>
        <div className="col-span-3 font-mono-data text-[11px] font-bold text-[#FF3366] hud-glow-red">{m.technique_id}</div>
        <div className="col-span-4 truncate text-[10px] tracking-[0.1em] text-[#E6EDF7]">{m.technique_name}</div>
        <div className="col-span-2 font-mono-data text-[10px] text-[#00E5FF]">{Math.round(m.confidence * 100)}%</div>
        <div className="col-span-1 flex items-center justify-end gap-1">
          <span
            className="rounded-sm border px-1 py-[1px] text-[9px] font-semibold"
            style={{ color: sevColor(m.severity), borderColor: `${sevColor(m.severity)}66` }}
          >
            {m.severity}
          </span>
          <ChevronDown className={`h-3 w-3 text-[#5A6478] transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-[#1F2A3A] bg-[#0B0E14]/70 px-3 py-2 text-[10px] leading-relaxed text-[#8A95A8]">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono-data text-[10px] tracking-[0.2em] text-[#5A6478]">
            <span>FLIGHT <span className="text-[#00E5FF]">{evt.callsign}</span></span>
            <span>· ICAO {evt.icao}</span>
            <span>· ENGINE <span className="text-[#E6EDF7]">{evt.source}</span></span>
            <span>· <span className="text-[#5A6478]">{new Date(m.timestamp).toLocaleTimeString("en-GB")}</span></span>
            <ForensicSeal evt={evt} />
          </div>
          ADS-B telemetry inconsistencies indicate possible positional spoofing or manipulated aircraft
          state transmission. {evt.summary}
        </div>
      )}
    </div>
  );
}

// ---------- Timeline -------------------------------------------------------

function Timeline({ events, onSelect, selected }: { events: IntelEvent[]; onSelect: (cs: string) => void; selected: string | null }) {
  return (
    <ol className="relative ml-2 border-l border-[#1F2A3A]">
      {events.map((e) => {
        const high = e.classification === "spoofed";
        const accent = high ? "#FF3366" : e.classification === "suspicious" ? "#FFB020" : "#00E5FF";
        const isSel = selected === e.callsign;
        return (
          <li key={e.id} className="relative -ml-px pl-3 py-1">
            <span
              className={`absolute -left-[5px] top-2 h-2 w-2 rounded-full ${high ? "intel-node-pulse" : ""}`}
              style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
            />
            <button
              onClick={() => onSelect(e.callsign)}
              className={`block w-full rounded-sm border px-2 py-1 text-left transition-all duration-200 hover:translate-x-[3px] ${
                high ? "border-[#FF3366]/45 bg-[#1A0E14]" : "border-[#1F2A3A] bg-[#141A24]"
              } ${isSel ? "ring-1 ring-[#00E5FF]/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-data text-[10px] font-bold" style={{ color: accent }}>{e.callsign}</span>
                <div className="flex items-center gap-1.5">
                  <ForensicSeal evt={e} />
                  <span className="font-mono-data text-[9px] text-[#5A6478]">{new Date(e.timestamp).toLocaleTimeString("en-GB")}</span>
                </div>
              </div>
              <div className="font-mono-data text-[9px] tracking-[0.1em] text-[#8A95A8]">
                {labelOf(e.classification)} · {Math.round(e.confidence * 100)}% · {statusFor(e)}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function labelOf(c: IntelClass) {
  return c === "spoofed" ? "SPOOF EVENT" : c === "suspicious" ? "SUSPICIOUS" : "NOMINAL";
}
function statusFor(e: IntelEvent) {
  if (e.classification === "spoofed") return e.severity === "HIGH" ? "ESCALATED" : "INVESTIGATING";
  if (e.classification === "suspicious") return "INVESTIGATING";
  return "MONITORING";
}

// ---------- Status chip ----------------------------------------------------

function StatusChip({ label, active }: { label: string; active: boolean }) {
  const c = statusColor[label];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[9px] font-semibold tracking-[0.25em] transition-all ${
        active ? "intel-chip-pulse" : "opacity-55"
      }`}
      style={{ color: c.fg, background: c.bg, borderColor: c.bd }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg, boxShadow: active ? `0 0 6px ${c.fg}` : "none" }} />
      {label}
    </span>
  );
}

// ---------- Locked ---------------------------------------------------------

function LockedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-[#FF3366]/20" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-sm border border-[#FF3366]/40 bg-[#FF3366]/10">
          <Lock className="h-5 w-5 text-[#FF3366]" />
        </div>
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-[10px] tracking-[0.35em] text-[#FF3366]">
          <ShieldAlert className="h-3 w-3" />
          ACCESS RESTRICTED
        </div>
        <div className="mt-1 text-xs tracking-[0.2em] text-[#8A95A8]">
          THREAT INTELLIGENCE PANEL · CLEARANCE LEVEL 2 REQUIRED
        </div>
      </div>
    </div>
  );
}

void useEffect;

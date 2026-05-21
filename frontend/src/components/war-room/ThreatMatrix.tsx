import { useMemo, useState } from "react";
import { GitFork, Lock, ShieldAlert } from "lucide-react";
import type { FlightTick } from "@/lib/flight-simulator";
import { severityOf, type ThreatLabel } from "@/lib/threat-classifier";
import type { IncidentLog } from "./IncidentFeed";

interface Props {
  flights: FlightTick[];
  threats: Record<string, ThreatLabel>;
  logs: IncidentLog[];
  locked: boolean;
  selected: string | null;
  onSelect: (cs: string) => void;
}

type NodeKind = "sector" | "aircraft" | "threat";
interface Node {
  id: string;
  kind: NodeKind;
  label: string;
  sub?: string;
  x: number;
  y: number;
  critical?: boolean;
  callsign?: string;
}
interface Edge {
  id: string;
  from: string;
  to: string;
  critical: boolean;
}

const W = 1000;
const H = 360;
const COL_X: Record<NodeKind, number> = { sector: 110, aircraft: 500, threat: 890 };

export function ThreatMatrix({ flights, threats, logs, locked, selected, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => buildGraph(flights, threats, logs), [flights, threats, logs]);

  if (locked) return <LockedState />;

  const focusId = hover ?? (selected ? `ac:${selected}` : null);
  const connected = focusId ? neighborSet(focusId, edges) : null;

  const isLit = (id: string) => !connected || connected.has(id);
  const isEdgeLit = (e: Edge) => !connected || (connected.has(e.from) && connected.has(e.to));

  const critCount = edges.filter((e) => e.critical).length;
  const sectorCount = nodes.filter((n) => n.kind === "sector").length;

  return (
    <div className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <GitFork className="h-3.5 w-3.5 text-[#00E5FF] icon-glow-cyan" />
        <span className="text-[10px] font-semibold tracking-[0.35em] text-[#00E5FF]/85">
          PANEL 04 // THREAT CORRELATION MATRIX
        </span>
        <span className="ml-auto flex items-center gap-4 font-mono-data text-[10px] tracking-[0.2em] text-[#5A6478]">
          <span>{String(sectorCount).padStart(2, "0")} SECTORS</span>
          <span>{String(flights.length).padStart(2, "0")} TRACKS</span>
          <span className={critCount > 0 ? "text-[#FF3366] hud-glow-red" : ""}>
            {String(critCount).padStart(2, "0")} PROPAGATION
          </span>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-sm border border-[#1F2A3A] bg-[#0F141C]">
        <div className="absolute inset-0 matrix-grid opacity-60" />
        <div className="absolute inset-0 matrix-scan pointer-events-none" />
        <div className="pointer-events-none absolute left-0 right-0 top-0 flex justify-between px-4 py-1.5 text-[9px] font-semibold tracking-[0.35em] text-[#00E5FF]/55">
          <span>SECTORS</span>
          <span>AIRCRAFT</span>
          <span>THREAT VECTORS</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="relative block h-[360px] w-full"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <radialGradient id="nodeCyan" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nodeRed" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#FF3366" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FF3366" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* edges */}
          {edges.map((e) => {
            const a = nodes.find((n) => n.id === e.from);
            const b = nodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            const lit = isEdgeLit(e);
            const d = curve(a.x, a.y, b.x, b.y);
            if (e.critical) {
              return (
                <g key={e.id} opacity={lit ? 1 : 0.12}>
                  <path d={d} stroke="#FF3366" strokeOpacity={0.25} strokeWidth={1.25} fill="none" />
                  <path
                    d={d}
                    stroke="#FF3366"
                    strokeOpacity={0.9}
                    strokeWidth={1.4}
                    fill="none"
                    className="edge-flow-red"
                  />
                </g>
              );
            }
            return (
              <path
                key={e.id}
                d={d}
                stroke="#00E5FF"
                strokeOpacity={lit ? 0.5 : 0.08}
                strokeWidth={0.9}
                fill="none"
              />
            );
          })}

          {/* nodes */}
          {nodes.map((n) => {
            const lit = isLit(n.id);
            const isSelected = n.callsign && n.callsign === selected;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                opacity={lit ? 1 : 0.2}
                onMouseEnter={() => setHover(n.id)}
                onClick={() => n.callsign && onSelect(n.callsign)}
                style={{ cursor: n.callsign ? "pointer" : "default" }}
              >
                {n.critical && (
                  <circle r={24} fill="url(#nodeRed)" className="node-pulse-red" />
                )}
                {!n.critical && (
                  <circle r={18} fill="url(#nodeCyan)" opacity={0.55} />
                )}
                <NodeShape kind={n.kind} critical={!!n.critical} selected={!!isSelected} />
                <text
                  textAnchor="middle"
                  y={n.kind === "sector" ? -22 : 32}
                  className="font-mono-data"
                  fontSize={n.kind === "aircraft" ? 10 : 9.5}
                  fontWeight={700}
                  fill={n.critical ? "#FF3366" : "#E6EDF7"}
                  style={{
                    letterSpacing: "0.15em",
                    filter: n.critical
                      ? "drop-shadow(0 0 4px rgba(255,51,102,0.7))"
                      : isSelected
                        ? "drop-shadow(0 0 4px rgba(0,229,255,0.8))"
                        : undefined,
                  }}
                >
                  {n.label}
                </text>
                {n.sub && (
                  <text
                    textAnchor="middle"
                    y={n.kind === "sector" ? -34 : 44}
                    fontSize={8}
                    fill="#5A6478"
                    style={{ letterSpacing: "0.3em", fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                  >
                    {n.sub}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* legend */}
        <div className="flex items-center justify-between border-t border-[#1F2A3A] bg-[#0B0E14]/80 px-4 py-1.5 text-[9px] font-semibold tracking-[0.3em] text-[#5A6478]">
          <div className="flex items-center gap-4">
            <Legend color="#00E5FF" label="NOMINAL LINK" />
            <Legend color="#FF3366" label="SPOOF PROPAGATION" dashed />
            <span className="text-[#5A6478]/70">HOVER · ISOLATE PATHS</span>
            <span className="text-[#5A6478]/70">CLICK · FOCUS TELEMETRY</span>
          </div>
          <span className="font-mono-data text-[#00E5FF]/70">
            {focusId ? `FOCUS · ${focusId.split(":").pop()}` : "GLOBAL VIEW"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width={22} height={6}>
        <line
          x1={0}
          y1={3}
          x2={22}
          y2={3}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={dashed ? "3 3" : undefined}
        />
      </svg>
      <span style={{ color }}>{label}</span>
    </span>
  );
}

function NodeShape({ kind, critical, selected }: { kind: NodeKind; critical: boolean; selected: boolean }) {
  const stroke = critical ? "#FF3366" : selected ? "#00E5FF" : "#00E5FF";
  const fill = critical ? "rgba(255,51,102,0.18)" : "rgba(0,229,255,0.10)";
  const sw = selected || critical ? 1.6 : 1;
  if (kind === "sector") {
    return <rect x={-13} y={-13} width={26} height={26} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }
  if (kind === "threat") {
    return (
      <polygon
        points="0,-14 14,0 0,14 -14,0"
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
      />
    );
  }
  // aircraft — hex
  return (
    <polygon
      points="-12,-7 0,-14 12,-7 12,7 0,14 -12,7"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  );
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

function neighborSet(id: string, edges: Edge[]) {
  const set = new Set<string>([id]);
  edges.forEach((e) => {
    if (e.from === id) set.add(e.to);
    if (e.to === id) set.add(e.from);
  });
  return set;
}

function buildGraph(
  flights: FlightTick[],
  threats: Record<string, ThreatLabel>,
  logs: IncidentLog[],
) {
  const sectors = new Set<string>();
  flights.forEach((f) => {
    sectors.add(f.origin);
    sectors.add(f.destination);
  });
  const sectorList = Array.from(sectors).sort();

  const threatTypes = new Map<string, { label: string; sub: string; critical: boolean }>();
  flights.forEach((f) => {
    const t = threats[f.callsign] ?? "NORMAL";
    if (t === "MITRE T1565.002: GPS Spoofing") {
      threatTypes.set("T1565.002", { label: "T1565.002", sub: "GPS SPOOFING", critical: true });
    } else if (t === "SENSOR_GLITCH") {
      threatTypes.set("GLITCH", { label: "SENSOR", sub: "GLITCH", critical: false });
    }
  });
  // Alerts derived from recent critical logs
  const recentCritical = logs.filter((l) => severityOf(l.label) === "CRITICAL").slice(0, 3);
  if (recentCritical.length) {
    threatTypes.set("ALERT", { label: "SOC ALERT", sub: `${recentCritical.length} OPEN`, critical: true });
  }
  const threatList = Array.from(threatTypes.entries());

  const layout = (count: number, top = 40, bottom = H - 40) => {
    if (count <= 1) return [(top + bottom) / 2];
    const step = (bottom - top) / (count - 1);
    return Array.from({ length: count }, (_, i) => top + i * step);
  };

  const sectorYs = layout(sectorList.length);
  const aircraftYs = layout(flights.length);
  const threatYs = layout(threatList.length);

  const nodes: Node[] = [];
  sectorList.forEach((s, i) => {
    nodes.push({ id: `sec:${s}`, kind: "sector", label: s, x: COL_X.sector, y: sectorYs[i] });
  });
  flights.forEach((f, i) => {
    const t = threats[f.callsign] ?? "NORMAL";
    const critical = t.startsWith("MITRE");
    nodes.push({
      id: `ac:${f.callsign}`,
      kind: "aircraft",
      label: f.callsign,
      sub: `${f.origin}→${f.destination}`,
      x: COL_X.aircraft,
      y: aircraftYs[i],
      critical,
      callsign: f.callsign,
    });
  });
  threatList.forEach(([id, meta], i) => {
    nodes.push({
      id: `thr:${id}`,
      kind: "threat",
      label: meta.label,
      sub: meta.sub,
      x: COL_X.threat,
      y: threatYs[i],
      critical: meta.critical,
    });
  });

  const edges: Edge[] = [];
  flights.forEach((f) => {
    const t = threats[f.callsign] ?? "NORMAL";
    const critical = t.startsWith("MITRE");
    edges.push({ id: `e:${f.origin}-${f.callsign}`, from: `sec:${f.origin}`, to: `ac:${f.callsign}`, critical });
    edges.push({ id: `e:${f.callsign}-${f.destination}`, from: `ac:${f.callsign}`, to: `sec:${f.destination}`, critical });
    if (t === "MITRE T1565.002: GPS Spoofing") {
      edges.push({ id: `e:${f.callsign}-spoof`, from: `ac:${f.callsign}`, to: `thr:T1565.002`, critical: true });
      if (threatTypes.has("ALERT")) {
        edges.push({ id: `e:${f.callsign}-alert`, from: `ac:${f.callsign}`, to: `thr:ALERT`, critical: true });
      }
    } else if (t === "SENSOR_GLITCH") {
      edges.push({ id: `e:${f.callsign}-glitch`, from: `ac:${f.callsign}`, to: `thr:GLITCH`, critical: false });
    }
  });

  return { nodes, edges };
}

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
          THREAT CORRELATION MATRIX · CLEARANCE LEVEL 2 REQUIRED
        </div>
        <div className="mt-2 text-[10px] tracking-[0.25em] text-[#5A6478]">
          ROLE_OBSERVER lacks privileges to view this panel.
        </div>
      </div>
    </div>
  );
}

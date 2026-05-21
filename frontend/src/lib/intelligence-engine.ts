// ============================================================================
// Aviation SIEM — Backend Intelligence Engine
// ----------------------------------------------------------------------------
// Pure-TypeScript implementation. The hosting runtime is Cloudflare workerd,
// where Python / scikit-learn are not available; this engine re-implements an
// Isolation-Forest-style anomaly scorer plus a heuristic flight-dynamics rule
// set, then maps spoofing-class anomalies to MITRE ATT&CK T1565.002.
//
// Design goals:
//   - Continuous, near-real-time streaming evaluation
//   - Per-callsign rolling feature windows (normalized)
//   - Score + confidence + classification (normal / suspicious / spoofed)
//   - Operational summaries suitable for SOC analysts
//   - Safe under malformed telemetry; no traceback spam
//   - Throttled event emission (no websocket flooding)
// ============================================================================

import type { FlightTick } from "@/lib/flight-simulator";

// ---------- Public types --------------------------------------------------

export type IntelClass = "normal" | "suspicious" | "spoofed";
export type IntelSeverity = "LOW" | "MEDIUM" | "HIGH";
export type DetectionSource =
  | "Isolation Forest"
  | "Flight Dynamics Engine"
  | "Velocity Divergence Check"
  | "Trajectory Integrity Analysis";

export interface MitreMapping {
  tactic: "Impact";
  technique_id: "T1565.002";
  technique_name: "Transmitted Data Manipulation";
  confidence: number; // 0..1
  severity: IntelSeverity;
  timestamp: number;
}

export interface IntelEvent {
  id: string;
  callsign: string;
  icao: string;
  anomaly_score: number; // 0..1 (higher = more anomalous)
  confidence: number; // 0..1
  classification: IntelClass;
  severity: IntelSeverity;
  source: DetectionSource;
  summary: string;
  telemetry: {
    lat: number;
    lon: number;
    altitude: number;
    velocity: number;
    heading: number;
    vertical_rate: number;
  };
  mitre: MitreMapping | null;
  timestamp: number;
}

// ---------- Internal state -------------------------------------------------

interface CallsignState {
  window: number[][]; // rolling normalized feature vectors
  raw: FeatureRaw[]; // last N raw feature snapshots
  lastEmittedAt: number;
  lastClass: IntelClass;
}

interface FeatureRaw {
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  heading: number;
  vertical_rate: number;
  t: number;
}

const WINDOW = 24;
const MIN_EVAL = 6;
const EMIT_MIN_INTERVAL_MS = 1500;

// Feature scaling reference (typical operational envelopes)
const SCALE = {
  lat: 90,
  lon: 180,
  altitude: 45000,
  velocity: 1200,
  heading: 360,
  vertical_rate: 6000,
};

const state = new Map<string, CallsignState>();

// ---------- Helpers --------------------------------------------------------

function safe(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function icaoFor(callsign: string): string {
  // deterministic synthetic ICAO hex (engine has no real ICAO source)
  let h = 0;
  for (let i = 0; i < callsign.length; i++) h = (h * 31 + callsign.charCodeAt(i)) >>> 0;
  return (h & 0xffffff).toString(16).toUpperCase().padStart(6, "0");
}

function normalize(f: FeatureRaw): number[] {
  return [
    f.lat / SCALE.lat,
    f.lon / SCALE.lon,
    f.altitude / SCALE.altitude,
    f.velocity / SCALE.velocity,
    f.heading / SCALE.heading,
    f.vertical_rate / SCALE.vertical_rate,
  ];
}

// ---------- Isolation-Forest-style scorer ---------------------------------
// Lightweight approximation: for each of K random projections, split the
// rolling window on a random threshold and measure how isolated the latest
// sample is (shorter average "path" => more anomalous).  Returns 0..1.
function isolationScore(window: number[][], sample: number[]): number {
  if (window.length < MIN_EVAL) return 0;
  const K = 24;
  const dims = sample.length;
  let pathSum = 0;
  for (let k = 0; k < K; k++) {
    const dim = Math.floor(Math.random() * dims);
    const col = window.map((row) => row[dim]);
    const min = Math.min(...col);
    const max = Math.max(...col);
    if (max === min) {
      pathSum += Math.log2(window.length + 1);
      continue;
    }
    // recursive random splits, depth-limited
    let lo = min, hi = max, depth = 0;
    const maxDepth = Math.ceil(Math.log2(window.length + 1)) + 2;
    while (depth < maxDepth) {
      const split = lo + Math.random() * (hi - lo);
      if (sample[dim] < split) hi = split;
      else lo = split;
      depth++;
      if (hi - lo < 1e-6) break;
    }
    pathSum += depth;
  }
  const avgPath = pathSum / K;
  // expected path length for n samples in iForest
  const n = window.length;
  const c = 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  const score = Math.pow(2, -avgPath / Math.max(c, 1));
  return Math.max(0, Math.min(1, score));
}

// ---------- Heuristic flight-dynamics engine ------------------------------

interface HeuristicResult {
  triggered: boolean;
  severity: IntelSeverity;
  source: DetectionSource;
  summary: string;
}

function heuristics(prev: FeatureRaw | undefined, cur: FeatureRaw): HeuristicResult {
  if (!prev) return { triggered: false, severity: "LOW", source: "Flight Dynamics Engine", summary: "" };
  const dt = Math.max((cur.t - prev.t) / 1000, 0.001);

  const dAlt = cur.altitude - prev.altitude;
  const altRate = dAlt / dt; // ft/s
  const dVel = cur.velocity - prev.velocity;
  const accel = dVel / dt; // km/h per s
  const dHead = Math.abs(((cur.heading - prev.heading + 540) % 360) - 180);
  const headRate = dHead / dt;

  // approximate ground delta in km
  const km = haversineKm(prev.lat, prev.lon, cur.lat, cur.lon);
  const expectedKm = (cur.velocity / 3600) * dt;
  const positional = expectedKm > 0 ? km / expectedKm : 0;

  if (cur.velocity > 1300) {
    return { triggered: true, severity: "HIGH", source: "Velocity Divergence Check",
      summary: "Ground speed exceeds physical envelope for commercial airframe." };
  }
  if (Math.abs(altRate) > 200) {
    return { triggered: true, severity: "HIGH", source: "Flight Dynamics Engine",
      summary: "Impossible altitude delta detected between sequential frames." };
  }
  if (Math.abs(accel) > 60) {
    return { triggered: true, severity: "MEDIUM", source: "Flight Dynamics Engine",
      summary: "Impossible acceleration profile observed in telemetry stream." };
  }
  if (headRate > 25) {
    return { triggered: true, severity: "MEDIUM", source: "Flight Dynamics Engine",
      summary: "Heading change rate exceeds rigid-body turn limits." };
  }
  if (positional > 3.0 && km > 20) {
    return { triggered: true, severity: "HIGH", source: "Trajectory Integrity Analysis",
      summary: "Trajectory continuity failure — reported position teleport vs. last frame." };
  }
  if (Math.abs(cur.vertical_rate) > 5500) {
    return { triggered: true, severity: "MEDIUM", source: "Flight Dynamics Engine",
      summary: "Unrealistic vertical rate inconsistent with declared flight phase." };
  }
  return { triggered: false, severity: "LOW", source: "Flight Dynamics Engine", summary: "" };
}

function haversineKm(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLa = toRad(la2 - la1), dLo = toRad(lo2 - lo1);
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- Classification + MITRE mapping --------------------------------

function classify(score: number, heur: HeuristicResult): { cls: IntelClass; sev: IntelSeverity; conf: number; source: DetectionSource; summary: string; } {
  // confidence blends iForest score with heuristic severity weight
  const heurWeight = heur.triggered ? (heur.severity === "HIGH" ? 0.4 : heur.severity === "MEDIUM" ? 0.25 : 0.1) : 0;
  const conf = Math.max(0, Math.min(1, score * 0.7 + heurWeight + (score > 0.65 ? 0.1 : 0)));

  let cls: IntelClass = "normal";
  let sev: IntelSeverity = "LOW";
  let source: DetectionSource = "Isolation Forest";
  let summary = "Telemetry within nominal multivariate envelope.";

  if (heur.triggered && heur.severity === "HIGH") {
    cls = "spoofed"; sev = "HIGH"; source = heur.source; summary = heur.summary;
  } else if (score > 0.72 || (heur.triggered && heur.severity === "MEDIUM" && score > 0.55)) {
    cls = "spoofed"; sev = "HIGH";
    source = heur.triggered ? heur.source : "Isolation Forest";
    summary = heur.triggered ? heur.summary : "Reported telemetry diverges from learned multivariate distribution.";
  } else if (score > 0.55 || heur.triggered) {
    cls = "suspicious"; sev = "MEDIUM";
    source = heur.triggered ? heur.source : "Isolation Forest";
    summary = heur.triggered ? heur.summary : "Trajectory deviation exceeds expected variance.";
  }
  return { cls, sev, conf, source, summary };
}

function mapMitre(cls: IntelClass, sev: IntelSeverity, conf: number, t: number): MitreMapping | null {
  if (cls !== "spoofed") return null;
  return {
    tactic: "Impact",
    technique_id: "T1565.002",
    technique_name: "Transmitted Data Manipulation",
    confidence: conf,
    severity: sev,
    timestamp: t,
  };
}

// ---------- Public API -----------------------------------------------------

/**
 * Evaluate a batch of telemetry ticks. Returns a list of emitted intelligence
 * events (throttled — at most one per callsign per EMIT_MIN_INTERVAL_MS,
 * always emitted on classification transitions).
 *
 * Never throws: malformed telemetry is sanitized to zeros and skipped if the
 * callsign is unusable.
 */
export function evaluateBatch(ticks: FlightTick[]): IntelEvent[] {
  const out: IntelEvent[] = [];
  if (!Array.isArray(ticks)) return out;

  for (const tick of ticks) {
    try {
      if (!tick || typeof tick.callsign !== "string" || !tick.callsign) continue;

      const cs = tick.callsign;
      const st = state.get(cs) ?? { window: [], raw: [], lastEmittedAt: 0, lastClass: "normal" as IntelClass };
      const prev = st.raw[st.raw.length - 1];

      const cur: FeatureRaw = {
        lat: safe(tick.lat),
        lon: safe(tick.lon),
        altitude: safe(tick.altitude),
        velocity: safe(tick.velocity),
        heading: safe(tick.heading),
        vertical_rate: prev ? (safe(tick.altitude) - prev.altitude) / Math.max((safe(tick.timestamp) - prev.t) / 1000, 0.001) : 0,
        t: safe(tick.timestamp, Date.now()),
      };

      const norm = normalize(cur);
      const score = isolationScore(st.window, norm);
      const heur = heuristics(prev, cur);
      const { cls, sev, conf, source, summary } = classify(score, heur);

      // update rolling window AFTER scoring (so we score against history)
      st.window = [...st.window.slice(-(WINDOW - 1)), norm];
      st.raw = [...st.raw.slice(-(WINDOW - 1)), cur];

      const now = cur.t;
      const transition = cls !== st.lastClass;
      const dueByTime = now - st.lastEmittedAt >= EMIT_MIN_INTERVAL_MS;
      // throttle: skip purely-normal repeats; always emit transitions; respect interval otherwise
      const shouldEmit = transition || (cls !== "normal" && dueByTime);

      if (shouldEmit) {
        const evt: IntelEvent = {
          id: `${cs}-${now}-${Math.floor(Math.random() * 1e6).toString(36)}`,
          callsign: cs,
          icao: icaoFor(cs),
          anomaly_score: Number(score.toFixed(3)),
          confidence: Number(conf.toFixed(3)),
          classification: cls,
          severity: sev,
          source,
          summary,
          telemetry: {
            lat: cur.lat, lon: cur.lon, altitude: cur.altitude,
            velocity: cur.velocity, heading: cur.heading, vertical_rate: cur.vertical_rate,
          },
          mitre: mapMitre(cls, sev, conf, now),
          timestamp: now,
        };
        out.push(evt);
        st.lastEmittedAt = now;
        st.lastClass = cls;

        if (cls !== "normal") {
          // structured single-line operator log (no traceback spam)
          console.info(`[ML] Anomaly detected for ${cs} cls=${cls} conf=${(conf * 100).toFixed(0)}% src="${source}"`);
          if (evt.mitre) console.info(`[MITRE] ${evt.mitre.technique_id} mapped to ${cs} sev=${sev}`);
          console.info(`[WS] Intelligence event emitted ${evt.id}`);
        }
      } else {
        st.lastClass = cls;
      }
      state.set(cs, st);
    } catch (err) {
      // never crash the collector on a single bad tick
      console.warn(`[ML] skipping malformed tick: ${(err as Error).message}`);
    }
  }
  return out;
}

/** Snapshot of currently known classification per callsign (for headers / counters). */
export function classificationSnapshot(): Record<string, IntelClass> {
  const o: Record<string, IntelClass> = {};
  state.forEach((v, k) => { o[k] = v.lastClass; });
  return o;
}

/** Test / SSR reset hook. */
export function _resetIntelState() { state.clear(); }

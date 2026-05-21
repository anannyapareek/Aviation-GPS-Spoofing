// Aviation threat classification engine
// MITRE ATT&CK aligned detection logic

export type ThreatLabel =
  | "NORMAL"
  | "SENSOR_GLITCH"
  | "MITRE T1565.002: GPS Spoofing";

export interface DataPoint {
  distance_delta: number; // km between successive reported positions
  time_delta: number; // seconds between successive reports
}

/**
 * Classify a single delta sample against historical context.
 * - >1200 km/h instantaneous => SENSOR_GLITCH
 * - sustained anomalous velocity over 3+ points (consistent variance) => GPS Spoofing
 */
export function classify_aviation_threat(
  distance_delta: number,
  time_delta: number,
  history: Array<{ distance_delta: number; time_delta: number }> = [],
): ThreatLabel {
  if (time_delta <= 0) return "NORMAL";

  const speed_kmh = (distance_delta / time_delta) * 3600;

  // Single-point spike => sensor glitch
  if (speed_kmh > 1200) {
    return "SENSOR_GLITCH";
  }

  // Sustained anomaly check across 3+ points
  const recent = [...history.slice(-2), { distance_delta, time_delta }];
  if (recent.length >= 3) {
    const speeds = recent.map(
      (p) => (p.distance_delta / Math.max(p.time_delta, 0.001)) * 3600,
    );
    const allAnomalous = speeds.every((s) => s > 950 && s < 1200);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance =
      speeds.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / speeds.length;
    // consistent (low variance) but anomalously high velocity = spoof
    if (allAnomalous && variance < 2500) {
      return "MITRE T1565.002: GPS Spoofing";
    }
  }

  return "NORMAL";
}

export function severityOf(label: ThreatLabel): "CRITICAL" | "WARNING" | "INFO" {
  if (label.startsWith("MITRE")) return "CRITICAL";
  if (label === "SENSOR_GLITCH") return "WARNING";
  return "INFO";
}

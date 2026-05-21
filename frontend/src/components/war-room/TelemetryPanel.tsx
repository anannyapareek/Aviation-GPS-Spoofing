import type { FlightTick } from "@/lib/flight-simulator";
import type { ThreatLabel } from "@/lib/threat-classifier";
import { AltitudeChart, type AltPoint } from "./AltitudeChart";
import { Activity, Crosshair, Gauge, Plane } from "lucide-react";

interface Props {
  flight: FlightTick | null;
  threat: ThreatLabel;
  altHistory: AltPoint[];
  attackChain: string[];
}

export function TelemetryPanel({ flight, threat, altHistory, attackChain }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex shrink-0 items-baseline gap-3 border-b border-[#1F2A3A] bg-[#141A24] px-4 py-2.5">
        <span className="text-[10px] font-semibold tracking-[0.35em] text-[#00E5FF]/80">PANEL 03</span>
        <span className="text-[13px] font-semibold tracking-[0.18em] text-[#E6EDF7]">TARGET TELEMETRY</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll bg-[#0F141C] p-4 space-y-4">
        {!flight && (
          <div className="rounded-sm border border-[#00E5FF]/25 bg-[#00E5FF]/5 p-4 text-center text-[11px] tracking-[0.2em] text-[#00E5FF]/80">
            SELECT A TARGET ON MAP OR FEED
          </div>
        )}

        {flight && (
          <>
            <Section title="IDENTIFICATION" icon={Plane}>
              <Row k="CALLSIGN" v={flight.callsign} accent />
              <Row k="ORIGIN" v={flight.origin} />
              <Row k="DESTINATION" v={flight.destination} />
              <Row
                k="STATUS"
                v={threat}
                color={
                  threat.startsWith("MITRE")
                    ? "text-[#FF3366] hud-glow-red"
                    : threat === "SENSOR_GLITCH"
                      ? "text-[#FFB020]"
                      : "text-[#34D399]"
                }
              />
            </Section>

            <Section title="POSITION VECTOR" icon={Crosshair}>
              <Row k="LAT" v={flight.lat.toFixed(4)} unit="°" />
              <Row k="LON" v={flight.lon.toFixed(4)} unit="°" />
              <Row k="HDG" v={flight.heading.toFixed(0).padStart(3, "0")} unit="°" />
            </Section>

            <Section title="KINEMATICS" icon={Gauge}>
              <Row k="GND SPEED" v={flight.velocity.toFixed(0)} unit="km/h" />
              <Row k="ALT REPORTED" v={flight.altitude.toFixed(0)} unit="ft" />
              <Row k="ALT PROJECTED" v={flight.projected_altitude.toFixed(0)} unit="ft" />
              <Row
                k="ΔALT"
                v={(flight.altitude - flight.projected_altitude).toFixed(0)}
                unit="ft"
                color={
                  Math.abs(flight.altitude - flight.projected_altitude) > 800
                    ? "text-[#FFB020]"
                    : "text-[#E6EDF7]"
                }
              />
            </Section>

            <Section title="ALT TIMELINE" icon={Activity}>
              <AltitudeChart data={altHistory} callsign={flight.callsign} />
            </Section>

            <div className="rounded-sm border border-[#FF3366]/30 bg-[#FF3366]/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-[0.3em] text-[#FF3366] hud-glow-red">
                  MITRE ATT&CK CHAIN
                </span>
                <span className="font-mono-data text-[9px] text-[#FF3366]/70">
                  T1565.002 · T1499 · T1200
                </span>
              </div>
              <ol className="space-y-1.5">
                {attackChain.length === 0 && (
                  <li className="text-[11px] text-[#5A6478]">No active TTPs detected.</li>
                )}
                {attackChain.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-[#E6EDF7]">
                    <span className="font-mono-data text-[#FF3366] font-semibold">{String(i + 1).padStart(2, "0")}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-[#1F2A3A] bg-[#141A24]">
      <div className="flex items-center gap-2 border-b border-[#1F2A3A] px-3 py-1.5">
        <Icon className="h-3 w-3 text-[#00E5FF] icon-glow-cyan" />
        <span className="text-[9px] font-semibold tracking-[0.3em] text-[#00E5FF]/85">{title}</span>
      </div>
      <div className="p-3.5 space-y-2.5">{children}</div>
    </div>
  );
}

function Row({
  k,
  v,
  unit,
  color,
  accent,
}: {
  k: string;
  v: string;
  unit?: string;
  color?: string;
  accent?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#5A6478]">{k}</span>
      <span
        className={`font-mono-data text-[15px] font-bold tabular-nums ${
          accent ? "text-[#00E5FF] hud-glow-cyan" : (color ?? "text-[#E6EDF7]")
        }`}
      >
        {v}
        {unit && (
          <span className="ml-1 text-[10px] font-medium tracking-wider text-[#5A6478]">{unit}</span>
        )}
      </span>
    </div>
  );
}

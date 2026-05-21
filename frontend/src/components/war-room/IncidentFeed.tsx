import type { ThreatLabel } from "@/lib/threat-classifier";
import { severityOf } from "@/lib/threat-classifier";
import { AlertTriangle, Radio, ShieldAlert } from "lucide-react";

export interface IncidentLog {
  id: string;
  ts: number;
  callsign: string;
  label: ThreatLabel;
  detail: string;
}

export function IncidentFeed({
  logs,
  onSelect,
  selected,
}: {
  logs: IncidentLog[];
  onSelect: (cs: string) => void;
  selected: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[#1F2A3A] bg-[#141A24] px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-semibold tracking-[0.35em] text-[#00E5FF]/80">PANEL 01</span>
          <span className="text-[13px] font-semibold tracking-[0.18em] text-[#E6EDF7]">LIVE INCIDENT FEED</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#34D399] shadow-[0_0_8px_#34D399]" />
          <span className="text-[10px] font-medium tracking-[0.2em] text-[#34D399]">ACTIVE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll bg-[#0F141C] p-2 space-y-1.5">
        {logs.length === 0 && (
          <div className="p-6 text-center text-xs tracking-wider text-[#5A6478]">
            AWAITING TELEMETRY...
          </div>
        )}
        {logs.map((log) => {
          const sev = severityOf(log.label);
          const isCritical = sev === "CRITICAL";
          const isWarning = sev === "WARNING";
          const isSel = selected === log.callsign;

          const Icon = isCritical ? ShieldAlert : isWarning ? AlertTriangle : Radio;
          const accentText = isCritical
            ? "text-[#FF3366] hud-glow-red"
            : isWarning
              ? "text-[#FFB020]"
              : "text-[#00E5FF] hud-glow-cyan";
          const badge = isCritical
            ? "bg-[#FF3366]/15 text-[#FF3366] border-[#FF3366]/50"
            : isWarning
              ? "bg-[#FFB020]/10 text-[#FFB020] border-[#FFB020]/40"
              : "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30";

          const cardSurface = isCritical
            ? "bg-[#2A0F18] border-[#FF3366]/45"
            : isWarning
              ? "bg-[#141A24] border-[#FFB020]/35"
              : "bg-[#141A24] border-[#1F2A3A]";

          const staticBar = isCritical
            ? "bg-[#FF3366] shadow-[0_0_8px_#FF3366]"
            : isWarning
              ? "bg-[#FFB020]"
              : "bg-transparent";

          return (
            <button
              key={log.id}
              onClick={() => onSelect(log.callsign)}
              className={`group relative flex w-full cursor-pointer gap-3 overflow-hidden rounded-sm border px-4 py-3 pl-4 text-left transition-colors ${cardSurface} ${
                isSel ? "ring-1 ring-[#00E5FF]/50 bg-[#00E5FF]/[0.05]" : ""
              } hover:bg-[#00E5FF]/[0.04]`}
            >
              {/* static severity bar */}
              <span className={`absolute left-0 top-0 h-full w-[3px] ${staticBar}`} />
              {/* sliding teal hover bar */}
              <span
                className={`absolute left-0 top-0 h-full w-[3px] bg-[#00E5FF] shadow-[0_0_10px_#00E5FF] transition-transform duration-200 ease-out ${
                  isSel ? "translate-x-0" : "-translate-x-full group-hover:translate-x-0"
                }`}
              />

              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accentText}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono-data text-[12px] font-semibold ${accentText}`}>
                    {log.callsign}
                  </span>
                  <span className="font-mono-data text-[10px] text-[#5A6478]">
                    {new Date(log.ts).toLocaleTimeString("en-GB")}
                  </span>
                </div>
                <div
                  className={`mt-1 inline-block rounded-sm border px-1.5 py-0.5 text-[9px] font-medium tracking-[0.12em] ${badge}`}
                >
                  {sev} · {log.label}
                </div>
                <div className={`mt-1.5 text-[11px] leading-relaxed ${isCritical ? "text-[#F5C9D2]" : "text-[#8A95A8]"}`}>
                  {log.detail}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

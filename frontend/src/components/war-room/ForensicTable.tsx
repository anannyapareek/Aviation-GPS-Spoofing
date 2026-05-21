import { Lock, ShieldAlert, FileSearch } from "lucide-react";
import type { IncidentLog } from "./IncidentFeed";
import { severityOf } from "@/lib/threat-classifier";

interface Props {
  logs: IncidentLog[];
  locked: boolean;
  onSelect?: (callsign: string) => void;
}

export function ForensicTable({ logs, locked, onSelect }: Props) {
  if (locked) return <LockedState />;

  const rows = logs.slice(0, 12);
  return (
    <div className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <FileSearch className="h-3.5 w-3.5 text-[#00E5FF] icon-glow-cyan" />
        <span className="text-[10px] font-semibold tracking-[0.35em] text-[#00E5FF]/85">
          PANEL 04 // FORENSIC TIMELINE
        </span>
        <span className="ml-auto font-mono-data text-[10px] tracking-[0.2em] text-[#5A6478]">
          {String(rows.length).padStart(2, "0")} RECORDS
        </span>
      </div>
      <div className="overflow-hidden rounded-sm border border-[#1F2A3A] bg-[#0F141C]">
        <table className="w-full text-[11px]">
          <thead className="bg-[#141A24] text-[9px] font-semibold tracking-[0.3em] text-[#00E5FF]/80">
            <tr>
              <th className="px-3 py-2 text-left">TS</th>
              <th className="px-3 py-2 text-left">CALLSIGN</th>
              <th className="px-3 py-2 text-left">SEVERITY</th>
              <th className="px-3 py-2 text-left">EVENT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2A3A]">
            {rows.map((l) => {
              const sev = severityOf(l.label);
              return (
                <tr
                  key={l.id}
                  onClick={() => onSelect?.(l.callsign)}
                  className="cursor-pointer text-[#E6EDF7] transition hover:bg-[#00E5FF]/[0.05]"
                >
                  <td className="px-3 py-1.5 font-mono-data text-[#5A6478]">
                    {new Date(l.ts).toISOString().slice(11, 19)}
                  </td>
                  <td className="px-3 py-1.5 font-mono-data font-bold text-[#00E5FF] hud-glow-cyan">{l.callsign}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] ${
                        sev === "CRITICAL"
                          ? "bg-[#FF3366]/15 text-[#FF3366]"
                          : "bg-[#00E5FF]/10 text-[#00E5FF]"
                      }`}
                    >
                      {sev}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[#8A95A8]">{l.detail}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[#5A6478]">
                  Awaiting forensic events…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LockedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">
          <Lock className="h-5 w-5 text-red-400" />
        </div>
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-[10px] tracking-[0.35em] text-red-400">
          <ShieldAlert className="h-3 w-3" />
          ACCESS RESTRICTED
        </div>
        <div className="mt-1 text-xs tracking-[0.2em] text-zinc-400">
          FORENSIC DATA · CLEARANCE LEVEL 2 REQUIRED
        </div>
        <div className="mt-2 text-[10px] tracking-[0.25em] text-zinc-600">
          ROLE_OBSERVER lacks privileges to view this panel. Contact administrator.
        </div>
      </div>
    </div>
  );
}

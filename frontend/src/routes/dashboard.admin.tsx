import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Users, Shield, Activity, Trash2, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/admin")({
  component: AdminPanel,
});

const MOCK_USERS = [
  { id: "u-001", username: "admin", role: "ROLE_ADMIN", status: "ACTIVE", lastSeen: "now" },
  { id: "u-002", username: "analyst", role: "ROLE_ANALYST", status: "ACTIVE", lastSeen: "2m ago" },
  { id: "u-003", username: "observer", role: "ROLE_OBSERVER", status: "ACTIVE", lastSeen: "11m ago" },
  { id: "u-004", username: "j.reyes", role: "ROLE_ANALYST", status: "REVOKED", lastSeen: "3d ago" },
  { id: "u-005", username: "k.tanaka", role: "ROLE_OBSERVER", status: "PENDING", lastSeen: "—" },
];

function AdminPanel() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || !user) return;
    if (user.role !== "ROLE_ADMIN") navigate({ to: "/dashboard/map-view" });
  }, [ready, user, navigate]);

  if (!user || user.role !== "ROLE_ADMIN") return null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-cyan-400/20 bg-black/50 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-cyan-400" />
          <div>
            <div className="text-[10px] tracking-[0.3em] text-cyan-400/70">CONTROL PLANE</div>
            <div className="text-sm font-bold tracking-[0.25em] text-zinc-100">USER MANAGEMENT</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-sm border border-cyan-400/30 bg-cyan-400/5 px-2 py-1">
          <Shield className="h-3 w-3 text-cyan-400" />
          <span className="text-[9px] tracking-[0.3em] text-cyan-400">ADMIN CLEARANCE</span>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-12 gap-4 overflow-auto p-6 custom-scroll">
        <div className="col-span-12 grid grid-cols-3 gap-4">
          <Metric label="OPERATORS" value="05" tone="cyan" />
          <Metric label="ACTIVE SESSIONS" value="03" tone="emerald" />
          <Metric label="REVOKED" value="01" tone="red" />
        </div>

        <div className="col-span-12 rounded-sm border border-cyan-400/20 bg-black/40">
          <div className="flex items-center justify-between border-b border-cyan-400/15 px-4 py-2">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] tracking-[0.3em] text-cyan-400">ROSTER // ACCESS CONTROL</span>
            </div>
            <button className="rounded-sm border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-[10px] tracking-[0.3em] text-cyan-300 hover:bg-cyan-400/20">
              + PROVISION OPERATOR
            </button>
          </div>

          <table className="w-full text-[11px]">
            <thead className="bg-cyan-400/5 text-[9px] tracking-[0.3em] text-cyan-400/80">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">OPERATOR</th>
                <th className="px-4 py-2 text-left">ROLE</th>
                <th className="px-4 py-2 text-left">STATUS</th>
                <th className="px-4 py-2 text-left">LAST SEEN</th>
                <th className="px-4 py-2 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-400/10">
              {MOCK_USERS.map((u) => (
                <tr key={u.id} className="text-zinc-300 hover:bg-cyan-400/5">
                  <td className="px-4 py-2 font-mono text-zinc-500">{u.id}</td>
                  <td className="px-4 py-2 font-bold text-cyan-300">{u.username}</td>
                  <td className="px-4 py-2 text-zinc-400">{u.role}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[9px] tracking-[0.2em] ${
                        u.status === "ACTIVE"
                          ? "bg-emerald-400/15 text-emerald-400"
                          : u.status === "REVOKED"
                            ? "bg-red-500/15 text-red-400"
                            : "bg-orange-300/15 text-orange-300"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{u.lastSeen}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className="rounded-sm border border-cyan-400/30 p-1 text-cyan-300 hover:bg-cyan-400/10" title="Rotate token">
                        <KeyRound className="h-3 w-3" />
                      </button>
                      <button className="rounded-sm border border-red-500/30 p-1 text-red-400 hover:bg-red-500/10" title="Revoke">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "cyan" | "emerald" | "red" }) {
  const color =
    tone === "cyan" ? "text-cyan-400 border-cyan-400/30" : tone === "emerald" ? "text-emerald-400 border-emerald-400/30" : "text-red-400 border-red-500/30";
  return (
    <div className={`rounded-sm border bg-black/40 p-4 ${color}`}>
      <div className="text-[9px] tracking-[0.35em] opacity-70">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-wider">{value}</div>
    </div>
  );
}

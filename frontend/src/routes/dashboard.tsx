import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Radar, Map, ShieldAlert, Users, LogOut } from "lucide-react";
import { useAuth, landingFor } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050505] text-cyan-400 text-[10px] tracking-[0.4em] animate-pulse">
        VERIFYING CLEARANCE…
      </div>
    );
  }

  const role = user.role;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050505] text-zinc-200">
      {/* Sidebar */}
      <aside className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-cyan-400/15 bg-black/60 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-cyan-400/40 bg-cyan-400/10">
          <Radar className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="my-2 h-px w-8 bg-cyan-400/20" />

        {/* War Room - analyst + admin */}
        {(role === "ROLE_ANALYST" || role === "ROLE_ADMIN") && (
          <NavIcon to="/dashboard/war-room" label="War Room" icon={<ShieldAlert className="h-4 w-4" />} />
        )}
        {/* Map View - everyone */}
        <NavIcon to="/dashboard/map-view" label="Live Map" icon={<Map className="h-4 w-4" />} />
        {/* User Management - admin only */}
        {role === "ROLE_ADMIN" && (
          <NavIcon to="/dashboard/admin" label="User Management" icon={<Users className="h-4 w-4" />} />
        )}

        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="rounded-sm border border-cyan-400/30 px-1 py-0.5 text-[8px] tracking-[0.2em] text-cyan-400">
            {role.replace("ROLE_", "").slice(0, 3)}
          </div>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
            title="Logout"
            className="rounded-sm border border-zinc-700 p-1.5 text-zinc-400 transition hover:border-red-400/50 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

function NavIcon({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      to={to}
      title={label}
      activeProps={{ className: "border-cyan-400/60 bg-cyan-400/15 text-cyan-300" }}
      inactiveProps={{ className: "border-transparent text-zinc-500 hover:text-cyan-300 hover:border-cyan-400/30" }}
      className="flex h-9 w-9 items-center justify-center rounded-sm border transition"
    >
      {icon}
    </Link>
  );
}

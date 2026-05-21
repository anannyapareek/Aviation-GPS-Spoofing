import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, landingFor } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (user) navigate({ to: landingFor(user.role) });
    else navigate({ to: "/login" });
  }, [ready, user, navigate]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#050505] text-cyan-400">
      <div className="text-[10px] tracking-[0.4em] animate-pulse">INITIALIZING SECURE CHANNEL…</div>
    </div>
  );
}

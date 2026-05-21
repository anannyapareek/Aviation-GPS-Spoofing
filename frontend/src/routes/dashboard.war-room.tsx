import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { WarRoom } from "@/components/war-room/WarRoom";
import { useAuth, landingFor } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/war-room")({
  component: WarRoomRoute,
});

function WarRoomRoute() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready || !user) return;
    if (user.role === "ROLE_OBSERVER") navigate({ to: landingFor(user.role) });
  }, [ready, user, navigate]);

  if (!user || user.role === "ROLE_OBSERVER") return null;
  return <WarRoom variant="full" />;
}

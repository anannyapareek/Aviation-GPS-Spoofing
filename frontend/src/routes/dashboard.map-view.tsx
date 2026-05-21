import { createFileRoute } from "@tanstack/react-router";
import { WarRoom } from "@/components/war-room/WarRoom";

export const Route = createFileRoute("/dashboard/map-view")({
  component: () => <WarRoom variant="map-only" />,
});

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FlightTick } from "@/lib/flight-simulator";
import type { ThreatLabel } from "@/lib/threat-classifier";

interface Props {
  flights: FlightTick[];
  threats: Record<string, ThreatLabel>;
  ghostPaths: Record<string, [number, number][]>;
  trails?: Record<string, [number, number][]>;
  selected: string | null;
  focusTarget?: { callsign: string; ts: number } | null;
  onSelect: (cs: string) => void;
  mapboxToken?: string;
}

const AIRPORTS = [
  { code: "DXB", lat: 25.2532, lon: 55.3657 },
  { code: "AUH", lat: 24.4330, lon: 54.6511 },
  { code: "SHJ", lat: 25.3286, lon: 55.5172 },
  { code: "DWC", lat: 24.9169, lon: 55.1580 }
];

const createPlaneIcon = (heading: number, color: string, pulse: boolean, isSelected: boolean, callsign: string) => {
  const scale = isSelected ? 'scale-125 z-50 opacity-100' : 'scale-100 opacity-80 hover:opacity-100';
  return L.divIcon({
    html: `
      <div class="relative group" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div class="${pulse ? 'war-pulse-red' : ''} ${scale} transition-transform duration-300">
          <svg width="22" height="22" viewBox="0 0 24 24" style="transform:rotate(${heading}deg);filter:drop-shadow(0 0 6px ${color});">
            <path d="M12 2 L15 14 L22 17 L13 17 L12 22 L11 17 L2 17 L9 14 Z" fill="${color}" stroke="${color}" stroke-width="0.5"/>
          </svg>
        </div>
        <span class="font-mono-data absolute left-6 top-0 whitespace-nowrap text-[10px] tracking-wider transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}" style="color:${color};text-shadow:0 0 4px ${color}">
          ${callsign}
        </span>
      </div>
    `,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const createGhostIcon = (heading: number, callsign: string) => {
  return L.divIcon({
    html: `
      <div style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;position:relative;">
        <svg width="18" height="18" viewBox="0 0 24 24" style="transform:rotate(${heading}deg);opacity:0.55;">
          <path d="M12 2 L15 14 L22 17 L13 17 L12 22 L11 17 L2 17 L9 14 Z" fill="none" stroke="#FF3366" stroke-width="1.2" stroke-dasharray="2 1.5"/>
        </svg>
        <span class="font-mono-data" style="position:absolute;left:20px;top:0;white-space:nowrap;font-size:9px;color:#FF3366;opacity:0.7;">
          ${callsign}·EXP
        </span>
      </div>
    `,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
};

const createAirportIcon = (code: string) => {
  return L.divIcon({
    html: `
      <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
        <div style="width:6px;height:6px;background:#00E5FF;border-radius:50%;opacity:0.6;"></div>
        <div style="position:absolute;width:20px;height:20px;border:1px solid #00E5FF;border-radius:50%;animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;opacity:0.4;"></div>
        <span class="font-mono-data" style="position:absolute;left:15px;top:2px;font-size:10px;color:#00E5FF;opacity:0.7;letter-spacing:1px;font-family:monospace;">
          ${code}
        </span>
      </div>
    `,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

// Component to handle flying to focus target
function MapController({ focusTarget, flights }: { focusTarget: Props["focusTarget"], flights: Props["flights"] }) {
  const map = useMap();
  useEffect(() => {
    if (!focusTarget) return;
    const f = flights.find(x => x.callsign === focusTarget.callsign);
    if (!f) return;
    map.flyTo([f.lat, f.lon], 8, { animate: true, duration: 1.5 });
  }, [focusTarget, flights, map]);
  return null;
}

export function WarRoomMap({
  flights,
  threats,
  ghostPaths,
  trails,
  selected,
  focusTarget,
  onSelect,
}: Props) {
  // Free CartoDB Dark Matter tile server (no mapbox token required!)
  const tileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";

  return (
    <div className="absolute inset-0 bg-[#030508] overflow-hidden">
      <MapContainer 
        center={[24.5, 54.0]} 
        zoom={6} 
        style={{ width: "100%", height: "100%", background: "#030508", cursor: "crosshair" }}
        zoomControl={false}
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          opacity={0.7}
        />
        <MapController focusTarget={focusTarget} flights={flights} />
        
        {/* Render Strategic Airports */}
        {AIRPORTS.map((apt) => (
          <Marker 
            key={apt.code} 
            position={[apt.lat, apt.lon]} 
            icon={createAirportIcon(apt.code)} 
            interactive={false}
          />
        ))}

        {/* Faint Breadcrumb Trails */}
        {trails && Object.entries(trails).map(([cs, coords]) => {
          if (coords.length < 2) return null;
          const threat = threats[cs] ?? "NORMAL";
          const spoofed = threat.startsWith("MITRE");
          const stroke = spoofed ? "#FF3366" : "#00E5FF";
          return (
            <Polyline 
              key={`trail-${cs}`} 
              positions={coords.map(c => [c[1], c[0]])} 
              color={stroke} 
              weight={2} 
              opacity={spoofed ? 0.45 : 0.28} 
              interactive={false}
            />
          );
        })}

        {/* Spoofed Ghost Paths */}
        {Object.entries(ghostPaths).map(([cs, coords]) => {
          if (coords.length < 2) return null;
          return (
            <Polyline 
              key={`ghost-${cs}`} 
              positions={coords.map(c => [c[1], c[0]])} 
              color="#FF3366" 
              weight={2} 
              dashArray="4 4"
              opacity={0.85} 
              interactive={false}
            />
          );
        })}

        {/* Deviation Vectors */}
        {flights.map(f => {
          const threat = threats[f.callsign] ?? "NORMAL";
          if (!threat.startsWith("MITRE")) return null;
          return (
            <div key={`dev-group-${f.callsign}`}>
              <Polyline 
                positions={[[f.lat, f.lon], [f.projected_lat, f.projected_lon]]} 
                color="#FF3366" 
                weight={1.5} 
                dashArray="4 4"
                opacity={0.95} 
                interactive={false}
              />
              <Marker 
                position={[f.projected_lat, f.projected_lon]} 
                icon={createGhostIcon(f.heading, f.callsign)} 
                interactive={false}
              />
            </div>
          );
        })}

        {/* Live Flights */}
        {flights.map(f => {
          const threat = threats[f.callsign] ?? "NORMAL";
          const spoofed = threat.startsWith("MITRE");
          const glitch = threat === "SENSOR_GLITCH";
          const color = spoofed ? "#FF3366" : glitch ? "#FFB020" : "#00E5FF";
          const isSelected = selected === f.callsign;

          return (
            <Marker 
              key={f.callsign}
              position={[f.lat, f.lon]}
              icon={createPlaneIcon(f.heading, color, spoofed, isSelected, f.callsign)}
              eventHandlers={{ click: () => onSelect(f.callsign) }}
              zIndexOffset={isSelected ? 1000 : 0}
            />
          );
        })}
      </MapContainer>

      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-0 z-[1000] shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
        <div className="font-mono-data absolute left-4 top-4 text-[12px] font-bold tracking-[0.35em] text-[#00E5FF]/90">
          TACTICAL RADAR · MIDDLE EAST SECTOR
        </div>
        <div className="font-mono-data absolute left-4 bottom-4 text-[10px] tracking-[0.25em] text-[#00E5FF]/60">
          ENGINE: LEAFLET · CARTO DARK MATTER
        </div>
        <div className="font-mono-data absolute right-4 bottom-4 text-[10px] tracking-[0.25em] text-[#00E5FF]/60 bg-black/40 px-2 py-1 rounded">
          STATUS: GLOBAL FLIGHT TRACKING ONLINE
        </div>
      </div>
    </div>
  );
}

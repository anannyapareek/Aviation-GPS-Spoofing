// Synthetic flight feed used when the real WS endpoint is unreachable.
// Generates realistic ADS-B-style telemetry plus a couple of spoofed targets.

export interface FlightTick {
  callsign: string;
  lat: number; // reported (possibly drifted when spoofed)
  lon: number;
  projected_lat: number; // clean flight-plan position
  projected_lon: number;
  altitude: number; // ft reported
  projected_altitude: number; // ft expected by flight plan
  heading: number;
  velocity: number; // km/h
  origin: string;
  destination: string;
  spoofed_seed?: boolean; // injects bad data
  timestamp: number;
}

interface FlightState {
  callsign: string;
  lat: number;       // reported
  lon: number;
  proj_lat: number;  // clean projected
  proj_lon: number;
  alt: number;
  heading: number;
  velocity: number;
  origin: string;
  destination: string;
  spoofed_seed: boolean;
  drift_lat: number;
  drift_lon: number;
}

const FLIGHTS: FlightState[] = [
  { callsign: "UAL128", lat: 40.64, lon: -73.78, proj_lat: 40.64, proj_lon: -73.78, alt: 34000, heading: 80, velocity: 870, origin: "JFK", destination: "LHR", spoofed_seed: false, drift_lat: 0, drift_lon: 0 },
  { callsign: "DLH441", lat: 50.03, lon: 8.56, proj_lat: 50.03, proj_lon: 8.56, alt: 36000, heading: 270, velocity: 890, origin: "FRA", destination: "ORD", spoofed_seed: true, drift_lat: 0, drift_lon: 0 },
  { callsign: "AFR083", lat: 49.0, lon: 2.55, proj_lat: 49.0, proj_lon: 2.55, alt: 38000, heading: 250, velocity: 905, origin: "CDG", destination: "JFK", spoofed_seed: false, drift_lat: 0, drift_lon: 0 },
  { callsign: "BAW219", lat: 51.47, lon: -0.45, proj_lat: 51.47, proj_lon: -0.45, alt: 33000, heading: 270, velocity: 850, origin: "LHR", destination: "IAD", spoofed_seed: false, drift_lat: 0, drift_lon: 0 },
  { callsign: "QFA12", lat: -33.94, lon: 151.17, proj_lat: -33.94, proj_lon: 151.17, alt: 39000, heading: 60, velocity: 920, origin: "SYD", destination: "LAX", spoofed_seed: false, drift_lat: 0, drift_lon: 0 },
  { callsign: "EK203", lat: 25.25, lon: 55.36, proj_lat: 25.25, proj_lon: 55.36, alt: 37000, heading: 310, velocity: 880, origin: "DXB", destination: "JFK", spoofed_seed: true, drift_lat: 0, drift_lon: 0 },
  { callsign: "SWR23", lat: 47.46, lon: 8.55, proj_lat: 47.46, proj_lon: 8.55, alt: 35000, heading: 290, velocity: 860, origin: "ZRH", destination: "BOS", spoofed_seed: false, drift_lat: 0, drift_lon: 0 },
  { callsign: "ANA7", lat: 35.55, lon: 139.78, proj_lat: 35.55, proj_lon: 139.78, alt: 38000, heading: 50, velocity: 900, origin: "HND", destination: "ORD", spoofed_seed: false, drift_lat: 0, drift_lon: 0 },
];

function step(f: FlightState) {
  const rad = (f.heading * Math.PI) / 180;
  const dist = f.velocity / 3600 / 60; // approx deg per tick
  const dLat = Math.cos(rad) * dist * 0.5;
  const dLon = Math.sin(rad) * dist * 0.5;
  f.proj_lat += dLat;
  f.proj_lon += dLon;
  f.lat += dLat;
  f.lon += dLon;
}

export function tickFlights(): FlightTick[] {
  const now = Date.now();
  return FLIGHTS.map((f) => {
    step(f);
    const isSpoofTick = f.spoofed_seed && Math.random() > 0.25;
    const reportedAlt = f.alt + (Math.random() - 0.5) * 200;
    const reportedAltFinal = isSpoofTick ? reportedAlt - 1500 - Math.random() * 800 : reportedAlt;
    const velocity = isSpoofTick ? 1050 + Math.random() * 80 : f.velocity + (Math.random() - 0.5) * 8;

    // Spoofed flights gradually drift sideways from the clean projected track.
    if (isSpoofTick) {
      const perp = ((f.heading + 90) * Math.PI) / 180;
      const drift = 0.05 + Math.random() * 0.04;
      f.drift_lat += Math.cos(perp) * drift;
      f.drift_lon += Math.sin(perp) * drift;
      f.lat = f.proj_lat + f.drift_lat;
      f.lon = f.proj_lon + f.drift_lon;
    } else if (f.spoofed_seed) {
      // mild persistence between ticks
      f.lat = f.proj_lat + f.drift_lat;
      f.lon = f.proj_lon + f.drift_lon;
    }

    return {
      callsign: f.callsign,
      lat: f.lat,
      lon: f.lon,
      projected_lat: f.proj_lat,
      projected_lon: f.proj_lon,
      altitude: reportedAltFinal,
      projected_altitude: f.alt,
      heading: f.heading,
      velocity,
      origin: f.origin,
      destination: f.destination,
      spoofed_seed: f.spoofed_seed,
      timestamp: now,
    };
  });
}

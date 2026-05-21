## Panel 01 — Live Incident Feed

**File:** `src/components/war-room/IncidentFeed.tsx`

1. **Card surfaces** — give every log card a distinct surface above the panel canvas: card `bg-[#141A24]` on `#0F141C` panel, 1px inset border `border-[#1F2A3A]`, 6px vertical gap between cards (wrap list in `space-y-1.5 p-2`).
2. **Severity tinting** — for `CRITICAL` (spoof/anomaly) entries, switch the card background to a deep red wash `bg-[#FF3366]/12` with `border-[#FF3366]/40` so the scroll rhythm breaks. `WARNING` keeps an amber border; `INFO` keeps the existing teal-tag look on the neutral card.
3. **Interactive button states**
   - Card already is a `<button>`; add `cursor-pointer`, `group` class.
   - Left accent bar becomes a 3px teal slider: `absolute left-0 top-0 h-full w-[3px] bg-[#00E5FF] -translate-x-full group-hover:translate-x-0 transition-transform duration-200`. (Critical cards keep their red bar in the static state; teal bar slides in on hover above it.)
   - Selected card: persistent teal bar + subtle `bg-[#00E5FF]/[0.05]` background.
4. **Map snap on click** — clicking a log already calls `onSelect(callsign)`, which sets `selected` and loads the flight into Panel 03. To also snap the map:
   - Add a `focusTarget` state in `WarRoom.tsx` (`{ callsign, ts }`), set it alongside `setSelected` from the feed click.
   - Pass `focusTarget` into `WarRoomMap`. New effect in the map:
     - **Mapbox path:** `map.flyTo({ center: [lon, lat], zoom: 4.5, speed: 1.4 })` on the matching flight.
     - **SVG fallback path:** render a brief expanding teal ring at the projected x/y for ~900ms (animates out via Tailwind keyframe `animate-ping` on a positioned div).

## Panel 03 — Target Telemetry

**File:** `src/components/war-room/TelemetryPanel.tsx`

1. **Two-column readout rows** — rework `Row`:
   - Grid `grid grid-cols-[1fr_auto] items-baseline gap-4` per row, with 8–10px vertical rhythm.
   - Label left: `text-[10px] uppercase tracking-[0.22em] text-[#5A6478] font-medium`.
   - Value right: `font-mono-data text-[15px] font-bold text-[#E6EDF7]` (callsign / status keep their teal/red accent color). Numeric values render with their unit in a smaller dim suffix span (e.g. `868` bold + ` km/h` `text-[10px] text-[#5A6478] ml-1`).
   - Drop the existing right-padded space hacks (`padStart`) in favor of `tabular-nums` from `.font-mono-data`.
2. **Section spacing** — increase per-section inner padding to `p-3.5 space-y-2.5` to breathe with the new larger values.

## Panel 03 — Altitude Timeline

**File:** `src/components/war-room/AltitudeChart.tsx`

1. Switch from `AreaChart` + `Area` to `ComposedChart` + two `Line` series (no fills, no gradients).
   - `reported`: solid `#00E5FF`, `strokeWidth={1.75}`, no dots.
   - `projected`: `#6B7280`, `strokeWidth={1.25}`, `strokeDasharray="2 3"`, no dots.
2. **Divergence stripe fill between the two lines** (not background bands):
   - Add derived series `divHigh = max(reported, projected)` and `divLow = min(reported, projected)` only when `|reported − projected| > 800` (else both equal `reported` so the band collapses to zero height).
   - Render an SVG `<defs><pattern>` with diagonal warning stripes (45°, alternating `#FFB020` at 0.35 opacity and transparent, 6px spacing).
   - Add an `<Area dataKey="divHigh" baseLine={(d) => d.divLow}>` style band — implement via Recharts trick: stack two `Area`s using `dataKey="divLow"` invisible + `dataKey="divHigh"` minus low, or simpler — render a custom SVG layer on top via Recharts' `Customized` component that walks `chartProps.formattedGraphicalItems` and draws a `<polygon>` fill with the pattern between the two line points. Use the `Customized` approach to keep the band perfectly between the curves.
3. Trim legend to two pills (REPORTED solid teal swatch, PROJECTED dotted gray swatch) — drop DELTA pill; the diagonal stripes are self-explanatory.
4. Remove background tint, axis lines, and Y-axis ticks for a flat minimalist look; keep a single subtle `#1F2A3A` horizontal baseline.

## Light coordination edits

- `src/components/war-room/WarRoom.tsx` — add `focusTarget` state + setter passed to `IncidentFeed` (via existing `onSelect` wrapper) and to `WarRoomMap` as a new prop.
- `src/components/war-room/WarRoomMap.tsx` — accept `focusTarget`, implement Mapbox `flyTo` and SVG ping ring.

No changes to data shape, threat classifier, simulator, or auth.

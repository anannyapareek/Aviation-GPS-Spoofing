// dashboard/src/components/MapboxGlobe.tsx
'use client';

import { useState, useMemo } from 'react';
import Map, { Marker, ViewStateChangeEvent, MapLayerMouseEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Plane, AlertTriangle } from 'lucide-react';
import { WebSocketMessage } from '@/hooks/useWebSockets';

interface MapboxGlobeProps {
    traffic: Record<string, WebSocketMessage>;
    selectedAircraft: string | null;
    onSelectAircraft: (icao24: string) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || import.meta.env?.VITE_MAPBOX_TOKEN || '';

export default function MapboxGlobe({ traffic, selectedAircraft, onSelectAircraft }: MapboxGlobeProps) {
    const [viewState, setViewState] = useState({
        longitude: 55.2708,
        latitude: 25.2048,
        zoom: 5,
        pitch: 45,
    });

    const markers = useMemo(() => {
        return Object.values(traffic).map((msg) => {
            const isAnomaly = msg.type === 'alert';
            const isSelected = msg.icao24 === selectedAircraft;

            let color = 'text-green-500'; // Normal
            if (isAnomaly) {
                if (msg.analysis?.assessment?.severity === 'CRITICAL') color = 'text-red-500 animate-pulse';
                else color = 'text-yellow-500';
            }

            return (
                <Marker
                    key={msg.icao24}
                    longitude={msg.packet.lon}
                    latitude={msg.packet.lat}
                    anchor="center"
                    onClick={(e: MapLayerMouseEvent) => {
                        e.originalEvent.stopPropagation();
                        onSelectAircraft(msg.icao24);
                    }}
                >
                    <div className={`cursor-pointer transition-transform ${isSelected ? 'scale-150 z-50' : 'scale-100 hover:scale-125'}`}>
                        <Plane
                            className={`${color} drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]`}
                            size={24}
                            style={{ transform: `rotate(${(msg.packet.velocity || 0) - 90}deg)` }}
                        />
                    </div>
                </Marker>
            );
        });
    }, [traffic, selectedAircraft, onSelectAircraft]);

    return (
        <div className="w-full h-full relative rounded-xl overflow-hidden border border-gray-800">
            <Map
                {...viewState}
                onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
                terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
            >
                {markers}
            </Map>
        </div>
    );
}